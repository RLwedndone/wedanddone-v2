// src/components/account/PaymentSettingsOverlay.tsx
import React, { useEffect, useState } from "react";
import { getAuth } from "firebase/auth";

type CardInfo = {
  brand: string;
  last4: string;
  exp_month: number;
  exp_year: number;
} | null;

interface Props {
  onClose: () => void;
}

const PaymentSettingsOverlay: React.FC<Props> = ({ onClose }) => {
  const [loading, setLoading] = useState(true);
  const [card, setCard] = useState<CardInfo>(null);
  const [error, setError] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);

  // NEW: support modal
  const [showSupport, setShowSupport] = useState(false);

  // ✅ Use the **Functions** URL, not the raw Cloud Run host.
  // Hard-coded here so it can't accidentally point anywhere else.
  const BASE =
    "https://us-central1-wedndonev2.cloudfunctions.net/stripeapiV2";

  useEffect(() => {
    console.log("[PaymentSettingsOverlay] BASE =", BASE); // 👈 sanity check

    (async () => {
      try {
        const user = getAuth().currentUser;
        if (!user) throw new Error("Not signed in.");
        setError(null);

        const resp = await fetch(`${BASE}/payments/get-default`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ uid: user.uid }),
        });

        if (!resp.ok) {
          const t = await resp.text();
          throw new Error(`get-default failed: ${resp.status} ${t}`);
        }
        const data = await resp.json();
        setCard(data?.card ?? null);
      } catch (e: any) {
        console.error("[UI] get-default error:", e);
        setError(e?.message || "Could not load card.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const openBillingPortal = async () => {
    setPortalLoading(true);
    setError(null);
    try {
      const user = getAuth().currentUser;
      if (!user) throw new Error("Not signed in.");

      const resp = await fetch(`${BASE}/payments/billing-portal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uid: user.uid,
          returnUrl: window.location.href,
        }),
      });

      if (!resp.ok) {
        const t = await resp.text();
        throw new Error(`billing-portal failed: ${resp.status} ${t}`);
      }

      const data = await resp.json();
      const url = data?.url;
      if (!url) throw new Error("No portal URL returned.");

      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e: any) {
      console.error("[UI] billing-portal error:", e);
      setError(e?.message || "Could not open billing portal.");
      setPortalLoading(false);
    }
  };

  return (
    <div
      className="pixie-overlay"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        zIndex: 1000,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        overflow: "auto",
      }}
    >
      <div
        className="pixie-card wd-page-turn"
        style={{
          background: "#fff",
          borderRadius: 18,
          padding: "2rem",
          width: "90%",
          maxWidth: 520,
          maxHeight: "90vh",
          overflowY: "auto",
          position: "relative",
          boxShadow: "0 4px 20px rgba(0,0,0,0.2)",
        }}
      >
        {/* small X close */}
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
          aria-label="Close"
        >
          ✖
        </button>

        {/* looping lock/credit-card video */}
<div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
  <video
    src={`${import.meta.env.BASE_URL}assets/videos/lock.mp4`}
    autoPlay
    loop
    muted
    playsInline
    style={{
      width: 140,
      height: 140,
      borderRadius: 16,
      objectFit: "cover",
      boxShadow: "0 6px 16px rgba(0,0,0,0.12)",
    }}
  />
</div>

        {/* centered title */}
        <h1
          style={{
            color: "#2c62ba",
            marginBottom: "1rem",
            textAlign: "center",
            fontWeight: 700,
          }}
        >
          Payment Method
        </h1>

        {/* body */}
        <div style={{ textAlign: "center" }}>
          {loading ? (
            <p>Loading your card…</p>
          ) : error ? (
            <p style={{ color: "crimson" }}>{error}</p>
          ) : card ? (
            <div style={{ marginBottom: "1rem" }}>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>Card on file</div>
              <div>
                {card.brand.toUpperCase()} •••• {card.last4} &nbsp; exp{" "}
                {String(card.exp_month).padStart(2, "0")}/{String(card.exp_year).slice(-2)}
              </div>
            </div>
          ) : (
            <p>No card on file yet.</p>
          )}

          <button
            className="boutique-primary-btn"
            onClick={openBillingPortal}
            disabled={portalLoading}
            style={{
              minWidth: 220,
              marginTop: 12,
              display: "inline-flex",
              justifyContent: "center",
            }}
          >
            {portalLoading ? "Opening…" : card ? "Update Card" : "Add Card"}
          </button>

          <p style={{ fontSize: 12, color: "#666", marginTop: 12 }}>
            You’ll be redirected to our secure Stripe portal to manage your payment method.
          </p>

          {/* NEW: Billing Support link */}
          <div style={{ marginTop: 14 }}>
            <span style={{ fontSize: 12, color: "#666", display: "block" }}>
              Need extra help?
            </span>
            <button
              type="button"
              onClick={() => setShowSupport(true)}
              style={{
                background: "none",
                border: "none",
                color: "#2c62ba",
                textDecoration: "underline",
                fontSize: 14,
                cursor: "pointer",
                padding: 6,
              }}
              aria-haspopup="dialog"
              aria-expanded={showSupport}
            >
              Billing Support
            </button>
          </div>
        </div>
      </div>

      {/* NEW: Billing Support modal */}
      {showSupport && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Billing Support"
          onClick={() => setShowSupport(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.4)",
            zIndex: 1100,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
        >
          <div
            className="pixie-card wd-page-turn"
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#fff",
              borderRadius: 16,
              width: "92%",
              maxWidth: 520,
              padding: "1.25rem 1.25rem 1rem",
              position: "relative",
              boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
            }}
          >
            <button
              onClick={() => setShowSupport(false)}
              aria-label="Close Billing Support"
              style={{
                position: "absolute",
                top: 10,
                right: 12,
                background: "none",
                border: "none",
                fontSize: "1.25rem",
                cursor: "pointer",
              }}
            >
              ✖
            </button>

            <h2
              style={{
                textAlign: "center",
                color: "#2c62ba",
                margin: "0 0 8px",
                fontWeight: 700,
                fontSize: 20,
              }}
            >
              Billing Support
            </h2>

            <div style={{ fontSize: 14, color: "#333", lineHeight: 1.5, textAlign: "center" }}>
              <p style={{ margin: "6px 0" }}>
                ✨ To update your card, click <strong>“Update Card”</strong> on the previous screen.
              </p>
              <p style={{ margin: "6px 0" }}>
                ✨ To talk about <strong>rescheduling</strong> or <strong>cancellations</strong>, email
                {" "}
                <a href="mailto:madge@wedanddone.com" style={{ color: "#2c62ba" }}>
                  madge@wedanddone.com
                </a>{" "}
                with your wedding date and details.
              </p>
              <p style={{ margin: "10px 0 0", color: "#666", fontSize: 12 }}>
                A real human will review your request and follow up personally.
              </p>
            </div>

            <div style={{ display: "flex", justifyContent: "center", marginTop: 14 }}>
              <button
                className="boutique-primary-btn"
                onClick={() => setShowSupport(false)}
                style={{ minWidth: 140 }}
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PaymentSettingsOverlay;