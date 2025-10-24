import jsPDF from "jspdf";

// ---------- Layout ----------
const MARGIN_X = 20;
const TOP_Y = 20;
const FOOTER_Y = 278; // ~10mm above page bottom
const LINE_GAP = 8;
const PARA_GAP = 10;

// Signature block sizes
const SIG_IMG_H = 30;
const SIG_BLOCK_H = 5 /*label*/ + SIG_IMG_H + 7 /*caption lines*/ + 7;

// ---------- Helpers ----------
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

// Parse YYYY-MM-DD safely (local noon); if it's already a pretty string, return as-is
function toPrettyDate(input: string) {
  const ymd = /^\d{4}-\d{2}-\d{2}$/;
  let d: Date | null = null;

  if (ymd.test(input)) {
    d = new Date(`${input}T12:00:00`); // 🔒 avoid TZ off-by-one
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

// Add/subtract days
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

// ---------- Types ----------
interface PDFOptions {
  fullName: string;
  total: number;
  deposit: number; // dollars (0 means pay-in-full)
  guestCount: number;
  charcuterieCount: number;
  weddingDate: string; // can be YYYY-MM-DD or already pretty
  signatureImageUrl: string;
  paymentSummary: string; // human summary from the flow
  lineItems?: string[];
  menuSelections?: {
    appetizers?: string[];
    mains?: string[];
    sides?: string[];
  };
  cuisineType?: string;
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
  lineItems = [],
  cuisineType = "",
  menuSelections = {},
}: PDFOptions): Promise<Blob> => {
  const doc = new jsPDF();

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
  doc.setFontSize(12);
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

  // Included items
  if (
    (lineItems && lineItems.length > 0) ||
    (menuSelections.appetizers?.length ||
      menuSelections.mains?.length ||
      menuSelections.sides?.length)
  ) {
    y = ensureSpace(doc, y, PARA_GAP + LINE_GAP);
    doc.setFontSize(14);
    doc.text("Included Items:", MARGIN_X, y);
    y += PARA_GAP;
    doc.setFontSize(12);

    // flat lineItems
    for (const item of lineItems) {
      const lines = doc.splitTextToSize(`• ${item}`, 170);
      for (const ln of lines) {
        y = ensureSpace(doc, y, LINE_GAP);
        doc.text(ln, MARGIN_X + 5, y);
        y += LINE_GAP;
      }
    }

    // menu sections
    const section = (label: string, items?: string[]) => {
      if (!items || items.length === 0) return;
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

    section("Appetizers", menuSelections.appetizers);
    section("Main Courses", menuSelections.mains);
    section("Sides", menuSelections.sides);
  }

  // Payment summary block
  y += PARA_GAP;
  y = ensureSpace(doc, y, LINE_GAP * 4 + PARA_GAP);
  doc.setTextColor(0);
  doc.setFontSize(12);
  doc.text("Payment Summary:", MARGIN_X, y);
  y += LINE_GAP;

  // Show the human summary line from the flow
  const humanLines = doc.splitTextToSize(paymentSummary, 170);
  for (const ln of humanLines) {
    y = ensureSpace(doc, y, LINE_GAP);
    doc.text(ln, MARGIN_X + 5, y);
    y += LINE_GAP;
  }

  // Also show machine-calculated basics
  if (deposit > 0 && deposit < total) {
    doc.text(`Deposit Paid Today: $${deposit.toFixed(2)}`, MARGIN_X + 5, y);
    y += LINE_GAP;
    if (dueByPretty) {
      doc.text(`Remaining balance due by: ${dueByPretty}`, MARGIN_X + 5, y);
      y += LINE_GAP;
    }
  } else {
    doc.text(`Total Paid in Full Today: $${total.toFixed(2)}`, MARGIN_X + 5, y);
    y += LINE_GAP;
  }
  doc.text(`Date Paid: ${todayPretty}`, MARGIN_X + 5, y);
  y += PARA_GAP;

  // ---------- New: “Key Terms” bullets ----------
  const bullets = [
    `Final balance due by ${dueByPretty || "35 days before your wedding"}.`,
    `Payment options: pay in full today or 25% deposit + monthly installments until due date.`,
    `Final guest counts lock 30 days before your wedding (you can increase later, but cannot decrease below the booked count).`,
  ];

  const writeBullets = (items: string[]) => {
    y = ensureSpace(doc, y, LINE_GAP + PARA_GAP);
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text("Key Terms", MARGIN_X, y);
    doc.setFont("helvetica", "normal");
    y += PARA_GAP;
    doc.setFontSize(12);

    for (const b of items) {
      const lines = doc.splitTextToSize(`• ${b}`, 170);
      for (const ln of lines) {
        y = ensureSpace(doc, y, LINE_GAP);
        doc.text(ln, MARGIN_X, y);
        y += LINE_GAP;
      }
    }
    y += 2;
  };

  writeBullets(bullets);

  // ---------- Agreement Terms (section headers + paragraphs) ----------
  doc.setTextColor(50);
  const writeHeading = (title: string) => {
    y = ensureSpace(doc, y, LINE_GAP + PARA_GAP);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text(title, MARGIN_X, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(12);
    y += 6;
  };

  const writeParagraph = (text: string) => {
    const lines = doc.splitTextToSize(text, 170);
    for (const ln of lines) {
      y = ensureSpace(doc, y, LINE_GAP);
      doc.text(ln, MARGIN_X, y);
      y += LINE_GAP;
    }
    y += 4; // small gap between paragraphs
  };

  // Payments & Schedule
  writeHeading("Payments & Schedule");
  {
    const dueLine = dueByPretty
      ? `The remaining balance will be charged ${dueByPretty} unless you pay in full today or clear the balance earlier.`
      : `The remaining balance will be charged 35 days before your wedding date unless you pay in full today or clear the balance earlier.`;

    writeParagraph(
      `By signing this agreement, you agree that at minimum 25% of the catering total is non-refundable. ${dueLine}`
    );
    writeParagraph(
      `Final guest counts are due 30 days before your wedding date. You may increase your guest count at any time; however, once booked, you cannot decrease the number of guests below the booked count.`
    );
  }

  // Cancellations & Changes
  writeHeading("Cancellations & Changes");
  writeParagraph(
    `If you cancel more than 30 days prior to your wedding, amounts paid beyond the non-refundable portion will be refunded less any non-recoverable catering costs already incurred. ` +
      `If you cancel within 30 days, all payments are non-refundable. Reschedules are subject to vendor availability, and any additional fees will be the client’s responsibility.`
  );

  // Missed Payments / Default
  writeHeading("Missed Payments / Default");
  writeParagraph(
    `If any installment payment is not successfully processed by the due date, Wed&Done will automatically attempt to re-charge the card on file. ` +
      `If payment is not received within 7 days, a late fee of $25 will be applied. If payment remains outstanding for more than 14 days, ` +
      `Wed&Done reserves the right to suspend services and declare this agreement in default. In the event of default, all amounts paid ` +
      `(including the non-refundable deposit) may be retained by Wed&Done and the booking may be cancelled without further obligation.`
  );

  // Food, Allergies & Substitutions
  writeHeading("Food, Allergies & Substitutions");
  writeParagraph(
    `Wed&Done is not responsible for venue restrictions, undisclosed allergies, or consequential damages. Our liability is limited to the amounts you have paid for catering services under this agreement. ` +
      `Because food ingredients and products are subject to supply conditions, comparable substitutions may be made if certain menu items or ingredients are unavailable.`
  );

  // Force Majeure
  writeHeading("Force Majeure");
  writeParagraph(
    `Neither party is liable for failure or delay caused by events beyond reasonable control (including natural disasters, acts of government, war, terrorism, labor disputes, epidemics/pandemics, or utility outages). ` +
      `If performance is prevented, we’ll work in good faith to reschedule. If rescheduling isn’t possible, we’ll refund any amounts paid beyond non-recoverable costs already incurred.`
  );

  // ---------- Signature anchored to the bottom of the FINAL page ----------
if (y + SIG_BLOCK_H > FOOTER_Y - 12) {
  addFooter(doc);
  doc.addPage();
  y = TOP_Y;
}

const sigTop = FOOTER_Y - 10 - SIG_BLOCK_H; // 10px breathing room above footer
doc.setTextColor(0);
doc.setFontSize(12);
doc.text("Signature", MARGIN_X, sigTop);

// Helper: detect format from data URL
const detectFormat = (url: string): "PNG" | "JPEG" | undefined => {
  if (!url) return undefined;
  if (url.startsWith("data:image/png")) return "PNG";
  if (url.startsWith("data:image/jpeg") || url.startsWith("data:image/jpg")) return "JPEG";
  return undefined; // let jsPDF try to infer
};

try {
  if (signatureImageUrl) {
    const sigW = 100;          // wider so it’s readable
    const sigH = 40;           // a bit taller than before

    const fmt = detectFormat(signatureImageUrl);

    if (signatureImageUrl.startsWith("data:")) {
      // data URL → add directly
      doc.addImage(signatureImageUrl, fmt as any, MARGIN_X, sigTop + 5, sigW, sigH);
    } else {
      // blob:/http(s):/relative → load as HTMLImageElement first
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
        // last resort: do nothing (avoid throwing)
        console.warn("⚠️ Could not load signature image; leaving signature area blank.");
      }
    }
  }
} catch (err) {
  console.error("❌ Failed to add signature image:", err);
}

doc.setFontSize(10);
doc.setTextColor(100);
doc.text(`Signed by: ${fullName}`, MARGIN_X, sigTop + 5 + 40 + 12); // use sigH
doc.text(`Signature date: ${todayPretty}`, MARGIN_X, sigTop + 5 + 40 + 19);

// Final footer on the last page
addFooter(doc);

  return doc.output("blob");
};

export default generateYumAgreementPDF;