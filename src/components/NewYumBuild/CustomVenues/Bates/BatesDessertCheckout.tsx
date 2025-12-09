// src/components/NewYumBuild/CustomVenues/Bates/BatesDessertCheckout.tsx
import React, { useState, useRef, useEffect } from "react";
import CheckoutForm from "../../../../CheckoutForm";

import { getAuth, onAuthStateChanged } from "firebase/auth";
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
import { notifyBooking } from "../../../../utils/email/email";

// 🔗 Same base as Floral / PaymentSettings / Bates catering
const API_BASE =
  "https://us-central1-wedndonev2.cloudfunctions.net/stripeapiV2";

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
  const didRunRef = useRef(false);
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
    ? `You're paying $${Number(amountDueToday).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })} today.`
    : `You're paying $${amountDueToday.toFixed(
        2
      )} today, then ${planMonths} monthly payments of about $${perMonth.toFixed(
        2
      )} (final due ${finalDuePretty}).`;

  // 🔐 Payment mode + saved card summary (same pattern as Bates catering)
  const [mode, setMode] = useState<"saved" | "new">("new");
  const [savedCardSummary, setSavedCardSummary] = useState<{
    brand: string;
    last4: string;
    exp_month: number;
    exp_year: number;
  } | null>(null);

  const hasSavedCard = !!savedCardSummary;
  const requiresCardOnFile = !usingFull; // deposit/monthly → card on file needed

  // Load saved card summary (if any)
  useEffect(() => {
    const auth = getAuth();

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      try {
        const effectiveUid = user?.uid;
        if (!effectiveUid) return;

        const res = await fetch(`${API_BASE}/payments/get-default`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ uid: effectiveUid }),
        });

        if (!res.ok) {
          const t = await res.text();
          console.warn(
            "[BatesDessertCheckout] get-default failed:",
            res.status,
            t
          );
          return;
        }

        const data = await res.json();
        if (data?.card) {
          setSavedCardSummary(data.card);
          setMode("saved");
        }
      } catch (err) {
        console.warn("[BatesDessertCheckout] No saved card found:", err);
      }
    });

    return () => unsubscribe();
  }, []);

  // Success → finalize, upload PDF, route to Bates TY
  const handleSuccess = async ({
    customerId,
  }: {
    customerId?: string;
  } = {}): Promise<void> => {
    if (didRunRef.current) {
      console.warn(
        "[BatesDessertCheckout] handleSuccess already ran — ignoring re-entry"
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

      // Save/refresh Stripe customer id (if provided)
      try {
        const existing = userDoc?.stripeCustomerId as string | undefined;
        if (customerId && customerId !== existing) {
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

      // Ensure default PM for off-session charges (only if plan requires it)
      try {
        const shouldStoreCard = requiresCardOnFile;
        if (shouldStoreCard) {
          await fetch(`${API_BASE}/ensure-default-payment-method`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              customerId: customerId || localStorage.getItem("stripeCustomerId"),
              firebaseUid: user.uid,
            }),
          });
          console.log("✅ ensure-default-payment-method called for Bates dessert");
        } else {
          console.log(
            "ℹ️ Skipping ensure-default-payment-method (dessert paid in full)."
          );
        }
      } catch (err) {
        console.error("❌ ensure-default-payment-method failed:", err);
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
        localStorage.setItem("batesYumStep", "batesDessertThankYou");
        localStorage.setItem("yumStep", "batesDessertThankYou");
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
        deposit: usingFull ? 0 : Number(amountDueToday.toFixed(2)),
        monthlyAmount: usingFull ? 0 : +(perMonth.toFixed(2)),
        months: usingFull ? 0 : mths,
        method: usingFull ? "paid_in_full" : "deposit",
        items: lineItems,
        date: new Date().toISOString(),
      };

      await updateDoc(userRef, {
        // purchase history
        purchases: arrayUnion(purchaseEntry),

        // spendTotal = what hit the card today
        spendTotal: increment(Number(amountDueToday.toFixed(2))),

        // 🔹 Normalized dessert totals for Guest Scroll + admin
        "totals.dessert.contractTotal": Number(totalEffective.toFixed(2)),
        "totals.dessert.amountPaid": increment(
          Number(amountDueToday.toFixed(2))
        ),
        "totals.dessert.guestCountAtBooking": guestCount,
        "totals.dessert.venueSlug": "batesmansion",
        "totals.dessert.style": selectedStyle || null,
        "totals.dessert.flavorCombo": selectedFlavorCombo || null,
        "totals.dessert.lastUpdatedAt": new Date().toISOString(),

        // keep existing plan snapshot for Stripe autopay
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
          depositCents: Math.round(
            (usingFull ? 0 : amountDueToday) * 100
          ),
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

        // route TY screen
        "progress.yumYum.step": "batesDessertThankYou",
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

      // ✅ Centralized user+admin booking email for Bates Desserts
      try {
        const current = getAuth().currentUser;
        await notifyBooking("yum_dessert", {
          user_email: current?.email || userDoc?.email || "unknown@wedndone.com",
          user_full_name: fullName,
          firstName: safeFirst,
          wedding_date: weddingYMD || "TBD",
          total: totalEffective.toFixed(2),
          line_items: (lineItems || []).join(", "),
          pdf_url: publicUrl || "",
          pdf_title: "Yum Yum Dessert Agreement",
          payment_now: amountDueToday.toFixed(2),
          remaining_balance: remainingBalance.toFixed(2),
          final_due: finalDueDateStr,
          dashboardUrl: `${window.location.origin}${import.meta.env.BASE_URL}dashboard`,
          product_name: "Bates Desserts",
        });
      } catch (mailErr) {
        console.error("❌ notifyBooking failed:", mailErr);
      }

      // UI fan-out so dashboards/overlays refresh immediately
      window.dispatchEvent(new Event("purchaseMade"));
      window.dispatchEvent(new Event("dessertCompletedNow"));
      window.dispatchEvent(
        new CustomEvent("bookingsChanged", {
          detail: { dessert: true },
        })
      );

      // Wizard advance — always go to the Bates Dessert TY
      const nextStep: BatesStep = "batesDessertThankYou";
      try {
        localStorage.setItem("batesJustBookedDessert", "true");
        localStorage.setItem("batesDessertsBooked", "true");
        localStorage.setItem("batesYumStep", nextStep);
        localStorage.setItem("yumStep", nextStep);
      } catch {}

      setStep(nextStep);
    } catch (err) {
      console.error(
        "❌ [Bates][DessertCheckout] finalize error:",
        err
      );
    } finally {
      setLocalGenerating(false);
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

          {/* Payment Method Selection (mirrors Bates catering) */}
          <div
            style={{
              marginTop: 12,
              marginBottom: 20,
              padding: "14px 16px",
              borderRadius: 12,
              background: "#f7f8ff",
              border: "1px solid #d9ddff",
              maxWidth: 520,
              marginInline: "auto",
            }}
          >
            {hasSavedCard ? (
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
                    name="dessertPaymentMode"
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
                    name="dessertPaymentMode"
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
            )}
          </div>

          {/* Stripe Card Entry */}
          <div
            className="px-elements"
            aria-busy={isGenerating}
          >
            <CheckoutForm
              total={amountDueToday}
              useSavedCard={mode === "saved"}
              onSuccess={handleSuccess}
              isAddon={false}
              customerEmail={getAuth().currentUser?.email || undefined}
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
        </div>
      </div>
    </div>
  );
};

export default BatesDessertCheckout;