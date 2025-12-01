import jsPDF from "jspdf";

interface PDFOptions {
  firstName: string;
  lastName: string;
  total: number;
  deposit: number;               // 0 if paid in full (will show 50% label when >0 && < total)
  paymentSummary: string;        // optional narrative (“You’re paying … then monthly …”)
  weddingDate: string;           // ISO (YYYY-MM-DD) or human string
  signatureImageUrl: string;     // data URL (PNG)
  lineItems?: string[];
  photoStyle?: string;           // NEW: “Light & Airy” / “True to Life”
}

/* -------------------- helpers -------------------- */
const ordinal = (n: number) => {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
};

const fmtLong = (d: Date) =>
  `${d.toLocaleString("en-US", { month: "long" })} ${d.getDate()}${ordinal(
    d.getDate()
  )}, ${d.getFullYear()}`;

const prettyDate = (raw: string): string => {
  const d = new Date(raw);
  return isNaN(d.getTime()) ? raw : fmtLong(d);
};

const finalDueMinusDays = (raw: string, days: number): Date | null => {
  const d = new Date(raw);
  if (isNaN(d.getTime())) return null;
  const out = new Date(d);
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

  // footer style
  doc.setDrawColor(200);
  doc.line(20, lineY, w - 20, lineY);
  doc.setFontSize(10);
  doc.setTextColor(120);
  doc.text("Magically booked by Wed&Done", w / 2, lineY + 8, {
    align: "center",
  });

  // 🔁 IMPORTANT: restore body style for anything after the footer
  setBodyFont(doc);
};

export const generatePhotoAgreementPDF = async ({
  firstName,
  lastName,
  total,
  deposit,
  paymentSummary,
  weddingDate,
  signatureImageUrl,
  lineItems = [],
  photoStyle,
}: PDFOptions): Promise<Blob> => {
  const doc = new jsPDF();
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();

  // layout guards
  const TOP = 20;
  const LEFT = 20;
  const RIGHT = w - 20;
  const FOOTER_GAP = 28; // keep content above footer area
  const contentMaxY = () => h - FOOTER_GAP;
  let y = TOP;

  const ensureSpace = (needed: number) => {
    if (y + needed <= contentMaxY()) return;
    renderFooter(doc);
    doc.addPage();
    // watermark on subsequent pages
    try {
      doc.addImage(
        `${import.meta.env.BASE_URL}assets/images/lock_grey.jpg`,
        "JPEG",
        40,
        60,
        130,
        130
      );
    } catch {}
    y = TOP;
    // 🔁 reset text style after new page
    setBodyFont(doc);
  };

  // assets
  try {
    const [logo, lock] = await Promise.all([
      loadImage(`${import.meta.env.BASE_URL}assets/images/rainbow_logo.jpg`),
      loadImage(`${import.meta.env.BASE_URL}assets/images/lock_grey.jpg`),
    ]);
    doc.addImage(lock, "JPEG", 40, 60, 130, 130); // watermark
    doc.addImage(logo, "JPEG", 75, 10, 60, 60);
  } catch {
    // continue if assets fail
  }

  // header
  setBodyFont(doc);
  doc.setFontSize(16);
  doc.text("Photography Agreement & Receipt", w / 2, 75, {
    align: "center",
  });

  // basics
  setBodyFont(doc);
  y = 90;
  const wedPretty = prettyDate(weddingDate);
  doc.text(`Name: ${firstName || ""} ${lastName || ""}`, LEFT, y);
  y += 8;
  doc.text(`Wedding Date: ${wedPretty}`, LEFT, y);
  y += 8;
  doc.text(
    `Photo Style: ${photoStyle && photoStyle.trim() ? photoStyle : "Not selected"}`,
    LEFT,
    y
  );
  y += 8;
  doc.text(
    `Total Photography Cost: $${total.toFixed(2)}`,
    LEFT,
    y
  );
  if (deposit > 0 && deposit < total) {
    y += 8;
    doc.text(`Deposit (50%): $${deposit.toFixed(2)}`, LEFT, y);
  }
  y += 12;

  // line items
  if (lineItems.length > 0) {
    ensureSpace(10);
    doc.setFontSize(14);
    doc.text("Included Items:", LEFT, y);
    y += 10;
    setBodyFont(doc);
    for (const item of lineItems) {
      ensureSpace(8);
      const wrapped = doc.splitTextToSize(`• ${item}`, RIGHT - LEFT - 5);
      doc.text(wrapped, LEFT + 5, y);
      y += 8 + (wrapped.length - 1) * 6;
    }
    y += 4;
  }

  // payment details
  const todayPretty = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const finalDue = finalDueMinusDays(weddingDate, 35);
  const finalDuePretty = finalDue
    ? fmtLong(finalDue)
    : "35 days before your wedding date";

  ensureSpace(24);
  setBodyFont(doc);
  const paidToday = deposit > 0 && deposit < total ? deposit : total;
  doc.text(
    `Paid today: $${paidToday.toFixed(2)} on ${todayPretty}`,
    LEFT,
    y
  );
  y += 8;

  if (deposit > 0 && deposit < total) {
    ensureSpace(8);
    const remaining = Math.max(0, total - deposit);
    const planText = `Remaining balance: $${remaining.toFixed(
      2
    )} to be billed automatically in monthly installments, with the final payment due by ${finalDuePretty}.`;
    const wrappedPlan = doc.splitTextToSize(planText, RIGHT - LEFT);
    doc.text(wrappedPlan, LEFT, y);
    y += wrappedPlan.length * 6 + 2;
  } else {
    ensureSpace(8);
    const paidFullText = `Final balance due date: ${finalDuePretty} (paid in full today).`;
    const wrappedFull = doc.splitTextToSize(paidFullText, RIGHT - LEFT);
    doc.text(wrappedFull, LEFT, y);
    y += wrappedFull.length * 6 + 2;
  }

  if (paymentSummary) {
    ensureSpace(8);
    const summaryWrapped = doc.splitTextToSize(
      `Payment Plan: ${paymentSummary}`,
      RIGHT - LEFT
    );
    doc.text(summaryWrapped, LEFT, y);
    y += summaryWrapped.length * 6 + 2;
  }

  // legal terms
  ensureSpace(14);
  doc.setTextColor(50);
  doc.setFontSize(12);
  doc.text("Terms of Service:", LEFT, y);
  y += 10;

  setBodyFont(doc);
  const terms: string[] = [
    "By signing this agreement, you acknowledge that a minimum of 50% of the photography total is non-refundable. If you cancel more than 35 days prior to your wedding, amounts paid beyond the non-refundable portion will be refunded less any non-recoverable costs already incurred. If you cancel within 35 days, all payments are non-refundable.",
    "Missed Payments: If any installment is not successfully processed by the due date, Wed&Done will automatically attempt to re-charge the card on file. If payment is not received within 7 days, a $25 late fee will be applied. If payment remains outstanding for more than 14 days, Wed&Done may suspend services and declare this agreement in default. In the event of default, all amounts paid (including the non-refundable deposit) may be retained and the booking may be cancelled.",
    "Image Delivery & Rights: Final edited images will be delivered digitally. You are granted a limited copyright license for personal use (sharing, printing, and enjoying). The photographer may display select images for portfolio and promotional purposes.",
    "Venue/Officiant Rules: We will comply with venue or officiant rules which may limit certain photographs or flash usage.",
    "Liability: Wed&Done is not responsible for consequential damages. Our liability is limited to amounts paid for photography services under this agreement.",
    "Force Majeure: Neither party is liable for failure or delay caused by events beyond reasonable control (including natural disasters, acts of government, war, terrorism, labor disputes, epidemics/pandemics, or utility outages). If performance is prevented, we’ll work in good faith to reschedule. If rescheduling isn’t possible, amounts paid beyond non-recoverable costs already incurred will be refunded.",
  ];

  for (const t of terms) {
    ensureSpace(10);
    const wrapped = doc.splitTextToSize(`• ${t}`, RIGHT - LEFT - 5);
    doc.text(wrapped, LEFT + 5, y);
    y += wrapped.length * 6 + 2;
  }

  // signature block anchored above footer
  const sigImageMaxW = 100;
  const sigImageMaxH = 35;
  const sigBlockNeeded = 5 + sigImageMaxH + 7 + 7 + 6;

  const placeSignature = () => {
    const footerTop = h - FOOTER_GAP + 8;
    if (y + sigBlockNeeded > footerTop - 10) {
      renderFooter(doc);
      doc.addPage();
      try {
        doc.addImage(
          `${import.meta.env.BASE_URL}assets/images/lock_grey.jpg`,
          "JPEG",
          40,
          60,
          130,
          130
        );
      } catch {}
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
    const todayPretty = new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    doc.text(`Signed by: ${firstName || ""} ${lastName || ""}`, LEFT, y);
    y += 7;
    doc.text(`Signature date: ${todayPretty}`, LEFT, y);
  };

  placeSignature();
  renderFooter(doc);

  return doc.output("blob");
};