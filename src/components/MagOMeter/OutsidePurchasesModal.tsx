import React, { useState, useEffect } from "react";
import { auth, db } from "../../firebase/firebaseConfig";
import { doc, getDoc, setDoc } from "firebase/firestore";

interface Purchase {
  label: string;
  amount: number;
}

interface OutsidePurchasesModalProps {
    onClose: () => void;
    purchases: { label: string; amount: number }[];
    onSave?: () => void; 
    setPurchases: React.Dispatch<React.SetStateAction<{ label: string; amount: number }[]>>;
  }

  const OutsidePurchasesModal: React.FC<OutsidePurchasesModalProps> = ({
    onClose,
    onSave,
  }) => {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");

  useEffect(() => {
    const restore = async () => {
      const local = localStorage.getItem("outsidePurchases");
      if (local) {
        setPurchases(JSON.parse(local));
      }

      const user = auth.currentUser;
      if (user) {
        const docRef = doc(db, "users", user.uid);
        const docSnap = await getDoc(docRef);
        const data = docSnap.data();
        if (data?.outsidePurchases) {
          setPurchases(data.outsidePurchases);
        }
      }
    };
    restore();
  }, []);

  // ✅ REPLACE your saveAndClose with this
const saveAndClose = async () => {
  // 1) Persist to localStorage so guests still see totals
  localStorage.setItem("outsidePurchases", JSON.stringify(purchases));

  // 2) Persist to Firestore at the SAME path MagicCloud uses
  const user = auth.currentUser;
  if (user) {
    const docRef = doc(db, "users", user.uid);
    await setDoc(
      docRef,
      { budgetData: { outsidePurchases: purchases } }, // ← nested path
      { merge: true }
    );

    // 3) Fire ONE canonical event the rest of the app listens for
    window.dispatchEvent(new Event("purchaseMade"));

    // 4) Sparkle sound (fix case-sensitive extension)
    const sparkle = new Audio(`${import.meta.env.BASE_URL}assets/sounds/sparkle.mp3`);
    sparkle.volume = 0.7;
    sparkle.play().catch((err) => console.warn("✨ Sparkle sound blocked:", err));
  }

  // 5) Let parent refresh (MagicCloud calls onSave -> updateOutsidePurchases)
  onSave?.();

  // 6) Close modal
  onClose();
};

  const addPurchase = () => {
    if (!label || !amount) return;
    setPurchases([...purchases, { label, amount: parseFloat(amount) }]);
    setLabel("");
    setAmount("");
  };

  const deletePurchase = (index: number) => {
    const updated = [...purchases];
    updated.splice(index, 1);
    setPurchases(updated);
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        backgroundColor: "rgba(0,0,0,0.5)",
        zIndex: 9999,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        overflow: "auto",
      }}
    >
      <div
        style={{
          background: "white",
          padding: "2rem",
          borderRadius: "16px",
          width: "90%",
          maxWidth: "600px",
          maxHeight: "85vh",
          overflowY: "auto",
          position: "relative",
        }}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          style={{
            position: "absolute",
            top: "1rem",
            right: "1rem",
            fontSize: "1.5rem",
            background: "none",
            border: "none",
            cursor: "pointer",
          }}
        >
          ✖
        </button>

        {/* 🧁 Image */}
<div style={{ textAlign: "center", marginBottom: "1rem" }}>
  <img
    src={`${import.meta.env.BASE_URL}assets/images/outside_purchase.png`}
    alt="Outside Purchases"
    style={{ width: "80%", maxWidth: "300px" }}
  />
</div>

<h3
  style={{
    marginTop: "1rem",
    fontFamily: "Jenna Sue",
    fontSize: "2rem",
    color: "#2c62ba",
    textAlign: "center",
  }}
>
  Track Your Outside Purchases
</h3>

<p style={{ fontSize: "0.9rem", color: "#555", marginTop: "0.5rem", maxWidth: "500px", margin: "0 auto 1.5rem", lineHeight: "1.4", textAlign: "center" }}>
  You can buy pretty much <strong>everything</strong> for your wedding here in the Magical Button Boutique,
  but some things you'll grab out in the wild — like your gown, glam squad, honeymoon travel, or even your bar booze.
  Use this handy-dandy tracker to keep your sparkly budget on track. ✨
</p>

{/* 🛍️ Purchase Form */}
<div style={{ textAlign: "center", marginBottom: "1rem" }}>
  <input
    type="text"
    placeholder="e.g. Wedding Dress"
    value={label}
    onChange={(e) => setLabel(e.target.value)}
    style={{
      width: "240px",
      maxWidth: "90%",
      marginBottom: "0.5rem",
      padding: "0.6rem",
      borderRadius: "10px",
      border: "1px solid #ccc",
      marginRight: "0.5rem",
    }}
  />
  <input
    type="number"
    placeholder="Amount"
    value={amount}
    onChange={(e) => setAmount(e.target.value)}
    style={{
      width: "120px",
      maxWidth: "80%",
      padding: "0.6rem",
      borderRadius: "10px",
      border: "1px solid #ccc",
    }}
  />
  <div style={{ marginTop: "1rem" }}>
    <button
      onClick={addPurchase}
      style={{
        background: "#2c62ba",
        color: "white",
        padding: "0.6rem 1.5rem",
        border: "none",
        borderRadius: "10px",
        cursor: "pointer",
        fontWeight: 600,
      }}
    >
      Add Purchase
    </button>
  </div>
</div>

{/* 📋 Purchase List */}
<ul style={{ maxWidth: "400px", margin: "0 auto" }}>
  {purchases.map((purchase, index) => (
    <li
      key={index}
      style={{
        marginBottom: "0.75rem",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
      }}
    >
      <span>
        {purchase.label} — ${purchase.amount.toLocaleString()}
      </span>
      <button
        onClick={() => deletePurchase(index)}
        style={{
          background: "none",
          border: "none",
          color: "red",
          cursor: "pointer",
          fontSize: "1.2rem",
        }}
      >
        ✖
      </button>
    </li>
  ))}
</ul>

{/* 💰 Add to Spend */}
<div style={{ textAlign: "center", marginTop: "1.5rem" }}>
  <button
    onClick={saveAndClose}
    style={{
      background: "#2c62ba",
      color: "white",
      padding: "0.6rem 1.5rem",
      border: "none",
      borderRadius: "10px",
      cursor: "pointer",
      fontWeight: 600,
    }}
  >
    Add to Spend
  </button>
</div>
    </div>
        </div>
  );
};

export default OutsidePurchasesModal;