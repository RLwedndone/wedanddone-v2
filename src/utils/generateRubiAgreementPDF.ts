import jsPDF from "jspdf";

/* ---------- Layout constants ---------- */
const MARGIN_X = 20;
const TOP_Y = 20;
const FOOTER_Y = 278;
const LINE_GAP = 8;
const PARA_GAP = 10;

const SIG_IMG_H = 30;
const SIG_BLOCK_H = 5 + SIG_IMG_H + 7 + 7;

/* ---------- helpers ---------- */
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

// "2025-03-14" -> "March 14th, 2025"
function toPrettyDate(input: string | Date) {
  let d: Date | null = null;

  if (typeof input === "string") {
    if (/^\d{4}-\d{2}-\d{2}$/.test(input)) {
      d = new Date(`${input}T12:00:00`);
    } else {
      const tryDate = new Date(input);
      if (!isNaN(tryDate.getTime())) d = tryDate;
    }
  } else {
    d = input;
  }

  if (!d) return typeof input === "string" ? input : String(input);

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

function minusDaysISO(ymd: string, days: number): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  const d = new Date(`${ymd}T12:00:00`);
  d.setDate(d.getDate() - days);
  return d.toISOString();
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
export interface RubiAgreementPDFOptions {
  fullName: string;                 // "Taylor Swift"
  menuChoice: "bbq" | "mexican";    // determines wording in title
  tierLabel: string;                // prettyName from tierSelection
  guestCount: number;
  weddingDate: string;              // "YYYY-MM-DD" ideally
  total: number;                    // grand total $
  depositPaidToday: number;         // what we actually charged on Checkout right now
  paymentSummary: string;           // human text from checkout/contract
  lineItems: string[];              // each line of the cart
  signatureImageUrl: string;        // data URL from contract signature
}

/* ---------- Main ---------- */
const generateRubiAgreementPDF = async ({
  fullName,
  menuChoice,
  tierLabel,
  guestCount,
  weddingDate,
  total,
  depositPaidToday,
  paymentSummary,
  lineItems,
  signatureImageUrl,
}: RubiAgreementPDFOptions): Promise<Blob> => {
  const doc = new jsPDF();

  // assets we'll watermark with
  const [logo, lock] = await Promise.all([
    loadImage(`${import.meta.env.BASE_URL}assets/images/rainbow_logo.jpg`),
    loadImage(`${import.meta.env.BASE_URL}assets/images/lock_grey.jpg`),
  ]);

  // watermark lock bg + rainbow logo
  doc.addImage(lock, "JPEG", 40, 60, 130, 130);
  doc.addImage(logo, "JPEG", 75, 10, 60, 60);

  // header title
  const catererLabel =
    menuChoice === "bbq" ? "Brother John’s BBQ" : "Brother John’s Mexican";
  doc.setFont("helvetica", "normal");
  doc.setFontSize(16);
  doc.setTextColor(0);
  doc.text(
    `Rubi House Catering Agreement & Receipt — ${catererLabel}`,
    105,
    75,
    { align: "center" }
  );

  const weddingPretty = toPrettyDate(weddingDate || "TBD");
  const todayPretty = toPrettyDate(new Date());

  // compute "final due by" = 35 days pre-wedding if we have a parseable date
  let dueByPretty = "";
  const minus35ISO = minusDaysISO(weddingDate, 35);
  if (minus35ISO) {
    dueByPretty = toPrettyDate(minus35ISO);
  }

  // basics / who / what
  doc.setFontSize(12);
  let y = 90;
  doc.text(`Name: ${fullName}`, MARGIN_X, y); y += LINE_GAP;
  doc.text(`Wedding Date: ${weddingPretty}`, MARGIN_X, y); y += LINE_GAP;
  if (tierLabel) {
    doc.text(`Selected Package: ${tierLabel}`, MARGIN_X, y);
    y += LINE_GAP;
  }
  doc.text(`Caterer: ${catererLabel}`, MARGIN_X, y); y += LINE_GAP;
  doc.text(`Guest Count: ${guestCount}`, MARGIN_X, y); y += LINE_GAP;
  y += LINE_GAP;

  // Included menu / line items
  if (lineItems && lineItems.length) {
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
  }

  // Payment summary block
  y += PARA_GAP;
  y = ensureSpace(doc, y, LINE_GAP * 4 + PARA_GAP);
  doc.setTextColor(0);
  doc.setFontSize(12);
  doc.text("Payment Summary:", MARGIN_X, y);
  y += LINE_GAP;

  // caller already built a human string like:
  // "Deposit due today: $123.45 (25%). Remaining $456.78 — final payment due June 1st, 2025."
  const humanLines = doc.splitTextToSize(paymentSummary, 170);
  for (const ln of humanLines) {
    y = ensureSpace(doc, y, LINE_GAP);
    doc.text(ln, MARGIN_X + 5, y);
    y += LINE_GAP;
  }

  // detail rows
  doc.text(
    `Amount Paid Today: $${depositPaidToday.toFixed(2)}`,
    MARGIN_X + 5,
    y
  );
  y += LINE_GAP;

  doc.text(
    `Total Contract Amount: $${total.toFixed(2)}`,
    MARGIN_X + 5,
    y
  );
  y += LINE_GAP;

  doc.text(`Date Paid: ${todayPretty}`, MARGIN_X + 5, y);
  y += PARA_GAP;

  // Rubi-specific reminder: bar, F&B minimum, etc.
  {
    const banner =
      "Reminder: This catering counts toward your food & beverage minimum with Rubi House. Any remaining spend to hit that minimum (like bar service) is handled directly with the venue and must follow Arizona liquor laws. Guest count locks 30 days before your wedding.";
    const lines = doc.splitTextToSize(banner, 170);
    for (const ln of lines) {
      y = ensureSpace(doc, y, LINE_GAP);
      doc.text(ln, MARGIN_X, y);
      y += LINE_GAP;
    }
    y += 4;
  }

  // Legal-ish terms (mirrors RubiCateringContract copy)
  const writeParagraph = (title: string, body: string) => {
    y = ensureSpace(doc, y, PARA_GAP);
    doc.setFontSize(13);
    doc.text(title, MARGIN_X, y);
    y += LINE_GAP;
    doc.setFontSize(12);
    const lines = doc.splitTextToSize(body, 170);
    for (const ln of lines) {
      y = ensureSpace(doc, y, LINE_GAP);
      doc.text(ln, MARGIN_X, y);
      y += LINE_GAP;
    }
    y += 2;
  };

  writeParagraph(
    "Booking & Payment Plan",
    `You may either pay in full, or pay a 25% non-refundable deposit and split the remaining balance into monthly installments. The full balance must be paid 35 days before your wedding (${dueByPretty || "your final due date"}).`
  );

  writeParagraph(
    "Guest Count",
    "Final guest count is due 30 days before your wedding. You can increase your count starting 45 days out, but it cannot be lowered after booking."
  );

  writeParagraph(
    "Cancellation & Refunds",
    "If you cancel more than 35 days before your wedding, amounts paid beyond the non-refundable portion will be refunded less any non-recoverable costs already incurred. Within 35 days, all payments are non-refundable."
  );

  writeParagraph(
    "Missed Payments",
    "We’ll automatically retry your card. After 7 days, a $25 late fee applies. After 14 days, services may be suspended and the agreement may be in default."
  );

  writeParagraph(
    "Food Safety & Venue Policies",
    "We follow standard food-safety guidelines and comply with venue rules, which may limit service/display options. Alcohol is booked directly with the venue in accordance with Arizona liquor laws."
  );

  writeParagraph(
    "Force Majeure",
    "Neither party is liable for delays outside reasonable control. We'll work in good faith to reschedule; if that’s not possible, we’ll refund amounts paid beyond non-recoverable costs already incurred. Our liability is limited to a refund of payments made."
  );

  // Signature block
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
      doc.addImage(
        signatureImageUrl,
        "PNG",
        MARGIN_X,
        sigTop + 5,
        80,
        SIG_IMG_H
      );
    }
  } catch (err) {
    console.error("❌ [RubiAgreementPDF] addImage failed:", err);
  }

  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(
    `Signed by: ${fullName}`,
    MARGIN_X,
    sigTop + 5 + SIG_IMG_H + 12
  );
  doc.text(
    `Signature date: ${todayPretty}`,
    MARGIN_X,
    sigTop + 5 + SIG_IMG_H + 19
  );

  addFooter(doc);
  return doc.output("blob");
};

export default generateRubiAgreementPDF;