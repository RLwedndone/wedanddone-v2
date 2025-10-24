// src/components/floral/FloralCheckOut.tsx
import React, { useState, useRef } from "react";
import { Elements } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import CheckoutForm from "../../CheckoutForm";
import { generateFloralAgreementPDF } from "../../utils/generateFloralAgreementPDF";
import { generateFloralAddOnReceiptPDF } from "../../utils/generateFloralAddOnReceiptPDF";
import { uploadPdfBlob } from "../../helpers/firebaseUtils";
import { getAuth } from "firebase/auth";
import {
  doc,
  getDoc,
  updateDoc,
  arrayUnion,
  increment,
  serverTimestamp,   // 👈 add this
} from "firebase/firestore";
import { db } from "../../firebase/firebaseConfig";
import emailjs from "@emailjs/browser";

// helper – round to cents (kept for parity if needed later)
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

emailjs.init(import.meta.env.VITE_EMAILJS_PUBLIC_KEY);

interface FloralCheckOutProps {
  onClose: () => void;
  isAddon?: boolean;
  total: number;                 // GRAND total incl. taxes/fees
  depositAmount: number;         // legacy prop; we’ll prefer computed 25% if missing
  payFull: boolean;              // pay in full vs deposit
  paymentSummary: string;        // optional custom text
  signatureImage: string;
  onSuccess: () => void;         // used to advance to thank-you
  setStepSuccess?: () => void;

  // required:
  firstName: string;
  lastName: string;
  weddingDate: string;           // YYYY-MM-DD
  lineItems: string[];
  uid: string;
}

const stripePromise = loadStripe(
  "pk_test_51Kh0qWD48xRO93UMFwIMguVpNpuICcWmVvZkD1YvK7naYFwLlhhiFtSU5requdOcmj1lKPiR0I0GhFgEAIhUVENZ00vFo6yI20"
);

const FloralCheckOut: React.FC<FloralCheckOutProps> = ({
  onClose,
  isAddon = false,
  total,
  depositAmount,
  payFull,
  paymentSummary,
  signatureImage,
  onSuccess,
  setStepSuccess, // passthrough to CheckoutForm if you prefer
  firstName,
  lastName,
  weddingDate,
  lineItems,
  uid,
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // ─────────────────────────────────────────────────────────────
  // Payment policy: 25% now (buffer), remaining due 30 days before wedding
  // ─────────────────────────────────────────────────────────────
  const DEPOSIT_PCT = 0.25;

  const parsedWedding = weddingDate ? new Date(`${weddingDate}T12:00:00`) : null;
  const finalDueDate = parsedWedding
    ? new Date(parsedWedding.getTime() - 30 * 24 * 60 * 60 * 1000)
    : null;

  const computedDeposit = Math.min(
    total,
    Math.round(total * DEPOSIT_PCT * 100) / 100
  );

  // Prefer incoming deposit prop if valid, otherwise compute 25%
  const effectiveDeposit =
    Number.isFinite(depositAmount) && depositAmount > 0
      ? depositAmount
      : computedDeposit;

  const amountDueToday = payFull ? total : effectiveDeposit;
  const remainingBalance = Math.max(
    0,
    Math.round((total - amountDueToday) * 100) / 100
  );

  const finalDueDateStr = finalDueDate
    ? finalDueDate.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "30 days before your wedding date";

  // ─────────────────────────────────────────────────────────────
  // Handle success from Stripe (now accepts optional { customerId })
  // ─────────────────────────────────────────────────────────────
  // Accept the customerId coming from CheckoutForm
const handleSuccess = async ({ customerId }: { customerId?: string } = {}) => {
  console.log("💳 Payment successful!");

  const auth = getAuth();
  const user = auth.currentUser;
  if (!user) return;

  const userRef = doc(db, "users", user.uid);
  const userSnap = await getDoc(userRef);
  const userDoc = userSnap.data() || {};

  // ✅ Persist Stripe customer id if we got one (and don’t already have it)
  try {
    const existingId = userDoc?.stripeCustomerId as string | undefined;
    if (customerId && customerId !== existingId) {
      await updateDoc(userRef, {
        stripeCustomerId: customerId,
        "stripe.updatedAt": serverTimestamp(),
      });
      try {
        localStorage.setItem("stripeCustomerId", customerId);
      } catch {}
      console.log("✅ Saved stripeCustomerId to Firestore.");
    }
  } catch (e) {
    console.warn("⚠️ Could not save stripeCustomerId:", e);
  }

  // 🔑 Ensure a default payment method is attached for off-session charges
try {
  await fetch(
    "https://us-central1-wedndonev2.cloudfunctions.net/stripeApi/ensure-default-payment-method",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerId: customerId || localStorage.getItem("stripeCustomerId"),
        firebaseUid: user.uid,
      }),
    }
  );
  console.log("✅ Ensured default payment method for floral customer");
} catch (err) {
  console.error("❌ Failed to ensure default payment method:", err);
}

  const safeFirst = userDoc?.firstName || firstName || "Magic";
  const safeLast  = userDoc?.lastName || lastName  || "User";
  const fullName  = `${safeFirst} ${safeLast}`;
  const purchaseDate = new Date().toLocaleDateString("en-US");

    const sendAdminPDFAlert = async (url: string, title: string) => {
      try {
        await emailjs.send("service_xayel1i", "template_nvsea3z", {
          user_name: fullName,
          user_email: userDoc?.email || "unknown@wedndone.com",
          wedding_date: weddingDate || "TBD",
          total: total.toFixed(2),
          line_items: (lineItems || []).join(", "),
          pdf_url: url,
          pdf_title: title,
          // nice-to-have extra fields if your template accommodates them:
          payment_now: amountDueToday.toFixed(2),
          remaining_balance: remainingBalance.toFixed(2),
          final_due: finalDueDateStr,
        });
        console.log("✅ Admin email sent successfully!");
      } catch (err) {
        console.error("❌ Failed to send admin email:", err);
      }
    };

    // First second of a given local Date in UTC (safe for cron/robot)
const asStartOfDayUTC = (d: Date) =>
  new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 1));

// First charge ≈ one month after booking, same day-of-month when possible.
// If the next month is shorter (e.g., booking on 31st), clamp to the last day.
function nextApproxMonthUTC(from: Date): string {
  const y = from.getUTCFullYear();
  const m = from.getUTCMonth();
  const d = from.getUTCDate();
  const target = new Date(Date.UTC(y, m + 1, 1, 0, 0, 1)); // next month, day 1, 00:00:01 UTC
  const lastDayNextMonth = new Date(Date.UTC(y, m + 2, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, lastDayNextMonth));
  return target.toISOString();
}

// Whole months between two UTC dates; count partial last month as 1
function monthsBetweenInclusive(from: Date, to: Date) {
  const a = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), 1));
  const b = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), 1));
  let months = (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth());
  if (to.getUTCDate() >= from.getUTCDate()) months += 1;
  return Math.max(1, months);
}

    // ---------- Add-on flow ----------
    if (isAddon) {
      console.log("💐 Add-on mode — generating floral add-on receipt…");
      setIsGenerating(true);

      try {
        const blob = await generateFloralAddOnReceiptPDF({
          fullName,
          lineItems,
          total,
          purchaseDate,
        });

        const fileName = `FloralAddOnReceipt_${Date.now()}.pdf`;
        const filePath = `public_docs/${user.uid}/${fileName}`;
        const url = await uploadPdfBlob(blob, filePath);
        console.log("✅ Add-on receipt uploaded:", url);

        await updateDoc(userRef, {
          documents: arrayUnion({
            title: "Floral Add-On Receipt",
            url,
            uploadedAt: new Date().toISOString(),
          }),
          purchases: arrayUnion({
            label: "floral_addon",
            amount: Number(total.toFixed(2)),
            date: new Date().toISOString(),
          }),
          spendTotal: increment(Number(total.toFixed(2))),
          "bookings.floral": true, // ensure flag remains true
          "bookings.updatedAt": new Date().toISOString(),
        });

        // notify admin
        try {
          await emailjs.send("service_xayel1i", "template_nvsea3z", {
            user_name: fullName,
            user_email: userDoc?.email || "unknown@wedndone.com",
            wedding_date: weddingDate || "TBD",
            total: total.toFixed(2),
            line_items: (lineItems || []).join(", "),
            pdf_url: url,
            pdf_title: "Floral Add-On Receipt",
          });
          console.log("✅ Admin email (add-on) sent");
        } catch (mailErr) {
          console.error("❌ EmailJS add-on mail failed:", mailErr);
        }

        // nudge UI to re-pull docs/flags
        window.dispatchEvent(new Event("purchaseMade"));
        window.dispatchEvent(new Event("documentsUpdated"));
        window.dispatchEvent(new Event("floralCompletedNow"));

        setIsGenerating(false);
        onSuccess(); // will show the upgrade thank-you
        return;
      } catch (err) {
        console.error("❌ Error during floral add-on receipt:", err);
        setIsGenerating(false);
        return;
      }
    }

    // ---------- Full contract flow ----------
    console.log("📝 Generating Floral Agreement PDF…");
    setIsGenerating(true);

    try {
      const blob = await generateFloralAgreementPDF({
        firstName: userDoc?.firstName || firstName || "Magic",
        lastName: userDoc?.lastName || lastName || "User",
        total,
        deposit: payFull ? 0 : amountDueToday,     // match generator’s field
        payFull,
        monthlyAmount: payFull ? 0 : remainingBalance, // not truly monthly now, just remaining
        paymentSummary: paymentSummary || "",
        weddingDate,
        signatureImageUrl: signatureImage || "",
        lineItems: lineItems || [],
      });

      const fileName = `FloralAgreement_${Date.now()}.pdf`;
      const filePath = `public_docs/${user.uid}/${fileName}`;
      const url = await uploadPdfBlob(blob, filePath);

      await updateDoc(userRef, {
        "bookings.floral": true,
        floralSigned: true,
        floralPdfUrl: url,
        weddingDateLocked: true,
        documents: arrayUnion({
          title: "Floral Agreement",
          url,
          uploadedAt: new Date().toISOString(),
        }),
        // record what was actually charged NOW
        purchases: arrayUnion({
          label: "floral",
          amount: Number(amountDueToday.toFixed(2)),
          date: new Date().toISOString(),
          method: payFull ? "full" : "deposit",
        }),
        spendTotal: increment(Number(amountDueToday.toFixed(2))),
        // persist a friendly + machine-readable payment plan snapshot
        paymentPlan: payFull
          ? {
              product: "floral",
              type: "full",
              total,
              paidNow: total,
              remainingBalance: 0,
              finalDueDate: null,
              finalDueAt: null,
              depositPercent: 1,
              createdAt: new Date().toISOString(),
            }
          : {
              product: "floral",
              type: "deposit",
              total,
              depositPercent: DEPOSIT_PCT,
              paidNow: amountDueToday,
              remainingBalance,
              finalDueDate: finalDueDateStr, // human
              finalDueAt: finalDueDate?.toISOString() ?? null, // machine
              createdAt: new Date().toISOString(),
            },
      
        // 👇 Robot snapshot for auto-billing — monthly until the final due date
paymentPlanAuto: payFull
? {
    version: 1,
    product: "floral",
    status: "complete",                 // nothing left to charge
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
      customerId || localStorage.getItem("stripeCustomerId") || null,

    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
: (() => {
    // First auto-charge ~one month after booking (UTC), then monthly until finalDueDate
    const nowUTC = new Date();
    const firstChargeAtISO = nextApproxMonthUTC(nowUTC);
    const firstChargeAt = new Date(firstChargeAtISO);

    const finalISO = finalDueDate ? asStartOfDayUTC(finalDueDate).toISOString() : null;

    // How many installments from first charge through the final-due month?
    const planMonths = finalDueDate ? monthsBetweenInclusive(firstChargeAt, finalDueDate) : 1;

    const remainingCentsTotal = Math.round(remainingBalance * 100);
    const perMonthCents = Math.floor(remainingCentsTotal / planMonths);
    const lastPaymentCents =
      remainingCentsTotal - perMonthCents * Math.max(0, planMonths - 1);

    return {
      version: 1,
      product: "floral",
      status: "active",
      strategy: "monthly_until_final",
      currency: "usd",

      totalCents: Math.round(total * 100),
      depositCents: Math.round(amountDueToday * 100),
      remainingCents: remainingCentsTotal,

      planMonths,
      perMonthCents,
      lastPaymentCents,

      nextChargeAt: firstChargeAtISO,        // e.g., 2025-10-05T00:00:01Z
      finalDueAt: finalISO,                  // charge schedule ends by this date

      stripeCustomerId:
        customerId || localStorage.getItem("stripeCustomerId") || null,

      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  })(),
      });

      await sendAdminPDFAlert(url, "Floral Agreement");

      window.dispatchEvent(new Event("purchaseMade"));
      window.dispatchEvent(new Event("floralCompletedNow"));

      setIsGenerating(false);
      onSuccess(); // advance to thank-you
    } catch (error) {
      console.error("❌ Error during floral contract upload:", error);
      setIsGenerating(false);
    }
  };

  return (
    <div className="pixie-card pixie-card--modal">
      {/* 🩷 Pink X Close */}
      <button className="pixie-card__close" onClick={onClose} aria-label="Close">
        <img src="/assets/icons/pink_ex.png" alt="Close" />
      </button>
  
      {/* 🌸 Body */}
      <div className="pixie-card__body">
      {isGenerating ? (
  <div className="px-center" style={{ marginTop: "10px" }}>
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
    {/* Big blue Jenna Sue, centered */}
    <h3 className="px-title" style={{ margin: 0 }}>
      Madge is working her magic… hold tight!
    </h3>
  </div>
) : (
          <>
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
                marginBottom: "8px",
              }}
            >
              Checkout
            </h2>
  
            <p className="px-prose-narrow" style={{ marginBottom: "16px" }}>
              {paymentSummary
                ? paymentSummary
                : payFull
                ? `You're paying $${total.toFixed(2)} today.`
                : `You're paying a $${amountDueToday.toFixed(
                    2
                  )} deposit today. Remaining $${remainingBalance.toFixed(
                    2
                  )} due ${finalDueDateStr}.`}
            </p>
  
            {/* Stripe Elements — comfortably wide */}
            <div className="px-elements">
              <Elements stripe={stripePromise}>
                <CheckoutForm
                  total={amountDueToday}
                  onSuccess={handleSuccess}
                  setStepSuccess={onSuccess}
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
              </Elements>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default FloralCheckOut;