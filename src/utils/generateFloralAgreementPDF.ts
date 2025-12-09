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
  const CONTENT_W =
    doc.internal.pageSize.getWidth() - MARGIN_L - MARGIN_R; // ~170
  const TOP_Y = 20;
  const LINE = 7; // line height
  const GAP = 10; // paragraph gap
  const FOOTER_GAP = 12; // gap above footer text
  const FOOTER_LINE_GAP = 8; // line above footer text

  // Footer drawer + available content max Y for this page
  const drawFooter = () => {
    const pageH = doc.internal.pageSize.getHeight();
    const footerTextY = pageH - FOOTER_GAP;
    const footerLineY = footerTextY - FOOTER_LINE_GAP;
    doc.setDrawColor(200);
    doc.line(
      MARGIN_L,
      footerLineY,
      doc.internal.pageSize.getWidth() - MARGIN_R,
      footerLineY
    );
    doc.setFontSize(10);
    doc.setTextColor(120);
    doc.text(
      "Magically booked by Wed&Done",
      doc.internal.pageSize.getWidth() / 2,
      footerTextY,
      { align: "center" }
    );
  };

  const contentMaxY = () => {
    const pageH = doc.internal.pageSize.getHeight();
    return pageH - FOOTER_GAP - FOOTER_LINE_GAP - 10; // safe zone
  };

  // Reset normal body text style after a page break
  const resetBodyTextStyle = () => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(12);
    doc.setTextColor(0); // black
  };

  let y = TOP_Y;

  // Ensure there is room for N vertical space; otherwise close page & start a new one
  const ensureSpace = (needed: number) => {
    if (y + needed <= contentMaxY()) return;

    // finish current page
    drawFooter();

    // new page
    doc.addPage();
    y = TOP_Y;

    // back to normal body text after footer changes
    resetBodyTextStyle();
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
    `${d.toLocaleString("en-US", { month: "long" })} ${fmtOrdinal(
      d.getDate()
    )}, ${d.getFullYear()}`;

  // Parse "YYYY-MM-DD" safely in local time (no UTC shift).
  const parseLocalYMD = (ymd: string): Date | null => {
    const m = ymd.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return null;
    const year = Number(m[1]);
    const monthIndex = Number(m[2]) - 1; // JS months are 0-based
    const day = Number(m[3]);
    // noon local time so -35 days math is safe & no off-by-one from TZ  👈 UPDATED COMMENT
    return new Date(year, monthIndex, day, 12, 0, 0);
  };

  const prettyWedding = (() => {
    const safe = parseLocalYMD(weddingDate) || new Date(weddingDate);
    return isNaN(safe.getTime()) ? weddingDate : longDate(safe);
  })();

  const finalDueDate = (() => {
    const base = parseLocalYMD(weddingDate) || new Date(weddingDate);
    if (isNaN(base.getTime())) return null;
    const d = new Date(base.getTime());
    d.setDate(d.getDate() - 35);            // 👈 CHANGED from 30 → 35
    return d;
  })();

  const finalDueStr = finalDueDate
    ? longDate(finalDueDate)
    : "35 days before your wedding date";   // 👈 CHANGED fallback text

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
    // watermark under text (drawn first)
    doc.addImage(lock, "JPEG", 40, 60, 130, 130);
    doc.addImage(logo, "JPEG", 75, 10, 60, 60);
  } catch {
    /* ignore asset failures */
  }

  // ---- Title ----
  doc.setFont("helvetica", "normal");
  doc.setFontSize(16);
  doc.setTextColor(0);
  doc.text(
    "Floral Agreement & Receipt",
    doc.internal.pageSize.getWidth() / 2,
    75,
    { align: "center" }
  );

  // ---- Basics ----
  doc.setFontSize(12);
  y = 90;
  writeText(`Name: ${firstName || ""} ${lastName || ""}`);
  writeText(`Wedding Date: ${prettyWedding}`);
  writeText(
    `Total Floral Cost: $${Number(total).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`
  );
  if (!payFull && deposit > 0) {
    writeText(
      `Deposit (25%): $${Number(deposit).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`
    );
  }

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
    writeText(
      `Paid today: $${Number(total).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })} on ${todayStr}`
    );
    writeText(
      `Final balance due date: ${finalDueStr} (paid in full today).`
    );
  } else {
    const remaining = Math.max(0, total - deposit);
    writeText(
      `Deposit paid today: $${Number(deposit).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })} on ${todayStr}`
    );
    writeText(
      `Remaining balance: $${Number(remaining).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })} to be billed automatically in monthly installments.`
    );
    writeText(
      `Final installment must be completed by: ${finalDueStr}.`
    );
  }

  // ---- Terms ----
  y += 8;
  ensureSpace(LINE + GAP);
  doc.setTextColor(50);
  doc.setFontSize(12);
  doc.text("Terms of Service:", MARGIN_L, y);
  y += GAP;

  // 🔁 Booking Terms – mirrored exactly from FloralContract screen (35 days)
  const terms: string[] = [
    // 1) Perishable / substitutions / rentals
    "Because flowers are perishable, comparable substitutions may be made if certain varieties are unavailable. Rented vases, stands, and décor remain Wed&Done or vendor property and must be returned in good condition (replacement costs apply if damaged or missing).",

    // 2) Payment Options & Card Authorization
    "Payment Options & Card Authorization: You may pay in full today, or place a 25% non-refundable deposit and pay the remaining balance in monthly installments. All installments must be completed no later than 35 days before your wedding date, and any unpaid balance will be automatically charged on that date. By completing this purchase, you authorize Wed&Done and our payment processor (Stripe) to securely store your card for: (a) floral installment payments and any final balance due under this agreement, and (b) future Wed&Done purchases you choose to make, for your convenience. Your card details are encrypted and handled by Stripe, and you can update or replace your saved card at any time through your Wed&Done account.",

    // 3) Liability + venue restrictions / allergies
    "Wed&Done isn’t responsible for venue restrictions, undisclosed allergies, or consequential damages. Our liability is limited to amounts you have paid for floral services under this agreement.",

    // 4) Missed payments
    "Missed Payments: We’ll retry your card automatically. If payment isn’t received within 7 days, a $25 late fee applies; after 14 days, services may be suspended and the agreement may be in default.",

    // 5) Force majeure
    "Force Majeure: Neither party is liable for delays beyond reasonable control. We’ll work in good faith to reschedule; if not possible, we’ll refund amounts paid beyond non-recoverable costs.",
  ];

  for (const t of terms) writeBullet(t);

  // ---- Signature anchored to the last page (never overlaps) ----
  const placeSignature = () => {
    const pageH = doc.internal.pageSize.getHeight();
    const footerTextY = pageH - FOOTER_GAP;
    const footerLineY = footerTextY - FOOTER_LINE_GAP;
    const sigImgH = 30;
    const sigBlockH =
      5 /*label*/ + sigImgH + 14 /*two lines*/ + 6 /*pad*/;

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
        doc.addImage(
          signatureImageUrl,
          "PNG",
          left,
          sigTop + 5,
          80,
          sigImgH
        );
      }
    } catch {
      /* ignore bad image */
    }

    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(
      `Signed by: ${firstName || ""} ${lastName || ""}`,
      left,
      sigTop + 5 + sigImgH + 7
    );
    doc.text(
      `Signature date: ${todayStr}`,
      left,
      sigTop + 5 + sigImgH + 14
    );

    drawFooter();
  };

  placeSignature();

  return doc.output("blob");
};