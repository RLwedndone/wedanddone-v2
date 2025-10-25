import jsPDF from "jspdf";

interface PDFOptions {
  firstName: string;
  lastName: string;
  total: number;
  deposit: number;
  payFull: boolean;
  monthlyAmount?: number;
  paymentSummary: string;
  weddingDate: string;
  signatureImageUrl: string;
  lineItems?: string[];
}

export const generateFloralAgreementPDF = async ({
  firstName,
  lastName,
  total,
  deposit,
  payFull,
  monthlyAmount = 0,
  paymentSummary,
  weddingDate,
  signatureImageUrl,
  lineItems = [],
}: PDFOptions): Promise<Blob> => {
  const doc = new jsPDF();

  // ---- Layout constants ----
  const MARGIN_L = 20;
  const MARGIN_R = 20;
  const CONTENT_W = doc.internal.pageSize.getWidth() - MARGIN_L - MARGIN_R; // ~170
  const TOP_Y = 20;
  const LINE = 7;     // line height
  const GAP = 10;     // paragraph gap
  const FOOTER_GAP = 12; // gap above footer text
  const FOOTER_LINE_GAP = 8; // line above footer text

  // Footer drawer + available content max Y for this page
  const drawFooter = () => {
    const pageH = doc.internal.pageSize.getHeight();
    const footerTextY = pageH - FOOTER_GAP;
    const footerLineY = footerTextY - FOOTER_LINE_GAP;
    doc.setDrawColor(200);
    doc.line(MARGIN_L, footerLineY, doc.internal.pageSize.getWidth() - MARGIN_R, footerLineY);
    doc.setFontSize(10);
    doc.setTextColor(120);
    doc.text("Magically booked by Wed&Done", doc.internal.pageSize.getWidth() / 2, footerTextY, { align: "center" });
  };
  const contentMaxY = () => {
    const pageH = doc.internal.pageSize.getHeight();
    return pageH - FOOTER_GAP - FOOTER_LINE_GAP - 10; // safe zone
  };

  let y = TOP_Y;

  // Ensure there is room for N vertical space; otherwise close page & start a new one
  const ensureSpace = (needed: number) => {
    if (y + needed <= contentMaxY()) return;
    drawFooter();
    doc.addPage();
    y = TOP_Y;
  };

  // Wrapped text helper
  const writeText = (text: string, x = MARGIN_L) => {
    const lines = doc.splitTextToSize(text, CONTENT_W - (x - MARGIN_L));
    for (const ln of lines) {
      ensureSpace(LINE);
      doc.text(ln, x, y);
      y += LINE;
    }
  };

  // Bulleted item with hanging indent
  const writeBullet = (text: string) => {
    const bullet = "• ";
    const bulletW = doc.getTextWidth(bullet);
    const wrapW = CONTENT_W - bulletW;
    const lines = doc.splitTextToSize(text, wrapW);
    ensureSpace(LINE);
    doc.text(bullet, MARGIN_L, y); // bullet
    // first line continued after bullet
    doc.text(lines[0], MARGIN_L + bulletW, y);
    y += LINE;
    // remaining lines aligned to the text start position
    for (const ln of lines.slice(1)) {
      ensureSpace(LINE);
      doc.text(ln, MARGIN_L + bulletW, y);
      y += LINE;
    }
  };

  // Date formatting helpers
  const fmtOrdinal = (n: number) => {
    const s = ["th", "st", "nd", "rd"];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  };
  const longDate = (d: Date) =>
    `${d.toLocaleString("en-US", { month: "long" })} ${fmtOrdinal(d.getDate())}, ${d.getFullYear()}`;

  const prettyWedding = (() => {
    const d = new Date(weddingDate);
    return isNaN(d.getTime()) ? weddingDate : longDate(d);
  })();

  const finalDueDate = (() => {
    const d = new Date(weddingDate);
    if (isNaN(d.getTime())) return null;
    d.setDate(d.getDate() - 30);
    return d;
  })();
  const finalDueStr = finalDueDate ? longDate(finalDueDate) : "30 days prior to event";

  // ---- Assets ----
  const loadImage = (src: string): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });

  try {
    const [logo, lock] = await Promise.all([
      loadImage(`${import.meta.env.BASE_URL}assets/images/rainbow_logo.jpg`),
      loadImage(`${import.meta.env.BASE_URL}assets/images/lock_grey.jpg`),
    ]);
    doc.addImage(lock, "JPEG", 40, 60, 130, 130); // watermark under text (drawn first)
    doc.addImage(logo, "JPEG", 75, 10, 60, 60);
  } catch { /* ignore asset failures */ }

  // ---- Title ----
  doc.setFont("helvetica", "normal");
  doc.setFontSize(16);
  doc.setTextColor(0);
  doc.text("Floral Agreement & Receipt", doc.internal.pageSize.getWidth() / 2, 75, { align: "center" });

  // ---- Basics ----
  doc.setFontSize(12);
  y = 90;
  writeText(`Name: ${firstName || ""} ${lastName || ""}`);
  writeText(`Wedding Date: ${prettyWedding}`);
  writeText(`Total Floral Cost: $${total.toFixed(2)}`);
  if (!payFull && deposit > 0) writeText(`Deposit (25%): $${deposit.toFixed(2)}`);

  // ---- Included Items ----
  if (lineItems.length) {
    y += 5;
    ensureSpace(LINE + GAP);
    doc.setFontSize(14);
    doc.text("Included Items:", MARGIN_L, y);
    y += GAP;
    doc.setFontSize(12);
    for (const item of lineItems) writeBullet(item);
  }

  // ---- Payment block ----
  const todayStr = longDate(new Date());
  y += 6;
  if (payFull) {
    writeText(`Paid today: $${total.toFixed(2)} on ${todayStr}`);
    writeText(`Final balance due date: ${finalDueStr} (paid in full today).`);
  } else {
    const remaining = Math.max(0, total - deposit);
    writeText(`Deposit paid today: $${deposit.toFixed(2)} on ${todayStr}`);
    writeText(`Remaining balance: $${remaining.toFixed(2)} to be billed automatically in monthly installments.`);
    writeText(`Final installment must be completed by: ${finalDueStr}.`);
  }

  // ---- Terms ----
  y += 8;
  ensureSpace(LINE + GAP);
  doc.setTextColor(50);
  doc.setFontSize(12);
  doc.text("Terms of Service:", MARGIN_L, y);
  y += GAP;

  const terms = [
    "By signing this agreement, you agree that at minimum 25% of the floral total is non-refundable.",
    "The remaining balance will be charged 30 days before your wedding date unless you pay in full today or clear the balance earlier.",
    "If you cancel more than 30 days prior to your wedding, amounts paid beyond the non-refundable portion will be refunded less any non-recoverable costs already incurred.",
    "If you cancel within 30 days, all payments are non-refundable.",
    "Reschedules are subject to vendor availability, and any additional fees will be the client’s responsibility.",
    "Because flowers are perishable, comparable substitutions may be made if certain varieties are unavailable.",
    "Any rented vases, stands, or décor remain the property of Wed&Done or its vendors and must be returned in good condition, or replacement costs will apply.",
    "Wed&Done is not responsible for venue restrictions, undisclosed allergies, or consequential damages.",
    "Our liability is limited to the amounts you have paid for floral services under this agreement.",
    "Force Majeure: Neither party is liable for failure or delay caused by events beyond reasonable control (including natural disasters, acts of government, war, terrorism, labor disputes, epidemics/pandemics, or utility outages).",
    "If performance is prevented, we’ll work in good faith to reschedule.",
    "If rescheduling isn’t possible, we’ll refund any amounts paid beyond non-recoverable costs already incurred.",
    "Missed Payments: If any installment payment is not successfully processed by the due date, Wed&Done will automatically attempt to re-charge the card on file. If payment is not received within 7 days, a late fee of $25 will be applied. If payment remains outstanding for more than 14 days, Wed&Done reserves the right to suspend services and declare this agreement in default. In the event of default, all amounts paid (including the non-refundable deposit) will be retained by Wed&Done, and the booking may be cancelled without further obligation.",
  ];
  for (const t of terms) writeBullet(t);

  // ---- Signature anchored to the last page (never overlaps) ----
  const placeSignature = () => {
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const footerTextY = pageH - FOOTER_GAP;
    const footerLineY = footerTextY - FOOTER_LINE_GAP;
    const sigImgH = 30;
    const sigBlockH = 5 /*label*/ + sigImgH + 14 /*two lines*/ + 6 /*pad*/;

    // If not enough space for the whole block, push to a fresh page bottom
    if (y + 15 + sigBlockH > footerLineY - 10) {
      drawFooter();
      doc.addPage();
      y = TOP_Y;
    }

    const sigTop = Math.min(y + 15, footerLineY - sigBlockH - 10);
    const left = MARGIN_L;

    doc.setTextColor(0);
    doc.setFontSize(12);
    doc.text("Signature:", left, sigTop);

    try {
      if (signatureImageUrl) {
        doc.addImage(signatureImageUrl, "PNG", left, sigTop + 5, 80, sigImgH);
      }
    } catch { /* ignore bad image */ }

    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Signed by: ${firstName || ""} ${lastName || ""}`, left, sigTop + 5 + sigImgH + 7);
    doc.text(`Signature date: ${todayStr}`, left, sigTop + 5 + sigImgH + 14);

    drawFooter();
  };

  placeSignature();

  return doc.output("blob");
};