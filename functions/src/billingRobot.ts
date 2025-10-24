import * as admin from "firebase-admin";
import Stripe from "stripe";
import { onSchedule } from "firebase-functions/v2/scheduler";

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

let stripe: Stripe | null = null;
function getStripe() {
  if (stripe) return stripe;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    console.warn("⚠️ STRIPE_SECRET_KEY not set; billingRobot will skip charges.");
    return null;
  }
  stripe = new Stripe(key, { apiVersion: "2024-06-20" } as any);
  return stripe;
}

// ⬇️ TEST MODE: run every 5 minutes (switch back to daily later)
export const billingRobot = onSchedule(
    { schedule: "0 9 * * *", timeZone: "America/Los_Angeles" },
  async () => {
    console.log("🤖 billingRobot tick (*/5) — build:", process.env.GCLOUD_PROJECT);
    const s = getStripe();
    const now = Date.now();

    const usersSnap = await db
      .collection("users")
      .where("paymentPlanAuto.status", "==", "active")
      .get();

    console.log(`🤖 billingRobot scanning ${usersSnap.size} user(s)…`);

    for (const docSnap of usersSnap.docs) {
      const uid = docSnap.id;
      const data = docSnap.data() as any;
      const auto = data?.paymentPlanAuto ?? {};

      try {
        const nextChargeAtISO: string | null = auto?.nextChargeAt ?? null;
        const remainingCents = Number(auto?.remainingCents ?? 0);
        const perMonthCents = Number(auto?.perMonthCents ?? 0);
        const lastPaymentCents = Number(auto?.lastPaymentCents ?? 0);
        const planMonths = Number(auto?.planMonths ?? 0);
        const customerId: string | undefined =
          auto?.stripeCustomerId || data?.stripeCustomerId || undefined;

        if (!nextChargeAtISO || !customerId || remainingCents <= 0 || planMonths <= 0) {
          continue; // not billable
        }

        const nextChargeAt = Date.parse(nextChargeAtISO);
        if (isNaN(nextChargeAt) || nextChargeAt > now) continue; // not time yet

        // How much to charge this run
        const amountCents = Math.max(
          0,
          Math.min(remainingCents, perMonthCents || remainingCents || lastPaymentCents || 0)
        );
        if (!amountCents) continue;

        // ─────────────────────────────────────────
        // Ensure we have a usable payment method
        // ─────────────────────────────────────────
        let pmId: string | null =
          (auto?.paymentMethodId as string | undefined) ?? null;

        if (!pmId && s && customerId) {
          // Fallback to Stripe customer's default payment method
          try {
            const customer = await s.customers.retrieve(customerId);
            const defaultPM =
              (customer as any)?.invoice_settings?.default_payment_method;
            if (typeof defaultPM === "string") pmId = defaultPM;
          } catch (e) {
            console.warn(`⚠️ Could not read default PM for ${uid}:`, (e as any)?.message || e);
          }
        }

        if (!pmId) {
          // Pause plan and surface a human message
          await db.collection("users").doc(uid).update({
            "paymentPlanAuto.status": "paused",
            "paymentPlanAuto.lastError":
              "No saved payment method available for off-session charges. Ask the customer to complete a checkout to save a card.",
            "paymentPlanAuto.updatedAt": new Date().toISOString(),
          });
          console.warn(`⏸️ Paused ${uid}: no payment method available.`);
          continue;
        }

        // ─────────────────────────────────────────
        // Charge (off-session) with idempotency
        // ─────────────────────────────────────────
        if (!s) {
          console.log(
            `ℹ️ Would charge $${(amountCents / 100).toFixed(2)} to ${uid} (no STRIPE key).`
          );
        } else {
          console.log(
            `💳 Charging $${(amountCents / 100).toFixed(2)} to ${uid} (off-session)…`
          );

          try {
            const idempotencyKey = `autocharge_${uid}_${nextChargeAt}_${amountCents}`;

            const pi = await s.paymentIntents.create(
              {
                amount: amountCents,
                currency: "usd",
                customer: customerId,
                payment_method: pmId,          // 👈 use the saved/default PM
                confirm: true,
                off_session: true,
                automatic_payment_methods: { enabled: true },
                metadata: {
                  flow: "auto_monthly",
                  firebase_uid: uid,
                  product: auto?.product || "unknown",
                },
              },
              { idempotencyKey }
            );

            console.log(`✅ PI ${pi.id} status=${pi.status}`);

            if (pi.status !== "succeeded") {
              // Requires action or failed — pause to avoid looping.
              await db.collection("users").doc(uid).update({
                "paymentPlanAuto.status": "paused",
                "paymentPlanAuto.lastError": `PI ${pi.id} status=${pi.status}`,
                "paymentPlanAuto.updatedAt": new Date().toISOString(),
              });
              console.warn(
                `⏸️ Paused auto-billing for ${uid} — status=${pi.status}. Ask the user to update payment method.`
              );
              continue;
            }
          } catch (e: any) {
            // Stripe threw hard — pause & record error
            await db.collection("users").doc(uid).update({
              "paymentPlanAuto.status": "paused",
              "paymentPlanAuto.lastError": e?.message || String(e),
              "paymentPlanAuto.updatedAt": new Date().toISOString(),
            });
            console.error("❌ Stripe charge error:", e?.message || e);
            continue;
          }
        }

        // ─────────────────────────────────────────
        // Bookkeeping: advance month & reduce remaining
        // ─────────────────────────────────────────
        const next = new Date(nextChargeAt);
        next.setMonth(next.getMonth() + 1);

        const newRemaining = Math.max(0, remainingCents - amountCents);

        await db.collection("users").doc(uid).update({
          "paymentPlanAuto.remainingCents": newRemaining,
          "paymentPlanAuto.nextChargeAt": next.toISOString(),
          "paymentPlanAuto.updatedAt": new Date().toISOString(),
        });

        console.log(
          `📅 Updated ${uid}. Remaining $${(newRemaining / 100).toFixed(
            2
          )} | Next: ${next.toISOString()}`
        );
      } catch (err: any) {
        console.error("❌ billingRobot user error:", err?.message || err, { uid });
      }
    }

    console.log("🏁 billingRobot run complete.");
  }
);