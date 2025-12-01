// src/utils/finalizeGrooveGuidePdfOnly.ts
import { doc, updateDoc, arrayUnion, increment } from "firebase/firestore";
import emailjs from "@emailjs/browser";
import jsPDF from "jspdf";

import { db } from "../firebase/firebaseConfig";
import { uploadPdfBlob } from "../helpers/firebaseUtils";
import { generateGrooveGuidePDF, type GrooveGuideData } from "./generateGrooveGuidePDF";

/**
 * Finalizes a "Groove Guide PDF only" purchase:
 * - generates the PDF
 * - uploads it to Storage
 * - saves a basic purchase + doc record
 * - sends a *user-only* email via EmailJS
 * 
 * IMPORTANT: This does NOT set any bookings or lock wedding dates.
 */
export interface GrooveGuidePdfOnlyParams extends GrooveGuideData {
  uid: string;
  userEmail?: string | null;
  amountPaid: number; // dollars charged today
  emailTemplateId?: string; // optional override if you want
}

export const finalizeGrooveGuidePdfOnlyPurchase = async ({
  uid,
  fullName,
  weddingDate,
  selections,
  userEmail,
  amountPaid,
  emailTemplateId,
}: GrooveGuidePdfOnlyParams): Promise<{
  pdfUrl: string | null;
}> => {
  // 1) Generate the PDF blob
  let blob: Blob;
  try {
    blob = await generateGrooveGuidePDF({
      fullName,
      weddingDate,
      selections,
    });
  } catch (err) {
    console.error("❌ Failed to generate Groove Guide PDF:", err);
    throw err;
  }

  // 2) Upload to Storage under user_docs
  let pdfUrl: string | null = null;
  const ts = Date.now();
  const safeDate = weddingDate || "TBD";
  const fileName = `Groove_Guide_${safeDate}_${ts}.pdf`;
  const filePath = `user_docs/${uid}/${fileName}`;

  try {
    pdfUrl = await uploadPdfBlob(blob, filePath);
  } catch (err) {
    console.error("❌ Failed to upload Groove Guide PDF:", err);
    // We *still* continue, just without a docUrl
  }

  // 3) Save simple purchase + optional documents entry
  try {
    const userRef = doc(db, "users", uid);

    const updates: any = {
      purchases: arrayUnion({
        label: "Groove Guide PDF",
        category: "jamPdf", // distinct from full DJ booking
        amount: Number(amountPaid.toFixed(2)),
        date: new Date().toISOString(),
        weddingDate: weddingDate || null,
        docUrl: pdfUrl || null,
        source: "JamGroovePDFOnly",
      }),
      spendTotal: increment(Number(amountPaid.toFixed(2))),
      jamPdfOnly: true, // soft flag to detect "PDF-only but no jam booking"
    };

    if (pdfUrl) {
      updates.documents = arrayUnion({
        title: "Groove Guide PDF",
        url: pdfUrl,
        uploadedAt: new Date().toISOString(),
      });
    }

    await updateDoc(userRef, updates);
  } catch (err) {
    console.error("❌ Failed to update user doc for Groove Guide PDF:", err);
    // don’t throw here; user has already paid and got a PDF blob
  }

  // 4) Send *user-only* email with link to PDF
  try {
    const publicKey = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;

    // 🔧 Replace this with your dedicated PDF-only template ID
    const templateId =
      emailTemplateId || "template_a0y0zzp"; // TODO: swap for your real ID

    if (publicKey && userEmail && pdfUrl) {
      await emailjs.send(
        "service_xayel1i", // same service ID you’re using elsewhere
        templateId,
        {
          user_name: fullName || "Groove Guide Couple",
          user_email: userEmail,
          wedding_date: weddingDate || "TBD",
          pdf_url: pdfUrl,
          pdf_title: "Your Groove Guide",
          amount_paid: amountPaid.toFixed(2),
        },
        publicKey
      );
    } else {
      console.warn(
        "[GrooveGuide PDF] EmailJS not sent – missing publicKey, userEmail, or pdfUrl."
      );
    }
  } catch (err) {
    console.warn("⚠️ Groove Guide PDF user email failed:", err);
  }

  return { pdfUrl };
};