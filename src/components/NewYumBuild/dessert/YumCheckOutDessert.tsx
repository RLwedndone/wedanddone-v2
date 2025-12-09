// src/components/NewYumBuild/dessert/YumCheckOutDessert.tsx
import React, { useEffect, useRef, useState, useMemo } from "react";
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
import { YumStep } from "../yumTypes";
import { notifyBooking } from "../../../utils/email/email";
import { setAndLockGuestCount } from "../../../utils/guestCountStore";

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
  const didRunRef = useRef(false);

  // pull user name for CheckoutForm display
  const [firstName, setFirstName] = useState("Magic");
  const [lastName, setLastName] = useState("User");
  useEffect(() => {
    (async () => {
      const auth = getAuth();
      const user = auth.currentUser;
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

  // ─────────────────────────────────────────────
  // Resolve effective guest count (prop → localStorage fallbacks)
  // ─────────────────────────────────────────────
  const effectiveGuestCount = useMemo(() => {
    // 1) Trust a non-zero prop first
    if (guestCount && guestCount > 0) return guestCount;

    // 2) Fall back to Yum / global guest-count keys
    try {
      const keys = ["yumDessertGuestCount", "yumGuestCount", "guestCount"] as const;
      for (const key of keys) {
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        const n = Number(raw);
        if (!Number.isNaN(n) && n > 0) return n;
      }
    } catch {
      // ignore LS issues
    }

    // 3) Nothing usable found
    return 0;
  }, [guestCount]);

  // ─────────────────────────────────────────────
  // 25% deposit today → rest until final-due (-35d)
  // (We trust the contract screen's stored values, just like catering)
// ─────────────────────────────────────────────
  const DEPOSIT_PCT = 0.25;

  const totalEffective = round2(
    Number(localStorage.getItem("yumTotal")) || Number(total) || 0
  );

  const rawPlan =
    (localStorage.getItem("yumPaymentPlan") as "full" | "monthly" | null) ||
    (localStorage.getItem("yumPayPlan") as "full" | "monthly" | null) ||
    "full";

  const paymentPlan = rawPlan === "monthly" ? "monthly" : "full";
  const usingFull = paymentPlan === "full";

  // Stored from the contract screen:
  // - For full: depositAmount === totalEffective
  // - For monthly: depositAmount === 25% deposit
  const depositAmount = round2(
    Number(localStorage.getItem("yumDepositAmount")) ||
      (usingFull ? totalEffective : totalEffective * DEPOSIT_PCT)
  );

  const remainingBalance = round2(
    Number(localStorage.getItem("yumRemainingBalance")) ||
      Math.max(0, totalEffective - depositAmount)
  );

  // Optional plan hints saved by contract (used for UI only)
  const storedPlanMonths =
    Number(localStorage.getItem("yumPlanMonths")) || 0;
  const storedPerMonthCents =
    Number(localStorage.getItem("yumPerMonthCents")) || 0;
  const storedPerMonth = storedPerMonthCents / 100;

  const finalDuePrettyFromLS =
    localStorage.getItem("yumFinalDuePretty") ||
    "35 days before your wedding date";

  // What we actually charge right now (Stripe charge for CheckoutForm)
  const amountDueToday = usingFull ? totalEffective : depositAmount;

  // One clear, plan-specific line for the UI
  const paymentMessage = usingFull
    ? `You're paying $${Number(amountDueToday).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })} today.`
    : `You're paying $${amountDueToday.toFixed(
        2
      )} today, then ${storedPlanMonths} monthly payments of about $${storedPerMonth.toFixed(
        2
      )} (final due ${finalDuePrettyFromLS}).`;

  // ─────────────────────────────────────────────
  // Success handler (Stripe success → finalize + PDF + Firestore)
  // ─────────────────────────────────────────────
  const handleSuccess = async ({ customerId }: { customerId?: string } = {}) => {
    if (didRunRef.current) {
      console.warn("[YumCheckOutDessert] handleSuccess already ran — ignoring re-entry");
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

      // 🔐 store Stripe customer id and attach default payment method
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

          // 🔑 Ensure a default payment method is attached for billing robot
          try {
            await fetch(
              "https://us-central1-wedndonev2.cloudfunctions.net/stripeApi/ensure-default-payment-method",
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  customerId,
                  firebaseUid: user.uid,
                }),
              }
            );
            console.log("✅ Ensured default payment method for", customerId);
          } catch (err) {
            console.error(
              "❌ Failed to ensure default payment method for dessert:",
              err
            );
          }
        }
      } catch (e) {
        console.warn("⚠️ Could not save stripeCustomerId (dessert):", e);
      }

      const safeFirst = userDoc?.firstName || firstName || "Magic";
      const safeLast = userDoc?.lastName || lastName || "User";
      const fullName = `${safeFirst} ${safeLast}`;

      const weddingYMD: string | null = userDoc?.weddingDate || null;
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

      // Even monthly plan breakdown (tail gets remainder)
      let derivedPlanMonths = 0;
      let perMonthCents = 0;
      let lastPaymentCents = 0;
      let nextChargeAtISO: string | null = null;

      if (!usingFull && finalDueDate && remainingBalance > 0) {
        derivedPlanMonths = monthsBetweenInclusive(new Date(), finalDueDate);
        const remainingCents = Math.round(remainingBalance * 100);
        const base = Math.floor(
          remainingCents / Math.max(1, derivedPlanMonths)
        );
        const tail = remainingCents - base * Math.max(0, derivedPlanMonths - 1);
        perMonthCents = base;
        lastPaymentCents = tail;
        nextChargeAtISO = firstMonthlyChargeAtUTC(new Date());
      }

      const perMonthDollars = !usingFull
        ? Number((perMonthCents / 100).toFixed(2))
        : 0;

      // ── Firestore: mark booked + snapshot basic dessert data ──
      await setDoc(
        userRef,
        {
          bookings: {
            ...(userDoc?.bookings || {}),
            dessert: true,
          },
          weddingDateLocked: true,
          yumDessertStyle: selectedStyle,
          yumDessertFlavorCombo: selectedFlavorCombo,
          yumDessertGuestCount: effectiveGuestCount,
          lastPurchaseAt: serverTimestamp(),
        },
        { merge: true }
      );

      try {
        localStorage.setItem("yumBookedDessert", "true");
      } catch {
        /* ignore */
      }

      // Fire global events quickly so Budget Wand / dashboard update instantly
      try {
        window.dispatchEvent(new Event("dessertCompletedNow"));
        window.dispatchEvent(new Event("purchaseMade"));
      } catch {
        /* ignore */
      }

      // ── Purchases entry (for spend dashboard & snapshots) ──
      const purchaseEntry = {
        label: "Yum Yum Desserts",
        category: "dessert",
        boutique: "dessert",
        source: "W&D",
        amount: Number(amountDueToday.toFixed(2)), // charged now
        amountChargedToday: Number(amountDueToday.toFixed(2)),
        contractTotal: Number(totalEffective.toFixed(2)), // full commitment
        payFull: paymentPlan !== "monthly",
        deposit:
          paymentPlan === "monthly"
            ? Number(amountDueToday.toFixed(2))
            : Number(totalEffective.toFixed(2)),
        monthlyAmount:
          paymentPlan === "monthly" ? perMonthDollars : 0,
        months: paymentPlan === "monthly" ? derivedPlanMonths : 0,
        method: paymentPlan === "monthly" ? "deposit" : "full",
        items: lineItems,
        date: new Date().toISOString(),
      };

      await updateDoc(userRef, {
        purchases: arrayUnion(purchaseEntry),

        // spendTotal reflects what hit the card today
        spendTotal: increment(Number(amountDueToday.toFixed(2))),

        // (A) UI snapshot (mirrors catering structure)
        paymentPlan:
          paymentPlan === "monthly"
            ? {
                product: "yum",
                type: "deposit",
                total: totalEffective,
                depositPercent: DEPOSIT_PCT,
                paidNow: amountDueToday,
                remainingBalance,
                finalDueDate: finalDueDateStr,
                finalDueAt: finalDueISO,
                createdAt: new Date().toISOString(),
              }
            : {
                product: "yum",
                type: "full",
                total: totalEffective,
                paidNow: totalEffective,
                remainingBalance: 0,
                finalDueDate: null,
                finalDueAt: null,
                depositPercent: 1,
                createdAt: new Date().toISOString(),
              },

        // (B) snapshot for billing robot
        paymentPlanAuto:
          paymentPlan === "monthly"
            ? {
                version: 1,
                product: "yum",
                status: "active",
                strategy: "monthly_until_final",
                currency: "usd",

                totalCents: Math.round(totalEffective * 100),
                depositCents: Math.round(amountDueToday * 100),
                remainingCents: Math.round(remainingBalance * 100),

                planMonths: derivedPlanMonths,
                perMonthCents,
                lastPaymentCents,
                nextChargeAt: nextChargeAtISO,
                finalDueAt: finalDueISO,

                stripeCustomerId:
                  customerId ||
                  userDoc?.stripeCustomerId ||
                  localStorage.getItem("stripeCustomerId") ||
                  null,

                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              }
            : {
                version: 1,
                product: "yum",
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
                  userDoc?.stripeCustomerId ||
                  localStorage.getItem("stripeCustomerId") ||
                  null,

                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              },

        // Route them to the correct Thank You based on whether catering is already booked
        "progress.yumYum.step": bookings.catering
          ? "thankyouBoth"
          : "thankyouDessertOnly",
      });

      // 🔹 Dessert pricing snapshot for guest-count delta math
      await setDoc(
        doc(userRef, "pricingSnapshots", "dessert"),
        {
          booked: true,
          guestCountAtBooking: effectiveGuestCount,
          totalBooked: Number(totalEffective.toFixed(2)),
          perGuest:
            effectiveGuestCount > 0
              ? Number((totalEffective / effectiveGuestCount).toFixed(2))
              : 0,

          // helpful metadata for debugging / display
          venueId: "noVenue",
          style: selectedStyle || null,
          flavorCombo: selectedFlavorCombo || null,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );

      // ── Build + upload PDF agreement ──
      const signatureImageUrl =
        signatureImage ||
        localStorage.getItem("yumSignature") ||
        "";

        const pdfBlob = await generateDessertAgreementPDF({
          fullName,
          total: totalEffective,
          deposit: usingFull ? totalEffective : amountDueToday,
          guestCount: effectiveGuestCount,
          weddingDate: weddingYMD || "TBD",
          signatureImageUrl,
          paymentSummary:
            paymentSummaryText ||
            (usingFull
              ? `Paid in full today: $${amountDueToday.toFixed(
                  2
                )}. No remaining balance is owed for this dessert agreement.`
              : `Deposit of $${amountDueToday.toFixed(
                  2
                )} paid today. Remaining balance of $${remainingBalance.toFixed(
                  2
                )} will be charged in ${
                  storedPlanMonths || derivedPlanMonths
                } monthly installments of about $${(
                  (storedPerMonth || perMonthDollars)
                ).toFixed(2)}, with the final payment due ${
                  finalDuePrettyFromLS || finalDueDateStr
                }.`),
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

      // 🔒 Lock guest count for Yum Desserts (NoVenue support)
      try {
        await setAndLockGuestCount(effectiveGuestCount || 0, "yum:dessert");
      } catch (e) {
        console.warn("⚠️ Could not lock guest count for dessert:", e);
      }

      // 📧 User + Admin emails (centralized; non-blocking)
      try {
        const current = getAuth().currentUser;
        await notifyBooking("yum_dessert", {
          user_email: current?.email || "unknown@wedndone.com",
          user_full_name: fullName,
          firstName: safeFirst,
          wedding_date: weddingYMD || "TBD",

          pdf_url: publicUrl,
          pdf_title: "Yum Yum Dessert Agreement",

          total: totalEffective.toFixed(2),
          line_items: (lineItems || []).join(", "),
          payment_now: amountDueToday.toFixed(2),
          remaining_balance: remainingBalance.toFixed(2),
          final_due: finalDueDateStr,

          dashboardUrl: `${window.location.origin}${import.meta.env.BASE_URL}dashboard`,
          product_name: "Yum Yum Desserts",
        });
      } catch (e) {
        console.warn("notifyBooking (dessert) failed (continuing):", e);
      }

      // ── Wizard advance & persist yumStep ──
      const nextStep = (bookings.catering
        ? "thankyouBoth"
        : "thankyouDessertOnly") as YumStep;

      try {
        localStorage.setItem("yumStep", nextStep);
      } catch {
        /* ignore */
      }

      setStep(nextStep);
      onComplete();
    } catch (err) {
      console.error("❌ Dessert finalize error:", err);
      // leave them on screen to retry
    } finally {
      setLocalGenerating(false); // always clear spinner
    }
  };

  // ===================== RENDER =====================

  // Spinner state (while finalizing after Stripe)
  if (isGenerating) {
    return (
      <div className="pixie-card pixie-card--modal" style={{ maxWidth: 700 }}>
        {/* 🩷 Pink X Close */}
        <button className="pixie-card__close" onClick={onClose} aria-label="Close">
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
          <h3 className="px-title" style={{ margin: 0, color: "#2c62ba" }}>
            Madge is icing your cake... one sec!
          </h3>

          <div style={{ marginTop: 12 }}>
            <button
              className="boutique-back-btn"
              style={{ width: 250 }}
              onClick={onBack}
              disabled
            >
              ← Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Normal checkout card
  return (
    <div className="pixie-card pixie-card--modal" style={{ maxWidth: 700 }}>
      {/* 🩷 Pink X Close */}
      <button className="pixie-card__close" onClick={onClose} aria-label="Close">
        <img
          src={`${import.meta.env.BASE_URL}assets/icons/pink_ex.png`}
          alt="Close"
        />
      </button>

      <div className="pixie-card__body" style={{ textAlign: "center" }}>
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
          style={{ marginBottom: 16, textAlign: "center" }}
        >
          {paymentMessage}
        </p>

        {/* Stripe form */}
        <div className="px-elements" aria-busy={isGenerating}>
          <CheckoutForm
            total={amountDueToday}
            onSuccess={handleSuccess}
            setStepSuccess={() => {
              /* we advance inside handleSuccess */
            }}
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

        {/* Back */}
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

export default YumCheckOutDessert;