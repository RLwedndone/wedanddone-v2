// src/components/yum/flows/YumContractDessert.tsx
import React, { useEffect, useRef, useState } from "react";
import SignatureCanvas from "react-signature-canvas";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../../../firebase/firebaseConfig";
import { YumStep } from "../yumTypes";

interface YumContractProps {
  total: number;
  guestCount: number;
  weddingDate: string | null; // "YYYY-MM-DD"
  dayOfWeek: string | null;
  lineItems: string[];
  signatureImage: string | null;
  setSignatureImage: (value: string) => void;
  setStep: (step: YumStep) => void;
  onClose: () => void;
  onComplete: (signatureImage: string) => void;
  dessertStyle: string;
  flavorCombo: string;

  // ✅ lets us change wording if they're already booked
  // at a shared-flow partner venue like Windmill or Desert Foothills
  isSharedFlowBookedVenue?: boolean;
  bookedVenueName?: string;
}

const DEPOSIT_PCT = 0.25;
const FINAL_DUE_DAYS = 35;
const MS_DAY = 24 * 60 * 60 * 1000;

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

const parseLocalYMD = (ymd?: string | null): Date | null => {
  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  return new Date(`${ymd}T12:00:00`); // noon guard
};

// First second of a local Date as UTC ISO (good for crons)
const asStartOfDayUTC = (d: Date) =>
  new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 1)
  );

// Months count inclusive (partial month counts as 1)
function monthsBetweenInclusive(from: Date, to: Date) {
  const a = new Date(from.getFullYear(), from.getMonth(), 1);
  const b = new Date(to.getFullYear(), to.getMonth(), 1);
  let months =
    (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
  if (to.getDate() >= from.getDate()) months += 1;
  return Math.max(1, months);
}

// First auto-charge ~ one month after booking, start-of-day UTC
function firstMonthlyChargeAtUTC(from = new Date()): string {
  const y = from.getUTCFullYear();
  const m = from.getUTCMonth();
  const d = from.getUTCDate();
  const dt = new Date(Date.UTC(y, m + 1, d, 0, 0, 1));
  return dt.toISOString();
}

const YumContractDessert: React.FC<YumContractProps> = ({
  total,
  guestCount,
  weddingDate,
  dayOfWeek,
  lineItems,
  signatureImage,
  setSignatureImage,
  setStep,
  dessertStyle,
  flavorCombo,
  onClose,
  onComplete,

  isSharedFlowBookedVenue,
  bookedVenueName,
}) => {
  const auth = getAuth();
  const [userId, setUserId] = useState<string | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [agreeChecked, setAgreeChecked] = useState(false);

  // Pay plan
  const [payFull, setPayFull] = useState(true);

  // Card-on-file consent
  const [hasCardOnFileConsent, setHasCardOnFileConsent] = useState(false);
  const [cardConsentChecked, setCardConsentChecked] = useState(false);

  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [useTextSignature, setUseTextSignature] = useState(false);
  const [typedSignature, setTypedSignature] = useState("");
  const sigCanvasRef = useRef<SignatureCanvas | null>(null);

  const [signatureSubmitted, setSignatureSubmitted] = useState<boolean>(false);

  // start this contract fresh each time (prevents sticky "monthly" & old signatures)
  useEffect(() => {
    try {
      localStorage.removeItem("yumSignature");
      localStorage.setItem("yumPaymentPlan", "full");
      localStorage.setItem("yumPayPlan", "full");
    } catch {}
  }, []);

  // ─────────────────────────────────────────────────────────────
  // Boot / progress + stash UX prefs + load consent
  // ─────────────────────────────────────────────────────────────
  useEffect(() => {
    localStorage.setItem("yumStep", "contract");
    if (dessertStyle) localStorage.setItem("yumDessertStyle", dessertStyle);
    if (flavorCombo) localStorage.setItem("yumDessertFlavor", flavorCombo);
    if (lineItems)
      localStorage.setItem("yumLineItems", JSON.stringify(lineItems));

    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) return;
      setUserId(user.uid);

      const userRef = doc(db, "users", user.uid);
      try {
        const snap = await getDoc(userRef);
        const data = snap.exists() ? snap.data() : {};
        setFirstName((data as any)?.firstName || "");
        setLastName((data as any)?.lastName || "");

        // progress
        await updateDoc(userRef, { "progress.yumYum.step": "contract" });
        await setDoc(
          doc(userRef, "yumYumData", "dessertStyle"),
          { dessertStyle },
          { merge: true }
        );
        await setDoc(
          doc(userRef, "yumYumData", "dessertFlavor"),
          { flavorCombo },
          { merge: true }
        );
        await setDoc(
          doc(userRef, "yumYumData", "lineItems"),
          { lineItems },
          { merge: true }
        );

        // 🔐 load existing card-on-file consent
        const fsConsent = (data as any)?.billing?.cardOnFileConsent;
        const localConsent =
          typeof window !== "undefined" &&
          localStorage.getItem("cardOnFileConsent") === "true";

        if (fsConsent || localConsent) {
          setHasCardOnFileConsent(true);
          try {
            localStorage.setItem("cardOnFileConsent", "true");
          } catch {}
        }
      } catch (err) {
        console.error("🔥 Error fetching/saving user info:", err);
      }
    });

    return () => unsub();
  }, [auth, dessertStyle, flavorCombo, lineItems]);

  useEffect(() => {
    localStorage.setItem("yumPaymentPlan", payFull ? "full" : "monthly");
    localStorage.setItem("yumPayPlan", payFull ? "full" : "monthly");
  }, [payFull]);

  // ─────────────────────────────────────────────────────────────
  // Payment math (25% deposit, final due −35 days)
  // ─────────────────────────────────────────────────────────────
  const totalSafe = round2(Number(total) || 0);
  const depositDollars = round2(totalSafe * DEPOSIT_PCT);
  const amountDueToday = payFull ? totalSafe : Math.min(totalSafe, depositDollars);
  const remainingBalance = round2(Math.max(0, totalSafe - amountDueToday));

  const wedding = parseLocalYMD(weddingDate || "");
  const finalDueDate = wedding
    ? new Date(wedding.getTime() - FINAL_DUE_DAYS * MS_DAY)
    : null;
  const finalDueISO = finalDueDate
    ? asStartOfDayUTC(finalDueDate).toISOString()
    : "";

  let planMonths = 0;
  let perMonthCents = 0;
  let lastPaymentCents = 0;
  let nextChargeAtISO = "";
  if (!payFull && finalDueDate && remainingBalance > 0) {
    const months = monthsBetweenInclusive(new Date(), finalDueDate);
    const remainingCents = Math.round(remainingBalance * 100);
    const base = Math.floor(remainingCents / months);
    const tail = remainingCents - base * Math.max(0, months - 1);
    planMonths = months;
    perMonthCents = base;
    lastPaymentCents = tail;
    nextChargeAtISO = firstMonthlyChargeAtUTC(new Date());
  }

  const finalDuePretty = finalDueDate
    ? finalDueDate.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : `${FINAL_DUE_DAYS} days before your wedding date`;

  // For contract UI helper
  const monthlyAmount = planMonths > 0 ? round2(perMonthCents / 100) : 0;

  // ─────────────────────────────────────────────────────────────
  // Signature helpers
  // ─────────────────────────────────────────────────────────────
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

  const handleSignClick = () => {
    if (agreeChecked && (hasCardOnFileConsent || cardConsentChecked)) {
      setShowSignatureModal(true);
    }
  };

  const handleSignatureSubmit = async () => {
    let finalSig = "";

    if (useTextSignature && typedSignature.trim()) {
      finalSig = generateImageFromText(typedSignature.trim());
    } else if (!useTextSignature && sigCanvasRef.current) {
      try {
        finalSig = sigCanvasRef.current.getCanvas().toDataURL("image/png");
      } catch (e) {
        alert("⚠️ Error capturing signature. Please try again.");
        return;
      }
    } else {
      alert("⚠️ Please enter or draw a signature before saving.");
      return;
    }

    // Persist signature + plan hints (but DON'T navigate yet)
    try {
      const plan = payFull ? "full" : "monthly";
      localStorage.setItem("yumSignature", finalSig);
      localStorage.setItem("yumPaymentPlan", plan); // keep for compatibility
      localStorage.setItem("yumPayPlan", plan); // preferred key going forward
      localStorage.setItem("yumTotal", String(totalSafe));
      localStorage.setItem(
        "yumDepositAmount",
        String(payFull ? totalSafe : depositDollars)
      );
      localStorage.setItem(
        "yumRemainingBalance",
        String(remainingBalance)
      );
      localStorage.setItem("yumFinalDueAt", finalDueISO);
      localStorage.setItem("yumFinalDuePretty", finalDuePretty);
      localStorage.setItem("yumPlanMonths", String(planMonths));
      localStorage.setItem("yumPerMonthCents", String(perMonthCents));
      localStorage.setItem("yumLastPaymentCents", String(lastPaymentCents));
      localStorage.setItem("yumNextChargeAt", nextChargeAtISO);
      localStorage.setItem("yumGuestCount", String(guestCount || 0));
      if (lineItems?.length)
        localStorage.setItem("yumLineItems", JSON.stringify(lineItems));
    } catch {}

    // 🔐 Save card-on-file consent if just granted
    try {
      if (!hasCardOnFileConsent && cardConsentChecked && userId) {
        const userRef = doc(db, "users", userId);
        await updateDoc(userRef, {
          "billing.cardOnFileConsent": true,
          "billing.cardOnFileConsentAt": serverTimestamp(),
        });
        setHasCardOnFileConsent(true);
        try {
          localStorage.setItem("cardOnFileConsent", "true");
        } catch {}
      }
    } catch (err) {
      console.error("❌ Failed to save card-on-file consent:", err);
    }

    // Update UI state and close the modal; stay on the contract screen
    setSignatureImage(finalSig);
    setSignatureSubmitted(true);
    setShowSignatureModal(false);
  };

  const paymentSummaryText = payFull
    ? `You’ll pay $${Number(totalSafe).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })} today for your desserts.`
    : `You’ll pay a $${depositDollars.toFixed(
        2
      )} deposit today and the remaining $${remainingBalance.toFixed(
        2
      )} in monthly installments, with the final payment due ${finalDuePretty}.`;

  const formattedDate = weddingDate
    ? new Date(`${weddingDate}T12:00:00`).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "your wedding date";

  const canSign =
    agreeChecked && (hasCardOnFileConsent || cardConsentChecked);

  return (
    // ⛔️ No pixie-overlay here — parent handles backdrop
    <div className="pixie-card pixie-card--modal" style={{ maxWidth: 680 }}>
      {/* 🩷 Pink X */}
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

      <div className="pixie-card__body" style={{ textAlign: "center" }}>
        <img
          src={`${import.meta.env.BASE_URL}assets/images/yum_yum_button.png`}
          alt="Dessert Icon"
          className="px-media"
          style={{ width: 110, margin: "0 auto 12px" }}
        />

        <h2 className="px-title-lg" style={{ marginBottom: 8 }}>
          Dessert Agreement
        </h2>

        <p className="px-prose-narrow" style={{ marginBottom: 6 }}>
          You’re booking desserts for{" "}
          <strong>{formattedDate}</strong> ({dayOfWeek || "TBD"}).
        </p>
        <p className="px-prose-narrow" style={{ marginBottom: 16 }}>
          Total dessert cost:{" "}
          <strong>
            $
            {Number(totalSafe).toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </strong>
        </p>

        {/* Booking Terms */}
        <div className="px-section" style={{ maxWidth: 620 }}>
          <h3
            className="px-title-lg"
            style={{ fontSize: "1.8rem", marginBottom: 8 }}
          >
            Booking Terms
          </h3>
          <ul
            className="px-prose-narrow"
            style={{
              textAlign: "left",
              margin: "0 auto",
              maxWidth: 560,
              lineHeight: 1.6,
              paddingLeft: "1.25rem",
            }}
          >
            {isSharedFlowBookedVenue ? (
              <li>
                We’ll deliver and set up at{" "}
                <strong>{bookedVenueName || "your venue"}</strong>, which already
                partners with Wed&Done for desserts. No separate venue approval
                is required.
              </li>
            ) : (
              <li>
                By signing, you confirm either (a) your venue allows outside
                bakers, or (b) you’ll book a venue that does.
              </li>
            )}

            <li>
              You may pay in full today, or place a{" "}
              <strong>
                {Math.round(DEPOSIT_PCT * 100)}% non-refundable deposit
              </strong>
              . Any remaining balance will be split into monthly installments and
              must be fully paid{" "}
              <strong>
                {FINAL_DUE_DAYS} days before your wedding date
              </strong>
              .
            </li>

            {/* ⚡ NEW: card-on-file consent text (mirror Jam/Floral) */}
            <li>
              By agreeing and completing checkout, you authorize Wed&Done and
              its payment partners to securely store your card and charge it for
              this dessert booking, including any scheduled installments and any
              remaining balance, using the payment method you select at checkout
              or any updated card you add later.
            </li>

            <li>
              Final guest count is due 30 days before your wedding. You may
              increase your guest count starting 45 days before your wedding,
              but the count cannot be lowered after booking.
            </li>
            <li>
              <strong>Cancellation &amp; Refunds:</strong> If you cancel more
              than {FINAL_DUE_DAYS} days prior, amounts paid beyond the
              non-refundable portion will be refunded less any
              non-recoverable costs already incurred. Within{" "}
              {FINAL_DUE_DAYS} days, all payments are non-refundable.
            </li>
            <li>
              <strong>Missed Payments:</strong> We’ll automatically retry your
              card. After 7 days, a $25 late fee applies; after 14 days,
              services may be suspended and this agreement may be in default.
            </li>
            <li>
              <strong>Food Safety &amp; Venue Policies:</strong> We’ll follow
              standard food-safety guidelines and comply with venue rules, which
              may limit display/location options.
            </li>
            <li>
              <strong>Force Majeure:</strong> Neither party is liable for delays
              beyond reasonable control. We’ll work in good faith to
              reschedule; if not possible, we’ll refund amounts paid beyond
              non-recoverable costs already incurred.
            </li>
            <li>
              In the unlikely event of our cancellation or issue, liability is
              limited to a refund of payments made.
            </li>
          </ul>
        </div>

        {/* Pay plan toggle — branded */}
        <h4
          className="px-title"
          style={{
            fontSize: "1.8rem",
            marginTop: 14,
            marginBottom: 8,
          }}
        >
          Choose how you’d like to pay:
        </h4>
        <div className="px-toggle" style={{ marginBottom: 12 }}>
          <button
            type="button"
            className={`px-toggle__btn ${
              payFull ? "px-toggle__btn--blue px-toggle__btn--active" : ""
            }`}
            style={{
              minWidth: 150,
              padding: "0.6rem 1rem",
              fontSize: ".9rem",
            }}
            onClick={() => {
              setPayFull(true);
              setSignatureSubmitted(false);
              try {
                localStorage.setItem("yumPayPlan", "full");
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
            style={{
              minWidth: 150,
              padding: "0.6rem 1rem",
              fontSize: ".9rem",
            }}
            onClick={() => {
              setPayFull(false);
              setSignatureSubmitted(false);
              try {
                localStorage.setItem("yumPayPlan", "monthly");
              } catch {}
            }}
          >
            Deposit + Monthly
          </button>
        </div>

        {/* Summary + Agree */}
        <p className="px-prose-narrow" style={{ marginTop: 4 }}>
          {payFull ? (
            <>
              You’ll pay{" "}
              <strong>
                $
                {Number(totalSafe).toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </strong>{" "}
              today.
            </>
          ) : (
            <>
              <strong>
                $
                {Number(depositDollars).toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </strong>{" "}
              deposit + {planMonths} monthly payments of about{" "}
              <strong>
                $
                {Number(monthlyAmount).toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </strong>
              ; final payment due <strong>{finalDuePretty}</strong>.
            </>
          )}
        </p>

        {/* Terms checkbox */}
        <div style={{ margin: "8px 0 4px" }}>
          <label
            className="px-prose-narrow"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <input
              type="checkbox"
              checked={agreeChecked}
              onChange={(e) => setAgreeChecked(e.target.checked)}
            />
            I agree to the terms above
          </label>
        </div>

        {/* Card-on-file consent checkbox or status */}
        <div style={{ marginBottom: 6 }}>
          {hasCardOnFileConsent ? (
            <p
              className="px-prose-narrow"
              style={{ fontSize: ".85rem", opacity: 0.9 }}
            >
              Card-on-file consent is already on file. You can choose which card
              to use or add a new one at checkout.
            </p>
          ) : (
            <label
              className="px-prose-narrow"
              style={{
                display: "inline-flex",
                alignItems: "flex-start",
                gap: 8,
                maxWidth: 560,
                textAlign: "left",
              }}
            >
              <input
                type="checkbox"
                checked={cardConsentChecked}
                onChange={(e) => setCardConsentChecked(e.target.checked)}
                style={{ marginTop: 3 }}
              />
              <span>
                I authorize Wed&Done and its payment partners to securely store
                my card and charge it for this dessert booking, including any
                scheduled installments and remaining balance, using the payment
                method I select at checkout or any updated card I add later.
              </span>
            </label>
          )}
        </div>

        {/* Sign / Continue */}
        {!signatureSubmitted ? (
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              marginTop: "1rem",
            }}
          >
            <button
              className="boutique-primary-btn"
              onClick={handleSignClick}
              disabled={!canSign}
              style={{
                width: 250,
                opacity: canSign ? 1 : 0.5,
                cursor: canSign ? "pointer" : "not-allowed",
              }}
            >
              Sign Contract
            </button>
          </div>
        ) : (
          <div className="px-cta-col" style={{ marginTop: 8 }}>
            <img
              src={`${import.meta.env.BASE_URL}assets/images/contract_signed.png`}
              alt="Contract Signed"
              className="px-media"
              style={{ maxWidth: 140 }}
            />
            <button
              className="boutique-primary-btn"
              onClick={() => {
                // ----- persist all contract selections -----
                try {
                  const plan = payFull ? "full" : "monthly";
                  localStorage.setItem("yumPaymentPlan", plan);
                  localStorage.setItem("yumPayPlan", plan);
                  localStorage.setItem("yumTotal", String(totalSafe));
                  localStorage.setItem(
                    "yumDepositAmount",
                    String(payFull ? totalSafe : depositDollars)
                  );
                  localStorage.setItem(
                    "yumRemainingBalance",
                    String(remainingBalance)
                  );
                  localStorage.setItem("yumFinalDueAt", finalDueISO);
                  localStorage.setItem(
                    "yumFinalDuePretty",
                    finalDuePretty
                  );
                  localStorage.setItem(
                    "yumPlanMonths",
                    String(planMonths)
                  );
                  localStorage.setItem(
                    "yumPerMonthCents",
                    String(perMonthCents)
                  );
                  localStorage.setItem(
                    "yumLastPaymentCents",
                    String(lastPaymentCents)
                  );
                  localStorage.setItem(
                    "yumNextChargeAt",
                    nextChargeAtISO
                  );
                } catch {}

                // signature to hand to parent
                const sig =
                  localStorage.getItem("yumSignature") ||
                  signatureImage ||
                  "";

                localStorage.setItem("yumStep", "dessertCheckout");
                setStep("dessertCheckout");

                setTimeout(() => onComplete(sig), 0);
              }}
              style={{ width: 250 }}
            >
              Continue to Payment
            </button>
            <button
              className="boutique-back-btn"
              onClick={() => {
                localStorage.setItem("yumStep", "dessertCart");
                setStep("dessertCart");
              }}
              style={{ width: 250 }}
            >
              ⬅ Back to Cart
            </button>
          </div>
        )}
      </div>

      {/* Signature modal — single overlay with blue X; scrollbar hidden */}
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
            className="pixie-card pixie-card--modal"
            style={{
              maxWidth: 520,
              position: "relative",
              overflowY: "hidden",
            }}
          >
            <button
              className="pixie-card__close"
              onClick={() => setShowSignatureModal(false)}
              aria-label="Close"
            >
              <img
                src={`${import.meta.env.BASE_URL}assets/icons/blue_ex.png`}
                alt="Close"
              />
            </button>

            <div
              className="pixie-card__body"
              style={{ textAlign: "center" }}
            >
              <h3
                className="px-title-lg"
                style={{
                  fontSize: "1.8rem",
                  marginBottom: 12,
                }}
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
                  className={`px-toggle__btn ${
                    !useTextSignature
                      ? "px-toggle__btn--blue px-toggle__btn--active"
                      : ""
                  }`}
                  style={{ minWidth: 110, padding: ".5rem 1rem" }}
                  aria-pressed={!useTextSignature}
                >
                  Draw
                </button>
                <button
                  type="button"
                  onClick={() => setUseTextSignature(true)}
                  className={`px-toggle__btn ${
                    useTextSignature
                      ? "px-toggle__btn--pink px-toggle__btn--active"
                      : ""
                  }`}
                  style={{ minWidth: 110, padding: ".5rem 1rem" }}
                  aria-pressed={useTextSignature}
                >
                  Type
                </button>
              </div>

              {useTextSignature ? (
                <input
                  type="text"
                  value={typedSignature}
                  onChange={(e) =>
                    setTypedSignature(e.target.value)
                  }
                  placeholder="Type your name"
                  className="px-input"
                  style={{
                    maxWidth: 420,
                    margin: "0 auto 12px",
                  }}
                />
              ) : (
                <SignatureCanvas
                  penColor="#2c62ba"
                  ref={sigCanvasRef}
                  backgroundColor="#ffffff"
                  canvasProps={{
                    width: 420,
                    height: 160,
                    style: {
                      border: "1px solid #e5e7f0",
                      borderRadius: 10,
                      width: "100%",
                      maxWidth: 420,
                      margin: "0 auto 12px",
                      display: "block",
                    },
                  }}
                />
              )}

              <button
                className="boutique-primary-btn"
                onClick={handleSignatureSubmit}
                style={{
                  width: 260,
                  margin: "0 auto",
                }}
              >
                Save Signature
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default YumContractDessert;