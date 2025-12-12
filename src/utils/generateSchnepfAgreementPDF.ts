// src/utils/generateSchnepfAgreementPDF.ts
import jsPDF from "jspdf";

/* ───────────────── layout ───────────────── */
const MARGIN_X = 20,
  TOP_Y = 20,
  FOOTER_Y = 278,
  LINE_GAP = 8,
  PARA_GAP = 10;

const SIG_IMG_H = 40;
const SIG_BLOCK_H = 5 + SIG_IMG_H + 19 + 10;
const FINAL_DUE_DAYS = 35;

/* ───────────────── helpers ───────────────── */
function addFooter(doc: jsPDF) {
  doc.setDrawColor(200);
  doc.line(MARGIN_X, FOOTER_Y - 8, 190, FOOTER_Y - 8);
  doc.setFontSize(10);
  doc.setTextColor(120);
  doc.text("Magically booked by Wed&Done", 105, FOOTER_Y, {
    align: "center",
  });
}

function resetBodyStyle(doc: jsPDF) {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.setTextColor(0); // black body text
}

function ensureSpace(doc: jsPDF, y: number, needed = 12) {
  if (y + needed > FOOTER_Y - 12) {
    addFooter(doc);
    doc.addPage();
    resetBodyStyle(doc);
    return TOP_Y;
  }
  return y;
}

function toPrettyDate(input: string) {
  const ymd = /^\d{4}-\d{2}-\d{2}$/;
  let d: Date | null = null;
  if (ymd.test(input)) d = new Date(`${input}T12:00:00`);
  else {
    const t = new Date(input);
    if (!isNaN(t.getTime())) d = t;
  }
  if (!d) return input;
  const m = d.toLocaleString("en-US", { month: "long" });
  const day = d.getDate();
  const y = d.getFullYear();
  const ord =
    day >= 11 && day <= 13
      ? "th"
      : [undefined, "st", "nd", "rd"][day % 10] ?? "th";
  return `${m} ${day}${ord}, ${y}`;
}

function addDays(d: Date, days: number) {
  return new Date(d.getTime() + days * 86400000);
}

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((res, rej) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = src;
  });

function writeWrapped(
  doc: jsPDF,
  text: string,
  x: number,
  y: number,
  maxWidth = 170
) {
  const lines = doc.splitTextToSize(text, maxWidth) as string[];
  for (const ln of lines) {
    y = ensureSpace(doc, y, LINE_GAP);
    doc.text(ln, x, y);
    y += LINE_GAP;
  }
  return y;
}

function writeBullet(doc: jsPDF, text: string, y: number): number {
  const bullet = "• ";
  const bulletW = doc.getTextWidth(bullet);
  const wrapW = 170 - bulletW;
  const lines = doc.splitTextToSize(text, wrapW) as string[];

  y = ensureSpace(doc, y, LINE_GAP);
  doc.text(bullet, MARGIN_X, y);
  doc.text(lines[0], MARGIN_X + bulletW, y);
  y += LINE_GAP;

  for (const ln of lines.slice(1)) {
    y = ensureSpace(doc, y, LINE_GAP);
    doc.text(ln, MARGIN_X + bulletW, y);
    y += LINE_GAP;
  }
  return y;
}

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
    salads?: string[];
  };

  // Optional Schnepf-specific bits shown on the receipt
  cuisineName?: string;
  perGuest?: number; // price per guest used in calc
  chefFee?: number; // e.g. 200
  serviceFeePct?: number; // e.g. 0.22 for 22%
  taxesAndFees?: number; // combined taxes + fees number from cart
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
  perGuest,
  chefFee = 0,
  serviceFeePct,
  taxesAndFees = 0,
}: SchnepfPDFOptions): Promise<Blob> => {
  const doc = new jsPDF();

  // header art
  try {
    const [logo, lock] = await Promise.all([
      loadImage(`${import.meta.env.BASE_URL}assets/images/rainbow_logo.jpg`),
      loadImage(`${import.meta.env.BASE_URL}assets/images/lock_grey.jpg`),
    ]);
    doc.addImage(lock, "JPEG", 40, 60, 130, 130);
    doc.addImage(logo, "JPEG", 75, 10, 60, 60);
  } catch {
    // fall back gracefully if images fail
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(16);
  doc.setTextColor(0);
  doc.text(
    "Schnepf Farms Catering Agreement & Receipt",
    105,
    75,
    { align: "center" }
  );

  const prettyWedding = toPrettyDate(weddingDate);
  const todayPretty = toPrettyDate(new Date().toISOString());

  // final due = wedding − 35 days
  let dueByPretty = "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(weddingDate)) {
    dueByPretty = toPrettyDate(
      addDays(new Date(`${weddingDate}T12:00:00`), -FINAL_DUE_DAYS).toISOString()
    );
  }

  // basics
  resetBodyStyle(doc);
  let y = 90;
  doc.text(`Name: ${fullName}`, MARGIN_X, y);
  y += LINE_GAP;
  doc.text(`Wedding Date: ${prettyWedding}`, MARGIN_X, y);
  y += LINE_GAP;
  if (cuisineName) {
    doc.text(`Cuisine: ${cuisineName}`, MARGIN_X, y);
    y += LINE_GAP;
  }
  doc.text(`Guest Count: ${guestCount}`, MARGIN_X, y);
  y += LINE_GAP + LINE_GAP;

  // selections / included
  if (
    lineItems.length ||
    menuSelections.appetizers?.length ||
    menuSelections.mains?.length ||
    menuSelections.sides?.length ||
    menuSelections.salads?.length
  ) {
    y = ensureSpace(doc, y, PARA_GAP + LINE_GAP);
    doc.setFontSize(14);
    doc.text("Selections / Included:", MARGIN_X, y);
    y += PARA_GAP;
    resetBodyStyle(doc);

    for (const item of lineItems) {
      const lines = doc.splitTextToSize(`• ${item}`, 170) as string[];
      for (const ln of lines) {
        y = ensureSpace(doc, y, LINE_GAP);
        doc.text(ln, MARGIN_X + 5, y);
        y += LINE_GAP;
      }
    }

    const section = (label: string, items?: string[]) => {
      if (!items?.length) return;
      y = ensureSpace(doc, y, LINE_GAP);
      doc.text(`${label}:`, MARGIN_X + 5, y);
      y += LINE_GAP;
      for (const it of items) {
        const wrapped = doc.splitTextToSize(`- ${it}`, 165) as string[];
        for (const ln of wrapped) {
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
  doc.setFontSize(14);
  doc.text("Pricing Summary:", MARGIN_X, y);
  y += PARA_GAP;
  resetBodyStyle(doc);

  if (typeof perGuest === "number" && guestCount) {
    const foodSubtotal = perGuest * guestCount;
    doc.text(
      `Food subtotal (${guestCount} @ $${Number(perGuest).toLocaleString(
        undefined,
        { minimumFractionDigits: 2, maximumFractionDigits: 2 }
      )}/guest): $${Number(foodSubtotal).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`,
      MARGIN_X,
      y
    );
    y += LINE_GAP;
  }
  if (chefFee > 0) {
    doc.text(
      `Chef fee: $${Number(chefFee).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`,
      MARGIN_X,
      y
    );
    y += LINE_GAP;
  }
  if (taxesAndFees > 0) {
    doc.text(
      `Taxes & fees (incl. service/processing): $${Number(
        taxesAndFees
      ).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`,
      MARGIN_X,
      y
    );
    y += LINE_GAP;
  }
  doc.text(
    `Total: $${Number(total).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`,
    MARGIN_X,
    y
  );
  y += LINE_GAP + 2;

  // payment summary
  doc.setFontSize(12);
  doc.text("Payment Summary:", MARGIN_X, y);
  y += LINE_GAP;
  resetBodyStyle(doc);

  if (paymentSummary) {
    y = writeWrapped(doc, paymentSummary, MARGIN_X + 5, y, 170);
  }

  if (deposit > 0 && deposit < total) {
    doc.text(
      `Deposit Paid Today: $${Number(deposit).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`,
      MARGIN_X + 5,
      (y += LINE_GAP)
    );
    if (dueByPretty) {
      doc.text(
        `Remaining balance due by: ${dueByPretty}`,
        MARGIN_X + 5,
        (y += LINE_GAP)
      );
    }
  } else {
    doc.text(
      `Total Paid in Full Today: $${Number(total).toLocaleString(
        undefined,
        { minimumFractionDigits: 2, maximumFractionDigits: 2 }
      )}`,
      MARGIN_X + 5,
      (y += LINE_GAP)
    );
  }
  doc.text(`Date Paid: ${todayPretty}`, MARGIN_X + 5, (y += PARA_GAP));

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
    doc.text("Pricing Overview:", MARGIN_X, y);
    y += LINE_GAP;
    resetBodyStyle(doc);

    if (cuisineName) {
      doc.text(`Cuisine: ${cuisineName}`, MARGIN_X + 5, y);
      y += LINE_GAP;
    }
    if (typeof perGuest !== "undefined") {
      doc.text(
        `Per-guest price used: $${Number(perGuest).toLocaleString(
          undefined,
          { minimumFractionDigits: 2, maximumFractionDigits: 2 }
        )}`,
        MARGIN_X + 5,
        y
      );
      y += LINE_GAP;
    }
    if (typeof chefFee !== "undefined" && chefFee > 0) {
      doc.text(
        `Chef fee applied: $${Number(chefFee).toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`,
        MARGIN_X + 5,
        y
      );
      y += LINE_GAP;
    }
    if (typeof serviceFeePct !== "undefined") {
      doc.text(
        `Service fee: ${(serviceFeePct * 100).toFixed(0)}%`,
        MARGIN_X + 5,
        y
      );
      y += LINE_GAP;
    }
    if (typeof taxesAndFees !== "undefined") {
      doc.text(
        `Taxes & fees (combined): $${Number(taxesAndFees).toLocaleString(
          undefined,
          { minimumFractionDigits: 2, maximumFractionDigits: 2 }
        )}`,
        MARGIN_X + 5,
        y
      );
      y += LINE_GAP;
    }
  }

  /* ── Booking Terms (match on-screen contract) ── */
  y += PARA_GAP;
  y = ensureSpace(doc, y, LINE_GAP + PARA_GAP);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("Booking Terms:", MARGIN_X, y);
  y += PARA_GAP;
  resetBodyStyle(doc);

  const terms: string[] = [
    // Payment Options
    `Payment Options. You may pay your Schnepf catering total in full today, or place a ${Math.round(
      0.25 * 100
    )}% non-refundable deposit. Any remaining balance will be split into monthly installments so that the full amount is paid ${FINAL_DUE_DAYS} days before your wedding date. Any unpaid balance on that date will be automatically charged.`,
    // Guest count/lock
    "Final guest count is due 30 days before your wedding. You may increase your guest count starting 45 days before your wedding, but the count cannot be lowered after booking.",
    // Substitutions & availability
    "Substitutions & Availability: Menu items may be substituted with comparable alternatives due to seasonality or supply constraints.",
    // Food safety / venue policies
    "Food Safety & Venue Policies: We’ll follow standard food-safety guidelines and comply with venue rules, which may limit service or display options.",
    // Cancellation & refunds
    `Cancellation & Refunds: If you cancel more than ${FINAL_DUE_DAYS} days prior, amounts paid beyond the non-refundable portion will be refunded less any non-recoverable costs already incurred. Within ${FINAL_DUE_DAYS} days of the event, all payments are non-refundable.`,
    // Missed payments
    "Missed Payments: We’ll automatically retry your card for any failed payment. After 7 days, a $25 late fee may apply; after 14 days, services may be suspended and this agreement may be in default.",
    // Card auth
    "Card Authorization & Saved Card: By completing this booking, you authorize Wed&Done and our payment processor (Stripe) to securely store your card for Schnepf catering installment payments and any remaining balance under this agreement, as well as future Wed&Done bookings you choose to make. Your card details are encrypted and handled by Stripe, and you may update your saved card at any time in your Wed&Done account.",
    // Force majeure
    "Force Majeure: Neither party is liable for delays or failures caused by events beyond reasonable control (including natural disasters, government actions, labor disputes, epidemics/pandemics, or utility outages). We’ll work in good faith to reschedule; if that isn’t possible, we’ll refund amounts paid beyond non-recoverable costs already incurred.",
    // Limited liability
    "In the unlikely event of our cancellation or issue, liability is limited to a refund of payments made for Schnepf catering services under this agreement.",
  ];

  for (const t of terms) {
    y = writeBullet(doc, t, y);
  }

  // signature block
  if (y + SIG_BLOCK_H > FOOTER_Y - 12) {
    addFooter(doc);
    doc.addPage();
    resetBodyStyle(doc);
    y = TOP_Y;
  }
  const sigTop = FOOTER_Y - 10 - SIG_BLOCK_H;
  doc.setTextColor(0);
  doc.setFontSize(12);
  doc.text("Signature", MARGIN_X, sigTop);

  const detectFmt = (url: string): "PNG" | "JPEG" | undefined =>
    url?.startsWith("data:image/png")
      ? "PNG"
      : url?.startsWith("data:image/jpeg") ||
        url?.startsWith("data:image/jpg")
      ? "JPEG"
      : undefined;

  try {
    if (signatureImageUrl) {
      if (signatureImageUrl.startsWith("data:")) {
        const fmt = detectFmt(signatureImageUrl) || "PNG";
        doc.addImage(
          signatureImageUrl,
          fmt as any,
          MARGIN_X,
          sigTop + 5,
          100,
          SIG_IMG_H
        );
      } else {
        const img = await loadImage(signatureImageUrl).catch(() => null as any);
        if (img) {
          doc.addImage(img, "PNG", MARGIN_X, sigTop + 5, 100, SIG_IMG_H);
        }
      }
    }
  } catch {
    // ignore signature failure but keep layout
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

export default generateSchnepfAgreementPDF;