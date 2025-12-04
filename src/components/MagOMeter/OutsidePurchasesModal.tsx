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
  setPurchases: React.Dispatch<
    React.SetStateAction<{ label: string; amount: number }[]>
  >;
}

const OutsidePurchasesModal: React.FC<OutsidePurchasesModalProps> = ({
  onClose,
  onSave,
}) => {
  // ✅ Purchases already saved in Budget Wand
  const [existingPurchases, setExistingPurchases] = useState<Purchase[]>([]);

  // ✅ New line items for this “session” (draft, persisted in localStorage)
  const [rows, setRows] = useState<{ label: string; amount: string }[]>([
    { label: "", amount: "" },
    { label: "", amount: "" },
    { label: "", amount: "" },
  ]);

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const restore = async () => {
      // 1) LocalStorage purchases (guests)
      const local = localStorage.getItem("outsidePurchases");
      if (local) {
        try {
          const parsed = JSON.parse(local) as Purchase[];
          setExistingPurchases(parsed);
        } catch {
          // ignore parse errors
        }
      }

      // 2) Firestore purchases (logged-in)
      const user = auth.currentUser;
      if (user) {
        const docRef = doc(db, "users", user.uid);
        const docSnap = await getDoc(docRef);
        const data = docSnap.data();
        if (data?.budgetData?.outsidePurchases) {
          setExistingPurchases(data.budgetData.outsidePurchases as Purchase[]);
        } else if (data?.outsidePurchases) {
          // older path fallback
          setExistingPurchases(data.outsidePurchases as Purchase[]);
        }
      }

      // 3) Draft rows
      const draft = localStorage.getItem("outsidePurchasesRowsDraft");
      if (draft) {
        try {
          const parsedDraft = JSON.parse(draft) as { label: string; amount: string }[];
          if (Array.isArray(parsedDraft) && parsedDraft.length > 0) {
            setRows(parsedDraft);
          }
        } catch {
          // ignore draft parse errors
        }
      }
    };

    restore();
  }, []);

  // 💾 Persist draft rows so the page feels “saved”
  useEffect(() => {
    try {
      localStorage.setItem("outsidePurchasesRowsDraft", JSON.stringify(rows));
    } catch {
      // non-blocking
    }
  }, [rows]);

  const addRow = () => {
    setRows((prev) => [...prev, { label: "", amount: "" }]);
  };

  const updateRow = (index: number, field: "label" | "amount", value: string) => {
    setRows((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const removeRow = (index: number) => {
    setRows((prev) => prev.filter((_, i) => i !== index));
  };

  // 🔐 Single commit: add all valid line items to Budget Wand + Firestore
  const saveAndClose = async () => {
    setError(null);

    // 1) Gather valid new purchases from rows
    const newPurchases: Purchase[] = rows
      .map((r) => ({
        label: r.label.trim(),
        amount: parseFloat(r.amount),
      }))
      .filter(
        (p) =>
          p.label &&
          !Number.isNaN(p.amount) &&
          Number.isFinite(p.amount) &&
          p.amount > 0
      );

    if (newPurchases.length === 0) {
      setError("Add at least one purchase with a label and amount.");
      return;
    }

    // 2) Merge with existing purchases
    const updatedPurchases = [...existingPurchases, ...newPurchases];
    setExistingPurchases(updatedPurchases);

    // 3) Persist to localStorage so guests still see totals
    try {
      localStorage.setItem("outsidePurchases", JSON.stringify(updatedPurchases));
    } catch {
      // non-blocking
    }

    // 4) Persist to Firestore at the SAME path MagicCloud uses
    const user = auth.currentUser;
    if (user) {
      const docRef = doc(db, "users", user.uid);
      await setDoc(
        docRef,
        { budgetData: { outsidePurchases: updatedPurchases } },
        { merge: true }
      );

      // 5) Fire ONE canonical event the rest of the app listens for
      window.dispatchEvent(new Event("purchaseMade"));

      // 6) Sparkle sound ✨
      try {
        const sparkle = new Audio(
          `${import.meta.env.BASE_URL}assets/sounds/sparkle.mp3`
        );
        sparkle.volume = 0.7;
        sparkle
          .play()
          .catch((err) => console.warn("✨ Sparkle sound blocked:", err));
      } catch (err) {
        console.warn("✨ Sparkle sound error:", err);
      }
    }

    // 7) Clear draft rows now that they’ve been committed
    try {
      localStorage.removeItem("outsidePurchasesRowsDraft");
    } catch {
      // ignore
    }

    // 8) Let parent refresh (MagicCloud calls onSave -> updateOutsidePurchases)
    onSave?.();

    // 9) Close modal
    onClose();
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

        <p
          style={{
            fontSize: "0.9rem",
            color: "#555",
            marginTop: "0.5rem",
            maxWidth: "500px",
            margin: "0 auto 1.5rem",
            lineHeight: "1.4",
            textAlign: "center",
          }}
        >
          You can buy pretty much <strong>everything</strong> for your wedding
          here in the Magical Button Boutique, but some things you'll grab out
          in the wild — like your gown, wedding bands, hair &amp; makeup crew,
          honeymoon travel, or even your bar booze. Use this handy-dandy tracker
          to keep your sparkly budget on track. ✨
        </p>

        {/* 📋 Existing purchases (clean 2-column aligned layout) */}
{existingPurchases.length > 0 && (
  <div
    style={{
      marginBottom: "1.5rem",
      maxWidth: "500px",
      marginInline: "auto",
    }}
  >
    <h4
      style={{
        fontSize: "0.95rem",
        fontWeight: 600,
        marginBottom: "0.75rem",
      }}
    >
      Already in your tracker:
    </h4>

    <ul style={{ listStyle: "none", paddingLeft: 0, margin: 0 }}>
      {existingPurchases.map((p, idx) => (
        <li
          key={idx}
          style={{
            display: "grid",
            gridTemplateColumns: "1fr auto auto",
            alignItems: "center",
            columnGap: "1rem",
            padding: "0.25rem 0",
          }}
        >
          {/* Item label */}
          <span style={{ whiteSpace: "nowrap" }}>{p.label}</span>

          {/* Right-aligned amount */}
          <span
            style={{
              whiteSpace: "nowrap",
              textAlign: "right",
              minWidth: "80px",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            ${p.amount.toLocaleString()}
          </span>

          {/* Delete button */}
          <button
            type="button"
            onClick={() => {
              const updated = existingPurchases.filter((_, i) => i !== idx);
              setExistingPurchases(updated);
              localStorage.setItem("outsidePurchases", JSON.stringify(updated));

              const user = auth.currentUser;
              if (user) {
                const docRef = doc(db, "users", user.uid);
                setDoc(
                  docRef,
                  { budgetData: { outsidePurchases: updated } },
                  { merge: true }
                );
              }
            }}
            style={{
              background: "none",
              border: "none",
              color: "#c0392b",
              cursor: "pointer",
              fontSize: "1.2rem",
              paddingLeft: "0.25rem",
            }}
            aria-label="Remove saved purchase"
          >
            ✖
          </button>
        </li>
      ))}
    </ul>
  </div>
)}

        {/* 🛍️ New purchases rows */}
<div
  style={{
    maxWidth: "500px",
    margin: "0 auto 1rem",
  }}
>
  <div
    style={{
      display: "grid",
      gridTemplateColumns: "1.6fr 0.8fr",
      columnGap: "0.5rem",
      rowGap: "0.5rem",
      alignItems: "center",
    }}
  >
    {rows.map((row, index) => (
      <React.Fragment key={index}>
        <input
          type="text"
          placeholder="Item"
          value={row.label}
          onChange={(e) => updateRow(index, "label", e.target.value)}
          style={{
            padding: "0.6rem",
            borderRadius: "10px",
            border: "1px solid #ccc",
          }}
        />

        <input
          type="number"
          placeholder="Amount"
          value={row.amount}
          onChange={(e) => updateRow(index, "amount", e.target.value)}
          style={{
            padding: "0.6rem",
            borderRadius: "10px",
            border: "1px solid #ccc",
          }}
        />
        {/* ❌ No delete button for draft rows */}
      </React.Fragment>
    ))}
  </div>

  <div style={{ textAlign: "left", marginTop: "0.75rem" }}>
    <button
      type="button"
      onClick={addRow}
      style={{
        background: "none",
        border: "none",
        color: "#2c62ba",
        fontSize: "0.9rem",
        cursor: "pointer",
        textDecoration: "underline",
        padding: 0,
      }}
    >
      + Add another line
    </button>
  </div>
</div>

        {/* Error message */}
        {error && (
          <p
            style={{
              color: "#d33",
              fontSize: "0.85rem",
              textAlign: "center",
              marginBottom: "0.75rem",
            }}
          >
            {error}
          </p>
        )}

        {/* 💰 Commit button */}
        <div style={{ textAlign: "center", marginTop: "1rem" }}>
          <button
            onClick={saveAndClose}
            style={{
              background: "#2c62ba",
              color: "white",
              padding: "0.7rem 1.8rem",
              border: "none",
              borderRadius: "10px",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            Add These to My Budget Wand
          </button>
        </div>
      </div>
    </div>
  );
};

export default OutsidePurchasesModal;