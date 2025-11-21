// src/utils/email/email.ts
import emailjs from "@emailjs/browser";
import {
  EMAIL_TEMPLATES,
  TEMPLATE_MAP,
  type BookingProductKey,
  type TemplateKey,
} from "./emailTemplateIds";

import { getAuth } from "firebase/auth";
import { db } from "../../firebase/firebaseConfig";
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import {
  EMAILJS_PUBLIC_KEY,
  EMAILJS_SERVICE_ID,
} from "../../config/emailjsConfig";

// Single service id (centralized)
const SERVICE_ID = EMAILJS_SERVICE_ID;

/** Vars you’ll pass from checkouts/thank-yous */
export type BookingVars = {
  // User-facing fields
  firstName?: string;
  dashboardUrl?: string;
  total?: number | string;
  line_items?: string;
  wedding_date?: string;

  // Admin-facing fields
  user_email?: string; // 👈 used in To: {{user_email}} for user templates too
  user_full_name?: string;
  pdf_url?: string;
  pdf_title?: string;

  // Optional amounts/dates sometimes shown to users
  payment_now?: number | string;
  remaining_balance?: number | string;
  final_due?: string;

  // Optional override for admin headline
  product_name?: string;

  // Allow any extra template vars without TS errors
  [key: string]: any;
};

// Small helper so we can log the actual EmailJS template id
const templateId = (key: TemplateKey) => EMAIL_TEMPLATES[key];

/** Low-level sender with verbose debug */
async function sendTemplate(
  templateKey: TemplateKey,
  vars: Record<string, any>
) {
  const id = templateId(templateKey);
  if (!id) {
    console.error(`[email] Unknown template key: ${templateKey}`);
    throw new Error(`Unknown template key: ${templateKey}`);
  }

  if (!EMAILJS_PUBLIC_KEY) {
    console.error("❌ Missing EMAILJS_PUBLIC_KEY in emailjsConfig.ts");
    throw new Error("Missing EmailJS public key");
  }

  // Trim the debug preview so console stays readable
  const preview = {
    to: vars.user_email ?? vars.to_email ?? "(none)",
    firstName: vars.firstName,
    product_name: vars.product_name,
    pdf_url: vars.pdf_url,
  };

  console.log(
    `[email] send → service=${SERVICE_ID}, templateKey=${templateKey}, templateId=${id}`,
    preview
  );

  // ✅ Use the shared SERVICE_ID + PUBLIC_KEY from config
  return emailjs.send(SERVICE_ID, id, vars, EMAILJS_PUBLIC_KEY);
}

/** Pretty name used in admin subject/body */
function humanizeProduct(key: BookingProductKey) {
  switch (key) {
    case "floral":
      return "Floral";
    case "floral_addon":
      return "Floral Add-On";
    case "photo":
      return "Photo";
    case "photo_addon":
      return "Photo Add-On";
    case "planner":
      return "Planner";
    case "jam":
      return "Jam & Groove (DJ)";
    case "venue":
      return "Venue";
    case "yum_catering":
      return "Yum Yum Catering";
    case "yum_dessert":
      return "Yum Yum Dessert";
    default:
      return "Booking";
  }
}

/** Defaults for admin templates */
function buildAdminVars(product: BookingProductKey, vars: BookingVars) {
  return {
    product_name: vars.product_name || humanizeProduct(product),
    user_full_name: vars.user_full_name || "Unknown User",
    user_email: vars.user_email || "unknown@wedndone.com",
    wedding_date: vars.wedding_date || "TBD",
    pdf_url: vars.pdf_url || "",
  };
}

/** Defaults for user templates */
function buildUserVars(vars: BookingVars) {
  return {
    firstName: vars.firstName || "Friend",
    wedding_date: vars.wedding_date || "TBD",
    total:
      typeof vars.total === "number"
        ? vars.total.toFixed(2)
        : vars.total ?? "",
    line_items: vars.line_items || "",
    dashboardUrl:
      vars.dashboardUrl || "https://wedndone.com/dashboard",
    // 👇 make sure {{user_email}} resolves in EmailJS "To Email"
    user_email: vars.user_email || "unknown@wedndone.com",
  };
}

/**
 * One-call helper:
 * Sends user email and admin alert for a given product.
 */
export async function notifyBooking(
  product: BookingProductKey,
  vars: BookingVars,
  options: { sendUser?: boolean; sendAdmin?: boolean } = {}
) {
  const { sendUser = true, sendAdmin = true } = options;
  const mapping = TEMPLATE_MAP[product];

  if (!mapping) {
    console.error("[email] No TEMPLATE_MAP entry for product:", product);
    return;
  }

  console.log("[email] notifyBooking:", {
    product,
    mappingUserKey: mapping.user,
    mappingUserId: templateId(mapping.user),
    mappingAdminKey: mapping.admin,
    mappingAdminId: templateId(mapping.admin),
  });

  const tasks: Promise<any>[] = [];

  if (sendUser && mapping.user) {
    const userVars = { ...vars, ...buildUserVars(vars) }; // keep extras
    tasks.push(
      sendTemplate(mapping.user, userVars)
        .then(() => console.log(`✅ User email sent: ${mapping.user}`))
        .catch((e) =>
          console.error(`❌ User email failed: ${mapping.user}`, e)
        )
    );
  }

  if (sendAdmin && mapping.admin) {
    const adminVars = { ...vars, ...buildAdminVars(product, vars) }; // keep extras
    tasks.push(
      sendTemplate(mapping.admin, adminVars)
        .then(() => console.log(`✅ Admin email sent: ${mapping.admin}`))
        .catch((e) =>
          console.error(`❌ Admin email failed: ${mapping.admin}`, e)
        )
    );
  }

  await Promise.allSettled(tasks);
}

// ─────────────────────────────────────────────────────────────
// ✨ Final Welcome email helper (waits for Firestore firstName)
// ─────────────────────────────────────────────────────────────

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const toTitle = (s: string) =>
  s.replace(/\s+/g, " ").trim().replace(/(^|\s)\S/g, (c) =>
    c.toUpperCase()
  );
const nameFromEmail = (email?: string | null) => {
  if (!email) return "";
  const local = (email.split("@")[0] || "").replace(/[._-]+/g, " ");
  return toTitle(local);
};

export async function sendWelcome(vars: BookingVars = {}) {
  const auth = getAuth();
  const u = auth.currentUser;
  if (!u) {
    console.warn("[email] sendWelcome: no authenticated user");
    return;
  }

  const userRef = doc(db, "users", u.uid);
  let data: any = null;

  // Wait up to ~8 seconds for Firestore firstName to appear
  for (let attempt = 1; attempt <= 16; attempt++) {
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      data = snap.data();
      if (data?.emails?.welcomeSentAt) {
        console.log(
          "🔕 Welcome already sent at:",
          data.emails.welcomeSentAt
        );
        return;
      }
      if (data?.firstName) {
        console.log(
          `✅ Found firstName on attempt ${attempt}:`,
          data.firstName
        );
        break;
      }
    }
    console.log(
      `⏳ Waiting for Firestore profile (attempt ${attempt})...`
    );
    await sleep(500);
  }

  const resolvedEmail =
    vars.user_email || u.email || data?.email || "unknown@wedndone.com";

  const resolvedFirstName =
    vars.firstName ||
    data?.firstName ||
    (u.displayName ? (u.displayName.split(" ")[0] || "").trim() : "") ||
    nameFromEmail(resolvedEmail) ||
    "Friend";

  const payload: BookingVars = {
    ...vars,
    firstName: resolvedFirstName,
    dashboardUrl:
      vars.dashboardUrl ||
      `${window.location.origin}${import.meta.env.BASE_URL}dashboard`,
    user_email: resolvedEmail,
    userEmail: resolvedEmail,
  };

  console.log("[email] sendWelcome →", {
    templateKey: "WELCOME",
    templateId: EMAIL_TEMPLATES.WELCOME,
    to: payload.user_email,
    firstName: payload.firstName,
  });

  await sendTemplate("WELCOME", payload as Record<string, any>);
  console.log("✅ Welcome email sent successfully");

  try {
    await updateDoc(userRef, {
      "emails.welcomeSentAt": serverTimestamp(),
    });
  } catch (e) {
    console.warn("⚠️ Unable to mark welcomeSentAt:", e);
  }
}