// src/utils/generateVicVerradoAgreementPDF.ts
import jsPDF from "jspdf";

/* ---------- Layout ---------- */
const MARGIN_X = 20;
const TOP_Y = 20;
const FOOTER_Y = 278;
const LINE_GAP = 8;
const PARA_GAP = 10;

const SIG_IMG_H = 30;
const SIG_BLOCK_H = 5 + SIG_IMG_H + 7 + 7;

/* ---------- Helpers ---------- */
function addFooter(doc: jsPDF) {
  doc.setDrawColor(200);
  doc.line(MARGIN_X, FOOTER_Y - 8, 190, FOOTER_Y - 8);
  doc.setFontSize(10);
  doc.setTextColor(120);
  doc.text("Magically booked by Wed&Done", 105, FOOTER_Y, { align: "center" });
}

function ensureSpace(doc: jsPDF, y: number, needed = 12): number {
  if (y + needed > FOOTER_Y - 12) {
    addFooter(doc);
    doc.addPage();
    return TOP_Y;
  }
  return y;
}

function toPrettyDate(input: string) {
  const ymd = /^\d{4}-\d{2}-\d{2}$/;
  let d: Date | null = null;

  if (ymd.test(input)) d = new Date(`${input}T12:00:00`);
  else {
    const tryDate = new Date(input);
    if (!isNaN(tryDate.getTime())) d = tryDate;
  }
  if (!d) return input;

  const month = d.toLocaleString("en-US", { month: "long" });
  const day = d.getDate();
  const year = d.getFullYear();
  const ord =
    day >= 11 && day <= 13
      ? "th"
      : day % 10 === 1
      ? "st"
      : day % 10 === 2
      ? "nd"
      : day % 10 === 3
      ? "rd"
      : "th";
  return `${month} ${day}${ord}, ${year}`;
}

function addDays(d: Date, days: number) {
  return new Date(d.getTime() + days * 24 * 60 * 60 * 1000);
}

const loadImage = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });

/* ---------- Types ---------- */
interface VicVerradoPDFOptions {
  venueName?: "The Vic" | "The Verrado"; // NEW (optional but recommended)
  fullName: string;
  total: number;
  /** dollars: include when user chose monthly plan; 0 or omit for pay-in-full */
  deposit?: number;
  guestCount: number;
  weddingDate: string;
  signatureImageUrl: string;
  paymentSummary: string;
  lineItems?: string[];
  /** Preferred: one of the package names */
  flowerTier?: "Sunflower" | "Rose" | "Lily" | "Dahlia";
  /** Back-compat alias (free-form). If both are provided, flowerTier wins. */
  tierLabel?: string;
  selections: {
    hors?: string[];
    salads?: string[];
    entrees?: string[];
    starch?: string[];      // canonical
    veg?: string[];         // canonical
    starches?: string[];    // alias accepted but normalized
    vegetables?: string[];  // alias accepted but normalized
  };
}

/* ---------- Main ---------- */
const generateVicVerradoAgreementPDF = async ({
  venueName,
  fullName,
  total,
  deposit = 0,
  guestCount,
  weddingDate,
  signatureImageUrl,
  paymentSummary,
  lineItems = [],
  flowerTier,
  tierLabel,
  selections,
}: VicVerradoPDFOptions): Promise<Blob> => {
  const doc = new jsPDF();

  // Normalize package label
  const tier = (typeof flowerTier === "string" && flowerTier) || tierLabel || "";

  // Normalize menu selections (support aliases)
  const s = selections || {};
  const hors    = s.hors ?? [];
  const salads  = s.salads ?? [];
  const entrees = s.entrees ?? [];
  const starch  = (s.starch ?? s.starches) ?? [];
  const veg     = (s.veg ?? s.vegetables) ?? [];

  // Images
  const [logo, lock] = await Promise.all([
    loadImage("/assets/images/rainbow_logo.jpg"),
    loadImage("/assets/images/lock_grey.jpg"),
  ]);

  // Watermark + logo
  doc.addImage(lock, "JPEG", 40, 60, 130, 130);
  doc.addImage(logo, "JPEG", 75, 10, 60, 60);

  // Title
  doc.setFont("helvetica", "normal");
  doc.setFontSize(16);
  doc.setTextColor(0);
  doc.text(
    `Catering Agreement & Receipt — ${tier || "Package"} Tier`,
    105,
    75,
    { align: "center" }
  );

  const prettyWedding = toPrettyDate(weddingDate);
  const todayPretty = toPrettyDate(new Date().toISOString());

  // due-by = wedding - 35 days (if parseable)
  let dueByPretty = "";
  const ymd = /^\d{4}-\d{2}-\d{2}$/;
  if (ymd.test(weddingDate)) {
    const d = new Date(`${weddingDate}T12:00:00`);
    const dueBy = addDays(d, -35);
    dueByPretty = toPrettyDate(dueBy.toISOString());
  }

  // Header basics
  doc.setFontSize(12);
  let y = 90;
  doc.text(`Name: ${fullName}`, MARGIN_X, y); y += LINE_GAP;
  doc.text(`Wedding Date: ${prettyWedding}`, MARGIN_X, y); y += LINE_GAP;
  if (tier) { doc.text(`Selected Tier: ${tier}`, MARGIN_X, y); y += LINE_GAP; }
  if (venueName) { doc.text(`Venue: ${venueName}`, MARGIN_X, y); y += LINE_GAP; }
  doc.text(`Guest Count: ${guestCount}`, MARGIN_X, y); y += LINE_GAP;
  y += LINE_GAP;

  // Included items
  if (lineItems.length || hors.length || salads.length || entrees.length || starch.length || veg.length) {
    y = ensureSpace(doc, y, PARA_GAP + LINE_GAP);
    doc.setFontSize(14);
    doc.text("Included Items:", MARGIN_X, y);
    y += PARA_GAP;
    doc.setFontSize(12);

    for (const item of lineItems) {
      const lines = doc.splitTextToSize(`• ${item}`, 170);
      for (const ln of lines) {
        y = ensureSpace(doc, y, LINE_GAP);
        doc.text(ln, MARGIN_X + 5, y);
        y += LINE_GAP;
      }
    }

    const section = (label: string, items?: string[]) => {
      if (!items || !items.length) return;
      y = ensureSpace(doc, y, LINE_GAP);
      doc.text(`${label}:`, MARGIN_X + 5, y);
      y += LINE_GAP;
      for (const it of items) {
        const lines = doc.splitTextToSize(`- ${it}`, 165);
        for (const ln of lines) {
          y = ensureSpace(doc, y, LINE_GAP);
          doc.text(ln, MARGIN_X + 10, y);
          y += LINE_GAP;
        }
      }
    };

    section("Hors d'oeuvres", hors);
    section("Salad", salads);
    section("Entrées", entrees);
    section("Starch", starch);
    section("Vegetable", veg);
  }

  // Payment summary section
  y += PARA_GAP;
  y = ensureSpace(doc, y, LINE_GAP * 4 + PARA_GAP);
  doc.setTextColor(0);
  doc.setFontSize(12);
  doc.text("Payment Summary:", MARGIN_X, y);
  y += LINE_GAP;

  const humanLines = doc.splitTextToSize(paymentSummary, 170);
  for (const ln of humanLines) {
    y = ensureSpace(doc, y, LINE_GAP);
    doc.text(ln, MARGIN_X + 5, y);
    y += LINE_GAP;
  }

  if (deposit > 0 && deposit < total) {
    doc.text(`Deposit Paid Today: $${deposit.toFixed(2)}`, MARGIN_X + 5, y); y += LINE_GAP;
    if (dueByPretty) {
      doc.text(`Remaining balance due by: ${dueByPretty}`, MARGIN_X + 5, y); y += LINE_GAP;
    }
  } else {
    doc.text(`Total Paid in Full Today: $${total.toFixed(2)}`, MARGIN_X + 5, y); y += LINE_GAP;
  }
  doc.text(`Date Paid: ${todayPretty}`, MARGIN_X + 5, y);
  y += PARA_GAP;

  // Venue-specific reminder (matches contract banner)
  {
    const banner = `Reminder: Your catering selections count toward the $8,000 food & beverage minimum at ${venueName || "the venue"}. Alcohol and bar packages are booked directly with ${venueName || "the venue"} in accordance with Arizona liquor laws.`;
    const lines = doc.splitTextToSize(banner, 170);
    for (const ln of lines) {
      y = ensureSpace(doc, y, LINE_GAP);
      doc.text(ln, MARGIN_X, y);
      y += LINE_GAP;
    }
    y += 4;
  }

  // Agreement terms — EXACT wording from the contract screen
  const writeParagraph = (title: string, text: string) => {
    y = ensureSpace(doc, y, PARA_GAP);
    doc.setFontSize(13);
    doc.text(title, MARGIN_X, y);
    y += LINE_GAP;
    doc.setFontSize(12);
    const lines = doc.splitTextToSize(text, 170);
    for (const ln of lines) {
      y = ensureSpace(doc, y, LINE_GAP);
      doc.text(ln, MARGIN_X, y);
      y += LINE_GAP;
    }
    y += 2;
  };

  // Key terms (as shown on screen)
  writeParagraph(
    "Key terms",
    `Final balance due by ${dueByPretty || "TBD"} (35 days before your wedding). Choose pay in full, or 25% deposit now + monthly installments until the due date. Final guest counts lock 30 days before your wedding.`
  );

  // Agreement terms (verbatim to the contract screen)
  writeParagraph(
    "Cancellation & refunds",
    "A minimum of 25% of the catering total is non-refundable. If you cancel more than 30 days prior to your wedding, amounts paid beyond the non-refundable portion will be refunded less any non-recoverable costs already incurred. If you cancel within 30 days, all payments are non-refundable. Reschedules are subject to availability and any difference in costs."
  );

  writeParagraph(
    "Payments & default",
    "Missed installments will be automatically re-attempted. If payment is not received within 7 days, a $25 late fee may apply; after 14 days, services may be suspended and the agreement may be placed in default."
  );

  writeParagraph(
    "Substitutions & liability",
    "Comparable substitutions may be made if an item is unavailable. Wed&Done is not responsible for venue restrictions, undisclosed allergies, or consequential damages. Liability is limited to amounts paid for catering services under this agreement."
  );

  writeParagraph(
    "Force majeure",
    "Neither party is liable for failure or delay caused by events beyond reasonable control. We’ll work in good faith to reschedule; if that’s not possible, amounts paid beyond non-recoverable costs will be refunded."
  );

  // Signature block (end of doc)
  if (y + SIG_BLOCK_H > FOOTER_Y - 12) {
    addFooter(doc);
    doc.addPage();
    y = TOP_Y;
  }

  const sigTop = FOOTER_Y - 10 - SIG_BLOCK_H;
  doc.setTextColor(0);
  doc.setFontSize(12);
  doc.text("Signature", MARGIN_X, sigTop);

  try {
    if (signatureImageUrl) {
      doc.addImage(signatureImageUrl, "PNG", MARGIN_X, sigTop + 5, 80, SIG_IMG_H);
    }
  } catch (err) {
    console.error("❌ Failed to add signature image:", err);
  }

  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Signed by: ${fullName}`, MARGIN_X, sigTop + 5 + SIG_IMG_H + 12);
  doc.text(`Signature date: ${todayPretty}`, MARGIN_X, sigTop + 5 + SIG_IMG_H + 19);

  addFooter(doc);
  return doc.output("blob");
};

export default generateVicVerradoAgreementPDF;