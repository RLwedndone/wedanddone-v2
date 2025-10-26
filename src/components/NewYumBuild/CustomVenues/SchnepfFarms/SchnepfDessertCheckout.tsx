// src/components/NewYumBuild/CustomVenues/Schnepf/SchnepfDessertCheckout.tsx
import React, { useState, useEffect } from "react";
import CheckoutForm from "../../../../CheckoutForm";
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
import { db, app } from "../../../../firebase/firebaseConfig";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import generateDessertAgreementPDF from "../../../../utils/generateDessertAgreementPDF";

// Helpers
const MS_DAY = 24 * 60 * 60 * 1000;
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

const parseLocalYMD = (ymd?: string | null): Date | null =>
  !ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd) ? null : new Date(`${ymd}T12:00:00`);

const asStartOfDayUTC = (d: Date) =>
  new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 1));

function monthsBetweenInclusive(from: Date, to: Date) {
  const a = new Date(from.getFullYear(), from.getMonth(), 1);
  const b = new Date(to.getFullYear(), to.getMonth(), 1);
  let months =
    (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
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

interface SchnepfDessertCheckoutProps {
  total: number; // contract total (backup)
  guestCount: number;
  selectedStyle: string;
  selectedFlavorCombo: string;
  paymentSummaryText: string;
  lineItems: string[];
  signatureImage: string | null;
  onBack: () => void;
  onClose: () => void;
  isGenerating?: boolean;
  onComplete: () => void; // parent moves to schnepfDessertThankYou
}

const SchnepfDessertCheckout: React.FC<SchnepfDessertCheckoutProps> = ({
  total,
  guestCount,
  selectedStyle,
  selectedFlavorCombo,
  paymentSummaryText,
  lineItems,
  signatureImage,
  onBack,
  onClose,
  isGenerating: isGeneratingFromOverlay = false,
  onComplete,
}) => {
  const [localGenerating, setLocalGenerating] = useState(false);
  const isGenerating = localGenerating || isGeneratingFromOverlay;

  // We'll also grab first/last name once so we can pass to CheckoutForm nicely
  const [firstName, setFirstName] = useState("Magic");
  const [lastName, setLastName] = useState("User");

  useEffect(() => {
    (async () => {
      const auth = getAuth();
      const user = auth.currentUser;
      if (!user) return;

      try {
        const userRef = doc(db, "users", user.uid);
        const snap = await getDoc(userRef);
        const data = snap.exists() ? (snap.data() as any) : {};
        if (data?.firstName) setFirstName(data.firstName);
        if (data?.lastName) setLastName(data.lastName);
      } catch (err) {
        console.warn("⚠️ Could not load user names for SchnepfDessertCheckout:", err);
      }
    })();
  }, []);

  // Plan selections saved on contract
  const DEPOSIT_PCT = 0.25;

  const totalEffective = round2(
    Number(localStorage.getItem("schnepfDessertTotal")) ||
      Number(localStorage.getItem("yumTotal")) || // fallback
      Number(total) ||
      0
  );

  const planKey =
    (localStorage.getItem("schnepfDessertPaymentPlan") ||
      localStorage.getItem("schnepfDessertPayPlan") ||
      localStorage.getItem("yumPaymentPlan") ||
      "full") as "full" | "monthly";

  const usingFull = planKey === "full";

  const depositAmount = round2(
    Number(localStorage.getItem("schnepfDessertDepositAmount")) ||
      Number(localStorage.getItem("yumDepositAmount")) ||
      totalEffective * DEPOSIT_PCT
  );

  const remainingBalance = round2(
    Number(localStorage.getItem("schnepfDessertRemainingBalance")) ||
      Number(localStorage.getItem("yumRemainingBalance")) ||
      Math.max(0, totalEffective - depositAmount)
  );

  const planMonths =
    Number(localStorage.getItem("schnepfDessertPlanMonths")) ||
    Number(localStorage.getItem("yumPlanMonths")) ||
    0;

  const perMonth =
    (Number(localStorage.getItem("schnepfDessertPerMonthCents")) ||
      Number(localStorage.getItem("yumPerMonthCents")) ||
      0) / 100;

  const finalDuePretty =
    localStorage.getItem("schnepfDessertFinalDuePretty") ||
    localStorage.getItem("yumFinalDuePretty") ||
    "35 days before your wedding date";

  const amountDueToday = usingFull ? totalEffective : depositAmount;

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

      // Build monthly plan (even split; tail gets remainder)
      let mths = 0;
      let perMonthCents = 0;
      let lastPaymentCents = 0;
      let nextChargeAtISO: string | null = null;

      if (!usingFull && finalDueDate && remainingBalance > 0) {
        mths = monthsBetweenInclusive(new Date(), finalDueDate);
        const remainingCents = Math.round(remainingBalance * 100);
        const base = Math.floor(remainingCents / Math.max(1, mths));
        const tail = remainingCents - base * Math.max(0, mths - 1);
        perMonthCents = base;
        lastPaymentCents = tail;
        nextChargeAtISO = firstMonthlyChargeAtUTC(new Date());
      }

      // Firestore: mark dessert booked + plan snapshot
      await setDoc(
        userRef,
        {
          bookings: { ...(userDoc?.bookings || {}), dessert: true },
          schnepfDessertsBooked: true,
          weddingDateLocked: true,
          yumDessertStyle: selectedStyle,
          yumDessertFlavorCombo: selectedFlavorCombo,
          yumDessertGuestCount: guestCount,
          lastPurchaseAt: serverTimestamp(),
        },
        { merge: true }
      );

      try {
        localStorage.setItem("schnepfJustBookedDessert", "true");
        localStorage.setItem("schnepfDessertsBooked", "true");
        localStorage.setItem("schnepfYumStep", "schnepfDessertThankYou");
        localStorage.setItem("yumStep", "schnepfDessertThankYou");
      } catch {}

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
        monthlyAmount: usingFull ? 0 : +(perMonth.toFixed(2)),
        months: usingFull ? 0 : mths,
        method: usingFull ? "paid_in_full" : "deposit",
        items: lineItems,
        date: new Date().toISOString(),
      };

      await updateDoc(userRef, {
        purchases: arrayUnion(purchaseEntry),
        spendTotal: increment(Number(amountDueToday.toFixed(2))),
        paymentPlan: {
          product: "dessert",
          type: usingFull ? "paid_in_full" : "deposit",
          total: totalEffective,
          depositPercent: usingFull ? 1 : 0.25,
          paidNow: amountDueToday,
          remainingBalance: usingFull ? 0 : remainingBalance,
          finalDueDate: finalDueDateStr,
          finalDueAt: finalDueISO,
          createdAt: new Date().toISOString(),
        },
        paymentPlanAuto: {
          version: 1,
          product: "dessert",
          status: usingFull
            ? "complete"
            : remainingBalance > 0
            ? "active"
            : "complete",
          strategy: usingFull ? "paid_in_full" : "monthly_until_final",
          currency: "usd",
          totalCents: Math.round(totalEffective * 100),
          depositCents: Math.round((usingFull ? 0 : amountDueToday) * 100),
          remainingCents: Math.round(
            (usingFull ? 0 : remainingBalance) * 100
          ),
          planMonths: usingFull ? 0 : mths,
          perMonthCents: usingFull ? 0 : perMonthCents,
          lastPaymentCents: usingFull ? 0 : lastPaymentCents,
          nextChargeAt: usingFull ? null : nextChargeAtISO,
          finalDueAt: finalDueISO,
          stripeCustomerId:
            localStorage.getItem("stripeCustomerId") || null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        // progress snapshot so TY screen shows correctly
        "progress.yumYum.step": "schnepfDessertThankYou",
      });

      // Build PDF
      const signatureImageUrl =
        signatureImage ||
        localStorage.getItem("schnepfDessertSignature") ||
        localStorage.getItem("yumSignature") ||
        "";

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
              )} today, then ${mths} monthly payments of about $${(
                perMonthCents / 100
              ).toFixed(2)} (final due ${finalDueDateStr}).`),
        selectedStyle,
        selectedFlavorCombo,
        lineItems,
      });

      // Upload PDF
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

      setLocalGenerating(false);

      // Fan-out events
      window.dispatchEvent(new Event("purchaseMade"));
      window.dispatchEvent(new Event("dessertCompletedNow"));
      window.dispatchEvent(
        new CustomEvent("bookingsChanged", { detail: { dessert: true } })
      );

      // Parent navigates to SchnepfDessertThankYou
      onComplete();
    } catch (err) {
      console.error("❌ [Schnepf][DessertCheckout] finalize error:", err);
      setLocalGenerating(false);
    }
  };

  // --- unified spinner styles ---
  const overlayStyle: React.CSSProperties = {
    position: "fixed",
    inset: 0,
    backgroundColor: "rgba(0,0,0,0.35)",
    zIndex: 1000,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    overflowY: "auto",
    padding: 16,
  };

  const cardStyle: React.CSSProperties = {
    background: "#fff",
    width: "min(680px, 94vw)",
    maxHeight: "90vh",
    overflow: "hidden",
    boxSizing: "border-box",
    borderRadius: 18,
    boxShadow: "0 4px 20px rgba(0,0,0,0.2)",
    padding: "22px 20px 28px",
    position: "relative",
    display: "flex",
    flexDirection: "column",
    alignItems: "stretch",
    gap: 12,
  };

  return isGenerating ? (
    <div className="pixie-overlay" style={overlayStyle}>
      <div className="pixie-overlay-card" style={cardStyle}>
        <video
          src={`${import.meta.env.BASE_URL}assets/videos/magic_clock.mp4`}
          autoPlay
          loop
          muted
          playsInline
          className="px-media"
          style={{
            width: "100%",
            maxWidth: 350,
            margin: "0 auto 12px",
            display: "block",
            borderRadius: 12,
          }}
        />
        <p
          style={{
            fontSize: "1.05rem",
            color: "#2c62ba",
            textAlign: "center",
            fontStyle: "italic",
            margin: 0,
          }}
        >
          Madge is icing your cake... one sec!
        </p>
      </div>
    </div>
  ) : (
    <div
      className="pixie-card pixie-card--modal"
      style={{ maxWidth: 680, position: "relative" }}
    >
      {/* 🩷 Pink X Close */}
      {onClose && (
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
      )}

      <div className="pixie-card__body" style={{ textAlign: "center" }}>
        <video
          src={`${import.meta.env.BASE_URL}assets/videos/lock.mp4`}
          autoPlay
          muted
          playsInline
          loop
          className="px-media"
          style={{
            width: 150,
            maxWidth: "90%",
            borderRadius: 12,
            margin: "0 auto 12px",
          }}
        />

        <h2
          className="px-title-lg"
          style={{ marginBottom: 12, color: "#2c62ba" }}
        >
          Dessert Checkout
        </h2>

        <div
          className="px-prose-narrow"
          style={{ margin: "0 auto 16px" }}
        >
          <p>{paymentMessage}</p>
        </div>

        {/* Stripe Card Entry (global StripeProvider wraps App) */}
        <div className="px-elements" aria-busy={isGenerating}>
          <CheckoutForm
            total={amountDueToday}
            onSuccess={handleSuccess}
            setStepSuccess={handleSuccess} // harmless passthrough
            isAddon={false}
            customerEmail={getAuth().currentUser?.email || undefined}
            customerName={`${firstName || "Magic"} ${lastName || "User"}`}
            customerId={(() => {
              try {
                return localStorage.getItem("stripeCustomerId") || undefined;
              } catch {
                return undefined;
              }
            })()}
          />
        </div>

        <div className="px-cta-col" style={{ marginTop: 16 }}>
          <button
            className="boutique-back-btn"
            style={{ width: 250 }}
            onClick={onBack}
          >
            ⬅ Back
          </button>
        </div>
      </div>
    </div>
  );
};

export default SchnepfDessertCheckout;