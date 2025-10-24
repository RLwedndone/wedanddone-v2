// src/components/planner/PlannerContract.tsx
import React, { useEffect, useState, useRef } from "react";
import SignatureCanvas from "react-signature-canvas";
import { auth, db } from "../../firebase/firebaseConfig";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

interface PlannerContractProps {
  bookingData: {
    weddingDate?: string;
    dayOfWeek?: string;
    guestCount: number;
    total: number;
  };
  payFull: boolean;
  setPayFull: (val: boolean) => void;
  setSignatureImage: (img: string) => void;
  signatureSubmitted: boolean;
  setSignatureSubmitted: (val: boolean) => void;
  onContinue: () => void;
  onBack: () => void;
}

const FINAL_DUE_DAYS = 35;
const DEPOSIT_DOLLARS = 200;

const PlannerContract: React.FC<PlannerContractProps> = ({
  bookingData,
  payFull,
  setPayFull,
  setSignatureImage,
  signatureSubmitted,
  setSignatureSubmitted,
  onContinue,
  onBack,
}) => {
  const { guestCount: guestCountFromProps, weddingDate, dayOfWeek } = bookingData;

  // UI state
  const [agreeChecked, setAgreeChecked] = useState(false);
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [useTextSignature, setUseTextSignature] = useState(false);
  const [typedSignature, setTypedSignature] = useState("");
  const sigCanvasRef = useRef<SignatureCanvas | null>(null);

  // pulled-from-profile fallbacks
  const [fetchedWeddingDate, setFetchedWeddingDate] = useState<string | null>(null);
  const [fetchedGuestCount, setFetchedGuestCount] = useState<number | null>(null);

  // ---- derive inputs (with safe fallbacks) ----
  const storedGuestCountStr = localStorage.getItem("guestCount");
  const storedGuestCount =
    storedGuestCountStr != null && storedGuestCountStr !== ""
      ? parseInt(storedGuestCountStr, 10)
      : null;

  const finalGuestCount =
    (typeof fetchedGuestCount === "number" ? fetchedGuestCount : null) ??
    (typeof guestCountFromProps === "number" ? guestCountFromProps : null) ??
    storedGuestCount ??
    0;

  const storedDateLS = localStorage.getItem("weddingDate") || "";
  const dateToUse =
    (fetchedWeddingDate && String(fetchedWeddingDate)) ||
    (weddingDate && String(weddingDate)) ||
    (storedDateLS && String(storedDateLS)) ||
    "";

  const hasDate = Boolean(dateToUse);

  const formattedDate = hasDate
    ? new Date(dateToUse + "T12:00:00").toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "your wedding date";

  // ---- money math in cents (no float bleed) ----
  const fmtUSD = (cents: number) => `$${(cents / 100).toFixed(2)}`;

  const grandTotalCents = Math.max(0, Math.round((bookingData.total || 0) * 100));
  const depositCents = Math.min(grandTotalCents, DEPOSIT_DOLLARS * 100);
  const remainingCents = Math.max(0, grandTotalCents - depositCents);

  const weddingDateObj = hasDate ? new Date(dateToUse + "T12:00:00") : null;
  const finalDue = weddingDateObj
    ? new Date(weddingDateObj.getTime() - FINAL_DUE_DAYS * 24 * 60 * 60 * 1000)
    : null;

  const finalDuePretty = finalDue
    ? finalDue.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
    : "";

  const today = new Date();
  function monthsBetweenInclusive(from: Date, to: Date) {
    const a = new Date(from.getFullYear(), from.getMonth(), 1);
    const b = new Date(to.getFullYear(), to.getMonth(), 1);
    let months = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
    if (to.getDate() >= from.getDate()) months += 1;
    return Math.max(1, months);
  }

  const planMonths = weddingDateObj && finalDue ? monthsBetweenInclusive(today, finalDue) : 1;
  const perMonthCents = planMonths > 0 ? Math.floor(remainingCents / planMonths) : remainingCents;
  const lastPaymentCents = Math.max(0, remainingCents - perMonthCents * Math.max(0, planMonths - 1));

  // ---- signature helpers ----
  const generateImageFromText = (text: string): string => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    canvas.width = 800;
    canvas.height = 200;
    if (!ctx) return "";
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#000000";
    ctx.font = "64px 'Jenna Sue', 'Pacifico', cursive";
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
      const sc: any = sigCanvasRef.current;
      try {
        if (typeof sc.isEmpty === "function" && sc.isEmpty()) {
          alert("Please draw your signature before saving.");
          return;
        }
        if (typeof sc.getTrimmedCanvas === "function") {
          finalSignature = sc.getTrimmedCanvas().toDataURL("image/png");
        } else {
          finalSignature = sc.getCanvas().toDataURL("image/png");
        }
      } catch {
        try {
          finalSignature = (sc.getCanvas() as HTMLCanvasElement).toDataURL("image/png");
        } catch {
          alert("Something went wrong when capturing your signature. Try again!");
          return;
        }
      }
    } else {
      alert("Please enter or draw a signature before saving.");
      return;
    }

    try { localStorage.setItem("plannerSignature", finalSignature); } catch {}
    setSignatureImage(finalSignature);
    setSignatureSubmitted(true);
    setShowSignatureModal(false);

    const user = auth.currentUser;
    if (user) {
      await setDoc(
        doc(db, "users", user.uid),
        { pixiePlannerSigned: true, signatureImageUrl: finalSignature },
        { merge: true }
      );
    }
  };

  // pull user fallbacks
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) return;
      try {
        const snap = await getDoc(doc(db, "users", user.uid));
        if (snap.exists()) {
          const data = snap.data() as any;
          setFetchedWeddingDate(data.weddingDate || null);
          setFetchedGuestCount(data.guestCount || null);
        }
      } catch (e) {
        console.error("🔥 Error fetching user data:", e);
      }
    });
    return () => unsubscribe();
  }, []);

  return (
    <div className="pixie-card">
      {/* 🩷 Pink X (use Back to exit to cart like Floral/Jam) */}
      <button className="pixie-card__close" onClick={onBack} aria-label="Close">
        <img src="/assets/icons/pink_ex.png" alt="Close" />
      </button>

      <div className="pixie-card__body">
        <div className="px-center">
          {/* Header media */}
          <img
            src="/assets/images/planner_button.png"
            alt="Pixie Planner"
            className="px-media"
            style={{ maxWidth: 100, marginBottom: 8 }}
          />

          {/* Title */}
          <h2 className="px-title-lg" style={{ marginBottom: "0.25rem" }}>
            Coordination Agreement
          </h2>

          {/* Lead copy */}
          <p className="px-prose-narrow" style={{ marginBottom: hasDate ? "1rem" : 8 }}>
            You’re booking planning services for <strong>{formattedDate}</strong>
            {dayOfWeek ? ` (${dayOfWeek})` : ""} for <strong>{finalGuestCount} guests</strong>.
            The total is <strong>{fmtUSD(grandTotalCents)}</strong>.
          </p>

          {/* No-date note (matches Floral pattern) */}
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
              Add your wedding date anytime—your final balance will be due {FINAL_DUE_DAYS} days before it.
            </div>
          )}

          {/* Booking Terms (Planner-specific) */}
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
                <strong>Refunds & Cancellations:</strong> At minimum, ${DEPOSIT_DOLLARS} is non-refundable. If you cancel
                more than {FINAL_DUE_DAYS} days prior, amounts paid beyond the non-refundable portion are refundable
                (less non-recoverable costs already incurred). Cancel ≤{FINAL_DUE_DAYS} days: payments are non-refundable.
              </li>
              <br />
              <li>
                <strong>Rescheduling:</strong> May be possible based on vendor availability and may incur additional fees.
              </li>
              <br />
              <li>
                <strong>Missed Payments:</strong> We’ll retry your card automatically. After 7 days a $25 late fee may
                apply; after 14 days, services may be suspended and the agreement may be in default (amounts paid, incl.
                the deposit, may be retained).
              </li>
              <br />
              <li>
                <strong>Liability & Substitutions:</strong> Wed&amp;Done isn’t responsible for venue restrictions or
                consequential damages. Reasonable substitutions may be made as needed. Liability is limited to amounts
                paid for coordination services under this agreement.
              </li>
              <br />
              <li>
                <strong>Force Majeure:</strong> Neither party is liable for delays beyond reasonable control. We’ll work
                in good faith to reschedule; if not possible, we’ll refund amounts paid beyond non-recoverable costs.
              </li>
            </ul>
          </div>

          {/* Pay plan toggle (Floral-style) */}
          <h4 className="px-title" style={{ fontSize: "1.8rem", marginBottom: "0.5rem" }}>
            Choose how you’d like to pay:
          </h4>
          <div className="px-toggle" style={{ marginBottom: 12 }}>
            <button
              type="button"
              className={`px-toggle__btn ${payFull ? "px-toggle__btn--blue px-toggle__btn--active" : ""}`}
              style={{ minWidth: 150, padding: "0.6rem 1rem", fontSize: ".9rem" }}
              onClick={() => {
                setPayFull(true);
                setSignatureSubmitted(false);
                try { localStorage.setItem("plannerPayPlan", "full"); } catch {}
              }}
            >
              Pay Full Amount
            </button>
            <button
              type="button"
              className={`px-toggle__btn ${!payFull ? "px-toggle__btn--pink px-toggle__btn--active" : ""}`}
              style={{ minWidth: 150, padding: "0.6rem 1rem", fontSize: ".9rem" }}
              onClick={() => {
                setPayFull(false);
                setSignatureSubmitted(false);
                try { localStorage.setItem("plannerPayPlan", "monthly"); } catch {}
              }}
            >
              ${DEPOSIT_DOLLARS} Deposit + Monthly
            </button>
          </div>

          {/* One-line summary (Floral-style) */}
          <p className="px-prose-narrow" style={{ marginTop: 4 }}>
            {payFull ? (
              <>You’re paying <strong>{fmtUSD(grandTotalCents)}</strong> today.</>
            ) : (
              <>
                You’re paying <strong>{fmtUSD(depositCents)}</strong> today, then about{" "}
                <strong>{fmtUSD(perMonthCents)}</strong> monthly
                {finalDuePretty ? (
                  <> until <strong>{finalDuePretty}</strong>.</>
                ) : (
                  <> until {FINAL_DUE_DAYS} days before your wedding date.</>
                )}{" "}
                {planMonths > 1 && (
                  <>
                    (last ≈ <strong>{fmtUSD(lastPaymentCents)}</strong>)
                  </>
                )}
              </>
            )}
          </p>

          {/* Agree + Sign/Continue */}
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
                src="/assets/images/contract_signed.png"
                alt="Signed"
                style={{ width: 120, marginBottom: 4 }}
              />
              <button
                className="boutique-primary-btn"
                onClick={() => {
                  try {
                    localStorage.setItem("plannerPaymentPlan", payFull ? "full" : "monthly");
                    localStorage.setItem("plannerTotalCents", String(grandTotalCents));
                    localStorage.setItem("plannerDepositCents", String(depositCents));
                    localStorage.setItem("plannerRemainingCents", String(remainingCents));
                    localStorage.setItem(
                      "plannerFinalDueAt",
                      finalDue
                        ? new Date(
                            Date.UTC(finalDue.getUTCFullYear(), finalDue.getUTCMonth(), finalDue.getUTCDate(), 0, 0, 1)
                          ).toISOString()
                        : ""
                    );
                    localStorage.setItem("plannerPlanMonths", String(planMonths));
                    localStorage.setItem("plannerPerMonthCents", String(perMonthCents));
                    localStorage.setItem("plannerLastPaymentCents", String(lastPaymentCents));
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

          {/* Signature modal (Floral-style mini overlay) */}
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

export default PlannerContract;