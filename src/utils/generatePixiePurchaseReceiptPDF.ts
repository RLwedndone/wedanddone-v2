import jsPDF from "jspdf";

interface PixiePurchaseReceiptOptions {
  fullName: string;
  label: string;
  description?: string;
  amount: number;
  currency?: string;
  purchaseDate: string; // pretty string: "November 21, 2025"
}

export async function generatePixiePurchaseReceiptPDF(
  opts: PixiePurchaseReceiptOptions
): Promise<Blob> {
  const {
    fullName,
    label,
    description,
    amount,
    currency = "USD",
    purchaseDate,
  } = opts;

  const doc = new jsPDF();

  // ---- Layout constants ----
  const MARGIN_L = 20;
  const MARGIN_R = 20;
  const CONTENT_W =
    doc.internal.pageSize.getWidth() - MARGIN_L - MARGIN_R;
  const TOP_Y = 20;
  const LINE = 7;
  const GAP = 10;
  const FOOTER_GAP = 12;
  const FOOTER_LINE_GAP = 8;

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
    return pageH - FOOTER_GAP - FOOTER_LINE_GAP - 10;
  };

  const resetBodyTextStyle = () => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(12);
    doc.setTextColor(0);
  };

  let y = TOP_Y;

  const ensureSpace = (needed: number) => {
    if (y + needed <= contentMaxY()) return;

    // finish current page
    drawFooter();

    // new page
    doc.addPage();
    y = TOP_Y;
    resetBodyTextStyle();
  };

  // ---- UPDATED: supports "\n" properly ----
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
    const BASE = import.meta.env.BASE_URL || "/";
    const [logo, lock] = await Promise.all([
      loadImage(`${BASE}assets/images/rainbow_logo.jpg`),
      loadImage(`${BASE}assets/images/lock_grey.jpg`),
    ]);

    // lock watermark first so text goes on top
    doc.addImage(lock, "JPEG", 40, 60, 130, 130);
    // rainbow logo at top
    doc.addImage(logo, "JPEG", 75, 10, 60, 60);
  } catch {
    // ignore asset failures
  }

  // ---- Header ----
  doc.setFont("helvetica", "normal");
  doc.setFontSize(16);
  doc.setTextColor(0);
  doc.text(
    "Pixie Purchase Receipt",
    doc.internal.pageSize.getWidth() / 2,
    75,
    { align: "center" }
  );

  // ---- Body ----
  resetBodyTextStyle();
  y = 90;

  writeText(`Billed To: ${fullName}`);
  writeText(`Purchase Date: ${purchaseDate}`);
  writeText(
    `Amount: ${currency.toUpperCase()} $${Number(amount).toLocaleString(undefined,{
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`
  );

  y += 4;
  ensureSpace(LINE + GAP);
  doc.setFontSize(13);
  doc.text("Purchase Details", MARGIN_L, y);
  y += GAP;
  resetBodyTextStyle();

  writeText(`Pixie Label: ${label}`);
  if (description) {
    writeText(`Description: ${description}`);
  }

  y += 4;
  ensureSpace(LINE + GAP);
  doc.setFontSize(13);
  doc.text("Payment Summary", MARGIN_L, y);
  y += GAP;
  resetBodyTextStyle();

  // ---- UPDATED: amount formatting consistent with all PDFs ----
  const amountPretty = Number(amount).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  writeText(
    `Status: Paid in full.\nPaid today: $${amountPretty} on ${purchaseDate}.`
  );

  y += 4;
  ensureSpace(LINE + GAP);
  doc.setFontSize(12);
  doc.setTextColor(60);
  writeText(
    "This Pixie Purchase has been recorded in your Wed&Done account and will appear in your Mag-O-Meter totals."
  );

  drawFooter();

  return doc.output("blob");
}