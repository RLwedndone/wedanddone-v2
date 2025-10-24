// src/components/photo/PhotoCheckOut.tsx
import React, { useRef, useState } from "react";
import { Elements } from "@stripe/react-stripe-js";
import { stripePromise } from "../../utils/stripePromise";
import CheckoutForm from "../../CheckoutForm";
import { getAuth } from "firebase/auth";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  arrayUnion,
  Timestamp,
  collection,
  addDoc,
  increment,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../../firebase/firebaseConfig";
import { generatePhotoAddOnReceiptPDF } from "../../utils/generatePhotoAddOnReceiptPDF";
import { generatePhotoAgreementPDF } from "../../utils/generatePhotoAgreementPDF";
import { uploadPdfBlob } from "../../helpers/firebaseUtils";
import emailjs from "@emailjs/browser";

// ───────── helpers (dates & math) ─────────
const MS_DAY = 24 * 60 * 60 * 1000;
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

const parseLocalYMD = (ymd?: string | null): Date | null => {
  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  return new Date(`${ymd}T12:00:00`); // noon guard
};

// first second of a local Date as UTC
const asStartOfDayUTC = (d: Date) =>
  new Date(
    Date.UTC(
      d.getUTCFullYear(),
      d.getUTCMonth(),
      d.getUTCDate(),
      0,
      0,
      1
    )
  );

// monthly count inclusive (partial months count as 1)
function monthsBetweenInclusive(from: Date, to: Date) {
  const a = new Date(from.getFullYear(), from.getMonth(), 1);
  const b = new Date(to.getFullYear(), to.getMonth(), 1);
  let months =
    (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
  if (to.getDate() >= from.getDate()) months += 1;
  return Math.max(1, months);
}

// schedule first auto-charge ~ one month after booking, start of day UTC
function firstMonthlyChargeAtUTC(from = new Date()): string {
  const y = from.getUTCFullYear();
  const m = from.getUTCMonth();
  const d = from.getUTCDate();
  const dt = new Date(Date.UTC(y, m + 1, d, 0, 0, 1));
  return dt.toISOString();
}

// ───────── deposit/amount helpers ─────────

// Read cart-saved 50% deposit, fallback to 50% of total
function getPhotoDepositAmount(total: number): number {
  const ls = Number(localStorage.getItem("photoDepositAmount") || "");
  return Number.isFinite(ls) && ls > 0 ? round2(ls) : round2(total * 0.5);
}

interface PhotoCheckOutProps {
  onClose: () => void;
  isAddon?: boolean;
  total: number;
  depositAmount: number; // not trusted, we recompute
  payFull: boolean;
  paymentSummary: string;
  signatureImage: string;
  onSuccess: () => void;
  lineItems: string[];
  uid: string;
  onBack: () => void;
}

const PhotoCheckOut: React.FC<PhotoCheckOutProps> = ({
  onClose,
  isAddon = false,
  total,
  depositAmount,
  payFull,
  paymentSummary,
  signatureImage,
  onSuccess,
  lineItems,
  uid,
  onBack,
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [completed, setCompleted] = useState(false);
  const finishedOnceRef = useRef(false);

  // ───────── amounts per policy ─────────
  // For add-ons: never use LS; full add-on amount is due now
  const totalFromLS = !isAddon
    ? Number(localStorage.getItem("photoTotal") || "")
    : NaN;

  const totalEffective =
    Number.isFinite(totalFromLS) && totalFromLS > 0
      ? round2(totalFromLS)
      : round2(total);

  const depositFromLS = !isAddon
    ? Number(localStorage.getItem("photoDepositAmount") || "")
    : NaN;

  const depositAmountEffective =
    Number.isFinite(depositFromLS) && depositFromLS > 0
      ? round2(depositFromLS)
      : getPhotoDepositAmount(totalEffective);

  // For add-ons we always charge the full amount now
  const amountDueToday = isAddon
    ? totalEffective
    : payFull
    ? totalEffective
    : Math.min(totalEffective, depositAmountEffective);

  const remainingBalance = isAddon
    ? 0
    : round2(Math.max(0, totalEffective - amountDueToday));

  // Normalize only for the contract flow (not add-ons)
  if (!isAddon) {
    try {
      localStorage.setItem("photoTotal", String(totalEffective));
      localStorage.setItem("photoDepositAmount", String(depositAmountEffective));
      localStorage.setItem("photoRemainingBalance", String(remainingBalance));
    } catch {}
  }

  // debug (kept)
  console.log(
    "[PHOTO CHECKOUT] totalEffective:",
    totalEffective,
    "depositAmount:",
    depositAmountEffective,
    "amountDueToday:",
    amountDueToday
  );

  const handleSuccess = async ({ customerId }: { customerId?: string } = {}) => {
    if (finishedOnceRef.current) return;
    finishedOnceRef.current = true;

    const auth = getAuth();
    const user = auth.currentUser;

    try {
      if (import.meta.env.VITE_EMAILJS_PUBLIC_KEY) {
        emailjs.init(import.meta.env.VITE_EMAILJS_PUBLIC_KEY);
      }
    } catch {}

    setIsGenerating(true);

    try {
      const uidToUse = user?.uid || uid;
      const userRef = doc(db, "users", uidToUse);
      const snap = await getDoc(userRef);
      const userDoc = snap.exists() ? snap.data() : {};

      if (!snap.exists()) {
        await setDoc(
          userRef,
          {
            bookings: {},
            purchases: [],
            documents: [],
            createdAt: Timestamp.now(),
          },
          { merge: true }
        );
      }

      // Save Stripe customerId (and default PM) if we got one
      try {
        const existingId = (userDoc as any)?.stripeCustomerId as
          | string
          | undefined;
        if (customerId && customerId !== existingId) {
          await updateDoc(userRef, {
            stripeCustomerId: customerId,
            "stripe.updatedAt": serverTimestamp(),
          });
          try {
            localStorage.setItem("stripeCustomerId", customerId);
          } catch {}
        }

        try {
          await fetch(
            "https://us-central1-wedndonev2.cloudfunctions.net/stripeApi/ensure-default-payment-method",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                customerId:
                  customerId || localStorage.getItem("stripeCustomerId"),
                firebaseUid: uidToUse,
              }),
            }
          );
          console.log("✅ Ensured default payment method for photo customer");
        } catch (err) {
          console.error("❌ Failed to ensure default payment method:", err);
        }
      } catch (e) {
        console.warn("⚠️ Could not save stripeCustomerId:", e);
      }

      const firstName = (userDoc as any)?.firstName || "Magic";
      const lastName = (userDoc as any)?.lastName || "User";
      const fullName = `${firstName} ${lastName}`;

      // Dates for plan math: final due = wedding - 35 days
      const weddingYMD = (userDoc as any)?.weddingDate || null;
      const wedding = parseLocalYMD(weddingYMD || "");
      const finalDueDate = wedding
        ? new Date(wedding.getTime() - 35 * MS_DAY)
        : null;
      const finalDueISO = finalDueDate
        ? asStartOfDayUTC(finalDueDate).toISOString()
        : null;

      // monthly plan math
      let planMonths = 0;
      let perMonthCents = 0;
      let lastPaymentCents = 0;
      if (!payFull && finalDueDate && remainingBalance > 0) {
        const months = monthsBetweenInclusive(new Date(), finalDueDate);
        const remainingCents = Math.round(remainingBalance * 100);
        const base = Math.floor(remainingCents / months);
        const tail = remainingCents - base * Math.max(0, months - 1);
        planMonths = months;
        perMonthCents = base;
        lastPaymentCents = tail;
      }

      const months = payFull ? 0 : planMonths;
      const monthlyAmount = payFull
        ? 0
        : +(perMonthCents / 100).toFixed(2);

      // 1) Record purchase & booking flags
      await updateDoc(userRef, {
        "bookings.photography": true,
        weddingDateLocked: true,

        purchases: arrayUnion({
          label: isAddon ? "Photo Add-On" : "Photo Styler",
          category: "photo",
          amount: Number(amountDueToday.toFixed(2)),
          contractTotal: Number(totalEffective.toFixed(2)),
          payFull: Boolean(payFull),
          deposit: payFull
            ? Number(totalEffective.toFixed(2))
            : Number(amountDueToday.toFixed(2)),
          monthlyAmount,
          months,
          method: payFull ? "full" : "deposit",
          date: new Date().toISOString(),
          source: "PhotoCheckOut",
          module: "photography",
        }),

        spendTotal: increment(Number(amountDueToday.toFixed(2))),

        paymentPlan: payFull
          ? {
              product: "photo",
              type: "full",
              total: totalEffective,
              paidNow: totalEffective,
              remainingBalance: 0,
              finalDueDate: null,
              finalDueAt: null,
              depositPercent: 1,
              createdAt: new Date().toISOString(),
            }
          : {
              product: "photo",
              type: "deposit",
              total: totalEffective,
              depositPercent: +(
                amountDueToday / totalEffective
              ).toFixed(2),
              paidNow: amountDueToday,
              remainingBalance,
              finalDueDate: finalDueDate
                ? finalDueDate.toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })
                : "35 days before your wedding date",
              finalDueAt: finalDueISO,
              createdAt: new Date().toISOString(),
            },

        paymentPlanAuto: payFull
          ? {
              version: 1,
              product: "photo",
              status: "complete",
              strategy: "paid_in_full",
              currency: "usd",
              totalCents: Math.round(totalEffective * 100),
              depositCents: Math.round(totalEffective * 100),
              remainingCents: 0,
              planMonths: 0,
              perMonthCents: 0,
              lastPaymentCents: 0,
              nextChargeAt: null,
              finalDueAt: null,
              stripeCustomerId:
                customerId ||
                localStorage.getItem("stripeCustomerId") ||
                null,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            }
          : {
              version: 1,
              product: "photo",
              status: "active",
              strategy: "monthly_until_final",
              currency: "usd",
              totalCents: Math.round(totalEffective * 100),
              depositCents: Math.round(amountDueToday * 100),
              remainingCents: Math.round(remainingBalance * 100),
              planMonths,
              perMonthCents,
              lastPaymentCents,
              nextChargeAt: firstMonthlyChargeAtUTC(new Date()),
              finalDueAt: finalDueISO,
              stripeCustomerId:
                customerId ||
                localStorage.getItem("stripeCustomerId") ||
                null,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },

        lastPurchaseAt: serverTimestamp(),
      });

      // 2) PDF + upload
      let pdfUrl = "";
      try {
        const pdfFileName = isAddon
          ? `PhotoReceipt_${Date.now()}.pdf`
          : `PhotoAgreement_${Date.now()}.pdf`;
        const pdfFilePath = `public_docs/${uidToUse}/${pdfFileName}`;

        let pdfBlob: Blob;
        if (isAddon) {
          const purchaseDate = new Date().toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
          });
          pdfBlob = await generatePhotoAddOnReceiptPDF({
            fullName,
            lineItems,
            total: amountDueToday,
            purchaseDate,
          });
        } else {
          const depositForPdf = payFull ? 0 : amountDueToday;
          pdfBlob = await generatePhotoAgreementPDF({
            firstName,
            lastName,
            total: totalEffective,
            deposit: depositForPdf,
            paymentSummary,
            weddingDate:
              (userDoc as any)?.weddingDate || "TBD",
            signatureImageUrl: signatureImage || "",
            lineItems,
          });
        }

        pdfUrl = await uploadPdfBlob(pdfBlob, pdfFilePath);

        const docItem = {
          title: isAddon
            ? "Photo Add-On Receipt"
            : "Photo Agreement",
          url: pdfUrl,
          uploadedAt: new Date().toISOString(),
          kind: isAddon ? "receipt" : "agreement",
          module: "photo",
        };

        await updateDoc(userRef, {
          documents: arrayUnion(docItem),
          photoPdfUrl: pdfUrl,
        });

        await addDoc(
          collection(db, "users", uidToUse, "documents"),
          docItem
        );

        window.dispatchEvent(new Event("documentsUpdated"));
      } catch (pdfErr) {
        console.warn(
          "⚠️ PDF generate/upload failed—continuing:",
          pdfErr
        );
      }

      // 3) Email (best-effort)
      try {
        const service = import.meta.env.VITE_EMAILJS_SERVICE_ID;
        const template = import.meta.env.VITE_EMAILJS_TEMPLATE_ID;
        const publicKey =
          import.meta.env.VITE_EMAILJS_PUBLIC_KEY;
        if (service && template && publicKey) {
          await emailjs.send(
            service,
            template,
            {
              user_name: fullName,
              to_email:
                (userDoc as any)?.email ||
                user?.email ||
                "admin@wedndone.com",
              pdf_url: pdfUrl,
              pdf_title: isAddon
                ? "Photo Add-On Receipt"
                : "Photo Agreement",
            },
            publicKey
          );
        }
      } catch (emailErr) {
        console.warn(
          "⚠️ EmailJS send failed—continuing:",
          emailErr
        );
      }

      // 4) Fan-out events
      window.dispatchEvent(new Event("purchaseMade"));
      window.dispatchEvent(new Event("budgetUpdated"));
      window.dispatchEvent(new Event("weddingDateLocked"));
    } catch (error) {
      console.error("❌ Finalize error (continuing to thank-you):", error);
    } finally {
      setIsGenerating(false);
      setCompleted(true);
      try {
        onSuccess();
      } catch {}
    }
  };

  if (completed) return null;

  // Spinner state (unified "magic" card)
  if (isGenerating) {
    return (
      <div className="pixie-card pixie-card--modal" style={{ maxWidth: 700 }}>
        <button
          className="pixie-card__close"
          onClick={onClose}
          aria-label="Close"
        >
          <img src="/assets/icons/pink_ex.png" alt="Close" />
        </button>

        <div
          className="pixie-card__body"
          style={{ textAlign: "center" }}
        >
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

          <h3
            className="px-title"
            style={{ margin: 0 }}
          >
            Madge is working her magic…
          </h3>
        </div>
      </div>
    );
  }

  // Summary line (for UI before charge)
  const finalDuePretty =
    localStorage.getItem("photoFinalDuePretty") ||
    "35 days before your wedding date";

  const checkoutSummary = payFull
    ? `You're paying $${totalEffective.toFixed(2)} today.`
    : `You're paying a $${amountDueToday.toFixed(
        2
      )} deposit today. Remaining $${remainingBalance.toFixed(
        2
      )} due ${finalDuePretty}.`;

  return (
    <div className="pixie-card pixie-card--modal" style={{ maxWidth: 700 }}>
      {/* 🩷 Pink X Close */}
      <button
        className="pixie-card__close"
        onClick={onClose}
        aria-label="Close"
      >
        <img src="/assets/icons/pink_ex.png" alt="Close" />
      </button>

      {/* Body */}
      <div className="pixie-card__body" style={{ textAlign: "center" }}>
        <video
          src="/assets/videos/lock.mp4"
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
          style={{ marginBottom: 16 }}
        >
          {checkoutSummary}
        </p>

        {/* Stripe Elements */}
        <div className="px-elements">
          <Elements stripe={stripePromise}>
            <CheckoutForm
              total={amountDueToday}
              onSuccess={handleSuccess}
              setStepSuccess={onSuccess}
              isAddon={false}
              customerEmail={
                getAuth().currentUser?.email || undefined
              }
              customerName={
                `${
                  getAuth().currentUser?.displayName || ""
                }`.trim() || undefined
              }
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
          </Elements>
        </div>

        {/* Back button */}
        <div
          className="px-cta-col"
          style={{ marginTop: 12 }}
        >
          <button
            className="boutique-back-btn"
            onClick={onBack}
          >
            ⬅ Back
          </button>
        </div>
      </div>
    </div>
  );
};

export default PhotoCheckOut;