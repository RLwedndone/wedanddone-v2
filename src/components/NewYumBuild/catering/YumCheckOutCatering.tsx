// src/components/NewYumBuild/catering/YumCheckOutCatering.tsx
import React, { useEffect, useState } from "react";
import CheckoutForm from "../../../CheckoutForm";
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
import { db, app } from "../../../firebase/firebaseConfig";
import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL,
} from "firebase/storage";
import generateYumAgreementPDF from "../../../utils/generateYumAgreementPDF";
import { notifyBooking } from "../../../utils/email/email";
import { setAndLockGuestCount } from "../../../utils/guestCountStore";

// 🔹 Santi types
import type { SantiCuisineKey } from "./santisMenuConfig";

// ⏱️ helpers
const round2 = (n: number) =>
  Math.round((n + Number.EPSILON) * 100) / 100;
const toPretty = (d: Date) =>
  d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

// --- helpers used to build the monthly plan snapshot ---
const MS_DAY = 24 * 60 * 60 * 1000;
function monthsBetweenInclusive(from: Date, to: Date) {
  const a = new Date(from.getFullYear(), from.getMonth(), 1);
  const b = new Date(to.getFullYear(), to.getMonth(), 1);
  let months =
    (b.getFullYear() - a.getFullYear()) * 12 +
    (b.getMonth() - a.getMonth());
  if (to.getDate() >= from.getDate()) months += 1;
  return Math.max(1, months);
}

// ----- pricing constants (mirror the cart) -----
const CATERING_BASE_PER_GUEST = 65;
const CATERING_CHARCUTERIE_PER_GUEST = 25;
const SALES_TAX_RATE = 0.086; // 8.6%
const STRIPE_RATE = 0.029; // 2.9%
const STRIPE_FLAT_FEE = 0.3; // $0.30

interface YumCheckOutCateringProps {
  total: number;
  guestCount: number;
  charcuterieCount: number;
  lineItems: string[];
  selectedCuisine: SantiCuisineKey | null;
  addCharcuterie: boolean;
  menuSelections: {
    mains: string[];
    sides: string[];
    salads: string[];
  };
  onBack: () => void; // 👈 still accepted but not rendered (no back from checkout)
  onComplete: () => void;
  onClose: () => void;
  isGenerating: boolean;
}

const YumCheckOutCatering: React.FC<YumCheckOutCateringProps> = ({
  total,
  guestCount,
  charcuterieCount,
  addCharcuterie,
  lineItems,
  selectedCuisine,
  menuSelections,
  onBack, // not used in UI (no Back button at checkout)
  onComplete,
  onClose,
  isGenerating: isGeneratingFromOverlay,
}) => {
  const [localGenerating, setLocalGenerating] = useState(false);
  const isGenerating = localGenerating || isGeneratingFromOverlay;

  // 🔐 payment plan choice saved earlier in contract screen
  const rawPlan =
    localStorage.getItem("yumPaymentPlan") || "full";
  const paymentPlan = (rawPlan === "deposit"
    ? "monthly"
    : rawPlan) as "full" | "monthly";

  // 📅 wedding date loading (Firestore → localStorage)
  const [weddingDate, setWeddingDate] = useState<string | null>(null);
  const [firstName, setFirstName] = useState<string>("Magic");
  const [lastName, setLastName] = useState<string>("User");

  useEffect(() => {
    (async () => {
      const auth = getAuth();
      const user = auth.currentUser;
      const local = localStorage.getItem("yumSelectedDate");

      if (local) setWeddingDate(local);

      if (user) {
        try {
          const userRef = doc(db, "users", user.uid);
          const snap = await getDoc(userRef);
          const data = snap.data() || {};
          const fsDate =
            data.weddingDate ||
            data.profileData?.weddingDate ||
            null;
          if (fsDate) {
            setWeddingDate(fsDate);
            localStorage.setItem("yumSelectedDate", fsDate);
          }
          setFirstName(data.firstName || firstName);
          setLastName(data.lastName || lastName);
        } catch (e) {
          console.warn("⚠️ Could not fetch user wedding date:", e);
        }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 💳 amounts (25% deposit or full)
  const DEPOSIT_PCT = 0.25;
  const deposit =
    paymentPlan === "monthly"
      ? round2(total * DEPOSIT_PCT)
      : 0;
  const amountDueToday =
    paymentPlan === "monthly"
      ? deposit
      : round2(total);
  const remainingBalance = round2(
    Math.max(0, total - amountDueToday)
  );

  // ⏳ final due = wedding - 35 days
  const finalDueDateStr = (() => {
    if (!weddingDate)
      return "35 days before your wedding date";
    const base = new Date(`${weddingDate}T12:00:00`);
    base.setDate(base.getDate() - 35);
    return toPretty(base);
  })();

  const signatureImageUrl =
    localStorage.getItem("yumSignature") || "";

  // ✅ success handler
  const handleSuccess = async ({ customerId }: { customerId?: string } = {}) => {
    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) return;

    try {
      setLocalGenerating(true);

      const userRef = doc(db, "users", user.uid);
      const snap = await getDoc(userRef);
      const userDoc = snap.data() || {};

      // store Stripe customer id if new
      try {
        if (customerId && customerId !== userDoc?.stripeCustomerId) {
          await updateDoc(userRef, {
            stripeCustomerId: customerId,
            "stripe.updatedAt": serverTimestamp(),
          });
          try {
            localStorage.setItem("stripeCustomerId", customerId);
          } catch {}

          // 🔑 Ensure a default payment method is attached
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
            console.log(
              "✅ Ensured default payment method for",
              customerId
            );
          } catch (err) {
            console.error(
              "❌ Failed to ensure default payment method:",
              err
            );
          }
        }
      } catch (e) {
        console.warn("⚠️ Could not save stripeCustomerId:", e);
      }

      const safeFirst = userDoc?.firstName || firstName || "Magic";
      const safeLast = userDoc?.lastName || lastName || "User";
      const fullName = `${safeFirst} ${safeLast}`;
      const wedding = weddingDate || userDoc?.weddingDate || "TBD";
      const purchaseDate = new Date().toISOString();

      // 🧾 Generate agreement PDF
      const pdfBlob = await generateYumAgreementPDF({
        fullName,
        total,
        deposit,
        guestCount,
        charcuterieCount: addCharcuterie ? guestCount : 0,
        weddingDate: wedding,
        signatureImageUrl,
        paymentSummary:
          paymentPlan === "monthly"
            ? `Deposit today: $${amountDueToday.toFixed(
                2
              )}. Remaining $${remainingBalance.toFixed(
                2
              )} due by ${finalDueDateStr}.`
            : `Paid in full today: $${Number(amountDueToday).toLocaleString(
                undefined,
                {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                }
              )}.`,
        lineItems,
        // 🔹 mains / sides / salads now
        menuSelections,
        // 🔹 optional cuisine type
        cuisineType: selectedCuisine || undefined,
      });

      const storage = getStorage(
        app,
        "gs://wedndonev2.firebasestorage.app"
      );
      const filename = `YumAgreement_${Date.now()}.pdf`;
      const fileRef = ref(
        storage,
        `public_docs/${user.uid}/${filename}`
      );
      await uploadBytes(fileRef, pdfBlob);
      const publicUrl = await getDownloadURL(fileRef);

      // --------------------------------------------------------------------
      // (1) Freeze a catering pricing snapshot for GuestListScroll math
      // --------------------------------------------------------------------
      await setDoc(
        doc(userRef, "pricingSnapshots", "catering"),
        {
          booked: true,
          guestCountAtBooking: guestCount,
          perGuest: CATERING_BASE_PER_GUEST,
          charcuterieSelected: !!addCharcuterie,
          charcuteriePerGuest: CATERING_CHARCUTERIE_PER_GUEST,
          salesTaxRate: SALES_TAX_RATE,
          stripeRate: STRIPE_RATE,
          stripeFlatFee: STRIPE_FLAT_FEE,
          cuisine: selectedCuisine ?? null,
          lineItems: lineItems || [],
          totalBooked: total,
          paymentPlan,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );

      // --------------------------------------------------------------------
      // (2) Build an auto-billing snapshot (used by the billing robot)
      // --------------------------------------------------------------------
      const now = new Date();

      const finalDueAtDate = (() => {
        if (!weddingDate) return null;
        const d = new Date(`${weddingDate}T12:00:00`);
        d.setDate(d.getDate() - 35);
        return d;
      })();

      let planMonths = 1;
      let perMonthCents = 0;
      let lastPaymentCents = 0;
      if (paymentPlan === "monthly" && finalDueAtDate) {
        const months = monthsBetweenInclusive(now, finalDueAtDate);
        const remainingCents = Math.round(remainingBalance * 100);
        const base = Math.floor(remainingCents / months);
        const tail = remainingCents - base * Math.max(0, months - 1);
        planMonths = months;
        perMonthCents = base;
        lastPaymentCents = tail;
      }

      function firstOfNextMonthUTC(from = new Date()): string {
        const y = from.getUTCFullYear();
        const m = from.getUTCMonth();
        const d = new Date(Date.UTC(y, m + 1, 1, 0, 0, 1));
        return d.toISOString();
      }

      const nextChargeAt =
        paymentPlan === "monthly" ? firstOfNextMonthUTC(now) : null;

      const purchaseEntry = {
        label: "Yum Yum Catering",
        category: "catering",
        boutique: "catering",
        source: "W&D",
        amount: Number(amountDueToday.toFixed(2)), // charged now
        amountChargedToday: Number(amountDueToday.toFixed(2)),
        contractTotal: Number(total.toFixed(2)), // full commitment
        payFull: paymentPlan !== "monthly",
        deposit:
          paymentPlan === "monthly"
            ? Number(amountDueToday.toFixed(2))
            : Number(total.toFixed(2)),
        monthlyAmount:
          paymentPlan === "monthly"
            ? Number((perMonthCents / 100).toFixed(2))
            : 0,
        months: paymentPlan === "monthly" ? planMonths : 0,
        method: paymentPlan === "monthly" ? "deposit" : "full",
        items: lineItems || [],
        date: purchaseDate,
      };

      await updateDoc(userRef, {
        documents: arrayUnion({
          title: "Yum Yum Catering Agreement",
          url: publicUrl,
          uploadedAt: new Date().toISOString(),
        }),

        "bookings.catering": true,
        weddingDateLocked: true,

        purchases: arrayUnion(purchaseEntry),

        spendTotal: increment(
          Number(amountDueToday.toFixed(2))
        ),

        // (A) UI snapshot
        paymentPlan:
          paymentPlan === "monthly"
            ? {
                product: "yum",
                type: "deposit",
                total,
                depositPercent: DEPOSIT_PCT,
                paidNow: amountDueToday,
                remainingBalance,
                finalDueDate: finalDueDateStr,
                finalDueAt: finalDueAtDate
                  ? finalDueAtDate.toISOString()
                  : null,
                createdAt: new Date().toISOString(),
              }
            : {
                product: "yum",
                type: "full",
                total,
                paidNow: total,
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

                totalCents: Math.round(total * 100),
                depositCents: Math.round(amountDueToday * 100),
                remainingCents: Math.round(
                  remainingBalance * 100
                ),

                planMonths,
                perMonthCents,
                lastPaymentCents,
                nextChargeAt,
                finalDueAt: finalDueAtDate
                  ? finalDueAtDate.toISOString()
                  : null,

                stripeCustomerId:
                  customerId ||
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

                totalCents: Math.round(total * 100),
                depositCents: Math.round(total * 100),
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
              },
      });

      // ✅ guest fallback + live UI refresh
      try {
        localStorage.setItem("yumBookedCatering", "true");
      } catch {}
      window.dispatchEvent(new Event("cateringCompletedNow"));
      window.dispatchEvent(new Event("purchaseMade"));

      // 🔒 Lock guest count for Yum Catering (NoVenue support)
      try {
        await setAndLockGuestCount(guestCount || 0, "yum:catering");
      } catch (e) {
        console.warn("⚠️ Could not lock guest count for catering:", e);
      }

      // 📧 Email receipt / alert (centralized)
      try {
        const current = getAuth().currentUser;
        await notifyBooking("yum_catering", {
          user_email: current?.email || "unknown@wedndone.com",
          user_full_name: fullName,
          firstName: safeFirst,
          wedding_date: wedding,

          pdf_url: publicUrl,
          pdf_title: "Yum Yum Catering Agreement",

          total: total.toFixed(2),
          line_items: (lineItems || []).join(", "),
          payment_now: amountDueToday.toFixed(2),
          remaining_balance: remainingBalance.toFixed(2),
          final_due: finalDueDateStr,

          dashboardUrl: `${window.location.origin}${import.meta.env.BASE_URL}dashboard`,
          product_name: "Yum Yum Catering",
        });
      } catch (mailErr) {
        console.error("❌ notifyBooking failed:", mailErr);
      }

      onComplete();
    } catch (err) {
      console.error("❌ Catering finalize error:", err);
      setLocalGenerating(false);
    }
  };

  const summaryText =
    paymentPlan === "monthly"
      ? `Deposit due today: $${amountDueToday.toFixed(
          2
        )} (25%). Remaining $${remainingBalance.toFixed(
          2
        )} due by ${finalDueDateStr}.`
      : `Total due today: $${Number(amountDueToday).toLocaleString(
          undefined,
          { minimumFractionDigits: 2, maximumFractionDigits: 2 }
        )}.`;

  // 🔮 MAGIC-IN-PROGRESS / CHECKOUT CARD
  return (
    <div
      className="pixie-card pixie-card--modal"
      style={{
        ["--pixie-card-w" as any]: isGenerating ? "520px" : "680px",
        ["--pixie-card-min-h" as any]: isGenerating ? "360px" : "520px",
      }}
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

      {/* Body */}
      <div className="pixie-card__body">
        {isGenerating ? (
          <div
            className="px-center"
            style={{
              marginTop: 10,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
            }}
          >
            <video
              src={`${import.meta.env.BASE_URL}assets/videos/magic_clock.mp4`}
              autoPlay
              loop
              muted
              playsInline
              style={{
                width: "100%",
                maxWidth: 300,
                borderRadius: 12,
                margin: "0 auto 14px",
                display: "block",
                objectFit: "contain",
              }}
            />
            <h3
              className="px-title"
              style={{
                fontFamily: "'Jenna Sue', cursive",
                color: "#2c62ba",
                fontSize: "1.6rem",
                textAlign: "center",
                margin: 0,
              }}
            >
              Madge is working her magic… hold tight!
            </h3>
          </div>
        ) : (
          <>
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

            <div className="px-elements">
              <CheckoutForm
                total={amountDueToday}
                onSuccess={handleSuccess}
                setStepSuccess={onComplete}
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

            {/* 🔕 No Back button at checkout per UX rule */}
          </>
        )}
      </div>
    </div>
  );
};

export default YumCheckOutCatering;