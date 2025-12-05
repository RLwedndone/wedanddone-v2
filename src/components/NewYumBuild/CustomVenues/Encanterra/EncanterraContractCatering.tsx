// src/components/NewYumBuild/CustomVenues/Encanterra/EncanterraContractCatering.tsx
import React, { useEffect, useRef, useState } from "react";
import SignatureCanvas from "react-signature-canvas";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { db } from "../../../../firebase/firebaseConfig";
import { getGuestState } from "../../../../utils/guestCountStore";

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
type Tier = "oneCarat" | "twoCarat" | "threeCarat";
const TIER_LABEL: Record<Tier, string> = {
  oneCarat: "1 Carat",
  twoCarat: "2 Carat",
  threeCarat: "3 Carat",
};

export interface EncanterraMenuSelections {
  tier: Tier;
  hors: string[];
  salads: string[];
  entrees: string[];
  sides: string[];
}

interface Props {
  total: number; // grand total from cart (includes service fee, tax, card fees)
  guestCount: number;
  weddingDate: string | null;
  dayOfWeek: string | null;
  lineItems: string[];
  selectedTier: Tier;
  menuSelections: EncanterraMenuSelections;

  signatureImage: string | null;
  setSignatureImage: (v: string) => void;
  signatureSubmitted: boolean;
  setSignatureSubmitted: (v: boolean) => void;

  setStep: (step: string) => void; // "encanterraCheckout"
  onClose: () => void;
  onComplete: () => void; // not used here anymore, but kept for parity
}

const EncanterraContractCatering: React.FC<Props> = ({
  total,
  guestCount,
  weddingDate,
  dayOfWeek,
  lineItems,
  selectedTier,
  menuSelections,
  signatureImage,
  setSignatureImage,
  signatureSubmitted,
  setSignatureSubmitted,
  setStep,
  onClose,
  onComplete, // eslint appeasement
}) => {
  const auth = getAuth();

  // user basics for display / metadata
  const [userId, setUserId] = useState<string | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

  // ui
  const [agreeChecked, setAgreeChecked] = useState(false);
  const [payFull, setPayFull] = useState(true);
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [useTextSignature, setUseTextSignature] = useState(false);
  const [typedSignature, setTypedSignature] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const sigCanvasRef = useRef<SignatureCanvas | null>(null);

  // guest count (locked)
  const [lockedGuestCount, setLockedGuestCount] = useState<number>(guestCount || 0);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (guestCount > 0) {
        if (alive) setLockedGuestCount(guestCount);
        return;
      }
      try {
        const st = await getGuestState();
        let v = Number(st.value || 0);
        if (!v) {
          v =
            Number(localStorage.getItem("encanterraGuestCount") || 0) ||
            Number(localStorage.getItem("magicGuestCount") || 0);
        }
        if (alive) setLockedGuestCount(v);
      } catch {
        const v =
          Number(localStorage.getItem("encanterraGuestCount") || 0) ||
          Number(localStorage.getItem("magicGuestCount") || 0);
        if (alive) setLockedGuestCount(v);
      }
    })();
    return () => {
      alive = false;
    };
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
  const planMonths =
    wedding && dueByDate ? monthsBetweenInclusive(new Date(), dueByDate) : 1;
  const perMonthCents =
    planMonths > 0 ? Math.floor(balanceCents / planMonths) : balanceCents;
  const lastPaymentCents =
    balanceCents - perMonthCents * Math.max(0, planMonths - 1);

  const paymentSummaryText = payFull
    ? `You’re paying $${Number(total).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})} today.`
    : `You’re paying $${depositAmount.toFixed(
        2
      )} today, then monthly through ${prettyDueBy}. Est. ${planMonths} payments of $${(
        perMonthCents / 100
      ).toFixed(2)}${
        planMonths > 1
          ? ` (last ≈ $${Number((lastPaymentCents / 100)).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})})`
          : ""
      }`;

  // boot/persist progress
  useEffect(() => {
    try {
      localStorage.setItem("yumStep", "encanterraContract");
    } catch {}
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) return;
      setUserId(u.uid);
      try {
        const userRef = doc(db, "users", u.uid);
        const snap = await getDoc(userRef);
        const d = (snap.data() || {}) as any;
        setFirstName(d.firstName || "");
        setLastName(d.lastName || "");

        await updateDoc(userRef, { "progress.yumYum.step": "encanterraContract" });
        await setDoc(
          doc(userRef, "yumYumData", "encanterraSelections"),
          menuSelections,
          { merge: true }
        );
        await setDoc(
          doc(userRef, "yumYumData", "encanterraCart"),
          { guestCount: lockedGuestCount, tier: selectedTier },
          { merge: true }
        );
        await setDoc(
          doc(userRef, "yumYumData", "lineItems"),
          { lineItems },
          { merge: true }
        );
      } catch (e) {
        console.error("🔥 Error initializing contract state:", e);
      }
    });
    return () => unsub();
  }, [auth, lineItems, menuSelections, selectedTier, lockedGuestCount]);

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

    // Save to Firestore + localStorage for checkout / PDFs
    const u = auth.currentUser;
    try {
      localStorage.setItem("encSignatureImage", finalSignature);
      localStorage.setItem("yumSignature", finalSignature);
    } catch {
      /* ignore */
    }

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

  /* -------------------- handoff to Checkout -------------------- */
  const handleContinueToPayment = () => {
    if (!signatureSubmitted) return;

    try {
      // Canonical yum keys (used across venues)
      localStorage.setItem("yumStep", "encanterraCheckout");
      localStorage.setItem("yumCateringPayFull", JSON.stringify(payFull));
      localStorage.setItem("yumCateringDepositAmount", String(depositCents));
      localStorage.setItem("yumCateringTotalCents", String(totalCents));
      localStorage.setItem("yumCateringDueBy", dueByDate ? dueByDate.toISOString() : "");
      localStorage.setItem("yumCateringPlanMonths", String(planMonths));
      localStorage.setItem("yumCateringPerMonthCents", String(perMonthCents));
      localStorage.setItem("yumCateringLastPaymentCents", String(lastPaymentCents));

      // Venue-specific mirrors (what EncanterraCheckOutCatering reads first)
      localStorage.setItem("encPayFull", JSON.stringify(payFull));
      localStorage.setItem("encDepositAmountCents", String(depositCents));
      localStorage.setItem("encTotalCents", String(totalCents));
      localStorage.setItem("encDueByISO", dueByDate ? dueByDate.toISOString() : "");
      localStorage.setItem("encPlanMonths", String(planMonths));
      localStorage.setItem("encPerMonthCents", String(perMonthCents));
      localStorage.setItem("encLastPaymentCents", String(lastPaymentCents));
      localStorage.setItem("encPaymentSummaryText", paymentSummaryText);

      // label + context
      localStorage.setItem("encVenueName", "Encanterra");
      if (weddingDate) localStorage.setItem("encWeddingDate", weddingDate);
      if (dayOfWeek) localStorage.setItem("encDayOfWeek", dayOfWeek);
      localStorage.setItem("encTierId", TIER_LABEL[selectedTier]); // "1 Carat" style
      localStorage.setItem("encanterraPerGuest", String(total / Math.max(1, lockedGuestCount)));
      localStorage.setItem(
        "encSelections",
        JSON.stringify({
          hors: menuSelections.hors,
          salads: menuSelections.salads,
          sides: menuSelections.sides,
          entrees: menuSelections.entrees,
        })
      );
      localStorage.setItem("encLineItems", JSON.stringify(lineItems));
    } catch {
      // worst case, checkout will recompute with fallbacks
    }

    setStep("encanterraCheckout");
  };

  /* -------------------- UI (standardized) -------------------- */
  return (
    <div className="pixie-card pixie-card--modal" style={{ maxWidth: 720 }}>
      {/* 🩷 Pink X Close */}
      <button className="pixie-card__close" onClick={onClose} aria-label="Close">
        <img
          src={`${import.meta.env.BASE_URL}assets/icons/pink_ex.png`}
          alt="Close"
        />
      </button>

      <div className="pixie-card__body" style={{ textAlign: "center" }}>
        <img
          src={`${import.meta.env.BASE_URL}assets/images/yum_yum_button.png`}
          alt="Catering Seal"
          className="px-media"
          style={{ width: 110, margin: "0 auto 12px" }}
        />

        <h2 className="px-title-lg" style={{ marginBottom: 8 }}>
          Encanterra Catering Agreement — {TIER_LABEL[selectedTier]}
        </h2>

        <p className="px-prose-narrow" style={{ marginBottom: 6 }}>
          You’re booking catering for <strong>{prettyWedding}</strong>{" "}
          ({dayOfWeek || "TBD"}).
        </p>

        <p className="px-prose-narrow" style={{ marginBottom: 12 }}>
          Total catering cost:{" "}
          <strong>${Number(total).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</strong> for {lockedGuestCount} guest
          {lockedGuestCount === 1 ? "" : "s"}. This amount includes venue service
          fees, applicable taxes, and card processing fees.
        </p>

        {/* Booking Terms */}
        <div
          className="px-section"
          style={{ maxWidth: 640, margin: "0 auto 12px", textAlign: "left" }}
        >
          <h3
            className="px-title"
            style={{ textAlign: "center", marginBottom: 6 }}
          >
            Booking Terms
          </h3>
          <ul
            className="px-prose-narrow"
            style={{ margin: 0, paddingLeft: "1.25rem", lineHeight: 1.6 }}
          >
            <li>
              The amount listed above will count toward any Food &amp; Beverage
              minimum in your Encanterra Venue Contract. Any remaining amount
              needed to reach the minimum can be covered by the bar package you
              book directly with the venue, or by adding more items to this
              contract.
            </li>
            <li>
              You may pay in full today, or place a{" "}
              <strong>25% non-refundable deposit</strong>. Any remaining balance
              will be split into monthly installments and must be fully paid{" "}
              <strong>35 days before your wedding date</strong>.
            </li>
            <li>
              Final guest count is due <strong>30 days</strong> before your
              wedding. You may increase your count starting 45 days out, but it
              cannot be lowered after booking.
            </li>
            <li>
              <strong>Bar Packages:</strong> All alcohol is booked directly with
              the venue per Arizona liquor laws. Wed&amp;Done does not provide
              bar service or alcohol.
            </li>
            <li>
              <strong>Cancellation &amp; Refunds:</strong> If you cancel more
              than 35 days prior, amounts paid beyond the non-refundable portion
              will be refunded less any non-recoverable costs already incurred.
              Within 35 days, all payments are non-refundable.
            </li>
            <li>
              <strong>Missed Payments:</strong> We’ll automatically retry your
              card. After 7 days, a $25 late fee applies; after 14 days,
              services may be suspended and this agreement may be in default.
            </li>
            <li>
              <strong>Food Safety &amp; Venue Policies:</strong> We’ll follow
              standard food-safety guidelines and comply with venue rules, which
              may limit service/display options.
            </li>
            <li>
              <strong>Force Majeure:</strong> Neither party is liable for delays
              beyond reasonable control. We’ll work in good faith to reschedule;
              if not possible, we’ll refund amounts paid beyond non-recoverable
              costs incurred.
            </li>
            <li>
              In the unlikely event of our cancellation or issue, liability is
              limited to a refund of payments made.
            </li>
          </ul>
        </div>

        {/* Plan toggle */}
        <h4
          className="px-title"
          style={{ marginTop: 6, marginBottom: 6 }}
        >
          Choose how you’d like to pay:
        </h4>
        <div className="px-toggle" style={{ marginBottom: 8 }}>
          <button
            type="button"
            className={`px-toggle__btn ${
              payFull ? "px-toggle__btn--blue px-toggle__btn--active" : ""
            }`}
            onClick={() => {
              setPayFull(true);
              setSignatureSubmitted(false);
            }}
            aria-pressed={payFull}
          >
            Pay in Full
          </button>
          <button
            type="button"
            className={`px-toggle__btn ${
              !payFull ? "px-toggle__btn--pink px-toggle__btn--active" : ""
            }`}
            onClick={() => {
              setPayFull(false);
              setSignatureSubmitted(false);
            }}
            aria-pressed={!payFull}
          >
            Deposit + Monthly
          </button>
        </div>

        <p className="px-prose-narrow" style={{ marginBottom: 10 }}>
          {paymentSummaryText}
        </p>

        {/* Agree */}
        <div style={{ margin: "6px 0 8px" }}>
          <label
            className="px-prose-narrow"
            style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
          >
            <input
              type="checkbox"
              checked={agreeChecked}
              onChange={(e) => setAgreeChecked(e.target.checked)}
            />
            I have read and agree to the terms above.
          </label>
        </div>

        {/* Sign / Continue */}
        {!signatureSubmitted ? (
          <div
            style={{ display: "flex", justifyContent: "center", marginTop: 8 }}
          >
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
            style={{ display: "flex", justifyContent: "center", marginTop: 8 }}
          >
            <img
              src={`${import.meta.env.BASE_URL}assets/images/contract_signed.png`}
              alt="Agreement Signed"
              className="px-media"
              style={{ maxWidth: 140 }}
            />
          </div>
        )}

        {/* CTAs */}
        <div className="px-cta-col" style={{ marginTop: 10 }}>
          <button
            className="boutique-primary-btn"
            onClick={handleContinueToPayment}
            disabled={!signatureSubmitted || isGenerating}
            style={{
              width: 260,
              opacity: signatureSubmitted ? 1 : 0.5,
              cursor: signatureSubmitted ? "pointer" : "not-allowed",
            }}
          >
            Continue to Payment
          </button>
          <button
            className="boutique-back-btn"
            onClick={() => setStep("encanterraCart")}
            style={{ width: 260 }}
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
            style={{ maxWidth: 520, position: "relative", overflow: "hidden" }}
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

            <div className="pixie-card__body" style={{ textAlign: "center" }}>
              <h3
                className="px-title-lg"
                style={{ fontSize: "1.7rem", marginBottom: 10 }}
              >
                Sign below or enter a text signature
              </h3>

              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  gap: 8,
                  marginBottom: 10,
                }}
              >
                <button
                  type="button"
                  className={`px-toggle__btn ${
                    !useTextSignature
                      ? "px-toggle__btn--blue px-toggle__btn--active"
                      : ""
                  }`}
                  onClick={() => setUseTextSignature(false)}
                  aria-pressed={!useTextSignature}
                >
                  Draw
                </button>
                <button
                  type="button"
                  className={`px-toggle__btn ${
                    useTextSignature
                      ? "px-toggle__btn--pink px-toggle__btn--active"
                      : ""
                  }`}
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

              <button
                className="boutique-primary-btn"
                onClick={handleSignatureSubmit}
                style={{ width: 260, margin: "0 auto" }}
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

export default EncanterraContractCatering;