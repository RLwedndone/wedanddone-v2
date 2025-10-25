import jsPDF from "jspdf";

/** ---------------- helpers ---------------- */
const loadImage = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });

const ordinal = (n: number) =>
  n % 10 === 1 && n % 100 !== 11
    ? "st"
    : n % 10 === 2 && n % 100 !== 12
    ? "nd"
    : n % 10 === 3 && n % 100 !== 13
    ? "rd"
    : "th";

const prettyDate = (d: string): string => {
  const dt = new Date(d);
  if (!isNaN(dt.getTime())) {
    const m = dt.toLocaleString("en-US", { month: "long" });
    const day = dt.getDate();
    const y = dt.getFullYear();
    return `${m} ${day}${ordinal(day)}, ${y}`;
  }
  return d;
};

const renderFooter = (doc: jsPDF) => {
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  doc.setDrawColor(200);
  doc.line(20, h - 25, w - 20, h - 25);
  doc.setFontSize(10);
  doc.setTextColor(120);
  doc.text("Magically booked by Wed&Done", w / 2, h - 17, { align: "center" });
};

// convenience: write a paragraph with auto-wrap + page-breaks
function writeParagraph(
  doc: jsPDF,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  bottomMargin = 60
) {
  const h = doc.internal.pageSize.getHeight();
  const lines = doc.splitTextToSize(text, maxWidth);
  let cursor = y;
  lines.forEach((ln: string) => {
    if (cursor > h - bottomMargin) {
      renderFooter(doc);
      doc.addPage();
      cursor = 30;
    }
    doc.text(ln, x, cursor);
    cursor += 7;
  });
  return cursor;
}

/** ---------------- types ---------------- */
export interface JamPDFOptions {
  fullName: string;
  total: number;
  deposit: number;               // amount paid today (0 if full)
  paymentSummary: string;        // e.g. “25% today, balance monthly…”
  weddingDate: string;           // ISO or already-formatted
  signatureImageUrl: string;
  lineItems?: string[];
  signatureDate?: string;        // OPTIONAL: e.g. "September 2nd, 2025"
  finalDuePretty?: string;       // OPTIONAL: default "35 days before your wedding date"
}

/** ---------------- main ---------------- */
export const generateJamAgreementPDF = async ({
  fullName,
  total,
  deposit,
  paymentSummary,
  weddingDate,
  signatureImageUrl,
  lineItems = [],
  signatureDate,
  finalDuePretty,
}: JamPDFOptions): Promise<Blob> => {
  const doc = new jsPDF();
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();

  // assets
  const [logo, lock] = await Promise.all([
    loadImage(`${import.meta.env.BASE_URL}assets/images/rainbow_logo.jpg`),
    loadImage(`${import.meta.env.BASE_URL}assets/images/lock_grey.jpg`),
  ]);

  // watermark + logo
  doc.addImage(lock, "JPEG", 40, 60, 130, 130);
  doc.addImage(logo, "JPEG", 75, 10, 60, 60);

  // title
  doc.setFont("helvetica", "normal");
  doc.setFontSize(16);
  doc.setTextColor(0);
  doc.text("Jam & Groove Agreement & Receipt", w / 2, 75, { align: "center" });

  // formatted wedding date
  const formattedDate = prettyDate(weddingDate);

  // header info
  doc.setFontSize(12);
  doc.text(`Name: ${fullName}`, 20, 90);
  doc.text(`Wedding Date: ${formattedDate}`, 20, 100);
  doc.text(`Total Jam & Groove Cost: $${total.toFixed(2)}`, 20, 110);

  let y = 120;
  const bottomMargin = 60;
  const addPageIfNeeded = () => {
    if (y > h - bottomMargin) {
      renderFooter(doc);
      doc.addPage();
      doc.addImage(lock, "JPEG", 40, 60, 130, 130);
      y = 30;
    }
  };

  // deposit line
  if (deposit > 0 && deposit !== total) {
    doc.text(`Deposit Paid Today: $${deposit.toFixed(2)}`, 20, y);
    y += 10;
  }

  // payment plan line
  if (paymentSummary) {
    addPageIfNeeded();
    doc.text(`Payment Plan: ${paymentSummary}`, 20, y);
    y += 10;
  }

  // included items
  const filteredItems = (lineItems || []).filter((it) => it && !it.startsWith("__"));
  if (filteredItems.length > 0) {
    addPageIfNeeded();
    doc.setFontSize(14);
    doc.text("Included Items:", 20, y);
    y += 10;

    doc.setFontSize(12);
    for (const item of filteredItems) {
      addPageIfNeeded();
      doc.text(`• ${item}`, 25, y);
      y += 8;
    }
  }

  // confirmation line (paid today)
  const todayPretty = prettyDate(new Date().toISOString());
  const paidToday = deposit > 0 && deposit !== total ? deposit : total;

  y += 10;
  addPageIfNeeded();
  doc.setFontSize(12);
  doc.text(`Total paid today: $${paidToday.toFixed(2)} on ${todayPretty}`, 20, y);
  y += 12;

  /** -------- Legal Terms (aligned with other boutiques) -------- */
  doc.setFontSize(14);
  doc.text("Booking Terms & Policies", 20, y);
  y += 10;
  doc.setFontSize(11);

  const dueText =
    finalDuePretty || "35 days before your wedding date";

  y = writeParagraph(
    doc,
    "By signing this agreement, your event date is reserved for Jam & Groove services (DJ and/or musicians).",
    20,
    y,
    w - 40
  );

  y += 4;
  y = writeParagraph(
    doc,
    "Payment Options. You may pay in full today, or pay a 25% non-refundable deposit today and the remaining balance in monthly installments. All installments must be completed no later than " +
      dueText +
      ". Any unpaid balance will be automatically charged on that date to the card on file.",
    20,
    y,
    w - 40
  );

  y += 4;
  y = writeParagraph(
    doc,
    "Cancellation & Refunds. If you cancel more than 35 days prior to your wedding, amounts paid beyond the non-refundable portion will be refunded less any non-recoverable costs already incurred. If you cancel within 35 days, all payments are non-refundable.",
    20,
    y,
    w - 40
  );

  y += 4;
  y = writeParagraph(
    doc,
    "Missed Payments. If an installment is not successfully processed by the due date, Wed&Done will automatically attempt to re-charge the card on file. If payment is not received within 7 days, a $25 late fee applies. After 14 days, services may be suspended and this agreement may be declared in default. In the event of default, all amounts paid (including the non-refundable deposit) will be retained and the booking may be cancelled.",
    20,
    y,
    w - 40
  );

  y += 4;
  y = writeParagraph(
    doc,
    "Performance & Logistics. Talent will arrive approximately 60 minutes prior to guest arrival for setup and sound check. Client agrees to provide reasonable power, space, and venue access. Travel outside the Phoenix Metro area may incur additional fees.",
    20,
    y,
    w - 40
  );

  y += 4;
  y = writeParagraph(
    doc,
    "Force Majeure. Neither party is liable for failure or delay caused by events beyond reasonable control (including natural disasters, acts of government, war, terrorism, labor disputes, epidemics/pandemics, or utility outages). If performance is prevented, the parties will work in good faith to reschedule. If rescheduling is not possible, amounts paid beyond non-recoverable costs will be refunded.",
    20,
    y,
    w - 40
  );

  y += 4;
  y = writeParagraph(
    doc,
    "Limitation of Liability. In all circumstances, Wed&Done's liability is limited to the total amounts paid by Client under this agreement.",
    20,
    y,
    w - 40
  );

  // -------- signature pinned to final page bottom --------
  const sigBlockHeight = 55;
  if (y > h - (sigBlockHeight + 35)) {
    renderFooter(doc);
    doc.addPage();
    doc.addImage(lock, "JPEG", 40, 60, 130, 130);
  }

  const sigTop = h - (sigBlockHeight + 28);
  doc.setTextColor(0);
  doc.setFontSize(12);
  doc.text("Signature:", 20, sigTop);

  try {
    doc.addImage(signatureImageUrl, "PNG", 20, sigTop + 5, 80, 30);
  } catch {
    /* ignore img parse issues */
  }

  const signedPretty = signatureDate ? prettyDate(signatureDate) : todayPretty;

  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Signed by: ${fullName}`, 20, sigTop + 30 + 12);
  doc.text(`Signature date: ${signedPretty}`, 20, sigTop + 30 + 19);

  renderFooter(doc);
  return doc.output("blob");
};