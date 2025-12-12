// src/components/NewYumBuild/CustomVenues/ValleyHo/ValleyHoCheckOutCatering.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import CheckoutForm from "../../../../CheckoutForm";

import { getAuth } from "firebase/auth";
import {
  doc,
  updateDoc,
  arrayUnion,
  getDoc,
  increment,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { db, app } from "../../../../firebase/firebaseConfig";
import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL,
} from "firebase/storage";
import generateYumAgreementPDF from "../../../../utils/generateYumAgreementPDF";
import { notifyBooking } from "../../../../utils/email/email";

// helpers
const round2 = (n: number) =>
  Math.round((n + Number.EPSILON) * 100) / 100;

const pretty = (d: Date) =>
  d.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

// Minimal Valley Ho types (keep in sync with your builder)
type ValleyHoService = "plated" | "stations";

interface ValleyHoSelections {
  // shared
  hors?: string[]; // 2 picks

  // plated
  platedEntrees?: string[]; // up to 3, price picked elsewhere

  // stations
  stationA?: "rice" | "pasta";
  stationB?: "sliders" | "tacos";
  pastaPicks?: string[];
  riceBases?: string[];
  riceProteins?: string[];
  sliderPicks?: string[];
  tacoPicks?: string[];
}

interface ValleyHoCheckOutProps {
  total: number; // grand total from cart (for snapshots/PDF)
  guestCount: number;
  lineItems: string[]; // from cart summary
  serviceOption: ValleyHoService;
  selectedTier?: string; // not used here, kept for API parity
  menuSelections: ValleyHoSelections;
  onBack: () => void;
  onComplete: () => void; // overlay advances to TY
  onClose: () => void;
  isGenerating?: boolean;
}

const ValleyHoCheckOutCatering: React.FC<ValleyHoCheckOutProps> = ({
  total,
  guestCount,
  lineItems,
  serviceOption,
  selectedTier,
  menuSelections,
  onBack,
  onComplete,
  onClose,
  isGenerating: isGeneratingFromOverlay = false,
}) => {
  const [localGenerating, setLocalGenerating] = useState(false);
  const isGenerating = localGenerating || isGeneratingFromOverlay;
  const didRunRef = useRef(false);

  // === 1) Read handoff keys saved by the Contract screen ===
  const payFull = useMemo(() => {
    try {
      return JSON.parse(
        localStorage.getItem("yumCateringPayFull") ?? "true"
      );
    } catch {
      return true;
    }
  }, []);

  const totalCents =
    Number(localStorage.getItem("yumCateringTotalCents")) ||
    Math.round(total * 100);

  const depositCents = Number(
    localStorage.getItem("yumCateringDepositAmount") || 0
  );

  const planMonths = Number(
    localStorage.getItem("yumCateringPlanMonths") || 0
  );
  const perMonthCents = Number(
    localStorage.getItem("yumCateringPerMonthCents") || 0
  );
  const lastPaymentCents = Number(
    localStorage.getItem("yumCateringLastPaymentCents") || 0
  );
  const dueByISO =
    localStorage.getItem("yumCateringDueBy") || "";

  const amountDueTodayCents = payFull
    ? totalCents
    : depositCents;
  const amountDueToday = round2(
    amountDueTodayCents / 100
  );
  const remainingBalance = round2(
    Math.max(0, total - amountDueToday)
  );

  const finalDueDateStr = dueByISO
    ? pretty(new Date(dueByISO))
    : "35 days before your wedding";

  // The message above the card form
  const summaryText = payFull
    ? `Total due today: $${Number(
        amountDueTodayCents / 100
      ).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}.`
    : `Deposit due today: $${(amountDueTodayCents / 100).toFixed(
        2
      )} (25%). Remaining $${remainingBalance.toFixed(
        2
      )} due by ${finalDueDateStr}.`;

  const signatureImageUrl =
    localStorage.getItem("yumSignature") ||
    localStorage.getItem("encSignatureImage") || // legacy fallback
    "";

  // For admin snapshot
  const perGuestPrice =
    Number(localStorage.getItem("valleyHoPerGuest")) ||
    0;

  // Minimal user info for CheckoutForm display
  const [firstName, setFirstName] = useState("Magic");
  const [lastName, setLastName] = useState("User");

  useEffect(() => {
    (async () => {
      const user = getAuth().currentUser;
      if (!user) return;
      try {
        const snap = await getDoc(
          doc(db, "users", user.uid)
        );
        const data = snap.data() || {};
        setFirstName(data.firstName || "Magic");
        setLastName(data.lastName || "User");
      } catch {
        /* noop */
      }
    })();
  }, []);

  // === 2) Success path (Stripe -> PDF -> Firestore snapshots) ===
  const handleSuccess = async ({
    customerId,
  }: {
    customerId?: string;
  } = {}) => {
    if (didRunRef.current) {
      console.warn(
        "[ValleyHoCheckOutCatering] handleSuccess already ran — ignoring re-entry"
      );
      return;
    }
    didRunRef.current = true;

    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) return;

    try {
      setLocalGenerating(true);

      // Store/refresh Stripe customer id
      const userRef = doc(db, "users", user.uid);
      const snap = await getDoc(userRef);
      const userDoc = snap.data() || {};

      if (
        customerId &&
        customerId !== userDoc?.stripeCustomerId
      ) {
        await updateDoc(userRef, {
          stripeCustomerId: customerId,
          "stripe.updatedAt": serverTimestamp(),
        });
        try {
          localStorage.setItem(
            "stripeCustomerId",
            customerId
          );
        } catch {
          /* ignore */
        }
      }

      const safeFirst = userDoc?.firstName || firstName || "Magic";
      const safeLast = userDoc?.lastName || lastName || "User";
      const fullName = `${safeFirst} ${safeLast}`;

      // Build appetizers list (hors)
      const appetizers = menuSelections.hors || [];

      // Build mains summary for the PDF (match Contract mapping)
      const mains =
        serviceOption === "plated"
          ? menuSelections.platedEntrees || []
          : [
              "Antipasti Station (included)",
              menuSelections.stationA === "pasta"
                ? `Pasta Station: ${
                    menuSelections.pastaPicks?.join(
                      ", "
                    ) || "—"
                  }`
                : menuSelections.stationA === "rice"
                ? `Rice Bowl Station — Bases: ${
                    menuSelections.riceBases?.join(
                      ", "
                    ) || "—"
                  }; Proteins: ${
                    menuSelections.riceProteins?.join(
                      ", "
                    ) || "—"
                  }`
                : "—",
              menuSelections.stationB === "sliders"
                ? `Slider Station: ${
                    menuSelections.sliderPicks?.join(
                      ", "
                    ) || "—"
                  }`
                : menuSelections.stationB === "tacos"
                ? `Street Taco Station: ${
                    menuSelections.tacoPicks?.join(
                      ", "
                    ) || "—"
                  }`
                : "—",
            ];

      const cuisineLabel = `Hotel Valley Ho — ${
        serviceOption === "plated"
          ? "Plated Dinner"
          : "Reception Stations"
      }`;

      const amountNow = Number(amountDueToday.toFixed(2));
      const totalCentsSafe = totalCents;
      const depositCentsSafe = payFull
        ? totalCentsSafe
        : amountDueTodayCents;
      const remainingCentsSafe = Math.max(
        0,
        totalCentsSafe - depositCentsSafe
      );
      const depositPercent =
        totalCentsSafe > 0
          ? depositCentsSafe / totalCentsSafe
          : payFull
          ? 1
          : 0.25;

      // Generate Valley Ho agreement PDF
      const pdfBlob =
        await generateYumAgreementPDF({
          fullName,
          total,
          // Reflect actual amount charged today as "deposit" for payment logic
          deposit: payFull ? 0 : amountNow,
          guestCount,
          charcuterieCount: 0,
          weddingDate:
            userDoc?.weddingDate ||
            "Your wedding date",
          signatureImageUrl:
            signatureImageUrl || "",
          paymentSummary: payFull
            ? `Paid in full today: $${amountNow.toLocaleString(
                undefined,
                {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                }
              )}.`
            : `Deposit today: $${amountNow.toFixed(
                2
              )}. Remaining $${remainingBalance.toFixed(
                2
              )} due by ${finalDueDateStr}.`,
          lineItems: lineItems || [],
          cuisineType: cuisineLabel,
          menuSelections: {
            appetizers,
            mains,
            sides: [], // Valley Ho doesn't break out sides separately
          },
        });

      // Upload PDF
      const storage = getStorage(
        app,
        "gs://wedndonev2.firebasestorage.app"
      );
      const filename = `ValleyHoCateringAgreement_${Date.now()}.pdf`;
      const fileRef = ref(
        storage,
        `public_docs/${user.uid}/${filename}`
      );
      await uploadBytes(fileRef, pdfBlob);
      const publicUrl = await getDownloadURL(
        fileRef
      );

      // Pricing snapshot (for admin/robot sanity)
      await setDoc(
        doc(
          userRef,
          "pricingSnapshots",
          "catering"
        ),
        {
          booked: true,
          guestCountAtBooking: guestCount,
          perGuest: perGuestPrice,
          venueCaterer: "valleyho",
          service: serviceOption,
          tier: selectedTier || null,
          lineItems,
          totalBooked: total,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );

      const purchaseDate =
        new Date().toISOString();

      const purchaseEntry = {
        label: "Valley Ho Catering",
        category: "catering",
        boutique: "catering",
        source: "W&D",
        amount: amountNow,
        amountChargedToday: amountNow,
        contractTotal: Number(total.toFixed(2)),
        payFull,
        deposit: payFull ? amountNow : amountNow,
        method: payFull ? "full" : "deposit",
        items: lineItems,
        date: purchaseDate,
      };

      // Robot payment plan snapshot + user doc updates
      await updateDoc(userRef, {
        documents: arrayUnion({
          title:
            "Hotel Valley Ho Catering Agreement",
          url: publicUrl,
          uploadedAt:
            new Date().toISOString(),
        }),

        "bookings.catering": true,
        dateLocked: true,

        purchases: arrayUnion(purchaseEntry),

        spendTotal: increment(amountNow),

        paymentPlan: payFull
          ? {
              product: "yum",
              type: "full",
              total,
              paidNow: amountNow,
              remainingBalance: 0,
              finalDueDate: null,
              finalDueAt: null,
              depositPercent: 1,
              createdAt: purchaseDate,
            }
          : {
              product: "yum",
              type: "deposit",
              total,
              depositPercent,
              paidNow: amountNow,
              remainingBalance,
              finalDueDate:
                finalDueDateStr,
              finalDueAt:
                dueByISO || null,
              createdAt: purchaseDate,
            },

        paymentPlanAuto: payFull
          ? {
              version: 1,
              product: "yum",
              status: "complete",
              strategy:
                "paid_in_full",
              currency: "usd",
              totalCents: totalCentsSafe,
              depositCents: totalCentsSafe,
              remainingCents: 0,
              planMonths: 0,
              perMonthCents: 0,
              lastPaymentCents: 0,
              nextChargeAt: null,
              finalDueAt: null,
              stripeCustomerId:
                customerId ||
                localStorage.getItem(
                  "stripeCustomerId"
                ) ||
                null,
              venueCaterer:
                "valleyho",
              service:
                serviceOption,
              tier:
                selectedTier ||
                null,
              createdAt: purchaseDate,
              updatedAt: purchaseDate,
            }
          : {
              version: 1,
              product: "yum",
              status: "active",
              strategy:
                "monthly_until_final",
              currency: "usd",
              totalCents: totalCentsSafe,
              depositCents: depositCentsSafe,
              remainingCents: remainingCentsSafe,
              planMonths,
              perMonthCents,
              lastPaymentCents,
              nextChargeAt: new Date(
                Date.now() +
                  60 * 1000
              ).toISOString(),
              finalDueAt:
                dueByISO || null,
              stripeCustomerId:
                customerId ||
                localStorage.getItem(
                  "stripeCustomerId"
                ) ||
                null,
              venueCaterer:
                "valleyho",
              service:
                serviceOption,
              tier:
                selectedTier ||
                null,
              createdAt: purchaseDate,
              updatedAt: purchaseDate,
            },

        "progress.yumYum.step":
          "valleyHoCateringThankYou",
      });

      // 📧 Centralized booking email — Yum Catering @ Valley Ho
      try {
        await notifyBooking("yum_catering", {
          // who
          user_email: user.email || "unknown@wedndone.com",
          user_full_name: fullName,

          // money
          total: total.toFixed(2),
          payment_now: amountNow.toFixed(2),
          remaining_balance: remainingBalance.toFixed(2),
          final_due: finalDueDateStr,

          // agreement
          pdf_url: publicUrl || "",
          pdf_title: "Hotel Valley Ho Catering Agreement",

          // cart details
          line_items: (lineItems || []).join(", "),

          // UX
          dashboardUrl: `${window.location.origin}${import.meta.env.BASE_URL}dashboard`,
          product_name: "Yum Catering — Hotel Valley Ho",
        });
      } catch (mailErr) {
        console.error("❌ notifyBooking(yum_catering) failed:", mailErr);
      }

      try {
        localStorage.setItem(
          "yumStep",
          "valleyHoCateringThankYou"
        );
      } catch {
        /* ignore */
      }

      window.dispatchEvent(new Event("purchaseMade"));
      window.dispatchEvent(
        new Event("documentsUpdated")
      );

      onComplete();
    } catch (err) {
      console.error(
        "❌ Error in Valley Ho Catering checkout:",
        err
      );
      alert(
        "Something went wrong saving your receipt. Please contact support."
      );
    } finally {
      setLocalGenerating(false);
    }
  };

  if (isGenerating) {
    return (
      <div
        className="pixie-card pixie-card--modal"
        style={{ maxWidth: 720 }}
      >
        <button
          className="pixie-card__close"
          onClick={onClose}
          aria-label="Close"
        >
          <img
            src={`${import.meta.env.BASE_URL}assets/icons/pink_ex.png`}
            alt="Close"
          />
        </button>
        <div
          className="pixie-card__body"
          style={{ textAlign: "center" }}
        >
          <video
            src={`${import.meta.env.BASE_URL}assets/videos/magic_clock.mp4`}
            autoPlay
            loop
            muted
            playsInline
            style={{
              width: 280,
              margin: "0 auto 12px",
              borderRadius: 12,
            }}
          />
          <p
            className="px-prose-narrow"
            style={{
              color: "#2c62ba",
              fontStyle: "italic",
            }}
          >
            Madge is working her magic…
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="pixie-card pixie-card--modal">
      {/* 🩷 Pink X */}
      <button
        className="pixie-card__close"
        onClick={onClose}
        aria-label="Close"
      >
        <img
          src={`${import.meta.env.BASE_URL}assets/icons/pink_ex.png`}
          alt="Close"
        />
      </button>

      <div className="pixie-card__body">
        <video
          src={`${import.meta.env.BASE_URL}assets/videos/lock.mp4`}
          autoPlay
          loop
          muted
          playsInline
          style={{
            width: 160,
            maxWidth: "90%",
            borderRadius: 12,
            margin: "0 auto 16px",
            display: "block",
          }}
        />

        <h2
          className="px-title"
          style={{
            fontFamily: "'Jenna Sue', cursive",
            fontSize: "1.9rem",
            marginBottom: 8,
          }}
        >
          Checkout
        </h2>

        <p
          className="px-prose-narrow"
          style={{
            marginBottom: 16,
            textAlign: "center",
          }}
        >
          {summaryText}
        </p>

        {/* Stripe Card Entry (global StripeProvider wraps App, so no <Elements>) */}
        <div className="px-elements" aria-busy={isGenerating}>
          <CheckoutForm
            total={amountDueToday}
            onSuccess={handleSuccess}
            setStepSuccess={onComplete}
            isAddon={false}
            customerEmail={
              getAuth().currentUser?.email || undefined
            }
            customerName={`${firstName || "Magic"} ${
              lastName || "User"
            }`}
            customerId={(() => {
              try {
                return (
                  localStorage.getItem("stripeCustomerId") ||
                  undefined
                );
              } catch {
                return undefined;
              }
            })()}
          />
        </div>

        {/* Back button */}
        <div
          style={{
            marginTop: "1rem",
            textAlign: "center",
          }}
        >
          <button
            className="boutique-back-btn"
            style={{ width: 250 }}
            onClick={onBack}
          >
            ← Back
          </button>
        </div>
      </div>
    </div>
  );
};

export default ValleyHoCheckOutCatering;