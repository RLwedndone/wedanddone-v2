// src/components/MagicCloud/MagicCloud.tsx
import React, { useState, useEffect } from "react";
import { getAuth } from "firebase/auth";
import { getUserDoc } from "../../helpers/firebaseUtils";
import MagicWandAccountModal from "./MagicWandAccountModal";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../../firebase/firebaseConfig";
import OutsidePurchasesModal from "./OutsidePurchasesModal";
import WandMagicMeter from "./WandMagicMeter"; // (kept import; if unused, fine)

interface MagicCloudProps {
  isMobile: boolean;
  onClose: () => void;
  triggerLogin: () => void;
  triggerSignupModal?: () => void;
}

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
type WnDPurchase = {
  // common
  label?: string;
  category?: string;
  boutique?: string;
  source?: string; // "W&D" etc.
  type?: string;   // "manual" for outside items, anything else is W&D
  date?: string;

  // amounts
  amount?: number;               // often the charge today (deposit)
  amountChargedToday?: number;   // explicit charge today
  payFull?: boolean;
  deposit?: number;
  monthlyAmount?: number;
  months?: number;
  installments?: number;
  numMonths?: number;

  // full totals saved by boutiques
  fullContractAmount?: number;
  contractTotal?: number;
  total?: number;

  // itemization
  items?: string[];
};

type OutsidePurchase = { label: string; amount: number };

const MagicCloud: React.FC<MagicCloudProps> = ({ isMobile, onClose }) => {
  const [customBudget, setCustomBudget] = useState("");
  const [mode, setMode] = useState<"entry" | "overview">("entry");
  const [savedBudget, setSavedBudget] = useState<number | null>(null);

  // 🔧 widen typing so we can show W&D line items
  const [purchases, setPurchases] = useState<WnDPurchase[]>([]);
  const [outsidePurchases, setOutsidePurchases] = useState<OutsidePurchase[]>([]);
  const [showOutsideModal, setShowOutsideModal] = useState(false);
  const [showSignupModal, setShowSignupModal] = useState(false);

  // ─────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────
  const formatDollars = (amount: number) => `$${amount.toLocaleString()}`;

  // Treat every Wed&Done purchase as the FULL contracted amount for budgeting.
  const getFullContractAmount = (p: WnDPurchase): number => {
    // ignore manual outside items (they’re tracked separately)
    if (p?.type === "manual") return 0;

    if (typeof p.fullContractAmount === "number") return p.fullContractAmount;
    if (typeof p.contractTotal === "number") return p.contractTotal;
    if (typeof p.total === "number") return p.total;

    // fallback: derive from deposit/monthlies
    const payFull = Boolean(p?.payFull);
    const amount = Number(p?.amount ?? 0);
    const deposit = Number(p?.deposit ?? 0);
    const monthlyAmount = Number(p?.monthlyAmount ?? 0);
    const months = Number(p?.months ?? p?.installments ?? p?.numMonths ?? 0);

    if (payFull) return amount || deposit + monthlyAmount * months || 0;

    const derived = deposit + monthlyAmount * months;
    return Math.max(derived, amount);
  };

  const totalOutsideSpend = outsidePurchases.reduce((acc, p) => acc + p.amount, 0);
  const wedDoneSpend = purchases.reduce((sum, p) => sum + getFullContractAmount(p), 0);
  const totalSpent = wedDoneSpend + totalOutsideSpend;

  const budgetNumber = Number(savedBudget ?? customBudget ?? 0);
  const remaining = Math.max(0, budgetNumber - totalSpent);

  // ─────────────────────────────────────────────
  // Data bootstrap
  // ─────────────────────────────────────────────
  useEffect(() => {
    const saved = localStorage.getItem("magicBudget");
    if (saved) {
      const parsed = parseInt(saved);
      setSavedBudget(parsed);
      setMode("overview");
    }

    const fetchData = async () => {
      const userDoc = await getUserDoc();

      if (userDoc?.data?.budget) {
        setSavedBudget(userDoc.data.budget);
        setMode("overview");
      }

      if (userDoc?.data?.budgetData?.outsidePurchases) {
        const fromFirestore = userDoc.data.budgetData.outsidePurchases as OutsidePurchase[];
        setOutsidePurchases(fromFirestore);
        localStorage.setItem("outsidePurchases", JSON.stringify(fromFirestore));
      }

      if (userDoc?.data?.purchases) {
        // purchases can include both W&D and manual entries
        setPurchases(userDoc.data.purchases as WnDPurchase[]);
      }
    };

    fetchData();

    const handleRefresh = () => fetchData();
    window.addEventListener("purchaseMade", handleRefresh);
    window.addEventListener("bookingsChanged", handleRefresh);
    return () => {
      window.removeEventListener("purchaseMade", handleRefresh);
      window.removeEventListener("bookingsChanged", handleRefresh);
    };
  }, []);

  // ─────────────────────────────────────────────
  // Save budget
  // ─────────────────────────────────────────────
  // ─────────────────────────────────────────────
// Save budget
// ─────────────────────────────────────────────
const handleSave = async () => {
  const numericValue = parseInt(customBudget);
  if (!numericValue) return;

  setSavedBudget(numericValue);
  localStorage.setItem("magicBudget", numericValue.toString());
  setMode("overview");

  try {
    const user = getAuth().currentUser;
    if (user) {
      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, { budget: numericValue });
    } else {
      setShowSignupModal(true);
    }
  } finally {
    // ✅ Tell the rest of the app that the budget changed
    window.dispatchEvent(new Event("budgetUpdated"));
  }
};

  const updateOutsidePurchases = async () => {
    const stored = localStorage.getItem("outsidePurchases");
    const parsed = stored ? (JSON.parse(stored) as OutsidePurchase[]) : [];
    setOutsidePurchases(parsed);

    const user = getAuth().currentUser;
    if (user) {
      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, { "budgetData.outsidePurchases": parsed });
    }
  };

  // ─────────────────────────────────────────────
  // Derived lists for rendering
  // ─────────────────────────────────────────────
  const wedDonePurchases = purchases.filter((p) => p.type !== "manual");
  const outsideItems = outsidePurchases; // unchanged

  const prettyDate = (iso?: string) => {
    if (!iso) return "";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        backgroundColor: "rgba(0, 0, 0, 0.25)",
        zIndex: 999,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        padding: "1rem",
        overflow: "hidden",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff",
          borderRadius: "18px",
          padding: "1.5rem",
          paddingTop: "3.5rem",
          maxWidth: "500px",
          width: "100%",
          maxHeight: "90vh",
          overflowY: "auto",
          boxShadow: "0 4px 20px rgba(0,0,0,0.2)",
          textAlign: "center",
          position: "relative",
          zIndex: 1000,
        }}
      >
        {/* ✖ Close */}
        <button
          onClick={onClose}
          style={{
            position: "absolute",
            top: "1rem",
            right: "1rem",
            background: "none",
            border: "none",
            fontSize: "1.5rem",
            cursor: "pointer",
          }}
        >
          ✖
        </button>

        {/* 🌥️ Video */}
        <video
          src={`${import.meta.env.BASE_URL}assets/videos/new_madge_budget_cloud.mp4`}
          autoPlay
          muted
          loop
          playsInline
          style={{
            width: "350px",
            maxWidth: "90vw",
            margin: "0 auto 1.5rem",
            borderRadius: "12px",
            display: "block",
          }}
        />

        {mode === "entry" ? (
          <>
            <p style={{ fontSize: "1rem", color: "#333", marginBottom: "1rem" }}>
              Enter your wedding budget below:
            </p>
            <input
              type="text"
              placeholder="$35000"
              inputMode="numeric"
              value={customBudget}
              onChange={(e) => {
                const numeric = e.target.value.replace(/[^\d]/g, "");
                setCustomBudget(numeric);
              }}
              style={{
                padding: "0.75rem 1rem",
                borderRadius: "12px",
                border: "1px solid #ccc",
                fontSize: "1.1rem",
                width: "75%",
                marginBottom: "1.25rem",
              }}
            />
            <button
  className="boutique-primary-btn"
  onClick={handleSave}
  style={{ minWidth: 220 }}
>
  Save My Budget
</button>
          </>
        ) : (
          <>
            {/* 💸 Summary */}
            <div style={{ marginBottom: "1.25rem", textAlign: "center" }}>
              <p style={{ fontSize: "1.6rem", fontWeight: 700, color: "#2c62ba", margin: 0 }}>
                {(savedBudget || customBudget)
                  ? `$${(savedBudget || customBudget).toLocaleString()}`
                  : "$0"}
              </p>
              <p style={{ fontSize: "1.35rem", margin: "0.35rem 0" }}>
                Total Spent: {formatDollars(totalSpent)}
              </p>
              <p style={{ fontSize: "1.2rem", color: "#27ae60", fontWeight: 600, margin: 0 }}>
                💰 Remaining: {formatDollars(remaining)}
              </p>
            </div>

            {/* 🧾 Wed&Done Purchases (itemized) */}
            <div
              style={{
                textAlign: "left",
                background: "#f8f9ff",
                border: "1px solid #e1e6ff",
                borderRadius: 12,
                padding: "12px 14px",
                marginBottom: "1.25rem",
              }}
            >
              <h4 style={{ margin: "0 0 8px", color: "#2c62ba" }}>Wed&Done Purchases</h4>

              {wedDonePurchases.length === 0 ? (
                <p style={{ margin: 0, color: "#666" }}>Nothing booked in Wed&Done yet.</p>
              ) : (
                wedDonePurchases.map((p, idx) => {
                  const title =
                    p.label ||
                    p.boutique ||
                    (p.category ? `W&D — ${p.category}` : "W&D Purchase");
                  const full = getFullContractAmount(p);
                  const when = prettyDate(p.date);

                  return (
                    <div
                      key={`${title}-${idx}`}
                      style={{
                        borderTop: idx === 0 ? "none" : "1px dashed #e5e7f3",
                        paddingTop: idx === 0 ? 0 : 10,
                        marginTop: idx === 0 ? 0 : 10,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "baseline",
                          gap: 8,
                        }}
                      >
                        <strong style={{ color: "#333" }}>{title}</strong>
                        <span style={{ color: "#333" }}>{formatDollars(full)}</span>
                      </div>
                      {when && (
                        <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>
                          {when}
                        </div>
                      )}
                      {Array.isArray(p.items) && p.items.length > 0 && (
                        <ul style={{ margin: "6px 0 0 18px", padding: 0 }}>
                          {p.items.map((it, i) => (
                            <li key={i} style={{ fontSize: 13, color: "#444" }}>
                              {it}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* ➕ Add Outside Purchase */}
            <div style={{ textAlign: "center" }}>
              <button
                onClick={() => setShowOutsideModal(true)}
                style={{
                  backgroundColor: "#9788EB",
                  color: "white",
                  padding: "0.8rem 1.2rem",
                  borderRadius: "10px",
                  fontSize: "1rem",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                Track Outside Purchases
              </button>
            </div>

            {/* 🔁 Actions */}
            <div
              style={{
                textAlign: "center",
                marginTop: "2rem",
                paddingBottom: "2rem",
              }}
            >
              <button
                onClick={onClose}
                style={{
                  marginRight: "1rem",
                  padding: "0.6rem 1.2rem",
                  backgroundColor: "#2c62ba",
                  color: "#fff",
                  fontWeight: 600,
                  borderRadius: "10px",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                ⬅ Back to Path
              </button>
              <button
                onClick={() => setMode("entry")}
                style={{
                  padding: "0.6rem 1.2rem",
                  backgroundColor: "#f79ac4",
                  color: "#fff",
                  fontWeight: 600,
                  borderRadius: "10px",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                Reset Budget
              </button>
            </div>
          </>
        )}

        {/* 👤 Guest Prompt */}
        {mode === "overview" && !getAuth().currentUser && (
          <>
            <p style={{ fontSize: "1rem", marginTop: "1.25rem", marginBottom: "0.5rem" }}>
              Want to track your bookings and budget together?
            </p>
            <button
              onClick={() => setShowSignupModal(true)}
              style={{
                background: "#2c62ba",
                color: "#fff",
                padding: "0.6rem 1.2rem",
                borderRadius: "25px",
                width: "100%",
                maxWidth: "260px",
                fontSize: "1rem",
              }}
            >
              Create Account
            </button>
          </>
        )}
      </div>

      {/* 👤 Signup Modal */}
      {showSignupModal && (
        <MagicWandAccountModal
          onClose={() => setShowSignupModal(false)}
          onSuccess={() => {
            setShowSignupModal(false);
            setMode("overview");
          }}
        />
      )}

      {/* 🧾 Outside Purchase Modal */}
      {showOutsideModal && (
        <OutsidePurchasesModal
          onClose={() => setShowOutsideModal(false)}
          purchases={outsidePurchases}
          setPurchases={setOutsidePurchases}
          onSave={updateOutsidePurchases}
        />
      )}
    </div>
  );
};

export default MagicCloud;