// src/utils/generateEncanterraAgreementPDF.ts
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
    // reset body styling on new page so we never inherit grey footer text
    doc.setFontSize(12);
    doc.setTextColor(0);
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

/* ---------- Types (Encanterra) ---------- */
interface EncanterraPDFOptions {
  venueName?: string; // defaults to "Encanterra" in title area if omitted
  fullName: string;
  total: number;
  /** dollars: include when user chose monthly plan; 0 or omit for pay-in-full */
  deposit?: number;
  guestCount: number;
  weddingDate: string;
  signatureImageUrl: string;
  paymentSummary: string;
  lineItems?: string[];

  /** Preferred: diamond tier name (shown on title line) */
  diamondTier?: "1 Carat" | "2 Carat" | "3 Carat";
  /** Back-compat alias (free-form). If both are provided, diamondTier wins. */
  tierLabel?: string;

  selections: {
    hors?: string[];
    salads?: string[];
    entrees?: string[];
    /** canonical for Encanterra */
    sides?: string[];
    /** accepted aliases (normalized to sides) */
    accompaniments?: string[];
    starch?: string[];
    veg?: string[];
    starches?: string[];
    vegetables?: string[];
  };
}

/* ---------- Main ---------- */
const generateEncanterraAgreementPDF = async ({
  venueName,
  fullName,
  total,
  deposit = 0,
  guestCount,
  weddingDate,
  signatureImageUrl,
  paymentSummary,
  lineItems = [],
  diamondTier,
  tierLabel,
  selections,
}: EncanterraPDFOptions): Promise<Blob> => {
  const doc = new jsPDF();

  // Normalize package label
  const tier =
    (typeof diamondTier === "string" && diamondTier) || tierLabel || "Package";

  // Normalize menu selections (support aliases)
  const s = selections || {};
  const hors = s.hors ?? [];
  const salads = s.salads ?? [];
  const entrees = s.entrees ?? [];
  const sides =
    s.sides ??
    s.accompaniments ??
    s.starch ??
    s.starches ??
    s.veg ??
    s.vegetables ??
    [];

  // Images (1st page only – watermark + logo)
  const [logo, lock] = await Promise.all([
    loadImage(`${import.meta.env.BASE_URL}assets/images/rainbow_logo.jpg`),
    loadImage(`${import.meta.env.BASE_URL}assets/images/lock_grey.jpg`),
  ]);

  // watermark only on page 1
  doc.addImage(lock, "JPEG", 40, 60, 130, 130);
  doc.addImage(logo, "JPEG", 75, 10, 60, 60);

  // Title
  doc.setFont("helvetica", "normal");
  doc.setFontSize(16);
  doc.setTextColor(0);
  doc.text(`Catering Agreement & Receipt — ${tier} Tier`, 105, 75, {
    align: "center",
  });

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
  doc.setTextColor(0);
  let y = 90;
  doc.text(`Name: ${fullName}`, MARGIN_X, y);
  y += LINE_GAP;
  doc.text(`Wedding Date: ${prettyWedding}`, MARGIN_X, y);
  y += LINE_GAP;
  if (tier) {
    doc.text(`Selected Tier: ${tier}`, MARGIN_X, y);
    y += LINE_GAP;
  }
  if (venueName) {
    doc.text(`Venue: ${venueName}`, MARGIN_X, y);
    y += LINE_GAP;
  }
  doc.text(`Guest Count: ${guestCount}`, MARGIN_X, y);
  y += LINE_GAP;
  y += LINE_GAP;

  // Included items
  if (
    lineItems.length ||
    hors.length ||
    salads.length ||
    entrees.length ||
    sides.length
  ) {
    y = ensureSpace(doc, y, PARA_GAP + LINE_GAP);
    doc.setFontSize(14);
    doc.setTextColor(0);
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
    section("Sides", sides);
  }

  // ---------- Payment summary section (updated wording) ----------
  y += PARA_GAP;
  y = ensureSpace(doc, y, LINE_GAP * 4 + PARA_GAP);
  doc.setTextColor(0);
  doc.setFontSize(12);
  doc.text("Payment Summary:", MARGIN_X, y);
  y += LINE_GAP;

  const hasDepositPlan = deposit > 0 && deposit < total;
  const remaining = Math.max(0, total - deposit);

  const headline = hasDepositPlan
    ? `Deposit of $${deposit.toFixed(
        2
      )} paid today. Remaining balance of $${remaining.toFixed(
        2
      )} will be charged in monthly installments until ${
        dueByPretty || "35 days before your wedding date"
      }.`
    : `Paid in full today: $${Number(total).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}.`;

  // Always show the clear headline line first
  const headlineLines = doc.splitTextToSize(headline, 170);
  for (const ln of headlineLines) {
    y = ensureSpace(doc, y, LINE_GAP);
    doc.text(ln, MARGIN_X + 5, y);
    y += LINE_GAP;
  }

  // If caller passed extra detail, include it underneath
  const trimmedSummary = (paymentSummary || "").trim();
  if (trimmedSummary && trimmedSummary !== headline) {
    const humanLines = doc.splitTextToSize(trimmedSummary, 170);
    for (const ln of humanLines) {
      y = ensureSpace(doc, y, LINE_GAP);
      doc.text(ln, MARGIN_X + 5, y);
      y += LINE_GAP;
    }
  }

  // Additional explicit lines – reinforces deposit vs full
  if (hasDepositPlan) {
    doc.text(
      `Deposit Paid Today: $${Number(deposit).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`,
      MARGIN_X + 5,
      y
    );
    y += LINE_GAP;
    if (dueByPretty) {
      doc.text(
        `Remaining balance due by: ${dueByPretty}`,
        MARGIN_X + 5,
        y
      );
      y += LINE_GAP;
    }
  } else {
    doc.text(
      `Total Paid in Full Today: $${Number(total).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`,
      MARGIN_X + 5,
      y
    );
    y += LINE_GAP;
  }
  doc.text(`Date Paid: ${todayPretty}`, MARGIN_X + 5, y);
  y += PARA_GAP;

  // Venue-specific reminder (aligned with contract copy)
  {
    const v = venueName || "the venue";
    const banner =
      `Reminder: This catering agreement counts toward the food & beverage minimum at ${v}. ` +
      `Alcohol and bar packages are booked directly with ${v} in accordance with applicable liquor laws.`;
    const lines = doc.splitTextToSize(banner, 170);
    for (const ln of lines) {
      y = ensureSpace(doc, y, LINE_GAP);
      doc.text(ln, MARGIN_X, y);
      y += LINE_GAP;
    }
    y += 4;
  }

  // ---------- Agreement terms (black text) ----------
  const writeParagraph = (title: string, text: string) => {
    y = ensureSpace(doc, y, PARA_GAP);
    doc.setTextColor(0);
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

  writeParagraph(
    "Key terms",
    `Final balance is due by ${dueByPretty || "TBD"} (35 days before your wedding). ` +
      `You may pay in full today, or place a 25% non-refundable deposit now and pay the remaining balance in monthly installments ` +
      `so that your total catering amount is paid in full by that date. Any unpaid balance on that date will be automatically charged ` +
      `to your saved card. Final guest counts lock 30 days before your wedding. You may increase your guest count starting 45 days ` +
      `before your wedding, but it cannot be lowered after booking.`
  );

  writeParagraph(
    "Card authorization & saved card",
    "By completing this purchase, you authorize Wed&Done and our payment processor (Stripe) to securely store your card for Encanterra " +
      "catering installment payments and any remaining catering balance due under this agreement, as well as future Wed&Done bookings " +
      "you choose to make. Your card details are encrypted and handled by Stripe, and you can update or replace your saved card at any " +
      "time through your Wed&Done account."
  );

  writeParagraph(
    "Cancellation & refunds",
    "A minimum of 25% of the catering total is non-refundable. If you cancel more than 35 days prior to your wedding date, " +
      "amounts paid beyond the non-refundable portion will be refunded, less any non-recoverable costs already incurred. " +
      "If you cancel within 35 days of your wedding date, all payments are non-refundable. Reschedules are subject to availability " +
      "and any difference in costs."
  );

  writeParagraph(
    "Payments & default",
    "Missed installments will be automatically re-attempted. If payment is not received within 7 days, a $25 late fee may apply; " +
      "after 14 days, services may be suspended and the agreement may be placed in default."
  );

  writeParagraph(
    "Substitutions & liability",
    "Comparable substitutions may be made if an item is unavailable. Wed&Done is not responsible for venue restrictions, " +
      "undisclosed allergies, or consequential damages. Liability is limited to amounts paid for catering services under this agreement."
  );

  writeParagraph(
    "Force majeure",
    "Neither party is liable for failure or delay caused by events beyond reasonable control. We’ll work in good faith to reschedule; " +
      "if that’s not possible, amounts paid beyond non-recoverable costs will be refunded."
  );

  // ---------- Signature block ----------
  if (y + SIG_BLOCK_H > FOOTER_Y - 12) {
    addFooter(doc);
    doc.addPage();
    doc.setFontSize(12);
    doc.setTextColor(0);
    y = TOP_Y;
  }

  const sigTop = FOOTER_Y - 10 - SIG_BLOCK_H;
  doc.setTextColor(0);
  doc.setFontSize(12);
  doc.text("Signature", MARGIN_X, sigTop);

  // detect image format for safety
  const detectFormat = (url: string): "PNG" | "JPEG" | undefined => {
    if (!url) return undefined;
    if (url.startsWith("data:image/png")) return "PNG";
    if (url.startsWith("data:image/jpeg") || url.startsWith("data:image/jpg"))
      return "JPEG";
    return undefined;
  };

  try {
    if (signatureImageUrl) {
      const fmt = detectFormat(signatureImageUrl) || "PNG";
      doc.addImage(signatureImageUrl, fmt as any, MARGIN_X, sigTop + 5, 80, SIG_IMG_H);
    }
  } catch (err) {
    console.error("❌ Failed to add signature image:", err);
  }

  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Signed by: ${fullName}`, MARGIN_X, sigTop + 5 + SIG_IMG_H + 12);
  doc.text(
    `Signature date: ${todayPretty}`,
    MARGIN_X,
    sigTop + 5 + SIG_IMG_H + 19
  );

  addFooter(doc);
  return doc.output("blob");
};

export default generateEncanterraAgreementPDF;