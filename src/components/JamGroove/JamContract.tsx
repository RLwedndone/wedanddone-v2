// src/components/jam/JamContractScreen.tsx
import React, { useState, useRef, useEffect } from "react";
import SignatureCanvas from "react-signature-canvas";
import { getAuth } from "firebase/auth";
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
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
  onSuccess: () => void; // not used here but kept for compatibility
}

/* ───────── helpers ───────── */
const MS_DAY = 24 * 60 * 60 * 1000;
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

const parseLocalYMD = (ymd?: string | null): Date | null => {
  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  return new Date(`${ymd}T12:00:00`); // local-noon guard to dodge timezone shifts
};

const asStartOfDayUTC = (d: Date) =>
  new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 1)
  ).toISOString();

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
  let months =
    (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
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

  // global card-on-file consent status (shared with Floral)
  const [hasCardOnFileConsent, setHasCardOnFileConsent] = useState(false);
  const [cardConsentChecked, setCardConsentChecked] = useState(false);

    // 🔍 unified check for cardOnFileConsent (per-user LS + Firestore)
    useEffect(() => {
      const auth = getAuth();
      const user = auth.currentUser;
      if (!user) return;
  
      const key = `cardOnFileConsent_${user.uid}`;
  
      // 1) LocalStorage quick check (per user)
      let localFlag = false;
      try {
        localFlag = localStorage.getItem(key) === "true";
      } catch {
        /* ignore */
      }
  
      if (localFlag) {
        setHasCardOnFileConsent(true);
        return;
      }
  
      // 2) Firestore check (per user)
      (async () => {
        try {
          const snap = await getDoc(doc(db, "users", user.uid));
          if (snap.exists()) {
            const data = snap.data() as any;
            if (data?.cardOnFileConsent) {
              setHasCardOnFileConsent(true);
              try {
                localStorage.setItem(key, "true");
              } catch {
                /* ignore */
              }
            }
          }
        } catch (err) {
          console.error("❌ Failed to load cardOnFileConsent:", err);
        }
      })();
    }, []);

  /* ───────── values from cart / user date ───────── */
  const total = Number(bookingData?.total || 0);
  const formattedTotal = total.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  // Flat $750 deposit (capped by total)
  const FLAT_DEPOSIT = 750;
  const depositAmount = round2(Math.min(FLAT_DEPOSIT, total));
  const remainingBalance = round2(Math.max(0, total - depositAmount));
  const depositDisplay = depositAmount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

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
  const finalDueDate = weddingDate
    ? new Date(weddingDate.getTime() - 35 * MS_DAY)
    : null;

  const finalDuePretty = finalDueDate
    ? finalDueDate.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "35 days before your wedding date";
  const finalDueISO = finalDueDate ? asStartOfDayUTC(finalDueDate) : "";

  // Monthly plan math
  let planMonths = 0;
  let perMonthCents = 0;
  let lastPaymentCents = 0;
  let nextChargeAtISO = "";

  if (!payFull && finalDueDate && remainingBalance > 0) {
    planMonths = monthsBetweenInclusive(new Date(), finalDueDate);
    const remainingCents = Math.round(remainingBalance * 100);
    const base = Math.floor(remainingCents / planMonths);
    perMonthCents = base;
    lastPaymentCents = remainingCents - base * Math.max(0, planMonths - 1);
    nextChargeAtISO = firstMonthlyChargeAtUTC(new Date());
  }

  const formattedDate = weddingDate
    ? weddingDate.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "your wedding date";
  const dayOfWeek = bookingData.dayOfWeek || "";

  const perInstallment =
  !payFull && planMonths > 0 ? perMonthCents / 100 : 0;

  /* ───────── signature helpers (same pattern as Floral) ───────── */
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
        finalSignature = sigCanvasRef.current
          .getCanvas()
          .toDataURL("image/png");
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

    const auth = getAuth();
    const user = auth.currentUser;
    if (user) {
      try {
        const payload: any = {
          jamSigned: true,
          signatureImageUrl: finalSignature,
        };

                // ✅ record global card-on-file consent if this is the first time
                if (!hasCardOnFileConsent && cardConsentChecked) {
                  payload.cardOnFileConsent = true;
                  payload.cardOnFileConsentAt = serverTimestamp();
        
                  const key = `cardOnFileConsent_${user.uid}`;
                  try {
                    localStorage.setItem(key, "true");
                  } catch {
                    /* ignore */
                  }
        
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
  // - Once consent exists, we only require the main "I agree" checkbox.
  const needsCardConsent = !hasCardOnFileConsent;

  const canSign =
    agreeChecked && (hasCardOnFileConsent || cardConsentChecked);

  /* ───────── UI payment summary (used in checkout/PDF) ───────── */
  let paymentSummaryText: string;

  if (payFull) {
    paymentSummaryText = `You’re paying $${formattedTotal} today.`;
  } else if (planMonths > 0 && perMonthCents > 0) {
    const perMonthDisplay = (perMonthCents / 100).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    const lastPaymentDisplay = (lastPaymentCents / 100).toLocaleString(
      undefined,
      {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }
    );
    paymentSummaryText = `You’ll pay $${depositDisplay} today, then monthly through ${finalDuePretty}. Est. ${planMonths} payments of $${perMonthDisplay}${
      planMonths > 1 ? ` (last ≈ $${lastPaymentDisplay})` : ""
    }.`;
  } else {
    // Fallback if we don't have a valid schedule (no date, etc.)
    paymentSummaryText = `You’ll pay $${depositDisplay} today, then monthly until 35 days before your wedding date.`;
  }

  return (
    <div className="pixie-card wd-page-turn">
      {/* Pink X */}
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

      {/* Standard card body */}
      <div className="pixie-card__body">
        <div className="px-center">
          {/* Button image */}
          <img
            src={`${import.meta.env.BASE_URL}assets/images/jam_groove_button.png`}
            alt="Jam & Groove"
            className="px-media"
            style={{ maxWidth: 100, margin: "6px auto 12px" }}
          />

          {/* Title + booking summary (mirrors Floral) */}
          <h2 className="px-title-lg" style={{ marginBottom: "0.5rem" }}>
            Jam &amp; Groove Agreement
          </h2>

          <p className="px-prose-narrow" style={{ marginBottom: 12 }}>
            You’re booking{" "}
            <strong>DJ / music services through Jam &amp; Groove</strong> for{" "}
            <strong>{formattedDate}</strong>
            {dayOfWeek ? ` (${dayOfWeek})` : ""}. Your total package amount is{" "}
            <strong>${formattedTotal}</strong>.
          </p>

          {/* Booking Terms — now split: Payment Options + Card Authorization */}
          <div className="px-section" style={{ maxWidth: 620 }}>
            <h3
              className="px-title-lg"
              style={{ fontSize: "1.8rem", marginBottom: "0.5rem" }}
            >
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
                <strong>Payment Options.</strong> You may pay in full today, or
                place a <strong>non-refundable $750 deposit</strong> and pay the
                remaining balance in monthly installments. All installments must
                be completed no later than{" "}
                <strong>35 days before your wedding date</strong>, and any
                unpaid balance will be automatically charged on that date.
              </li>
              <br />
              <li>
                <strong>Card Authorization.</strong> By completing this
                purchase, you authorize Wed&amp;Done and our payment processor
                (Stripe) to securely store your card and to charge it for
                Jam&nbsp;&amp;&nbsp;Groove installment payments, any remaining
                Jam&nbsp;&amp;&nbsp;Groove balance due under this agreement, and
                any future Wed&amp;Done bookings you choose to make for your
                convenience. Your card details are encrypted and handled by
                Stripe, and you can update or replace your saved card at any
                time through your Wed&amp;Done account.
              </li>
              <br />
              <li>
                <strong>Cancellation &amp; Refunds.</strong> If you cancel more
                than 35 days before your event, amounts you’ve paid beyond the
                non-refundable portion and any non-recoverable costs are
                refundable. If you cancel{" "}
                <strong>35 days or fewer before the event</strong>, all payments
                made are non-refundable.
              </li>
              <br />
              <li>
                <strong>Missed Payments.</strong> If a payment attempt fails,
                we’ll automatically re-try your card. After{" "}
                <strong>7 days</strong>, a <strong>$25 late fee</strong> may be
                applied. After <strong>14 days</strong> of non-payment, services
                may be paused and this agreement may be considered in default.
              </li>
              <br />
              <li>
                <strong>Performance &amp; Logistics.</strong> Your DJ / music
                team will typically arrive about{" "}
                <strong>1 hour before guest arrival</strong> for setup and sound
                check. You agree to provide safe power, appropriate coverage or
                shade if outdoors, and any venue access needed. Travel outside
                the Phoenix Metro or to certain locations may incur additional
                fees as discussed in your package.
              </li>
              <br />
              <li>
                <strong>Force Majeure.</strong> If events outside anyone’s
                control (including but not limited to extreme weather, natural
                disasters, government restrictions, or serious illness) prevent
                performance, both parties will work in good faith to reschedule.
                If rescheduling isn’t possible, amounts you’ve paid beyond
                non-recoverable costs are refunded. If Jam &amp; Groove must
                cancel for any reason within our control and a suitable
                replacement cannot be arranged, liability is limited to a refund
                of payments made.
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
                  localStorage.setItem("jamPayPlan", "full");
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
                  localStorage.setItem("jamPayPlan", "monthly");
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
                  <> until 35 days before your wedding date.</>
                )}
              </>
            )}
          </p>

          {/* Agree to terms */}
          <div style={{ margin: "0.9rem 0 0.5rem" }}>
            <label className="px-prose-narrow">
              <input
                type="checkbox"
                checked={agreeChecked}
                onChange={(e) => setAgreeChecked(e.target.checked)}
                style={{ marginRight: 8 }}
              />
              I have read and agree to the Jam &amp; Groove Agreement and
              booking terms above.
            </label>
          </div>

          {/* Global card-on-file consent (same rules as Floral) */}
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
                I authorize Wed&amp;Done and our payment processor (Stripe) to
                securely store my card and to charge it for Jam &amp; Groove
                installments, any remaining Jam &amp; Groove balance, and future
                Wed&amp;Done bookings I choose to make, as described in the
                payment terms above.
              </label>
            </div>
          )}

          {/* UX note: monthly after card is on file uses that card and you can't swap at checkout */}
          {!payFull && hasCardOnFileConsent && (
            <div
              className="px-note"
              style={{
                margin: "0.75rem auto",
                background: "#f7f8ff",
                border: "1px solid #d9ddff",
                borderRadius: 10,
                padding: "8px 12px",
                fontSize: ".9rem",
                maxWidth: 560,
                textAlign: "left",
              }}
            >
              Monthly plans will be charged to your saved card on file. If you
              want to use a different card, choose Pay Full Amount instead.
            </div>
          )}

          {/* Actions — BEFORE signature: only Sign + Back. AFTER: Continue + Back. */}
          {!signatureSubmitted ? (
            <div className="px-cta-col" style={{ marginTop: 8 }}>
              <button
                className="boutique-primary-btn"
                onClick={() => canSign && setShowSignatureModal(true)}
                disabled={!canSign}
              >
                Sign Contract
              </button>
              <button
                className="boutique-back-btn"
                onClick={onBack}
                style={{ marginTop: 10 }}
              >
                ⬅ Back to Cart
              </button>
            </div>
          ) : (
            <div className="px-cta-col" style={{ marginTop: 8 }}>
              <img
                src={`${import.meta.env.BASE_URL}assets/images/contract_signed.png`}
                alt="Contract signed"
                style={{ width: 120, marginBottom: 4 }}
              />
              <button
                className="boutique-primary-btn"
                onClick={() => {
                  try {
                    const plan = payFull ? "full" : "monthly";
                    const totalCents = Math.round(total * 100);
                    const depositCents = payFull
                      ? totalCents
                      : Math.round(depositAmount * 100);
                    const remainingCents = payFull
                      ? 0
                      : Math.max(0, totalCents - depositCents);

                    localStorage.setItem("jamPaymentPlan", plan);
                    localStorage.setItem("jamTotalCents", String(totalCents));

                    // flat deposit fields used by checkout
                    localStorage.setItem(
                      "jamDepositAmount",
                      String(depositAmount)
                    );
                    localStorage.setItem(
                      "jamRemainingBalance",
                      String(remainingBalance)
                    );
                    localStorage.setItem("jamDepositType", "flat");

                    // Monthly plan scheduling hints
                    localStorage.setItem(
                      "jamPlanMonths",
                      String(payFull ? 0 : planMonths)
                    );
                    localStorage.setItem(
                      "jamPerMonthCents",
                      String(payFull ? 0 : perMonthCents)
                    );
                    localStorage.setItem(
                      "jamLastPaymentCents",
                      String(payFull ? 0 : lastPaymentCents)
                    );
                    localStorage.setItem(
                      "jamNextChargeAt",
                      payFull ? "" : nextChargeAtISO
                    );
                    localStorage.setItem(
                      "jamFinalDueAt",
                      payFull ? "" : finalDueISO
                    );
                    localStorage.setItem(
                      "jamFinalDuePretty",
                      finalDuePretty
                    );

                    // send the exact summary string we show here down to checkout/PDF
                    localStorage.setItem(
                      "jamPaymentSummaryText",
                      paymentSummaryText
                    );

                    if (bookingData.weddingDate)
                      localStorage.setItem(
                        "jamWeddingDate",
                        bookingData.weddingDate
                      );
                    if (bookingData.lineItems)
                      localStorage.setItem(
                        "jamLineItems",
                        JSON.stringify(bookingData.lineItems)
                      );
                  } catch {
                    // swallow localStorage issues
                  }
                  onContinue();
                }}
              >
                Continue to Checkout
              </button>
              <button
                className="boutique-back-btn"
                onClick={onBack}
                style={{ marginTop: 10 }}
              >
                ⬅ Back to Cart
              </button>
            </div>
          )}

          {/* Signature modal — same UX pattern as Floral */}
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
                  Sign your Jam &amp; Groove Agreement
                </h3>

                <p
                  className="px-prose-narrow"
                  style={{ marginBottom: "0.75rem" }}
                >
                  You can either draw your signature or type it and we’ll render
                  it in a script font.
                </p>

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

export default JamContractScreen;