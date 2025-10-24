// src/utils/sendAdminNotification.ts

import { addDoc, collection } from "firebase/firestore";
import { db } from "../firebase/firebaseConfig";

export const sendAdminNotification = async (subject: string, body: string) => {
  try {
    await addDoc(collection(db, "mails"), {
      to: "madge@wedanddone.com", // 💌 change this if needed later
      message: {
        subject,
        text: body,
        html: `<div>${body.replace(/\n/g, "<br>")}</div>`,
      },
    });
    console.log("📨 Admin notification sent!");
  } catch (error) {
    console.error("❌ Failed to send admin notification:", error);
  }
};