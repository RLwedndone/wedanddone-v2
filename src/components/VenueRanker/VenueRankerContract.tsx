import React, { useState, useRef, useEffect } from "react";
import SignatureCanvas from "react-signature-canvas";
import { useNavigate } from "react-router-dom";
import { doc, setDoc } from "firebase/firestore";
import { db, auth } from "../../firebase/firebaseConfig";
import { venueDetails } from "../../utils/venueDetails";
import { venueContractSnippets } from "../../utils/venueContractSnippets";
import { calculatePlan } from "../../utils/calculatePlan";
import { getAuth } from "firebase/auth";
import { getDoc } from "firebase/firestore";
import VenueCheckOut from "./VenueCheckOut"; 
import { format, parseISO, isValid as isValidDate } from "date-fns";

interface VenueRankerContractProps {
  venueSlug: string;
  venueName: string;
  venueWeddingDate: string;
  venuePrice: number;
  guestCount: number;
  payFull: boolean;
  setPayFull: (payFull: boolean) => void;
  setSignatureImage: (url: string) => void;
  signatureSubmitted: boolean;
  setSignatureSubmitted: (val: boolean) => void;
  onBack: () => void;
  onContinue: () => void;
  setCurrentScreen: (step: string) => void;
  setLineItems: (items: string[]) => void;
  setPaymentSummary: (summary: string) => void;
  setFinalVenuePrice: (amount: number) => void;
  setFinalDeposit: (amount: number) => void;
  setFinalMonthlyPayment: (amount: number) => void;
  setFinalPaymentCount: (count: number) => void;
  signatureImage: string;
}

const VenueRankerContract: React.FC<VenueRankerContractProps> = ({
  venueSlug,
  venueName,
  venueWeddingDate,
  venuePrice,
  guestCount,
  payFull,
  setPayFull,
  setSignatureImage,
  signatureSubmitted,
  setSignatureSubmitted,
  onBack,
  onContinue,
  setCurrentScreen,
  setFinalVenuePrice,
  setFinalDeposit,
  setFinalMonthlyPayment,
  setFinalPaymentCount,
  signatureImage, 
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const [details, setDetails] = useState<any>(null);
  const venueTerms = venueContractSnippets[venueSlug] || [];

  const [storedVenueName, setStoredVenueName] = useState<string | null>(null);
const [storedWeddingDate, setStoredWeddingDate] = useState<string | null>(null);
const [storedVenuePrice, setStoredVenuePrice] = useState<string | null>(null);

type PaymentPlan = {
  deposit: number;
  monthly: number;
  months: number;           // total installments including the final one
  lastInstallment: number;  // final catch-up amount
  finalDueDate?: string;    // human readable (optional)
  finalDueISO?: string;     // preferred: "YYYY-MM-DD"
  payInFullRequired?: boolean;
};

const formatMoney = (value: number) =>
  Number(value || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

function toValidDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return isValidDate(value) ? value : null;
  if (typeof value === "string") {
    // Prefer ISO if provided
    const d = parseISO(value);
    if (isValidDate(d)) return d;
    const fallback = new Date(value);
    return isValidDate(fallback) ? fallback : null;
  }
  const d = new Date(value as any);
  return isValidDate(d) ? d : null;
}

function formatPaymentSchedule(plan: PaymentPlan): string {
  if (!plan || !Number.isFinite(plan.deposit) || plan.months <= 0) return "";

  // Try ISO first, then any other string, else bail gracefully
  const due =
    toValidDate((plan as any).finalDueISO) ??
    toValidDate((plan as any).finalDueDate);

  if (!due) return "";

  const dueStr = format(due, "MMMM do, yyyy"); // e.g., January 7th, 2026

  const middleCount = Math.max(0, plan.months - 1); // monthly installments before the final
  const parts: string[] = [];

  parts.push(`$${formatMoney(plan.deposit)} deposit`);
  if (middleCount > 0) {
    parts.push(
      `${middleCount} monthly payment${middleCount > 1 ? "s" : ""} of $${formatMoney(
        plan.monthly
      )}`
    );
  }
  parts.push(
    `final payment of $${formatMoney(plan.lastInstallment)} due ${dueStr}`
  );

  // Join nicely
  return parts.join(" + ");
}

// Which date should we use to compute the plan?
const currentWeddingDateISO =
  (storedWeddingDate && storedWeddingDate.length >= 10 ? storedWeddingDate : null) ||
  (venueWeddingDate && venueWeddingDate.length >= 10 ? venueWeddingDate : null) ||
  "";

// Always use the prop slug if present; fall back to LS (very rare)
const slug = venueSlug || localStorage.getItem("venueSlug") || "";

const [plannerPaidCents, setPlannerPaidCents] = useState<number>(0);

// New pricing/plan (handles full, deposit, monthly, 45-day rule)
const plan = React.useMemo(() => {
  if (!slug || !currentWeddingDateISO) {
    return {
      total: 0,
      deposit: 0,
      months: 0,
      monthly: 0,
      lastInstallment: 0,
      firstChargeOn: null as Date | null,
      finalDueDate: "",
      payInFullRequired: false,
    };
  }
  return calculatePlan({
    venueSlug: slug,
    guestCount,
    weddingDate: currentWeddingDateISO,
    payFull,
    plannerPaidCents, // 👈 NEW: keep totals in sync with CastleModal
  });
}, [slug, guestCount, currentWeddingDateISO, payFull, plannerPaidCents]);

// Reflect plan amounts in local UI state that you already show in the view
useEffect(() => {
  setMonthlyPayment(plan.monthly || 0);
  setNumMonthlyPayments(plan.months || 0);
}, [plan.monthly, plan.months]);

const [lineItems, setLineItems] = useState<string[]>([]);
const [paymentSummary, setPaymentSummary] = useState<string>("");

const [firstName, setFirstName] = useState("");
const [lastName, setLastName] = useState("");
const [email, setEmail] = useState("");

const [monthlyPayment, setMonthlyPayment] = useState<number>(0);
const [numMonthlyPayments, setNumMonthlyPayments] = useState<number>(0);


useEffect(() => {
  const fetchUserData = async () => {
    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) return;

    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
      const data: any = userSnap.data();

      // ✨ Basic user fields
      setFirstName(data.firstName || "");
      setLastName(data.lastName || "");
      setEmail(data.email || "");

      // ✨ Planner payments credit
      const purchases = Array.isArray(data?.purchases) ? data.purchases : [];
      const totalPlannerDollars = purchases
        .filter(
          (p: any) =>
            p?.category === "planner" ||
            (typeof p?.label === "string" && p.label.toLowerCase().includes("planner"))
        )
        .reduce((sum: number, p: any) => sum + Number(p?.amount || 0), 0);

      setPlannerPaidCents(Math.round(totalPlannerDollars * 100));
    }
  };

  fetchUserData().catch(console.error);
}, []);

useEffect(() => {
  const name = localStorage.getItem("venueName");
  const date = localStorage.getItem("venueWeddingDate");
  const price = localStorage.getItem("venuePrice");

  console.log("📦 contract screen loaded:");
  console.log("👉 venueName:", name);
  console.log("👉 venueWeddingDate:", date);
  console.log("👉 venuePrice:", price);

  setStoredVenueName(name);
  setStoredWeddingDate(date);
  setStoredVenuePrice(price);
}, []);

  useEffect(() => {
    // 🔝 Force scroll to top on mount
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    if (modalRef.current) {
      modalRef.current.scrollTop = 0;
    }
  }, []);


  const [agreeChecked, setAgreeChecked] = useState<boolean>(() => {
    const saved = localStorage.getItem("venueAgreeChecked");
    return saved === "true";
  });
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [useTextSignature, setUseTextSignature] = useState(false);
  const [typedSignature, setTypedSignature] = useState("");
  const sigCanvasRef = useRef<SignatureCanvas | null>(null);
  const navigate = useNavigate();

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
        finalSignature = sigCanvasRef.current.getCanvas().toDataURL("image/png");
      } catch (error) {
        console.error("❌ Error capturing drawn signature:", error);
        alert("Something went wrong when capturing your drawn signature. Try again!");
        return;
      }
    } else {
      alert("⚠️ Please enter or draw a signature before saving.");
      return;
    }

    setSignatureImage(finalSignature);
    setSignatureSubmitted(true);
    setShowSignatureModal(false);

    const user = auth.currentUser;
    if (user) {
      try {
        await setDoc(
          doc(db, "users", user.uid),
          {
            venueSigned: true,
            signatureImageUrl: finalSignature,
          },
          { merge: true }
        );
        console.log("📝 Signature saved to Firestore");
      } catch (error) {
        console.error("❌ Failed to save signature:", error);
      }
    }
  };

// Make sure you're passing `venueSlug` as a prop
const venueNotes: string[] =
  venueSlug && venueContractSnippets[venueSlug] ? venueContractSnippets[venueSlug] : [];

if (!venueSlug) {
  return (
    <div className="pixie-overlay">
      <div className="card">Oops! No venue selected. Please go back and try again.</div>
    </div>
  );
}

const handleContinueToCheckout = () => {
  // 1) Build the Booking Terms in plain strings (match on-screen wording)
  const bookingTerms: string[] = [
    "Deposit & payments. Your deposit is non-refundable once paid. If you select a monthly plan, remaining installments will be automatically charged to the card on file to complete by the final due date shown at checkout.",
    `Date & availability. Booking is for ${formattedFullDate} at ${storedVenueName || venueName || "the selected venue"}. If the venue is unable to host due to force majeure or venue closure, we’ll work in good faith to reschedule or refund venue fees paid to Wed&Done.`,
    `Guest count lock. Your guest count for this booking is ${guestCount}. The venue’s capacity and pricing are based on that number. The guest count may be increased (subject to venue capacity and price changes) but cannot be decreased after booking.`,
    "Planner fee reconciliation. If you already purchased planning via Pixie Planner, any amount paid there will be credited against the planning tier that corresponds to the guest count on this contract. If your Pixie Planner amount exceeds the applicable planning tier, the difference is credited on this venue booking; if it’s less, the remaining planning fee will be included in your venue total.",
    "Rescheduling. Reschedules are subject to venue availability and may incur additional fees or price adjustments. Seasonal/weekday pricing and service charges may change for new dates.",
    "Cancellations. Venue deposits are non-refundable. If you cancel, non-recoverable costs and fees already incurred may be retained. Any remaining refundable portion will follow the venue’s policy.",
    "Vendor rules. You agree to comply with venue rules (noise, decor, load-in/out, insurance, alcohol, security, etc.). The venue-specific policies above are hereby incorporated.",
    "Liability. Wed&Done is not liable for venue restrictions or consequential damages. Our liability is limited to amounts paid to Wed&Done for this venue booking.",
    "Force majeure. Neither party is liable for failure or delay caused by events beyond reasonable control (e.g., acts of God, government actions, labor disputes, epidemics/pandemics, utility outages). If performance is prevented, we’ll work in good faith to reschedule; if rescheduling is not possible, refundable amounts (if any) will be returned less non-recoverable costs.",
  ];

  // 2) Build your line-items + summary for UI (unchanged)
  setLineItems([
    `Venue: ${venueName}`,
    `${guestCount} guests`,
    `Wedding Date: ${currentWeddingDateISO || venueWeddingDate}`,
    `Total: $${(plan.total || 0).toFixed(2)}`
  ]);

  setPaymentSummary(
    payFull || plan.payInFullRequired
      ? `Venue Booking Total: $${(plan.total || 0).toFixed(2)}`
      : `Deposit: $${(plan.deposit || 0).toFixed(2)} then ${plan.months - 1}× $${(plan.monthly || 0).toFixed(2)} + final $${(plan.lastInstallment || 0).toFixed(2)}`
  );

  setFinalVenuePrice(plan.total || 0);
  setFinalDeposit(payFull || plan.payInFullRequired ? plan.total || 0 : plan.deposit || 0);
  setFinalMonthlyPayment(plan.monthly || 0);
  setFinalPaymentCount(plan.months || 0);

  // 3) Persist EVERYTHING Checkout/PDF needs in one object
  const contractPayload = {
    venueName,                               // 👈 ensure we store an explicit venue name
    weddingDate: currentWeddingDateISO || venueWeddingDate,
    venuePrice: plan.total || 0,
    depositAmount: payFull || plan.payInFullRequired ? 0 : (plan.deposit || 0),
    monthlyPayment: plan.monthly || 0,
    numMonthlyPayments: plan.months || 0,
    payFull: Boolean(payFull || plan.payInFullRequired),
    signatureImage,                          // already captured earlier

    // Terms content for the PDF:
    venueSpecificDetails: venueNotes || [],  // (rename from 'venueTerms' for clarity)
    bookingTerms,                            // 👈 the big list above

    // For email/PDF
    firstName,
    lastName,
  };

  localStorage.setItem("venueContractData", JSON.stringify(contractPayload));

  setCurrentScreen("checkout");
};

// Keep localStorage in sync
useEffect(() => {
  localStorage.setItem("venueAgreeChecked", agreeChecked ? "true" : "false");
}, [agreeChecked]);

// After a signature is saved, force the box to stay checked
useEffect(() => {
  if (signatureSubmitted) {
    setAgreeChecked(true);
    localStorage.setItem("venueAgreeChecked", "true");
  }
}, [signatureSubmitted]);

  
  useEffect(() => {
    if (slug && venueDetails[slug]) {
      setDetails(venueDetails[slug]);
    }
  }, [slug]);

  // Use whichever we have; don't append times
const rawWeddingDate = storedWeddingDate || venueWeddingDate || "";

// Reuse your helper to parse either plain YYYY-MM-DD or ISO-with-time
const weddingDateObj = toValidDate(rawWeddingDate);

const formattedFullDate = weddingDateObj
  ? format(weddingDateObj, "MMMM d, yyyy")
  : "your wedding date";

const formattedWeekday = weddingDateObj
  ? format(weddingDateObj, "EEEE")
  : "day of week";


  return (
    <>
      <div className="pixie-card pixie-card--modal" ref={modalRef}>
        {/* Close (pink X) */}
        <button
          className="pixie-card__close"
          onClick={() => setCurrentScreen("scroll-of-possibilities")}
          aria-label="Close"
        >
          <img src={`${import.meta.env.BASE_URL}assets/icons/pink_ex.png`} alt="Close"/>
        </button>
  
        {/* Body */}
        <div className="pixie-card__body" style={{ textAlign: "center" }}>
          <h2 className="px-title-lg" style={{ marginBottom: "0.75rem" }}>
            Venue Booking Contract
          </h2>
  
          {/* Seal – explicitly size it */}
          <img
            src={`${import.meta.env.BASE_URL}assets/images/venue_ranker_contract_seal.png`}
            alt="Venue Ranker Icon"
            className="px-media"
            style={{ width: 150, height: "auto", margin: "0 auto 14px" }}
          />
  
          {/* Intro – narrow like Floral */}
          <div className="px-prose-narrow" style={{ margin: "0 auto 18px" }}>
            <p>
              You’re booking <strong>{storedVenueName || venueName}</strong> for{" "}
              <strong>{formattedFullDate}</strong> ({formattedWeekday}).
            </p>
            <p>
  The total venue cost is{" "}
  <strong>${formatMoney(plan.total || 0)}</strong>.
</p>
          </div>
  
          {/* ---- Venue Specific Details ---- */}
          <h3 className="px-title" style={{ fontSize: "1.8rem", margin: "1rem 0 .5rem" }}>
            Venue Specific Details
          </h3>
  
          <div
  className="px-prose-narrow"
  style={{ textAlign: "left", margin: "0 auto 20px" }}
>
  {venueNotes?.length ? (
    venueNotes.map((line, idx) => {
      // Detect short heading lines with no punctuation
      const isHeading = line.length <= 45 && !/[.!?]/.test(line);

      return isHeading ? (
        <h4
          key={`h-${idx}`}
          style={{
            fontWeight: 700,
            margin: "1.2rem 0 .4rem",
            fontSize: "1.05rem",
          }}
        >
          {line}
        </h4>
      ) : (
        <p
          key={`p-${idx}`}
          style={{
            margin: ".35rem 0",
            lineHeight: 1.6,
          }}
        >
          {line}
        </p>
      );
    })
  ) : (
    <p>
      Venue-specific agreement details will appear here based on your selected
      venue.
    </p>
  )}
</div>
  
          {/* ---- Booking Terms ---- */}
          <h3 className="px-title" style={{ fontSize: "1.8rem", margin: "1rem 0 .5rem" }}>
            Booking Terms
          </h3>
  
          <div className="px-prose-narrow" style={{ textAlign: "left", margin: "0 auto 18px" }}>
          <ul style={{ paddingLeft: "1.25rem", margin: 0 }}>
  <li>
    <strong>Deposit & payments.</strong> Your deposit is non-refundable once paid.
    If you select a monthly plan, remaining installments will be automatically
    charged to the card on file on a monthly schedule to complete by the final due
    date shown at checkout.
  </li>

  <li>
    <strong>Date & availability.</strong> Booking is for{" "}
    <em>{formattedFullDate}</em> at{" "}
    <em>{storedVenueName || venueName}</em>. If the venue is unable to host due
    to force majeure or venue closure, we’ll work in good faith to reschedule or
    refund venue fees paid to Wed&Done.
  </li>

  <li>
    <strong>Guest count lock.</strong> Your guest count for this booking is{" "}
    <strong>{guestCount}</strong>. The venue’s capacity and pricing are based on
    that number. The guest count may be increased (subject to venue capacity and
    price changes) but cannot be decreased after booking.
  </li>

  <li>
    <strong>Planner fee reconciliation.</strong> If you already purchased planning
    via Pixie Planner, any amount paid there will be <em>credited</em> against the
    planning tier that corresponds to the guest count set on this contract. If your
    Pixie Planner amount exceeds the applicable planning tier, the difference will
    be credited on this venue booking; if it’s less, the remaining planning fee will
    be included in your venue total.
  </li>

  <li>
    <strong>Rescheduling.</strong> Reschedules are subject to venue availability
    and may incur additional fees or price adjustments. Seasonal/weekday pricing
    and service charges may change for new dates.
  </li>

  <li>
    <strong>Cancellations.</strong> Venue deposits are non-refundable. If you
    cancel, non-recoverable costs and fees already incurred may be retained. Any
    remaining refundable portion will follow the venue’s policy.
  </li>

  <li>
    <strong>Vendor rules.</strong> You agree to comply with venue rules (noise,
    decor, load-in/out, insurance, alcohol, security, etc.). Additional
    venue-specific policies in the section above are hereby incorporated.
  </li>

  <li>
    <strong>Liability.</strong> Wed&Done is not liable for venue restrictions or
    consequential damages. Our liability is limited to amounts paid to Wed&Done for
    this venue booking.
  </li>

  <li>
    <strong>Force majeure.</strong> Neither party is liable for failure or delay
    caused by events beyond reasonable control (e.g., acts of God, government
    actions, labor disputes, epidemics/pandemics, or utility outages). If
    performance is prevented, we’ll work in good faith to reschedule; if
    rescheduling is not possible, refundable amounts (if any) will be returned less
    non-recoverable costs.
  </li>
</ul>
          </div>
  
          <h4 className="px-title" style={{ fontSize: "1.8rem", marginBottom: "0.5rem" }}>
  Choose how you’d like to pay:
</h4>
  
<div className="px-toggle" style={{ marginBottom: 12 }}>
  <button
    type="button"
    className={`px-toggle__btn ${payFull ? "px-toggle__btn--blue px-toggle__btn--active" : ""}`}
    style={{ minWidth: 150, padding: "0.6rem 1rem", fontSize: ".9rem" }}
    onClick={() => { setPayFull(true); setSignatureSubmitted(false); }}
  >
    Pay Full Amount
  </button>
  <button
    type="button"
    className={`px-toggle__btn ${!payFull ? "px-toggle__btn--pink px-toggle__btn--active" : ""}`}
    style={{ minWidth: 150, padding: "0.6rem 1rem", fontSize: ".9rem" }}
    onClick={() => { setPayFull(false); setSignatureSubmitted(false); }}
  >
    Deposit + Monthly
  </button>
</div>
  
          {/* schedule line */}
          {(() => {
  const scheduleLine =
    !payFull && !plan?.payInFullRequired && plan && plan.months > 0
      ? formatPaymentSchedule(plan as any)
      : "";
  return scheduleLine ? (
    <p className="px-prose-narrow" style={{ marginBottom: "1.25rem" }}>
      {scheduleLine}
    </p>
  ) : null;
})()}
  
          {plan.payInFullRequired && (
            <p style={{ fontSize: ".9rem", color: "#b30000", marginTop: "-.5rem", marginBottom: "1rem" }}>
              Your wedding date is within 45 days — full payment is required at checkout.
            </p>
          )}
  
  <p className="px-prose-narrow" style={{ marginBottom: "1.75rem" }}>
  By signing this agreement, you agree that the deposit paid is non-refundable. Monthly payments will be automatically
  scheduled unless the full amount is paid today. Rescheduling may be subject to availability and additional fees.
</p>
  
          {/* Agreement + CTAs */}
          <div className="px-section" style={{ maxWidth: 520, margin: "0 auto" }}>
            <label className="px-checkbox" style={{ justifyContent: "center", marginBottom: 12 }}>
              <input
                type="checkbox"
                checked={agreeChecked}
                onChange={(e) => setAgreeChecked(e.target.checked)}
              />
              <span>I agree to the terms of this venue agreement.</span>
            </label>
  
            <div className="px-cta-col" style={{ marginTop: 8 }}>
            {!signatureSubmitted ? (
  <button
    className="boutique-primary-btn px-btn-200"
    onClick={() => agreeChecked && setShowSignatureModal(true)}
    disabled={!agreeChecked}
  >
    Sign Contract
  </button>
) : (
  <>
    <img
      src={`${import.meta.env.BASE_URL}assets/images/contract_signed.png`}
      alt="Signed"
      style={{ width: 120, margin: "4px auto 8px", display: "block" }}
    />
    <button
      className="boutique-primary-btn px-btn-200"
      onClick={handleContinueToCheckout}
    >
      Continue to Checkout
    </button>
  </>
)}
  
              <button
                className="boutique-back-btn px-btn-200"
                onClick={() => setCurrentScreen("rankerComplete")}
              >
                ← Back to Scroll
              </button>
            </div>
          </div>
        </div>{/* ← CLOSE .pixie-card__body */}
      </div>{/* ← CLOSE .pixie-card */}
  
      {/* Signature Modal */}
{showSignatureModal && (
  <div
    className="pixie-overlay"
    role="dialog"
    aria-modal="true"
    onClick={() => setShowSignatureModal(false)}
  >
    <div
      className="pixie-card pixie-card--modal"
      style={{ maxWidth: 600 }}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        className="pixie-card__close"
        onClick={() => setShowSignatureModal(false)}
        aria-label="Close"
      >
        <img src={`${import.meta.env.BASE_URL}assets/icons/pink_ex.png`} alt="Close" />
      </button>

      <div className="pixie-card__body" style={{ textAlign: "center" }}>
        <h2 className="px-title" style={{ marginBottom: "0.75rem" }}>
          Sign below or enter your text signature
        </h2>

        {/* Draw / Type toggle */}
        <div className="px-toggle" style={{ marginBottom: 12 }}>
          <button
            className={`px-toggle__btn px-toggle__btn--blue ${!useTextSignature ? "px-toggle__btn--active" : ""}`}
            onClick={() => setUseTextSignature(false)}
          >
            Draw
          </button>
          <button
            className={`px-toggle__btn px-toggle__btn--pink ${useTextSignature ? "px-toggle__btn--active" : ""}`}
            onClick={() => setUseTextSignature(true)}
          >
            Type
          </button>
        </div>

        {/* Signature UI */}
        {useTextSignature ? (
          <>
            <input
              className="px-input"
              type="text"
              value={typedSignature}
              onChange={(e) => setTypedSignature(e.target.value)}
              placeholder="Type your full name"
              style={{ maxWidth: 420, margin: "0 auto 10px" }}
            />
            <div
              style={{
                fontFamily: "'Jenna Sue', cursive",
                fontSize: "2.2rem",
                border: "2px solid #d7dbe7",
                borderRadius: 12,
                padding: "12px 16px",
                margin: "0 auto 16px",
                maxWidth: 420,
              }}
            >
              {typedSignature || "Your Signature Preview"}
            </div>
          </>
        ) : (
          <SignatureCanvas
  ref={sigCanvasRef}
  penColor="#2c62ba"
  canvasProps={{
    style: {
      width: "100%",
      maxWidth: 420,
      height: 150,
      border: "1px solid #ccc",
      borderRadius: 12,
      margin: "0 auto 12px",
      display: "block",
      background: "#fff",
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
  </div>
)}
    </>
  );
};

export default VenueRankerContract;
