import jsPDF from "jspdf";

interface PDFOptions {
  firstName: string;
  lastName: string;
  total: number;
  deposit: number;               // 0 if paid in full
  paymentSummary: string;        // currently unused in PDF body (kept for compatibility)
  weddingDate: string;           // ISO (YYYY-MM-DD) or human string
  signatureImageUrl: string;     // data URL (PNG)
  lineItems?: string[];
  photoStyle?: string;           // “Light & Airy” / “True to Life”
}

/* -------------------- helpers -------------------- */
const ordinal = (n: number) => {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
};

// Parse dates safely, treating bare YYYY-MM-DD as *local noon*
// to avoid timezone roll-back / “one day early” bugs.
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

const prettyDate = (raw: string): string => {
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

  // footer style
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

export const generatePhotoAgreementPDF = async ({
  firstName,
  lastName,
  total,
  deposit,
  paymentSummary, // kept for compatibility, not rendered
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
    // finish current page
    renderFooter(doc);
    doc.addPage();
    y = TOP;
    // reset text style after new page
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
    `Total Photography Cost: $${Number(total).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`,
    LEFT,
    y
  );
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

  // NOTE: We intentionally do NOT render `paymentSummary` here anymore
  // to avoid duplicate/conflicting “Payment Plan:” language.

  // legal terms
  ensureSpace(14);
  doc.setTextColor(50);
  doc.setFontSize(12);
  // 🔹 Match on-screen heading
  doc.text("Booking Terms:", LEFT, y);
  y += 10;

  setBodyFont(doc);

  // 🔹 First bullet matches the PhotoContract “Payment Options & Card Authorization”
  const terms: string[] = [
    "Payment Options & Card Authorization: You may pay in full today, or place a 50% non-refundable deposit and pay the remaining balance in monthly installments. All installments must be completed no later than 35 days before your wedding date, and any unpaid balance will be automatically charged on that date. By completing this purchase, you authorize Wed&Done and our payment processor (Stripe) to securely store your card for: (a) photography installment payments and any final balance due under this agreement, and (b) future Wed&Done purchases you choose to make, for your convenience. Your card details are encrypted and handled by Stripe, and you can update or replace your saved card at any time through your Wed&Done account. If you pay in full today, your card will only be stored if you choose that option at checkout.",
    "Cancellations & Refunds: If you cancel more than 35 days prior to your wedding, amounts paid beyond the non-refundable deposit will be refunded less any non-recoverable costs already incurred. If you cancel within 35 days, all payments are non-refundable.",
    "Missed Payments: We will retry your card automatically. If payment is not received within 7 days, a $25 late fee may apply; after 14 days, services may be suspended and the agreement may be declared in default, in which case all amounts paid (including the deposit) may be retained and the booking cancelled.",
    "Image Delivery & Usage: Final edited images are delivered via Dropbox within 90 days of the wedding date. You receive a limited copyright license for personal use (sharing and printing). The photographer may display select images for portfolio or promotional use. Venue and officiant rules may limit certain photographs; we will comply with all restrictions.",
    "Force Majeure: Neither party is liable for delays caused by events beyond reasonable control (including natural disasters, government orders, war, terrorism, labor disputes, epidemics/pandemics, or utility outages). If performance is prevented, we will work in good faith to reschedule; if rescheduling is not possible, amounts paid beyond non-recoverable costs already incurred will be refunded. Liability is otherwise limited to a refund of payments made.",
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
    const sigDatePretty = new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    doc.text(`Signed by: ${firstName || ""} ${lastName || ""}`, LEFT, y);
    y += 7;
    doc.text(`Signature date: ${sigDatePretty}`, LEFT, y);
  };

  placeSignature();
  renderFooter(doc);

  return doc.output("blob");
};