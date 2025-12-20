import jsPDF from "jspdf";

// ---------- Layout ----------
const MARGIN_X = 20;
const TOP_Y = 20;
const FOOTER_Y = 278; // ~10mm above page bottom
const LINE_GAP = 8;
const PARA_GAP = 10;

// Signature block sizes
const SIG_BLOCK_H = 5 /*label*/ + 40 /*sig img*/ + 7 /*caption lines*/ + 7;

// ---------- Helpers ----------
function addFooter(doc: jsPDF) {
  doc.setDrawColor(200);
  doc.line(MARGIN_X, FOOTER_Y - 8, 190, FOOTER_Y - 8);
  doc.setFontSize(10);
  doc.setTextColor(120);
  doc.text("Magically booked by Wed&Done", 105, FOOTER_Y, { align: "center" });
}

function resetBodyTextStyle(doc: jsPDF, size: number = 12) {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(size);
  doc.setTextColor(0);
}

function ensureSpace(doc: jsPDF, y: number, needed = 12): number {
  if (y + needed > FOOTER_Y - 12) {
    addFooter(doc);
    doc.addPage();
    resetBodyTextStyle(doc, 12);
    return TOP_Y;
  }
  return y;
}

// Parse YYYY-MM-DD safely (local noon); if it's already a pretty string, return as-is
function toPrettyDate(input: string) {
  const ymd = /^\d{4}-\d{2}-\d{2}$/;
  let d: Date | null = null;

  if (ymd.test(input)) {
    d = new Date(`${input}T12:00:00`); // avoid TZ off-by-one
  } else {
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

// Load local images safely
const loadImage = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });

const money = (n: number) =>
  Number(n || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

// ---------- Types ----------
interface PDFOptions {
  fullName: string;
  total: number;
  deposit: number; // dollars (0 means pay-in-full)
  guestCount: number;
  charcuterieCount: number;
  weddingDate: string; // YYYY-MM-DD preferred or already-pretty
  signatureImageUrl: string;
  paymentSummary: string;

  // Optional
  cuisineType?: string;
  lineItems?: string[];

  // Optional + flexible (so checkout/contract don’t explode)
  menuSelections?: {
    appetizers?: string[];
    mains?: string[];
    sides?: string[];
    salads?: string[];
  };
}

// ---------- Main ----------
const generateYumAgreementPDF = async ({
  fullName,
  total,
  deposit,
  guestCount,
  charcuterieCount,
  weddingDate,
  signatureImageUrl,
  paymentSummary,
  cuisineType,
  lineItems = [],
  menuSelections = {},
}: PDFOptions): Promise<Blob> => {
  const doc = new jsPDF();

  // Images
  const [logo, lock] = await Promise.all([
    loadImage(`${import.meta.env.BASE_URL}assets/images/rainbow_logo.jpg`),
    loadImage(`${import.meta.env.BASE_URL}assets/images/lock_grey.jpg`),
  ]);

  // Watermark + logo
  doc.addImage(lock, "JPEG", 40, 60, 130, 130);
  doc.addImage(logo, "JPEG", 75, 10, 60, 60);

  // Title
  resetBodyTextStyle(doc, 16);
  doc.text("Yum Yum Catering Agreement & Receipt", 105, 75, { align: "center" });

  // Pretty dates
  const prettyWedding = toPrettyDate(weddingDate);
  const todayPretty = toPrettyDate(new Date().toISOString());

  // Compute due-by = wedding - 35 days (if parseable)
  let dueByPretty = "";
  const ymd = /^\d{4}-\d{2}-\d{2}$/;
  if (ymd.test(weddingDate)) {
    const d = new Date(`${weddingDate}T12:00:00`);
    const dueBy = addDays(d, -35);
    dueByPretty = toPrettyDate(dueBy.toISOString());
  }

  // Basics
  resetBodyTextStyle(doc, 12);
  let y = 90;

  doc.text(`Name: ${fullName}`, MARGIN_X, y);
  y += LINE_GAP;

  doc.text(`Wedding Date: ${prettyWedding}`, MARGIN_X, y);
  y += LINE_GAP;

  if (cuisineType) {
    doc.text(`Cuisine Selected: ${cuisineType}`, MARGIN_X, y);
    y += LINE_GAP;
  }

  doc.text(`Guest Count: ${guestCount}`, MARGIN_X, y);
  y += LINE_GAP;

  if (charcuterieCount > 0) {
    doc.text(`Charcuterie Boards: ${charcuterieCount}`, MARGIN_X, y);
    y += LINE_GAP;
  }

  y += LINE_GAP;

  // ---------- Included Items ----------
  const hasAnyMenu =
    (menuSelections.appetizers?.length || 0) +
      (menuSelections.mains?.length || 0) +
      (menuSelections.sides?.length || 0) +
      (menuSelections.salads?.length || 0) >
    0;

  if ((lineItems?.length || 0) > 0 || hasAnyMenu) {
    y = ensureSpace(doc, y, PARA_GAP + LINE_GAP);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(0);
    doc.text("Included Items:", MARGIN_X, y);
    y += PARA_GAP;

    resetBodyTextStyle(doc, 12);

    // flat lineItems (this is where we’ll inject platters)
    for (const item of lineItems) {
      const lines = doc.splitTextToSize(`• ${item}`, 170);
      for (const ln of lines) {
        y = ensureSpace(doc, y, LINE_GAP);
        doc.text(ln, MARGIN_X + 5, y);
        y += LINE_GAP;
      }
    }

    const section = (label: string, items?: string[]) => {
      if (!items || items.length === 0) return;

      y = ensureSpace(doc, y, LINE_GAP);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(0);
      doc.text(`${label}:`, MARGIN_X + 5, y);
      y += LINE_GAP;

      resetBodyTextStyle(doc, 12);
      for (const it of items) {
        const lines = doc.splitTextToSize(`- ${it}`, 165);
        for (const ln of lines) {
          y = ensureSpace(doc, y, LINE_GAP);
          doc.text(ln, MARGIN_X + 10, y);
          y += LINE_GAP;
        }
      }
    };

    section("Appetizers", menuSelections.appetizers);
    section("Main Courses", menuSelections.mains);
    section("Sides", menuSelections.sides);
    section("Salads", menuSelections.salads);
  }

  // ---------- Payment summary ----------
  y += PARA_GAP;
  y = ensureSpace(doc, y, LINE_GAP * 4 + PARA_GAP);

  resetBodyTextStyle(doc, 12);
  doc.text("Payment Summary:", MARGIN_X, y);
  y += LINE_GAP;

  if (paymentSummary && paymentSummary.trim()) {
    const humanLines = doc.splitTextToSize(paymentSummary, 170);
    for (const ln of humanLines) {
      y = ensureSpace(doc, y, LINE_GAP);
      doc.text(ln, MARGIN_X + 5, y);
      y += LINE_GAP;
    }
  }

  if (deposit > 0 && deposit < total) {
    y = ensureSpace(doc, y, LINE_GAP * 2);
    doc.text(`Deposit Paid Today: $${money(deposit)}`, MARGIN_X + 5, y);
    y += LINE_GAP;

    if (dueByPretty) {
      doc.text(`Remaining balance due by: ${dueByPretty}`, MARGIN_X + 5, y);
      y += LINE_GAP;
    } else {
      doc.text("Remaining balance due 35 days before your wedding date.", MARGIN_X + 5, y);
      y += LINE_GAP;
    }
  } else {
    y = ensureSpace(doc, y, LINE_GAP);
    doc.text(`Total Paid in Full Today: $${money(total)}`, MARGIN_X + 5, y);
    y += LINE_GAP;
  }

  y = ensureSpace(doc, y, LINE_GAP);
  doc.text(`Date Paid: ${todayPretty}`, MARGIN_X + 5, y);
  y += PARA_GAP;

  // ---------- Booking Terms ----------
  y = ensureSpace(doc, y, LINE_GAP + PARA_GAP);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(0);
  doc.text("Booking Terms", MARGIN_X, y);
  y += PARA_GAP;

  resetBodyTextStyle(doc, 12);

  const bookingBullets: string[] = [
    "By signing, you confirm either (a) your venue allows outside caterers, or (b) you’ll book a venue that does.",
    "Payment Options: You may pay in full today, or place a 25% non-refundable deposit. Any remaining balance will be split into monthly installments so that your total catering amount is paid in full 35 days before your wedding date. Any unpaid balance on that date will be automatically charged.",
    "Card Authorization & Saved Card: By completing this purchase, you authorize Wed&Done and our payment processor (Stripe) to securely store your card for catering installment payments, any remaining catering balance due under this agreement, and future Wed&Done bookings you choose to make, for your convenience. Your card details are encrypted and handled by Stripe, and you can update or replace your saved card at any time through your Wed&Done account.",
    "Your reception will be served buffet-style.",
    "Final guest count is due 30 days before your wedding. You may increase your guest count starting 45 days before your wedding, but the count cannot be lowered after booking.",
    "Cancellation & Refunds: If you cancel more than 35 days prior, amounts paid beyond the non-recoverable portion will be refunded less any non-recoverable costs already incurred. Within 35 days, all payments are non-refundable.",
    "Missed Payments: We’ll automatically retry your card. After 7 days, a $25 late fee applies; after 14 days, services may be suspended and this agreement may be in default.",
    "Food Safety & Venue Policies: We’ll follow standard food-safety guidelines and comply with venue rules, which may limit service or display options.",
    "Force Majeure: Neither party is liable for delays beyond reasonable control. We’ll work in good faith to reschedule; if not possible, we’ll refund amounts paid beyond non-recoverable costs already incurred.",
    "In the unlikely event of our cancellation or issue, liability is limited to a refund of payments made.",
  ];

  for (const b of bookingBullets) {
    const lines = doc.splitTextToSize(`• ${b}`, 170);
    for (const ln of lines) {
      y = ensureSpace(doc, y, LINE_GAP);
      doc.text(ln, MARGIN_X, y);
      y += LINE_GAP;
    }
    y += 2;
  }

  resetBodyTextStyle(doc, 12);

  // ---------- Signature ----------
  if (y + SIG_BLOCK_H > FOOTER_Y - 12) {
    addFooter(doc);
    doc.addPage();
    resetBodyTextStyle(doc, 12);
    y = TOP_Y;
  }

  const sigTop = FOOTER_Y - 10 - SIG_BLOCK_H;
  doc.text("Signature", MARGIN_X, sigTop);

  const detectFormat = (url: string): "PNG" | "JPEG" | undefined => {
    if (!url) return undefined;
    if (url.startsWith("data:image/png")) return "PNG";
    if (url.startsWith("data:image/jpeg") || url.startsWith("data:image/jpg"))
      return "JPEG";
    return undefined;
  };

  try {
    if (signatureImageUrl) {
      const sigW = 100;
      const sigH = 40;
      const fmt = detectFormat(signatureImageUrl);

      if (signatureImageUrl.startsWith("data:")) {
        doc.addImage(signatureImageUrl, (fmt as any) || "PNG", MARGIN_X, sigTop + 5, sigW, sigH);
      } else {
        const img = await (async () => {
          try {
            return await loadImage(signatureImageUrl);
          } catch {
            return null;
          }
        })();
        if (img) {
          doc.addImage(img, "PNG", MARGIN_X, sigTop + 5, sigW, sigH);
        } else {
          console.warn("⚠️ Could not load signature image; leaving signature area blank.");
        }
      }
    }
  } catch (err) {
    console.error("❌ Failed to add signature image:", err);
  }

  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Signed by: ${fullName}`, MARGIN_X, sigTop + 5 + 40 + 12);
  doc.text(`Signature date: ${todayPretty}`, MARGIN_X, sigTop + 5 + 40 + 19);

  addFooter(doc);
  return doc.output("blob");
};

export default generateYumAgreementPDF;