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

const ordinal = (n: number) =>
  n % 10 === 1 && n % 100 !== 11
    ? "st"
    : n % 10 === 2 && n % 100 !== 12
    ? "nd"
    : n % 10 === 3 && n % 100 !== 13
    ? "rd"
    : "th";

const prettyDate = (d: string): string => {
  const dt = new Date(d);
  if (!isNaN(dt.getTime())) {
    const m = dt.toLocaleString("en-US", { month: "long" });
    const day = dt.getDate();
    const y = dt.getFullYear();
    return `${m} ${day}${ordinal(day)}, ${y}`;
  }
  return d;
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
  purchaseDate: string; // can be ISO or already pretty text
}

export const generatePhotoAddOnReceiptPDF = async ({
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
    loadImage(`${import.meta.env.BASE_URL}assets/images/rainbow_logo.jpg`),
    loadImage(`${import.meta.env.BASE_URL}assets/images/lock_grey.jpg`),
  ]);

  // watermark + logo
  doc.addImage(lock, "JPEG", 40, 60, 130, 130);
  doc.addImage(logo, "JPEG", 75, 10, 60, 60);

  // title
  doc.setFont("helvetica", "normal");
  doc.setFontSize(16);
  doc.setTextColor(0);
  doc.text("Photo Styler Add-On Receipt", w / 2, 75, { align: "center" });

  // basics
  doc.setFontSize(12);
  doc.text(`Name: ${fullName}`, 20, 90);
  doc.text(`Total Add-On Cost: $${total.toFixed(2)}`, 20, 100);

  let y = 115;
  const bottomMargin = 40; // keep content above footer
  const addPageIfNeeded = () => {
    if (y > h - bottomMargin) {
      renderFooter(doc);
      doc.addPage();
      // optional watermark on subsequent pages
      doc.addImage(lock, "JPEG", 40, 60, 130, 130);
      y = 30;
    }
  };

  // items
  if (lineItems.length > 0) {
    doc.setFontSize(14);
    doc.text("Included Items:", 20, y);
    y += 10;

    doc.setFontSize(12);
    for (const item of lineItems) {
      addPageIfNeeded();
      doc.text(`• ${item}`, 25, y);
      y += 8;
    }
  }

  // summary
  y += 12;
  addPageIfNeeded();
  const pretty = prettyDate(purchaseDate);
  doc.setFontSize(12);
  doc.text(`Total paid: $${total.toFixed(2)} on ${pretty}`, 20, y);

  // footer on last page
  renderFooter(doc);

  return doc.output("blob");
};