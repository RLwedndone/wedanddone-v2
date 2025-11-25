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
  increment,
} from "firebase/firestore";
import { db } from "../../firebase/firebaseConfig";

import CheckoutForm from "../../CheckoutForm";
import type { PixiePurchase } from "../../utils/pixiePurchaseTypes";

import { uploadPdfBlob } from "../../helpers/firebaseUtils";
import { generatePixiePurchaseReceiptPDF } from "../../utils/generatePixiePurchaseReceiptPDF";
import { sendAdminPixiePurchasePaidEmail } from "../../utils/sendPixiePurchaseEmails";

interface Props {
  purchase: PixiePurchase;
  onClose: () => void;
  onMarkPaid: () => void;
}

const PixiePurchaseCheckout: React.FC<Props> = ({
  purchase,
  onClose,
  onMarkPaid,
}) => {
  const [isProcessing, setIsProcessing] = useState(false); // magic-in-progress state
  const [isComplete, setIsComplete] = useState(false); // final thank-you

  const handleSuccess = async ({ customerId }: { customerId?: string } = {}) => {
    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) {
      onClose();
      return;
    }

    try {
      setIsProcessing(true);

      const userRef = doc(db, "users", user.uid);
      const snap = await getDoc(userRef);
      const data = (snap.exists() ? snap.data() : {}) as any;

      const currentList: PixiePurchase[] = (data.pixiePurchases || []) as PixiePurchase[];

      const now = new Date();
      const nowISO = now.toISOString();

      // Pretty timestamp for email
      const paidAtPretty = now.toLocaleString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });

      // 🔄 Mark this Pixie Purchase as paid
      let updatedList = currentList.map((p) =>
        p.id === purchase.id
          ? {
              ...p,
              status: "paid" as const,
              paidAt: nowISO,
            }
          : p
      );

      // If somehow it wasn't in the list, append a paid version
      if (!updatedList.find((p) => p.id === purchase.id)) {
        updatedList = [
          ...updatedList,
          {
            ...purchase,
            status: "paid",
            paidAt: nowISO,
          },
        ];
      }

      const safeFirst = data.firstName || "Magic";
      const safeLast = data.lastName || "User";
      const fullName = `${safeFirst} ${safeLast}`.trim();
      const userEmail = data.email || user.email || "unknown@wedndone.com";

      const purchaseDatePretty = now.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });

      // 🧾 Generate Pixie Purchase receipt PDF
      const pdfBlob = await generatePixiePurchaseReceiptPDF({
        fullName,
        label: purchase.label,
        description: purchase.description,
        amount: purchase.amount,
        currency: "USD",
        purchaseDate: purchaseDatePretty,
      });

      const fileName = `PixiePurchase_${purchase.id}_${Date.now()}.pdf`;
      const filePath = `public_docs/${user.uid}/${fileName}`;
      const pdfUrl = await uploadPdfBlob(pdfBlob, filePath);

      // 💰 Entry for purchases array (Mag-O-Meter + history)
      const purchaseEntry = {
        label: purchase.label,
        category: purchase.category || "pixie_purchase",
        source: "Pixie Purchase",
        amount: Number(purchase.amount.toFixed(2)),
        date: nowISO,
        method: "pixie_purchase",
        pixieId: purchase.id,
      };

      // 📄 Document entry for the user's Documents tab
      const docItem = {
        title: purchase.label || "Pixie Purchase Receipt",
        url: pdfUrl,
        uploadedAt: nowISO,
        kind: "receipt",
        module: "pixie",
      };

      // 1) Save updated pixiePurchases list
      await setDoc(
        userRef,
        {
          pixiePurchases: updatedList,
          lastPurchaseAt: serverTimestamp(),
        },
        { merge: true }
      );

      // 2) Push purchase + document + spendTotal
      await updateDoc(userRef, {
        purchases: arrayUnion(purchaseEntry),
        documents: arrayUnion(docItem),
        spendTotal: increment(Number(purchase.amount.toFixed(2))),
      });

      // 3) Notify admin that Pixie Purchase was PAID
      try {
        await sendAdminPixiePurchasePaidEmail({
          userFullName: fullName,
          userEmail,
          pixieLabel: purchase.label,
          pixieType: purchase.type || "custom",
          pixieAmount: purchase.amount,
          paidAtPretty,
          pdfUrl,
        });
      } catch (emailErr) {
        console.warn("⚠️ Failed to send Pixie Purchase PAID admin email:", emailErr);
      }

      // 4) Let dashboard / Mag-O-Meter know
      try {
        window.dispatchEvent(new Event("purchaseMade"));
        window.dispatchEvent(new Event("documentsUpdated"));
        window.dispatchEvent(new Event("budgetUpdated"));
      } catch {
        // non-fatal
      }

      // ✅ Do NOT call onMarkPaid here anymore.
      // We wait until the user closes the thank-you screen.
      setIsComplete(true);
    } catch (err) {
      console.error("❌ Pixie purchase finalize failed:", err);
    } finally {
      setIsProcessing(false);
    }
  };

  const goBackToMenu = () => {
    // Now we tell the parent it's paid *when the user exits the thank-you screen*
    try {
      onMarkPaid();
    } catch {
      // non-fatal
    }
    onClose();
  };

  // ✅ After successful payment: show a thank-you card with Pixie video + Docs info
  if (isComplete) {
  
    return (
      <div style={styles.backdrop}>
        <div style={styles.card}>
          <button onClick={goBackToMenu} style={styles.closeBtn}>
            ✖
          </button>
  
          <video
            src={`${import.meta.env.BASE_URL}assets/videos/pix_thankyou.mp4`}
            autoPlay
            loop
            muted
            playsInline
            style={styles.heroVideo}
          />
  
          <h2 style={styles.title}>Pixie Purchase complete!</h2>
  
          <p style={styles.body}>
            Your Pixie Purchase has been paid in full! <br />
            <br />
            You’ll find your receipt inside your <strong>Docs</strong> folder  
            (click the little gold bar in the top-right of your dashboard ✨)
          </p>
  
          <button
            className="boutique-primary-btn"
            style={styles.cta}
            onClick={goBackToMenu}
          >
            Back to my dashboard
          </button>
        </div>
      </div>
    );
  }

  // ⏳ While we’re generating the PDF + updating Firestore, show magic-in-progress
  if (isProcessing) {
    return (
      <div style={styles.backdrop}>
        <div style={styles.card}>
          <button
            onClick={onClose}
            style={{ ...styles.closeBtn, opacity: 0.4, cursor: "default" }}
            disabled
          >
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

          <h2 style={styles.title}>Madge is working her magic…</h2>
          <p style={styles.body}>
            We’re generating your Pixie Purchase receipt and updating your
            Mag-O-Meter. This should only take a moment.
          </p>
        </div>
      </div>
    );
  }

  // 🔐 Main checkout UI – lock/credit-card video at the top
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