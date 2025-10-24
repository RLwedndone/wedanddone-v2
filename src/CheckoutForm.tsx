// src/components/CheckoutForm.tsx
import React, { useState } from "react";
import { CardElement, useStripe, useElements } from "@stripe/react-stripe-js";

type CheckoutFormProps = {
  total: number; // amount to charge NOW (full or deposit)
  isAddon?: boolean; // optional flag for metadata
  onSuccess: (result?: { customerId?: string }) => Promise<void>;
  setStepSuccess?: () => void;
  receiptLabel?: string;

  // Optional Stripe customer hints (avoid dupes)
  customerEmail?: string;
  customerName?: string;
  customerId?: string;
};

// ✅ Always go through the proxy (vite.config.ts will rewrite)
const API_BASE = "https://us-central1-wedndonev2.cloudfunctions.net/stripeApi";

const CheckoutForm: React.FC<CheckoutFormProps> = ({
  total,
  isAddon = false,
  onSuccess,
  setStepSuccess,
  customerEmail,
  customerName,
  customerId,
}) => {
  const stripe = useStripe();
  const elements = useElements();

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit: React.FormEventHandler<HTMLFormElement> = async (event) => {
    event.preventDefault();
    if (!stripe || !elements) return;

    setLoading(true);
    setErrorMsg(null);

    try {
      // 1) Create PaymentIntent on our server
      const amountInCents = Math.round(Number(total) * 100);
      if (!Number.isFinite(amountInCents) || amountInCents <= 0) {
        throw new Error("Invalid payment amount.");
      }

      // reuse a cached customer id if present
      const cachedCustomerId = (() => {
        try {
          return localStorage.getItem("stripeCustomerId") || undefined;
        } catch {
          return undefined;
        }
      })();

      const res = await fetch(`${API_BASE}/create-payment-intent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: amountInCents,
          currency: "usd",
          metadata: { flow: isAddon ? "addon" : "main" },
          customerId: customerId || cachedCustomerId,
          email: customerEmail || undefined,
          name: (customerName && customerName.trim()) || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data?.clientSecret) {
        throw new Error(data?.error || "Failed to create payment intent.");
      }

      // cache Stripe customer id if server returned one
      if (data.customerId) {
        try {
          localStorage.setItem("stripeCustomerId", data.customerId);
        } catch {}
      }

      // 2) Confirm payment with Stripe.js
      const card = elements.getElement(CardElement);
      if (!card) throw new Error("Card element not found.");

      const { error, paymentIntent } = await stripe.confirmCardPayment(
        data.clientSecret,
        {
          payment_method: {
            card,
            // billing_details: { name: customerName, email: customerEmail },
          },
        }
      );

      if (error) throw error;

      if (paymentIntent?.status === "requires_action") {
        const res2 = await stripe.confirmCardPayment(data.clientSecret);
        if (res2.error) throw res2.error;
        if (res2.paymentIntent?.status !== "succeeded") {
          throw new Error("Payment did not complete.");
        }
      } else if (paymentIntent?.status !== "succeeded") {
        throw new Error("Payment did not complete.");
      }

      // 3) Let the caller finish (PDFs / Firestore etc.)
      await onSuccess({ customerId: data.customerId });
      setStepSuccess?.();
    } catch (err: any) {
      setErrorMsg(err?.message || "Payment failed. Please try again.");
      console.error("❌ Stripe payment error:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div
        style={{
          padding: "1rem",
          border: "1px solid #ccc",
          borderRadius: "8px",
          marginBottom: "1rem",
        }}
      >
        <CardElement options={{ hidePostalCode: true }} />
      </div>

      {errorMsg && (
        <p style={{ color: "#d33", margin: "0 0 1rem" }}>{errorMsg}</p>
      )}

      <button
        type="submit"
        disabled={!stripe || loading}
        style={{
          backgroundColor: "#2c62ba",
          color: "white",
          border: "none",
          padding: "0.75rem 1.5rem",
          borderRadius: "8px",
          cursor: loading ? "default" : "pointer",
          fontSize: "1rem",
          display: "block",
          margin: "0 auto",
          opacity: !stripe || loading ? 0.7 : 1,
        }}
      >
        {loading ? "Processing…" : "Pay"}
      </button>
    </form>
  );
};

export default CheckoutForm;