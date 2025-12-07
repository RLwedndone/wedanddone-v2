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

// 🔧 normalize raw input into a safe Date (handles YYYY-MM-DD as local noon)
const normalizeDate = (input: string | Date): Date | null => {
  if (input instanceof Date) {
    return isNaN(input.getTime()) ? null : input;
  }

  if (!input) return null;

  // Handle pure YMD as **local** noon to avoid timezone day-slip
  if (/^\d{4}-\d{2}-\d{2}$/.test(input)) {
    const d = new Date(`${input}T12:00:00`);
    return isNaN(d.getTime()) ? null : d;
  }

  const d = new Date(input);
  return isNaN(d.getTime()) ? null : d;
};

const prettyDate = (d: string | Date): string => {
  const dt = normalizeDate(d);
  if (!dt) {
    return typeof d === "string" ? d : "";
  }
  const m = dt.toLocaleString("en-US", { month: "long" });
  const day = dt.getDate();
  const y = dt.getFullYear();
  return `${m} ${day}${ordinal(day)}, ${y}`;
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

// ✅ Reset back to normal body text after footer/page-break
const resetBodyTextStyle = (doc: jsPDF, size: number = 11) => {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(size);
  doc.setTextColor(0); // black
};

// convenience: write a paragraph with auto-wrap + page-breaks
function writeParagraph(
  doc: jsPDF,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  bottomMargin = 60,
  lock?: HTMLImageElement
) {
  const h = doc.internal.pageSize.getHeight();
  const lines = doc.splitTextToSize(text, maxWidth);
  let cursor = y;

  lines.forEach((ln: string) => {
    if (cursor > h - bottomMargin) {
      // finish page with footer (this sets tiny grey text)
      renderFooter(doc);
      doc.addPage();
      // re-add watermark if provided
      if (lock) {
        doc.addImage(lock, "JPEG", 40, 60, 130, 130);
      }
      // 🔥 go back to normal body text on the new page
      resetBodyTextStyle(doc, 11);
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
  deposit: number; // amount paid today (0 if full)
  paymentSummary: string; // e.g. “25% today, balance monthly…”
  weddingDate: string; // ISO or already-formatted
  signatureImageUrl: string;
  lineItems?: string[];
  signatureDate?: string; // OPTIONAL: e.g. "September 2nd, 2025"
  finalDuePretty?: string; // OPTIONAL: default "35 days before your wedding date"
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
  doc.text("Jam & Groove Agreement & Receipt", w / 2, 75, {
    align: "center",
  });

  // formatted wedding date (fixed day-slip)
  const formattedDate = prettyDate(weddingDate);

  // header info
  doc.setFontSize(12);
  resetBodyTextStyle(doc, 12);
  doc.text(`Name: ${fullName}`, 20, 90);
  doc.text(`Wedding Date: ${formattedDate}`, 20, 100);
  doc.text(`Total Jam & Groove Cost: $${Number(total).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}`, 20, 110);

  let y = 120;
  const bottomMargin = 60;

  const addPageIfNeeded = () => {
    if (y > h - bottomMargin) {
      renderFooter(doc);
      doc.addPage();
      doc.addImage(lock, "JPEG", 40, 60, 130, 130);
      y = 30;
      // 🔥 reset style after footer
      resetBodyTextStyle(doc, 12);
    }
  };

  // deposit line
  if (deposit > 0 && deposit !== total) {
    doc.text(`Deposit Paid Today: $${Number(deposit).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}`, 20, y);
    y += 10;
  }

  // payment plan line
  if (paymentSummary) {
    addPageIfNeeded();
    doc.text(`Payment Plan: ${paymentSummary}`, 20, y);
    y += 10;
  }

  // included items
  const filteredItems = (lineItems || []).filter(
    (it) => it && !it.startsWith("__")
  );
  if (filteredItems.length > 0) {
    addPageIfNeeded();
    doc.setFontSize(14);
    doc.setTextColor(0);
    doc.text("Included Items:", 20, y);
    y += 10;

    doc.setFontSize(12);
    resetBodyTextStyle(doc, 12);
    for (const item of filteredItems) {
      addPageIfNeeded();
      doc.text(`• ${item}`, 25, y);
      y += 8;
    }
  }

  // confirmation line (paid today)
  const todayPretty = prettyDate(new Date());
  const paidToday = deposit > 0 && deposit !== total ? deposit : total;

  y += 10;
  addPageIfNeeded();
  doc.setFontSize(12);
  resetBodyTextStyle(doc, 12);
  doc.text(
    `Total paid today: $${Number(paidToday).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})} on ${todayPretty}`,
    20,
    y
  );
  y += 12;

  /** -------- Legal Terms (aligned with contract screen) -------- */
doc.setFontSize(14);
doc.setTextColor(0);
doc.text("Booking Terms & Policies", 20, y);
y += 10;
resetBodyTextStyle(doc, 11);

const dueText = finalDuePretty || "35 days before your wedding date";

y = writeParagraph(
  doc,
  "By signing this agreement, your event date is reserved for Jam & Groove services (DJ and/or musicians).",
  20,
  y,
  w - 40,
  bottomMargin,
  lock
);

y += 4;
y = writeParagraph(
  doc,
  "Payment Options. You may either pay in full today, or place a non-refundable $750 deposit today with the remaining balance billed in monthly installments. All installments must be completed no later than " +
    dueText +
    ". Any remaining balance at that time will be automatically charged to the card on file.",
  20,
  y,
  w - 40,
  bottomMargin,
  lock
);

y += 4;
y = writeParagraph(
  doc,
  "Cancellation & Refunds. If you cancel more than 35 days before your event, amounts you have paid beyond the non-refundable portion are refundable, less any non-recoverable costs already incurred. If you cancel 35 days or fewer before the event, all payments made are non-refundable.",
  20,
  y,
  w - 40,
  bottomMargin,
  lock
);

y += 4;
y = writeParagraph(
  doc,
  "Missed Payments. If a payment attempt fails, we will automatically re-attempt your card. After 7 days, a $25 late fee may apply. After 14 days of non-payment, services may be suspended and this agreement may be considered in default.",
  20,
  y,
  w - 40,
  bottomMargin,
  lock
);

y += 4;
y = writeParagraph(
  doc,
  "Performance & Logistics. Your DJ / music team will typically arrive approximately 1 hour before guest arrival for setup and sound check. You agree to provide safe power, appropriate coverage or shade if outdoors, and any venue access needed. Travel outside the Phoenix Metro area or to certain locations may incur additional fees as discussed in your package.",
  20,
  y,
  w - 40,
  bottomMargin,
  lock
);

y += 4;
y = writeParagraph(
  doc,
  "Force Majeure. If events beyond anyone’s reasonable control (including but not limited to extreme weather, natural disasters, government restrictions, serious illness, or utility outages) prevent performance, the parties will work in good faith to reschedule. If rescheduling is not possible, amounts you have paid beyond non-recoverable costs will be refunded. If Jam & Groove must cancel for reasons within our control and a suitable replacement cannot be arranged, liability is limited to a refund of payments made.",
  20,
  y,
  w - 40,
  bottomMargin,
  lock
);

y += 4;
y = writeParagraph(
  doc,
  "Limitation of Liability. In all circumstances, Wed&Done’s liability related to this agreement is limited to the total amounts paid by Client under this agreement.",
  20,
  y,
  w - 40,
  bottomMargin,
  lock
);

  // -------- signature pinned to final page bottom --------
  const sigBlockHeight = 55;
  if (y > h - (sigBlockHeight + 35)) {
    renderFooter(doc);
    doc.addPage();
    doc.addImage(lock, "JPEG", 40, 60, 130, 130);
    resetBodyTextStyle(doc, 12);
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

  const signedPretty = signatureDate
    ? prettyDate(signatureDate)
    : todayPretty;

  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Signed by: ${fullName}`, 20, sigTop + 30 + 12);
  doc.text(`Signature date: ${signedPretty}`, 20, sigTop + 30 + 19);

  renderFooter(doc);
  return doc.output("blob");
};