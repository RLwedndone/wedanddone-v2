// src/utils/sendPixiePurchaseEmails.ts
import emailjs from "@emailjs/browser";

const SERVICE_ID = import.meta.env.VITE_EMAILJS_SERVICE_ID as string;
const PUBLIC_KEY = import.meta.env.VITE_EMAILJS_PUBLIC_KEY as string;

// tiny guard so we don't explode in dev if env vars are missing
function canSend() {
  return Boolean(SERVICE_ID && PUBLIC_KEY);
}

/**
 * 📨 User email – "You have a new Pixie Purchase"
 * Template: template_nxyi8l8
 * Fields:
 *  - firstName
 *  - user_email
 *  - dashboardUrl
 *  - pixie_label
 *  - pixie_amount
 */
export async function sendUserPixiePurchaseCreatedEmail(opts: {
  firstName: string;
  userEmail: string;
  dashboardUrl: string;
  pixieLabel: string;
  pixieAmount: number;
}) {
  if (!canSend()) {
    console.warn("[PixieEmails] Missing EmailJS env vars, skipping user email.");
    return;
  }

  const { firstName, userEmail, dashboardUrl, pixieLabel, pixieAmount } = opts;

  try {
    await emailjs.send(
      SERVICE_ID,
      "template_nxyi8l8",
      {
        firstName,
        user_email: userEmail,
        dashboardUrl,
        pixie_label: pixieLabel,
        pixie_amount: pixieAmount.toFixed(2),
      },
      PUBLIC_KEY
    );
  } catch (err) {
    console.warn("[PixieEmails] Failed to send user Pixie Purchase email:", err);
  }
}

/**
 * 📨 Admin email – "New Pixie Purchase – {{pixie_label}}"
 * Template: template_s5x09kt
 * Fields:
 *  - user_full_name
 *  - user_email
 *  - pixie_label
 *  - pixie_type
 *  - pixie_amount
 *  - created_at
 */
export async function sendAdminPixiePurchaseCreatedEmail(opts: {
  userFullName: string;
  userEmail: string;
  pixieLabel: string;
  pixieType: string;
  pixieAmount: number;
  createdAtPretty: string;
}) {
  if (!canSend()) {
    console.warn("[PixieEmails] Missing EmailJS env vars, skipping admin-created email.");
    return;
  }

  const {
    userFullName,
    userEmail,
    pixieLabel,
    pixieType,
    pixieAmount,
    createdAtPretty,
  } = opts;

  try {
    await emailjs.send(
      SERVICE_ID,
      "template_s5x09kt",
      {
        user_full_name: userFullName,
        user_email: userEmail,
        pixie_label: pixieLabel,
        pixie_type: pixieType,
        pixie_amount: pixieAmount.toFixed(2),
        created_at: createdAtPretty,
      },
      PUBLIC_KEY
    );
  } catch (err) {
    console.warn("[PixieEmails] Failed to send admin Pixie Purchase CREATED email:", err);
  }
}

/**
 * 📨 Admin email – "Pixie Purchase Paid – {{pixie_label}}"
 * Template: template_7vn22d2
 * Fields:
 *  - user_full_name
 *  - user_email
 *  - pixie_label
 *  - pixie_type
 *  - pixie_amount
 *  - paid_at
 *  - pdf_url
 */
export async function sendAdminPixiePurchasePaidEmail(opts: {
  userFullName: string;
  userEmail: string;
  pixieLabel: string;
  pixieType: string;
  pixieAmount: number;
  paidAtPretty: string;
  pdfUrl: string;
}) {
  if (!canSend()) {
    console.warn("[PixieEmails] Missing EmailJS env vars, skipping admin-paid email.");
    return;
  }

  const {
    userFullName,
    userEmail,
    pixieLabel,
    pixieType,
    pixieAmount,
    paidAtPretty,
    pdfUrl,
  } = opts;

  try {
    await emailjs.send(
      SERVICE_ID,
      "template_7vn22d2",
      {
        user_full_name: userFullName,
        user_email: userEmail,
        pixie_label: pixieLabel,
        pixie_type: pixieType,
        pixie_amount: pixieAmount.toFixed(2),
        paid_at: paidAtPretty,
        pdf_url: pdfUrl,
      },
      PUBLIC_KEY
    );
  } catch (err) {
    console.warn("[PixieEmails] Failed to send admin Pixie Purchase PAID email:", err);
  }
}