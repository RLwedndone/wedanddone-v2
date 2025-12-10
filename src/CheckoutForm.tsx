// src/components/CheckoutForm.tsx
import React, { useState } from "react";
import { CardElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { getAuth } from "firebase/auth";

type CheckoutFormProps = {
  total: number; // amount to charge NOW (full or deposit)
  isAddon?: boolean;
  onSuccess: (result?: { customerId?: string; paymentMethodId?: string }) => Promise<void>;
  setStepSuccess?: () => void;
  receiptLabel?: string;

  customerEmail?: string;
  customerName?: string;
  customerId?: string;

  // 🔥 NEW:
  useSavedCard?: boolean; // true = charge saved card; false = Stripe.js entry
  updateDefaultCard?: boolean; // true = make this new card the Stripe default
};

const API_BASE =
  "https://us-central1-wedndonev2.cloudfunctions.net/stripeapiV2";

const CheckoutForm: React.FC<CheckoutFormProps> = ({
  total,
  isAddon = false,
  onSuccess,
  setStepSuccess,
  customerEmail,
  customerName,
  customerId,
  useSavedCard = false,
  updateDefaultCard = false,
}) => {
  const stripe = useStripe();
  const elements = useElements();

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit: React.FormEventHandler<HTMLFormElement> = async (
    event
  ) => {
    event.preventDefault();
    setErrorMsg(null);

    const amountInCents = Math.round(Number(total) * 100);
    if (!Number.isFinite(amountInCents) || amountInCents <= 0) {
      setErrorMsg("Invalid payment amount.");
      return;
    }

    const auth = getAuth();
    const uid = auth.currentUser?.uid;

    if (!uid) {
      setErrorMsg("You must be logged in to complete checkout.");
      return;
    }

    setLoading(true);

    try {
      // ───────────────────────────────────────────────
      // 🔥 PATH A: Use saved card (no Stripe.js involved)
      // ───────────────────────────────────────────────
      if (useSavedCard) {
        const res = await fetch(
          `${API_BASE}/payments/pay-with-saved-card`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              uid,
              amount: total, // dollars; backend converts with cents()
              currency: "usd",
              metadata: { flow: isAddon ? "addon" : "main" },
            }),
          }
        );

        const data = await res.json();

        if (!res.ok || data?.error) {
          throw new Error(
            data?.error || "Saved card payment failed."
          );
        }

        await onSuccess({
          customerId: data.customerId,
          paymentMethodId: data.paymentMethodId,
        });
        setStepSuccess?.();
        return;
      }

      // ───────────────────────────────────────────────
      // 🔥 PATH B: Entering a NEW card through Stripe.js
      // ───────────────────────────────────────────────
      if (!stripe || !elements) {
        throw new Error("Stripe is not loaded yet.");
      }

      const cachedCustomerId = (() => {
        try {
          return (
            localStorage.getItem("stripeCustomerId") ||
            undefined
          );
        } catch {
          return undefined;
        }
      })();

      const res = await fetch(
        `${API_BASE}/create-payment-intent`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amount: amountInCents,
            currency: "usd",
            metadata: {
              flow: isAddon ? "addon" : "main",
              firebase_uid: uid,
            },
            customerId: customerId || cachedCustomerId,
            email: customerEmail || undefined,
            name: customerName || undefined,
            // 👇 THIS is now driven by the caller (FloralCheckOut, PhotoCheckOut, etc.)
            updateDefaultCard: !!updateDefaultCard,
          }),
        }
      );

      const data = await res.json();
      if (!res.ok || !data?.clientSecret) {
        throw new Error(
          data?.error || "Failed to create payment intent."
        );
      }

      if (data.customerId) {
        try {
          localStorage.setItem(
            "stripeCustomerId",
            data.customerId
          );
        } catch {}
      }

      const card = elements.getElement(CardElement);
      if (!card) throw new Error("Card element not found.");

      const { error, paymentIntent } =
        await stripe.confirmCardPayment(
          data.clientSecret,
          {
            payment_method: {
              card,
            },
          }
        );

      if (error) throw error;

      if (paymentIntent?.status === "requires_action") {
        const res2 = await stripe.confirmCardPayment(
          data.clientSecret
        );
        if (res2.error) throw res2.error;
        if (res2.paymentIntent?.status !== "succeeded") {
          throw new Error("Payment did not complete.");
        }
      }

      if (paymentIntent?.status !== "succeeded") {
        throw new Error("Payment did not complete.");
      }

      // Normalize payment_method to a string ID
      const paymentMethodId =
        typeof paymentIntent.payment_method === "string"
          ? paymentIntent.payment_method
          : paymentIntent.payment_method?.id;

      await onSuccess({
        customerId: data.customerId,
        paymentMethodId,
      });
      setStepSuccess?.();
    } catch (err: any) {
      console.error("❌ Checkout error:", err);
      setErrorMsg(
        err?.message || "Payment failed. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* NEW CARD MODE: show Stripe CardElement */}
      {!useSavedCard && (
        <div
          style={{
            padding: "1rem",
            border: "1px solid #ccc",
            borderRadius: 8,
            marginBottom: "1rem",
          }}
        >
          <CardElement options={{ hidePostalCode: true }} />
        </div>
      )}

      {errorMsg && (
        <p
          style={{
            color: "#d33",
            margin: "0 0 1rem",
          }}
        >
          {errorMsg}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
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
          opacity: loading ? 0.6 : 1,
        }}
      >
        {loading ? "Processing…" : "Pay"}
      </button>
    </form>
  );
};

export default CheckoutForm;