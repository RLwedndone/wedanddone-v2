// src/components/NewYumBuild/CustomVenues/Rubi/RubiDessertCheckout.tsx
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
import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL,
} from "firebase/storage";
import generateDessertAgreementPDF from "../../../../utils/generateDessertAgreementPDF";

import { notifyBooking } from "../../../../utils/email/email";

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

interface RubiDessertCheckoutProps {
  total: number;
  guestCount: number;
  selectedStyle: string;
  selectedFlavorCombo: string;
  paymentSummaryText: string;
  lineItems: string[];
  signatureImage: string | null;
  onBack: () => void;
  onClose: () => void;
  isGenerating: boolean;
  setStep: (step: any) => void;
  bookings?: { catering?: boolean; dessert?: boolean };
}

const RubiDessertCheckout: React.FC<RubiDessertCheckoutProps> = ({
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
}) => {
  const [localGenerating, setLocalGenerating] = useState(false);
  const isGenerating = localGenerating || isGeneratingFromOverlay;

  const [checkoutName, setCheckoutName] = useState("Magic User");

  useEffect(() => {
    (async () => {
      const auth = getAuth();
      const user = auth.currentUser;
      if (!user) return;

      try {
        const userRef = doc(db, "users", user.uid);
        const snap = await getDoc(userRef);
        const data = snap.exists() ? (snap.data() as any) : {};
        const safeFirst = data?.firstName || "Magic";
        const safeLast = data?.lastName || "User";
        setCheckoutName(`${safeFirst} ${safeLast}`);
      } catch {}
    })();
  }, []);

  const DEPOSIT_PCT = 0.25;

  const totalEffective = round2(
    Number(localStorage.getItem("yumTotal")) || Number(total) || 0
  );

  const planKey = (localStorage.getItem("yumPaymentPlan") ||
    localStorage.getItem("yumPayPlan") ||
    "full") as "full" | "monthly";

  const usingFull = planKey === "full";

  const depositAmount = round2(
    Number(localStorage.getItem("yumDepositAmount")) ||
      totalEffective * DEPOSIT_PCT
  );

  const remainingBalance = round2(
    Number(localStorage.getItem("yumRemainingBalance")) ||
      Math.max(0, totalEffective - depositAmount)
  );

  const planMonths =
    Number(localStorage.getItem("yumPlanMonths")) || 0;
  const perMonth =
    (Number(localStorage.getItem("yumPerMonthCents")) || 0) / 100;

  const finalDuePretty =
    localStorage.getItem("yumFinalDuePretty") ||
    "35 days before your wedding date";

  const amountDueToday = usingFull ? totalEffective : depositAmount;

  const paymentMessage = usingFull
    ? `You're paying $${Number(amountDueToday).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})} today.`
    : `You're paying $${amountDueToday.toFixed(
        2
      )} today, then ${planMonths} monthly payments of about $${perMonth.toFixed(
        2
      )} (final due ${finalDuePretty}).`;

      const handleSuccess = async ({ customerId }: { customerId?: string } = {}) => {
    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) return;

    try {
      setLocalGenerating(true);

      const userRef = doc(db, "users", user.uid);
      const snap = await getDoc(userRef);
      const userDoc = snap.exists() ? (snap.data() as any) : {};
      const safeFirst = userDoc?.firstName || "Magic";
      const safeLast = userDoc?.lastName || "User";
      const fullName = `${safeFirst} ${safeLast}`;
      const weddingYMD: string | null = userDoc?.weddingDate || null;

            // store stripeCustomerId for later auto-pay pulls
            try {
              if (customerId && customerId !== userDoc?.stripeCustomerId) {
                await updateDoc(userRef, {
                  stripeCustomerId: customerId,
                  "stripe.updatedAt": serverTimestamp(),
                });
                try {
                  localStorage.setItem("stripeCustomerId", customerId);
                } catch {}
              }
            } catch (e) {
              console.warn("⚠️ Could not save stripeCustomerId:", e);
            }

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

      await setDoc(
        userRef,
        {
          bookings: {
            ...(userDoc?.bookings || {}),
            dessert: true,
          },
          rubiDessertsBooked: true,
          weddingDateLocked: true,
          yumDessertStyle: selectedStyle,
          yumDessertFlavorCombo: selectedFlavorCombo,
          yumDessertGuestCount: guestCount,
          lastPurchaseAt: serverTimestamp(),
        },
        { merge: true }
      );

      try {
        localStorage.setItem("rubiJustBookedDessert", "true");
        localStorage.setItem("rubiDessertsBooked", "true");
        localStorage.setItem("yumStep", "rubiDessertThankYou");
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

            // cents + plan snapshot for paymentPlanAuto
            const totalCents = Math.round(totalEffective * 100);
            const depositCents = Math.round((usingFull ? 0 : amountDueToday) * 100);
            const remainingCents = Math.round(
              (usingFull ? 0 : remainingBalance) * 100
            );

            await updateDoc(userRef, {
              purchases: arrayUnion(purchaseEntry),
              spendTotal: increment(Number(amountDueToday.toFixed(2))),
      
              // 🔹 normalized dessert total for guest scroll / Budget Wand
              "totals.dessert": Number(totalEffective.toFixed(2)),
      
              // 🔹 human-readable dessert plan snapshot
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
      
              // 🔹 robot-friendly dessert auto-pay snapshot
              paymentPlanAuto: {
                version: 1,
                product: "dessert_rubi",
                status: usingFull
                  ? "complete"
                  : remainingBalance > 0
                  ? "active"
                  : "complete",
                strategy: usingFull ? "paid_in_full" : "monthly_until_final",
                currency: "usd",
      
                totalCents,
                depositCents,
                remainingCents,
      
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
      
              "progress.yumYum.step": "rubiDessertThankYou",
            });

      // 🔹 Dessert pricing snapshot for guest-count delta math
      await setDoc(
        doc(userRef, "pricingSnapshots", "dessert"),
        {
          booked: true,
          guestCountAtBooking: guestCount,
          totalBooked: Number(totalEffective.toFixed(2)),
          perGuest:
            guestCount > 0
              ? Number((totalEffective / guestCount).toFixed(2))
              : 0,
          venueId: "rubi",
          style: selectedStyle || null,
          flavorCombo: selectedFlavorCombo || null,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );

      const signatureImageUrl =
        signatureImage ||
        localStorage.getItem("rubiDessertSignature") ||
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
            ? `You're paying $${Number(amountDueToday).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})} today.`
            : `You're paying $${amountDueToday.toFixed(
                2
              )} today, then ${mths} monthly payments of about $${(
                perMonthCents / 100
              ).toFixed(2)} (final due ${finalDueDateStr}).`),
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

      // 📧 Centralized booking email — Yum Dessert @ Rubi
try {
  const current = getAuth().currentUser;

  const user_full_name = checkoutName || fullName || "Magic User";
  const payment_now = amountDueToday.toFixed(2);
  const remaining_balance = (usingFull ? 0 : Math.max(0, totalEffective - amountDueToday)).toFixed(2);

  await notifyBooking("yum_dessert", {
    // who
    user_email: current?.email || "unknown@wedndone.com",
    user_full_name,

    // details
    wedding_date: (typeof weddingYMD === "string" && weddingYMD) ? weddingYMD : "TBD",
    total: totalEffective.toFixed(2),
    line_items: (lineItems || []).join(", "),

    // pdf info
    pdf_url: publicUrl || "",
    pdf_title: "Yum Yum Dessert Agreement",

    // payment breakdown
    payment_now,
    remaining_balance,
    final_due: finalDueDateStr,

    // UX link + label
    dashboardUrl: `${window.location.origin}${import.meta.env.BASE_URL}dashboard`,
    product_name: "Rubi Dessert",
  });
} catch (mailErr) {
  console.error("❌ notifyBooking(yum_dessert) failed:", mailErr);
}

      window.dispatchEvent(new Event("purchaseMade"));
      window.dispatchEvent(new Event("dessertCompletedNow"));
      window.dispatchEvent(
        new CustomEvent("bookingsChanged", { detail: { dessert: true } })
      );

      setStep("rubiDessertThankYou");
    } catch (err) {
      console.error("❌ [Rubi][DessertCheckout] finalize error:", err);
    } finally {
      setLocalGenerating(false);
    }
  };

  return (
    <div className="pixie-card pixie-card--modal">
      <button className="pixie-card__close" onClick={onClose} aria-label="Close">
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

        <h2 className="px-title" style={{ fontFamily: "'Jenna Sue', cursive", fontSize: "1.9rem", marginBottom: 8, textAlign: "center" }}>
          Dessert Checkout
        </h2>

        <p className="px-prose-narrow" style={{ marginBottom: 16, textAlign: "center" }}>
          {paymentMessage}
        </p>

        <div className="px-elements">
          <CheckoutForm
            total={amountDueToday}
            onSuccess={handleSuccess}
            isAddon={false}
            customerEmail={getAuth().currentUser?.email || undefined}
            customerName={checkoutName}
            customerId={localStorage.getItem("stripeCustomerId") || undefined}
          />
        </div>

        <div style={{ marginTop: "1rem", textAlign: "center" }}>
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
  );
};

export default RubiDessertCheckout;