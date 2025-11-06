// src/utils/email/sendEmail.ts
import emailjs from "@emailjs/browser";

let inited = false;
function ensureInit() {
  if (!inited) {
    emailjs.init(import.meta.env.VITE_EMAILJS_PUBLIC_KEY);
    inited = true;
  }
}

export async function sendEmail(templateId: string, params: Record<string, any>) {
  ensureInit();
  const serviceId = "service_xayel1i"; // your EmailJS service id
  const pubKey = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;
  await emailjs.send(serviceId, templateId, params, pubKey);
}