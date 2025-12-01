// src/utils/generateFloralAddOnReceiptPDF.ts
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

// Robust pretty date helper with noon guard for YYYY-MM-DD
const prettyDate = (raw: string | undefined | null): string => {
  if (!raw) return "TBD";

  const ymd = /^\d{4}-\d{2}-\d{2}$/;
  let dt: Date | null = null;

  if (ymd.test(raw)) {
    // Avoid timezone shift by anchoring to noon local
    dt = new Date(`${raw}T12:00:00`);
  } else {
    const tmp = new Date(raw);
    if (!isNaN(tmp.getTime())) dt = tmp;
  }

  if (!dt) return raw;

  return dt.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

// Footer draws the grey small text
const renderFooter = (doc: jsPDF) => {
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setDrawColor(200);
  doc.line(
    20,
    pageHeight - 25,
    doc.internal.pageSize.getWidth() - 20,
    pageHeight - 25
  );
  doc.setFontSize(10);
  doc.setTextColor(120);
  doc.text(
    "Magically booked by Wed&Done",
    doc.internal.pageSize.getWidth() / 2,
    pageHeight - 17,
    { align: "center" }
  );
};

// ✅ After a page break, go back to normal body style
const resetBodyTextStyle = (doc: jsPDF) => {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.setTextColor(0); // black
};

export interface AddOnPDFOptions {
  fullName: string;
  email?: string;
  weddingDate?: string;      // raw YYYY-MM-DD or display string
  lineItems: string[];
  total: number;
  purchaseDate: string;      // already formatted or raw, we prettify if we can
}

export const generateFloralAddOnReceiptPDF = async ({
  fullName,
  email,
  weddingDate,
  lineItems = [],
  total,
  purchaseDate,
}: AddOnPDFOptions): Promise<Blob> => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // assets
  try {
    const [logo, lock] = await Promise.all([
      loadImage(`${import.meta.env.BASE_URL}assets/images/rainbow_logo.jpg`),
      loadImage(`${import.meta.env.BASE_URL}assets/images/lock_grey.jpg`),
    ]);

    // watermark + logo on first page
    doc.addImage(lock, "JPEG", 40, 60, 130, 130);
    doc.addImage(logo, "JPEG", 75, 10, 60, 60);
  } catch {
    // non-fatal if art fails
  }

  // header
  doc.setFont("helvetica", "normal");
  doc.setFontSize(16);
  doc.setTextColor(0);
  doc.text("Floral Add-On Receipt", pageWidth / 2, 75, { align: "center" });

  const prettyWedding = weddingDate ? prettyDate(weddingDate) : "TBD";

  // basics
  resetBodyTextStyle(doc);
  let y = 90;

  doc.text(`Name: ${fullName}`, 20, y);
  y += 8;

  if (email) {
    doc.text(`Email: ${email}`, 20, y);
    y += 8;
  }

  doc.text(`Wedding Date: ${prettyWedding}`, 20, y);
  y += 8;

  doc.text(`Total Add-On Cost: $${total.toFixed(2)}`, 20, y);
  y += 15;

  // line items with pagination
  const bottomMargin = 40; // leave room for footer

  const addPageIfNeeded = () => {
    if (y > pageHeight - bottomMargin) {
      renderFooter(doc);
      doc.addPage();

      // optional: repeat watermark on new pages
      try {
        // you can skip this if you don't care about watermark after page 1
        loadImage(`${import.meta.env.BASE_URL}assets/images/lock_grey.jpg`).then(
          (lock) => {
            doc.addImage(lock, "JPEG", 40, 60, 130, 130);
          }
        );
      } catch {
        // ignore
      }

      y = 30;
      resetBodyTextStyle(doc);
    }
  };

  if (lineItems.length > 0) {
    doc.setFontSize(14);
    doc.setTextColor(0);
    doc.text("Included Items:", 20, y);
    y += 10;

    resetBodyTextStyle(doc);
    for (const item of lineItems) {
      addPageIfNeeded();
      doc.text(`• ${item}`, 25, y);
      y += 8;
    }
  }

  // payment summary
  y += 10;
  addPageIfNeeded();
  resetBodyTextStyle(doc);
  doc.text(
    `Total paid: $${total.toFixed(2)} on ${prettyDate(purchaseDate)}`,
    20,
    y
  );

  // footer on final page
  renderFooter(doc);

  return doc.output("blob");
};