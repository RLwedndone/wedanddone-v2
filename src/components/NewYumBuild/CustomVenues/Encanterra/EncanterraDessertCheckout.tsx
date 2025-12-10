// src/components/NewYumBuild/CustomVenues/Encanterra/EncanterraDessertCheckout.tsx
import React, { useState, useEffect, useRef } from "react";
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

// Saved-card summary type
type SavedCardSummary = {
  brand: string;
  last4: string;
  exp_month: number;
  exp_year: number;
};

// Props
interface EncanterraDessertCheckoutProps {
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
  setStep: (step: any) => void; // overlay type kept generic
  bookings?: { catering?: boolean; dessert?: boolean };
}

const EncanterraDessertCheckout: React.FC<
  EncanterraDessertCheckoutProps
> = ({
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

  // We'll also mirror Firestore first/last name for CheckoutForm label
  const [checkoutName, setCheckoutName] = useState("Magic User");

  // Saved-card state (mirrors Encanterra catering checkout)
  const [savedCardSummary, setSavedCardSummary] =
    useState<SavedCardSummary | null>(null);
  const [hasSavedCard, setHasSavedCard] = useState(false);
  const [mode, setMode] = useState<"saved" | "new">("saved");

  useEffect(() => {
    // Grab best-guess display name + any saved card ASAP
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

        // Try to hydrate saved card summary from Firestore stripe snapshot
        const stripeCard =
          data?.stripe?.defaultPaymentMethod ||
          data?.stripe?.cardOnFile ||
          null;

        if (
          stripeCard &&
          stripeCard.brand &&
          stripeCard.last4 &&
          stripeCard.exp_month &&
          stripeCard.exp_year
        ) {
          setSavedCardSummary({
            brand: stripeCard.brand,
            last4: stripeCard.last4,
            exp_month: stripeCard.exp_month,
            exp_year: stripeCard.exp_year,
          });
          setHasSavedCard(true);
          setMode("saved");
        } else {
          setHasSavedCard(false);
          setMode("new");
        }
      } catch {
        // fallback stays "Magic User" and no saved card
        setHasSavedCard(false);
        setMode("new");
      }
    })();
  }, []);

  // Plan selections saved on the contract screen
  const DEPOSIT_PCT = 0.25;

  const totalEffective = round2(
    Number(localStorage.getItem("yumTotal")) ||
      Number(total) ||
      0
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
    (Number(localStorage.getItem("yumPerMonthCents")) || 0) /
    100;

  const finalDuePretty =
    localStorage.getItem("yumFinalDuePretty") ||
    "35 days before your wedding date";

  // What we actually charge right now
  const amountDueToday = usingFull
    ? totalEffective
    : depositAmount;

  // UI copy
  const paymentMessage = usingFull
    ? `You're paying $${Number(amountDueToday).toLocaleString(undefined,{
        minimumFractionDigits:2,
        maximumFractionDigits:2
      })} today.`
    : `You're paying $${amountDueToday.toFixed(
        2
      )} today, then ${planMonths} monthly payments of about $${perMonth.toFixed(
        2
      )} (final due ${finalDuePretty}).`;

  // Success → finalize, upload PDF, route to Encanterra TY
  const handleSuccess = async ({
    customerId,
  }: { customerId?: string } = {}): Promise<void> => {
    if (didRunRef.current) {
      console.warn(
        "[EncanterraDessertCheckout] handleSuccess already ran — ignoring re-entry"
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
      const userDoc = snap.exists()
        ? (snap.data() as any)
        : {};
      const safeFirst = userDoc?.firstName || "Magic";
      const safeLast = userDoc?.lastName || "User";
      const fullName = `${safeFirst} ${safeLast}`;
      const weddingYMD: string | null =
        userDoc?.weddingDate || null;

      // 🔐 Store Stripe customer id if new
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
        console.warn(
          "⚠️ Could not save stripeCustomerId (dessert_encanterra):",
          e
        );
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

      if (
        !usingFull &&
        finalDueDate &&
        remainingBalance > 0
      ) {
        mths = monthsBetweenInclusive(
          new Date(),
          finalDueDate
        );
        const remainingCents = Math.round(
          remainingBalance * 100
        );
        const base = Math.floor(
          remainingCents / Math.max(1, mths)
        );
        const tail =
          remainingCents -
          base * Math.max(0, mths - 1);
        perMonthCents = base;
        lastPaymentCents = tail;
        nextChargeAtISO = firstMonthlyChargeAtUTC(
          new Date()
        );
      }

      // 🔹 Basic totals / snapshot for this dessert booking
      const contractTotal = round2(totalEffective);
      const amountChargedToday = round2(amountDueToday);

      // 🔹 Purchases entry (matches NoVenue + Bates patterns)
      const purchaseEntry = {
        label: "Yum Yum Desserts",
        category: "dessert",
        boutique: "dessert",
        source: "W&D",
        amount: amountChargedToday,
        amountChargedToday,
        contractTotal,
        payFull: usingFull,
        deposit: usingFull ? 0 : amountChargedToday,
        monthlyAmount: usingFull ? 0 : +perMonth.toFixed(2),
        months: usingFull ? 0 : mths,
        method: usingFull ? "paid_in_full" : "deposit",
        items: lineItems,
        date: new Date().toISOString(),
      };

      // 🔹 Mark dessert booked + base flags
      await setDoc(
        userRef,
        {
          bookings: {
            ...(userDoc?.bookings || {}),
            dessert: true,
          },
          encanterraDessertsBooked: true,
          weddingDateLocked: true,
          yumDessertStyle: selectedStyle,
          yumDessertFlavorCombo: selectedFlavorCombo,
          yumDessertGuestCount: guestCount,
          lastPurchaseAt: serverTimestamp(),
        },
        { merge: true }
      );

      // 🔹 Signature image
      const signatureImageUrl =
        signatureImage ||
        localStorage.getItem("yumSignature") ||
        "";

      // 🔹 Build the Dessert Agreement PDF
      const pdfBlob = await generateDessertAgreementPDF({
        fullName,
        total: contractTotal,
        deposit: amountChargedToday,
        guestCount,
        weddingDate: weddingYMD || "TBD",
        signatureImageUrl,
        paymentSummary:
          paymentSummaryText ||
          (usingFull
            ? `You're paying $${Number(
                amountChargedToday
              ).toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })} today.`
            : `You're paying $${amountChargedToday.toFixed(
                2
              )} today, then ${mths} monthly payments of about $${(
                perMonthCents / 100
              ).toFixed(2)} (final due ${finalDueDateStr}).`),
        selectedStyle,
        selectedFlavorCombo,
        lineItems,
      });

      // 🔹 Upload PDF
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

      // 🔹 Robot billing snapshot + docs + dessert totals
      await updateDoc(userRef, {
        // PDF list
        documents: arrayUnion({
          title: "Yum Yum Dessert Agreement",
          url: publicUrl,
          uploadedAt: new Date().toISOString(),
        }),

        // Rich purchase entry
        purchases: arrayUnion(purchaseEntry),

        // Overall spend
        spendTotal: increment(amountChargedToday),

        // ✅ Normalized dessert totals for Guest Scroll + admin
        "totals.dessert.contractTotal": contractTotal,
        "totals.dessert.amountPaid": increment(amountChargedToday),
        "totals.dessert.guestCountAtBooking": guestCount,
        "totals.dessert.perGuest":
          guestCount > 0
            ? round2(contractTotal / guestCount)
            : 0,
        "totals.dessert.venueSlug": "encanterra",
        "totals.dessert.style": selectedStyle || null,
        "totals.dessert.flavorCombo": selectedFlavorCombo || null,
        "totals.dessert.lastUpdatedAt": new Date().toISOString(),

        // Payment plan snapshot (for Stripe auto-pay logic)
        paymentPlan: {
          product: "dessert_encanterra",
          type: usingFull ? "paid_in_full" : "deposit",
          total: contractTotal,
          depositPercent: usingFull ? 1 : 0.25,
          paidNow: amountChargedToday,
          remainingBalance: usingFull ? 0 : remainingBalance,
          finalDueDate: finalDueDateStr,
          finalDueAt: finalDueISO,
          createdAt: new Date().toISOString(),
        },

        paymentPlanAuto: {
          version: 1,
          product: "dessert_encanterra",
          status: usingFull
            ? "complete"
            : remainingBalance > 0
            ? "active"
            : "complete",
          strategy: usingFull
            ? "paid_in_full"
            : "monthly_until_final",
          currency: "usd",

          totalCents: Math.round(contractTotal * 100),
          depositCents: usingFull
            ? Math.round(contractTotal * 100)
            : Math.round(amountChargedToday * 100),
          remainingCents: usingFull
            ? 0
            : Math.round(remainingBalance * 100),

          planMonths: usingFull ? 0 : mths,
          perMonthCents: usingFull ? 0 : perMonthCents,
          lastPaymentCents: usingFull ? 0 : lastPaymentCents,

          nextChargeAt: usingFull ? null : nextChargeAtISO,
          finalDueAt: finalDueISO,

          stripeCustomerId:
            customerId ||
            localStorage.getItem("stripeCustomerId") ||
            null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },

        // Correct overlay progress for Encanterra desserts
        "progress.yumYum.step": "encanterraDessertThankYou",
      });

      // 📧 Centralized booking email for Yum Desserts @ Encanterra
      try {
        const current = getAuth().currentUser;
        await notifyBooking("yum_dessert", {
          // who + basics
          user_email:
            current?.email ||
            (userDoc as any)?.email ||
            "unknown@wedndone.com",
          user_full_name: fullName,
          firstName: safeFirst,

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
          product_name: "Encanterra Desserts",
        });
      } catch (mailErr) {
        console.error(
          "❌ notifyBooking(yum_dessert) failed:",
          mailErr
        );
      }

      // UI fan-out so dashboards/overlays refresh immediately
      window.dispatchEvent(new Event("purchaseMade"));
      window.dispatchEvent(new Event("dessertCompletedNow"));
      window.dispatchEvent(
        new CustomEvent("bookingsChanged", {
          detail: { dessert: true },
        })
      );

      // Wizard advance — Encanterra Dessert TY (chime plays there)
      const nextStep = "encanterraDessertThankYou";
      try {
        localStorage.setItem("encJustBookedDessert", "true");
        localStorage.setItem("encDessertsBooked", "true");
        localStorage.setItem("encYumStep", nextStep);
        localStorage.setItem("yumStep", nextStep);
      } catch {}

      setStep(nextStep);
    } catch (err) {
      console.error(
        "❌ [Encanterra][DessertCheckout] finalize error:",
        err
      );
    } finally {
      setLocalGenerating(false); // always clear
    }
  };

  // ===================== RENDER =====================

  if (isGenerating) {
    // Spinner view while PDF/Firestore work runs
    return (
      <div className="pixie-card pixie-card--modal" style={{ maxWidth: 700 }}>
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

        <div className="pixie-card__body" style={{ textAlign: "center" }}>
          <video
            src={`${import.meta.env.BASE_URL}assets/videos/magic_clock.mp4`}
            autoPlay
            loop
            muted
            playsInline
            className="px-media"
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
            style={{ margin: 0, color: "#2c62ba" }}
          >
            Madge is icing your cake... one sec!
          </h3>
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

        {/* Saved card toggle + Stripe Card Entry */}
        <div className="px-elements">
          <div
            style={{
              marginBottom: 16,
              padding: "12px 14px",
              borderRadius: 12,
              border: "1px solid #e2e6f0",
              background: "#f7f8ff",
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
                    name="encDessertPaymentMode"
                    checked={mode === "saved"}
                    onChange={() => setMode("saved")}
                  />
                  <span>
                    Saved card on file —{" "}
                    <strong>
                      {savedCardSummary!.brand.toUpperCase()}
                    </strong>{" "}
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
                    name="encDessertPaymentMode"
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
                  cursor: "default",
                }}
              >
                <input type="radio" checked readOnly />
                <span>Enter your card details</span>
              </label>
            )}
          </div>

          <CheckoutForm
            total={amountDueToday}
            onSuccess={handleSuccess}
            // we don't need setStepSuccess here because handleSuccess already drives navigation
            isAddon={false}
            customerEmail={
              getAuth().currentUser?.email || undefined
            }
            customerName={checkoutName}
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
            useSavedCard={hasSavedCard && mode === "saved"}
          />
        </div>
      </div>
    </div>
  );
};

export default EncanterraDessertCheckout;