// src/utils/email/maybeSendBookingEmails.ts
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../firebase/firebaseConfig";
import { sendEmail } from "./sendEmail";

type Boutique = "venue" | "photography" | "floral" | "planner" | "catering" | "desserts" | "jam";

type BookingEmailPayload = {
  uid: string;
  user_email: string;
  firstName: string;
  dashboardUrl: string;

  // optional, include when you have them (used by some templates)
  pdf_url?: string;
  pdf_title?: string;
  wedding_date?: string;
  total?: string;
  line_items?: string;
  payment_now?: string;
  remaining_balance?: string;
  final_due?: string;
};

const USER_TEMPLATE_MAP: Record<Boutique, string> = {
  venue:       "template_venue_confirm",
  photography: "template_photo_confirm",
  floral:      "template_floral_confirm",
  planner:     "template_planner_confirm",
  catering:    "template_catering_confirm",
  desserts:    "template_dessert_confirm",
  jam:         "template_jam_confirm",
};

const ADMIN_TEMPLATE_MAP: Record<Boutique, string> = {
  venue:       "template_admin_venue_alert",
  photography: "template_admin_photo_alert",
  floral:      "template_admin_floral_alert",
  planner:     "template_admin_planner_alert",
  catering:    "template_admin_catering_alert",
  desserts:    "template_admin_dessert_alert",
  jam:         "template_admin_jam_alert",
};

// Flag path: notifications.sent.<boutique>
export async function maybeSendBookingEmails(
  boutique: Boutique,
  payload: BookingEmailPayload
) {
  const userRef = doc(db, "users", payload.uid);
  const snap = await getDoc(userRef);
  const data = snap.data() || {};
  const sentPath = ["notifications","sent",boutique].join(".");

  // If already sent, bail
  if (data?.notifications?.sent?.[boutique]) return;

  // Send user email
  await sendEmail(USER_TEMPLATE_MAP[boutique], {
    ...payload,
  });

  // Send admin email (PDF link is ideal; if not yet available, pass what you have)
  await sendEmail(ADMIN_TEMPLATE_MAP[boutique], {
    ...payload,
  });

  // Mark as sent (idempotency guard)
  await updateDoc(userRef, {
    [sentPath]: serverTimestamp(),
  });
}