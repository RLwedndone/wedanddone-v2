import React, { useEffect, useRef, useState } from "react";
import SignatureCanvas from "react-signature-canvas";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { db } from "../../../../firebase/firebaseConfig";
import type { OcotilloStep } from "./OcotilloOverlay";

interface OcotilloDessertContractProps {
  total: number;
  guestCount: number;
  weddingDate: string | null; // "YYYY-MM-DD"
  dayOfWeek: string | null;
  lineItems: string[];
  signatureImage: string | null;
  setSignatureImage: (value: string) => void;
  setStep: (step: OcotilloStep) => void;
  onClose: () => void;
  onComplete: (signatureImage: string) => void;
  dessertStyle: string; // "tieredCake" | "smallCakeTreats" | "treatsOnly"
  flavorCombo: string;
}

const DEPOSIT_PCT = 0.25;
const FINAL_DUE_DAYS = 35;
const MS_DAY = 24 * 60 * 60 * 1000;

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

const parseLocalYMD = (ymd?: string | null): Date | null => {
  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  return new Date(`${ymd}T12:00:00`); // noon guard to avoid TZ shift
};

// First second of a local Date as UTC ISO (good for crons / billing schedulers)
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

const OcotilloDessertContract: React.FC<OcotilloDessertContractProps> = ({
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
}) => {
  const auth = getAuth();
  const [userId, setUserId] = useState<string | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

  // Restore previously chosen plan (default "full")
  const initialPlan = (
    localStorage.getItem("ocotilloPayPlan") ||
    localStorage.getItem("ocotilloPaymentPlan") ||
    "full"
  ) as "full" | "monthly";
  const [payFull, setPayFull] = useState(initialPlan === "full");

  const [agreeChecked, setAgreeChecked] = useState(false);
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [useTextSignature, setUseTextSignature] = useState(false);
  const [typedSignature, setTypedSignature] = useState("");
  const sigCanvasRef = useRef<SignatureCanvas | null>(null);

  // Consider "already signed" only if parent passes a valid data-URL image
const [signatureSubmitted, setSignatureSubmitted] = useState<boolean>(
  () => typeof signatureImage === "string" && signatureImage.startsWith("data:image/")
);

  // ─────────────────────────────────────────────
  // Boot / progress mirrors for Ocotillo flow
  // ─────────────────────────────────────────────
  useEffect(() => {
    try {
      localStorage.setItem("ocotilloYumStep", "dessertContract");
      if (dessertStyle) localStorage.setItem("ocotilloDessertStyle", dessertStyle);
      if (flavorCombo) localStorage.setItem("ocotilloDessertFlavor", flavorCombo);
      if (lineItems) localStorage.setItem("ocotilloYumLineItems", JSON.stringify(lineItems));
    } catch {}

    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) return;
      setUserId(user.uid);

      const userRef = doc(db, "users", user.uid);
      try {
        const snap = await getDoc(userRef);
        const data = snap.exists() ? snap.data() : {};
        setFirstName((data as any)?.firstName || "");
        setLastName((data as any)?.lastName || "");

        // Log progress for dashboard
        await updateDoc(userRef, { "progress.yumYum.step": "dessertContract" });

        // Stash venue-specific dessert info in Firestore
        await setDoc(doc(userRef, "yumYumData", "ocotilloDessertStyle"), { dessertStyle }, { merge: true });
        await setDoc(doc(userRef, "yumYumData", "ocotilloDessertFlavor"), { flavorCombo }, { merge: true });
        await setDoc(doc(userRef, "yumYumData", "ocotilloLineItems"), { lineItems }, { merge: true });
      } catch (err) {
        console.error("🔥 [Ocotillo][Contract] Error fetching/saving user info:", err);
      }
    });

    return () => unsub();
  }, [auth, dessertStyle, flavorCombo, lineItems]);

  // keep local plan selection updated in localStorage
  useEffect(() => {
    try {
      localStorage.setItem("ocotilloPaymentPlan", payFull ? "full" : "monthly");
      localStorage.setItem("ocotilloPayPlan", payFull ? "full" : "monthly");
    } catch {}
  }, [payFull]);

  // ─────────────────────────────────────────────
  // Payment math (25% deposit, final due −35 days)
  // ─────────────────────────────────────────────
  const totalSafe = round2(Number(total) || 0);
  const depositDollars = round2(totalSafe * DEPOSIT_PCT);

  // If paying in full, first charge = entire total.
  // If monthly, first charge = 25% deposit (non-refundable).
  const amountDueToday = payFull ? totalSafe : Math.min(totalSafe, depositDollars);
  const remainingBalance = round2(Math.max(0, totalSafe - amountDueToday));

  const wedding = parseLocalYMD(weddingDate || "");
  const finalDueDate = wedding ? new Date(wedding.getTime() - FINAL_DUE_DAYS * MS_DAY) : null;
  const finalDueISO = finalDueDate ? asStartOfDayUTC(finalDueDate).toISOString() : "";

  // monthly schedule math
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

  // ─────────────────────────────────────────────
  // Signature helpers
  // ─────────────────────────────────────────────
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

    // Persist signature + plan hints scoped to Ocotillo
    try {
      const plan = payFull ? "full" : "monthly";
      localStorage.setItem("ocotilloDessertSignature", finalSig);
      localStorage.setItem("ocotilloPaymentPlan", plan);
      localStorage.setItem("ocotilloPayPlan", plan);

      localStorage.setItem("ocotilloTotal", String(totalSafe));
      localStorage.setItem("ocotilloDepositAmount", String(payFull ? totalSafe : depositDollars));
      localStorage.setItem("ocotilloRemainingBalance", String(remainingBalance));

      localStorage.setItem("ocotilloFinalDueAt", finalDueISO);
      localStorage.setItem("ocotilloFinalDuePretty", finalDuePretty);

      localStorage.setItem("ocotilloPlanMonths", String(planMonths));
      localStorage.setItem("ocotilloPerMonthCents", String(perMonthCents));
      localStorage.setItem("ocotilloLastPaymentCents", String(lastPaymentCents));
      localStorage.setItem("ocotilloNextChargeAt", nextChargeAtISO);

      localStorage.setItem("ocotilloGuestCount", String(guestCount || 0));
      if (lineItems?.length) {
        localStorage.setItem("ocotilloYumLineItems", JSON.stringify(lineItems));
      }
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

    return (
        // ⛔️ No pixie-overlay — parent handles backdrop
        <div className="pixie-card pixie-card--modal" style={{ maxWidth: 680 }}>
          {/* 🩷 Pink X */}
          <button className="pixie-card__close" onClick={onClose} aria-label="Close">
            <img src={`${import.meta.env.BASE_URL}assets/icons/pink_ex.png`} alt="Close" />
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

        <p style={{ marginBottom: "1.25rem" }}>
          You’re booking desserts for <strong>{formattedDate}</strong> ({dayOfWeek || "TBD"}).
        </p>
        <p style={{ marginBottom: "1.75rem" }}>
          Total dessert cost: <strong>${Number(round2(total)).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</strong>
        </p>

        {/* Terms list */}
        <div style={{ textAlign: "center", margin: "1.5rem auto 2rem", maxWidth: "620px" }}>
          <h3
            style={{
              fontWeight: "bold",
              fontSize: "1.8rem",
              marginBottom: "0.75rem",
              color: "#2c62ba",
            }}
          >
            Booking Terms
          </h3>
          <ul
            style={{
              fontSize: "0.95rem",
              lineHeight: 1.6,
              paddingLeft: "1.25rem",
              textAlign: "left",
              margin: "0 auto",
              maxWidth: "540px",
            }}
          >
            <li>
              By signing, you confirm either (a) your venue allows outside bakers, or (b) you’ll book a venue that
              does.
            </li>
            <li>
              You may pay in full today, or place a{" "}
              <strong>{Math.round(DEPOSIT_PCT * 100)}% non-refundable deposit</strong>. Any remaining balance will be
              split into monthly installments and must be fully paid{" "}
              <strong>{FINAL_DUE_DAYS} days before your wedding date</strong>.
            </li>
            <li>
              Final guest count is due 30 days before your wedding. You may increase your guest count starting 45 days
              before your wedding, but the count can not be lowered after booking.
            </li>
            <li>
              <strong>Cancellation &amp; Refunds:</strong> If you cancel more than {FINAL_DUE_DAYS} days prior, amounts
              paid beyond the non-refundable portion will be refunded less any non-recoverable costs already incurred.
              Within {FINAL_DUE_DAYS} days, all payments are non-refundable.
            </li>
            <li>
              <strong>Missed Payments:</strong> We’ll automatically retry your card. After 7 days, a $25 late fee
              applies; after 14 days, services may be suspended and this agreement may be in default.
            </li>
            <li>
              <strong>Food Safety &amp; Venue Policies:</strong> We’ll follow standard food-safety guidelines and comply
              with venue rules, which may limit display/location options.
            </li>
            <li>
              <strong>Force Majeure:</strong> Neither party is liable for delays beyond reasonable control (e.g.,
              natural disasters, government actions, labor disputes, epidemics/pandemics, utility outages). We’ll work
              in good faith to reschedule; if not possible, we’ll refund amounts paid beyond non-recoverable costs
              already incurred.
            </li>
            <li>In the unlikely event of our cancellation or issue, liability is limited to a refund of payments made.</li>
          </ul>
        </div>

        {/* Pay options */}
        <h3
          style={{
            fontWeight: "bold",
            marginBottom: "0.75rem",
            textAlign: "center",
            fontSize: "1.75rem",
          }}
        >
          Choose how you’d like to pay:
        </h3>

        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: "1rem",
            marginBottom: "1rem",
          }}
        >
          <button
            onClick={() => {
              setPayFull(true);
              setSignatureSubmitted(false);
              try {
                localStorage.setItem("ocotilloPayPlan", "full");
              } catch {}
            }}
            style={{
              padding: "1rem",
              borderRadius: "16px",
              width: "240px",
              backgroundColor: payFull ? "#2c62ba" : "#ccc",
              color: "white",
              fontWeight: "bold",
              cursor: "pointer",
              boxShadow: payFull ? "0 0 12px 2px rgba(44,98,186,0.5)" : "none",
            }}
          >
            Pay Full Amount
          </button>

          <button
            onClick={() => {
              setPayFull(false);
              setSignatureSubmitted(false);
              try {
                localStorage.setItem("ocotilloPayPlan", "monthly");
              } catch {}
            }}
            style={{
              padding: "1rem",
              borderRadius: "16px",
              width: "240px",
              backgroundColor: !payFull ? "#e98fba" : "#ccc",
              color: "white",
              fontWeight: "bold",
              cursor: "pointer",
              boxShadow: !payFull ? "0 0 12px 2px rgba(233,143,186,0.5)" : "none",
            }}
          >
            Deposit + Monthly
          </button>
        </div>

        {/* Summary + I agree checkbox */}
        <div style={{ textAlign: "center", marginBottom: "1.25rem" }}>
          {payFull ? (
            <p style={{ marginBottom: "0.75rem" }}>
              You’ll pay <strong>${Number(totalSafe).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</strong> today for your desserts.
            </p>
          ) : (
            <p style={{ marginBottom: "0.75rem" }}>
              <strong>${Number(depositDollars).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</strong> deposit + {planMonths} monthly payments of about{" "}
              <strong>${Number(monthlyAmount).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</strong>; final payment due <strong>{finalDuePretty}</strong>.
            </p>
          )}

          <label>
            <input
              type="checkbox"
              checked={agreeChecked}
              onChange={(e) => setAgreeChecked(e.target.checked)}
              style={{ marginRight: "0.5rem" }}
            />
            I agree to the terms above
          </label>
        </div>

        {/* Sign or Continue */}
        <div style={{ textAlign: "center", marginTop: "1.25rem" }}>
          {!signatureSubmitted ? (
            <button
              className="boutique-primary-btn"
              onClick={handleSignClick}
              disabled={!agreeChecked}
              style={{
                width: "250px",
                opacity: agreeChecked ? 1 : 0.5,
                cursor: agreeChecked ? "pointer" : "not-allowed",
              }}
            >
              Sign Contract
            </button>
          ) : (
            <>
              <img
                src={`${import.meta.env.BASE_URL}assets/images/contract_signed.png`}
                alt="Contract Signed"
                style={{
                  width: "150px",
                  margin: "0.75rem auto 1rem",
                  display: "block",
                }}
              />
              <button
                className="boutique-primary-btn"
                onClick={() => {
                  // Save final payment plan data in Ocotillo namespace
                  try {
                    localStorage.setItem("ocotilloPaymentPlan", payFull ? "full" : "monthly");
                    localStorage.setItem("ocotilloTotal", String(totalSafe));
                    localStorage.setItem(
                      "ocotilloDepositAmount",
                      String(payFull ? totalSafe : depositDollars)
                    );
                    localStorage.setItem(
                      "ocotilloRemainingBalance",
                      String(remainingBalance)
                    );
                    localStorage.setItem("ocotilloFinalDueAt", finalDueISO);
                    localStorage.setItem(
                      "ocotilloFinalDuePretty",
                      finalDuePretty
                    );
                    localStorage.setItem(
                      "ocotilloPlanMonths",
                      String(planMonths)
                    );
                    localStorage.setItem(
                      "ocotilloPerMonthCents",
                      String(perMonthCents)
                    );
                    localStorage.setItem(
                      "ocotilloLastPaymentCents",
                      String(lastPaymentCents)
                    );
                    localStorage.setItem(
                      "ocotilloNextChargeAt",
                      nextChargeAtISO
                    );
                  } catch {}

                  try {
                    localStorage.setItem("ocotilloYumStep", "dessertCheckout");
                  } catch {}

                  setStep("dessertCheckout");
                  onComplete(localStorage.getItem("ocotilloDessertSignature") || "");
                }}
                style={{ width: "250px" }}
              >
                Continue to Payment
              </button>
            </>
          )}
        </div>

        {/* Back button to cart */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "1rem",
            marginTop: "1.75rem",
          }}
        >
          <button
            className="boutique-back-btn"
            onClick={() => {
              try {
                localStorage.setItem("ocotilloYumStep", "dessertCart");
              } catch {}
              setStep("dessertCart");
            }}
            style={{ width: "250px" }}
          >
            ⬅ Back to Cart
          </button>
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
            }}
          >
            <div
              style={{
                background: "#fff",
                padding: "2rem",
                borderRadius: "18px",
                width: "90%",
                maxWidth: "500px",
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
                  marginBottom: "1.25rem",
                }}
              >
                Sign below or enter your text signature
              </h3>

              {/* Toggle Draw vs Type */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  gap: "0.75rem",
                  marginBottom: "0.75rem",
                }}
              >
                <button
                  onClick={() => setUseTextSignature(false)}
                  style={{
                    padding: "0.5rem 1rem",
                    borderRadius: "8px",
                    backgroundColor: !useTextSignature ? "#2c62ba" : "#ccc",
                    color: "#fff",
                    fontWeight: "bold",
                    border: "none",
                    cursor: "pointer",
                    minWidth: "80px",
                  }}
                >
                  Draw
                </button>
                <button
                  onClick={() => setUseTextSignature(true)}
                  style={{
                    padding: "0.5rem 1rem",
                    borderRadius: "8px",
                    backgroundColor: useTextSignature ? "#2c62ba" : "#ccc",
                    color: "#fff",
                    fontWeight: "bold",
                    border: "none",
                    cursor: "pointer",
                    minWidth: "80px",
                  }}
                >
                  Type
                </button>
              </div>

              {/* Signature input */}
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
                      borderRadius: "10px",
                      width: "100%",
                      maxWidth: "400px",
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
                    borderRadius: "10px",
                    border: "1px solid #ccc",
                    marginBottom: "1rem",
                  }}
                />
              )}

              <button
                className="boutique-primary-btn"
                onClick={handleSignatureSubmit}
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  fontSize: "1rem",
                  borderRadius: "12px",
                }}
              >
                Save Signature
              </button>

              <button
                onClick={() => setShowSignatureModal(false)}
                style={{
                  position: "absolute",
                  top: "1rem",
                  right: "1rem",
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
      </div>
  );
};

export default OcotilloDessertContract;