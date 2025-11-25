// src/components/MenuScreens/PixiePurchaseCenter.tsx
import React, { useEffect, useState } from "react";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { db } from "../../firebase/firebaseConfig";
import { doc, getDoc } from "firebase/firestore";

import type { PixiePurchase } from "../../utils/pixiePurchaseTypes";

interface Props {
  onClose: () => void;
  onOpenCheckout: (purchase: PixiePurchase) => void;
}

const PixiePurchaseCenter: React.FC<Props> = ({ onClose, onOpenCheckout }) => {
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [items, setItems] = useState<PixiePurchase[]>([]);

  // Track auth
  useEffect(() => {
    const unsub = onAuthStateChanged(getAuth(), (u) => {
      setUserId(u?.uid || null);
    });
    return () => unsub();
  }, []);

  // Load Pixie Purchases from main user doc
  useEffect(() => {
    if (!userId) return;

    const load = async () => {
      setLoading(true);
      try {
        const snap = await getDoc(doc(db, "users", userId));
        if (snap.exists()) {
          const data = snap.data() as any;
          const list = (data.pixiePurchases || []) as PixiePurchase[];
          setItems(list.filter((p) => p.status === "pending"));
        } else {
          setItems([]);
        }
      } catch (e) {
        console.error("❌ Could not load Pixie Purchases:", e);
        setItems([]);
      }
      setLoading(false);
    };

    load();
  }, [userId]);

  return (
    <div style={styles.backdrop}>
      <div style={styles.card}>
        <button onClick={onClose} style={styles.closeBtn}>
          ✖
        </button>

        <h2 style={styles.title}>Pixie Purchases</h2>

        {/* 🌟 NEW: Pixie purchase wand image */}
        <img
          src={`${import.meta.env.BASE_URL}assets/images/pixie_purchase_wand.png`}
          alt="Pixie Purchase Wand"
          style={styles.wand}
        />

        <p style={styles.sub}>
          Any one-off charges or requests will appear here for you to review and
          pay.
        </p>

        {loading && <div>Loading…</div>}

        {!loading && items.length === 0 && (
          <div style={styles.empty}>
            <img
              src={`${import.meta.env.BASE_URL}assets/images/madge_scroll.png`}
              alt=""
              style={{ width: 140, marginBottom: 12 }}
            />
            <div style={styles.emptyText}>No Pixie Purchases right now!</div>
          </div>
        )}

        {!loading && items.length > 0 && (
          <div style={styles.list}>
            {items.map((p) => (
              <div
                key={p.id}
                style={styles.listItem}
                onClick={() => onOpenCheckout(p)}
              >
                <div style={styles.itemTitle}>{p.label}</div>
                <div style={styles.itemAmt}>${p.amount.toFixed(2)}</div>
                <div style={styles.itemHint}>Tap to review &amp; pay</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const styles = {
  backdrop: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,.45)",
    display: "grid",
    placeItems: "center",
    zIndex: 2000,
    padding: 20,
  } as React.CSSProperties,

  card: {
    width: "min(600px, 92vw)",
    background: "#fff",
    borderRadius: 22,
    padding: "26px 24px",
    position: "relative",
    maxHeight: "88vh",
    overflowY: "auto",
    boxShadow: "0 14px 40px rgba(0,0,0,.25)",
    textAlign: "center",
  } as React.CSSProperties,

  closeBtn: {
    position: "absolute",
    right: 14,
    top: 10,
    background: "transparent",
    border: "none",
    fontSize: 22,
    cursor: "pointer",
  } as React.CSSProperties,

  title: {
    margin: 0,
    fontFamily: "'Jenna Sue', cursive",
    fontSize: "2.2rem",
    color: "#2c62ba",
    marginBottom: 6,
  } as React.CSSProperties,

  // ✨ NEW: wand style
  wand: {
    width: 90,
    margin: "0 auto 14px",
    display: "block",
  } as React.CSSProperties,

  sub: {
    marginBottom: 20,
    color: "#444",
  } as React.CSSProperties,

  empty: {
    marginTop: 20,
    textAlign: "center",
  } as React.CSSProperties,

  emptyText: {
    fontSize: "1.1rem",
    fontWeight: 600,
    color: "#2c62ba",
  } as React.CSSProperties,

  list: {
    marginTop: 10,
    display: "flex",
    flexDirection: "column",
    gap: 12,
  } as React.CSSProperties,

  listItem: {
    padding: "14px 16px",
    borderRadius: 12,
    background: "#f7f9ff",
    border: "1px solid #e2e8ff",
    cursor: "pointer",
    textAlign: "left" as const,
  },

  itemTitle: {
    fontWeight: 700,
    color: "#2c62ba",
    fontSize: "1.1rem",
  },

  itemAmt: {
    marginTop: 4,
    fontWeight: 600,
    color: "#444",
  },

  itemHint: {
    marginTop: 6,
    fontSize: ".85rem",
    color: "#666",
  },
};

export default PixiePurchaseCenter;