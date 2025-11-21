// src/utils/email/sendEmail.ts
import emailjs from "@emailjs/browser";
import {
  EMAILJS_SERVICE_ID,
  EMAILJS_PUBLIC_KEY,
} from "../../config/emailjsConfig";

// Initialize once (safe no-op if already inited)
let initialized = false;
function ensureInit() {
  if (initialized) return;
  try {
    emailjs.init(EMAILJS_PUBLIC_KEY);
    initialized = true;
  } catch (err) {
    console.warn("EmailJS init skipped (non-browser environment).");
  }
}

export async function sendEmail(
  templateId: string,
  params: Record<string, any>
) {
  ensureInit();

  if (!EMAILJS_PUBLIC_KEY) {
    console.error("❌ Missing EmailJS public key");
    throw new Error("Missing EmailJS public key");
  }

  return emailjs.send(
    EMAILJS_SERVICE_ID,
    templateId,
    params,
    EMAILJS_PUBLIC_KEY
  );
}