// src/utils/generateGuestDeltaReceiptPDF.ts
import jsPDF from "jspdf";

type PerGuest = {
  venue: number;
  catering: number;
  dessert: number;
  planner: number; // still tier diff (not per-guest)
};

type Amounts = {
  venue: number;
  catering: number;
  dessert: number;
  planner: number;
  subtotal: number;
  tax: number;       // sales tax portion
  stripeFee: number; // Stripe fee portion
  total: number;
};

type Params = {
  fullName: string;
  weddingDate: string;
  oldCount: number;
  newCount: number;
  additionalGuests: number;
  perGuest: PerGuest;
  amounts: Amounts;
  notes?: string[];
};

/**
 * “Final Bill (Guest Count Update)” PDF – branded like other Wed&Done docs.
 */
export default async function generateGuestDeltaReceiptPDF({
  fullName,
  weddingDate,
  oldCount,
  newCount,
  additionalGuests,
  perGuest,
  amounts,
  notes = [],
}: Params): Promise<Blob> {
  // Use points so we can reuse the original widths easily
  const doc = new jsPDF({ unit: "pt" });

  // ---- Layout constants (mirrors floral style) ----
  const MARGIN_L = 60;
  const MARGIN_R = 60;
  const CONTENT_W = doc.internal.pageSize.getWidth() - MARGIN_L - MARGIN_R;
  const TOP_Y = 110;
  const LINE = 16;
  const GAP = 10;

  const FOOTER_GAP = 24;
  const FOOTER_LINE_GAP = 10;

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Footer + “safe” content height
  const drawFooter = () => {
    const footerTextY = pageHeight - FOOTER_GAP;
    const footerLineY = footerTextY - FOOTER_LINE_GAP;

    doc.setDrawColor(200);
    doc.line(MARGIN_L, footerLineY, pageWidth - MARGIN_R, footerLineY);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(120);
    doc.text(
      "Magically booked by Wed&Done",
      pageWidth / 2,
      footerTextY,
      { align: "center" }
    );
  };

  const contentMaxY = () =>
    pageHeight - FOOTER_GAP - FOOTER_LINE_GAP - 10; // safe zone

  const resetBodyTextStyle = () => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(12);
    doc.setTextColor(0);
  };

  let y = TOP_Y;

  const ensureSpace = (needed: number) => {
    if (y + needed <= contentMaxY()) return;

    // close current page
    drawFooter();
    doc.addPage();

    // update measurements for the new page
    const newPageHeight = doc.internal.pageSize.getHeight();
    (pageHeight as any) = newPageHeight; // TS doesn’t care at runtime
    y = TOP_Y;
    resetBodyTextStyle();
  };

  const writeText = (text: string, x = MARGIN_L) => {
    const lines = doc.splitTextToSize(text, CONTENT_W - (x - MARGIN_L));
    for (const ln of lines) {
      ensureSpace(LINE);
      doc.text(ln, x, y);
      y += LINE;
    }
  };

  const writeRow = (label: string, value: string, opts: { boldValue?: boolean } = {}) => {
    ensureSpace(LINE);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(40);
    doc.text(label, MARGIN_L, y);

    doc.setFont(opts.boldValue ? "helvetica" : "helvetica", opts.boldValue ? "bold" : "normal");
    doc.setFontSize(12);
    doc.setTextColor(0);
    doc.text(value, MARGIN_L + CONTENT_W / 2, y);
    y += LINE;
  };

  const writeSectionTitle = (t: string) => {
    ensureSpace(LINE + GAP);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(44, 98, 186); // Wed&Done blue-ish
    doc.text(t, MARGIN_L, y);
    y += LINE;
  };

  const divider = () => {
    ensureSpace(GAP);
    doc.setDrawColor(225);
    doc.line(MARGIN_L, y, pageWidth - MARGIN_R, y);
    y += GAP;
  };

  // ---- Assets (rainbow logo + lock watermark) ----
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

    // light lock watermark in the background
    doc.addImage(lock, "JPEG", 55, 60, 130, 130);

    // rainbow logo at the top center-ish
    const logoW = 70;
    const logoH = 70;
    const logoX = pageWidth / 2 - logoW / 2;
    const logoY = 20;
    doc.addImage(logo, "JPEG", logoX, logoY, logoW, logoH);
  } catch {
    // ignore asset errors – PDF will still work
  }

  // ---- Title ----
  doc.setFont("helvetica", "normal");
  doc.setFontSize(18);
  doc.setTextColor(0);
  doc.text(
    "Final Bill – Guest Count Update",
    pageWidth / 2,
    100,
    { align: "center" }
  );

  resetBodyTextStyle();

  // ---- Header section ----
  writeText(`Client: ${fullName}`);
  writeText(`Wedding date: ${weddingDate}`);
  divider();

  // ---- Guest Count block ----
  writeSectionTitle("Guest Count");
  writeRow("Original guest count", `${oldCount}`);
  writeRow("New guest count", `${newCount}`);
  writeRow("Additional guests", `+${additionalGuests}`);
  divider();

  // ---- Per-guest rates ----
  writeSectionTitle("Per-Guest Rates (if applicable)");
  writeRow("Venue (per guest)", `$${(perGuest.venue || 0).toFixed(2)}`);
  writeRow("Catering (per guest)", `$${(perGuest.catering || 0).toFixed(2)}`);
  writeRow("Dessert (per guest)", `$${(perGuest.dessert || 0).toFixed(2)}`);
  writeRow(
    "Planner (tier difference)",
    `$${(perGuest.planner || 0).toFixed(2)}`
  );
  divider();

  // ---- Amounts Due ----
  writeSectionTitle("Amounts Due Now");
  writeRow("Venue subtotal", `$${(amounts.venue || 0).toFixed(2)}`);
  writeRow("Catering subtotal", `$${(amounts.catering || 0).toFixed(2)}`);
  writeRow("Dessert subtotal", `$${(amounts.dessert || 0).toFixed(2)}`);
  writeRow(
    "Planner tier difference",
    `$${(amounts.planner || 0).toFixed(2)}`
  );
  writeRow("Subtotal", `$${(amounts.subtotal || 0).toFixed(2)}`);
  writeRow(
    "Taxes & fees",
    `$${(
      (amounts.tax || 0) +
      (amounts.stripeFee || 0)
    ).toFixed(2)}`
  );
  writeRow(
    "Total due now",
    `$${(amounts.total || 0).toFixed(2)}`,
    { boldValue: true }
  );
  divider();

  // ---- Notes ----
  if (notes.length) {
    writeSectionTitle("Notes");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(0);

    for (const n of notes) {
      const bullet = `• ${n}`;
      const wrapped = doc.splitTextToSize(bullet, CONTENT_W);
      for (const line of wrapped) {
        ensureSpace(LINE);
        doc.text(line, MARGIN_L, y);
        y += LINE;
      }
    }
  }

  // Footer on last page
  drawFooter();

  return doc.output("blob");
}