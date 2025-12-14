// src/components/VenueRanker/VenueCheckOut.tsx
import React, { useState, useEffect, useRef } from "react";

import { getAuth } from "firebase/auth";
import {
  doc,
  getDoc,
  setDoc,
  arrayUnion,
  updateDoc,
  serverTimestamp,
  increment,
} from "firebase/firestore";
import { db } from "../../firebase/firebaseConfig";
import { useUser } from "../../contexts/UserContext";
import CheckoutForm from "../../CheckoutForm";
import { generateVenueAgreementPDF } from "../../utils/generateVenueAgreementPDF";
import { uploadPdfBlob } from "../../helpers/firebaseUtils";
import emailjs from "@emailjs/browser";
import { VENUE_MENU_MAP } from "../../utils/venueMenuMap";
import {
  getGuestState,
  setAndLockGuestCount,
} from "../../utils/guestCountStore";
import { format, parseISO, isValid as isValidDate } from "date-fns";

import { markVenueDateUnavailable } from "../../utils/venueAvailability";

const API_BASE =
  "https://us-central1-wedndonev2.cloudfunctions.net/stripeapiV2";

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

interface VenueCheckOutProps {
  onClose?: () => void;
  setStepSuccess?: () => void;
  setCurrentScreen: (screen: string) => void;
}

// ✅ Final venue balance must be paid 35 days before the wedding
const FINAL_DUE_DAYS = 35;

const fmtMoney = (n: number) =>
  Number.isFinite(n)
    ? n.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    : "0.00";

const sanitizeForPdf = (s: string) =>
  String(s || "")
    .replace(/<\/?[^>]+>/g, "")
    .replace(/[•◦▪∙·]/g, "-")
    .replace(/[-–—]\s*/g, "- ")
    .replace(/\s+/g, " ")
    .trim();

const VenueCheckOut: React.FC<VenueCheckOutProps> = ({
  setCurrentScreen,
  setStepSuccess,
}) => {
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
  const didRunRef = useRef(false);

  const [firstNameLocal, setFirstNameLocal] = useState<string>("Magic");
  const [lastNameLocal, setLastNameLocal] = useState<string>("User");

  // 🔐 Payment mode + saved card summary (mirror Floral)
  const [mode, setMode] = useState<"saved" | "new">("new");
  const [savedCardSummary, setSavedCardSummary] = useState<{
    brand: string;
    last4: string;
    exp_month: number;
    exp_year: number;
  } | null>(null);
  const hasSavedCard = !!savedCardSummary;

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
      const venueSpecificDetails = arr(
        parsed.venueSpecificDetails || parsed.venueTerms
      ).map(sanitizeForPdf);
      const bookingTerms = arr(parsed.bookingTerms).map(sanitizeForPdf);

      setContractData({
        ...parsed,
        venueName: venueNameSafe,
        venueSpecificDetails,
        bookingTerms,
      });

      if (parsed.firstName) setFirstNameLocal(parsed.firstName);
      if (parsed.lastName) setLastNameLocal(parsed.lastName);
    } catch (e) {
      console.error("❌ Failed to parse venueContractData:", e);
    }
  }, []);

  // 🔍 Load saved card summary (Stripe v2 API, same as Floral)
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        if (!uid) return;

        const res = await fetch(`${API_BASE}/payments/get-default`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ uid }),
        });

        if (!res.ok) {
          const body = await res.text().catch(() => "");
          console.warn(
            "No saved card for venue checkout:",
            res.status,
            body || "<empty>"
          );
          return;
        }

        const data = await res.json();
        if (!cancelled && data?.card) {
          setSavedCardSummary(data.card);
          setMode("saved");
        }
      } catch (err) {
        if (!cancelled) {
          console.warn("No saved card found for venue checkout:", err);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [uid]);

  // ---------- derive values from contractData (safe even when null) ----------
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
  } = contractData || {};

  const total = Number(venuePrice) || 0;

  const isPayingFull = (() => {
    const v = payFull;
    if (typeof v === "boolean") return v;
    if (typeof v === "string") {
      const s = v.toLowerCase();
      if (s === "full" || s === "true" || s === "payfull") return true;
      if (s === "monthly" || s === "deposit" || s === "false") return false;
    }
    return true;
  })();

  const isMonthlyPlan = !isPayingFull;

  // 🔁 Keep payment mode consistent with plan rules
  useEffect(() => {
    if (isMonthlyPlan && hasSavedCard) {
      // Monthly plan + card on file → force saved card
      setMode("saved");
    } else if (!hasSavedCard) {
      // No saved card → must enter card
      setMode("new");
    }
  }, [isMonthlyPlan, hasSavedCard]);

  // 🔒 Only NOW do the loading guard
  if (!userData || !contractData) {
    return <p style={{ textAlign: "center" }}>Loading your info...</p>;
  }

  const DEPOSIT_PCT = 0.25;
  const fallbackDeposit = Math.round(total * DEPOSIT_PCT * 100) / 100;

  const amountDueToday = isPayingFull
    ? total
    : Math.max(
        0.01,
        Math.round(
          ((Number(depositAmount) || fallbackDeposit) + Number.EPSILON) * 100
        ) / 100
      );

  const weddingDateCandidate =
    weddingDate ||
    userData?.weddingDate ||
    localStorage.getItem("venueWeddingDate") ||
    "";

  const weddingDateObj =
    safeParseDate(weddingDateCandidate) ||
    safeParseDate(`${weddingDateCandidate}T12:00:00`);

  const finalDueDate = weddingDateObj
    ? new Date(
        weddingDateObj.getTime() - FINAL_DUE_DAYS * 24 * 60 * 60 * 1000
      )
    : null;

  const finalDueDateStr = finalDueDate
    ? fmtPretty(finalDueDate)
    : `${FINAL_DUE_DAYS} days before your wedding date`;

  const prettyContractDate = weddingDateObj
    ? fmtPretty(weddingDateObj)
    : "your reserved wedding date";

  // For venues, monthly plan => card on file required
  const requiresCardOnFile = !isPayingFull;

  const handleSuccess = async ({
    customerId,
    paymentMethodId,
  }: {
    customerId?: string;
    paymentMethodId?: string;
  } = {}) => {
    if (didRunRef.current) {
      console.warn("[VenueCheckout] handleSuccess already ran — ignoring re-entry");
      return;
    }
    didRunRef.current = true;

    setIsGenerating(true);

    try {
      console.log("🧭 [VenueCheckout] Start finalize flow");

      const userSnap = await getDoc(userRef);
      const userDoc = userSnap.data() || {};
      const existingDocs: any[] = Array.isArray(userDoc.documents)
        ? userDoc.documents
        : [];

      // 1️⃣ Save / refresh Stripe customer id for this user
      try {
        const existingCustomerId = (userDoc as any)?.stripeCustomerId as
          | string
          | undefined;

        if (customerId && customerId !== existingCustomerId) {
          await updateDoc(userRef, {
            stripeCustomerId: customerId,
            "stripe.updatedAt": serverTimestamp(),
          });
          try {
            localStorage.setItem("stripeCustomerId", customerId);
          } catch {
            /* ignore LS errors */
          }
          console.log("✅ Saved stripeCustomerId for venue checkout");
        }
      } catch (stripeSaveErr) {
        console.warn(
          "⚠️ Could not save stripeCustomerId in VenueCheckOut:",
          stripeSaveErr
        );
      }

      // 2️⃣ Store the specific card used for the venue payment plan (if monthly)
      if (!isPayingFull && paymentMethodId) {
        try {
          await updateDoc(userRef, {
            "venueRankerData.booking.paymentMethodId": paymentMethodId,
          });
          console.log("✅ Stored venue paymentMethodId:", paymentMethodId);
        } catch (err) {
          console.error("❌ Failed to store venue paymentMethodId:", err);
        }
      }

      // 3️⃣ Ask backend v2 to ensure a default payment method for this customer
      const shouldStoreCard = requiresCardOnFile; // venues always keep card for monthly
      if (shouldStoreCard) {
        try {
          const cid =
            customerId ||
            (userDoc as any)?.stripeCustomerId ||
            localStorage.getItem("stripeCustomerId");

          if (cid) {
            await fetch(`${API_BASE}/ensure-default-payment-method`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                customerId: cid,
                firebaseUid: uid,
              }),
            });
            console.log("✅ Ensured default payment method for venue customer");
          }
        } catch (ensureErr) {
          console.warn(
            "⚠️ ensure-default-payment-method failed in VenueCheckOut:",
            ensureErr
          );
        }
      } else {
        console.log(
          "ℹ️ Skipping card-on-file setup for venue (pay-in-full with no plan)."
        );
      }

      const paymentSummary = isPayingFull
        ? `Paid in Full: $${fmtMoney(total)}`
        : `Deposit: $${fmtMoney(
            amountDueToday
          )} + ${numMonthlyPayments} monthly payments of $${fmtMoney(
            monthlyPayment
          )} (final due ${finalDueDateStr}).`;

      const venueSlug = (localStorage.getItem("venueSlug") || "").trim();
      const venueNameFromLS =
        localStorage.getItem("venueName") || venueName;

      const metaFromMap =
        VENUE_MENU_MAP[venueSlug] || VENUE_MENU_MAP.santi_default;

      const cateringType =
        localStorage.getItem("cateringType") ||
        metaFromMap?.cateringType ||
        "custom";

      const setMenuId =
        localStorage.getItem("setMenuId") ||
        metaFromMap?.setMenuId ||
        null;

      localStorage.setItem("cateringType", cateringType);
      if (setMenuId) localStorage.setItem("setMenuId", setMenuId);

      const safeVenueSpecificDetails: string[] = Array.isArray(
        contractData?.venueSpecificDetails
      )
        ? contractData.venueSpecificDetails
        : Array.isArray(contractData?.venueTerms)
        ? contractData.venueTerms
        : [];

      // 🧾 Fallback booking terms if nothing came from the contract payload.
      const defaultBookingTerms: string[] = [
        `Date & availability. Booking is for ${prettyContractDate} at ${
          venueName || venueNameFromLS || "your venue"
        }. If the venue is unable to host due to force majeure or venue closure, we’ll work in good faith to reschedule or refund venue fees paid to Wed&Done.`,
        `Guest count lock. Your guest count for this booking is ${
          userData.guestCount ?? "the number on file"
        }. The venue’s capacity and pricing are based on that number. Guest count may be increased (subject to capacity and pricing changes) but cannot be decreased after booking.`,
        "Planner fee reconciliation. If you already purchased planning via Pixie Planner, any amount paid there will be credited against the planning tier that corresponds to the guest count set on this contract. If your Pixie Planner amount exceeds the applicable tier, the difference will be credited on this venue booking; if it’s less, the remaining planning fee will be included in your venue total.",
        "Rescheduling. Reschedules are subject to venue availability and may incur additional fees or price adjustments. Seasonal/weekday pricing and service charges may change for new dates.",
        "Cancellations. Venue deposits are non-refundable. If you cancel, non-recoverable costs and fees already incurred may be retained. Any remaining refundable portion will follow the venue’s policy.",
        "Vendor rules. You agree to comply with venue rules (noise, decor, load-in/out, insurance, alcohol, security, etc.). Venue-specific policies are incorporated into this agreement.",
        "Liability. Wed&Done is not liable for venue restrictions or consequential damages. Our liability is limited to amounts paid to Wed&Done for this venue booking.",
        "Payment options. You may pay in full today, or place a non-refundable deposit and pay the remaining balance in monthly installments. All installments must be completed no later than 35 days before your wedding date, and any unpaid balance will be automatically charged on that date.",
        "Card authorization. By signing this agreement, you authorize Wed&Done and our payment processor (Stripe) to securely store your card for recurring or future payments. Once a card is on file, all Deposit + Monthly plans will use that saved card for every installment and the final balance. Paid-in-full purchases may be made using your saved card or a new card, and you may update or replace your saved card at any time through your Wed&Done account.",
        "Missed payments. If a scheduled payment fails, we’ll automatically retry your card. If payment is not received within 7 days, a $25 late fee applies; after 14 days, services may be suspended and the agreement may be in default.",
        "Force majeure. Neither party is liable for delays or failures caused by events beyond reasonable control (including acts of God, government actions, labor disputes, epidemics/pandemics, or utility outages). We’ll work in good faith to reschedule; if rescheduling is not possible, we’ll refund amounts paid beyond non-recoverable costs.",
      ];

      const safeBookingTerms: string[] =
        Array.isArray(contractData?.bookingTerms) &&
        contractData.bookingTerms.length
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

      const bookingId = `venue-${uid}-${Date.now()}`;

      const blockedDateForAvailability =
        weddingDate ||
        userData?.weddingDate ||
        localStorage.getItem("venueWeddingDate") ||
        "";

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

      const safeDayOfWeek = blockedDateForAvailability
        ? new Date(
            blockedDateForAvailability + "T12:00:00"
          ).toLocaleDateString("en-US", { weekday: "long" })
        : "";

      const purchase = {
        type: "wdd",
        category: "venue",
        label: venueNameFromLS || "venue",
        date: new Date().toISOString(),
        amountChargedToday: isPayingFull
          ? Number(total || 0)
          : Number(amountDueToday || 0),
        payFull: !!isPayingFull,
        deposit: isPayingFull ? 0 : Number(amountDueToday || 0),
        monthlyAmount: isPayingFull ? 0 : Number(monthlyPayment || 0),
        months: isPayingFull ? 0 : Number(numMonthlyPayments || 0),
        installments: isPayingFull ? 0 : Number(numMonthlyPayments || 0),
        numMonths: isPayingFull ? 0 : Number(numMonthlyPayments || 0),
        fullContractAmount: Number(total || 0),
        contractTotal: Number(total || 0),
        total: Number(total || 0),
        items: ["venue"],
      };

      await updateDoc(userRef, {
        documents: arrayUnion({
          title: "Venue Agreement",
          url: pdfUrl,
          uploadedAt: new Date().toISOString(),
        }),
        purchases: arrayUnion(purchase),

        // 🔢 Budget Wand: record what actually hit the card today
        spendTotal: increment(
          Number(
            isPayingFull ? total || 0 : amountDueToday || 0
          )
        ),

        "bookings.venue": true,
        "bookings.venueSlug": venueSlug,
        "bookings.venueName": venueNameFromLS,
        "bookings.planner": true,
        "bookings.dayOfWeek": safeDayOfWeek,
        "bookings.bookingId": bookingId,
        "bookings.createdAt": new Date().toISOString(),

        dateLocked: true,
        weddingDateLocked: true,
        guestCount,
        guestCountLocked: true,
        venueSigned: true,
        venuePdfUrl: pdfUrl,

        "progress.yumYum": { source: "venue", step: "contract" },

        venueRankerData: {
          booking: {
            status: isPayingFull ? "paid_in_full" : "deposit_paid",
            weddingDateISO: blockedDateForAvailability,
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
      });

      window.dispatchEvent(new Event("documentsUpdated"));
      window.dispatchEvent(new Event("purchaseMade"));
      window.dispatchEvent(new Event("venueCompletedNow"));

      try {
        if (venueSlug && blockedDateForAvailability) {
          await markVenueDateUnavailable({
            venueSlug,
            weddingDate: blockedDateForAvailability,
            bookingId,
          });
          console.log(
            `[VenueCheckout] ✅ Marked ${blockedDateForAvailability} unavailable for ${venueSlug}`
          );
        } else {
          console.warn(
            "[VenueCheckout] ⚠️ Missing venueSlug or blockedDateForAvailability, skipping bookedDates write."
          );
        }
      } catch (blockErr) {
        console.warn(
          "[VenueCheckout] ❌ Could not block date (maybe already blocked):",
          blockErr
        );
      }

      window.dispatchEvent(new Event("guestCountUpdated"));
      window.dispatchEvent(new Event("guestCountLocked"));

      localStorage.setItem("yumSource", "venue");
      localStorage.setItem("yumVenueSlug", venueSlug);
      if (setMenuId) localStorage.setItem("yumSetMenuId", setMenuId);
      localStorage.setItem("yumStep", "contract");

      // Buyer email
      try {
        const SERVICE_ID = import.meta.env.VITE_EMAILJS_SERVICE_ID;
        const TEMPLATE_ID = import.meta.env.VITE_EMAILJS_VENUE_TEMPLATE_ID;
        const PUBLIC_KEY = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;

        if (SERVICE_ID && TEMPLATE_ID && PUBLIC_KEY) {
          await emailjs.send(
            SERVICE_ID,
            TEMPLATE_ID,
            {
              user_email: userData.email,
              user_name: `${firstName} ${lastName}`,
              pdf_url: pdfUrl,
            },
            PUBLIC_KEY
          );
          console.log("📨 Venue buyer email sent");
        } else {
          console.warn(
            "⚠️ Venue EmailJS not configured (service/template/public key missing); skipping buyer email."
          );
        }
      } catch (mailErr) {
        console.warn("EmailJS buyer failed:", mailErr);
      }

      // Admin email
      try {
        const SERVICE_ID = import.meta.env.VITE_EMAILJS_SERVICE_ID;
        const TEMPLATE_ID =
          import.meta.env.VITE_EMAILJS_VENUE_ADMIN_TEMPLATE_ID;
        const PUBLIC_KEY = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;
        const ADMIN_EMAIL = import.meta.env.VITE_EMAILJS_ADMIN_EMAIL;

        if (SERVICE_ID && TEMPLATE_ID && PUBLIC_KEY && ADMIN_EMAIL) {
          await emailjs.send(
            SERVICE_ID,
            TEMPLATE_ID,
            {
              admin_email: ADMIN_EMAIL,
              user_email: userData.email,
              user_name: `${firstName} ${lastName}`,
              venue_name: venueNameFromLS,
              wedding_date: blockedDateForAvailability || "(not set)",
              amount_today: fmtMoney(amountDueToday),
              total_contract: fmtMoney(total),
              pay_full: isPayingFull ? "Yes" : "No",
              payment_summary: paymentSummary,
              pdf_url: pdfUrl,
            },
            PUBLIC_KEY
          );
          console.log("📨 Venue admin email sent");
        } else {
          console.warn(
            "⚠️ Venue admin EmailJS not configured; skipping admin email."
          );
        }
      } catch (adminErr) {
        console.warn("Admin EmailJS failed:", adminErr);
      }

      setIsGenerating(false);
      setStepSuccess?.();
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
          <div
            className="pixie-card pixie-card--modal"
            style={{ maxWidth: 520 }}
          >
            <div className="pixie-card__body" style={{ textAlign: "center" }}>
              <video
                src={`${import.meta.env.BASE_URL}assets/videos/magic_clock.mp4`}
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
              <h3
                className="px-title"
                style={{
                  margin: 0,
                  color: "#2c62ba",
                  fontFamily: "'Jenna Sue', cursive",
                }}
              >
                Madge is working her magic… hold tight!
              </h3>
            </div>
          </div>
        </div>
      ) : (
        <div
          ref={scrollRef}
          className="pixie-card wd-page-turn"
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
            src={`${import.meta.env.BASE_URL}assets/videos/lock.mp4`}
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

          <p
            style={{
              marginBottom: "1.5rem",
              fontSize: "1rem",
              textAlign: "center",
            }}
          >
            {isPayingFull ? (
              <>
                Today, you’re paying the full venue cost of{" "}
                <strong>${fmtMoney(total)}</strong>.
              </>
            ) : (
              <>
                Today, you’re paying a deposit of{" "}
                <strong>${fmtMoney(amountDueToday)}</strong>
                <br />
                followed by{" "}
                <strong>{numMonthlyPayments}</strong> monthly payments of{" "}
                <strong>${fmtMoney(monthlyPayment)}</strong>. The final payment is
                due by <strong>{finalDueDateStr}</strong>.
              </>
            )}
          </p>

          {/* Payment Method Selection — GOLD STANDARD */}
          <div
            style={{
              marginTop: "12px",
              marginBottom: "20px",
              padding: "14px 16px",
              borderRadius: 12,
              background: "#f7f8ff",
              border: "1px solid #d9ddff",
              maxWidth: 520,
              marginInline: "auto",
            }}
          >
            {isMonthlyPlan ? (
              // 🔹 Deposit + Monthly
              hasSavedCard ? (
                // Monthly + card on file → MUST use saved card (no toggle)
                <div style={{ fontSize: ".95rem", textAlign: "left" }}>
                  <p style={{ margin: 0, marginBottom: 4 }}>
                    Your venue payment plan will use this saved card:
                  </p>
                  <p style={{ margin: 0, fontWeight: 600 }}>
                    {savedCardSummary!.brand.toUpperCase()} ••••{" "}
                    {savedCardSummary!.last4} (exp{" "}
                    {savedCardSummary!.exp_month}/
                    {savedCardSummary!.exp_year})
                  </p>
                  <p style={{ marginTop: 8, fontSize: ".85rem" }}>
                    To use a different card for your plan, first update your saved
                    card in your Wed&amp;Done account, then return to book.
                  </p>
                </div>
              ) : (
                // Monthly + NO card on file → enter details, this will become the card on file
                <div style={{ fontSize: ".95rem", textAlign: "left" }}>
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      fontSize: ".95rem",
                      cursor: "pointer",
                    }}
                  >
                    <input type="radio" checked readOnly />
                    <span>Enter your card details</span>
                  </label>
                  <p style={{ marginTop: 8, fontSize: ".85rem" }}>
                    This card will be securely saved on file and used for your
                    monthly venue payments and final balance.
                  </p>
                </div>
              )
            ) : (
              // 🔹 Pay in full
              hasSavedCard ? (
                <>
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      fontSize: ".95rem",
                      marginBottom: 10,
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="radio"
                      name="paymentMode"
                      checked={mode === "saved"}
                      onChange={() => setMode("saved")}
                    />
                    <span>
                      Saved card on file —{" "}
                      <strong>{savedCardSummary!.brand.toUpperCase()}</strong>{" "}
                      •••• {savedCardSummary!.last4} (exp{" "}
                      {savedCardSummary!.exp_month}/
                      {savedCardSummary!.exp_year})
                    </span>
                  </label>

                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      fontSize: ".95rem",
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="radio"
                      name="paymentMode"
                      checked={mode === "new"}
                      onChange={() => setMode("new")}
                    />
                    <span>Pay with a different card</span>
                  </label>
                </>
              ) : (
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    fontSize: ".95rem",
                    cursor: "pointer",
                  }}
                >
                  <input type="radio" checked readOnly />
                  <span>Enter your card details</span>
                </label>
              )
            )}
          </div>

          <div
            className="px-elements"
            aria-busy={false}
            style={{
              pointerEvents: "auto",
              position: "relative",
              zIndex: 5,
            }}
          >
            <CheckoutForm
              total={amountDueToday}
              useSavedCard={mode === "saved"}
              onSuccess={handleSuccess}
              // We advance to thank-you inside handleSuccess
              setStepSuccess={() => {
                /* no-op; wizard handled above */
              }}
              isAddon={false}
              customerEmail={userData.email || undefined}
              customerName={`${firstNameLocal || firstName || "Magic"} ${
                lastNameLocal || lastName || "User"
              }`}
              customerId={(() => {
                try {
                  return localStorage.getItem("stripeCustomerId") || undefined;
                } catch {
                  return undefined;
                }
              })()}
              receiptLabel="Venue Booking"
            />
          </div>
        </div>
      )}
    </>
  );
};

export default VenueCheckOut;