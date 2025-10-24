// functions/src/index.ts
import express, { Request, Response } from "express";
import cors from "cors";
import Stripe from "stripe";
import * as admin from "firebase-admin";

// Gen 2 imports
import { onRequest } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { setGlobalOptions } from "firebase-functions/v2/options";

// ─────────── Init Firebase Admin ───────────
setGlobalOptions({ region: "us-central1" });
if (!admin.apps.length) admin.initializeApp();

// 🔗 expose the shared billing robot
export { billingRobot } from "./billingRobot";

// ─────────── Stripe helpers ───────────
let stripe: Stripe | null = null;
function getStripe(): Stripe | null {
  if (stripe) return stripe;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    console.warn("⚠️ STRIPE_SECRET_KEY not present at init time.");
    return null;
  }
  stripe = new Stripe(key);
  return stripe;
}

const db = admin.firestore();
const cents = (d: number) => Math.round(Number(d) * 100);

async function getOrCreateCustomerId(uid: string): Promise<string> {
  const ref = db.collection("users").doc(uid);
  const snap = await ref.get();
  const data = snap.exists ? snap.data() : undefined;

  if (data?.stripeCustomerId) return data.stripeCustomerId as string;

  const s = getStripe();
  if (!s) throw new Error("Stripe not configured");

  const customer = await s.customers.create({ metadata: { firebaseUID: uid } });
  await ref.set({ stripeCustomerId: customer.id }, { merge: true });
  return customer.id;
}

// ─────────── Express API (single app, CORS enabled) ───────────
const app = express();
app.use(cors({ origin: true }));           // ← solves CORS for all origins
app.use(express.json());

app.get("/health", (_req: Request, res: Response): void => {
  res.json({ ok: true, stripeConfigured: !!process.env.STRIPE_SECRET_KEY });
});

// ─────────── Existing Stripe endpoints (kept as-is) ───────────
app.post("/create-payment-intent", async (req: Request, res: Response): Promise<void> => {
  try {
    const s = getStripe();
    if (!s) { res.status(500).json({ error: "Stripe not configured." }); return; }

    let { amount, currency = "usd", metadata = {}, customerId, email, name } = req.body as {
      amount: number; currency?: string; metadata?: Record<string, string>;
      customerId?: string; email?: string; name?: string;
    };

    if (!amount || !Number.isFinite(amount) || amount <= 0) {
      res.status(400).json({ error: "Invalid amount" }); return;
    }

    if (!customerId) {
      const customer = await s.customers.create({ email, name, metadata });
      customerId = customer.id;
    }

    const intent = await s.paymentIntents.create({
      amount: Math.round(amount),
      currency,
      customer: customerId,
      setup_future_usage: "off_session",
      automatic_payment_methods: { enabled: true },
      metadata,
      receipt_email: email || undefined,
    });

    // Best-effort: remember a PM
    let pmId: string | undefined;
    if (typeof intent.payment_method === "string") {
      pmId = intent.payment_method;
    } else if (intent.latest_charge && typeof intent.latest_charge === "string") {
      const charge = await s.charges.retrieve(intent.latest_charge);
      pmId = (charge as any).payment_method as string;
    }

    if (pmId) {
      await s.customers.update(customerId, {
        invoice_settings: { default_payment_method: pmId },
      });

      if ((metadata as any)?.firebase_uid) {
        await db.collection("users").doc((metadata as any).firebase_uid).update({
          "paymentPlanAuto.paymentMethodId": pmId,
          "paymentPlanAuto.status": "active",
          "paymentPlanAuto.updatedAt": new Date().toISOString(),
        });
      }
    }

    res.json({ clientSecret: intent.client_secret, customerId });
  } catch (err: any) {
    console.error("❌ create-payment-intent failed:", err);
    res.status(500).json({ error: err?.message || "Server error" });
  }
});

app.post("/create-subscription", async (req: Request, res: Response): Promise<void> => {
  try {
    const s = getStripe();
    if (!s) { res.status(500).json({ error: "Stripe not configured." }); return; }

    const { customerId, priceId, trialEnd } = req.body as {
      customerId?: string; priceId?: string; trialEnd?: number | "now";
    };
    if (!customerId || !priceId) { res.status(400).json({ error: "Missing customerId/priceId" }); return; }

    const sub = await s.subscriptions.create({
      customer: customerId,
      items: [{ price: priceId }],
      trial_end: trialEnd ?? "now",
      payment_behavior: "default_incomplete",
      expand: ["latest_invoice.payment_intent"],
    });

    res.json({
      subscriptionId: sub.id,
      paymentIntentClientSecret: (sub.latest_invoice as any)?.payment_intent?.client_secret ?? null,
    });
  } catch (err: any) {
    console.error("❌ create-subscription failed:", err);
    res.status(500).json({ error: err?.message || "Server error" });
  }
});

app.post("/ensure-default-payment-method", async (req: Request, res: Response): Promise<void> => {
  try {
    const s = getStripe();
    if (!s) { res.status(500).json({ error: "Stripe not configured." }); return; }

    const { customerId } = req.body as { customerId?: string };
    if (!customerId) { res.status(400).json({ error: "Missing customerId" }); return; }

    const customer = (await s.customers.retrieve(customerId)) as Stripe.Customer;
    const already = (customer.invoice_settings?.default_payment_method as string | null) || null;
    if (already) { res.json({ ok: true, already }); return; }

    const pms = await s.paymentMethods.list({ customer: customerId, type: "card", limit: 1 });
    if (pms.data.length) {
      await s.customers.update(customerId, {
        invoice_settings: { default_payment_method: pms.data[0].id },
      });
      res.json({ ok: true, set: pms.data[0].id, source: "attached" });
      return;
    }

    const pis = await s.paymentIntents.list({ customer: customerId, limit: 5 });
    const found = pis.data.find(pi => pi.status === "succeeded" && typeof pi.payment_method === "string");
    const pmId = (found?.payment_method as string) || null;

    if (pmId) {
      try { await s.paymentMethods.attach(pmId, { customer: customerId }); } catch {}
      await s.customers.update(customerId, {
        invoice_settings: { default_payment_method: pmId },
      });
      res.json({ ok: true, set: pmId, source: "pi" });
      return;
    }

    res.status(404).json({ ok: false, error: "no_payment_method" });
  } catch (err: any) {
    console.error("❌ ensure-default-payment-method failed:", err);
    res.status(500).json({ error: err?.message || "Server error" });
  }
});

// ─────────── Payment Settings (single, non-duplicated) ───────────

// Return default card summary
app.post("/payments/get-default", async (req: Request, res: Response) => {
  try {
    console.log("[REST] /payments/get-default", { origin: req.headers.origin });
    const s = getStripe();
    if (!s) return res.status(500).json({ error: "Stripe not configured" });

    const { uid } = (req.body || {}) as { uid?: string };
    if (!uid) return res.status(401).json({ error: "Missing uid" });

    const customerId = await getOrCreateCustomerId(uid);
    const customer = (await s.customers.retrieve(customerId)) as Stripe.Customer;
    const defaultPmId = (customer.invoice_settings?.default_payment_method as string | null) || null;

    const toSummary = (pm: Stripe.PaymentMethod | null) => {
      if (!pm || pm.type !== "card" || !pm.card) return null;
      return {
        brand: pm.card.brand,
        last4: pm.card.last4,
        exp_month: pm.card.exp_month,
        exp_year: pm.card.exp_year,
      };
    };

    if (defaultPmId) {
      const pm = await s.paymentMethods.retrieve(defaultPmId);
      return res.json({ card: toSummary(pm) });
    }

    const list = await s.paymentMethods.list({ customer: customerId, type: "card", limit: 1 });
    if (list.data.length) return res.json({ card: toSummary(list.data[0]) });

    return res.json({ card: null });
  } catch (err: any) {
    console.error("[REST] get-default error:", err?.message || err);
    return res.status(500).json({ error: err?.message || "unknown_error" });
  }
});

// Create a Stripe Billing Portal session
app.post("/payments/billing-portal", async (req: Request, res: Response) => {
  try {
    console.log("[REST] /payments/billing-portal", { origin: req.headers.origin });
    const s = getStripe();
    if (!s) return res.status(500).json({ error: "Stripe not configured" });

    const { uid, returnUrl } = (req.body || {}) as { uid?: string; returnUrl?: string };
    if (!uid) return res.status(401).json({ error: "Missing uid" });

    const customerId = await getOrCreateCustomerId(uid);
    const finalReturnUrl =
      returnUrl || process.env.APP_RETURN_URL || "https://wedndonev2.web.app/dashboard";

    const portal = await s.billingPortal.sessions.create({
      customer: customerId,
      return_url: finalReturnUrl,
    });

    console.log("[REST] Billing portal created:", portal.id);
    return res.json({ url: portal.url });
  } catch (err: any) {
    console.error("[REST] billing-portal error:", err?.message || err);
    return res.status(500).json({ error: err?.message || "unknown_error" });
  }
});

// Catch-all for wrong /payments paths (helps kill 404 mysteries)
app.all(/^\/payments\/.*/, (req, res) => {
  console.warn("[REST] No matching /payments route", { method: req.method, path: req.path });
  res.status(404).json({ error: "not_found", path: req.path });
});

// Gen 2 HTTPS function for Express app
export const stripeApi = onRequest(app);

// ───────────── Scheduled final-balance charger ─────────────
export const chargeDueBalances = onSchedule(
  { schedule: "0 4 * * *", timeZone: "America/Chicago" },
  async () => {
    const s = getStripe();
    if (!s) { console.error("❌ Stripe not configured. Skipping."); return; }

    const now = new Date();
    const usersSnap = await db
      .collection("users")
      .where("paymentPlan.type", "==", "deposit")
      .where("paymentPlan.product", "==", "floral")
      .get();

    console.log(`🔎 Scanning ${usersSnap.size} users for due floral balances…`);

    for (const docSnap of usersSnap.docs) {
      try {
        const uid = docSnap.id;
        const data = docSnap.data() as any;

        const plan = data?.paymentPlan || {};
        const remaining = Number(plan?.remainingBalance || 0);
        const finalDueAtISO = plan?.finalDueAt as string | null;
        const customerId = data?.stripeCustomerId as string | undefined;

        if (!remaining || remaining <= 0) continue;
        if (!finalDueAtISO) continue;

        const finalDueAt = new Date(finalDueAtISO);
        if (isNaN(finalDueAt.getTime())) continue;
        if (now < finalDueAt) continue;

        if (!customerId) {
          console.warn(`⚠️ ${uid} has due balance but no stripeCustomerId. Skipping.`);
          continue;
        }

        console.log(`💳 Charging $${remaining.toFixed(2)} for ${uid} (off-session)…`);

        const pi = await s.paymentIntents.create({
          amount: cents(remaining),
          currency: "usd",
          customer: customerId,
          confirm: true,
          off_session: true,
          automatic_payment_methods: { enabled: true },
          metadata: { flow: "floral_final_payment", firebase_uid: uid },
        });

        if (pi.status !== "succeeded") {
          console.warn(`⚠️ PI for ${uid} not succeeded immediately (status=${pi.status}).`);
        }

        await db.collection("users").doc(uid).update({
          "paymentPlan.remainingBalance": 0,
          "paymentPlan.completedAt": new Date().toISOString(),
          purchases: admin.firestore.FieldValue.arrayUnion({
            label: "floral_final",
            amount: remaining,
            date: new Date().toISOString(),
            method: "auto_final_charge",
          }),
          spendTotal: admin.firestore.FieldValue.increment(remaining),
        });

        console.log(`✅ Final balance charged for ${uid}`);
      } catch (err: any) {
        console.error("❌ Auto-charge error:", err?.message || err);
      }
    }

    console.log("🏁 chargeDueBalances complete.");
  }
);