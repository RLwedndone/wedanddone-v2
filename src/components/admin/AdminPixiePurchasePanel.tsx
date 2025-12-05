// src/components/admin/AdminPixiePurchasePanel.tsx
import React, { useState } from "react";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  where,
} from "firebase/firestore";
import { db } from "../../firebase/firebaseConfig";
import type { PixiePurchase } from "../../utils/pixiePurchaseTypes";

import {
  sendUserPixiePurchaseCreatedEmail,
  sendAdminPixiePurchaseCreatedEmail,
} from "../../utils/sendPixiePurchaseEmails";

interface AdminPixiePurchasePanelProps {
  onClose: () => void;
}

const AdminPixiePurchasePanel: React.FC<AdminPixiePurchasePanelProps> = ({
  onClose,
}) => {
  const [userIdInput, setUserIdInput] = useState("");
  const [emailInput, setEmailInput] = useState("");
  const [resolvedUserId, setResolvedUserId] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const [currentPurchases, setCurrentPurchases] = useState<PixiePurchase[]>([]);

  // new purchase form
  const [label, setLabel] = useState("Guest Count Increase");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState<string>("");
  const [type, setType] = useState<string>("guest_count_increase");

  // 🔍 Resolve user by UID or email and load their pixiePurchases
  const handleLoadUser = async () => {
    setStatusMsg(null);
    setLoading(true);

    try {
      let uid = userIdInput.trim();

      // If no UID, try to look up by email
      if (!uid && emailInput.trim()) {
        const q = query(
          collection(db, "users"),
          where("email", "==", emailInput.trim())
        );
        const snap = await getDocs(q);

        if (snap.empty) {
          setResolvedUserId(null);
          setCurrentPurchases([]);
          setStatusMsg("No user found with that email.");
          return;
        }

        uid = snap.docs[0].id;
      }

      if (!uid) {
        setStatusMsg("Enter a UID or an email, then click Load User.");
        return;
      }

      const userRef = doc(db, "users", uid);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        setResolvedUserId(null);
        setCurrentPurchases([]);
        setStatusMsg("No user document found for that UID.");
        return;
      }

      const data = userSnap.data() as any;
      const listRaw = (data.pixiePurchases || []) as PixiePurchase[];

      // 🔧 sanitize any legacy entries with description: undefined
      const list = listRaw.map((p) => {
        if ((p as any).description === undefined) {
          const { description, ...rest } = p as any;
          return rest as PixiePurchase;
        }
        return p;
      });

      setResolvedUserId(uid);
      setCurrentPurchases(list);
      setStatusMsg(`Loaded user ${uid}.`);
    } catch (err) {
      console.error("❌ Error loading user for Pixie Purchases:", err);
      setStatusMsg("Error loading user. See console for details.");
    } finally {
      setLoading(false);
    }
  };

  // ➕ Create a new pending Pixie Purchase and save back to user doc
  const handleCreatePixiePurchase = async () => {
    if (!resolvedUserId) {
      setStatusMsg("Load a user first.");
      return;
    }

    const amt = Number(amount);
    if (!amt || amt <= 0) {
      setStatusMsg("Enter a valid amount greater than 0.");
      return;
    }

    const now = Date.now();
    const id = `pp_${now}`;

    const desc = description.trim();

    const basePurchase = {
      id,
      type: type as any, // "guest_count_increase" | "rush_edit" | "custom"
      label: label.trim() || "Pixie Purchase",
      amount: amt,
      currency: "usd",
      status: "pending",
      createdAt: now,
      paidAt: null,
      category: "pixie_purchase" as const,
    };

    // ✅ Only add description if it's non-empty (no undefined in Firestore)
    const newPurchase: PixiePurchase = desc
      ? ({ ...basePurchase, description: desc } as PixiePurchase)
      : (basePurchase as PixiePurchase);

    try {
      setLoading(true);

      const userRef = doc(db, "users", resolvedUserId);
      const userSnap = await getDoc(userRef);
      const userData = (userSnap.data() || {}) as any;

      const fullName = `${userData.firstName || "Magic"} ${
        userData.lastName || "User"
      }`.trim();
      const userEmail = userData.email || "unknown@wedndone.com";

      // friendly first name for the user email
      const firstName =
        userData.firstName || fullName.split(" ")[0] || "Friend";

      // pretty timestamp for admin template
      const createdAtPretty = new Date(now).toLocaleString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });

      // 🔧 Clean any existing undefined descriptions just in case
      const sanitizedExisting = currentPurchases.map((p) => {
        if ((p as any).description === undefined) {
          const { description, ...rest } = p as any;
          return rest as PixiePurchase;
        }
        return p;
      });

      const updatedList = [...sanitizedExisting, newPurchase];

      // 1) Save pixiePurchases array (admin-facing list)
      await setDoc(
        userRef,
        {
          pixiePurchases: updatedList,
        },
        { merge: true }
      );
      setCurrentPurchases(updatedList);

      // 2) Emails only – NO PDFs, NO purchases/spend yet

      // 2a) 🚀 User email – "You have a Pixie Purchase waiting"
      try {
        const dashboardUrl =
          (window?.location?.origin || "https://wedndone.com") + "/dashboard";

        await sendUserPixiePurchaseCreatedEmail({
          firstName,
          userEmail,
          dashboardUrl,
          pixieLabel: newPurchase.label,
          pixieAmount: newPurchase.amount,
        });
      } catch (emailErr) {
        console.warn("⚠️ Failed to send user Pixie Purchase email:", emailErr);
      }

      // 2b) 🚀 Admin email – Pixie Purchase CREATED
      try {
        await sendAdminPixiePurchaseCreatedEmail({
          userFullName: fullName,
          userEmail,
          pixieLabel: newPurchase.label,
          pixieType: newPurchase.type || "custom",
          pixieAmount: newPurchase.amount,
          createdAtPretty,
        });
      } catch (adminEmailErr) {
        console.warn(
          "⚠️ Failed to send ADMIN Pixie Purchase CREATED email:",
          adminEmailErr
        );
      }

      // 3) Nudge UI listeners (so dashboard refreshes & shows alert)
      try {
        window.dispatchEvent(new Event("purchaseMade")); // generic "refresh" signal
        window.dispatchEvent(new Event("pixiePurchasesUpdated"));
      } catch {
        // non-fatal
      }

      setStatusMsg("Pixie Purchase created and saved for checkout.");
      setAmount("");
      setDescription("");
    } catch (err) {
      console.error("❌ Error creating Pixie Purchase:", err);
      setStatusMsg("Error saving Pixie Purchase. See console.");
    } finally {
      setLoading(false);
    }
  };

  // 🗑 Delete a pending Pixie Purchase
  const handleDeletePixiePurchase = async (id: string) => {
    if (!resolvedUserId) {
      setStatusMsg("Load a user first.");
      return;
    }

    const target = currentPurchases.find((p) => p.id === id);
    if (!target) return;

    // Protect paid items so we don't silently break budget totals
    if (target.status === "paid") {
      alert(
        "This Pixie Purchase is already marked as paid.\n\n" +
          "You can’t delete paid Pixie Purchases here because they’re tied to real payments and budget totals.\n\n" +
          "If this needs to be reversed, you’ll want to adjust it manually in Firestore + Stripe."
      );
      return;
    }

    const ok = window.confirm(
      `Delete Pixie Purchase "${target.label}" (${target.amount.toFixed(
        2
      )})?\n\nThis will remove it from their Pixie list and hide it from their dashboard.`
    );
    if (!ok) return;

    try {
      setLoading(true);

      const userRef = doc(db, "users", resolvedUserId);
      const newList = currentPurchases.filter((p) => p.id !== id);

      await setDoc(
        userRef,
        {
          pixiePurchases: newList,
        },
        { merge: true }
      );

      setCurrentPurchases(newList);
      setStatusMsg("Pixie Purchase deleted.");

      try {
        window.dispatchEvent(new Event("pixiePurchasesUpdated"));
        window.dispatchEvent(new Event("purchaseMade"));
      } catch {
        // non-fatal
      }
    } catch (err) {
      console.error("❌ Error deleting Pixie Purchase:", err);
      setStatusMsg("Error deleting Pixie Purchase. See console.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 3000,
        background: "rgba(0, 0, 0, 0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 560,
          background: "#ffffff",
          borderRadius: 18,
          padding: "22px 24px 18px",
          boxShadow:
            "0 22px 40px rgba(0,0,0,0.35), 0 0 0 1px rgba(0,0,0,0.08)",
          color: "#222",
          fontFamily:
            "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
        }}
      >
        {/* Header + close X */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 4,
          }}
        >
          <h3 style={{ margin: 0 }}>
            <span role="img" aria-label="Pixies">
              🧚
            </span>{" "}
            Pixie Purchases Admin
          </h3>

          <button
            onClick={onClose}
            aria-label="Close admin panel"
            style={{
              border: "none",
              background: "transparent",
              fontSize: 20,
              cursor: "pointer",
              lineHeight: 1,
              padding: 0,
            }}
          >
            ✖
          </button>
        </div>

        <p
          style={{
            marginTop: 10,
            marginBottom: 16,
            fontSize: "0.9rem",
            lineHeight: 1.5,
          }}
        >
          Use this tool to create one-off Pixie Purchase bills (guest count
          increases, rush edits, etc.) for a specific user.
        </p>

        {/* User lookup */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.1fr 1.1fr auto",
            gap: 8,
            alignItems: "center",
            marginBottom: 8,
          }}
        >
          <input
            style={inputStyle}
            placeholder="User UID (optional if using email)"
            value={userIdInput}
            onChange={(e) => setUserIdInput(e.target.value)}
          />
          <input
            style={inputStyle}
            placeholder="User email"
            value={emailInput}
            onChange={(e) => setEmailInput(e.target.value)}
          />
          <button
            style={primaryBtnStyle}
            onClick={handleLoadUser}
            disabled={loading}
          >
            {loading ? "Loading…" : "Load User"}
          </button>
        </div>

        {resolvedUserId && (
          <div
            style={{
              fontSize: "0.8rem",
              marginBottom: 6,
              opacity: 0.85,
            }}
          >
            Loaded UID: <code>{resolvedUserId}</code>
          </div>
        )}

        {/* Status message */}
        {statusMsg && (
          <div
            style={{
              fontSize: "0.82rem",
              marginBottom: 12,
              color: "#b34747",
            }}
          >
            {statusMsg}
          </div>
        )}

        {/* New Pixie Purchase form */}
        <div
          style={{
            marginTop: 10,
            paddingTop: 10,
            borderTop: "1px solid rgba(0,0,0,0.08)",
          }}
        >
          <h4 style={{ margin: "0 0 8px" }}>Create a new Pixie Purchase</h4>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1.3fr 0.8fr",
              gap: 8,
              marginBottom: 8,
              alignItems: "center",
            }}
          >
            <input
              style={inputStyle}
              placeholder="Label (e.g., Guest Count Increase)"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
            <input
              style={inputStyle}
              placeholder="Amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              type="number"
              min="0"
              step="0.01"
            />
          </div>

          <textarea
            style={{
              ...inputStyle,
              resize: "vertical",
              minHeight: 80,
              marginBottom: 8,
            }}
            placeholder="Internal / client-facing description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />

          <div style={{ marginBottom: 10, fontSize: "0.85rem" }}>
            <label>
              Type:{" "}
              <select
                style={{
                  ...inputStyle,
                  padding: "6px 10px",
                  height: "auto",
                }}
                value={type}
                onChange={(e) => setType(e.target.value)}
              >
                <option value="guest_count_increase">
                  Guest count increase
                </option>
                <option value="rush_edit">Rush edit</option>
                <option value="custom">Custom</option>
              </select>
            </label>
          </div>

          <button
            style={primaryBtnStyle}
            onClick={handleCreatePixiePurchase}
            disabled={loading || !resolvedUserId}
          >
            {loading ? "Saving…" : "Create Pixie Purchase"}
          </button>
        </div>

        {/* Existing Pixie Purchases */}
        {currentPurchases.length > 0 && (
          <div
            style={{
              marginTop: 16,
              paddingTop: 10,
              borderTop: "1px dashed rgba(0,0,0,0.1)",
            }}
          >
            <h4 style={{ margin: "0 0 8px" }}>Existing Pixie Purchases</h4>
            <div
              style={{
                maxHeight: 200,
                overflowY: "auto",
                fontSize: "0.82rem",
              }}
            >
              {currentPurchases.map((p) => (
                <div
                  key={p.id}
                  style={{
                    padding: "6px 8px",
                    borderRadius: 8,
                    background: "rgba(0,0,0,0.03)",
                    border: "1px solid rgba(0,0,0,0.08)",
                    marginBottom: 6,
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 8,
                    alignItems: "center",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600 }}>{p.label}</div>
                    <div>
                      ${Number(p.amount).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})} ·{" "}
                      <span
                        style={{
                          textTransform: "capitalize",
                          color:
                            p.status === "paid" ? "#2f855a" : "#b7791f",
                        }}
                      >
                        {p.status}
                      </span>
                    </div>
                    <div style={{ opacity: 0.6, fontSize: "0.7rem" }}>
                      <code>{p.id}</code>
                    </div>
                  </div>

                  <button
                    aria-label="Delete Pixie Purchase"
                    onClick={() => handleDeletePixiePurchase(p.id)}
                    disabled={loading || p.status === "paid"}
                    title={
                      p.status === "paid"
                        ? "Paid Pixie Purchases can’t be deleted here."
                        : "Delete this Pixie Purchase"
                    }
                    style={{
                      border: "none",
                      background: "transparent",
                      fontSize: 18,
                      cursor:
                        loading || p.status === "paid"
                          ? "not-allowed"
                          : "pointer",
                      opacity: p.status === "paid" ? 0.4 : 0.9,
                    }}
                  >
                    🗑
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  borderRadius: 8,
  border: "1px solid rgba(0,0,0,0.18)",
  fontSize: "0.9rem",
  background: "#f7f7fb",
  color: "#222",
  boxSizing: "border-box",
};

const primaryBtnStyle: React.CSSProperties = {
  padding: "8px 14px",
  borderRadius: 999,
  border: "none",
  fontSize: "0.9rem",
  fontWeight: 700,
  cursor: "pointer",
  background: "#2c62ba",
  color: "#fff",
  whiteSpace: "nowrap",
};

export default AdminPixiePurchasePanel;