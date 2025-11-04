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

// Format “Month D, YYYY” even if a raw date string is passed
const prettyDate = (d: string): string => {
  const dt = new Date(d);
  if (!isNaN(dt.getTime())) {
    return dt.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }
  // already formatted or unknown → return as-is
  return d;
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

// ✅ New: after a page break, go back to normal body style
const resetBodyTextStyle = (doc: jsPDF) => {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.setTextColor(0); // black
};

interface AddOnPDFOptions {
  fullName: string;
  total: number;
  lineItems?: string[];
  purchaseDate: string; // can be raw date string; we’ll pretty-format it
}

export const generateFloralAddOnReceiptPDF = async ({
  fullName,
  total,
  lineItems = [],
  purchaseDate,
}: AddOnPDFOptions): Promise<Blob> => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // assets
  const [logo, lock] = await Promise.all([
    loadImage(`${import.meta.env.BASE_URL}assets/images/rainbow_logo.jpg`),
    loadImage(`${import.meta.env.BASE_URL}assets/images/lock_grey.jpg`),
  ]);

  // watermark + logo on first page
  doc.addImage(lock, "JPEG", 40, 60, 130, 130);
  doc.addImage(logo, "JPEG", 75, 10, 60, 60);

  // header
  doc.setFont("helvetica", "normal");
  doc.setFontSize(16);
  doc.setTextColor(0);
  doc.text("Floral Add-On Receipt", pageWidth / 2, 75, { align: "center" });

  // basics
  resetBodyTextStyle(doc); // make sure we're in normal text mode
  doc.text(`Name: ${fullName}`, 20, 90);
  doc.text(`Total Add-On Cost: $${total.toFixed(2)}`, 20, 100);

  // line items with pagination
  let y = 115;
  const bottomMargin = 40; // leave room for footer

  // 🔁 updated to restore text style on new pages
  const addPageIfNeeded = () => {
    if (y > pageHeight - bottomMargin) {
      // finish current page with footer (this sets tiny grey text)
      renderFooter(doc);

      // new page
      doc.addPage();

      // redraw watermark/lock on new page if you want the same look
      doc.addImage(lock, "JPEG", 40, 60, 130, 130);

      // reset cursor for new page
      y = 30;

      // 🔥 IMPORTANT: go back to normal body style for the new page
      resetBodyTextStyle(doc);
    }
  };

  if (lineItems.length > 0) {
    doc.setFontSize(14);
    doc.setTextColor(0);
    doc.text("Included Items:", 20, y);
    y += 10;

    resetBodyTextStyle(doc); // body bullets
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