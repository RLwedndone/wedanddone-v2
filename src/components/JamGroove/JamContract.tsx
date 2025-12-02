// src/components/jam/JamContractScreen.tsx
import React, { useState, useRef } from "react";
import SignatureCanvas from "react-signature-canvas";
import { getAuth } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { db } from "../../firebase/firebaseConfig";

interface JamContractProps {
  bookingData: {
    weddingDate?: string;
    dayOfWeek?: string;
    total: number;
    paymentSummary: string;
    lineItems: string[];
  };
  payFull: boolean;
  setPayFull: (val: boolean) => void;
  setSignatureImage: (url: string) => void;
  signatureSubmitted: boolean;
  setSignatureSubmitted: (val: boolean) => void;
  onBack: () => void;
  onContinue: () => void; // advances to checkout
  onClose: () => void;
  onSuccess: () => void;
}

/* ───────── helpers ───────── */
const MS_DAY = 24 * 60 * 60 * 1000;
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

const parseLocalYMD = (ymd?: string | null): Date | null => {
  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  return new Date(`${ymd}T12:00:00`); // local-noon guard
};

const asStartOfDayUTC = (d: Date) =>
  new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 1)).toISOString();

// first monthly charge ~1 month from now (UTC)
function firstMonthlyChargeAtUTC(from = new Date()): string {
  const y = from.getUTCFullYear();
  const m = from.getUTCMonth();
  const d = from.getUTCDate();
  const dt = new Date(Date.UTC(y, m + 1, d, 0, 0, 1));
  return dt.toISOString();
}

// months count inclusive (partial last month counts as 1)
function monthsBetweenInclusive(from: Date, to: Date) {
  const a = new Date(from.getFullYear(), from.getMonth(), 1);
  const b = new Date(to.getFullYear(), to.getMonth(), 1);
  let months = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
  months += 1;
  return Math.max(1, months);
}

const JamContractScreen: React.FC<JamContractProps> = ({
  bookingData,
  payFull,
  setPayFull,
  setSignatureImage,
  signatureSubmitted,
  setSignatureSubmitted,
  onBack,
  onContinue,
  onClose,
}) => {
  const [agreeChecked, setAgreeChecked] = useState(false);
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [useTextSignature, setUseTextSignature] = useState(false);
  const [typedSignature, setTypedSignature] = useState("");
  const sigCanvasRef = useRef<SignatureCanvas | null>(null);

  /* ───────── values from cart / user date ───────── */
  const total = Number(bookingData?.total || 0);

  // Flat $750 deposit (capped by total)
  const FLAT_DEPOSIT = 750;
  const depositAmount = round2(Math.min(FLAT_DEPOSIT, total));
  const remainingBalance = round2(Math.max(0, total - depositAmount));

  // resolve wedding date (prop → localStorage fallback)
  const weddingYMD =
    bookingData.weddingDate ||
    (() => {
      try {
        return localStorage.getItem("weddingDate") || "";
      } catch {
        return "";
      }
    })() ||
    "";

  const weddingDate = parseLocalYMD(weddingYMD);
  const finalDueDate = weddingDate ? new Date(weddingDate.getTime() - 35 * MS_DAY) : null;
  const finalDuePretty = finalDueDate
    ? finalDueDate.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
    : "35 days before your wedding date";
  const finalDueISO = finalDueDate ? asStartOfDayUTC(finalDueDate) : "";

  // Monthly plan math
  let planMonths = 0,
    perMonthCents = 0,
    lastPaymentCents = 0,
    nextChargeAtISO = "";
  if (!payFull && finalDueDate && remainingBalance > 0) {
    planMonths = monthsBetweenInclusive(new Date(), finalDueDate);
    const remainingCents = Math.round(remainingBalance * 100);
    const base = Math.floor(remainingCents / planMonths);
    perMonthCents = base;
    lastPaymentCents = remainingCents - base * Math.max(0, planMonths - 1);
    nextChargeAtISO = firstMonthlyChargeAtUTC(new Date());
  }

  const formattedDate = weddingDate
    ? weddingDate.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
    : "your wedding date";
  const dayOfWeek = bookingData.dayOfWeek || "";

  /* ───────── signature helpers ───────── */
  const generateImageFromText = (text: string): string => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    canvas.width = 600;
    canvas.height = 150;
    if (!ctx) return "";
    ctx.fillStyle = "#000";
    ctx.font = "48px 'Jenna Sue', cursive";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, canvas.width / 2, canvas.height / 2);
    return canvas.toDataURL("image/png");
  };

  const handleSignatureSubmit = async () => {
    let finalSignature = "";

    if (useTextSignature && typedSignature.trim()) {
      finalSignature = generateImageFromText(typedSignature.trim());
    } else if (!useTextSignature && sigCanvasRef.current) {
      try {
        finalSignature = sigCanvasRef.current.getCanvas().toDataURL("image/png");
      } catch {
        alert("⚠️ Error capturing signature. Please try again.");
        return;
      }
    } else {
      alert("⚠️ Please enter or draw a signature before saving.");
      return;
    }

    setSignatureImage(finalSignature);
    setSignatureSubmitted(true);
    setShowSignatureModal(false);

    const user = getAuth().currentUser;
    if (user) {
      try {
        await setDoc(
          doc(db, "users", user.uid),
          { jamSigned: true, signatureImageUrl: finalSignature },
          { merge: true }
        );
      } catch (error) {
        console.error("❌ Failed to save signature:", error);
      }
    }
  };

  // UI payment summary text (beneath options)
  const paymentSummaryText = payFull
    ? `You're paying $${total.toFixed(2)} today.`
    : `You'll pay $${depositAmount.toFixed(
        2
      )} today, then monthly through ${finalDuePretty}. Est. ${planMonths} payments of $${(
        perMonthCents / 100
      ).toFixed(2)}${planMonths > 1 ? ` (last ≈ $${(lastPaymentCents / 100).toFixed(2)})` : ""}.`;

      return (
        <div className="pixie-card">
          {/* Pink X */}
          <button className="pixie-card__close" onClick={onClose} aria-label="Close">
            <img src={`${import.meta.env.BASE_URL}assets/icons/pink_ex.png`} alt="Close" />
          </button>
      
          {/* Standard card body */}
          <div className="pixie-card__body">
            <div className="px-center">
              {/* Little button image with extra top spacing */}
              <img
                src={`${import.meta.env.BASE_URL}assets/images/jam_groove_button.png`}
                alt="Jam & Groove"
                className="px-media"
                style={{ maxWidth: 100, margin: "6px auto 12px" }}
              />
      
              <h2 className="px-title-lg" style={{ marginBottom: "0.5rem" }}>
                Jam &amp; Groove Agreement
              </h2>
      
              <p className="px-prose-narrow" style={{ marginBottom: 12 }}>
                You're booking music services for <strong>{formattedDate}</strong>
                {dayOfWeek ? ` (${dayOfWeek})` : ""}. Total due:{" "}
                <strong>${total.toFixed(2)}</strong>.
              </p>
      
              {/* Booking Terms (matches style used in other contracts) */}
              <div className="px-section" style={{ maxWidth: 620 }}>
                <h3 className="px-title-lg" style={{ fontSize: "1.8rem", marginBottom: "0.5rem" }}>
                  Booking Terms
                </h3>
      
                <ul
                  className="px-prose-narrow"
                  style={{
                    textAlign: "left",
                    margin: "0 auto 14px",
                    maxWidth: 560,
                    lineHeight: 1.6,
                    fontSize: ".98rem",
                    paddingLeft: "1.25rem",
                  }}
                >
                  <li>
                    <strong>Payment Options.</strong> Pay in full today, or place a{" "}
                    <strong>non-refundable $750 deposit</strong> with the balance billed monthly. All
                    installments must complete by <strong>35 days before your wedding date</strong>. Any
                    remaining balance will be auto-charged on that date.
                  </li>
                  <br />
                  <li>
                    <strong>Cancellation &amp; Refunds.</strong> If you cancel &gt;35 days out, amounts
                    paid beyond the non-refundable portion are refundable (less non-recoverable costs).
                    If you cancel ≤35 days, payments are non-refundable.
                  </li>
                  <br />
                  <li>
                    <strong>Missed Payments.</strong> We’ll re-attempt your card automatically. After 7
                    days a $25 late fee may apply. After 14 days, services may be suspended and this
                    agreement may be in default.
                  </li>
                  <br />
                  <li>
                    <strong>Performance &amp; Logistics.</strong> Talent arrives ~1 hour before guest
                    arrival for setup and sound check. Client provides safe power and covered setup as
                    required by the venue. Travel outside Phoenix Metro may incur additional fees.
                  </li>
                  <br />
                  <li>
                    <strong>Force Majeure.</strong> If events beyond control prevent performance, we’ll
                    work in good faith to reschedule; otherwise, amounts paid beyond non-recoverable
                    costs are refunded. If we must cancel, liability is limited to refund of payments
                    made.
                  </li>
                </ul>
              </div>

        {/* Pay plan toggle — match Floral styling */}
{/* Pay plan toggle — match Floral colors */}
<h4 className="px-title" style={{ fontSize: "1.8rem", marginBottom: "0.5rem" }}>
  Choose how you’d like to pay:
</h4>

<div className="px-toggle" style={{ marginBottom: 12 }}>
  <button
    type="button"
    className={`px-toggle__btn ${payFull ? "px-toggle__btn--blue px-toggle__btn--active" : ""}`}
    style={{
      minWidth: 150,
      padding: "0.6rem 1rem",
      fontSize: ".9rem",
      borderRadius: "8px",
      backgroundColor: payFull ? "#2c62ba" : "#e0e0e0",
      color: payFull ? "#fff" : "#444",
      fontWeight: 600,
      border: "none",
    }}
    onClick={() => {
      setPayFull(true);
      setSignatureSubmitted(false);
      try {
        localStorage.setItem("jamPayPlan", "full");
      } catch {}
    }}
  >
    Pay Full Amount
  </button>

  <button
    type="button"
    className={`px-toggle__btn ${!payFull ? "px-toggle__btn--pink px-toggle__btn--active" : ""}`}
    style={{
      minWidth: 150,
      padding: "0.6rem 1rem",
      fontSize: ".9rem",
      borderRadius: "8px",
      backgroundColor: !payFull ? "#e98fba" : "#e0e0e0", // ✅ pink when active
      color: !payFull ? "#fff" : "#444",
      fontWeight: 600,
      border: "none",
    }}
    onClick={() => {
      setPayFull(false);
      setSignatureSubmitted(false);
      try {
        localStorage.setItem("jamPayPlan", "monthly");
      } catch {}
    }}
  >
    Deposit + Monthly
  </button>
</div>

        {/* Pay-plan summary — match Floral */}
<p className="px-prose-narrow" style={{ marginTop: 4 }}>
  {payFull ? (
    <>You’re paying <strong>${total.toFixed(2)}</strong> today.</>
  ) : (
    <>
      You’re paying <strong>${depositAmount.toFixed(2)}</strong> today, then about{" "}
      <strong>${(perMonthCents / 100).toFixed(2)}</strong> monthly until{" "}
      <strong>{finalDuePretty}</strong>.
    </>
  )}
</p>

{/* Agree checkbox — match Floral copy/spacing */}
<div style={{ margin: "0.75rem 0 0.5rem" }}>
  <label>
    <input
      type="checkbox"
      checked={agreeChecked}
      onChange={(e) => setAgreeChecked(e.target.checked)}
      style={{ marginRight: 8 }}
    />
    I agree to the terms above
  </label>
</div>

{/* Actions — same structure as Floral */}
{!signatureSubmitted ? (
  <button
    className="boutique-primary-btn"
    onClick={() => agreeChecked && setShowSignatureModal(true)}
    disabled={!agreeChecked}
  >
    Sign Contract
  </button>
) : (
  <div className="px-cta-col" style={{ marginTop: 8 }}>
    <img
      src={`${import.meta.env.BASE_URL}assets/images/contract_signed.png`}
      alt="Signed"
      style={{ width: 120, marginBottom: 4 }}
    />
    <button
      className="boutique-primary-btn"
      onClick={() => {
        try {
          const plan = payFull ? "full" : "monthly";
          const totalCents = Math.round(total * 100);
          const depositCents = payFull ? totalCents : Math.round(depositAmount * 100);
          const remainingCents = payFull ? 0 : Math.max(0, totalCents - depositCents);

          localStorage.setItem("jamPaymentPlan", plan);
          localStorage.setItem("jamTotalCents", String(totalCents));

          // flat deposit fields used by checkout
          localStorage.setItem("jamDepositAmount", String(depositAmount));
          localStorage.setItem("jamRemainingBalance", String(remainingBalance));
          localStorage.setItem("jamDepositType", "flat");

          // Monthly plan scheduling hints
          localStorage.setItem("jamPlanMonths", String(payFull ? 0 : planMonths));
          localStorage.setItem("jamPerMonthCents", String(payFull ? 0 : perMonthCents));
          localStorage.setItem("jamLastPaymentCents", String(payFull ? 0 : lastPaymentCents));
          localStorage.setItem("jamNextChargeAt", payFull ? "" : nextChargeAtISO);
          localStorage.setItem("jamFinalDueAt", payFull ? "" : finalDueISO);
          localStorage.setItem("jamFinalDuePretty", finalDuePretty);

          // ✅ send the exact string we show here down to checkout
          localStorage.setItem("jamPaymentSummaryText", paymentSummaryText);

          if (bookingData.weddingDate) localStorage.setItem("jamWeddingDate", bookingData.weddingDate);
          if (bookingData.lineItems)  localStorage.setItem("jamLineItems", JSON.stringify(bookingData.lineItems));
        } catch {}
        onContinue();
      }}
    >
      Continue to Checkout
    </button>
    <button className="boutique-back-btn" onClick={onBack}>
      ⬅ Back to Cart
    </button>
  </div>
)}

{/* Signature modal — same look as Floral */}
{showSignatureModal && (
  <div
    style={{
      position: "fixed",
      inset: 0,
      background: "rgba(0,0,0,.5)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 1200,
      padding: 16,
    }}
  >
    <div
      style={{
        background: "#fff",
        borderRadius: 18,
        width: "min(92vw, 500px)",
        padding: "1.5rem",
        textAlign: "center",
      }}
    >
      <h3 className="px-title-lg" style={{ fontSize: "1.8rem", marginBottom: "1rem" }}>
        Sign below or enter your text signature
      </h3>

      <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 12 }}>
        <button
          type="button"
          onClick={() => setUseTextSignature(false)}
          className="boutique-primary-btn"
          style={{ width: 120, paddingBlock: ".5rem" }}
          aria-pressed={!useTextSignature}
        >
          Draw
        </button>
        <button
          type="button"
          onClick={() => setUseTextSignature(true)}
          className="boutique-back-btn"
          style={{ width: 120, paddingBlock: ".5rem" }}
          aria-pressed={useTextSignature}
        >
          Type
        </button>
      </div>

      {useTextSignature ? (
        <>
          <input
            type="text"
            value={typedSignature}
            onChange={(e) => setTypedSignature(e.target.value)}
            placeholder="Type your name"
            style={{
              padding: "0.6rem",
              width: "100%",
              fontSize: "1.1rem",
              borderRadius: 10,
              border: "1px solid #ccc",
              marginBottom: 12,
            }}
          />
          <div
            style={{
              fontFamily: "'Jenna Sue', cursive",
              fontSize: "2rem",
              border: "1px solid #ddd",
              borderRadius: 12,
              padding: "0.75rem",
              marginBottom: 12,
            }}
          >
            {typedSignature || "Your Signature Preview"}
          </div>
        </>
      ) : (
        <SignatureCanvas
          penColor="#2c62ba"
          ref={sigCanvasRef}
          canvasProps={{
            style: {
              width: "100%",
              maxWidth: 420,
              height: 150,
              border: "1px solid #ccc",
              borderRadius: 12,
              margin: "0 auto 12px",
              display: "block",
            },
          }}
        />
      )}

      <div className="px-cta-col" style={{ marginTop: 8 }}>
        <button className="boutique-primary-btn" onClick={handleSignatureSubmit}>
          Save Signature
        </button>
        <button
          type="button"
          className="linklike"
          style={{ marginTop: 6 }}
          onClick={() => setShowSignatureModal(false)}
        >
          Cancel
        </button>
      </div>
    </div>
  </div>
)}
    </div>
    </div>
    </div>
  );
};

export default JamContractScreen;