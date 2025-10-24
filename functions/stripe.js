// functions/stripe.js
const fs = require("fs");
const path = require("path");

// resolve and load the .env that lives NEXT TO THIS FILE
const ENV_PATH = path.join(__dirname, ".env");
const envExists = fs.existsSync(ENV_PATH);
require("dotenv").config({ path: ENV_PATH });

// helpful debug so we know what's happening
const hasKey = !!process.env.STRIPE_SECRET_KEY;
const redacted =
  process.env.STRIPE_SECRET_KEY
    ? process.env.STRIPE_SECRET_KEY.slice(0, 7) + "…" + process.env.STRIPE_SECRET_KEY.slice(-4)
    : "(missing)";
console.log(`[stripe.js] .env path=${ENV_PATH} exists=${envExists} | STRIPE_SECRET_KEY=${redacted}`);

const express = require("express");
const cors = require("cors");
const Stripe = require("stripe");

// sanity check so we fail fast with a helpful message
if (!process.env.STRIPE_SECRET_KEY) {
  console.error(
    "❌ STRIPE_SECRET_KEY is missing. Create functions/.env with STRIPE_SECRET_KEY=sk_test_..."
  );
  process.exit(1);
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-06-20",
});

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

// quick ping
app.get("/health", (_req, res) => res.json({ ok: true }));

// one-time payment intent (saves card for future off-session billing)
app.post("/create-payment-intent", async (req, res) => {
    try {
      let { amount, currency = "usd", metadata = {}, customerId, email, name } = req.body;
  
      if (!amount || amount <= 0) {
        return res.status(400).json({ error: "Invalid amount" });
      }
  
      // Ensure we have a Customer (needed for saving PM to customer)
      if (!customerId) {
        // If you keep a Stripe customer ID in Firestore per user, prefer that instead of creating duplicates.
        const customer = await stripe.customers.create({
          email,
          name,
          // You can also store your Firebase UID for later lookup:
          metadata: { ...metadata, firebase_uid: metadata.firebase_uid || "" },
        });
        customerId = customer.id;
      }
  
      const intent = await stripe.paymentIntents.create({
        amount: Math.round(amount),        // in cents
        currency,
        customer: customerId,              // <-- attach to customer
        setup_future_usage: "off_session", // <-- save card for future off-session charges
        automatic_payment_methods: { enabled: true },
        metadata,
        receipt_email: email || undefined, // optional
      });
  
      res.json({ clientSecret: intent.client_secret, customerId });
    } catch (err) {
      console.error("❌ create-payment-intent failed:", err);
      res.status(500).json({ error: err.message });
    }
  });

// (optional) create a subscription w/ trial until final-due date
app.post("/create-subscription", async (req, res) => {
  try {
    const { customerId, priceId, trialEnd } = req.body;
    if (!customerId || !priceId) return res.status(400).json({ error: "Missing customerId/priceId" });

    const sub = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: priceId }],
      trial_end: trialEnd ?? "now",
      payment_behavior: "default_incomplete",
      expand: ["latest_invoice.payment_intent"],
    });

    res.json({
      subscriptionId: sub.id,
      paymentIntentClientSecret: sub.latest_invoice?.payment_intent?.client_secret ?? null,
    });
  } catch (err) {
    console.error("❌ create-subscription failed:", err);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 4242;
app.listen(PORT, () => {
  console.log("✅ Stripe server running on http://localhost:" + PORT);
});