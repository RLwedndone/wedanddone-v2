import jsPDF from "jspdf";

// ✅ Helpers
const toPrettyDate = (isoOrAny: string) =>
  new Date(isoOrAny).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

// 🖼️ Preload local images safely
const loadImage = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });

// 📄 Simple page/flow helpers
const MARGIN_X = 20;
const TOP_Y = 20;
const FOOTER_Y = 278; // keep a little margin above 297mm page end
const LINE_GAP = 10;

function addFooter(doc: jsPDF) {
  doc.setDrawColor(200);
  doc.line(MARGIN_X, FOOTER_Y - 8, 190, FOOTER_Y - 8);
  doc.setFontSize(10);
  doc.setTextColor(120);
  doc.text("Magically booked by Wed&Done", 105, FOOTER_Y, { align: "center" });
}

function ensureSpace(doc: jsPDF, currentY: number, needed = 12): number {
  if (currentY + needed > FOOTER_Y - 12) {
    addFooter(doc);
    doc.addPage();
    return TOP_Y;
  }
  return currentY;
}

interface AddOnReceiptParams {
  fullName: string;
  lineItems: string[];
  total: number;
  purchaseDate: string; // any date string
}

export const generateYumAddOnReceiptPDF = async ({
  fullName,
  lineItems,
  total,
  purchaseDate,
}: AddOnReceiptParams): Promise<Blob> => {
  const doc = new jsPDF();

  // 🐷 Load images
  const [bgImg, logoImg] = await Promise.all([
    loadImage(`${import.meta.env.BASE_URL}assets/images/lock_grey.png`),
    loadImage(`${import.meta.env.BASE_URL}assets/images/yum_yum_button.png`),
  ]);

  // 🌈 Centered images (background watermark + logo)
  const bgSize = 120;
  const logoSize = 30;
  doc.addImage(bgImg, "PNG", (210 - bgSize) / 2, 60, bgSize, bgSize);
  doc.addImage(logoImg, "PNG", (210 - logoSize) / 2, 20, logoSize, logoSize);

  // ✍️ Header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(44, 98, 186);
  doc.text("Catering Add-On Receipt", 105, 100, { align: "center" });

  // 🧾 Content
  let y = 115;
  doc.setFontSize(14);
  doc.setTextColor(50);

  if (Array.isArray(lineItems) && lineItems.length > 0) {
    for (const item of lineItems) {
      const lines = doc.splitTextToSize(`• ${item}`, 170 - MARGIN_X);
      for (const line of lines) {
        y = ensureSpace(doc, y, LINE_GAP);
        doc.text(line, MARGIN_X + 10, y);
        y += LINE_GAP;
      }
    }
  }

  // 💰 Payment Summary
  y += 10;
  y = ensureSpace(doc, y, LINE_GAP);
  doc.setFont("helvetica", "bold");
  doc.text(`Total Add-On Amount Paid: $${Number(total).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}`, MARGIN_X + 10, y);

  // 📅 Purchase Date (pretty)
  y += LINE_GAP;
  y = ensureSpace(doc, y, LINE_GAP);
  const prettyDate = toPrettyDate(purchaseDate);
  doc.setFont("helvetica", "normal");
  doc.text(`Date Purchased: ${prettyDate}`, MARGIN_X + 10, y);

  // 💌 Footer note
  y += 20;
  y = ensureSpace(doc, y, LINE_GAP);
  doc.setFontSize(13);
  doc.setTextColor(44, 98, 186);
  doc.text(
    "Thanks for feeding your crew! Your updated catering details are saved.",
    MARGIN_X + 10,
    y
  );

  // 🦶 Final footer (last page)
  addFooter(doc);

  return doc.output("blob");
};