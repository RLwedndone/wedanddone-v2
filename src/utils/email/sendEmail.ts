// src/utils/email/sendEmail.ts
import emailjs from "@emailjs/browser";

export async function sendEmail(templateId: string, params: Record<string, any>) {
  const serviceId = "service_xayel1i"; // your EmailJS service id
  const pubKey = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;

  if (!pubKey) {
    console.error("❌ Missing EmailJS public key");
    throw new Error("Missing EmailJS public key");
  }

  return emailjs.send(serviceId, templateId, params, pubKey);
}