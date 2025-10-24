import jsPDF from "jspdf";

// ---------- helpers ----------
const loadImage = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });

const prettyDate = (d: string): string => {
  const dt = new Date(d);
  if (!isNaN(dt.getTime())) {
    return dt.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }
  return d; // already formatted or unknown
};

const renderFooter = (doc: jsPDF) => {
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  doc.setDrawColor(200);
  doc.line(20, h - 25, w - 20, h - 25);
  doc.setFontSize(10);
  doc.setTextColor(120);
  doc.text("Magically booked by Wed&Done", w / 2, h - 17, { align: "center" });
};

interface AddOnPDFOptions {
  fullName: string;
  total: number;
  lineItems?: string[];
  purchaseDate: string;
}

export const generateJamAddOnReceiptPDF = async ({
  fullName,
  total,
  lineItems = [],
  purchaseDate,
}: AddOnPDFOptions): Promise<Blob> => {
  const doc = new jsPDF();
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();

  // assets
  const [logo, lock] = await Promise.all([
    loadImage("/assets/images/rainbow_logo.jpg"),
    loadImage("/assets/images/lock_grey.jpg"),
  ]);

  // watermark + logo
  doc.addImage(lock, "JPEG", 40, 60, 130, 130);
  doc.addImage(logo, "JPEG", 75, 10, 60, 60);

  // header
  doc.setFont("helvetica", "normal");
  doc.setFontSize(16);
  doc.setTextColor(0);
  doc.text("Jam & Groove Add-On Receipt", w / 2, 75, { align: "center" });

  // basics
  doc.setFontSize(12);
  doc.text(`Name: ${fullName}`, 20, 90);
  doc.text(`Total Add-On Cost: $${total.toFixed(2)}`, 20, 100);

  // content flow with pagination
  let y = 115;
  const bottomMargin = 40;
  const addPageIfNeeded = () => {
    if (y > h - bottomMargin) {
      renderFooter(doc);
      doc.addPage();
      // optional watermark on new page
      doc.addImage(lock, "JPEG", 40, 60, 130, 130);
      y = 30; // reset top margin
    }
  };

  // Included items (filter out placeholders)
  const items = (lineItems || []).filter((it) => it && !it.startsWith("__"));
  if (items.length > 0) {
    doc.setFontSize(14);
    doc.text("Included Items:", 20, y);
    y += 10;

    doc.setFontSize(12);
    for (const it of items) {
      addPageIfNeeded();
      doc.text(`• ${it}`, 25, y);
      y += 8;
    }
  }

  // payment summary
  y += 10;
  addPageIfNeeded();
  doc.setFontSize(12);
  doc.text(`Total paid: $${total.toFixed(2)} on ${prettyDate(purchaseDate)}`, 20, y);

  // footer on last page
  renderFooter(doc);

  return doc.output("blob");
};