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
  monthlyAmount = 0, // kept for compatibility; not rendered directly
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

  const drawFooter = () => {
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const footerTextY = pageH - FOOTER_GAP;
    const footerLineY = footerTextY - FOOTER_LINE_GAP;
    doc.setDrawColor(200);
    doc.line(MARGIN_L, footerLineY, pageW - MARGIN_R, footerLineY);
    doc.setFontSize(10);
    doc.setTextColor(120);
    doc.text("Magically booked by Wed&Done", pageW / 2, footerTextY, {
      align: "center",
    });
  };

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
    drawFooter();
    doc.addPage();
    resetBodyTextStyle();
    y = TOP_Y;
  };

  // Wrapped text with support for "\n"
  const writeText = (text: string, x = MARGIN_L) => {
    const paragraphs = text.split("\n");
    for (const para of paragraphs) {
      const lines = doc.splitTextToSize(
        para,
        CONTENT_W - (x - MARGIN_L)
      ) as string[];
      for (const ln of lines) {
        ensureSpace(LINE);
        doc.text(ln, x, y);
        y += LINE;
      }
    }
  };

  // Bulleted text with hanging indent
  const writeBullet = (text: string) => {
    const bullet = "• ";
    const bulletW = doc.getTextWidth(bullet);
    const wrapW = CONTENT_W - bulletW;
    const lines = doc.splitTextToSize(text, wrapW) as string[];

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

  // Final due date: 35 days prior
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
    doc.addImage(lock, "JPEG", 40, 60, 130, 130); // watermark
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

  // Body
  resetBodyTextStyle();

  // ---- Basics ----
  y = 90;
  writeText(`Name: ${firstName || ""} ${lastName || ""}`);
  writeText(`Wedding Date: ${prettyWedding}`);
  if (Number.isFinite(guestCount)) writeText(`Guest Count: ${guestCount}`);

  writeText(
    `Total Coordination Cost: $${Number(total).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`
  );
  if (!isPayFull && deposit > 0) {
    writeText(
      `Deposit (flat $200): $${Number(deposit).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`
    );
  }

  // ---- Included Items (optional) ----
  if (lineItems.length) {
    y += 5;
    ensureSpace(LINE + GAP);
    doc.setFontSize(14);
    doc.text("Included Services:", MARGIN_L, y);
    y += GAP;
    doc.setFontSize(12);
    resetBodyTextStyle();
    for (const item of lineItems) writeBullet(item);
  }

  // ---- Payment block ----
  const todayStr = longDate(new Date());

  y += 6;
  if (isPayFull) {
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
      })} to be billed automatically in monthly installments, with the final payment due by ${finalDueStr}.`
    );
  }

  if (paymentSummary) {
    y += 4;
    writeText(`Payment Plan: ${paymentSummary}`);
  }

  // ---- Terms (now mirror the on-screen contract text) ----
  y += 8;
  ensureSpace(LINE + GAP);
  doc.setFontSize(12);
  doc.setTextColor(50);
  doc.text("Terms of Service:", MARGIN_L, y);
  y += GAP;
  resetBodyTextStyle(); // bullets in normal body style (black, 12)

  const terms: string[] = [
    // Payment options: matches first bullet in PlannerContract
    "You may pay in full today or make a $200 non-refundable deposit. Any remaining balance will be divided into monthly installments and must be fully paid 35 days before your wedding date. Any unpaid balance on that date will be automatically charged.",
    // Card authorization: matches second bullet
    "By signing, you authorize Wed&Done to securely store your payment method and automatically process scheduled payments, including add-ons or increases to your guest count that you approve during planning.",
    // Refunds & cancellations
    "Refunds & Cancellations: At minimum, $200 is non-refundable. If you cancel more than 35 days prior to your wedding, amounts paid beyond the non-refundable portion are refundable (less non-recoverable costs already incurred). If you cancel 35 days or fewer before the event, all payments are non-refundable.",
    // Rescheduling
    "Rescheduling: May be possible based on planner and vendor availability and may incur additional fees.",
    // Missed payments (same structure as screen)
    "Missed Payments: We’ll retry your card automatically. After 7 days a $25 late fee may apply; after 14 days, services may be suspended and the agreement may be in default (amounts paid, including the deposit, may be retained).",
    // Liability & substitutions
    "Liability & Substitutions: Wed&Done isn’t responsible for venue restrictions or consequential damages. Reasonable substitutions may be made as needed. Liability is limited to amounts paid for coordination services under this agreement.",
    // Force majeure (condensed to one bullet)
    "Force Majeure: Neither party is liable for delays beyond reasonable control (including natural disasters, acts of government, war, terrorism, labor disputes, epidemics/pandemics, or utility outages). We’ll work in good faith to reschedule; if rescheduling isn’t possible, we’ll refund amounts paid beyond non-recoverable costs already incurred.",
  ];

  for (const t of terms) writeBullet(t);

  // ---- Signature block (anchored like floral) ----
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
    doc.text(`Signature date: ${todayStr}`, left, signedLineY + 14);

    drawFooter();
  };

  placeSignature();

  return doc.output("blob");
};