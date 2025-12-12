// src/components/NewYumBuild/CustomVenues/Tubac/TubacDessertCheckout.tsx
import React, { useEffect, useState, useRef } from "react";
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
import type { TubacStep } from "./TubacOverlay";
import { notifyBooking } from "../../../../utils/email/email";

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

// Props
interface TubacDessertCheckoutProps {
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
  setStep: (step: TubacStep) => void;
  bookings?: { catering?: boolean; dessert?: boolean };
}

const TubacDessertCheckout: React.FC<TubacDessertCheckoutProps> = ({
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
  const didRunRef = useRef(false);

  // lightweight user name for CheckoutForm + emails
  const [firstName, setFirstName] = useState("Magic");
  const [lastName, setLastName] = useState("User");

  useEffect(() => {
    (async () => {
      const user = getAuth().currentUser;
      if (!user) return;
      try {
        const snap = await getDoc(doc(db, "users", user.uid));
        const data = snap.data() || {};
        setFirstName(data.firstName || "Magic");
        setLastName(data.lastName || "User");
      } catch {
        /* ignore */
      }
    })();
  }, []);

  // Plan selections saved on the dessert contract screen (TubacDessertContract)
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

  const planMonths = Number(localStorage.getItem("yumPlanMonths")) || 0;

  const perMonth =
    (Number(localStorage.getItem("yumPerMonthCents")) || 0) / 100;

  const finalDuePretty =
    localStorage.getItem("yumFinalDuePretty") ||
    "35 days before your wedding date";

  // What we actually charge right now
  const amountDueToday = usingFull ? totalEffective : depositAmount;

  // UI copy
  const paymentMessage = usingFull
    ? `You're paying $${Number(amountDueToday).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })} today.`
    : `You're paying $${amountDueToday.toFixed(
        2
      )} today, then ${planMonths} monthly payments of about $${perMonth.toFixed(
        2
      )} (final due ${finalDuePretty}).`;

  // Spinner overlay styles
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

  // Success → finalize, upload PDF, route to Tubac Dessert TY
  const handleSuccess = async ({ customerId }: { customerId?: string } = {}) => {
    if (didRunRef.current) {
      console.warn(
        "[TubacDessertCheckout] handleSuccess already ran — ignoring re-entry"
      );
      return;
    }
    didRunRef.current = true;

    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) return;

    try {
      setLocalGenerating(true);

      const userRef = doc(db, "users", user.uid);
      const snap = await getDoc(userRef);
      const userDoc = snap.exists() ? (snap.data() as any) : {};

      const safeFirst = userDoc?.firstName || firstName || "Magic";
      const safeLast = userDoc?.lastName || lastName || "User";
      const fullName = `${safeFirst} ${safeLast}`;
      const weddingYMD: string | null = userDoc?.weddingDate || null;

      // Save Stripe customerId if we just learned it
      try {
        if (customerId && customerId !== userDoc?.stripeCustomerId) {
          await updateDoc(userRef, {
            stripeCustomerId: customerId,
            "stripe.updatedAt": serverTimestamp(),
          });
          try {
            localStorage.setItem("stripeCustomerId", customerId);
          } catch {
            /* ignore */
          }
        }
      } catch (e) {
        console.warn("⚠️ Could not save stripeCustomerId:", e);
      }

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
          bookings: {
            ...(userDoc?.bookings || {}),
            dessert: true,
          },
          tubacDessertsBooked: true,
          weddingDateLocked: true,
          yumDessertStyle: selectedStyle,
          yumDessertFlavorCombo: selectedFlavorCombo,
          yumDessertGuestCount: guestCount,
          lastPurchaseAt: serverTimestamp(),
        },
        { merge: true }
      );

      try {
        localStorage.setItem("tubacJustBookedDessert", "true");
        localStorage.setItem("tubacDessertsBooked", "true");
        localStorage.setItem("yumStep", "tubacDessertThankYou");
      } catch {
        /* ignore */
      }

      const nowIso = new Date().toISOString();
      const amountNow = Number(amountDueToday.toFixed(2));
      const totalCents = Math.round(totalEffective * 100);
      const depositCents = usingFull ? totalCents : Math.round(amountNow * 100);
      const remainingCents = usingFull ? 0 : Math.round(remainingBalance * 100);
      const depositPercent =
        totalCents > 0
          ? depositCents / totalCents
          : usingFull
          ? 1
          : 0.25;

      // Purchases entry
      const purchaseEntry = {
        label: "Yum Yum Desserts",
        category: "dessert",
        boutique: "dessert",
        source: "W&D",
        amount: amountNow,
        amountChargedToday: amountNow,
        contractTotal: Number(totalEffective.toFixed(2)),
        payFull: usingFull,
        deposit: usingFull ? 0 : amountNow,
        monthlyAmount: usingFull ? 0 : +perMonth.toFixed(2),
        months: usingFull ? 0 : mths,
        method: usingFull ? "paid_in_full" : "deposit",
        items: lineItems,
        date: nowIso,
      };

      await updateDoc(userRef, {
        purchases: arrayUnion(purchaseEntry),
        spendTotal: increment(amountNow),
        paymentPlan: {
          product: "dessert_tubac",
          type: usingFull ? "paid_in_full" : "deposit",
          total: totalEffective,
          depositPercent,
          paidNow: amountNow,
          remainingBalance: usingFull ? 0 : remainingBalance,
          finalDueDate: finalDueDateStr,
          finalDueAt: finalDueISO,
          createdAt: nowIso,
        },
        paymentPlanAuto: {
          version: 1,
          product: "dessert_tubac",
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
            customerId ||
            localStorage.getItem("stripeCustomerId") ||
            null,
          createdAt: nowIso,
          updatedAt: nowIso,
        },
        "progress.yumYum.step": "tubacDessertThankYou",
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
          venueId: "tubac",
          style: selectedStyle || null,
          flavorCombo: selectedFlavorCombo || null,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );

      // Build PDF
      const signatureImageUrl =
        signatureImage ||
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
            ? `You're paying $${Number(amountDueToday).toLocaleString(
                undefined,
                {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                }
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

      // 📧 Centralized booking email — Yum Dessert @ Tubac
      try {
        await notifyBooking("yum_dessert", {
          // who
          user_email: user.email || "unknown@wedndone.com",
          user_full_name: fullName,

          // details
          wedding_date: weddingYMD || "TBD",
          total: totalEffective.toFixed(2),
          line_items: (lineItems || []).join(", "),

          // pdf info
          pdf_url: publicUrl || "",
          pdf_title: "Yum Yum Dessert Agreement",

          // payment breakdown
          payment_now: amountDueToday.toFixed(2),
          remaining_balance: remainingBalance.toFixed(2),
          final_due: finalDueDateStr,

          // UX link + label
          dashboardUrl: `${window.location.origin}${import.meta.env.BASE_URL}dashboard`,
          product_name: "Tubac Desserts",
        });
      } catch (mailErr) {
        console.error("❌ notifyBooking(yum_dessert) failed:", mailErr);
      }

      // UI fan-out
      window.dispatchEvent(new Event("purchaseMade"));
      window.dispatchEvent(new Event("dessertCompletedNow"));
      window.dispatchEvent(
        new CustomEvent("bookingsChanged", {
          detail: { dessert: true },
        })
      );
      window.dispatchEvent(new Event("documentsUpdated"));

      // Advance wizard
      const nextStep: TubacStep = "tubacDessertThankYou";
      try {
        localStorage.setItem("yumStep", nextStep);
      } catch {
        /* ignore */
      }
      setStep(nextStep);
    } catch (err) {
      console.error("❌ [Tubac][DessertCheckout] finalize error:", err);
    } finally {
      setLocalGenerating(false);
    }
  };

  // ===================== RENDER =====================
  if (isGenerating) {
    return (
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
    );
  }

  return (
    <div className="pixie-card pixie-card--modal">
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

        {/* Stripe Card Entry (global StripeProvider wraps App, so no <Elements>) */}
        <div className="px-elements" aria-busy={isGenerating}>
          <CheckoutForm
            total={amountDueToday}
            onSuccess={handleSuccess}
            setStepSuccess={() => {
              /* handled in handleSuccess */
            }}
            isAddon={false}
            customerEmail={getAuth().currentUser?.email || undefined}
            customerName={`${firstName || "Magic"} ${lastName || "User"}`}
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
  );
};

export default TubacDessertCheckout;