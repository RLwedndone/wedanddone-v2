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

// 🔒 Global safety cap: max per-charge amount (in USD)
const MAX_SINGLE_CHARGE_USD = 65000; // $65,000

async function getOrCreateCustomerId(uid: string): Promise<string> {
  const ref = db.collection("users").doc(uid);
  const snap = await ref.get();
  const data = snap.exists ? snap.data() : undefined;

  const s = getStripe();
  if (!s) throw new Error("Stripe not configured");

  const email =
    (data?.email as string | undefined) ||
    (data?.userEmail as string | undefined) ||
    undefined;

  const name =
    [
      data?.firstName as string | undefined,
      data?.lastName as string | undefined,
    ]
      .filter(Boolean)
      .join(" ") || undefined;

  const existingId = data?.stripeCustomerId as string | undefined;

  // 1) If we already have an ID in Firestore, make sure it points to a real customer,
  //    and keep that record synced with latest name/email.
  if (existingId) {
    try {
      const cust = await s.customers.retrieve(existingId);
      if (!("deleted" in cust) || !cust.deleted) {
        const update: Stripe.CustomerUpdateParams = {};
        if (email && cust.email !== email) update.email = email;
        if (name && cust.name !== name) update.name = name;
        if (Object.keys(update).length > 0) {
          await s.customers.update(existingId, update);
        }
        return existingId;
      }
    } catch (err) {
      console.warn("⚠️ Saved stripeCustomerId could not be retrieved:", err);
      // fall through and try search/create
    }
  }

  // 2) No usable ID → try to find an existing customer by email
  if (email) {
    try {
      const search = await s.customers.search({
        query: `email:"${email}"`,
        limit: 1,
      });

      if (search.data.length > 0) {
        const found = search.data[0];
        const update: Stripe.CustomerUpdateParams = {};
        if (name && found.name !== name) update.name = name;
        if (Object.keys(update).length > 0) {
          await s.customers.update(found.id, update);
        }

        await ref.set({ stripeCustomerId: found.id }, { merge: true });
        return found.id;
      }
    } catch (err) {
      console.warn("⚠️ Stripe customer.search failed:", err);
    }
  }

  // 3) Still nothing → create a brand new customer and persist its ID.
  const customer = await s.customers.create({
    email,
    name,
    metadata: { firebaseUID: uid },
  });

  await ref.set({ stripeCustomerId: customer.id }, { merge: true });
  return customer.id;
}

// ─────────── Express API (single app, CORS enabled) ───────────
const app = express();

// Allow all origins at Express level (fine because we also restrict at function wrapper)
const ALLOWED_ORIGINS = new Set([
  "http://localhost:5173",
  "http://127.0.0.1:5173",

  // Firebase Hosting
  "https://wedndonev2.web.app",
  "https://wedndonev2.firebaseapp.com",

  // Production
  "https://wedndone.com",
  "https://www.wedndone.com",

  // Staging
  "https://rlwedndone.github.io",

  // Legacy / marketing domain (if still used)
  "https://wedanddone.com",
  "https://www.wedanddone.com",
]);

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  }
  if (req.method === "OPTIONS") return res.status(204).send("");
  next();
});

app.use(express.json());

app.get("/health", (_req: Request, res: Response): void => {
  res.json({ ok: true, stripeConfigured: !!process.env.STRIPE_SECRET_KEY });
});

// ─────────── Existing Stripe endpoints ───────────
app.post(
  "/create-payment-intent",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const s = getStripe();
      if (!s) {
        res.status(500).json({ error: "Stripe not configured." });
        return;
      }

      let {
        amount,
        currency = "usd",
        metadata = {},
        customerId,
        email,
        name,
        updateDefaultCard = true,
      } = req.body as {
        amount: number;
        currency?: string;
        metadata?: Record<string, string>;
        customerId?: string;
        email?: string;
        name?: string;
        updateDefaultCard?: boolean;
      };

      if (!amount || !Number.isFinite(amount) || amount <= 0) {
        res.status(400).json({ error: "Invalid amount" });
        return;
      }

      // 🔒 Global upper bound for a single charge (amount is in *cents*)
if (amount > MAX_SINGLE_CHARGE_USD * 100) {
  res.status(400).json({
    error: "amount_too_large",
    message:
      `For now we can only process single payments up to $${MAX_SINGLE_CHARGE_USD.toLocaleString()}. ` +
      "If you need a larger booking, please contact Wed&Done support.",
  });
  return;
}

            // Try to derive firebase uid from metadata (CheckoutForm sends this)
            const firebaseUid =
            (metadata as any)?.firebase_uid as string | undefined;
    
          // If we know the Firebase uid, ALWAYS go through getOrCreateCustomerId
          if (!customerId && firebaseUid) {
            try {
              customerId = await getOrCreateCustomerId(firebaseUid);
            } catch (err) {
              console.warn(
                "⚠️ getOrCreateCustomerId failed in create-payment-intent:",
                err
              );
            }
          }
    
          // If we *still* don't have a customerId, fall back to creating a bare Stripe customer
          if (!customerId) {
            const customer = await s.customers.create({
              email,
              name,
              metadata,
            });
            customerId = customer.id;
          } else {
            // Keep Stripe customer in sync with latest email/name when we know them
            try {
              const update: Stripe.CustomerUpdateParams = {};
              if (email) update.email = email;
              if (name) update.name = name;
              if (Object.keys(update).length > 0) {
                await s.customers.update(customerId, update);
              }
            } catch (err) {
              console.warn(
                "⚠️ Failed to update Stripe customer email/name:",
                err
              );
            }
          }
    
          // If we know the firebase uid, make sure Firestore has this customerId saved
          if (firebaseUid) {
            try {
              await db
                .collection("users")
                .doc(firebaseUid)
                .set({ stripeCustomerId: customerId }, { merge: true });
            } catch (err) {
              console.warn(
                "⚠️ Failed to persist stripeCustomerId back to Firestore:",
                err
              );
            }
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

      // Try to infer a payment method from the intent
      let pmId: string | undefined;

      if (typeof intent.payment_method === "string") {
        pmId = intent.payment_method;
      } else if (
        intent.latest_charge &&
        typeof intent.latest_charge === "string"
      ) {
        const charge = await s.charges.retrieve(intent.latest_charge);
        pmId = (charge as any).payment_method as string;
      }

      if (pmId) {
        // Best-effort: attach PM to this customer (ignore "already attached" errors)
        try {
          await s.paymentMethods.attach(pmId, { customer: customerId! });
        } catch (err) {
          console.warn(
            "⚠️ attach paymentMethod failed (likely already attached):",
            (err as any)?.message || err
          );
        }

        // Tie this PM to the current user's auto-plan if firebase_uid was passed
        if ((metadata as any)?.firebase_uid) {
          await db
            .collection("users")
            .doc((metadata as any).firebase_uid)
            .update({
              "paymentPlanAuto.paymentMethodId": pmId,
              "paymentPlanAuto.status": "active",
              "paymentPlanAuto.updatedAt": new Date().toISOString(),
            });
        }

        // 👉 Only update Stripe's DEFAULT card if the caller explicitly wants that
        if (updateDefaultCard) {
          await s.customers.update(customerId!, {
            invoice_settings: { default_payment_method: pmId },
          });
        }
      }

      res.json({ clientSecret: intent.client_secret, customerId });
    } catch (err: any) {
      console.error("❌ create-payment-intent failed:", err);
      res.status(500).json({ error: err?.message || "Server error" });
    }
  }
);

app.post(
  "/create-subscription",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const s = getStripe();
      if (!s) {
        res.status(500).json({ error: "Stripe not configured." });
        return;
      }

      const { customerId, priceId, trialEnd } = req.body as {
        customerId?: string;
        priceId?: string;
        trialEnd?: number | "now";
      };
      if (!customerId || !priceId) {
        res
          .status(400)
          .json({ error: "Missing customerId/priceId" });
        return;
      }

      const sub = await s.subscriptions.create({
        customer: customerId,
        items: [{ price: priceId }],
        trial_end: trialEnd ?? "now",
        payment_behavior: "default_incomplete",
        expand: ["latest_invoice.payment_intent"],
      });

      res.json({
        subscriptionId: sub.id,
        paymentIntentClientSecret:
          (sub.latest_invoice as any)?.payment_intent?.client_secret ?? null,
      });
    } catch (err: any) {
      console.error("❌ create-subscription failed:", err);
      res.status(500).json({ error: err?.message || "Server error" });
    }
  }
);

app.post(
  "/ensure-default-payment-method",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const s = getStripe();
      if (!s) {
        res.status(500).json({ error: "Stripe not configured." });
        return;
      }

      const { customerId } = req.body as { customerId?: string };
      if (!customerId) {
        res.status(400).json({ error: "Missing customerId" });
        return;
      }

      const customer = (await s.customers.retrieve(
        customerId
      )) as Stripe.Customer;
      const already =
        (customer.invoice_settings?.default_payment_method as
          | string
          | null) || null;
      if (already) {
        res.json({ ok: true, already });
        return;
      }

      const pms = await s.paymentMethods.list({
        customer: customerId,
        type: "card",
        limit: 1,
      });
      if (pms.data.length) {
        await s.customers.update(customerId, {
          invoice_settings: { default_payment_method: pms.data[0].id },
        });
        res.json({
          ok: true,
          set: pms.data[0].id,
          source: "attached",
        });
        return;
      }

      const pis = await s.paymentIntents.list({
        customer: customerId,
        limit: 5,
      });
      const found = pis.data.find(
        (pi) =>
          pi.status === "succeeded" &&
          typeof pi.payment_method === "string"
      );
      const pmId = (found?.payment_method as string) || null;

      if (pmId) {
        try {
          await s.paymentMethods.attach(pmId, { customer: customerId });
        } catch {}
        await s.customers.update(customerId, {
          invoice_settings: { default_payment_method: pmId },
        });
        res.json({ ok: true, set: pmId, source: "pi" });
        return;
      }

      res
        .status(404)
        .json({ ok: false, error: "no_payment_method" });
    } catch (err: any) {
      console.error("❌ ensure-default-payment-method failed:", err);
      res.status(500).json({ error: err?.message || "Server error" });
    }
  }
);

// ─────────── Payment Settings (single, non-duplicated) ───────────

// Return default card summary
app.post("/payments/get-default", async (req: Request, res: Response) => {
  try {
    console.log("[REST] /payments/get-default", {
      origin: req.headers.origin,
    });
    const s = getStripe();
    if (!s)
      return res
        .status(500)
        .json({ error: "Stripe not configured" });

    const { uid } = (req.body || {}) as { uid?: string };
    if (!uid)
      return res
        .status(401)
        .json({ error: "Missing uid" });

    const customerId = await getOrCreateCustomerId(uid);
    const customer = (await s.customers.retrieve(
      customerId
    )) as Stripe.Customer;
    const defaultPmId =
      (customer.invoice_settings?.default_payment_method as
        | string
        | null) || null;

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

    const list = await s.paymentMethods.list({
      customer: customerId,
      type: "card",
      limit: 1,
    });
    if (list.data.length)
      return res.json({ card: toSummary(list.data[0]) });

    return res.json({ card: null });
  } catch (err: any) {
    console.error("[REST] get-default error:", err?.message || err);
    return res
      .status(500)
      .json({ error: err?.message || "unknown_error" });
  }
});

// Create a Stripe Billing Portal session
app.post("/payments/billing-portal", async (req: Request, res: Response) => {
  try {
    console.log("[REST] /payments/billing-portal", {
      origin: req.headers.origin,
    });
    const s = getStripe();
    if (!s)
      return res
        .status(500)
        .json({ error: "Stripe not configured" });

    const { uid, returnUrl } = (req.body || {}) as {
      uid?: string;
      returnUrl?: string;
    };
    if (!uid)
      return res
        .status(401)
        .json({ error: "Missing uid" });

    const customerId = await getOrCreateCustomerId(uid);
    const finalReturnUrl =
      returnUrl ||
      process.env.APP_RETURN_URL ||
      "https://wedndonev2.web.app/dashboard";

    const portal = await s.billingPortal.sessions.create({
      customer: customerId,
      return_url: finalReturnUrl,
    });

    console.log("[REST] Billing portal created:", portal.id);
    return res.json({ url: portal.url });
  } catch (err: any) {
    console.error("[REST] billing-portal error:", err?.message || err);
    return res
      .status(500)
      .json({ error: err?.message || "unknown_error" });
  }
});

// Shared handler to charge the customer's saved/default card
async function chargeDefaultHandler(
  req: Request,
  res: Response
): Promise<void> {
  try {
    console.log("[REST] chargeDefaultHandler", {
      origin: req.headers.origin,
      path: req.path,
      method: req.method,
    });

    const s = getStripe();
    if (!s) {
      res.status(500).json({ error: "Stripe not configured" });
      return;
    }

    const {
      uid,
      amount,
      currency = "usd",
      metadata = {},
    } = (req.body || {}) as {
      uid?: string;
      amount?: number;
      currency?: string;
      metadata?: Record<string, string>;
    };

    if (!uid) {
      res.status(401).json({ error: "Missing uid" });
      return;
    }
    if (!amount || !Number.isFinite(amount) || amount <= 0) {
      res.status(400).json({ error: "Invalid amount" });
      return;
    }

    // 🔒 Global upper bound for manual/saved-card charges (amount is in USD)
if (amount > MAX_SINGLE_CHARGE_USD) {
  res.status(400).json({
    error: "amount_too_large",
    message:
      `For now we can only process single payments up to $${MAX_SINGLE_CHARGE_USD.toLocaleString()}. ` +
      "If you need a larger booking, please contact Wed&Done support.",
  });
  return;
}

    const customerId = await getOrCreateCustomerId(uid);

    const customer = (await s.customers.retrieve(
      customerId
    )) as Stripe.Customer;
    let pmId =
      (customer.invoice_settings?.default_payment_method as
        | string
        | null) || null;

    if (!pmId) {
      const list = await s.paymentMethods.list({
        customer: customerId,
        type: "card",
        limit: 1,
      });
      pmId = list.data[0]?.id ?? null;
    }

    if (!pmId) {
      res.status(400).json({
        error: "no_default_payment_method",
        message:
          "No saved card was found for this customer. Ask the user to add a card first.",
      });
      return;
    }

    const pi = await s.paymentIntents.create({
      amount: cents(amount),
      currency,
      customer: customerId,
      payment_method: pmId,
      confirm: true,
      off_session: false, // in-session; if you want fully off-session, flip this
      // 👇 IMPORTANT: card-only, no redirect methods
      payment_method_types: ["card"],
      metadata: {
        ...metadata,
        flow: metadata?.flow || "manual_default_card_charge",
        firebase_uid: uid,
      },
    });

    if (
      pi.status === "requires_action" ||
      pi.status === "requires_payment_method"
    ) {
      res.status(402).json({
        error: "authentication_required",
        status: pi.status,
        paymentIntentId: pi.id,
      });
      return;
    }

    res.json({
      ok: true,
      paymentIntentId: pi.id,
      status: pi.status,
      customerId,
    });
  } catch (err: any) {
    console.error(
      "[REST] chargeDefaultHandler error:",
      err?.message || err
    );
    res
      .status(500)
      .json({ error: err?.message || "unknown_error" });
  }
}

// Canonical route (old name)
app.post("/payments/charge-default", chargeDefaultHandler);

// Alias route used by the frontend: /payments/pay-with-saved-card
app.post("/payments/pay-with-saved-card", chargeDefaultHandler);

// Gen 2 HTTPS function for Express app (with explicit CORS domains)
export const stripeapiV2 = onRequest(
  {
    cors: [
      "http://localhost:5173",
      "http://127.0.0.1:5173",
    
      // Firebase Hosting
      "https://wedndonev2.web.app",
      "https://wedndonev2.firebaseapp.com",
    
      // Production
      "https://wedndone.com",
      "https://www.wedndone.com",
    
      // Staging
      "https://rlwedndone.github.io",
    
      // Legacy / marketing domain (if still used)
      "https://wedanddone.com",
      "https://www.wedanddone.com",
    ],
  },
  app
);

// ───────────── Scheduled final-balance charger ─────────────
export const chargeDueBalances = onSchedule(
  { schedule: "0 4 * * *", timeZone: "America/Chicago" },
  async () => {
    const s = getStripe();
    if (!s) {
      console.error(
        "❌ Stripe not configured. Skipping."
      );
      return;
    }

    const now = new Date();
    const usersSnap = await db
      .collection("users")
      .where("paymentPlan.type", "==", "deposit")
      .where("paymentPlan.product", "==", "floral")
      .get();

    console.log(
      `🔎 Scanning ${usersSnap.size} users for due floral balances…`
    );

    for (const docSnap of usersSnap.docs) {
      try {
        const uid = docSnap.id;
        const data = docSnap.data() as any;

        const plan = data?.paymentPlan || {};
        const remaining = Number(
          plan?.remainingBalance || 0
        );
        const finalDueAtISO = plan?.finalDueAt as
          | string
          | null;
        const customerId =
          data?.stripeCustomerId as string | undefined;

        if (!remaining || remaining <= 0) continue;
        if (!finalDueAtISO) continue;

        const finalDueAt = new Date(finalDueAtISO);
        if (isNaN(finalDueAt.getTime())) continue;
        if (now < finalDueAt) continue;

        if (!customerId) {
          console.warn(
            `⚠️ ${uid} has due balance but no stripeCustomerId. Skipping.`
          );
          continue;
        }

        console.log(
          `💳 Charging $${remaining.toFixed(
            2
          )} for ${uid} (off-session)…`
        );

        const pi = await s.paymentIntents.create({
          amount: cents(remaining),
          currency: "usd",
          customer: customerId,
          confirm: true,
          off_session: true,
          automatic_payment_methods: { enabled: true },
          metadata: {
            flow: "floral_final_payment",
            firebase_uid: uid,
          },
        });

        if (pi.status !== "succeeded") {
          console.warn(
            `⚠️ PI for ${uid} not succeeded immediately (status=${pi.status}).`
          );
        }

        await db
          .collection("users")
          .doc(uid)
          .update({
            "paymentPlan.remainingBalance": 0,
            "paymentPlan.completedAt":
              new Date().toISOString(),
            purchases:
              admin.firestore.FieldValue.arrayUnion({
                label: "floral_final",
                amount: remaining,
                date: new Date().toISOString(),
                method: "auto_final_charge",
              }),
            spendTotal:
              admin.firestore.FieldValue.increment(
                remaining
              ),
          });

        console.log(
          `✅ Final balance charged for ${uid}`
        );
      } catch (err: any) {
        console.error(
          "❌ Auto-charge error:",
          err?.message || err
        );
      }
    }

    console.log("🏁 chargeDueBalances complete.");
  }
);