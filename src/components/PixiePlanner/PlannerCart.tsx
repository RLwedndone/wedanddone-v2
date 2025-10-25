import React, { useEffect, useState, useMemo } from "react";
import { getAuth } from "firebase/auth";
import { db } from "../../firebase/firebaseConfig";
import { doc, setDoc } from "firebase/firestore";

interface PlannerCartProps {
  onContinue: (guestCount: number, total: number) => void;
  onClose: () => void;
}

const MARGIN_RATE = 0.04;
const SALES_TAX_RATE = 0.086;
const STRIPE_RATE = 0.029;
const STRIPE_FLAT_FEE = 0.3;

const basePriceFor = (count: number) => {
  if (count <= 50) return 1250;
  if (count <= 100) return 1550;
  if (count <= 150) return 1850;
  return 2150; // up to 200
};

const PlannerCart: React.FC<PlannerCartProps> = ({ onContinue, onClose }) => {
  const [guestCount, setGuestCount] = useState<number>(50);

  const total = useMemo(() => {
    const base = basePriceFor(guestCount);
    const margin = base * MARGIN_RATE;
    const taxed = (base + margin) * SALES_TAX_RATE;
    const stripeFee = (base + margin) * STRIPE_RATE + STRIPE_FLAT_FEE;
    return base + margin + taxed + stripeFee;
  }, [guestCount]);

  useEffect(() => {
    // (optional) could prefill from saved state if you add that later
  }, []);

  const handleConfirm = async () => {
    const auth = getAuth();
    const user = auth.currentUser;

    if (user) {
      try {
        await setDoc(
          doc(db, "users", user.uid),
          {
            guestCount,
            plannerData: {
              guestCount,
              plannerTotal: total,
            },
          },
          { merge: true }
        );
        console.log("✅ Saved planner cart to Firestore");
      } catch (err) {
        console.error("❌ Failed to save planner cart:", err);
      }
    }

    onContinue(guestCount, total);
  };

  return (
    <div className="pixie-card">
      {/* 🔸 Pink X close */}
      <button className="pixie-card__close" onClick={onClose} aria-label="Close">
        <img src={`${import.meta.env.BASE_URL}assets/icons/pink_ex.png`} alt="Close" />
      </button>

      {/* ---------- Body ---------- */}
      <div className="pixie-card__body">
        {/* Character Video */}
        <video
          src={`${import.meta.env.BASE_URL}assets/videos/wedding_guests.mp4`}
          autoPlay
          muted
          loop
          playsInline
          className="px-media--sm"
          style={{ marginBottom: "1rem" }}
        />

        {/* Title */}
<h2
  className="px-title"
  style={{
    marginBottom: "0.75rem",
    fontSize: "2rem", // 🔹 bump up from default
    lineHeight: 1.25, // optional: keeps it visually balanced
  }}
>
  How many guests will you have?
</h2>

        {/* Small explainer */}
        <p className="px-prose-narrow" style={{ marginBottom: "1rem" }}>
          Pick your expected guest tier—your coordinator package is priced by headcount.
        </p>

        {/* Guest tier selector */}
        <div style={{ width: "100%", maxWidth: 420, margin: "0 auto 1.25rem" }}>
          <label className="px-prose-narrow" style={{ display: "block", marginBottom: 6, fontWeight: 700 }}>
            Guest Count
          </label>
          <select
            className="px-input"
            value={guestCount}
            onChange={(e) => setGuestCount(parseInt(e.target.value, 10))}
          >
            <option value={50}>Up to 50 guests</option>
            <option value={100}>Up to 100 guests</option>
            <option value={150}>Up to 150 guests</option>
            <option value={200}>Up to 200 guests</option>
          </select>
        </div>

        {/* Totals */}
        <div className="px-totals" style={{ marginBottom: "1rem" }}>
         Total (includes taxes &amp; fees): ${total.toFixed(2)}
        </div>

        {/* Buttons */}
        <div className="px-cta-col">
          <button className="boutique-primary-btn" onClick={handleConfirm}>
            Confirm &amp; Book
          </button>
          <button className="boutique-back-btn" onClick={onClose}>
            ⬅ Back
          </button>
        </div>
      </div>
    </div>
  );
};

export default PlannerCart;