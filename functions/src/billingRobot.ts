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

/** Adds ~1 month while preserving “day-of-month-ish” behavior. */
function addOneMonth(ms: number): number {
  const d = new Date(ms);
  const origDay = d.getUTCDate();

  // Move to first of next month
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + 1);

  // Clamp day to last day of that month
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(origDay, lastDay));

  return d.getTime();
}

/**
 * Count how many monthly charge opportunities remain from nextChargeAt through finalDueAt inclusive,
 * stepping by month (and clamped to a sane max).
 */
function countRemainingMonthlyCharges(nextChargeAtMs: number, finalDueAtMs: number): number {
  if (!Number.isFinite(nextChargeAtMs) || !Number.isFinite(finalDueAtMs)) return 1;
  if (nextChargeAtMs > finalDueAtMs) return 1;

  let count = 0;
  let t = nextChargeAtMs;

  // Safety cap so we never loop forever
  for (let i = 0; i < 120; i++) {
    if (t > finalDueAtMs) break;
    count++;
    const next = addOneMonth(t);
    if (next === t) break;
    t = next;
  }

  return Math.max(1, count);
}

// ✅ Daily at 9:00am (Phoenix time is also fine, but LA matches what you’ve been using)
export const billingRobot = onSchedule(
  { schedule: "0 9 * * *", timeZone: "America/Los_Angeles" },
  async () => {
    console.log("🤖 billingRobot tick — project:", process.env.GCLOUD_PROJECT);

    const s = getStripe();
    const nowMs = Date.now();

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
        const product = auto?.product || "unknown";

        const nextChargeAtISO: string | null = auto?.nextChargeAt ?? null;
        const finalDueAtISO: string | null = auto?.finalDueAt ?? null;

        const remainingCents = Number(auto?.remainingCents ?? 0);
        const perMonthCents = Number(auto?.perMonthCents ?? 0);
        const lastPaymentCents = Number(auto?.lastPaymentCents ?? 0);
        const planMonths = Number(auto?.planMonths ?? 0);
        const paymentsMade = Number(auto?.paymentsMade ?? 0);

        const customerId: string | undefined =
          auto?.stripeCustomerId || data?.stripeCustomerId || undefined;

        if (!customerId || remainingCents <= 0) continue;

        const nextChargeAtMs = nextChargeAtISO ? Date.parse(nextChargeAtISO) : NaN;
        const finalDueAtMs = finalDueAtISO ? Date.parse(finalDueAtISO) : NaN;

        // We require nextChargeAt to be deterministic for monthly plans.
        if (!Number.isFinite(nextChargeAtMs)) {
          await db.collection("users").doc(uid).update({
            "paymentPlanAuto.status": "paused",
            "paymentPlanAuto.lastError": "Missing/invalid nextChargeAt. Cannot auto-bill.",
            "paymentPlanAuto.updatedAt": new Date().toISOString(),
          });
          console.warn(`⏸️ Paused ${uid}: invalid nextChargeAt.`);
          continue;
        }

        const hasFinalDue = Number.isFinite(finalDueAtMs);

        // If the nextChargeAt somehow drifted beyond finalDueAt, clamp it immediately
        if (hasFinalDue && nextChargeAtMs > finalDueAtMs) {
          await db.collection("users").doc(uid).update({
            "paymentPlanAuto.nextChargeAt": new Date(finalDueAtMs).toISOString(),
            "paymentPlanAuto.updatedAt": new Date().toISOString(),
          });
        }

        const isPastFinalDue = hasFinalDue && nowMs >= finalDueAtMs;
        const isMonthlyDue = nowMs >= nextChargeAtMs;

        // Not due yet, and not in final-due window => skip
        if (!isPastFinalDue && !isMonthlyDue) continue;

        // ───────────────────────────────────────────────
        // Determine charge amount
        // Goal: remainingCents must be 0 by finalDueAt (wedding - 35 days).
        // ───────────────────────────────────────────────
        let amountCents = 0;
        let runType: "final_due" | "monthly" = "monthly";

        if (isPastFinalDue) {
          // Hard rule: if we are at/after finalDueAt, collect everything remaining now.
          amountCents = remainingCents;
          runType = "final_due";
        } else {
          // Monthly run: base planned amount
          const isLastPaymentByCounter =
            planMonths > 0 ? paymentsMade >= (planMonths - 1) : false;

          const planned =
            isLastPaymentByCounter && lastPaymentCents > 0
              ? lastPaymentCents
              : perMonthCents > 0
              ? perMonthCents
              : remainingCents;

          amountCents = Math.min(remainingCents, planned);

          // If we know finalDueAt, ensure the monthly amount is big enough
          // to pay off remainingCents by that deadline.
          if (hasFinalDue) {
            const chargesLeft = countRemainingMonthlyCharges(nextChargeAtMs, finalDueAtMs);
            const minNeeded = Math.ceil(remainingCents / chargesLeft);

            // Bump up if needed (but never exceed remaining)
            amountCents = Math.min(remainingCents, Math.max(amountCents, minNeeded));
          }

          runType = "monthly";
        }

        if (!amountCents || amountCents <= 0) continue;

        // ───────────────────────────────────────────────
        // Resolve payment method
        // ───────────────────────────────────────────────
        let pmId: string | null =
          (auto?.paymentMethodId as string | undefined) ?? null;

        if (!pmId && s) {
          try {
            const customer = await s.customers.retrieve(customerId);
            const defaultPM = (customer as any)?.invoice_settings?.default_payment_method;
            if (typeof defaultPM === "string") pmId = defaultPM;
          } catch (e: any) {
            console.warn(`⚠️ Could not read default PM for ${uid}:`, e?.message || e);
          }
        }

        if (!pmId) {
          await db.collection("users").doc(uid).update({
            "paymentPlanAuto.status": "paused",
            "paymentPlanAuto.lastError":
              "No saved payment method available for off-session charges.",
            "paymentPlanAuto.updatedAt": new Date().toISOString(),
          });
          console.warn(`⏸️ Paused ${uid}: no payment method available.`);
          continue;
        }

        // ───────────────────────────────────────────────
        // Charge (Stripe)
        // ───────────────────────────────────────────────
        if (!s) {
          console.log(
            `ℹ️ Would charge $${(amountCents / 100).toFixed(2)} to ${uid} (${runType}) (no STRIPE key).`
          );
        } else {
          const idempotencyKey = `autocharge_${uid}_${product}_${runType}_${amountCents}_${hasFinalDue ? finalDueAtMs : nextChargeAtMs}`;

          console.log(
            `💳 Charging $${(amountCents / 100).toFixed(2)} to ${uid} (${product}, ${runType}, off-session)…`
          );

          try {
            const pi = await s.paymentIntents.create(
              {
                amount: amountCents,
                currency: "usd",
                customer: customerId,
                payment_method: pmId,
                confirm: true,
                off_session: true,
                automatic_payment_methods: { enabled: true },
                metadata: {
                  flow: "auto_monthly",
                  firebase_uid: uid,
                  product,
                  runType,
                },
              },
              { idempotencyKey }
            );

            console.log(`✅ PI ${pi.id} status=${pi.status}`);

            if (pi.status !== "succeeded") {
              await db.collection("users").doc(uid).update({
                "paymentPlanAuto.status": "paused",
                "paymentPlanAuto.lastError": `PI ${pi.id} status=${pi.status}`,
                "paymentPlanAuto.updatedAt": new Date().toISOString(),
              });
              console.warn(`⏸️ Paused ${uid} — status=${pi.status}`);
              continue;
            }
          } catch (e: any) {
            await db.collection("users").doc(uid).update({
              "paymentPlanAuto.status": "paused",
              "paymentPlanAuto.lastError": e?.message || String(e),
              "paymentPlanAuto.updatedAt": new Date().toISOString(),
            });
            console.error(`❌ Stripe charge error for ${uid}:`, e?.message || e);
            continue;
          }
        }

        // ───────────────────────────────────────────────
        // Bookkeeping
        // ───────────────────────────────────────────────
        const newRemaining = Math.max(0, remainingCents - amountCents);
        const newPaymentsMade = paymentsMade + 1;

        // If paid off, complete the plan
        if (newRemaining === 0) {
          await db.collection("users").doc(uid).update({
            "paymentPlanAuto.remainingCents": 0,
            "paymentPlanAuto.status": "complete",
            "paymentPlanAuto.nextChargeAt": null,
            "paymentPlanAuto.paymentsMade": newPaymentsMade,
            "paymentPlanAuto.updatedAt": new Date().toISOString(),
          });

          console.log(`🏁 Completed ${uid}. Remaining $0.00`);
          continue;
        }

        // Otherwise, advance nextChargeAt by one month and clamp to finalDueAt if present
        let nextMs = addOneMonth(nextChargeAtMs);

        if (hasFinalDue && nextMs > finalDueAtMs) {
          // Last charge opportunity must land on/before finalDueAt
          nextMs = finalDueAtMs;
        }

        await db.collection("users").doc(uid).update({
          "paymentPlanAuto.remainingCents": newRemaining,
          "paymentPlanAuto.nextChargeAt": new Date(nextMs).toISOString(),
          "paymentPlanAuto.paymentsMade": newPaymentsMade,
          "paymentPlanAuto.updatedAt": new Date().toISOString(),
        });

        console.log(
          `📅 Updated ${uid}. Remaining $${(newRemaining / 100).toFixed(2)} | Next: ${new Date(nextMs).toISOString()}`
        );
      } catch (err: any) {
        console.error("❌ billingRobot user error:", err?.message || err, { uid });
      }
    }

    console.log("✅ billingRobot run complete.");
  }
);