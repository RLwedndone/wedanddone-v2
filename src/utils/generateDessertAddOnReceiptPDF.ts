import jsPDF from "jspdf";

// Safely preload local images
const loadImage = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });

interface AddOnReceiptParams {
  fullName: string;
  lineItems: string[];
  total: number;
  purchaseDate: string; // can be formatted already; if not, we format if parseable
}

export const generateDessertAddOnReceiptPDF = async ({
  fullName,
  lineItems,
  total,
  purchaseDate,
}: AddOnReceiptParams): Promise<Blob> => {
  const pdf = new jsPDF();

  // ---------- Helpers ----------
  const drawFooter = () => {
    const pageH = pdf.internal.pageSize.getHeight();
    const footerTextY = pageH - 12;
    const footerLineY = footerTextY - 8;
    pdf.setDrawColor(200);
    pdf.line(20, footerLineY, 190, footerLineY);
    pdf.setFontSize(10);
    pdf.setTextColor(120);
    pdf.text("Magically booked by Wed&Done", 105, footerTextY, { align: "center" });
  };

  const contentMaxY = () => {
    const pageH = pdf.internal.pageSize.getHeight();
    return pageH - 12 - 8 - 10; // footerTextY - gap - padding
  };

  let y = 20;

  // Ensure room for `needed` points; if not, close page with footer and add a new page.
  const ensureSpace = (needed: number) => {
    if (y + needed <= contentMaxY()) return;
    drawFooter();
    pdf.addPage();
    y = 20;
  };

  // Date formatting (only if parseable)
  const formatHumanDate = (raw: string) => {
    const d = new Date(raw);
    if (isNaN(d.getTime())) return raw;
    return d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };
  const purchaseDateStr = formatHumanDate(purchaseDate);

  // ---------- Assets ----------
  try {
    // 🍰 Load both images
    const [bgImg, logoImg] = await Promise.all([
      loadImage(`${import.meta.env.BASE_URL}assets/images/lock_grey.png`),
      loadImage(`${import.meta.env.BASE_URL}assets/images/yum_yum_button.png`),
    ]);

    // 📐 Centered background graphic (watermark)
    const bgSize = 120;
    pdf.addImage(bgImg, "PNG", (210 - bgSize) / 2, 60, bgSize, bgSize);

    // 🍭 Logo at the top
    const logoSize = 30;
    pdf.addImage(logoImg, "PNG", (210 - logoSize) / 2, 20, logoSize, logoSize);
  } catch {
    // If images fail to load, continue gracefully
  }

  // ---------- Header ----------
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(22);
  pdf.setTextColor(44, 98, 186);
  ensureSpace(30);
  pdf.text("Dessert Add‑On Receipt", 105, 100, { align: "center" });
  y = 115;

  // Buyer name (optional but nice)
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(12);
  pdf.setTextColor(50);
  ensureSpace(8);
  pdf.text(`Name: ${fullName}`, 30, y);
  y += 10;

  // 📋 Line items
  if (lineItems && Array.isArray(lineItems) && lineItems.length > 0) {
    pdf.setFontSize(14);
    pdf.setTextColor(0);
    ensureSpace(10);
    pdf.text("Included Items:", 30, y);
    y += 10;

    pdf.setFontSize(12);
    pdf.setTextColor(50);
    for (const item of lineItems) {
      ensureSpace(8);
      pdf.text(`• ${item}`, 35, y);
      y += 8;
    }
  }

  // 💵 Summary
  y += 10;
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(0);
  ensureSpace(8);
  pdf.text(`Total Add‑On Amount Paid: $${total.toFixed(2)}`, 30, y);
  y += 10;

  // 📅 Date
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(50);
  ensureSpace(8);
  pdf.text(`Date Purchased: ${purchaseDateStr}`, 30, y);
  y += 20;

  // 🧁 Closing line
  pdf.setFontSize(13);
  pdf.setTextColor(44, 98, 186);
  ensureSpace(8);
  pdf.text(
    "Thanks for adding more sweet magic! Your dessert updates are saved.",
    30,
    y
  );

  // Always draw footer on the last page
  drawFooter();

  return pdf.output("blob");
};