// src/components/NewYumBuild/dessert/YumCheckOutDessert.tsx
import React, { useState } from "react";
import { Elements } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import CheckoutForm from "../../../CheckoutForm";
import { getAuth } from "firebase/auth";
import {
  doc,
  updateDoc,
  arrayUnion,
  getDoc,
  setDoc,
  increment,
  serverTimestamp,
} from "firebase/firestore";
import { db, app } from "../../../firebase/firebaseConfig";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import generateDessertAgreementPDF from "../../../utils/generateDessertAgreementPDF";
import emailjs from "emailjs-com";
import { YumStep } from "../yumTypes";

// ─────────────────────────────────────────────
// Stripe (public key)
// ─────────────────────────────────────────────
const stripePromise = loadStripe(
  "pk_test_51Kh0qWD48xRO93UMFwIMguVpNpuICcWmVvZkD1YvK7naYFwLlhhiFtSU5requdOcmj1lKPiR0I0GhFgEAIhUVENZ00vFo6yI20"
);

// ─────────────────────────────────────────────
// Helpers (dates & math)
// ─────────────────────────────────────────────
const MS_DAY = 24 * 60 * 60 * 1000;
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

const parseLocalYMD = (ymd?: string | null): Date | null => {
  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  return new Date(`${ymd}T12:00:00`); // noon guard
};

const asStartOfDayUTC = (d: Date) =>
  new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 1));

function monthsBetweenInclusive(from: Date, to: Date) {
  const a = new Date(from.getFullYear(), from.getMonth(), 1);
  const b = new Date(to.getFullYear(), to.getMonth(), 1);
  let months = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
  if (to.getDate() >= from.getDate()) months += 1;
  return Math.max(1, months);
}

function firstMonthlyChargeAtUTC(from = new Date()): string {
  const y = from.getUTCFullYear();
  const m = from.getUTCMonth();
  const d = from.getUTCDate();
  const dt = new Date(Date.UTC(y, m + 1, d, 0, 0, 1));
  return dt.toISOString();
}

// ─────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────
interface YumCheckOutDessertProps {
  total: number;
  amountDueToday?: number; // ignored (we re-compute for 25%)
  guestCount: number;
  selectedStyle: string;
  selectedFlavorCombo: string;
  paymentSummaryText: string;
  lineItems: string[];
  signatureImage: string | null;
  onBack: () => void;
  onComplete: () => void;
  onClose: () => void;
  isGenerating: boolean;
  bookings: {
    catering?: boolean;
    dessert?: boolean;
  };
  setStep: (step: YumStep) => void;
}

const YumCheckOutDessert: React.FC<YumCheckOutDessertProps> = ({
  total,
  guestCount,
  selectedStyle,
  selectedFlavorCombo,
  paymentSummaryText,
  lineItems,
  signatureImage,
  onBack,
  onComplete,
  onClose,
  isGenerating: isGeneratingFromOverlay,
  bookings,
  setStep,
}) => {
  const [localGenerating, setLocalGenerating] = useState(false);
  const isGenerating = localGenerating || isGeneratingFromOverlay;

  // ─────────────────────────────────────────────
  // 25% deposit today → rest until final-due (-35d)
  // ─────────────────────────────────────────────
  const DEPOSIT_PCT = 0.25;
  const totalEffective = round2(Number(localStorage.getItem("yumTotal")) || Number(total) || 0);

  const plan = (localStorage.getItem("yumPaymentPlan") || "full") as "full" | "monthly";
  const usingFull = plan === "full";

  const depositAmount = round2(
    Number(localStorage.getItem("yumDepositAmount")) || totalEffective * DEPOSIT_PCT
  );

  const remainingBalance = round2(
    Number(localStorage.getItem("yumRemainingBalance")) ||
      Math.max(0, totalEffective - depositAmount)
  );

  const planMonths = Number(localStorage.getItem("yumPlanMonths")) || 0;
  const perMonth = (Number(localStorage.getItem("yumPerMonthCents")) || 0) / 100;
  const finalDuePretty =
    localStorage.getItem("yumFinalDuePretty") || "35 days before your wedding date";

  // What we actually charge right now
  const amountDueToday = usingFull ? totalEffective : depositAmount;

  // One clear, plan-specific line for the UI
  const paymentMessage = usingFull
    ? `You're paying $${amountDueToday.toFixed(2)} today.`
    : `You're paying $${amountDueToday.toFixed(
        2
      )} today, then ${planMonths} monthly payments of about $${perMonth.toFixed(
        2
      )} (final due ${finalDuePretty}).`;

  const handleSuccess = async (): Promise<void> => {
    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) return;

    try {
      setLocalGenerating(true);

      const userRef = doc(db, "users", user.uid);
      const snap = await getDoc(userRef);
      const userDoc = snap.exists() ? (snap.data() as any) : {};
      const fullName = `${userDoc?.firstName || "Magic"} ${userDoc?.lastName || "User"}`;
      const weddingYMD: string | null = userDoc?.weddingDate || null;

      // Final due date = wedding - 35 days
      const wedding = parseLocalYMD(weddingYMD || "");
      const finalDueDate = wedding ? new Date(wedding.getTime() - 35 * MS_DAY) : null;
      const finalDueISO = finalDueDate ? asStartOfDayUTC(finalDueDate).toISOString() : null;
      const finalDueDateStr = finalDueDate
        ? finalDueDate.toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })
        : "35 days before your wedding date";

      // Build monthly plan (evenly divide cents; last payment gets the remainder)
      let derivedPlanMonths = 0;
      let perMonthCents = 0;
      let lastPaymentCents = 0;
      let nextChargeAtISO: string | null = null;

      if (finalDueDate && remainingBalance > 0) {
        derivedPlanMonths = monthsBetweenInclusive(new Date(), finalDueDate);
        const remainingCents = Math.round(remainingBalance * 100);
        const base = Math.floor(remainingCents / Math.max(1, derivedPlanMonths));
        const tail = remainingCents - base * Math.max(0, derivedPlanMonths - 1);
        perMonthCents = base;
        lastPaymentCents = tail;
        nextChargeAtISO = firstMonthlyChargeAtUTC(new Date());
      }

      // ── Firestore: mark booked + cache locally ──
      await setDoc(
        userRef,
        {
          bookings: { ...(userDoc?.bookings || {}), dessert: true },
          weddingDateLocked: true,
          yumDessertStyle: selectedStyle,
          yumDessertFlavorCombo: selectedFlavorCombo,
          yumDessertGuestCount: guestCount,
          lastPurchaseAt: serverTimestamp(),
        },
        { merge: true }
      );
      localStorage.setItem("yumBookedDessert", "true"); // guest fallback

      // ✅ fire global events so Budget Wand / overlays refresh immediately
      window.dispatchEvent(new Event("dessertCompletedNow"));
      window.dispatchEvent(new Event("purchaseMade"));

      // ── Purchases entry (enriched for Budget Wand) ──
      const purchaseEntry = {
        label: "Yum Yum Desserts",
        category: "dessert",
        boutique: "dessert",
        source: "W&D",
        amount: Number(amountDueToday.toFixed(2)),
        amountChargedToday: Number(amountDueToday.toFixed(2)),
        contractTotal: Number(totalEffective.toFixed(2)),
        payFull: usingFull,
        deposit: usingFull ? 0 : Number(amountDueToday.toFixed(2)),
        monthlyAmount: usingFull ? 0 : +perMonth.toFixed(2),
        months: usingFull ? 0 : derivedPlanMonths,
        method: usingFull ? "paid_in_full" : "deposit",
        items: lineItems,
        date: new Date().toISOString(),
      };

      await updateDoc(userRef, {
        purchases: arrayUnion(purchaseEntry),
        // Keep spendTotal in sync with *actual card charge today*
        spendTotal: increment(Number(amountDueToday.toFixed(2))),
        paymentPlan: {
          product: "dessert",
          type: usingFull ? "paid_in_full" : "deposit",
          total: totalEffective,
          depositPercent: usingFull ? 1 : DEPOSIT_PCT,
          paidNow: amountDueToday,
          remainingBalance: usingFull ? 0 : remainingBalance,
          finalDueDate: finalDueDateStr,
          finalDueAt: finalDueISO,
          createdAt: new Date().toISOString(),
        },
        paymentPlanAuto: {
          version: 1,
          product: "dessert",
          status: usingFull ? "complete" : remainingBalance > 0 ? "active" : "complete",
          strategy: usingFull ? "paid_in_full" : "monthly_until_final",
          currency: "usd",
          totalCents: Math.round(totalEffective * 100),
          depositCents: Math.round((usingFull ? 0 : amountDueToday) * 100),
          remainingCents: Math.round((usingFull ? 0 : remainingBalance) * 100),
          planMonths: usingFull ? 0 : derivedPlanMonths,
          perMonthCents: usingFull ? 0 : Math.round(perMonth * 100),
          lastPaymentCents: usingFull ? 0 : lastPaymentCents,
          nextChargeAt: usingFull ? null : nextChargeAtISO,
          finalDueAt: finalDueISO,
          stripeCustomerId: localStorage.getItem("stripeCustomerId") || null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        "progress.yumYum.step": bookings.catering ? "thankyouBoth" : "thankyouDessertOnly",
      });

      // ── PDF generation & upload ──
      const signatureImageUrl = signatureImage || localStorage.getItem("yumSignature") || "";
      const pdfBlob = await generateDessertAgreementPDF({
        fullName,
        total: totalEffective,
        deposit: amountDueToday,
        guestCount,
        weddingDate: weddingYMD || "TBD",
        signatureImageUrl,
        paymentSummary:
          paymentSummaryText ||
          (usingFull
            ? `You're paying $${amountDueToday.toFixed(2)} today.`
            : `You're paying $${amountDueToday.toFixed(
                2
              )} today, then ${planMonths} monthly payments of about $${perMonth.toFixed(
                2
              )} (final due ${finalDuePretty}).`),
        selectedStyle,
        selectedFlavorCombo,
        lineItems,
      });

      const storage = getStorage(app, "gs://wedndonev2.firebasestorage.app");
      const filename = `YumDessertAgreement_${Date.now()}.pdf`;
      const fileRef = ref(storage, `public_docs/${user.uid}/${filename}`);
      await uploadBytes(fileRef, pdfBlob);
      const publicUrl = await getDownloadURL(fileRef);

      await updateDoc(userRef, {
        documents: arrayUnion({
          title: "Yum Yum Dessert Agreement",
          url: publicUrl,
          uploadedAt: new Date().toISOString(),
        }),
      });

      // ── Optional email (non-blocking; never blocks checkout) ──
      try {
        await emailjs.send(
          "service_xayel1i",
          "template_nvsea3z",
          {
            user_email: user.email || "Unknown",
            user_full_name: fullName,
            wedding_date: weddingYMD || "TBD",
            total: totalEffective.toFixed(2),
            line_items: lineItems.join(", "),
          },
          "5Lqtf5AMR9Uz5_5yF"
        );
      } catch (e) {
        console.warn("EmailJS failed (continuing):", e);
      }

      // UI fan-out so dashboards/overlays refresh immediately
      window.dispatchEvent(new Event("purchaseMade"));
      window.dispatchEvent(new Event("dessertCompletedNow"));
      window.dispatchEvent(new CustomEvent("bookingsChanged", { detail: { dessert: true } }));

      // Wizard advance
      const nextStep = (bookings.catering ? "thankyouBoth" : "thankyouDessertOnly") as YumStep;
      setStep(nextStep);
      localStorage.setItem("yumStep", nextStep);

      // Done
      onComplete();
    } catch (err) {
      console.error("❌ Dessert finalize error:", err);
      // keep user on screen so they can retry
    } finally {
      setLocalGenerating(false); // always clear
    }
  };

  // ===================== RENDER =====================
  return (
    <div className="pixie-card pixie-card--modal">
      {/* 🩷 Pink X Close */}
      <button className="pixie-card__close" onClick={onClose} aria-label="Close">
        <img src="/assets/icons/pink_ex.png" alt="Close" />
      </button>

      <div className="pixie-card__body">
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
            textAlign: "center",
          }}
        >
          Dessert Checkout
        </h2>

        <p className="px-prose-narrow" style={{ marginBottom: 16, textAlign: "center" }}>
          {paymentMessage}
        </p>

        {/* Stripe Elements — comfortably wide */}
        <div className="px-elements" aria-busy={isGenerating}>
          <Elements stripe={stripePromise}>
            <CheckoutForm
              total={amountDueToday}
              onSuccess={handleSuccess}
              setStepSuccess={() => {
                /* step advanced inside handleSuccess */
              }}
            />
          </Elements>
        </div>

        {/* Back */}
        <div style={{ marginTop: "1rem", textAlign: "center" }}>
          <button className="boutique-back-btn" style={{ width: 250 }} onClick={onBack} disabled={isGenerating}>
            ⬅ Back
          </button>
        </div>
      </div>
    </div>
  );
};

export default YumCheckOutDessert;