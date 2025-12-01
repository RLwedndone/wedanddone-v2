import jsPDF from "jspdf";

interface PlannerPDFOptions {
  firstName: string;
  lastName: string;
  total: number;
  deposit: number;              // $0 if paid in full, otherwise usually $200
  payFull?: boolean;            // optional; inferred if omitted
  monthlyAmount?: number;       // optional, for parity with floral (not required)
  paymentSummary: string;
  weddingDate: string;          // ISO or human string
  signatureImageUrl: string;    // data URL
  lineItems?: string[];         // optional list, if you want to show included services
  guestCount?: number;          // optional extra field to display
  dayOfWeek?: string;           // optional "(Saturday)" etc.
}

export const generatePlannerAgreementPDF = async ({
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
  guestCount,
  dayOfWeek,
}: PlannerPDFOptions): Promise<Blob> => {
  const doc = new jsPDF();

  // ---- Layout constants (mirrors floral) ----
  const MARGIN_L = 20;
  const MARGIN_R = 20;
  const CONTENT_W = doc.internal.pageSize.getWidth() - MARGIN_L - MARGIN_R;
  const TOP_Y = 20;
  const LINE = 7;
  const GAP = 10;
  const FOOTER_GAP = 12;
  const FOOTER_LINE_GAP = 8;

  // ---------- helpers ----------

  // Footer draws the grey small text
  const drawFooter = () => {
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const footerTextY = pageH - FOOTER_GAP;
    const footerLineY = footerTextY - FOOTER_LINE_GAP;
    doc.setDrawColor(200);
    doc.line(MARGIN_L, footerLineY, pageW - MARGIN_R, footerLineY);
    doc.setFontSize(10);
    doc.setTextColor(120);
    doc.text(
      "Magically booked by Wed&Done",
      pageW / 2,
      footerTextY,
      { align: "center" }
    );
  };

  // After a footer / page break, go back to normal body text
  const resetBodyTextStyle = () => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(12);
    doc.setTextColor(0); // black
  };

  const contentMaxY = () => {
    const pageH = doc.internal.pageSize.getHeight();
    return pageH - FOOTER_GAP - FOOTER_LINE_GAP - 10;
  };

  let y = TOP_Y;

  const ensureSpace = (needed: number) => {
    if (y + needed <= contentMaxY()) return;
    // finish current page with footer
    drawFooter();
    // new page
    doc.addPage();
    // reset text style for normal body copy
    resetBodyTextStyle();
    y = TOP_Y;
  };

  // Wrapped text
  const writeText = (text: string, x = MARGIN_L) => {
    const lines = doc.splitTextToSize(text, CONTENT_W - (x - MARGIN_L));
    for (const ln of lines) {
      ensureSpace(LINE);
      doc.text(ln, x, y);
      y += LINE;
    }
  };

  // Bulleted text with hanging indent
  const writeBullet = (text: string) => {
    const bullet = "• ";
    const bulletW = doc.getTextWidth(bullet);
    const wrapW = CONTENT_W - bulletW;
    const lines = doc.splitTextToSize(text, wrapW);

    ensureSpace(LINE);
    doc.text(bullet, MARGIN_L, y);
    doc.text(lines[0], MARGIN_L + bulletW, y);
    y += LINE;

    for (const ln of lines.slice(1)) {
      ensureSpace(LINE);
      doc.text(ln, MARGIN_L + bulletW, y);
      y += LINE;
    }
  };

  // Date helpers (same style as floral)

  // Parse YYYY-MM-DD as *local* noon to avoid timezone shifting it back a day
  const parseLocalYMD = (ymd: string): Date | null => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
    return new Date(`${ymd}T12:00:00`);
  };

  const fmtOrdinal = (n: number) => {
    const s = ["th", "st", "nd", "rd"];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  };

  const longDate = (d: Date) =>
    `${d.toLocaleString("en-US", { month: "long" })} ${fmtOrdinal(
      d.getDate()
    )}, ${d.getFullYear()}`;

  // Normalize wedding date with timezone guard
  const weddingDateObj = (() => {
    const local = parseLocalYMD(weddingDate);
    if (local) return local;
    const raw = new Date(weddingDate);
    return isNaN(raw.getTime()) ? null : raw;
  })();

  const prettyWedding = weddingDateObj
    ? `${longDate(weddingDateObj)}${dayOfWeek ? ` (${dayOfWeek})` : ""}`
    : weddingDate;

  // Final due date: 35 days prior for planner, based on the *local* wedding date
  const finalDueDate = (() => {
    if (!weddingDateObj) return null;
    const d = new Date(weddingDateObj.getTime());
    d.setDate(d.getDate() - 35);
    return d;
  })();

  const finalDueStr = finalDueDate
    ? longDate(finalDueDate)
    : "35 days prior to event";

  // Infer payFull if not provided
  const isPayFull = payFull ?? (deposit <= 0 || deposit >= total);

  // ---- Assets (same pattern as floral) ----
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
    doc.addImage(lock, "JPEG", 40, 60, 130, 130); // watermark first (behind text)
    doc.addImage(logo, "JPEG", 75, 10, 60, 60);
  } catch {
    // ignore asset failures
  }

  // ---- Title ----
  doc.setFont("helvetica", "normal");
  doc.setFontSize(16);
  doc.setTextColor(0);
  doc.text(
    "Pixie Planner Agreement & Receipt",
    doc.internal.pageSize.getWidth() / 2,
    75,
    { align: "center" }
  );

  // Switch to normal body style for the rest
  resetBodyTextStyle();

  // ---- Basics ----
  y = 90;
  writeText(`Name: ${firstName || ""} ${lastName || ""}`);
  writeText(`Wedding Date: ${prettyWedding}`);
  if (Number.isFinite(guestCount)) writeText(`Guest Count: ${guestCount}`);

  writeText(`Total Coordination Cost: $${total.toFixed(2)}`);
  if (!isPayFull && deposit > 0) {
    writeText(`Deposit (flat $200): $${deposit.toFixed(2)}`);
  }

  // ---- Included Items (optional) ----
  if (lineItems.length) {
    y += 5;
    ensureSpace(LINE + GAP);
    doc.setFontSize(14);
    doc.text("Included Services:", MARGIN_L, y);
    y += GAP;
    doc.setFontSize(12);
    for (const item of lineItems) writeBullet(item);
  }

  // ---- Payment block (identical style to floral) ----
  const todayStr = longDate(new Date());

  y += 6;
  if (isPayFull) {
    writeText(`Paid today: $${total.toFixed(2)} on ${todayStr}`);
    writeText(
      `Final balance due date: ${finalDueStr} (paid in full today).`
    );
  } else {
    const remaining = Math.max(0, total - deposit);
    writeText(`Deposit paid today: $${deposit.toFixed(2)} on ${todayStr}`);
    writeText(
      `Remaining balance: $${remaining.toFixed(
        2
      )} to be billed automatically in monthly installments, with the final payment due by ${finalDueStr}.`
    );
  }

  if (paymentSummary) {
    y += 4;
    writeText(`Payment Plan: ${paymentSummary}`);
  }

  // ---- Terms (same structure, but using correct styles/page breaks) ----
  y += 8;
  ensureSpace(LINE + GAP);
  doc.setTextColor(50);
  doc.setFontSize(12);
  doc.text("Terms of Service:", MARGIN_L, y);
  y += GAP;

  const terms = [
    "By signing this agreement, you agree that the $200 deposit is non-refundable.",
    "The remaining balance will be billed in monthly installments with the final payment due 35 days before your wedding date unless you pay in full today or clear the balance earlier.",
    "If you cancel more than 35 days prior to your wedding, amounts paid beyond the non-refundable deposit will be refunded less any non-recoverable costs already incurred.",
    "If you cancel within 35 days of the event, all payments are non-refundable.",
    "Reschedules are subject to planner and vendor availability; any additional fees will be the client’s responsibility.",
    "Additional on-site hours or extraordinary setup labor may incur extra charges with your prior approval.",
    "Wed&Done is not responsible for venue restrictions or consequential damages.",
    "Our liability is limited to the amounts you have paid for planning services under this agreement.",
    "Force Majeure: Neither party is liable for failure or delay caused by events beyond reasonable control (including natural disasters, acts of government, war, terrorism, labor disputes, epidemics/pandemics, or utility outages).",
    "If performance is prevented, we’ll work in good faith to reschedule.",
    "If rescheduling isn’t possible, we’ll refund any amounts paid beyond non-recoverable costs already incurred.",
    "Missed Payments: If any installment payment is not successfully processed by the due date, Wed&Done will automatically attempt to re-charge the card on file. If payment is not received within 7 days, a late fee of $25 will be applied. If payment remains outstanding for more than 14 days, Wed&Done reserves the right to suspend services and declare this agreement in default. In the event of default, all amounts paid (including the non-refundable deposit) will be retained by Wed&Done, and the booking may be cancelled without further obligation.",
  ];
  for (const t of terms) writeBullet(t);

  // ---- Signature anchored to bottom (same pattern as floral) ----
  const placeSignature = () => {
    const pageH = doc.internal.pageSize.getHeight();
    const footerTextY = pageH - FOOTER_GAP;
    const footerLineY = footerTextY - FOOTER_LINE_GAP;

    const sigImgH = 30;
    const sigBlockH =
      5 /*label*/ + sigImgH + 14 /*two lines*/ + 6 /*pad*/;

    if (y + 15 + sigBlockH > footerLineY - 10) {
      drawFooter();
      doc.addPage();
      resetBodyTextStyle();
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
      // ignore image failure, keep layout stable
    }

    const signedLineY = sigTop + 5 + sigImgH;
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(
      `Signed by: ${firstName || ""} ${lastName || ""}`,
      left,
      signedLineY + 7
    );
    doc.text(
      `Signature date: ${todayStr}`,
      left,
      signedLineY + 14
    );

    drawFooter();
  };

  placeSignature();

  return doc.output("blob");
};