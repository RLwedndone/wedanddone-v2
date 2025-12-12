import jsPDF from "jspdf";

/* -------------------- types -------------------- */
export interface JamPDFOptions {
  fullName: string;
  total: number;
  deposit: number;           // amount paid today (0 if full)
  paymentSummary: string;    // kept for compatibility, not rendered
  weddingDate: string;       // ISO or human-readable
  signatureImageUrl: string; // data URL (PNG)
  lineItems?: string[];
  signatureDate?: string;    // e.g. "September 2nd, 2025"
  finalDuePretty?: string;   // default "35 days before your wedding date"
}

/* -------------------- helpers -------------------- */
const ordinal = (n: number) => {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
};

const parseWeddingDate = (raw: string): Date | null => {
  if (!raw) return null;
  const isoNoTime = /^\d{4}-\d{2}-\d{2}$/;
  let d: Date;

  if (isoNoTime.test(raw)) {
    d = new Date(raw + "T12:00:00");
  } else {
    d = new Date(raw);
  }

  return isNaN(d.getTime()) ? null : d;
};

const fmtLong = (d: Date) =>
  `${d.toLocaleString("en-US", { month: "long" })} ${d.getDate()}${ordinal(
    d.getDate()
  )}, ${d.getFullYear()}`;

const prettyDate = (raw: string | Date): string => {
  if (raw instanceof Date) {
    return isNaN(raw.getTime()) ? "" : fmtLong(raw);
  }
  const d = parseWeddingDate(raw);
  return !d ? raw : fmtLong(d);
};

const finalDueMinusDays = (raw: string, days: number): Date | null => {
  const base = parseWeddingDate(raw);
  if (!base) return null;
  const out = new Date(base.getTime());
  out.setDate(out.getDate() - days);
  return out;
};

const loadImage = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });

/** Reset to normal body text style */
const setBodyFont = (doc: jsPDF) => {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.setTextColor(0);
};

/* footer */
const renderFooter = (doc: jsPDF) => {
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  const lineY = h - 20;

  doc.setDrawColor(200);
  doc.line(20, lineY, w - 20, lineY);

  doc.setFontSize(10);
  doc.setTextColor(120);
  doc.text("Magically booked by Wed&Done", w / 2, lineY + 8, {
    align: "center",
  });

  // restore body style for anything after the footer
  setBodyFont(doc);
};

/* -------------------- main -------------------- */
export const generateJamAgreementPDF = async ({
  fullName,
  total,
  deposit,
  paymentSummary, // kept for compatibility, not rendered
  weddingDate,
  signatureImageUrl,
  lineItems = [],
  signatureDate,
  finalDuePretty,
}: JamPDFOptions): Promise<Blob> => {
  const doc = new jsPDF();
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();

  // layout guards
  const TOP = 20;
  const LEFT = 20;
  const RIGHT = w - 20;
  const FOOTER_GAP = 28;
  const contentMaxY = () => h - FOOTER_GAP;
  let y = TOP;

  const ensureSpace = (needed: number) => {
    if (y + needed <= contentMaxY()) return;
    // finish current page
    renderFooter(doc);
    doc.addPage();
    y = TOP;
    setBodyFont(doc);
  };

  // assets – watermark + logo ONLY on first page
  try {
    const [logo, lock] = await Promise.all([
      loadImage(`${import.meta.env.BASE_URL}assets/images/rainbow_logo.jpg`),
      loadImage(`${import.meta.env.BASE_URL}assets/images/lock_grey.jpg`),
    ]);

    // watermark
    doc.addImage(lock, "JPEG", 40, 60, 130, 130);
    // logo
    doc.addImage(logo, "JPEG", 75, 10, 60, 60);
  } catch {
    // continue if assets fail
  }

  // header
  setBodyFont(doc);
  doc.setFontSize(16);
  doc.text("Jam & Groove Agreement & Receipt", w / 2, 75, {
    align: "center",
  });

  // basics
  setBodyFont(doc);
  y = 90;
  const wedPretty = prettyDate(weddingDate);
  doc.text(`Name: ${fullName || ""}`, LEFT, y);
  y += 8;
  doc.text(`Wedding Date: ${wedPretty}`, LEFT, y);
  y += 8;
  doc.text(
    `Total Jam & Groove Cost: $${Number(total).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`,
    LEFT,
    y
  );
  y += 12;

  // included items
  const filteredItems = (lineItems || []).filter(
    (it) => it && !it.startsWith("__")
  );
  if (filteredItems.length > 0) {
    ensureSpace(10);
    doc.setFontSize(14);
    doc.text("Included Items:", LEFT, y);
    y += 10;
    setBodyFont(doc);

    for (const item of filteredItems) {
      ensureSpace(8);
      const wrapped = doc.splitTextToSize(`• ${item}`, RIGHT - LEFT - 5);
      doc.text(wrapped, LEFT + 5, y);
      y += 8 + (wrapped.length - 1) * 6;
    }
    y += 4;
  }

  // payment details
  const today = new Date();
  const todayPretty = prettyDate(today);

  const finalDueDate =
    finalDuePretty && finalDuePretty.trim()
      ? null
      : finalDueMinusDays(weddingDate, 35);
  const finalDuePrettyResolved =
    finalDuePretty && finalDuePretty.trim().length > 0
      ? finalDuePretty
      : finalDueDate
      ? fmtLong(finalDueDate)
      : "35 days before your wedding date";

  ensureSpace(24);
  setBodyFont(doc);

  // Treat `deposit` as “amount paid today” when using a plan; otherwise full total
  const paidToday = deposit > 0 && deposit < total ? deposit : total;

  doc.text(
    `Paid today: $${Number(paidToday).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} on ${todayPretty}`,
    LEFT,
    y
  );
  y += 8;

  if (deposit > 0 && deposit < total) {
    ensureSpace(8);
    const remaining = Math.max(0, total - deposit);
    const planText = `Remaining balance: $${remaining.toFixed(
      2
    )} to be billed automatically in monthly installments, with the final payment due by ${finalDuePrettyResolved}.`;
    const wrappedPlan = doc.splitTextToSize(planText, RIGHT - LEFT);
    doc.text(wrappedPlan, LEFT, y);
    y += wrappedPlan.length * 6 + 2;
  } else {
    ensureSpace(8);
    const paidFullText = `Final balance due date: ${finalDuePrettyResolved} (paid in full today).`;
    const wrappedFull = doc.splitTextToSize(paidFullText, RIGHT - LEFT);
    doc.text(wrappedFull, LEFT, y);
    y += wrappedFull.length * 6 + 2;
  }

  // -------- Booking Terms (Jam-specific, now matching contract text) --------
  ensureSpace(14);
  doc.setTextColor(50);
  doc.setFontSize(12);
  doc.text("Booking Terms & Policies:", LEFT, y);
  y += 10;

  setBodyFont(doc);

  const terms: string[] = [
    // 🔹 Payment Options (exact match)
    "Payment Options. You may pay in full today, or place a non-refundable $750 deposit and pay the remaining balance in monthly installments. All installments must be completed no later than 35 days before your wedding date, and any unpaid balance will be automatically charged on that date.",

    // 🔹 Card Authorization (exact match)
    "Card Authorization. By completing this purchase, you authorize Wed&Done and our payment processor (Stripe) to securely store your card and to charge it for Jam & Groove installment payments, any remaining Jam & Groove balance due under this agreement, and any future Wed&Done bookings you choose to make, for your convenience. Your card details are encrypted and handled by Stripe, and you can update or replace your saved card at any time through your Wed&Done account.",

    // 🔹 Cancellation & Refunds
    "Cancellation & Refunds: If you cancel more than 35 days before your event, amounts you’ve paid beyond the non-refundable portion and any non-recoverable costs are refundable. If you cancel 35 days or fewer before the event, all payments made are non-refundable.",

    // 🔹 Missed Payments
    "Missed Payments: If a payment attempt fails, we’ll automatically re-try your card. After 7 days, a $25 late fee may be applied. After 14 days of non-payment, services may be paused and this agreement may be considered in default.",

    // 🔹 Performance & Logistics
    "Performance & Logistics: Your DJ / music team will typically arrive about 1 hour before guest arrival for setup and sound check. You agree to provide safe power, appropriate coverage or shade if outdoors, and any venue access needed. Travel outside the Phoenix Metro or to certain locations may incur additional fees as discussed in your package.",

    // 🔹 Force Majeure
    "Force Majeure: If events outside anyone’s control (including but not limited to extreme weather, natural disasters, government restrictions, or serious illness) prevent performance, both parties will work in good faith to reschedule. If rescheduling isn’t possible, amounts you’ve paid beyond non-recoverable costs are refunded. If Jam & Groove must cancel for any reason within our control and a suitable replacement cannot be arranged, liability is limited to a refund of payments made.",

    // 🔹 Limitation of Liability (extra safety net – fine to keep)
    "Limitation of Liability: In all circumstances, Wed&Done’s liability related to this agreement is limited to the total amounts paid by Client under this agreement.",
  ];

  for (const t of terms) {
    ensureSpace(10);
    const wrapped = doc.splitTextToSize(`• ${t}`, RIGHT - LEFT - 5);
    doc.text(wrapped, LEFT + 5, y);
    y += wrapped.length * 6 + 2;
  }

  // -------- Signature block --------
  const sigImageMaxW = 100;
  const sigImageMaxH = 35;
  const sigBlockNeeded = 5 + sigImageMaxH + 7 + 7 + 6;

  const placeSignature = () => {
    const footerTop = h - FOOTER_GAP + 8;
    if (y + sigBlockNeeded > footerTop - 10) {
      renderFooter(doc);
      doc.addPage();
      y = TOP;
      setBodyFont(doc);
    }

    setBodyFont(doc);
    doc.text("Signature:", LEFT, y);
    y += 5;
    try {
      doc.addImage(
        signatureImageUrl,
        "PNG",
        LEFT,
        y,
        sigImageMaxW,
        sigImageMaxH
      );
    } catch {
      doc.setDrawColor(180);
      doc.rect(LEFT, y, sigImageMaxW, sigImageMaxH);
      doc.setFontSize(10);
      doc.text("Signature image unavailable", LEFT + 5, y + sigImageMaxH / 2);
    }
    y += sigImageMaxH + 7;

    doc.setFontSize(10);
    doc.setTextColor(100);
    const sigDatePretty = signatureDate
      ? prettyDate(signatureDate)
      : prettyDate(new Date());
    doc.text(`Signed by: ${fullName || ""}`, LEFT, y);
    y += 7;
    doc.text(`Signature date: ${sigDatePretty}`, LEFT, y);
  };

  placeSignature();
  renderFooter(doc);

  return doc.output("blob");
};