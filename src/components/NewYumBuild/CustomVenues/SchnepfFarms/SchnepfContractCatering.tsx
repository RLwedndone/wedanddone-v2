import React, { useEffect, useRef, useState } from "react";
import SignatureCanvas from "react-signature-canvas";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { db } from "../../../../firebase/firebaseConfig";
import { getGuestState } from "../../../../utils/guestCountStore";

/* -------------------- date + money helpers -------------------- */
const MS_DAY = 24 * 60 * 60 * 1000;
const DEPOSIT_PCT = 0.25;
const FINAL_DUE_DAYS = 35;

function parseLocalYMD(ymd?: string | null): Date | null {
  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  return new Date(`${ymd}T12:00:00`); // noon guard
}
function addDays(d: Date, days: number) {
  return new Date(d.getTime() + days * MS_DAY);
}
function formatPretty(d: Date) {
  return d.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
}
function monthsBetweenInclusive(from: Date, to: Date) {
  const a = new Date(from.getFullYear(), from.getMonth(), 1);
  const b = new Date(to.getFullYear(), to.getMonth(), 1);
  let months = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
  if (to.getDate() >= from.getDate()) months += 1;
  return Math.max(1, months);
}

/* -------------------- types -------------------- */
export interface SchnepfMenuSelections {
  appetizers: string[];
  mains: string[];
  sides: string[];
}

interface Props {
  total: number;
  guestCount: number;
  weddingDate: string | null; // "YYYY-MM-DD"
  dayOfWeek: string | null;
  lineItems: string[];

  cuisineName: string;                 // friendly name (e.g., "Italian Bounty")
  menuSelections: SchnepfMenuSelections;

  /* signature owned by parent overlay */
  signatureImage: string | null;
  setSignatureImage: (v: string) => void;
  signatureSubmitted: boolean;
  setSignatureSubmitted: (v: boolean) => void;

  setStep: (step: string) => void;     // use "schnepfCheckout" next
  onClose: () => void;
  onComplete: () => void;              // after success FS writes (if needed later)
}

const SchnepfContractCatering: React.FC<Props> = ({
  total,
  guestCount,
  weddingDate,
  dayOfWeek,
  lineItems,
  cuisineName,
  menuSelections,

  signatureImage,
  setSignatureImage,
  signatureSubmitted,
  setSignatureSubmitted,

  setStep,
}) => {
  const auth = getAuth();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [agreeChecked, setAgreeChecked] = useState(false);
  const [payFull, setPayFull] = useState(true);
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [useTextSignature, setUseTextSignature] = useState(false);
  const [typedSignature, setTypedSignature] = useState("");
  const sigCanvasRef = useRef<any>(null);

  // Hydrated/locked guest count (prop → store → localStorage)
  const [lockedGuestCount, setLockedGuestCount] = useState<number>(guestCount || 0);

  useEffect(() => {
    let alive = true;
    const hydrate = async () => {
      // Prefer a valid prop first
      if (Number.isFinite(guestCount) && guestCount > 0) {
        if (alive) setLockedGuestCount(guestCount);
        return;
      }

      try {
        const st = await getGuestState();
        let v = Number((st as any).value || 0);

        if (!v) {
          try {
            v =
              Number(localStorage.getItem("yumGuestCount") || 0) ||
              Number(localStorage.getItem("guestCount") || 0);
          } catch {}
        }
        if (alive) setLockedGuestCount(v);
      } catch {
        try {
          const v =
            Number(localStorage.getItem("yumGuestCount") || 0) ||
            Number(localStorage.getItem("guestCount") || 0);
          if (alive) setLockedGuestCount(v);
        } catch {}
      }
    };

    hydrate();
    return () => {
      alive = false;
    };
  }, [guestCount]);

  // ---------- derive policy amounts + dates ----------
  const wedding = parseLocalYMD(weddingDate || "");
  const prettyWedding = wedding ? formatPretty(wedding) : "your wedding date";

  const dueByDate = wedding ? addDays(wedding, -FINAL_DUE_DAYS) : null;
  const prettyDueBy = dueByDate ? formatPretty(dueByDate) : `${FINAL_DUE_DAYS} days before your wedding date`;

  const depositAmount = Math.round(total * DEPOSIT_PCT * 100) / 100;
  const today = new Date();
  const planMonths = wedding && dueByDate ? monthsBetweenInclusive(today, dueByDate) : 1;

  const totalCents = Math.round(total * 100);
  const depositCents = Math.round(depositAmount * 100);
  const balanceCents = Math.max(0, totalCents - depositCents);
  const perMonthCents = planMonths > 0 ? Math.floor(balanceCents / planMonths) : balanceCents;
  const lastPaymentCents = balanceCents - perMonthCents * Math.max(0, planMonths - 1);

  const paymentSummaryText = payFull
    ? `You’re paying $${total.toFixed(2)} today.`
    : `You’re paying $${depositAmount.toFixed(
        2
      )} today, then monthly through ${prettyDueBy}. Est. ${planMonths} payments of $${(
        perMonthCents / 100
      ).toFixed(2)}${planMonths > 1 ? ` (last ≈ $${(lastPaymentCents / 100).toFixed(2)})` : ""}`;

  // ---------- init + persist step ----------
  useEffect(() => {
    try {
      localStorage.setItem("yumStep", "schnepfContract");
    } catch {}

    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) return;

      try {
        const userRef = doc(db, "users", u.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const d = userSnap.data() as any;
          setFirstName(d.firstName || "");
          setLastName(d.lastName || "");
        }

        // progress + snapshot mirrors
        await updateDoc(userRef, { "progress.yumYum.step": "schnepfContract" });
        await setDoc(doc(userRef, "yumYumData", "schnepfSelections"), menuSelections, { merge: true });
        await setDoc(
          doc(userRef, "yumYumData", "schnepfCart"),
          {
            guestCount: lockedGuestCount,
            cuisineName,
          },
          { merge: true }
        );
        await setDoc(doc(userRef, "yumYumData", "lineItems"), { lineItems }, { merge: true });
      } catch (err) {
        console.error("🔥 [Schnepf][Contract] init error:", err);
      }
    });

    return () => unsub();
  }, [auth, cuisineName, lineItems, lockedGuestCount, menuSelections]);

  /* -------------------- signature helpers -------------------- */
  const drawToDataUrl = (): string => {
    try {
      return sigCanvasRef.current?.getCanvas().toDataURL("image/png") || "";
    } catch {
      return "";
    }
  };
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

  const handleSignatureSubmit = async () => {
    const typed = typedSignature.trim();
    const finalSignature = useTextSignature ? (typed ? generateImageFromText(typed) : "") : drawToDataUrl();

    if (!finalSignature) {
      alert("Please enter or draw a signature.");
      return;
    }

    setSignatureImage(finalSignature);
    setSignatureSubmitted(true);
    setShowSignatureModal(false);

    const u = auth.currentUser;
    if (u) {
      try {
        await setDoc(
          doc(db, "users", u.uid),
          { yumSignatureImageUrl: finalSignature, yumSigned: true },
          { merge: true }
        );
      } catch (e) {
        console.error("❌ Failed to save signature:", e);
      }
    }
  };

  /* -------------------- UI -------------------- */
return (
  <div className="pixie-card pixie-card--modal" style={{ maxWidth: 700, position: "relative" }}>
    {/* 🩷 Pink X Close (optional): if you have an onClose, wire it here */}
    {/* <button className="pixie-card__close" onClick={onClose} aria-label="Close">
      <img src={`${import.meta.env.BASE_URL}assets/icons/pink_ex.png`} alt="Close" />
    </button> */}

    <div className="pixie-card__body" style={{ textAlign: "center" }}>
      <img
        src={`${import.meta.env.BASE_URL}assets/images/yum_yum_button.png`}
        alt="Catering Seal"
        style={{ width: 100, margin: "0 auto 12px", display: "block" }}
      />

      <h2
        style={{
          fontSize: "2.2rem",
          color: "#2c62ba",
          textAlign: "center",
          marginBottom: "0.5rem",
          fontFamily: "'Jenna Sue', cursive",
        }}
      >
        Schnepf Farms — Catering Agreement
      </h2>

      <p style={{ marginBottom: 8 }}>
        You’re booking <strong>{cuisineName}</strong> for <strong>{prettyWedding}</strong>{" "}
        ({dayOfWeek || "TBD"}).
      </p>

      <p style={{ marginBottom: 14 }}>
        Total catering cost: <strong>${total.toFixed(2)}</strong> for {lockedGuestCount} guest(s).
      </p>

      {/* Booking Terms */}
      <h3
        style={{
          fontWeight: 800,
          fontSize: "1.8rem",
          marginBottom: "0.6rem",
          color: "#2c62ba",
          fontFamily: "'Jenna Sue', cursive",
        }}
      >
        Booking Terms
      </h3>

      <ul
        style={{
          fontSize: "0.95rem",
          lineHeight: 1.6,
          paddingLeft: "1.1rem",
          textAlign: "left",
          margin: "0 auto 1rem",
          maxWidth: 560,
        }}
      >
        <li>
          You may pay in full today, or place a <strong>{Math.round(DEPOSIT_PCT * 100)}% non-refundable deposit</strong>. Any remaining balance will be split into monthly installments and must be fully paid{" "}
          <strong>{FINAL_DUE_DAYS} days before your wedding date</strong>.
        </li>
        <li>
          Final guest count is due <strong>30 days before</strong> your wedding. You may increase your guest count starting 45 days before your wedding, but the count cannot be lowered after booking.
        </li>
        <li>
          <strong>Substitutions &amp; Availability:</strong> Menu items may be substituted with comparable alternatives due to seasonality or supply constraints.
        </li>
        <li>
          <strong>Food Safety &amp; Venue Policies:</strong> We’ll follow standard food-safety guidelines and comply with venue rules, which may limit service or display options.
        </li>
        <li>
          <strong>Cancellation &amp; Refunds:</strong> If you cancel more than {FINAL_DUE_DAYS} days prior, amounts paid beyond the non-refundable portion will be refunded less any non-recoverable costs already incurred. Within {FINAL_DUE_DAYS} days, all payments are non-refundable.
        </li>
        <li>
          <strong>Missed Payments:</strong> We’ll automatically retry your card. After 7 days, a $25 late fee applies; after 14 days, services may be suspended and this agreement may be in default.
        </li>
        <li>
          <strong>Force Majeure:</strong> Neither party is liable for delays beyond reasonable control (e.g., natural disasters, government actions, labor disputes, epidemics/pandemics, utility outages). We’ll work in good faith to reschedule; if not possible, we’ll refund amounts paid beyond non-recoverable costs already incurred.
        </li>
        <li>In the unlikely event of our cancellation or issue, liability is limited to a refund of payments made.</li>
      </ul>

      <h3 style={{ fontWeight: 800, marginBottom: "0.6rem", fontSize: "1.4rem" }}>
        Choose how you’d like to pay:
      </h3>

      <div style={{ display: "flex", justifyContent: "center", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
        <button
          onClick={() => {
            setPayFull(true);
            setSignatureSubmitted(false);
          }}
          style={{
            padding: "0.9rem 1rem",
            borderRadius: 14,
            width: 240,
            background: payFull ? "#2c62ba" : "#cfcfd3",
            color: "#fff",
            fontWeight: 800,
            border: "none",
            cursor: "pointer",
          }}
        >
          Pay Full Amount
        </button>
        <button
          onClick={() => {
            setPayFull(false);
            setSignatureSubmitted(false);
          }}
          style={{
            padding: "0.9rem 1rem",
            borderRadius: 14,
            width: 240,
            background: !payFull ? "#e98fba" : "#cfcfd3",
            color: "#fff",
            fontWeight: 800,
            border: "none",
            cursor: "pointer",
          }}
        >
          25% Deposit + Monthly
        </button>
      </div>

      <p style={{ marginBottom: 12 }}>{paymentSummaryText}</p>

      {/* Centered agreement + signature */}
<div
  style={{
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
    marginBottom: 20,
    textAlign: "center",
  }}
>
  <label
    style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 8,
      marginBottom: 14,
      justifyContent: "center",
    }}
  >
    <input
      type="checkbox"
      checked={agreeChecked}
      onChange={(e) => setAgreeChecked(e.target.checked)}
    />
    <span>I agree to the terms above</span>
  </label>

  {!signatureSubmitted ? (
    <button
      className="boutique-primary-btn"
      onClick={handleSignClick}
      disabled={!agreeChecked}
      style={{
        width: 240,
        opacity: agreeChecked ? 1 : 0.6,
        margin: "0 auto",
      }}
    >
      Sign Contract
    </button>
  ) : (
    <div style={{ display: "flex", justifyContent: "center", marginTop: 8 }}>
      <img
        src={`${import.meta.env.BASE_URL}assets/images/contract_signed.png`}
        alt="Contract Signed"
        style={{ width: 120 }}
      />
    </div>
  )}
</div>

      {/* Continue / Back */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 12,
          marginTop: 18,
        }}
      >
        <button
          className="boutique-primary-btn"
          onClick={() => {
            if (!signatureSubmitted) return;

            const plan = payFull ? "full" : "deposit";
            const amountToday = payFull ? total : depositAmount;

            const checkoutPayload = {
              amountCents: Math.round(amountToday * 100),
              plan, // "full" | "deposit"
              grandTotalCents: Math.round(total * 100),
              depositCents,
              planMonths,
              perMonthCents,
              lastPaymentCents,
              dueByISO: dueByDate ? dueByDate.toISOString() : "",
              cuisineName,
              guestCount: lockedGuestCount,
              lineItems,
              weddingDateISO: weddingDate || "",
              dayOfWeek: dayOfWeek || "",
              paymentSummaryText,
              updatedAt: Date.now(),
            };

            // debug
            console.groupCollapsed("%c[SCH][Contract] Handoff", "color:#2c62ba;font-weight:700");
            console.log("[SCH][Contract] payload →", checkoutPayload);
            console.groupEnd();

            try {
              // Schnepf-namespaced mirrors
              localStorage.setItem("schnepf:checkout", JSON.stringify(checkoutPayload));
              localStorage.setItem("schnepfCateringPaymentPlan", plan);
              localStorage.setItem("schnepfCateringPayPlan", plan);
              localStorage.setItem("schnepfCateringTotalCents", String(checkoutPayload.grandTotalCents));
              localStorage.setItem("schnepfCateringDepositCents", String(depositCents));
              localStorage.setItem("schnepfCateringPlanMonths", String(planMonths));
              localStorage.setItem("schnepfCateringPerMonthCents", String(perMonthCents));
              localStorage.setItem("schnepfCateringLastPaymentCents", String(lastPaymentCents));
              localStorage.setItem("schnepfCateringDueBy", checkoutPayload.dueByISO);

              // Generic compatibility keys
              localStorage.setItem("yumPaymentPlan", plan);
              localStorage.setItem("yumTotal", (checkoutPayload.grandTotalCents / 100).toString());
              localStorage.setItem("yumDepositAmount", (depositCents / 100).toString());
              localStorage.setItem(
                "yumRemainingBalance",
                ((checkoutPayload.grandTotalCents - depositCents) / 100).toString()
              );
              localStorage.setItem(
                "yumFinalDuePretty",
                dueByDate ? formatPretty(dueByDate) : `${FINAL_DUE_DAYS} days before your wedding date`
              );
              localStorage.setItem("yumPlanMonths", String(planMonths));
              localStorage.setItem("yumPerMonthCents", String(perMonthCents));
              localStorage.setItem("yumLastPaymentCents", String(lastPaymentCents));

              // Signature + step
              localStorage.setItem("schnepfCateringSignature", signatureImage || "");
              localStorage.setItem("yumStep", "schnepfCheckout");
            } catch {}

            setStep("schnepfCheckout");
          }}
          disabled={!signatureSubmitted}
          style={{ width: 260, opacity: signatureSubmitted ? 1 : 0.5 }}
        >
          Continue to Payment
        </button>

        <button
          className="boutique-back-btn"
          onClick={() => setStep("schnepfCart")}
          style={{ width: 260 }}
        >
          ⬅ Back to Cart
        </button>
      </div>

      {/* Signature Modal */}
      {showSignatureModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            zIndex: 1200,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            padding: 16,
          }}
        >
          <div
            style={{
              background: "#fff",
              padding: "2rem",
              borderRadius: 18,
              width: "min(500px, 92vw)",
              boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
              textAlign: "center",
              position: "relative",
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

            <div style={{ display: "flex", justifyContent: "center", gap: 10, marginBottom: 12 }}>
              <button
                onClick={() => setUseTextSignature(false)}
                style={{
                  padding: ".5rem 1rem",
                  borderRadius: 8,
                  background: !useTextSignature ? "#2c62ba" : "#ccc",
                  color: "#fff",
                  fontWeight: 800,
                  border: "none",
                  cursor: "pointer",
                }}
              >
                Draw
              </button>
              <button
                onClick={() => setUseTextSignature(true)}
                style={{
                  padding: ".5rem 1rem",
                  borderRadius: 8,
                  background: useTextSignature ? "#2c62ba" : "#ccc",
                  color: "#fff",
                  fontWeight: 800,
                  border: "none",
                  cursor: "pointer",
                }}
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
                  className: "sigCanvas",
                  style: { border: "1px solid #ccc", borderRadius: 10, width: "100%", maxWidth: 400 },
                }}
              />
            ) : (
              <input
                type="text"
                placeholder="Type your name"
                value={typedSignature}
                onChange={(e) => setTypedSignature(e.target.value)}
                style={{
                  padding: ".75rem",
                  fontSize: "1rem",
                  width: "100%",
                  borderRadius: 10,
                  border: "1px solid #ccc",
                }}
              />
            )}

            <button
              className="boutique-primary-btn"
              onClick={handleSignatureSubmit}
              style={{ width: "100%", marginTop: "1rem" }}
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

export default SchnepfContractCatering;