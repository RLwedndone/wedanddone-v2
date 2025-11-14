// src/components/NewYumBuild/CustomVenues/Rubi/RubiCateringContract.tsx
import React, { useEffect, useRef, useState } from "react";
import SignatureCanvas from "react-signature-canvas";
import { getAuth } from "firebase/auth";
import { doc, setDoc, updateDoc } from "firebase/firestore";
import { db } from "../../../../firebase/firebaseConfig";

// ✅ Correct type imports for both branches
import type { RubiTierSelectionBBQ } from "./RubiBBQTierSelector";
import type { RubiTierSelection as RubiTierSelectionMex } from "./RubiMexTierSelector";
import type { RubiBBQSelections } from "./RubiBBQMenuBuilder";
import type { RubiMexSelections } from "./RubiMexMenuBuilder";

/* -------------------- date + money helpers -------------------- */
const MS_DAY = 24 * 60 * 60 * 1000;
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

const parseLocalYMD = (ymd?: string | null): Date | null =>
  !ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd) ? null : new Date(`${ymd}T12:00:00`);

const addDays = (d: Date, days: number) => new Date(d.getTime() + days * MS_DAY);

const formatPretty = (d: Date) =>
  d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

function monthsBetweenInclusive(from: Date, to: Date) {
  const a = new Date(from.getFullYear(), from.getMonth(), 1);
  const b = new Date(to.getFullYear(), to.getMonth(), 1);
  let months = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
  if (to.getDate() >= from.getDate()) months += 1;
  return Math.max(1, months);
}

/* -------------------- types -------------------- */
export type RubiMenuChoice = "bbq" | "mexican";

/**
 * Discriminated union for the two branches.
 * TS will narrow `tierSelection` and `selections` automatically based on menuChoice.
 */
type ContractInput =
  | {
      menuChoice: "bbq";
      tierSelection: RubiTierSelectionBBQ;
      selections: RubiBBQSelections;
    }
  | {
      menuChoice: "mexican";
      tierSelection: RubiTierSelectionMex;
      selections: RubiMexSelections;
    };

/** Props that are common to both branches + the discriminated input */
type Props = ContractInput & {
  total: number;
  guestCount: number;
  weddingDate: string | null;
  dayOfWeek: string | null;
  lineItems: string[];
  cateringSummary?: any;

  signatureImage: string | null;
  setSignatureImage: (v: string) => void;
  signatureSubmitted: boolean;
  setSignatureSubmitted: (v: boolean) => void;

  onBack: () => void; // back to cart
  onContinueToCheckout: () => void; // proceed to payment
  onClose: () => void;
  onComplete?: () => void;
};

const RubiCateringContract: React.FC<Props> = ({
  total,
  guestCount,
  weddingDate,
  dayOfWeek,
  lineItems,
  menuChoice,
  tierSelection,
  cateringSummary, 
  selections,
  // use signatureImage to avoid "unused" errors and show it if present
  signatureImage,
  setSignatureImage,
  signatureSubmitted,
  setSignatureSubmitted,
  onBack,
  onContinueToCheckout,
  onClose,
  onComplete,
}) => {
  const auth = getAuth();

  // ui
  const [agreeChecked, setAgreeChecked] = useState(false);
  const [payFull, setPayFull] = useState(true);
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [useTextSignature, setUseTextSignature] = useState(false);
  const [typedSignature, setTypedSignature] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const sigCanvasRef = useRef<SignatureCanvas | null>(null);

  // locked guest count
  const [lockedGuestCount, setLockedGuestCount] = useState<number>(guestCount || 0);

  useEffect(() => {
    // hydrate locked guest count
    if (guestCount > 0) {
      setLockedGuestCount(guestCount);
      return;
    }
    const v =
      Number(localStorage.getItem("rubiLockedGuestCount") || 0) ||
      Number(localStorage.getItem("magicGuestCount") || 0) ||
      0;
    setLockedGuestCount(v);
  }, [guestCount]);

  // derive amounts/dates
  const wedding = parseLocalYMD(weddingDate || "");
  const prettyWedding = wedding ? formatPretty(wedding) : "your wedding date";
  const dueByDate = wedding ? addDays(wedding, -35) : null;
  const prettyDueBy = dueByDate ? formatPretty(dueByDate) : "";

  const depositAmount = round2(total * 0.25);
  const totalCents = Math.round(total * 100);
  const depositCents = Math.round(depositAmount * 100);
  const balanceCents = Math.max(0, totalCents - depositCents);
  const planMonths = wedding && dueByDate ? monthsBetweenInclusive(new Date(), dueByDate) : 1;
  const perMonthCents = planMonths > 0 ? Math.floor(balanceCents / planMonths) : balanceCents;
  const lastPaymentCents = balanceCents - perMonthCents * Math.max(0, planMonths - 1);

  const paymentSummaryText = payFull
    ? `You’re paying $${total.toFixed(2)} today.`
    : `You’re paying $${depositAmount.toFixed(
        2
      )} today, then monthly through ${prettyDueBy}. Est. ${planMonths} payments of $${(
        perMonthCents / 100
      ).toFixed(2)}${planMonths > 1 ? ` (last ≈ $${(lastPaymentCents / 100).toFixed(2)})` : ""}`;

  // boot/persist progress
  useEffect(() => {
    try {
      localStorage.setItem("yumStep", "rubiContract");
    } catch {}
    const u = auth.currentUser;
    if (!u) return;

    (async () => {
      try {
        await updateDoc(doc(db, "users", u.uid), {
          "progress.yumYum.step": "rubiContract",
        });
        // union is JSON-safe
        await setDoc(
          doc(db, "users", u.uid, "yumYumData", "rubiSelections"),
          { menuChoice, tierSelection, selections },
          { merge: true }
        );
        await setDoc(
          doc(db, "users", u.uid, "yumYumData", "rubiCart"),
          {
            guestCount: lockedGuestCount,
            tier: (tierSelection as any)?.id || "",
            pricePerGuest: (tierSelection as any)?.pricePerGuest || 0,
          },
          { merge: true }
        );
        await setDoc(
          doc(db, "users", u.uid, "yumYumData", "lineItems"),
          { lineItems },
          { merge: true }
        );
      } catch (e) {
        console.error("🔥 Error initializing Rubi contract state:", e);
      }
    })();
  }, [auth, lineItems, menuChoice, tierSelection, selections, lockedGuestCount]);

  /* -------------------- signature helpers -------------------- */
  const drawToDataUrl = () => {
    try {
      const c =
        sigCanvasRef.current?.getCanvas?.() ||
        (sigCanvasRef.current as unknown as { _canvas?: HTMLCanvasElement })?._canvas;
      // @ts-ignore
      return c?.toDataURL("image/png") || "";
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
    const finalSignature = useTextSignature
      ? generateImageFromText(typedSignature.trim())
      : drawToDataUrl();

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
    <div className="pixie-card pixie-card--modal" style={{ maxWidth: 720 }}>
      {/* 🩷 Pink X Close */}
      <button className="pixie-card__close" onClick={onClose} aria-label="Close">
        <img src={`${import.meta.env.BASE_URL}assets/icons/pink_ex.png`} alt="Close" />
      </button>

      <div className="pixie-card__body" style={{ textAlign: "center" }}>
        <img
          src={`${import.meta.env.BASE_URL}assets/images/yum_yum_button.png`}
          alt="Catering Seal"
          className="px-media"
          style={{ width: 110, margin: "0 auto 12px" }}
        />

        <h2 className="px-title-lg" style={{ marginBottom: 8 }}>
          Rubi House Catering Agreement — Brother John’s {menuChoice === "bbq" ? "BBQ" : "Mexican"} ({tierSelection.prettyName})
        </h2>

        <p className="px-prose-narrow" style={{ marginBottom: 6 }}>
          You’re booking catering for <strong>{prettyWedding}</strong> ({dayOfWeek || "TBD"}).
        </p>

        <p className="px-prose-narrow" style={{ marginBottom: 12 }}>
          Total catering cost: <strong>${total.toFixed(2)}</strong> for {lockedGuestCount} guest(s).
        </p>

        {/* Booking Terms */}
        <div className="px-section" style={{ maxWidth: 640, margin: "0 auto 12px", textAlign: "left" }}>
          <h3 className="px-title" style={{ textAlign: "center", marginBottom: 6 }}>
            Booking Terms
          </h3>
          <ul className="px-prose-narrow" style={{ margin: 0, paddingLeft: "1.25rem", lineHeight: 1.6 }}>
            <li>The amount listed above will count toward any Food &amp; Beverage minimum you may have with the venue. Any remaining amount to reach that minimum can be applied to bar packages or additional menu items.</li>
            <li>
              You may pay in full today, or place a <strong>25% non-refundable deposit</strong>.
              Any remaining balance will be split into monthly installments and must be fully paid{" "}
              <strong>35 days before your wedding date</strong>.
            </li>
            <li>
              Final guest count is due <strong>30 days</strong> before your wedding. You may increase your
              count starting 45 days out, but it cannot be lowered after booking.
            </li>
            <li>
              <strong>Bar Packages:</strong> Alcohol is booked directly with the venue in accordance with Arizona liquor laws.
              Wed&amp;Done does not provide bar service or alcohol.
            </li>
            <li>
              <strong>Cancellation &amp; Refunds:</strong> If you cancel more than 35 days prior, amounts paid
              beyond the non-refundable portion will be refunded less any non-recoverable costs already incurred.
              Within 35 days, all payments are non-refundable.
            </li>
            <li>
              <strong>Missed Payments:</strong> We’ll automatically retry your card. After 7 days, a $25 late fee
              applies; after 14 days, services may be suspended and this agreement may be in default.
            </li>
            <li>
              <strong>Food Safety &amp; Venue Policies:</strong> We’ll follow standard food-safety guidelines and
              comply with venue rules, which may limit service/display options.
            </li>
            <li>
              <strong>Force Majeure:</strong> Neither party is liable for delays beyond reasonable control.
              We’ll work in good faith to reschedule; if not possible, we’ll refund amounts paid beyond
              non-recoverable costs incurred.
            </li>
            <li>In the unlikely event of our cancellation or issue, liability is limited to a refund of payments made.</li>
          </ul>
        </div>

        {/* Plan toggle */}
        <h4 className="px-title" style={{ marginTop: 6, marginBottom: 6 }}>
          Choose how you’d like to pay:
        </h4>
        <div className="px-toggle" style={{ marginBottom: 8 }}>
          <button
            type="button"
            className={`px-toggle__btn ${payFull ? "px-toggle__btn--blue px-toggle__btn--active" : ""}`}
            onClick={() => { setPayFull(true); setSignatureSubmitted(false); }}
            aria-pressed={payFull}
          >
            Pay in Full
          </button>
          <button
            type="button"
            className={`px-toggle__btn ${!payFull ? "px-toggle__btn--pink px-toggle__btn--active" : ""}`}
            onClick={() => { setPayFull(false); setSignatureSubmitted(false); }}
            aria-pressed={!payFull}
          >
            Deposit + Monthly
          </button>
        </div>

        <p className="px-prose-narrow" style={{ marginBottom: 10 }}>{paymentSummaryText}</p>

        {/* Agree */}
        <div style={{ margin: "6px 0 8px" }}>
          <label className="px-prose-narrow" style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <input type="checkbox" checked={agreeChecked} onChange={(e) => setAgreeChecked(e.target.checked)} />
            I have read and agree to the terms above.
          </label>
        </div>

        {/* Sign / Continue */}
{!signatureSubmitted ? (
  <div style={{ display: "flex", justifyContent: "center", marginTop: 8 }}>
    <button
      className="boutique-primary-btn"
      onClick={handleSignClick}
      disabled={!agreeChecked}
      style={{
        width: 260,
        opacity: agreeChecked ? 1 : 0.5,
        cursor: agreeChecked ? "pointer" : "not-allowed",
      }}
    >
      Sign Agreement
    </button>
  </div>
) : (
  <div
    style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      marginTop: 8,
    }}
  >
    <img
      src={`${import.meta.env.BASE_URL}assets/images/contract_signed.png`}
      alt="Agreement Signed"
      className="px-media"
      style={{ maxWidth: 100, marginBottom: 6 }}
    />
    <div
      className="px-prose-narrow"
      style={{
        fontSize: ".9rem",
        color: "#2c62ba",
        textAlign: "center",
      }}
    >
      Agreement signed ✔
    </div>
  </div>
)}

        {/* CTAs */}
        <div className="px-cta-col" style={{ marginTop: 10 }}>
          <button
            className="boutique-primary-btn"
            onClick={() => {
              if (!signatureSubmitted) return;
              try {
                localStorage.setItem("yumStep", "rubiCheckout");
                localStorage.setItem("rubiPayFull", JSON.stringify(payFull));
                localStorage.setItem("rubiDepositCents", String(depositCents));
                localStorage.setItem("rubiTotalCents", String(totalCents));
                localStorage.setItem("rubiDueBy", dueByDate ? dueByDate.toISOString() : "");
                localStorage.setItem("rubiPlanMonths", String(planMonths));
                localStorage.setItem("rubiPerMonthCents", String(perMonthCents));
                localStorage.setItem("rubiLastPaymentCents", String(lastPaymentCents));
                localStorage.setItem("rubiMenuChoice", menuChoice);
                localStorage.setItem("rubiTierPretty", tierSelection.prettyName || "");
              } catch {}
              onContinueToCheckout();
            }}
            disabled={!signatureSubmitted || isGenerating}
            style={{ width: 260, opacity: signatureSubmitted ? 1 : 0.5 }}
          >
            Continue to Payment
          </button>
          <button className="boutique-back-btn" onClick={onBack} style={{ width: 260 }}>
            ⬅ Back to Cart
          </button>
        </div>
      </div>

      {/* Signature modal — standardized (blue X) */}
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
          <div className="pixie-card pixie-card--modal" style={{ maxWidth: 520, position: "relative", overflow: "hidden" }}>
            <button className="pixie-card__close" onClick={() => setShowSignatureModal(false)} aria-label="Close">
              <img src={`${import.meta.env.BASE_URL}assets/icons/blue_ex.png`} alt="Close" />
            </button>

            <div className="pixie-card__body" style={{ textAlign: "center" }}>
              <h3 className="px-title-lg" style={{ fontSize: "1.7rem", marginBottom: 10 }}>
                Sign below or enter a text signature
              </h3>

              <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 10 }}>
                <button
                  type="button"
                  className={`px-toggle__btn ${!useTextSignature ? "px-toggle__btn--blue px-toggle__btn--active" : ""}`}
                  onClick={() => setUseTextSignature(false)}
                  aria-pressed={!useTextSignature}
                >
                  Draw
                </button>
                <button
                  type="button"
                  className={`px-toggle__btn ${useTextSignature ? "px-toggle__btn--pink px-toggle__btn--active" : ""}`}
                  onClick={() => setUseTextSignature(true)}
                  aria-pressed={useTextSignature}
                >
                  Type
                </button>
              </div>

              {useTextSignature ? (
                <input
                  type="text"
                  placeholder="Type your name"
                  value={typedSignature}
                  onChange={(e) => setTypedSignature(e.target.value)}
                  className="px-input"
                  style={{ maxWidth: 420, margin: "0 auto 12px" }}
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

              <button className="boutique-primary-btn" onClick={handleSignatureSubmit} style={{ width: 260, margin: "0 auto" }}>
                Save Signature
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RubiCateringContract;