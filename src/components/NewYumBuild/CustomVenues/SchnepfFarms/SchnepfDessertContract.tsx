import React, { useEffect, useRef, useState } from "react";
import SignatureCanvas from "react-signature-canvas";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { db } from "../../../../firebase/firebaseConfig";

interface SchnepfDessertContractProps {
  total: number;
  guestCount: number;
  weddingDate: string | null; // "YYYY-MM-DD"
  dayOfWeek: string | null;
  lineItems: string[];
  signatureImage: string | null;
  setSignatureImage: (value: string) => void;

  /** Navigate back to the SchnepfDessertCart */
  onBack: () => void;

  /** Advance to SchnepfDessertCheckout (we’ll pass the saved signature dataURL) */
  onContinueToCheckout: (signatureImage: string) => void;

  /** Close overlay */
  onClose: () => void;

  /** Summary labels (for the small cake/tiered UI lines) */
  dessertStyle: "tieredCake" | "smallCakeTreats" | "treatsOnly";
  flavorCombo: string; // e.g., "Almond Raspberry + Vanilla Custard"
}

const DEPOSIT_PCT = 0.25;
const FINAL_DUE_DAYS = 35;
const MS_DAY = 24 * 60 * 60 * 1000;

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

const parseLocalYMD = (ymd?: string | null): Date | null => {
  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  return new Date(`${ymd}T12:00:00`);
};

// First second of a local Date as UTC ISO (useful for crons)
const asStartOfDayUTC = (d: Date) =>
  new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 1));

// Months count inclusive (partial month counts as 1)
function monthsBetweenInclusive(from: Date, to: Date) {
  const a = new Date(from.getFullYear(), from.getMonth(), 1);
  const b = new Date(to.getFullYear(), to.getMonth(), 1);
  let months = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
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

const SchnepfDessertContract: React.FC<SchnepfDessertContractProps> = ({
  total,
  guestCount,
  weddingDate,
  dayOfWeek,
  lineItems,
  signatureImage,
  setSignatureImage,
  onBack,
  onContinueToCheckout,
  onClose,
  dessertStyle,
  flavorCombo,
}) => {
  const auth = getAuth();
  const [userId, setUserId] = useState<string | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

  // Local pay-plan state (Schnepf namespaced keys)
  const initialPlan = (localStorage.getItem("schnepfDessertPayPlan") ||
    localStorage.getItem("schnepfDessertPaymentPlan") ||
    "full") as "full" | "monthly";
  const [payFull, setPayFull] = useState(initialPlan === "full");

  const [agreeChecked, setAgreeChecked] = useState(false);
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [useTextSignature, setUseTextSignature] = useState(false);
  const [typedSignature, setTypedSignature] = useState("");
  const sigCanvasRef = useRef<SignatureCanvas | null>(null);

  // Was a signature already saved?
  const [signatureSubmitted, setSignatureSubmitted] = useState<boolean>(() =>
    Boolean(signatureImage || localStorage.getItem("schnepfDessertSignature"))
  );

  // ─────────────────────────────────────────────────────────────
  // Boot / progress + Schnepf-namespaced mirrors
  // ─────────────────────────────────────────────────────────────
  useEffect(() => {
    try {
      localStorage.setItem("schnepfYumStep", "dessertContract");
      if (dessertStyle) localStorage.setItem("schnepfDessertStyle", dessertStyle);
      if (flavorCombo) localStorage.setItem("schnepfDessertFlavor", flavorCombo);
      if (lineItems) localStorage.setItem("schnepfYumLineItems", JSON.stringify(lineItems));
    } catch {}

    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) return;
      setUserId(user.uid);

      const userRef = doc(db, "users", user.uid);
      try {
        const snap = await getDoc(userRef);
        const data = snap.exists() ? (snap.data() as any) : {};
        setFirstName(data?.firstName || "");
        setLastName(data?.lastName || "");

        // Pin progress + store little snapshots
        await updateDoc(userRef, { "progress.yumYum.step": "schnepfDessertContract" });
        await setDoc(doc(userRef, "yumYumData", "schnepfDessertStyle"), { dessertStyle }, { merge: true });
        await setDoc(doc(userRef, "yumYumData", "schnepfDessertFlavor"), { flavorCombo }, { merge: true });
        await setDoc(doc(userRef, "yumYumData", "schnepfLineItems"), { lineItems }, { merge: true });
      } catch (err) {
        console.error("🔥 [Schnepf][Contract] Error fetching/saving user info:", err);
      }
    });

    return () => unsub();
  }, [auth, dessertStyle, flavorCombo, lineItems]);

  useEffect(() => {
    try {
      const plan = payFull ? "full" : "monthly";
      localStorage.setItem("schnepfDessertPaymentPlan", plan);
      localStorage.setItem("schnepfDessertPayPlan", plan);
    } catch {}
  }, [payFull]);

  // ─────────────────────────────────────────────────────────────
  // Payment math (25% deposit, final due −35 days)
  // ─────────────────────────────────────────────────────────────
  const totalSafe = round2(Number(total) || 0);
  const depositDollars = round2(totalSafe * DEPOSIT_PCT);
  const amountDueToday = payFull ? totalSafe : Math.min(totalSafe, depositDollars);
  const remainingBalance = round2(Math.max(0, totalSafe - amountDueToday));

  const wedding = parseLocalYMD(weddingDate || "");
  const finalDueDate = wedding ? new Date(wedding.getTime() - FINAL_DUE_DAYS * MS_DAY) : null;
  const finalDueISO = finalDueDate ? asStartOfDayUTC(finalDueDate).toISOString() : "";

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
    ? finalDueDate.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
    : `${FINAL_DUE_DAYS} days before your wedding date`;

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
    if (agreeChecked) setShowSignatureModal(true);
  };

  const handleSignatureSubmit = () => {
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

    // Persist signature + plan hints (Schnepf namespaced)
    try {
      const plan = payFull ? "full" : "monthly";
      localStorage.setItem("schnepfDessertSignature", finalSig);
      localStorage.setItem("schnepfDessertPaymentPlan", plan);
      localStorage.setItem("schnepfDessertPayPlan", plan);

      localStorage.setItem("schnepfDessertTotal", String(totalSafe));
      localStorage.setItem("schnepfDessertDepositAmount", String(payFull ? totalSafe : depositDollars));
      localStorage.setItem("schnepfDessertRemainingBalance", String(remainingBalance));
      localStorage.setItem("schnepfDessertFinalDueAt", finalDueISO);
      localStorage.setItem("schnepfDessertFinalDuePretty", finalDuePretty);

      localStorage.setItem("schnepfDessertPlanMonths", String(planMonths));
      localStorage.setItem("schnepfDessertPerMonthCents", String(perMonthCents));
      localStorage.setItem("schnepfDessertLastPaymentCents", String(lastPaymentCents));
      localStorage.setItem("schnepfDessertNextChargeAt", nextChargeAtISO);

      localStorage.setItem("schnepfDessertGuestCount", String(guestCount || 0));
      if (lineItems?.length) localStorage.setItem("schnepfYumLineItems", JSON.stringify(lineItems));
    } catch {}

    setSignatureImage(finalSig);
    setSignatureSubmitted(true);
    setShowSignatureModal(false);
  };

  const formattedDate = weddingDate
    ? new Date(`${weddingDate}T12:00:00`).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "your wedding date";

  // ─────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────
  return (
    <div className="pixie-card pixie-card--modal" style={{ maxWidth: 700, position: "relative" }}>
      {/* 🩷 Pink X Close */}
      <button className="pixie-card__close" onClick={onClose} aria-label="Close">
        <img src="/assets/icons/pink_ex.png" alt="Close" />
      </button>
  
      <div className="pixie-card__body" style={{ textAlign: "center" }}>
        <img
          src="/assets/images/yum_yum_button.png"
          alt="Dessert Icon"
          className="px-media"
          style={{ width: 100, margin: "0 auto 12px", display: "block" }}
        />
  
        <h2 className="px-title-lg" style={{ marginBottom: 8, color: "#2c62ba" }}>
          Dessert Agreement
        </h2>
  
        <div className="px-prose-narrow" style={{ margin: "0 auto 18px", maxWidth: 560 }}>
          <p>
            You’re booking desserts for <strong>{formattedDate}</strong> ({dayOfWeek || "TBD"}).
          </p>
          <p>
            Total dessert cost: <strong>${round2(total).toFixed(2)}</strong>
          </p>
        </div>
  
        {/* Booking Terms */}
        <div className="px-prose-narrow" style={{ margin: "0 auto 20px", maxWidth: 620, textAlign: "left" }}>
          <h3 style={{ fontWeight: 800, fontSize: "1.8rem", marginBottom: 8, color: "#2c62ba", textAlign: "center" }}>
            Booking Terms
          </h3>
          <ul style={{ margin: 0, paddingLeft: "1.1rem", lineHeight: 1.6 }}>
            <li>
              You may pay in full today, or place a <strong>{Math.round(DEPOSIT_PCT * 100)}% non-refundable deposit</strong>. Any
              remaining balance will be split into monthly installments and must be fully paid{" "}
              <strong>{FINAL_DUE_DAYS} days before your wedding date</strong>.
            </li>
            <li>
              Final guest count is due 30 days before your wedding. You may increase your guest count starting 45 days before your
              wedding, but the count cannot be lowered after booking.
            </li>
            <li>
              <strong>Cancellation &amp; Refunds:</strong> If you cancel more than {FINAL_DUE_DAYS} days prior, amounts paid beyond the
              non-refundable portion will be refunded less any non-recoverable costs already incurred. Within {FINAL_DUE_DAYS} days, all
              payments are non-refundable.
            </li>
            <li>
              <strong>Missed Payments:</strong> We’ll automatically retry your card. After 7 days, a $25 late fee applies; after 14 days,
              services may be suspended and this agreement may be in default.
            </li>
            <li>
              <strong>Food Safety &amp; Venue Policies:</strong> We’ll follow standard food-safety guidelines and comply with venue rules,
              which may limit display/location options.
            </li>
            <li>
              <strong>Force Majeure:</strong> Neither party is liable for delays beyond reasonable control (e.g., natural disasters,
              government actions, labor disputes, epidemics/pandemics, utility outages). We’ll work in good faith to reschedule; if not
              possible, we’ll refund amounts paid beyond non-recoverable costs already incurred.
            </li>
            <li>In the unlikely event of our cancellation or issue, liability is limited to a refund of payments made.</li>
          </ul>
        </div>
  
        {/* Pay options */}
        <h3
  className="px-title-md"
  style={{
    marginBottom: 14,
    fontSize: "1.8rem",
    fontWeight: 700,
    color: "#2c62ba",
  }}
>
  Choose how you’d like to pay:
</h3>
  
        <div style={{ display: "flex", justifyContent: "center", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
          <button
            onClick={() => {
              setPayFull(true);
              setSignatureSubmitted(false);
              try {
                localStorage.setItem("schnepfDessertPayPlan", "full");
              } catch {}
            }}
            className="boutique-primary-btn"
            style={{
              width: 240,
              backgroundColor: payFull ? "#2c62ba" : "#bbb",
            }}
          >
            Pay Full Amount
          </button>
  
          <button
            onClick={() => {
              setPayFull(false);
              setSignatureSubmitted(false);
              try {
                localStorage.setItem("schnepfDessertPayPlan", "monthly");
              } catch {}
            }}
            className="boutique-primary-btn"
            style={{
              width: 240,
              backgroundColor: !payFull ? "#e98fba" : "#bbb",
            }}
          >
            Deposit + Monthly
          </button>
        </div>
  
        {/* One concise summary line */}
        <div className="px-prose-narrow" style={{ margin: "0 auto 14px", maxWidth: 560 }}>
          {payFull ? (
            <p>
              You’ll pay <strong>${totalSafe.toFixed(2)}</strong> today for your desserts.
            </p>
          ) : (
            <p>
              <strong>${depositDollars.toFixed(2)}</strong> deposit + {planMonths} monthly payments of about{" "}
              <strong>${monthlyAmount.toFixed(2)}</strong>; final payment due <strong>{finalDuePretty}</strong>.
            </p>
          )}
  
          <label style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <input
              type="checkbox"
              checked={agreeChecked}
              onChange={(e) => setAgreeChecked(e.target.checked)}
            />
            <span>I agree to the terms above</span>
          </label>
        </div>
  
        {/* Sign / Continue */}
        <div className="px-cta-col" style={{ marginTop: 6 }}>
          {!signatureSubmitted ? (
            <button
              className="boutique-primary-btn"
              onClick={() => {
                if (agreeChecked) setShowSignatureModal(true);
              }}
              disabled={!agreeChecked}
              style={{ width: 250, opacity: agreeChecked ? 1 : 0.6 }}
            >
              Sign Contract
            </button>
          ) : (
            <>
              <img
                src="/assets/images/contract_signed.png"
                alt="Contract Signed"
                className="px-media"
                style={{ width: 150, margin: "10px auto 12px", display: "block" }}
              />
              <button
                className="boutique-primary-btn"
                onClick={() => {
                  try {
                    const plan = payFull ? "full" : "monthly";
                    localStorage.setItem("schnepfDessertPaymentPlan", plan);
                    localStorage.setItem("schnepfDessertTotal", String(totalSafe));
                    localStorage.setItem(
                      "schnepfDessertDepositAmount",
                      String(payFull ? totalSafe : depositDollars)
                    );
                    localStorage.setItem("schnepfDessertRemainingBalance", String(remainingBalance));
                    localStorage.setItem("schnepfDessertFinalDueAt", finalDueISO);
                    localStorage.setItem("schnepfDessertFinalDuePretty", finalDuePretty);
                    localStorage.setItem("schnepfDessertPlanMonths", String(planMonths));
                    localStorage.setItem("schnepfDessertPerMonthCents", String(perMonthCents));
                    localStorage.setItem("schnepfDessertLastPaymentCents", String(lastPaymentCents));
                    localStorage.setItem("schnepfDessertNextChargeAt", nextChargeAtISO);
                  } catch {}
  
                  try {
                    localStorage.setItem("schnepfYumStep", "dessertCheckout");
                  } catch {}
                  onContinueToCheckout(localStorage.getItem("schnepfDessertSignature") || "");
                }}
                style={{ width: 250 }}
              >
                Continue to Payment
              </button>
            </>
          )}
        </div>
  
        {/* Back */}
        <div className="px-cta-col" style={{ marginTop: 14 }}>
          <button
            className="boutique-back-btn"
            onClick={() => {
              try {
                localStorage.setItem("schnepfYumStep", "dessertCart");
              } catch {}
              onBack();
            }}
            style={{ width: 250 }}
          >
            ⬅ Back to Cart
          </button>
        </div>
      </div>
  
      {/* Signature modal */}
      {showSignatureModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            backgroundColor: "rgba(0, 0, 0, 0.6)",
            zIndex: 1200,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            overflowY: "auto",
            padding: 12,
          }}
        >
          <div
            style={{
              background: "#fff",
              padding: "2rem",
              borderRadius: 18,
              width: "min(500px, 94vw)",
              boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
              textAlign: "center",
              position: "relative",
              fontFamily: "'Nunito', sans-serif",
              overflowY: "auto",
              maxHeight: "90vh",
            }}
          >
            <h3
              style={{
                fontFamily: "'Jenna Sue', cursive",
                fontSize: "1.8rem",
                color: "#2c62ba",
                marginBottom: "1rem",
              }}
            >
              Sign below or enter your text signature
            </h3>
  
            <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 12 }}>
              <button
                onClick={() => setUseTextSignature(false)}
                className="boutique-primary-btn"
                style={{ background: !useTextSignature ? "#2c62ba" : "#bbb", width: 110 }}
              >
                Draw
              </button>
              <button
                onClick={() => setUseTextSignature(true)}
                className="boutique-primary-btn"
                style={{ background: useTextSignature ? "#2c62ba" : "#bbb", width: 110 }}
              >
                Type
              </button>
            </div>
  
            {!useTextSignature ? (
              <SignatureCanvas
                penColor="#2c62ba"
                ref={sigCanvasRef}
                canvasProps={{
                  width: 400,
                  height: 150,
                  style: {
                    border: "1px solid #ccc",
                    marginBottom: "1rem",
                    borderRadius: 10,
                    width: "100%",
                    maxWidth: 400,
                  },
                }}
              />
            ) : (
              <input
                type="text"
                placeholder="Type your name"
                value={typedSignature}
                onChange={(e) => setTypedSignature(e.target.value)}
                style={{
                  padding: "0.75rem",
                  fontSize: "1rem",
                  width: "100%",
                  borderRadius: 10,
                  border: "1px solid #ccc",
                  marginBottom: "1rem",
                }}
              />
            )}
  
            <button
              className="boutique-primary-btn"
              onClick={handleSignatureSubmit}
              style={{ width: "100%", padding: "0.75rem", fontSize: "1rem", borderRadius: 12 }}
            >
              Save Signature
            </button>
  
            <button
              onClick={() => setShowSignatureModal(false)}
              style={{
                position: "absolute",
                top: 12,
                right: 12,
                background: "none",
                border: "none",
                fontSize: "1.5rem",
                cursor: "pointer",
              }}
              aria-label="Close"
            >
              ✖
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SchnepfDessertContract;