// src/utils/generateGuestDeltaReceiptPDF.ts
import jsPDF from "jspdf";

// AFTER (correct)
type PerGuest = {
  venue: number;
  catering: number;
  dessert: number;
  planner: number; // still tier diff (not per-guest)
};

type Amounts = {
  venue: number;
  catering: number;
  dessert: number;
  planner: number;
  subtotal: number;
  tax: number;        // sales tax portion
  stripeFee: number;  // Stripe fee portion
  total: number;
};

type Params = {
  fullName: string;
  weddingDate: string;
  oldCount: number;
  newCount: number;
  additionalGuests: number;
  perGuest: PerGuest;
  amounts: Amounts;
  notes?: string[];
};
/**
 * Builds a simple “Final Bill (Guest Count Update)” PDF and returns a Blob.
 */
export default async function generateGuestDeltaReceiptPDF({
  fullName,
  weddingDate,
  oldCount,
  newCount,
  additionalGuests,
  perGuest,
  amounts,
  notes = [],
}: Params): Promise<Blob> {
  const doc = new jsPDF({ unit: "pt" });
  let y = 60;

  const addH1 = (t: string) => { doc.setFont("helvetica", "bold"); doc.setFontSize(20); doc.text(t, 60, y); y += 24; };
  const addH2 = (t: string) => { doc.setFont("helvetica", "bold"); doc.setFontSize(14); doc.text(t, 60, y); y += 20; };
  const addP  = (t: string) => { doc.setFont("helvetica", "normal"); doc.setFontSize(12); doc.text(t, 60, y); y += 16; };
  const addRow = (label: string, value: string) => {
    doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.text(label, 60, y);
    doc.setFont("helvetica", "normal"); doc.text(value, 300, y); y += 16;
  };
  const addDivider = () => { doc.setDrawColor(230); doc.line(60, y, 540, y); y += 14; };

  addH1("Final Bill — Guest Count Update");
  addP(`Client: ${fullName}`);
  addP(`Wedding date: ${weddingDate}`);
  addDivider();

  addH2("Guest Count");
  addRow("Original guests", String(oldCount));
  addRow("New guests", String(newCount));
  addRow("Additional", `+${additionalGuests}`);
  addDivider();

  addH2("Per-Guest Rates (if applicable)");
  addRow("Venue (per guest)", `$${(perGuest.venue || 0).toFixed(2)}`);
  addRow("Catering (per guest)", `$${(perGuest.catering || 0).toFixed(2)}`);
  addRow("Dessert (per guest)", `$${(perGuest.dessert || 0).toFixed(2)}`);
  addRow("Planner (tier difference)", `$${(amounts.planner || 0).toFixed(2)}`);
  addDivider();

  addH2("Amounts Due Now");
  addRow("Venue subtotal", `$${(amounts.venue || 0).toFixed(2)}`);
  addRow("Catering subtotal", `$${(amounts.catering || 0).toFixed(2)}`);
  addRow("Dessert subtotal", `$${(amounts.dessert || 0).toFixed(2)}`);
  addRow("Planner tier difference", `$${(amounts.planner || 0).toFixed(2)}`);
  addRow("Subtotal", `$${(amounts.subtotal || 0).toFixed(2)}`);
  addRow("Taxes & fees", `$${((amounts.tax || 0) + (amounts.stripeFee || 0)).toFixed(2)}`);
  addRow("Total due now", `$${(amounts.total || 0).toFixed(2)}`);
  addDivider();

  if (notes.length) {
    addH2("Notes");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(12);
    for (const n of notes) {
      doc.text(`• ${n}`, 60, y);
      y += 16;
      if (y > 760) { doc.addPage(); y = 60; }
    }
  }

  return doc.output("blob");
}