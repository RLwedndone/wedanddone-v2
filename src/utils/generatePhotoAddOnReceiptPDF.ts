import jsPDF from "jspdf";

const MARGIN_X = 20;
const TOP_Y = 20;
const FOOTER_Y = 278;
const LINE_GAP = 8;
const PARA_GAP = 10;

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((res, rej) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = src;
  });

const addFooter = (doc: jsPDF) => {
  doc.setDrawColor(200);
  doc.line(MARGIN_X, FOOTER_Y - 8, 190, FOOTER_Y - 8);
  doc.setFontSize(10);
  doc.setTextColor(120);
  doc.text("Magically booked by Wed&Done", 105, FOOTER_Y, {
    align: "center",
  });
};

const resetBodyStyle = (doc: jsPDF) => {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.setTextColor(0);
};

const ensureSpace = (doc: jsPDF, y: number, needed = 12) => {
  if (y + needed > FOOTER_Y - 12) {
    addFooter(doc);
    doc.addPage();
    resetBodyStyle(doc);
    return TOP_Y;
  }
  return y;
};

const toPrettyDate = (raw: string) => {
  if (!raw) return "TBD";
  const ymd = /^\d{4}-\d{2}-\d{2}$/;
  let d: Date | null = null;

  if (ymd.test(raw)) {
    d = new Date(`${raw}T12:00:00`);
  } else {
    const t = new Date(raw);
    if (!isNaN(t.getTime())) d = t;
  }
  if (!d) return raw;

  const month = d.toLocaleString("en-US", { month: "long" });
  const day = d.getDate();
  const year = d.getFullYear();
  const ord =
    day >= 11 && day <= 13
      ? "th"
      : [,"st", "nd", "rd"][day % 10] ?? "th";

  return `${month} ${day}${ord}, ${year}`;
};

export interface PhotoAddOnPDFOptions {
  fullName: string;
  email?: string;
  weddingDate?: string;   // YYYY-MM-DD or human string
  lineItems: string[];
  total: number;
  purchaseDate: string;   // already formatted for display
}

export const generatePhotoAddOnReceiptPDF = async ({
  fullName,
  email,
  weddingDate,
  lineItems,
  total,
  purchaseDate,
}: PhotoAddOnPDFOptions): Promise<Blob> => {
  const doc = new jsPDF();

  // header art
  try {
    const [logo, lock] = await Promise.all([
      loadImage(`${import.meta.env.BASE_URL}assets/images/rainbow_logo.jpg`),
      loadImage(`${import.meta.env.BASE_URL}assets/images/lock_grey.jpg`),
    ]);
    doc.addImage(lock, "JPEG", 40, 60, 130, 130);
    doc.addImage(logo, "JPEG", 75, 10, 60, 60);
  } catch {
    // non-fatal
  }

  doc.setFont("helvetica", "normal");
  doc.setTextColor(0);
  doc.setFontSize(16);
  doc.text("Photo Add-On Receipt", 105, 75, { align: "center" });

  let y = 90;
  resetBodyStyle(doc);

  const prettyWedding = weddingDate ? toPrettyDate(weddingDate) : "TBD";

  doc.text(`Name: ${fullName}`, MARGIN_X, y);
  y += LINE_GAP;

  if (email) {
    doc.text(`Email: ${email}`, MARGIN_X, y);
    y += LINE_GAP;
  }

  doc.text(`Wedding Date: ${prettyWedding}`, MARGIN_X, y);
  y += LINE_GAP;
  doc.text(
    `Total Add-On Cost: $${Number(total).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`,
    MARGIN_X,
    y
  );
  y += LINE_GAP + PARA_GAP;

  // line items
  if (lineItems.length) {
    y = ensureSpace(doc, y, LINE_GAP + PARA_GAP);
    doc.setFontSize(14);
    doc.text("Included Items:", MARGIN_X, y);
    y += PARA_GAP;
    resetBodyStyle(doc);

    for (const item of lineItems) {
      const wrapped = doc.splitTextToSize(`• ${item}`, 170);
      for (const line of wrapped as string[]) {
        y = ensureSpace(doc, y, LINE_GAP);
        doc.text(line, MARGIN_X + 5, y);
        y += LINE_GAP;
      }
    }
    y += PARA_GAP;
  }

  // payment summary
  y = ensureSpace(doc, y, LINE_GAP * 3 + PARA_GAP);
  doc.setFontSize(12);
  doc.text(
    `Paid today: $${Number(total).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} on ${purchaseDate}`,
    MARGIN_X,
    y
  );
  y += LINE_GAP * 2;

  doc.text(
    "This payment covers the additional photography items listed above.",
    MARGIN_X,
    y
  );
  y += PARA_GAP;

  // very short terms blurb
  y = ensureSpace(doc, y, LINE_GAP * 5);
  doc.setFontSize(12);
  doc.text("Notes:", MARGIN_X, y);
  y += LINE_GAP;

  const notes = doc.splitTextToSize(
    "Add-on purchases are non-refundable once confirmed. If you need to adjust your selections, please contact Wed&Done as soon as possible before your wedding date.",
    170
  );

  (notes as string[]).forEach((line: string) => {
    y = ensureSpace(doc, y, LINE_GAP);
    doc.text(line, MARGIN_X + 5, y);
    y += LINE_GAP;
  });

  addFooter(doc);
  return doc.output("blob");
};