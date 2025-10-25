// src/components/photo/PhotoContract.tsx
import React, { useRef, useState } from "react";
import SignatureCanvas from "react-signature-canvas";
import { getAuth } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { db } from "../../firebase/firebaseConfig";

interface PhotoContractProps {
  bookingData: {
    weddingDate?: string;
    dayOfWeek?: string;
    total: number;
    styleChoice?: string;
    lineItems?: string[];
  };
  payFull: boolean;
  setPayFull: (val: boolean) => void;
  setSignatureImage: (url: string) => void;
  signatureSubmitted: boolean;
  setSignatureSubmitted: (val: boolean) => void;
  onBack: () => void;       // ← used for pink X & “Back to Cart”
  onContinue: () => void;   // → Checkout
  onClose: () => void;
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

// 50% deposit, final due 35 days before wedding (photo-specific)
const DEPOSIT_PCT = 0.5;
const FINAL_DUE_DAYS_BEFORE = 35;

const PhotoContract: React.FC<PhotoContractProps> = ({
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
  // ───────────────────────────────
  // Derivations
  // ───────────────────────────────
  const hasDate = Boolean(bookingData.weddingDate);
  const total = bookingData.total || 0;
  const depositAmount = round2(total * DEPOSIT_PCT);
  const remainingBalance = round2(Math.max(0, total - depositAmount));

  const weddingISO = bookingData.weddingDate || "";
  const weddingDateObj = weddingISO ? new Date(weddingISO + "T12:00:00") : null;

  const finalDue = weddingDateObj
    ? new Date(weddingDateObj.getTime() - FINAL_DUE_DAYS_BEFORE * 24 * 60 * 60 * 1000)
    : null;

  // simple month count (charge approx monthly through final due)
  function monthsBetween(start: Date, end: Date) {
    if (end <= start) return 1;
    let y = end.getFullYear() - start.getFullYear();
    let m = end.getMonth() - start.getMonth();
    let months = y * 12 + m;
    if (end.getDate() > start.getDate()) months += 1;
    return Math.max(1, months);
  }

  const today = new Date();
  const installmentCount = !weddingDateObj || !finalDue ? 1 : monthsBetween(today, finalDue);
  const perInstallment = round2(
    installmentCount > 0 ? remainingBalance / installmentCount : remainingBalance
  );

  const formatOrdinal = (n: number) => {
    const s = ["th", "st", "nd", "rd"];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  };
  const formatLongDate = (d: Date | null) =>
    d ? `${d.toLocaleString("en-US", { month: "long" })} ${formatOrdinal(d.getDate())}, ${d.getFullYear()}` : "";

  const finalDuePretty = formatLongDate(finalDue);
  const formattedDate = hasDate
    ? new Date(bookingData.weddingDate as string).toLocaleDateString("en-US", {
        year: "numeric", month: "long", day: "numeric",
      })
    : "your wedding date";
  const dayOfWeek = bookingData.dayOfWeek || "";

  // ───────────────────────────────
  // Signature modal state
  // ───────────────────────────────
  const [agreeChecked, setAgreeChecked] = useState(false);
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [useTextSignature, setUseTextSignature] = useState(false);
  const [typedSignature, setTypedSignature] = useState("");
  const sigCanvasRef = useRef<SignatureCanvas | null>(null);

  // Signature helpers
  const generateImageFromText = (text: string): string => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    canvas.width = 800;
    canvas.height = 200;
    if (!ctx) return "";
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#000000";
    ctx.font = "64px 'Jenna Sue', cursive";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText((text || "").trim() || " ", canvas.width / 2, canvas.height / 2);
    return canvas.toDataURL("image/png");
  };

  const handleSignatureSubmit = async () => {
    let finalSignature = "";

    if (useTextSignature && typedSignature.trim()) {
      finalSignature = generateImageFromText(typedSignature.trim());
    } else if (!useTextSignature && sigCanvasRef.current) {
      try {
        const base = sigCanvasRef.current.getCanvas();
        // paint onto white so PNG isn’t transparent
        const out = document.createElement("canvas");
        out.width = base.width;
        out.height = base.height;
        const ctx = out.getContext("2d");
        if (!ctx) throw new Error("No 2D context");
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, out.width, out.height);
        ctx.drawImage(base, 0, 0);
        finalSignature = out.toDataURL("image/png");
      } catch (error) {
        console.error("❌ Error capturing signature:", error);
        alert("Something went wrong when capturing your signature. Try again!");
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
          { photoSigned: true, signatureImageUrl: finalSignature },
          { merge: true }
        );
      } catch (error) {
        console.error("❌ Failed to save signature:", error);
      }
    }
  };

  // ───────────────────────────────
  // No date guard (match floral UX)
  // ───────────────────────────────
  if (!hasDate) {
    return (
      <div className="pixie-card">
        <button className="pixie-card__close" onClick={onBack} aria-label="Close">
          <img src={`${import.meta.env.BASE_URL}assets/icons/pink_ex.png`} alt="Close" />
        </button>
        <div className="pixie-card__body px-center">
          <video
            src={`${import.meta.env.BASE_URL}assets/videos/calendar_loop.mp4`}
            autoPlay loop muted playsInline
            className="px-media"
            style={{ maxWidth: 160 }}
          />
          <h2 className="px-title" style={{ marginBottom: "0.5rem" }}>
            One quick thing…
          </h2>
          <p className="px-prose-narrow" style={{ marginBottom: "1rem" }}>
            We need your <strong>wedding date</strong> to schedule the final payment ({FINAL_DUE_DAYS_BEFORE} days prior).
          </p>
          <button className="boutique-primary-btn px-btn-200" onClick={onBack}>
            Set my wedding date
          </button>
        </div>
      </div>
    );
  }

  // ───────────────────────────────
  // Main render (Floral format)
  // ───────────────────────────────
  return (
    <div className="pixie-card">
      {/* Pink X inside the card */}
      <button className="pixie-card__close" onClick={onBack} aria-label="Close">
        <img src={`${import.meta.env.BASE_URL}assets/icons/pink_ex.png`} alt="Close" />
      </button>

      {/* Scrollable body */}
      <div className="pixie-card__body px-center">
        {/* Header / Summary */}
        <img
          src={`${import.meta.env.BASE_URL}assets/images/photo_style_button.png`}
          alt="Photography"
          className="px-media"
          style={{ maxWidth: 100, marginBottom: 8 }}
        />
        <h2 className="px-title-lg" style={{ marginBottom: 4 }}>
          Photography Agreement
        </h2>

        <p className="px-prose-narrow" style={{ marginBottom: "1rem" }}>
          You’re booking photography for <strong>{formattedDate}</strong>
          {dayOfWeek ? ` (${dayOfWeek})` : ""}. The total is{" "}
          <strong>${total.toFixed(2)}</strong>
          {bookingData.styleChoice ? (
            <> — preferred style: <em>{bookingData.styleChoice}</em>.</>
          ) : (
            "."
          )}
        </p>

        {/* Booking Terms (photo-specific content, Floral structure) */}
        <div className="px-section" style={{ maxWidth: 620 }}>
          <h3 className="px-title-lg" style={{ fontSize: "1.8rem", marginBottom: "0.5rem" }}>
            Booking Terms
          </h3>
          <ul
            style={{
              textAlign: "left",
              margin: "0 auto 1rem",
              maxWidth: 560,
              lineHeight: 1.6,
              fontSize: ".98rem",
              paddingLeft: "1.25rem",
            }}
          >
            <li>
              <strong>Payment Options:</strong> Pay in full today, or place a{" "}
              <strong>50% non-refundable deposit</strong> and pay the remaining
              balance monthly. All installments must be completed no later than{" "}
              <strong>{FINAL_DUE_DAYS_BEFORE} days before your wedding date</strong>.
              Any unpaid balance will be auto-charged on that date.
            </li>
            <br />
            <li>
              <strong>Cancellation &amp; Refunds:</strong> If you cancel more than{" "}
              {FINAL_DUE_DAYS_BEFORE} days prior, amounts paid beyond the non-refundable
              deposit will be refunded <em>less any non-recoverable costs already incurred</em>.
              If you cancel within {FINAL_DUE_DAYS_BEFORE} days, all payments are non-refundable.
            </li>
            <br />
            <li>
              <strong>Missed Payments:</strong> We will retry your card automatically. If
              payment isn’t received within 7 days, a $25 late fee applies; after 14 days,
              services may be suspended and the agreement may be declared in default (amounts
              paid—including the deposit—may be retained and the booking cancelled).
            </li>
            <br />
            <li>
              <strong>Delivery &amp; Usage:</strong> Final edited images are delivered via
              Dropbox within 90 days of the wedding date. You receive a limited copyright
              license for personal use (sharing/printing). The photographer may showcase
              select images for portfolio/promotional purposes. Venue/officiant rules may
              limit opportunities; we’ll comply accordingly.
            </li>
            <br />
            <li>
              <strong>Force Majeure:</strong> Neither party is liable for failure or delay
              caused by events beyond reasonable control (including natural disasters, acts
              of government, war, terrorism, labor disputes, epidemics/pandemics, or utility
              outages). If performance is prevented, we’ll work in good faith to reschedule.
              If rescheduling isn’t possible, we’ll refund amounts paid beyond non-recoverable
              costs already incurred. Liability is otherwise limited to a refund of payments made.
            </li>
          </ul>
        </div>

        {/* Pay plan toggle */}
        <h4 className="px-title" style={{ fontSize: "1.8rem", marginBottom: "0.5rem" }}>
          Choose how you’d like to pay:
        </h4>
        <div className="px-toggle" style={{ marginBottom: 12 }}>
          <button
            type="button"
            className={`px-toggle__btn ${payFull ? "px-toggle__btn--blue px-toggle__btn--active" : ""}`}
            style={{ minWidth: "150px", padding: "0.6rem 1rem", fontSize: "0.9rem" }}
            onClick={() => {
              setPayFull(true);
              setSignatureSubmitted(false);
              try { localStorage.setItem("photoPayPlan", "full"); } catch {}
            }}
          >
            Pay Full Amount
          </button>
          <button
            type="button"
            className={`px-toggle__btn ${!payFull ? "px-toggle__btn--pink px-toggle__btn--active" : ""}`}
            style={{ minWidth: "150px", padding: "0.6rem 1rem", fontSize: "0.9rem" }}
            onClick={() => {
              setPayFull(false);
              setSignatureSubmitted(false);
              try { localStorage.setItem("photoPayPlan", "monthly"); } catch {}
            }}
          >
            Deposit + Monthly
          </button>
        </div>

        {/* One-line summary */}
        <p className="px-prose-narrow" style={{ marginTop: 4 }}>
          {payFull ? (
            <>You’re paying <strong>${total.toFixed(2)}</strong> today.</>
          ) : (
            <>
              You’re paying <strong>${depositAmount.toFixed(2)}</strong> today, then about{" "}
              <strong>${perInstallment.toFixed(2)}</strong> monthly until{" "}
              <strong>{finalDuePretty || "your due date"}</strong>.
            </>
          )}
        </p>

        {/* Agree checkbox */}
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

        {/* Sign or Continue */}
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
                // persist plan hints for checkout
                try {
                  localStorage.setItem("photoPaymentPlan", payFull ? "full" : "monthly");
                  localStorage.setItem("photoTotal", String(total));
                  localStorage.setItem("photoDepositAmount", String(depositAmount));
                  localStorage.setItem("photoRemainingBalance", String(remainingBalance));
                  localStorage.setItem("photoFinalDueDate", finalDue ? finalDue.toISOString() : "");
                  if (bookingData.lineItems) {
                    localStorage.setItem("photoLineItems", JSON.stringify(bookingData.lineItems));
                  }
                  if (bookingData.styleChoice) {
                    localStorage.setItem("photoStyleChoice", bookingData.styleChoice);
                  }
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

        {/* Signature Modal */}
        {showSignatureModal && (
          <div
            style={{
              position: "fixed", inset: 0, background: "rgba(0,0,0,.5)",
              display: "flex", alignItems: "center", justifyContent: "center",
              zIndex: 1200, padding: 16
            }}
          >
            <div
              style={{
                background: "#fff", borderRadius: 18, width: "min(92vw, 500px)",
                padding: "1.5rem", textAlign: "center"
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
                      padding: "0.6rem", width: "100%", fontSize: "1.1rem",
                      borderRadius: 10, border: "1px solid #ccc", marginBottom: 12
                    }}
                  />
                  <div
                    style={{
                      fontFamily: "'Jenna Sue', cursive",
                      fontSize: "2rem",
                      border: "1px solid #ddd",
                      borderRadius: 12,
                      padding: "0.75rem",
                      marginBottom: 12
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
                    className: "sigCanvas",
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
  );
};

export default PhotoContract;