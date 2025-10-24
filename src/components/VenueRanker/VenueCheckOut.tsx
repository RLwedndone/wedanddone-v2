// src/components/VenueRanker/VenueCheckOut.tsx
import React, { useState, useEffect, useRef } from "react";
import { Elements } from "@stripe/react-stripe-js";
import { stripePromise } from "../../utils/stripePromise";
import { getAuth } from "firebase/auth";
import { doc, getDoc, setDoc, arrayUnion, serverTimestamp } from "firebase/firestore";
import { db } from "../../firebase/firebaseConfig";
import { useUser } from "../../contexts/UserContext";
import CheckoutForm from "../../CheckoutForm";
import { generateVenueAgreementPDF } from "../../utils/generateVenueAgreementPDF";
import { uploadPdfBlob } from "../../helpers/firebaseUtils";
import { sendAdminNotification } from "../../utils/sendAdminNotification";
import emailjs from "@emailjs/browser";
import { VENUE_MENU_MAP } from "../../utils/venueMenuMap";
import { getGuestState, setAndLockGuestCount } from "../../utils/guestCountStore";
import { format, parseISO, isValid as isValidDate } from "date-fns";

function safeParseDate(input: any): Date | null {
  if (!input) return null;
  if (input instanceof Date) return isValidDate(input) ? input : null;
  if (typeof input === "string") {
    const isoTry = parseISO(input);
    if (isValidDate(isoTry)) return isoTry;
    const d = new Date(input);
    return isValidDate(d) ? d : null;
  }
  const d = new Date(input);
  return isValidDate(d) ? d : null;
}

function fmtPretty(d: Date | null): string {
  return d ? format(d, "MMMM d, yyyy") : "";
}

emailjs.init(import.meta.env.VITE_EMAILJS_PUBLIC_KEY);

interface VenueCheckOutProps {
  onClose: () => void;
  setStepSuccess?: () => void;
  setCurrentScreen: (screen: string) => void;
}

const FINAL_DUE_DAYS = 45;

const fmtMoney = (n: number) =>
  Number.isFinite(n)
    ? n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : "0.00";

const sanitizeForPdf = (s: string) =>
  String(s || "")
    .replace(/<\/?[^>]+>/g, "")
    .replace(/[•◦▪∙·]/g, "-")
    .replace(/[-–—]\s*/g, "- ")
    .replace(/\s+/g, " ")
    .trim();

const VenueCheckOut: React.FC<VenueCheckOutProps> = ({ setCurrentScreen }) => {
  const { userData } = useUser();
  const auth = getAuth();
  const user = auth.currentUser;
  const uid = user?.uid || null;

  if (!uid) {
    console.error("❌ uid is undefined in VenueCheckOut");
    return <p style={{ textAlign: "center" }}>Missing user info...</p>;
  }

  const userRef = doc(db, "users", uid);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [contractData, setContractData] = useState<any>(null);

  useEffect(() => {
    const raw = localStorage.getItem("venueContractData");
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      const venueNameLS = localStorage.getItem("venueName") || "";
      const slug = (localStorage.getItem("venueSlug") || "").trim();
      const fallbackFromSlug = slug
        ? slug.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
        : "";
      const venueNameSafe =
        parsed.venueName || venueNameLS || fallbackFromSlug || "Selected Venue";

      const arr = (x: any) => (Array.isArray(x) ? x : []);
      const venueSpecificDetails = arr(parsed.venueSpecificDetails || parsed.venueTerms).map(sanitizeForPdf);
      const bookingTerms = arr(parsed.bookingTerms).map(sanitizeForPdf);

      setContractData({
        ...parsed,
        venueName: venueNameSafe,
        venueSpecificDetails,
        bookingTerms,
      });
    } catch (e) {
      console.error("❌ Failed to parse venueContractData:", e);
    }
  }, []);

  if (!userData || !contractData) {
    return <p style={{ textAlign: "center" }}>Loading your info...</p>;
  }

  const {
    venueName,
    weddingDate,
    venuePrice,
    depositAmount,
    monthlyPayment,
    numMonthlyPayments,
    signatureImage,
    firstName,
    lastName,
    payFull,
    venueSpecificDetails = [],
    bookingTerms = [],
  } = contractData;

  const total = Number(venuePrice) || 0;
  const isPayingFull = Boolean(payFull);
  const amountDueToday = isPayingFull ? total : Number(depositAmount) || 0;

  const weddingDateCandidate =
    weddingDate ||
    userData?.weddingDate ||
    localStorage.getItem("venueWeddingDate") ||
    "";

  const weddingDateObj =
    safeParseDate(weddingDateCandidate) ||
    safeParseDate(`${weddingDateCandidate}T12:00:00`);

  const finalDueDate = weddingDateObj
    ? new Date(weddingDateObj.getTime() - FINAL_DUE_DAYS * 24 * 60 * 60 * 1000)
    : null;

  const finalDueDateStr = finalDueDate
    ? fmtPretty(finalDueDate)
    : `${FINAL_DUE_DAYS} days before your wedding date`;

  const handleSuccess = async () => {
    setIsGenerating(true);
    try {
      console.log("🧭 [VenueCheckout] Start finalize flow");
      const userSnap = await getDoc(userRef);
      const userDoc = userSnap.data() || {};
      const existingDocs: any[] = Array.isArray(userDoc.documents) ? userDoc.documents : [];

      const paymentSummary = isPayingFull
        ? `Paid in Full: $${fmtMoney(total)}`
        : `Deposit: $${fmtMoney(amountDueToday)} + ${numMonthlyPayments} monthly payments of ${fmtMoney(
            monthlyPayment
          )} (final due ${finalDueDateStr}).`;

      const venueSlug = (localStorage.getItem("venueSlug") || "").trim();
      const venueNameFromLS = localStorage.getItem("venueName") || venueName;
      const metaFromMap = VENUE_MENU_MAP[venueSlug] || VENUE_MENU_MAP.santi_default;
      const cateringType =
        localStorage.getItem("cateringType") || metaFromMap?.cateringType || "custom";
      const setMenuId = localStorage.getItem("setMenuId") || metaFromMap?.setMenuId || null;

      localStorage.setItem("cateringType", cateringType);
      if (setMenuId) localStorage.setItem("setMenuId", setMenuId);

      const safeVenueSpecificDetails: string[] = Array.isArray(contractData?.venueSpecificDetails)
        ? contractData.venueSpecificDetails
        : Array.isArray(contractData?.venueTerms)
        ? contractData.venueTerms
        : [];

      const defaultBookingTerms: string[] = [
        "Deposit & payments. Your deposit is non-refundable once paid. If you select a monthly plan, remaining installments will be automatically charged to the card on file to complete by the final due date shown at checkout.",
        `Date & availability. Booking is for ${new Date(`${weddingDate}T12:00:00`).toLocaleDateString(
          "en-US",
          { year: "numeric", month: "long", day: "numeric" }
        )} at ${venueName}. If the venue is unable to host due to force majeure or venue closure, we’ll work in good faith to reschedule or refund venue fees paid to Wed&Done.`,
        `Guest count lock. Your guest count for this booking is ${
          userData.guestCount ?? "the number on file"
        }.`,
        "Planner fee reconciliation. If you already purchased planning via Pixie Planner, any amount paid there will be credited.",
        "Rescheduling. Subject to venue availability and possible additional fees.",
        "Cancellations. Venue deposits are non-refundable.",
        "Vendor rules. You agree to comply with venue rules (noise, decor, insurance, etc.).",
        "Liability. Wed&Done is not liable for consequential damages.",
        "Force majeure. Events beyond reasonable control may allow rescheduling or partial refunds.",
      ];

      const safeBookingTerms: string[] =
        Array.isArray(contractData?.bookingTerms) && contractData.bookingTerms.length
          ? contractData.bookingTerms
          : defaultBookingTerms;

      const pdfBlob = await generateVenueAgreementPDF({
        firstName,
        lastName,
        total: Number(total || 0),
        deposit: isPayingFull ? 0 : Number(amountDueToday || 0),
        paymentSummary,
        weddingDate,
        signatureImageUrl: signatureImage,
        venueName,
        guestCount: userData.guestCount || 0,
        venueSpecificDetails: safeVenueSpecificDetails,
        bookingTerms: safeBookingTerms,
      });

      await setDoc(
        userRef,
        {
          venueRanker: {
            status: "complete",
            completedAt: new Date().toISOString(),
          },
          progress: { venueRanker: "complete" },
        },
        { merge: true }
      );
      localStorage.setItem("venueRankerCompleted", "true");
      localStorage.removeItem("venueRankerCheckpoint");

      const fileName = `VenueAgreement_${Date.now()}.pdf`;
      const filePath = `public_docs/${uid}/${fileName}`;
      const pdfUrl = await uploadPdfBlob(pdfBlob, filePath);

      const st = await getGuestState();
      const guestCount = Math.max(0, Number(st.value) || 0);
      await setAndLockGuestCount(guestCount, "venue");

      await setDoc(
        userRef,
        {
          bookings: {
            venue: true,
            venueSlug,
            venueName: venueNameFromLS,
            planner: true,
            createdAt: new Date().toISOString(),
            dayOfWeek: new Date(weddingDate + "T12:00:00").toLocaleDateString("en-US", {
              weekday: "long",
            }),
          },
          dateLocked: true,
          weddingDateLocked: true,
          guestCount,
          guestCountLocked: true,
          venueSigned: true,
          venuePdfUrl: pdfUrl,
          documents: [
            ...existingDocs,
            { title: "Venue Agreement", url: pdfUrl, uploadedAt: new Date().toISOString() },
          ],
          purchases: arrayUnion({
            label: "venue",
            amount: Number((Number(amountDueToday) || 0).toFixed(2)),
            date: new Date().toISOString(),
          }),
          venueRankerData: {
            booking: {
              status: isPayingFull ? "paid_in_full" : "deposit_paid",
              weddingDateISO: weddingDate,
              venueSlug,
              venueName: venueNameFromLS,
              cateringType,
              setMenuId,
              hasSetMenu: !!setMenuId || cateringType === "set",
              paymentPlan: {
                total: Number(total || 0),
                deposit: isPayingFull ? 0 : Number(amountDueToday || 0),
                months: Number(numMonthlyPayments || 0),
                monthly: Number(monthlyPayment || 0),
                finalDueDate: finalDueDateStr,
                payFull: isPayingFull,
              },
            },
          },
          progress: {
            yumYum: { source: "venue", step: "contract" },
          },
        },
        { merge: true }
      );

      window.dispatchEvent(new Event("guestCountUpdated"));
      window.dispatchEvent(new Event("guestCountLocked"));

      localStorage.setItem("yumSource", "venue");
      localStorage.setItem("yumVenueSlug", venueSlug);
      if (setMenuId) localStorage.setItem("yumSetMenuId", setMenuId);
      localStorage.setItem("yumStep", "contract");

      try {
        const SERVICE_ID = import.meta.env.VITE_EMAILJS_SERVICE_ID;
        const TEMPLATE_ID = import.meta.env.VITE_EMAILJS_VENUE_TEMPLATE_ID;
        if (SERVICE_ID && TEMPLATE_ID) {
          await emailjs.send(SERVICE_ID, TEMPLATE_ID, {
            user_email: userData.email,
            user_name: `${firstName} ${lastName}`,
            pdf_url: pdfUrl,
          });
        }
      } catch (mailErr) {
        console.warn("EmailJS failed:", mailErr);
      }

      try {
        await sendAdminNotification(
          `🏰 Booking Alert: ${venueName}`,
          `${firstName} ${lastName} just booked ${venueName} on ${weddingDate}.`
        );
      } catch (adminErr) {
        console.warn("Admin notify failed:", adminErr);
      }

      setIsGenerating(false);
      setCurrentScreen("thankyou");
    } catch (err) {
      console.error("💥 [VenueCheckout] Fatal error:", err);
      setIsGenerating(false);
      setCurrentScreen("thankyou");
    }
  };

  return (
    <>
      {isGenerating ? (
        <div
          className="pixie-overlay"
          style={{
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
        >
          <div className="pixie-card pixie-card--modal" style={{ maxWidth: 520 }}>
            <div className="pixie-card__body" style={{ textAlign: "center" }}>
              <video
                src="/assets/videos/magic_clock.mp4"
                autoPlay
                loop
                muted
                playsInline
                style={{
                  width: "100%",
                  maxWidth: 340,
                  borderRadius: 12,
                  margin: "0 auto 14px",
                  display: "block",
                }}
              />
              <h3 className="px-title" style={{ margin: 0, color: "#2c62ba", fontFamily: "'Jenna Sue', cursive" }}>
                Madge is working her magic… hold tight!
              </h3>
            </div>
          </div>
        </div>
      ) : (
        <div
          ref={scrollRef}
          className="pixie-card"
          style={{
            marginTop: "2.5rem",
            padding: "1.5rem",
            borderRadius: 20,
            background: "#fff",
            width: "100%",
            maxWidth: 700,
            marginInline: "auto",
            boxSizing: "border-box",
            textAlign: "center",
          }}
        >
          <video
            src="/assets/videos/lock.mp4"
            autoPlay
            muted
            playsInline
            loop
            style={{
              width: "100%",
              maxWidth: 150,
              margin: "0 auto 1rem",
              display: "block",
              borderRadius: 12,
            }}
          />
          <h2
            style={{
              marginBottom: "0.5rem",
              color: "#2c62ba",
              fontFamily: "'Jenna Sue', cursive",
              fontSize: "1.8rem",
            }}
          >
            Checkout
          </h2>

          <p style={{ marginBottom: "1.5rem", fontSize: "1rem", textAlign: "center" }}>
            {isPayingFull ? (
              <>
                Today, you’re paying the full venue cost of <strong>${fmtMoney(total)}</strong>.
              </>
            ) : (
              <>
                Today, you’re paying a deposit of <strong>${fmtMoney(amountDueToday)}</strong>
                <br />
                followed by <strong>{numMonthlyPayments}</strong> monthly payments of{" "}
                <strong>${fmtMoney(monthlyPayment)}</strong>. The final payment is due by{" "}
                <strong>{finalDueDateStr}</strong>.
              </>
            )}
          </p>

          <Elements stripe={stripePromise}>
            <CheckoutForm total={amountDueToday} onSuccess={handleSuccess} isAddon={false} receiptLabel="Venue Booking" />
          </Elements>

          <div style={{ textAlign: "center", marginTop: "1rem" }}>
            <button
              className="boutique-back-btn"
              onClick={() => setCurrentScreen("venuecontract")}
              style={{ minWidth: 160 }}
            >
              ← Back
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default VenueCheckOut;