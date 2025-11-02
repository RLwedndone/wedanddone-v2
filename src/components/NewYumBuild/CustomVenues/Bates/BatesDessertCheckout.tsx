// src/components/NewYumBuild/CustomVenues/Bates/BatesDessertCheckout.tsx
import React, { useState } from "react";
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
import type { BatesStep } from "./BatesOverlay";
import emailjs from "emailjs-com";

// Helpers
const MS_DAY = 24 * 60 * 60 * 1000;
const round2 = (n: number) =>
  Math.round((n + Number.EPSILON) * 100) / 100;

const parseLocalYMD = (ymd?: string | null): Date | null =>
  !ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)
    ? null
    : new Date(`${ymd}T12:00:00`);

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

function monthsBetweenInclusive(from: Date, to: Date) {
  const a = new Date(from.getFullYear(), from.getMonth(), 1);
  const b = new Date(to.getFullYear(), to.getMonth(), 1);
  let months =
    (b.getFullYear() - a.getFullYear()) * 12 +
    (b.getMonth() - a.getMonth());
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

// Props
interface BatesDessertCheckoutProps {
  total: number; // contract total (backup if LS is missing)
  guestCount: number;
  selectedStyle: string;
  selectedFlavorCombo: string;
  paymentSummaryText: string;
  lineItems: string[];
  signatureImage: string | null;
  onBack: () => void;
  onClose: () => void;
  isGenerating: boolean;
  setStep: (step: BatesStep) => void;
  bookings?: { catering?: boolean; dessert?: boolean };

  // we need these so we can pass them into CheckoutForm customerName
  firstName?: string;
  lastName?: string;
}

const BatesDessertCheckout: React.FC<BatesDessertCheckoutProps> = ({
  total,
  guestCount,
  selectedStyle,
  selectedFlavorCombo,
  paymentSummaryText,
  lineItems,
  signatureImage,
  onBack,
  onClose,
  isGenerating: isGeneratingFromOverlay,
  setStep,
  firstName,
  lastName,
}) => {
  const [localGenerating, setLocalGenerating] = useState(false);
  const isGenerating = localGenerating || isGeneratingFromOverlay;

  // Plan selections saved on the contract screen / LS
  const DEPOSIT_PCT = 0.25;

  const totalEffective = round2(
    Number(localStorage.getItem("yumTotal")) ||
      Number(localStorage.getItem("batesTotal")) ||
      Number(total) ||
      0
  );

  const planKey = (
    localStorage.getItem("yumPaymentPlan") ||
    localStorage.getItem("yumPayPlan") ||
    localStorage.getItem("batesPaymentPlan") ||
    "full"
  ) as "full" | "monthly";

  const usingFull = planKey === "full";

  const depositAmount = round2(
    Number(localStorage.getItem("yumDepositAmount")) ||
      Number(localStorage.getItem("batesDepositAmount")) ||
      totalEffective * DEPOSIT_PCT
  );

  const remainingBalance = round2(
    Number(localStorage.getItem("yumRemainingBalance")) ||
      Number(localStorage.getItem("batesRemainingBalance")) ||
      Math.max(0, totalEffective - depositAmount)
  );

  const planMonths =
    Number(localStorage.getItem("yumPlanMonths")) ||
    Number(localStorage.getItem("batesPlanMonths")) ||
    0;

  const perMonth =
    (Number(localStorage.getItem("yumPerMonthCents")) ||
      Number(localStorage.getItem("batesPerMonthCents")) ||
      0) / 100;

  const finalDuePretty =
    localStorage.getItem("yumFinalDuePretty") ||
    localStorage.getItem("batesFinalDuePretty") ||
    "35 days before your wedding date";

  // What we actually charge right now
  const amountDueToday = usingFull ? totalEffective : depositAmount;

  // UI copy
  const paymentMessage = usingFull
    ? `You're paying $${amountDueToday.toFixed(2)} today.`
    : `You're paying $${amountDueToday.toFixed(
        2
      )} today, then ${planMonths} monthly payments of about $${perMonth.toFixed(
        2
      )} (final due ${finalDuePretty}).`;

  // Success → finalize, upload PDF, route to Bates TY
  const handleSuccess = async (): Promise<void> => {
    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) return;

    try {
      setLocalGenerating(true);

      const userRef = doc(db, "users", user.uid);
      const snap = await getDoc(userRef);
      const userDoc = snap.exists() ? (snap.data() as any) : {};
      const fullName = `${userDoc?.firstName || "Magic"} ${
        userDoc?.lastName || "User"
      }`;
      const weddingYMD: string | null = userDoc?.weddingDate || null;

      // Final due date = wedding - 35 days
      const wedding = parseLocalYMD(weddingYMD || "");
      const finalDueDate = wedding
        ? new Date(wedding.getTime() - 35 * MS_DAY)
        : null;
      const finalDueISO = finalDueDate
        ? asStartOfDayUTC(finalDueDate).toISOString()
        : null;
      const finalDueDateStr = finalDueDate
        ? finalDueDate.toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })
        : "35 days before your wedding date";

      // Build/confirm a monthly plan (even split; tail gets remainder)
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

      // Firestore: mark dessert booked and persist plan snapshot
      await setDoc(
        userRef,
        {
          bookings: { ...(userDoc?.bookings || {}), dessert: true },
          batesDessertsBooked: true,
          weddingDateLocked: true,
          yumDessertStyle: selectedStyle,
          yumDessertFlavorCombo: selectedFlavorCombo,
          yumDessertGuestCount: guestCount,
          lastPurchaseAt: serverTimestamp(),
        },
        { merge: true }
      );

      try {
        localStorage.setItem("batesJustBookedDessert", "true");
        localStorage.setItem("batesDessertsBooked", "true");
        localStorage.setItem(
          "batesYumStep",
          "batesDessertThankYou"
        );
        localStorage.setItem(
          "yumStep",
          "batesDessertThankYou"
        );
      } catch {}

      // Purchases entry
      const purchaseEntry = {
        label: "Yum Yum Desserts",
        category: "dessert",
        boutique: "dessert",
        source: "W&D",
        amount: Number(amountDueToday.toFixed(2)),
        amountChargedToday: Number(amountDueToday.toFixed(2)),
        contractTotal: Number(totalEffective.toFixed(2)),
        payFull: usingFull,
        deposit: usingFull
          ? 0
          : Number(amountDueToday.toFixed(2)),
        monthlyAmount: usingFull ? 0 : +(perMonth.toFixed(2)),
        months: usingFull ? 0 : mths,
        method: usingFull ? "paid_in_full" : "deposit",
        items: lineItems,
        date: new Date().toISOString(),
      };

      await updateDoc(userRef, {
        purchases: arrayUnion(purchaseEntry),
        spendTotal: increment(
          Number(amountDueToday.toFixed(2))
        ),
        paymentPlan: {
          product: "dessert",
          type: usingFull ? "paid_in_full" : "deposit",
          total: totalEffective,
          depositPercent: usingFull ? 1 : 0.25,
          paidNow: amountDueToday,
          remainingBalance: usingFull
            ? 0
            : remainingBalance,
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
          strategy: usingFull
            ? "paid_in_full"
            : "monthly_until_final",
          currency: "usd",
          totalCents: Math.round(totalEffective * 100),
          depositCents: Math.round(
            (usingFull ? 0 : amountDueToday) * 100
          ),
          remainingCents: Math.round(
            (usingFull ? 0 : remainingBalance) * 100
          ),
          planMonths: usingFull ? 0 : mths,
          perMonthCents: usingFull
            ? 0
            : Math.round(perMonth * 100),
          lastPaymentCents: usingFull ? 0 : lastPaymentCents,
          nextChargeAt: usingFull
            ? null
            : nextChargeAtISO,
          finalDueAt: finalDueISO,
          stripeCustomerId:
            localStorage.getItem("stripeCustomerId") || null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        "progress.yumYum.step":
          "batesDessertThankYou",
      });

      // Build PDF (use mths/perMonthCents in fallback summary)
      const signatureImageUrl =
        signatureImage ||
        localStorage.getItem("batesDessertSignature") ||
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
            ? `You're paying $${amountDueToday.toFixed(
                2
              )} today.`
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
      const storage = getStorage(
        app,
        "gs://wedndonev2.firebasestorage.app"
      );
      const filename = `YumDessertAgreement_${Date.now()}.pdf`;
      const fileRef = ref(
        storage,
        `public_docs/${user.uid}/${filename}`
      );
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
            user_email:
              user.email || "Unknown",
            user_full_name: fullName,
            wedding_date:
              weddingYMD || "TBD",
            total: totalEffective.toFixed(2),
            line_items: lineItems.join(", "),
          },
          "5Lqtf5AMR9Uz5_5yF"
        );
      } catch (e) {
        console.warn(
          "EmailJS failed (continuing):",
          e
        );
      }

      // UI fan-out so dashboards/overlays refresh immediately
      window.dispatchEvent(new Event("purchaseMade"));
      window.dispatchEvent(
        new Event("dessertCompletedNow")
      );
      window.dispatchEvent(
        new CustomEvent("bookingsChanged", {
          detail: { dessert: true },
        })
      );

      // Wizard advance — always go to the Bates Dessert TY (chime plays there)
      const nextStep: BatesStep =
        "batesDessertThankYou";
      try {
        localStorage.setItem(
          "batesJustBookedDessert",
          "true"
        );
        localStorage.setItem(
          "batesDessertsBooked",
          "true"
        );
        localStorage.setItem(
          "batesYumStep",
          nextStep
        );
        localStorage.setItem(
          "yumStep",
          nextStep
        );
      } catch {}

      setStep(nextStep);
    } catch (err) {
      console.error(
        "❌ [Bates][DessertCheckout] finalize error:",
        err
      );
    } finally {
      setLocalGenerating(false); // ✅ always clear
    }
  };

  // ===================== RENDER =====================
return (
  <div
    style={{
      minHeight: "100vh",
      width: "100%",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "2rem 1rem",
      boxSizing: "border-box",
    }}
  >
    <div
      className="pixie-card pixie-card--modal"
      style={{ maxWidth: 700, position: "relative" }}
    >
      {/* 🩷 Pink X Close */}
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
        style={{
          textAlign: "center",
          padding: "2rem 2.5rem",
        }}
      >
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
            textAlign: "center",
          }}
        >
          Dessert Checkout
        </h2>

        <p
          className="px-prose-narrow"
          style={{
            marginBottom: 16,
            textAlign: "center",
          }}
        >
          {paymentMessage}
        </p>

        {/* Stripe Card Entry */}
        <div
          className="px-elements"
          aria-busy={isGenerating}
        >
          <CheckoutForm
            total={amountDueToday}
            onSuccess={handleSuccess}
            setStepSuccess={handleSuccess}
            isAddon={false}
            customerEmail={
              getAuth().currentUser?.email ||
              undefined
            }
            customerName={`${firstName || "Magic"} ${
              lastName || "User"
            }`}
            customerId={(() => {
              try {
                return (
                  localStorage.getItem(
                    "stripeCustomerId"
                  ) || undefined
                );
              } catch {
                return undefined;
              }
            })()}
          />
        </div>

        {/* Back */}
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
            disabled={isGenerating}
          >
            ⬅ Back
          </button>
        </div>
      </div>
    </div>
  </div>
  );
};

export default BatesDessertCheckout;