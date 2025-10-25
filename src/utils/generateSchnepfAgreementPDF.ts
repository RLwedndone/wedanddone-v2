// src/utils/generateSchnepfAgreementPDF.ts
import jsPDF from "jspdf";

/* ───────────────── layout ───────────────── */
const MARGIN_X = 20, TOP_Y = 20, FOOTER_Y = 278, LINE_GAP = 8, PARA_GAP = 10;
const SIG_IMG_H = 40;
const SIG_BLOCK_H = 5 + SIG_IMG_H + 19 + 10;
const FINAL_DUE_DAYS = 35;

/* ───────────────── helpers ───────────────── */
function addFooter(doc: jsPDF) {
  doc.setDrawColor(200);
  doc.line(MARGIN_X, FOOTER_Y - 8, 190, FOOTER_Y - 8);
  doc.setFontSize(10);
  doc.setTextColor(120);
  doc.text("Magically booked by Wed&Done", 105, FOOTER_Y, { align: "center" });
}
function ensureSpace(doc: jsPDF, y: number, needed = 12) {
  if (y + needed > FOOTER_Y - 12) { addFooter(doc); doc.addPage(); return TOP_Y; }
  return y;
}
function toPrettyDate(input: string) {
  const ymd = /^\d{4}-\d{2}-\d{2}$/; let d: Date | null = null;
  if (ymd.test(input)) d = new Date(`${input}T12:00:00`);
  else { const t = new Date(input); if (!isNaN(t.getTime())) d = t; }
  if (!d) return input;
  const m = d.toLocaleString("en-US", { month: "long" }), day = d.getDate(), y = d.getFullYear();
  const ord = day >= 11 && day <= 13 ? "th" : [,"st","nd","rd"][day % 10] ?? "th";
  return `${m} ${day}${ord}, ${y}`;
}
function addDays(d: Date, days: number) { return new Date(d.getTime() + days * 86400000); }
const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((res, rej) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = src;
  });

/* ───────────────── types ───────────────── */
export interface SchnepfPDFOptions {
  fullName: string;
  total: number;
  deposit: number;
  guestCount: number;
  weddingDate: string;
  signatureImageUrl: string;
  paymentSummary: string;
  lineItems?: string[];
  menuSelections?: {
    appetizers?: string[];
    mains?: string[];
    sides?: string[];
    salads?: string[];     // <-- add this
  };

  // Optional Schnepf-specific bits shown on the receipt
  cuisineName?: string;
  perGuest?: number;        // price per guest used in calc
  chefFee?: number;         // e.g. 200
  serviceFeePct?: number;   // e.g. 0.22 for 22%
  taxesAndFees?: number;    // combined taxes + fees number from cart
}

/* ───────────────── generator ───────────────── */
const generateSchnepfAgreementPDF = async ({
  fullName,
  total,
  deposit,
  guestCount,
  weddingDate,
  signatureImageUrl,
  paymentSummary,
  lineItems = [],
  menuSelections = {},
  cuisineName,
  perGuest,                 // ✅ match interface
  chefFee = 0,
  serviceFeePct,            // optional
  taxesAndFees = 0,
}: SchnepfPDFOptions): Promise<Blob> => {
  const doc = new jsPDF();

  // header art
  const [logo, lock] = await Promise.all([
    loadImage(`${import.meta.env.BASE_URL}assets/images/rainbow_logo.jpg`),
    loadImage(`${import.meta.env.BASE_URL}assets/images/lock_grey.jpg`),
  ]);
  doc.addImage(lock, "JPEG", 40, 60, 130, 130);
  doc.addImage(logo, "JPEG", 75, 10, 60, 60);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(16);
  doc.setTextColor(0);
  doc.text("Schnepf Farms Catering Agreement & Receipt", 105, 75, { align: "center" });

  const prettyWedding = toPrettyDate(weddingDate);
  const todayPretty = toPrettyDate(new Date().toISOString());

  // final due = wedding − 35 days
  let dueByPretty = "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(weddingDate)) {
    dueByPretty = toPrettyDate(addDays(new Date(`${weddingDate}T12:00:00`), -FINAL_DUE_DAYS).toISOString());
  }

  // basics
  doc.setFontSize(12);
  let y = 90;
  doc.text(`Name: ${fullName}`, MARGIN_X, y); y += LINE_GAP;
  doc.text(`Wedding Date: ${prettyWedding}`, MARGIN_X, y); y += LINE_GAP;
  if (cuisineName) { doc.text(`Cuisine: ${cuisineName}`, MARGIN_X, y); y += LINE_GAP; }
  doc.text(`Guest Count: ${guestCount}`, MARGIN_X, y); y += LINE_GAP + LINE_GAP;

  // selections / included
  if (
    lineItems.length ||
    menuSelections.appetizers?.length ||
    menuSelections.mains?.length ||
    menuSelections.sides?.length ||
    menuSelections.salads?.length      // <-- add this
  ) {
    y = ensureSpace(doc, y, PARA_GAP + LINE_GAP);
    doc.setFontSize(14); doc.text("Selections / Included:", MARGIN_X, y);
    y += PARA_GAP; doc.setFontSize(12);

    for (const item of lineItems) {
      for (const ln of doc.splitTextToSize(`• ${item}`, 170)) {
        y = ensureSpace(doc, y, LINE_GAP);
        doc.text(ln, MARGIN_X + 5, y);
        y += LINE_GAP;
      }
    }
    const section = (label: string, items?: string[]) => {
      if (!items?.length) return;
      y = ensureSpace(doc, y, LINE_GAP);
      doc.text(`${label}:`, MARGIN_X + 5, y); y += LINE_GAP;
      for (const it of items) {
        for (const ln of doc.splitTextToSize(`- ${it}`, 165)) {
          y = ensureSpace(doc, y, LINE_GAP);
          doc.text(ln, MARGIN_X + 10, y);
          y += LINE_GAP;
        }
      }
    };
    section("Appetizers", menuSelections.appetizers);
    section("Main Courses", menuSelections.mains);
    section("Salads", menuSelections.salads); 
    section("Sides", menuSelections.sides);
  }

  // pricing summary (explicit Schnepf lines)
  y += PARA_GAP;
  y = ensureSpace(doc, y, LINE_GAP * 4 + PARA_GAP);
  doc.setFontSize(14); doc.text("Pricing Summary:", MARGIN_X, y); y += PARA_GAP; doc.setFontSize(12);

  if (typeof perGuest === "number" && guestCount) {
    const foodSubtotal = perGuest * guestCount;
    doc.text(
      `Food subtotal (${guestCount} @ $${perGuest.toFixed(2)}/guest): $${foodSubtotal.toFixed(2)}`,
      MARGIN_X,
      y
    );
    y += LINE_GAP;
  }
  if (chefFee > 0) {
    doc.text(`Chef fee: $${chefFee.toFixed(2)}`, MARGIN_X, y); y += LINE_GAP;
  }
  if (taxesAndFees > 0) {
    doc.text(`Taxes & fees (incl. service/processing): $${taxesAndFees.toFixed(2)}`, MARGIN_X, y);
    y += LINE_GAP;
  }
  doc.text(`Total: $${total.toFixed(2)}`, MARGIN_X, y); y += LINE_GAP + 2;

  // payment summary
  doc.setFontSize(12);
  doc.text("Payment Summary:", MARGIN_X, y); y += LINE_GAP;
  for (const ln of doc.splitTextToSize(paymentSummary, 170)) {
    y = ensureSpace(doc, y, LINE_GAP);
    doc.text(ln, MARGIN_X + 5, y);
    y += LINE_GAP;
  }
  if (deposit > 0 && deposit < total) {
    doc.text(`Deposit Paid Today: $${deposit.toFixed(2)}`, MARGIN_X + 5, y); y += LINE_GAP;
    if (dueByPretty) {
      doc.text(`Remaining balance due by: ${dueByPretty}`, MARGIN_X + 5, y);
      y += LINE_GAP;
    }
  } else {
    doc.text(`Total Paid in Full Today: $${total.toFixed(2)}`, MARGIN_X + 5, y); y += LINE_GAP;
  }
  doc.text(`Date Paid: ${todayPretty}`, MARGIN_X + 5, y); y += PARA_GAP;

  // optional overview section (only if any provided)
  if (
    typeof perGuest !== "undefined" ||
    typeof chefFee !== "undefined" ||
    typeof serviceFeePct !== "undefined" ||
    typeof taxesAndFees !== "undefined" ||
    typeof cuisineName !== "undefined"
  ) {
    y += PARA_GAP;
    y = ensureSpace(doc, y, LINE_GAP * 6 + PARA_GAP);
    doc.setFontSize(12);
    doc.text("Pricing Overview:", MARGIN_X, y); y += LINE_GAP;

    if (cuisineName) {
      doc.text(`Cuisine: ${cuisineName}`, MARGIN_X + 5, y); y += LINE_GAP;
    }
    if (typeof perGuest !== "undefined") {
      doc.text(`Per-guest price used: $${perGuest.toFixed(2)}`, MARGIN_X + 5, y); y += LINE_GAP;
    }
    if (typeof chefFee !== "undefined" && chefFee > 0) {
      doc.text(`Chef fee applied: $${chefFee.toFixed(2)}`, MARGIN_X + 5, y); y += LINE_GAP;
    }
    if (typeof serviceFeePct !== "undefined") {
      doc.text(`Service fee: ${(serviceFeePct * 100).toFixed(0)}%`, MARGIN_X + 5, y); y += LINE_GAP;
    }
    if (typeof taxesAndFees !== "undefined") {
      doc.text(`Taxes & fees (combined): $${taxesAndFees.toFixed(2)}`, MARGIN_X + 5, y); y += LINE_GAP;
    }
  }

  /* ── Terms (brief) ── */
  const H = (title = "Terms") => {
    y = ensureSpace(doc, y, LINE_GAP + PARA_GAP);
    doc.setFont("helvetica", "bold"); doc.setFontSize(13);
    doc.text(title, MARGIN_X, y);
    doc.setFont("helvetica", "normal"); doc.setFontSize(12);
    y += 6;
  };
  const OL = (n: number, text: string) => {
    for (const ln of doc.splitTextToSize(`${n}. ${text}`, 170)) {
      y = ensureSpace(doc, y, LINE_GAP);
      doc.text(ln, MARGIN_X, y);
      y += LINE_GAP;
    }
    y += 2;
  };

  H();
  OL(1, "Payment. If you choose Deposit + Monthly, you authorize automatic monthly payments of the remaining balance until the final due date.");
  OL(2, `Final Due. The final payment is due ${FINAL_DUE_DAYS} days before your wedding date.`);
  OL(3, "Guest Count Policy. Final guest counts lock 30 days prior to the wedding. Updates are accepted between 45–30 days before your wedding.");
  OL(4, "Substitutions & Availability. Items may be substituted with comparable alternatives due to seasonality or supply constraints.");
  OL(5, "Allergies & Dietary Needs. Please notify Wed&Done of allergies or dietary needs at least 30 days in advance. Allergen-free environments are not guaranteed.");
  OL(6, "Force Majeure. Neither party is liable for delays or failures due to events beyond reasonable control; reasonable efforts will be made to reschedule or modify services.");

  // signature block
  if (y + SIG_BLOCK_H > FOOTER_Y - 12) { addFooter(doc); doc.addPage(); y = TOP_Y; }
  const sigTop = FOOTER_Y - 10 - SIG_BLOCK_H;
  doc.setTextColor(0); doc.setFontSize(12); doc.text("Signature", MARGIN_X, sigTop);

  const detectFmt = (url: string): "PNG" | "JPEG" | undefined =>
    url?.startsWith("data:image/png") ? "PNG" :
    (url?.startsWith("data:image/jpeg") || url?.startsWith("data:image/jpg")) ? "JPEG" : undefined;

  try {
    if (signatureImageUrl) {
      if (signatureImageUrl.startsWith("data:")) {
        doc.addImage(signatureImageUrl, detectFmt(signatureImageUrl) as any, MARGIN_X, sigTop + 5, 100, SIG_IMG_H);
      } else {
        const img = await loadImage(signatureImageUrl).catch(() => null as any);
        if (img) doc.addImage(img, "PNG", MARGIN_X, sigTop + 5, 100, SIG_IMG_H);
      }
    }
  } catch {}

  doc.setFontSize(10); doc.setTextColor(100);
  doc.text(`Signed by: ${fullName}`, MARGIN_X, sigTop + 5 + SIG_IMG_H + 12);
  doc.text(`Signature date: ${todayPretty}`, MARGIN_X, sigTop + 5 + SIG_IMG_H + 19);

  addFooter(doc);
  return doc.output("blob");
};

export default generateSchnepfAgreementPDF;