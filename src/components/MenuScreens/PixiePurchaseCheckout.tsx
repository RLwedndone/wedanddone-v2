// src/components/MenuScreens/PixiePurchaseCheckout.tsx
import React, { useState } from "react";
import { getAuth } from "firebase/auth";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  arrayUnion,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../../firebase/firebaseConfig";

import CheckoutForm from "../../CheckoutForm";
import type { PixiePurchase } from "../../utils/pixiePurchaseTypes";

interface Props {
    purchase: PixiePurchase;
    onClose: () => void;
    onMarkPaid: () => void;
  }

  const PixiePurchaseCheckout: React.FC<Props> = ({ purchase, onClose, onMarkPaid }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [isComplete, setIsComplete] = useState(false);

  const handleSuccess = async () => {
    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) {
      // no user? just bail back out
      onClose();
      return;
    }
  
    try {
      setIsProcessing(true);
  
      const userRef = doc(db, "users", user.uid);
      const snap = await getDoc(userRef);
      const data = (snap.exists() ? snap.data() : {}) as any;
  
      const currentList: PixiePurchase[] = (data.pixiePurchases || []) as PixiePurchase[];
  
      const nowISO = new Date().toISOString();
  
      const updatedList = currentList.map((p) =>
        p.id === purchase.id
          ? {
              ...p,
              status: "paid",
              paidAt: nowISO,
            }
          : p
      );
  
      // If somehow it wasn't in the list, append a paid version
      if (!updatedList.find((p) => p.id === purchase.id)) {
        updatedList.push({
          ...purchase,
          status: "paid",
          paidAt: nowISO,
        });
      }
  
      const purchaseEntry = {
        label: purchase.label,
        category: purchase.category || "pixie_purchase",
        source: "Pixie Purchase",
        amount: Number(purchase.amount.toFixed(2)),
        date: nowISO,
        method: "pixie_purchase",
        pixieId: purchase.id,
      };
  
      await setDoc(
        userRef,
        {
          pixiePurchases: updatedList,
          lastPurchaseAt: serverTimestamp(),
        },
        { merge: true }
      );
  
      await updateDoc(userRef, {
        purchases: arrayUnion(purchaseEntry),
      });
  
      // let the parent (Dashboard) refresh + close, etc.
      onMarkPaid();
  
      setIsComplete(true);
    } catch (err) {
      console.error("❌ Pixie purchase finalize failed:", err);
      // leave them on screen so they can retry or cancel
    } finally {
      setIsProcessing(false);
    }
  };

  const goBackToMenu = () => {
    onClose();
  };

  // ✅ After successful payment: show a simple thank-you card
  if (isComplete) {
    return (
      <div style={styles.backdrop}>
        <div style={styles.card}>
          <button onClick={goBackToMenu} style={styles.closeBtn}>
            ✖
          </button>

          <video
            src={`${import.meta.env.BASE_URL}assets/videos/magic_clock.mp4`}
            autoPlay
            loop
            muted
            playsInline
            style={styles.heroVideo}
          />

          <h2 style={styles.title}>Pixie Purchase complete!</h2>
          <p style={styles.body}>
            Your payment has been processed and this Pixie Purchase is now
            marked as paid. You’ll see it reflected in your Mag-O-Meter and
            documents shortly.
          </p>

          <button
            className="boutique-primary-btn"
            style={styles.cta}
            onClick={goBackToMenu}
          >
            Back to my menu
          </button>
        </div>
      </div>
    );
  }

  // 🔐 Main checkout UI
  return (
    <div style={styles.backdrop}>
      <div style={styles.card}>
        <button onClick={onClose} style={styles.closeBtn}>
          ✖
        </button>

        <video
          src={`${import.meta.env.BASE_URL}assets/videos/lock.mp4`}
          autoPlay
          loop
          muted
          playsInline
          style={styles.heroVideo}
        />

        <h2 style={styles.title}>{purchase.label}</h2>

        {purchase.description && (
          <p style={styles.body}>{purchase.description}</p>
        )}

        <p style={{ ...styles.body, fontWeight: 700, marginBottom: 8 }}>
          Amount due: ${purchase.amount.toFixed(2)}
        </p>

        <p style={{ ...styles.body, fontSize: "0.9rem", marginBottom: 18 }}>
          This is a one-time Pixie Purchase created just for your wedding.
        </p>

        <div aria-busy={isProcessing}>
          <CheckoutForm
            total={purchase.amount}
            onSuccess={handleSuccess}
            isAddon={false}
            customerEmail={getAuth().currentUser?.email || undefined}
            customerName={
              getAuth().currentUser?.displayName || "Wed&Done Client"
            }
            customerId={(() => {
              try {
                return localStorage.getItem("stripeCustomerId") || undefined;
              } catch {
                return undefined;
              }
            })()}
          />
        </div>

        <button
          className="boutique-back-btn"
          style={{ marginTop: 12 }}
          onClick={onClose}
          disabled={isProcessing}
        >
          Cancel
        </button>
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
    zIndex: 2100,
    padding: 20,
  } as React.CSSProperties,

  card: {
    width: "min(520px, 92vw)",
    background: "#fff",
    borderRadius: 22,
    padding: "26px 24px 22px",
    position: "relative",
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

  heroVideo: {
    width: 150,
    borderRadius: 16,
    display: "block",
    margin: "0 auto 14px",
  } as React.CSSProperties,

  title: {
    margin: 0,
    marginBottom: 8,
    fontFamily: "'Jenna Sue', cursive",
    fontSize: "2rem",
    color: "#2c62ba",
  } as React.CSSProperties,

  body: {
    margin: "4px 0",
    color: "#444",
  } as React.CSSProperties,

  cta: {
    marginTop: 14,
    width: 260,
    padding: "11px 16px",
    fontWeight: 800,
  } as React.CSSProperties,
};

export default PixiePurchaseCheckout;