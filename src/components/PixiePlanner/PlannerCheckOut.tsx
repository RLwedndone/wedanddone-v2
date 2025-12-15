// src/components/planner/PlannerCheckOut.tsx
import React, { useState, useRef } from "react";
import { useUser } from "../../contexts/UserContext";
import CheckoutForm from "../../CheckoutForm";
import { generatePlannerAgreementPDF } from "../../utils/generatePlannerAgreementPDF";
import { uploadPdfBlob } from "../../helpers/firebaseUtils";
import { getAuth } from "firebase/auth";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  arrayUnion,
  increment,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../../firebase/firebaseConfig";
import emailjs from "@emailjs/browser";

interface PlannerCheckOutProps {
  onClose: () => void;
  /** optional: go back to the contract screen */
  onBackToContract?: () => void;

  total: number;
  depositAmount: number; // 200 for planner
  payFull: boolean;
  paymentSummary: string;
  signatureImage: string;
  onSuccess: () => void;
  setStepSuccess?: () => void;
  firstName: string;
  lastName: string;
  weddingDate: string;
  guestCount: number;
  dayOfWeek?: string;
  uid: string;
}

// money utils
const toCents = (n: number) => Math.round((Number(n) || 0) * 100);

// helper: first second of that day (UTC) for cron safety
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

const FINAL_DUE_DAYS = 35;

// monthly count inclusive (partial months count as 1)
const monthsBetweenInclusive = (from: Date, to: Date) => {
  const a = new Date(from.getFullYear(), from.getMonth(), 1);
  const b = new Date(to.getFullYear(), to.getMonth(), 1);
  let months =
    (b.getFullYear() - a.getFullYear()) * 12 +
    (b.getMonth() - a.getMonth());
  if (to.getDate() >= from.getDate()) months += 1;
  return Math.max(1, months);
};

// schedule first auto-charge ~ one month after booking, start of day UTC
const firstMonthlyChargeAtUTC = (from = new Date()): string => {
  const y = from.getUTCFullYear();
  const m = from.getUTCMonth();
  const d = from.getUTCDate();
  const dt = new Date(Date.UTC(y, m + 1, d, 0, 0, 1));
  return dt.toISOString();
};

const PlannerCheckOut: React.FC<PlannerCheckOutProps> = ({
  onClose,
  onBackToContract,
  total,
  depositAmount,
  payFull,
  paymentSummary,
  signatureImage,
  onSuccess,
  setStepSuccess, // kept in props for compatibility, but CheckoutForm gets a no-op
  firstName,
  lastName,
  weddingDate,
  guestCount,
  dayOfWeek,
  uid,
}) => {
  const back = onBackToContract || onClose;

  const { userData } = useUser();
  const [isGenerating, setIsGenerating] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const finishedOnceRef = useRef(false);

  if (!userData) {
    return (
      <div className={`pixie-card pixie-card--modal ${isGenerating ? "is-generating" : ""}`}>
        <button className="pixie-card__close" onClick={onClose} aria-label="Close">
          <img
            src={`${import.meta.env.BASE_URL}assets/icons/pink_ex.png`}
            alt="Close"
          />
        </button>
        <div className="pixie-card__body">
          <p style={{ textAlign: "center" }}>Loading your info...</p>
        </div>
      </div>
    );
  }

  const fmtMoney = (n: number) =>
    Number.isFinite(n)
      ? n.toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })
      : "0.00";

  // ───────────────── Amounts due (rounded in cents) ─────────────────
  const totalCents = Math.round(Number(total) * 100);
  const depositCents = payFull
    ? totalCents
    : Math.min(totalCents, Math.round(Number(depositAmount) * 100));

  const amountDueTodayCents = depositCents;
  const remainingCents = Math.max(0, totalCents - amountDueTodayCents);

  const amountDueToday = amountDueTodayCents / 100;
  const remainingBalance = remainingCents / 100;

  // Resolve wedding date (prop → localStorage)
  const storedWeddingDate = localStorage.getItem("weddingDate") || "";
  const weddingDateSafe =
    (weddingDate && String(weddingDate)) ||
    (storedWeddingDate && String(storedWeddingDate)) ||
    "";

  const parsedWedding = weddingDateSafe
    ? new Date(`${weddingDateSafe}T12:00:00`)
    : null;

  const finalDueDate = parsedWedding
    ? new Date(
        parsedWedding.getTime() -
          FINAL_DUE_DAYS * 24 * 60 * 60 * 1000
      )
    : null;

  const finalDueDateStr = finalDueDate
    ? finalDueDate.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : `${FINAL_DUE_DAYS} days before your wedding date`;

  // Build a monthly plan (even spread, last payment adjusted) if not paying in full
  const today = new Date();

  let planMonths = 0,
    perMonthCents = 0,
    lastPaymentCents = 0,
    nextChargeAtISO: string | null = null;

  if (!payFull && finalDueDate) {
    planMonths = monthsBetweenInclusive(today, finalDueDate);
    const remCents = toCents(remainingBalance);
    const base = Math.floor(remCents / Math.max(1, planMonths));
    perMonthCents = base;
    lastPaymentCents = remCents - base * Math.max(0, planMonths - 1);
    nextChargeAtISO = firstMonthlyChargeAtUTC(today);
  }

  // ───────────────── Success handler (Stripe) ─────────────────
  const handleSuccess = async ({
    customerId,
  }: {
    customerId?: string;
  } = {}) => {
    if (finishedOnceRef.current) {
      console.warn("[PlannerCheckOut] handleSuccess already ran — ignoring re-entry");
      return;
    }
    finishedOnceRef.current = true;

    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) return;
    if (!signatureImage) return;

    const userRef = doc(db, "users", user.uid);
    const snap = await getDoc(userRef);
    const data = snap.data() || {};

    // Save stripeCustomerId if provided
    try {
      const existingId = data?.stripeCustomerId as string | undefined;
      if (customerId && customerId !== existingId) {
        await updateDoc(userRef, {
          stripeCustomerId: customerId,
          "stripe.updatedAt": serverTimestamp(),
        });
        try {
          localStorage.setItem("stripeCustomerId", customerId);
        } catch {}
      }
    } catch (e) {
      console.warn("Could not persist stripeCustomerId:", e);
    }

    // Ensure a default PM exists for off-session billing
    try {
      await fetch(
        "https://us-central1-wedndonev2.cloudfunctions.net/stripeApi/ensure-default-payment-method",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            customerId:
              customerId || localStorage.getItem("stripeCustomerId"),
            firebaseUid: user.uid,
          }),
        }
      );
      console.log("✅ Ensured default PM for planner customer");
    } catch (err) {
      console.error("❌ ensure-default-payment-method error:", err);
    }

    setIsGenerating(true);

    try {
      // ---------- 1) Try to generate & upload PDF
      let url: string | null = null;
      try {
        const blob = await generatePlannerAgreementPDF({
          firstName,
          lastName,
          total,
          deposit: payFull ? 0 : amountDueToday,
          paymentSummary,
          weddingDate: weddingDateSafe,
          guestCount,
          dayOfWeek,
          signatureImageUrl: signatureImage,
        });

        const ts = Date.now();
        const fileName = `PlannerAgreement_${ts}.pdf`;
        const filePath = `public_docs/${user.uid}/${fileName}`;
        url = await uploadPdfBlob(blob, filePath);
      } catch (pdfErr) {
        console.error("❌ PDF generation/upload failed; continuing:", pdfErr);
      }

      // ---------- 2) Build payment plan snapshots
      const humanPlan = payFull
        ? {
            product: "planner",
            type: "full",
            total,
            paidNow: total,
            remainingBalance: 0,
            finalDueDate: null,
            finalDueAt: null,
            depositDollars: total,
            createdAt: new Date().toISOString(),
          }
        : {
            product: "planner",
            type: "deposit",
            total,
            depositDollars: amountDueToday,
            paidNow: amountDueToday,
            remainingBalance,
            finalDueDate: finalDueDateStr,
            finalDueAt: finalDueDate
              ? asStartOfDayUTC(finalDueDate).toISOString()
              : null,
            createdAt: new Date().toISOString(),
          };

      const machinePlan = payFull
        ? {
            version: 1,
            product: "planner",
            status: "complete",
            strategy: "paid_in_full",
            currency: "usd",
            totalCents: toCents(total),
            depositCents: toCents(total),
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
          }
        : {
            version: 1,
            product: "planner",
            status: "active",
            strategy: "monthly_until_final",
            currency: "usd",
            totalCents: toCents(total),
            depositCents: toCents(amountDueToday),
            remainingCents: toCents(remainingBalance),
            planMonths,
            perMonthCents,
            lastPaymentCents,
            nextChargeAt: nextChargeAtISO,
            finalDueAt: finalDueDate
              ? asStartOfDayUTC(finalDueDate).toISOString()
              : null,
            stripeCustomerId:
              customerId ||
              localStorage.getItem("stripeCustomerId") ||
              null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };

      // ---------- 3) Save purchase + docs
      const updates: any = {
        "bookings.planner": true,
        pixiePlannerSigned: true,
        weddingDateLocked: true,
        plannerPdfUrl: url || null,

        purchases: arrayUnion({
          label: "Pixie Planner",
          category: "planner",
          amount: Number(amountDueToday.toFixed(2)), // charged today
          contractTotal: Number(total.toFixed(2)), // full commitment
          payFull: Boolean(payFull),
          deposit: payFull
            ? Number(total.toFixed(2))
            : Number(amountDueToday.toFixed(2)),
          monthlyAmount: payFull
            ? 0
            : +(perMonthCents / 100).toFixed(2),
          months: payFull ? 0 : planMonths,
          method: payFull ? "full" : "deposit",
          date: new Date().toISOString(),
          weddingDate: weddingDateSafe || null,
          docUrl: url || null,
          createdAtISO: new Date().toISOString(),
          source: "PlannerCheckOut",
        }),

        spendTotal: increment(Number(amountDueToday.toFixed(2))),
        paymentPlan: humanPlan,
        paymentPlanAuto: machinePlan,
      };

      if (url) {
        updates.documents = arrayUnion({
          title: "Pixie Planner Agreement",
          url,
          uploadedAt: new Date().toISOString(),
        });
      }

      await updateDoc(userRef, updates);

      // ---------- 4) Email notifications (user + admin) ----------
      try {
        const publicKey = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;
        if (publicKey) {
          const serviceId = "service_xayel1i";

          const fullName = `${firstName || data?.firstName || "Magic"} ${
            lastName || data?.lastName || "User"
          }`.trim();

          const userEmail =
            userData?.email ||
            getAuth().currentUser?.email ||
            "unknown@wedndone.com";

          // Format wedding date nicely and avoid timezone slip
          const emailWeddingDate = (() => {
            const ymd = weddingDateSafe;
            if (/^\d{4}-\d{2}-\d{2}$/.test(ymd)) {
              const d = new Date(`${ymd}T12:00:00`);
              return d.toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
              });
            }
            return ymd || "TBD";
          })();

          const commonParams = {
            user_email: userEmail,
            user_full_name: fullName,
            firstName: firstName || data?.firstName || "",
            wedding_date: emailWeddingDate,
            pdf_url: url || "",
            pdf_title: "Pixie Planner Agreement",
            total: total.toFixed(2),
            line_items: `Pixie Planner coordination for ${guestCount} guests`,
            payment_now: amountDueToday.toFixed(2),
            remaining_balance: remainingBalance.toFixed(2),
            final_due: finalDueDateStr,
            dashboardUrl: `${window.location.origin}${
              import.meta.env.BASE_URL
            }dashboard`,
            product_name: "Pixie Planner",
          };

          // user-facing email
          const userPromise = emailjs.send(
            serviceId,
            "template_ima4r4n",
            commonParams,
            publicKey
          );

          // admin notification email
          const adminPromise = emailjs.send(
            serviceId,
            "template_4fdximn",
            commonParams,
            publicKey
          );

          await Promise.all([userPromise, adminPromise]);
        }
      } catch (mailErr) {
        console.warn("Planner EmailJS failed:", mailErr);
      }

      // ---------- 5) UI updates
      window.dispatchEvent(new Event("purchaseMade"));
      window.dispatchEvent(new Event("plannerCompletedNow"));
      setIsGenerating(false);
      onSuccess();
    } catch (err) {
      console.error("Planner finalize error (outer):", err);
      setIsGenerating(false);
      onSuccess();
    }
  };

  return (
    <div
      className="pixie-card pixie-card--modal"
      style={{ maxWidth: 700 }}
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
      <div
        ref={scrollRef}
        className="pixie-card__body"
        style={{ textAlign: "center" }}
      >
        {isGenerating ? (
          <div
            className="px-center"
            style={{ marginTop: "10px" }}
          >
            <video
              src={`${import.meta.env.BASE_URL}assets/videos/magic_clock.mp4`}
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
            <h3
              className="px-title"
              style={{ margin: 0 }}
            >
              Madge is working her magic…
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
                marginBottom: "8px",
              }}
            >
              Checkout
            </h2>

            {/* amount text with strict formatting */}
            <p
              className="px-prose-narrow"
              style={{ marginBottom: "16px" }}
            >
              {paymentSummary
                ? paymentSummary
                : payFull
                ? `You're paying $${fmtMoney(total)} today.`
                : `Deposit due today: $${fmtMoney(
                    amountDueToday
                  )}. Remaining $${fmtMoney(
                    remainingBalance
                  )} will be billed monthly with the final payment due ${finalDueDateStr}.`}
            </p>

            {/* Stripe form (no <Elements />) */}
            <div className="px-elements" aria-busy={isGenerating}>
              <CheckoutForm
                total={amountDueToday}
                onSuccess={handleSuccess} // receives { customerId }
                setStepSuccess={() => {
                  // We advance via handleSuccess → onSuccess()
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

            {/* Back to contract (optional) */}
            <div
              style={{
                textAlign: "center",
                marginTop: "10px",
              }}
            >
              <button
                className="boutique-back-btn"
                onClick={back}
                style={{ minWidth: 160 }}
              >
                ← Back
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default PlannerCheckOut;