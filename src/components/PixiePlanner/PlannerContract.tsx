import React, { useEffect, useState, useRef } from "react";
import SignatureCanvas from "react-signature-canvas";
import { auth, db } from "../../firebase/firebaseConfig";
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
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
  onClose: () => void;
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
  onClose,
}) => {
  const {
    guestCount: guestCountFromProps,
    weddingDate,
    dayOfWeek,
  } = bookingData;

  // UI state
  const [agreeChecked, setAgreeChecked] = useState(false);
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [useTextSignature, setUseTextSignature] = useState(false);
  const [typedSignature, setTypedSignature] = useState("");
  const sigCanvasRef = useRef<SignatureCanvas | null>(null);

  // pulled-from-profile fallbacks
  const [fetchedWeddingDate, setFetchedWeddingDate] = useState<string | null>(
    null
  );
  const [fetchedGuestCount, setFetchedGuestCount] = useState<number | null>(
    null
  );

  // ✅ global card-on-file consent status (MUST be declared before any useEffect)
  const [hasCardOnFileConsent, setHasCardOnFileConsent] = useState(false);
  const [cardConsentChecked, setCardConsentChecked] = useState(false);

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
  const fmtUSD = (cents: number) =>
    `$${Number(cents / 100).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  const grandTotalCents = Math.max(
    0,
    Math.round((bookingData.total || 0) * 100)
  );
  const depositCents = Math.min(grandTotalCents, DEPOSIT_DOLLARS * 100);
  const remainingCents = Math.max(0, grandTotalCents - depositCents);

  const weddingDateObj = hasDate ? new Date(dateToUse + "T12:00:00") : null;
  const finalDue = weddingDateObj
    ? new Date(weddingDateObj.getTime() - FINAL_DUE_DAYS * 24 * 60 * 60 * 1000)
    : null;

  const finalDuePretty = finalDue
    ? finalDue.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "";

  const today = new Date();
  function monthsBetweenInclusive(from: Date, to: Date) {
    const a = new Date(from.getFullYear(), from.getMonth(), 1);
    const b = new Date(to.getFullYear(), to.getMonth(), 1);
    let months =
      (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
    if (to.getDate() >= from.getDate()) months += 1;
    return Math.max(1, months);
  }

  const planMonths =
    weddingDateObj && finalDue ? monthsBetweenInclusive(today, finalDue) : 1;

  const perMonthCents =
    planMonths > 0 ? Math.floor(remainingCents / planMonths) : remainingCents;

  const lastPaymentCents = Math.max(
    0,
    remainingCents - perMonthCents * Math.max(0, planMonths - 1)
  );

  // 🔐 Consent rule (same shape as Floral)
  const needsCardConsent = !hasCardOnFileConsent;
  const canSign = agreeChecked && (!needsCardConsent || cardConsentChecked);

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
    ctx.fillText(
      (text || "").trim() || " ",
      canvas.width / 2,
      canvas.height / 2
    );
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
          finalSignature = (sc.getCanvas() as HTMLCanvasElement).toDataURL(
            "image/png"
          );
        } catch {
          alert("Something went wrong when capturing your signature. Try again!");
          return;
        }
      }
    } else {
      alert("Please enter or draw a signature before saving.");
      return;
    }

    try {
      localStorage.setItem("plannerSignature", finalSignature);
    } catch {}

    setSignatureImage(finalSignature);
    setSignatureSubmitted(true);
    setShowSignatureModal(false);

    const user = auth.currentUser;
    if (user) {
      const payload: any = {
        pixiePlannerSigned: true,
        signatureImageUrl: finalSignature,
      };

      // ✅ If this is the first time they’re giving card-on-file consent,
      // record it globally (only when they explicitly check the box).
      if (!hasCardOnFileConsent && cardConsentChecked) {
        payload.cardOnFileConsent = true;
        payload.cardOnFileConsentAt = serverTimestamp();
        try {
          localStorage.setItem(`cardOnFileConsent_${user.uid}`, "true");
        } catch {}
        setHasCardOnFileConsent(true);
      }

      await setDoc(doc(db, "users", user.uid), payload, { merge: true });
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

  // ✅ Robust consent load: wait for auth, then check localStorage, then Firestore
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) return;

      const key = `cardOnFileConsent_${user.uid}`;

      // 1) LocalStorage quick check
      let localFlag = false;
      try {
        localFlag = localStorage.getItem(key) === "true";
      } catch {}

      if (localFlag) {
        setHasCardOnFileConsent(true);
        return;
      }

      // 2) Firestore check
      try {
        const snap = await getDoc(doc(db, "users", user.uid));
        if (snap.exists()) {
          const data = snap.data() as any;
          if (data?.cardOnFileConsent) {
            setHasCardOnFileConsent(true);
            try {
              localStorage.setItem(key, "true");
            } catch {}
          }
        }
      } catch (err) {
        console.error("❌ Failed to load cardOnFileConsent:", err);
      }
    });

    return () => unsubscribe();
  }, []);

  return (
    <div className="pixie-card">
      {/* 🩷 Pink X — closes the planner overlay */}
      <button className="pixie-card__close" onClick={onClose} aria-label="Close">
        <img
          src={`${import.meta.env.BASE_URL}assets/icons/pink_ex.png`}
          alt="Close"
        />
      </button>

      <div className="pixie-card__body">
        <div className="px-center">
          {/* Header media */}
          <img
            src={`${import.meta.env.BASE_URL}assets/images/planner_button.png`}
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
            {dayOfWeek ? ` (${dayOfWeek})` : ""} for{" "}
            <strong>{finalGuestCount} guests</strong>. The total is{" "}
            <strong>{fmtUSD(grandTotalCents)}</strong>.
          </p>

          {/* No-date note */}
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
              Add your wedding date anytime—your final balance will be due{" "}
              {FINAL_DUE_DAYS} days before it.
            </div>
          )}

          {/* Booking Terms */}
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
                <strong>Payment Options:</strong> You may pay in full today, or place a{" "}
                <strong>non-refundable deposit</strong> and pay the remaining balance in monthly
                installments. All installments must be completed no later than{" "}
                <strong>{FINAL_DUE_DAYS} days before your wedding date</strong>, and any unpaid
                balance will be automatically charged on that date.
              </li>
              <br />

              <li>
                <strong>Card Authorization:</strong> By signing this agreement, you authorize
                Wed&Done to securely store your card for recurring or future payments. Once a
                card is on file, all <strong>Deposit + Monthly</strong> plans will use that saved
                card for every installment and the final balance. Paid-in-full purchases may be
                made using your saved card or a new card. Your card details are encrypted and
                processed by Stripe, and you may update or replace your saved card at any time
                through your Wed&Done account.
              </li>
              <br />

              <li>
                <strong>Refunds &amp; Cancellations:</strong> At minimum, ${DEPOSIT_DOLLARS} is
                non-refundable. If you cancel more than {FINAL_DUE_DAYS} days prior, amounts paid
                beyond the non-refundable portion are refundable (less non-recoverable costs already
                incurred). Cancel &le;{FINAL_DUE_DAYS} days: payments are non-refundable.
              </li>
              <br />

              <li>
                <strong>Rescheduling:</strong> May be possible based on vendor availability and may
                incur additional fees.
              </li>
              <br />

              <li>
                <strong>Missed Payments:</strong> We’ll retry your card automatically. After 7 days
                a $25 late fee may apply; after 14 days, services may be suspended and the agreement
                may be in default (amounts paid, incl. the deposit, may be retained).
              </li>
              <br />

              <li>
                <strong>Liability &amp; Substitutions:</strong> Wed&amp;Done isn’t responsible for
                venue restrictions or consequential damages. Reasonable substitutions may be made as
                needed. Liability is limited to amounts paid for coordination services under this
                agreement.
              </li>
              <br />

              <li>
                <strong>Force Majeure:</strong> Neither party is liable for delays beyond reasonable
                control. We’ll work in good faith to reschedule; if not possible, we’ll refund
                amounts paid beyond non-recoverable costs.
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
              className={`px-toggle__btn ${
                payFull ? "px-toggle__btn--blue px-toggle__btn--active" : ""
              }`}
              style={{ minWidth: 150, padding: "0.6rem 1rem", fontSize: ".9rem" }}
              onClick={() => {
                setPayFull(true);
                setSignatureSubmitted(false);
                setCardConsentChecked(false);
                try {
                  localStorage.setItem("plannerPayPlan", "full");
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
                  localStorage.setItem("plannerPayPlan", "monthly");
                } catch {}
              }}
            >
              ${DEPOSIT_DOLLARS} Deposit + Monthly
            </button>
          </div>

          {/* One-line summary */}
          <p className="px-prose-narrow" style={{ marginTop: 4 }}>
            {payFull ? (
              <>
                You’re paying <strong>{fmtUSD(grandTotalCents)}</strong> today.
              </>
            ) : (
              <>
                You’re paying <strong>{fmtUSD(depositCents)}</strong> today, then about{" "}
                <strong>{fmtUSD(perMonthCents)}</strong> monthly
                {finalDuePretty ? (
                  <>
                    {" "}
                    until <strong>{finalDuePretty}</strong>.
                  </>
                ) : (
                  <>
                    {" "}
                    until {FINAL_DUE_DAYS} days before your wedding date.
                  </>
                )}{" "}
                {planMonths > 1 && (
                  <>
                    (last ≈ <strong>{fmtUSD(lastPaymentCents)}</strong>)
                  </>
                )}
              </>
            )}
          </p>

          {/* UX note: monthly after card is on file uses that card and you can't swap at checkout */}
          {!payFull && hasCardOnFileConsent && (
            <div
              style={{
                marginTop: "0.25rem",
                marginBottom: "0.75rem",
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid #f3b1c9",
                background: "#fff5fa",
                fontSize: "0.95rem",
                lineHeight: 1.55,
                textAlign: "left",
                maxWidth: 560,
                marginInline: "auto",
              }}
            >
              Monthly plans will be charged to your saved card on file. If you don't have one on file yet, you'll add one during checkout. If you want to use a different card for this purchase, choose Pay Full Amount instead.
            </div>
          )}

          {/* Agree + Sign / Continue */}
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

          {/* Global card-on-file consent (only appears if they haven't consented yet) */}
          {needsCardConsent && (
            <div
              style={{
                margin: "0.25rem 0 0.75rem",
                fontSize: ".9rem",
                textAlign: "left",
                maxWidth: 560,
                marginInline: "auto",
              }}
            >
              <label>
                <input
                  type="checkbox"
                  checked={cardConsentChecked}
                  onChange={(e) => setCardConsentChecked(e.target.checked)}
                  style={{ marginRight: 8 }}
                />
                I authorize Wed&amp;Done and our payment processor (Stripe) to securely store my
                card and to charge it for planner installments, any remaining planner balance, and
                future Wed&amp;Done bookings I choose to make, as described in the payment terms
                above.
              </label>
            </div>
          )}

          <div className="px-cta-col" style={{ marginTop: 8 }}>
            {!signatureSubmitted ? (
              <button
                className="boutique-primary-btn"
                onClick={() => {
                  if (!canSign) return;
                  setShowSignatureModal(true);
                }}
                disabled={!canSign}
                style={{ width: 260 }}
              >
                Sign Contract
              </button>
            ) : (
              <>
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
                        "plannerPaymentPlan",
                        payFull ? "full" : "monthly"
                      );
                      localStorage.setItem(
                        "plannerTotalCents",
                        String(grandTotalCents)
                      );
                      localStorage.setItem(
                        "plannerDepositCents",
                        String(depositCents)
                      );
                      localStorage.setItem(
                        "plannerRemainingCents",
                        String(remainingCents)
                      );
                      localStorage.setItem(
                        "plannerFinalDueAt",
                        finalDue
                          ? new Date(
                              Date.UTC(
                                finalDue.getUTCFullYear(),
                                finalDue.getUTCMonth(),
                                finalDue.getUTCDate(),
                                0,
                                0,
                                1
                              )
                            ).toISOString()
                          : ""
                      );
                      localStorage.setItem("plannerPlanMonths", String(planMonths));
                      localStorage.setItem(
                        "plannerPerMonthCents",
                        String(perMonthCents)
                      );
                      localStorage.setItem(
                        "plannerLastPaymentCents",
                        String(lastPaymentCents)
                      );
                    } catch {}
                    onContinue();
                  }}
                  style={{ width: 260 }}
                >
                  Continue to Checkout
                </button>
              </>
            )}

            <button
              className="boutique-back-btn"
              onClick={onBack}
              style={{ width: 260, marginTop: 10 }}
            >
              ⬅ Back to Cart
            </button>
          </div>

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

export default PlannerContract;