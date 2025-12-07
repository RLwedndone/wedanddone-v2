// src/components/FloralPicker/FloralContract.tsx
import React, { useRef, useState, useEffect } from "react";
import SignatureCanvas from "react-signature-canvas";
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { db, auth } from "../../firebase/firebaseConfig";

interface FloralContractProps {
  bookingData: {
    weddingDate?: string;
    dayOfWeek?: string;
    total: number;
    paymentAmount?: number;
    paymentSummaryText?: string;
    lineItems?: string[];
  };
  payFull: boolean;
  setPayFull: (payFull: boolean) => void;
  setSignatureImage: (url: string) => void;
  signatureSubmitted: boolean;
  setSignatureSubmitted: (val: boolean) => void;
  onBack: () => void;
  onContinue: () => void;
  onClose: () => void;
}

const DEPOSIT_PCT = 0.25;
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

const FloralContract: React.FC<FloralContractProps> = ({
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
  const hasDate = Boolean(bookingData.weddingDate);
  const total = bookingData.total || 0;
  const depositAmount = round2(total * DEPOSIT_PCT);
  const remainingBalance = round2(Math.max(0, total - depositAmount));

  const today = new Date();
  const weddingISO = bookingData.weddingDate || "";
  const weddingDateObj = weddingISO ? new Date(weddingISO + "T12:00:00") : null;

  const finalDue = weddingDateObj
    ? new Date(weddingDateObj.getTime() - 30 * 24 * 60 * 60 * 1000)
    : null;

  function monthsBetween(start: Date, end: Date) {
    if (end <= start) return 1;
    let y = end.getFullYear() - start.getFullYear();
    let m = end.getMonth() - start.getMonth();
    let months = y * 12 + m;
    if (end.getDate() > start.getDate()) months += 1;
    return Math.max(1, months);
  }

  const installmentCount =
    !weddingDateObj || !finalDue ? 1 : monthsBetween(today, finalDue);
  const perInstallment = round2(
    installmentCount > 0 ? remainingBalance / installmentCount : remainingBalance
  );

  const formatOrdinal = (n: number) => {
    const s = ["th", "st", "nd", "rd"];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  };
  const formatLongDate = (d: Date | null) =>
    d
      ? `${d.toLocaleString("en-US", { month: "long" })} ${formatOrdinal(
          d.getDate()
        )}, ${d.getFullYear()}`
      : "";

  const finalDuePretty = formatLongDate(finalDue);
  const formattedDate =
    hasDate && weddingDateObj
      ? weddingDateObj.toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        })
      : "your wedding date";

  const dayOfWeek = bookingData.dayOfWeek || "";

  // signature + consent state
  const [agreeChecked, setAgreeChecked] = useState(false);
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [useTextSignature, setUseTextSignature] = useState(false);
  const [typedSignature, setTypedSignature] = useState("");
  const sigCanvasRef = useRef<SignatureCanvas | null>(null);

  // global card-on-file consent status
  const [hasCardOnFileConsent, setHasCardOnFileConsent] = useState(false);
  const [cardConsentChecked, setCardConsentChecked] = useState(false);

  // 🔍 One unified check for cardOnFileConsent (localStorage + Firestore)
  useEffect(() => {
    // 1) LocalStorage quick check
    let localFlag = false;
    try {
      localFlag = localStorage.getItem("cardOnFileConsent") === "true";
    } catch {
      /* ignore */
    }

    if (localFlag) {
      setHasCardOnFileConsent(true);
      return;
    }

    // 2) Firestore check
    const user = auth.currentUser;
    if (!user) return;

    (async () => {
      try {
        const snap = await getDoc(doc(db, "users", user.uid));
        if (snap.exists()) {
          const data = snap.data() as any;
          if (data?.cardOnFileConsent) {
            setHasCardOnFileConsent(true);
          }
        }
      } catch (err) {
        console.error("❌ Failed to load cardOnFileConsent:", err);
      }
    })();
  }, []);

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
      const base = sigCanvasRef.current.getCanvas();
      const out = document.createElement("canvas");
      out.width = base.width;
      out.height = base.height;
      const ctx = out.getContext("2d");
      if (!ctx) return;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, out.width, out.height);
      ctx.drawImage(base, 0, 0);
      finalSignature = out.toDataURL("image/png");
    } else {
      alert("⚠️ Please enter or draw a signature before saving.");
      return;
    }

    try {
      localStorage.setItem("floralSignature", finalSignature);
    } catch {}

    setSignatureImage(finalSignature);
    setSignatureSubmitted(true);
    setShowSignatureModal(false);

    const user = auth.currentUser;
    if (user) {
      try {
        const payload: any = {
          floralSigned: true,
          signatureImageUrl: finalSignature,
        };

        // ✅ If this is the first time they’re giving card-on-file consent,
        // record it globally (regardless of full vs monthly).
        if (!hasCardOnFileConsent && cardConsentChecked) {
          payload.cardOnFileConsent = true;
          payload.cardOnFileConsentAt = serverTimestamp();
          try {
            localStorage.setItem("cardOnFileConsent", "true");
          } catch {}
          setHasCardOnFileConsent(true);
        }

        await setDoc(doc(db, "users", user.uid), payload, { merge: true });
      } catch (error) {
        console.error("❌ Failed to save signature:", error);
      }
    }
  };

  // 🔐 New consent rule:
  // - Checkbox shows whenever they HAVEN'T already consented.
  // - Once consent exists, we don't block by cardConsentChecked anymore.
  const needsCardConsent = !hasCardOnFileConsent;

  const canSign =
    agreeChecked && (hasCardOnFileConsent || cardConsentChecked);

  return (
    <div className="pixie-card">
      {/* Pink X */}
      <button className="pixie-card__close" onClick={onClose} aria-label="Close">
        <img src={`${import.meta.env.BASE_URL}assets/icons/pink_ex.png`} alt="Close" />
      </button>

      <div className="pixie-card__body">
        <div className="px-center">
          <img
            src={`${import.meta.env.BASE_URL}assets/images/floral_picker_button.png`}
            alt="Floral"
            className="px-media"
            style={{ maxWidth: 100, marginBottom: 8 }}
          />
          <h2 className="px-title-lg" style={{ marginBottom: "0.25rem" }}>
            Floral Agreement
          </h2>

          <p className="px-prose-narrow" style={{ marginBottom: hasDate ? "1rem" : 8 }}>
            You’re booking floral services for <strong>{formattedDate}</strong>
            {dayOfWeek ? ` (${dayOfWeek})` : ""}. The total is{" "}
            <strong>
              $
              {Number(total).toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </strong>
            .
          </p>

          {!hasDate && (
            <div
              className="px-note"
              style={{
                marginBottom: "1rem",
                background: "#fff6e6",
                border: "1px solid #ffd9a6",
                borderRadius: 10,
                padding: "8px 12px",
                fontSize: ".95rem",
              }}
            >
              Add your wedding date anytime—your final balance will simply be due 30
              days before it.
            </div>
          )}

          {/* Booking Terms */}
          <div className="px-section" style={{ maxWidth: 620 }}>
            <h3
              className="px-title-lg"
              style={{ fontSize: "1.8rem", marginBottom: "0.5rem" }}
            >
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
                Because flowers are perishable,{" "}
                <strong>comparable substitutions</strong> may be made if certain
                varieties are unavailable. Rented vases/stands/décor remain
                Wed&amp;Done or vendor property and must be returned in good
                condition (replacement costs apply if damaged or missing).
              </li>
              <br />
              <li>
                <strong>Payment Options &amp; Card Authorization:</strong> You may pay
                in full today, or place a{" "}
                <strong>25% non-refundable deposit</strong> and pay the remaining
                balance in monthly installments. All installments must be completed no
                later than <strong>30 days before your wedding date</strong>, and any
                unpaid balance will be automatically charged on that date. By
                completing this purchase, you authorize Wed&amp;Done and our payment
                processor (Stripe) to securely store your card for: (a) floral
                installment payments and any final balance due under this agreement,
                and (b) future Wed&amp;Done purchases you choose to make, for your
                convenience. Your card details are encrypted and handled by Stripe,
                and you can update or replace your saved card at any time through your
                Wed&amp;Done account.
              </li>
              <br />
              <li>
                Wed&amp;Done isn’t responsible for venue restrictions, undisclosed
                allergies, or consequential damages. Our liability is limited to
                amounts you have paid for floral services under this agreement.
              </li>
              <br />
              <li>
                <strong>Missed Payments:</strong> We’ll retry your card
                automatically. If payment isn’t received within 7 days, a $25 late fee
                applies; after 14 days, services may be suspended and the agreement
                may be in default.
              </li>
              <br />
              <li>
                <strong>Force Majeure:</strong> Neither party is liable for delays
                beyond reasonable control. We’ll work in good faith to reschedule; if
                not possible, we’ll refund amounts paid beyond non-recoverable costs.
              </li>
            </ul>
          </div>

          {/* Pay plan toggle */}
          <h4
            className="px-title"
            style={{ fontSize: "1.8rem", marginBottom: "0.5rem" }}
          >
            Choose how you’d like to pay:
          </h4>
          <div className="px-toggle" style={{ marginBottom: 12 }}>
            <button
              type="button"
              className={`px-toggle__btn ${
                payFull ? "px-toggle__btn--blue px-toggle__btn--active" : ""
              }`}
              style={{ minWidth: 150, padding: "0.6rem 1rem", fontSize: ".9rem" }}
              onClick={() => {
                setPayFull(true);
                setSignatureSubmitted(false);
                setCardConsentChecked(false);
                try {
                  localStorage.setItem("floralPayPlan", "full");
                } catch {}
              }}
            >
              Pay Full Amount
            </button>
            <button
              type="button"
              className={`px-toggle__btn ${
                !payFull ? "px-toggle__btn--pink px-toggle__btn--active" : ""
              }`}
              style={{ minWidth: 150, padding: "0.6rem 1rem", fontSize: ".9rem" }}
              onClick={() => {
                setPayFull(false);
                setSignatureSubmitted(false);
                setCardConsentChecked(false);
                try {
                  localStorage.setItem("floralPayPlan", "monthly");
                } catch {}
              }}
            >
              Deposit + Monthly
            </button>
          </div>

          {/* Summary line */}
          <p className="px-prose-narrow" style={{ marginTop: 4 }}>
            {payFull ? (
              <>
                You’re paying{" "}
                <strong>
                  $
                  {Number(total).toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </strong>{" "}
                today.
              </>
            ) : (
              <>
                You’re paying{" "}
                <strong>
                  $
                  {Number(depositAmount).toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </strong>{" "}
                today, then about{" "}
                <strong>
                  $
                  {Number(perInstallment).toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </strong>{" "}
                monthly
                {finalDuePretty ? (
                  <>
                    {" "}
                    until <strong>{finalDuePretty}</strong>.
                  </>
                ) : (
                  <> until 30 days before your wedding date.</>
                )}
              </>
            )}
          </p>

          {/* Agree & sign */}
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

          {/* Global card-on-file consent:
              - Show checkbox if they have NOT already consented (first purchase).
           */}
          {needsCardConsent && (
            <div
              style={{
                margin: "0.25rem 0 0.75rem",
                fontSize: ".9rem",
                textAlign: "left",
                maxWidth: 560,
              }}
            >
              <label>
                <input
                  type="checkbox"
                  checked={cardConsentChecked}
                  onChange={(e) => setCardConsentChecked(e.target.checked)}
                  style={{ marginRight: 8 }}
                />
                I authorize Wed&Done and our payment processor (Stripe) to securely
                store my card and to charge it for floral installments, any remaining
                floral balance, and future Wed&Done bookings I choose to make, as
                described in the payment terms above.
              </label>
            </div>
          )}

          {!signatureSubmitted ? (
            // BEFORE signature: Sign + Back
            <div className="px-cta-col" style={{ marginTop: 8 }}>
              <button
                className="boutique-primary-btn"
                onClick={() => {
                  if (!canSign) return;
                  setShowSignatureModal(true);
                }}
                disabled={!canSign}
                style={{ width: 250 }}
              >
                Sign Contract
              </button>

              <button
                className="boutique-back-btn"
                onClick={onBack}
                style={{ width: 250, marginTop: 10 }}
              >
                ⬅ Back to Cart
              </button>
            </div>
          ) : (
            // AFTER signature: Continue + Back
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
                    localStorage.setItem(
                      "floralPaymentPlan",
                      payFull ? "full" : "monthly"
                    );
                    localStorage.setItem("floralTotal", String(total));
                    localStorage.setItem(
                      "floralDepositAmount",
                      String(depositAmount)
                    );
                    localStorage.setItem(
                      "floralRemainingBalance",
                      String(remainingBalance)
                    );
                    localStorage.setItem(
                      "floralFinalDueDate",
                      finalDue ? finalDue.toISOString() : ""
                    );
                  } catch {}
                  onContinue();
                }}
                style={{ width: 250 }}
              >
                Continue to Checkout
              </button>
              <button
                className="boutique-back-btn"
                onClick={onBack}
                style={{ width: 250, marginTop: 10 }}
              >
                ⬅ Back to Cart
              </button>
            </div>
          )}

          {/* Signature modal */}
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
                <h3
                  className="px-title-lg"
                  style={{ fontSize: "1.8rem", marginBottom: "1rem" }}
                >
                  Sign below or enter your text signature
                </h3>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    gap: 8,
                    marginBottom: 12,
                  }}
                >
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
                  <button
                    className="boutique-primary-btn"
                    onClick={handleSignatureSubmit}
                  >
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

export default FloralContract;