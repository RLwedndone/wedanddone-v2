// src/utils/generateVenueAgreementPDF.ts
import jsPDF from "jspdf";

interface PDFOptions {
  firstName: string;
  lastName: string;
  total: number;
  deposit: number;            // 0 if paid in full
  paymentSummary: string;     // optional narrative shown under "Paid today…"
  weddingDate: string;        // ISO or human string
  signatureImageUrl: string;  // data URL
  venueName: string;

  // From the contract screen (already sanitized upstream, but defensively handled here too)
  venueSpecificDetails: string[];
  bookingTerms: string[];

  guestCount?: number;
}

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
  // allow either ISO (YYYY-MM-DD) or already human-friendly strings
  const dt = new Date(d);
  if (!isNaN(dt.getTime())) {
    const m = dt.toLocaleString("en-US", { month: "long" });
    const day = dt.getDate();
    const y = dt.getFullYear();
    return `${m} ${day}${ordinal(day)}, ${y}`;
  }
  return d;
};

const sanitizeText = (s: string) =>
  String(s || "")
    .replace(/<\/?[^>]+>/g, "") // strip HTML tags
    .replace(/\s+/g, " ")       // collapse whitespace
    .trim();

const setBodyFont = (
  doc: jsPDF,
  size = 12,
  color: [number, number, number] | number = 0 // 🔁 default: black body text
) => {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(size);
  if (Array.isArray(color)) doc.setTextColor(color[0], color[1], color[2]);
  else doc.setTextColor(color);
};

const setHeader = (doc: jsPDF, title: string, pageWidth: number, y: number) => {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(14);
  doc.setTextColor(44, 98, 186); // Jenna Sue Blue
  doc.text(title, pageWidth / 2, y, { align: "center" });
};

const renderFooter = (doc: jsPDF) => {
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  doc.setDrawColor(200);
  doc.line(20, h - 25, w - 20, h - 25);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(120);
  doc.text("Magically booked by Wed&Done", w / 2, h - 17, { align: "center" });
};

// Write wrapped bullet lists, with graceful page breaks
function writeBulletedLines(
  doc: jsPDF,
  lines: string[],
  startX: number,
  startY: number,
  maxWidth: number
): number {
  let y = startY;
  const pageH = doc.internal.pageSize.getHeight();
  const bottomMargin = 40;

  const ensureRoom = () => {
    if (y > pageH - bottomMargin) {
      renderFooter(doc);
      doc.addPage();
      // consistent base font on new page
      setBodyFont(doc, 12, 0);
      y = 30;
    }
  };

  setBodyFont(doc, 12, 0);

  for (const raw of lines || []) {
    const clean = sanitizeText(raw);
    if (!clean) continue;

    ensureRoom();
    const wrapped = doc.splitTextToSize(`• ${clean}`, maxWidth);
    for (const ln of wrapped) {
      ensureRoom();
      doc.text(ln, startX, y);
      y += 7;
    }
    y += 3; // space between list items
  }
  return y;
}

export const generateVenueAgreementPDF = async ({
  firstName,
  lastName,
  total,
  deposit,
  paymentSummary,
  weddingDate,
  signatureImageUrl,
  venueName,
  venueSpecificDetails = [],
  bookingTerms = [],
  guestCount,
}: PDFOptions): Promise<Blob> => {
  const doc = new jsPDF();
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  const bottomMargin = 40;

  const [logo, lock] = await Promise.all([
    loadImage(`${import.meta.env.BASE_URL}assets/images/rainbow_logo.jpg`),
    loadImage(`${import.meta.env.BASE_URL}assets/images/lock_grey.jpg`),
  ]);

  // watermark + header logo
  doc.addImage(lock, "JPEG", 40, 60, 130, 130);
  doc.addImage(logo, "JPEG", 75, 10, 60, 60);

  // title
  doc.setFont("helvetica", "normal");
  doc.setFontSize(16);
  doc.setTextColor(0);
  doc.text("Venue Agreement & Receipt", w / 2, 75, { align: "center" });

  // details block (dynamic Y instead of hard-coded)
  const weddingPretty = prettyDate(weddingDate);
  const venueLine = sanitizeText(venueName || "Selected Venue");
  const totalNum = Number(total) || 0;
  const depositNum = Number(deposit) || 0;

  let y = 90;
  setBodyFont(doc, 12, 0);

  doc.text(
    `Name: ${sanitizeText(firstName)} ${sanitizeText(lastName)}`,
    20,
    y
  );
  y += 8;

  doc.text(`Wedding Date: ${weddingPretty}`, 20, y);
  y += 8;

  doc.text(`Venue Booked: ${venueLine}`, 20, y);
  y += 8;

  if (typeof guestCount === "number" && guestCount > 0) {
    doc.text(`Guest Count: ${guestCount}`, 20, y);
    y += 8;
  }

  doc.text(
    `Total Venue Cost: $${Number(totalNum).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`,
    20,
    y
  );
  y += 8;

  if (depositNum > 0 && depositNum !== totalNum) {
    doc.text(
      `Deposit Paid: $${Number(depositNum).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`,
      20,
      y
    );
    y += 8;
  }

  y += 10; // spacing before payment summary block

  const ensureRoom = () => {
    if (y > h - bottomMargin) {
      renderFooter(doc);
      doc.addPage();
      // reset base font/colors for next page to avoid font drift
      setBodyFont(doc, 12, 0);
      // optional: watermark again
      doc.addImage(lock, "JPEG", 40, 60, 130, 130);
      y = 30;
    }
  };

  // payment summary
  const todayPretty = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  setBodyFont(doc, 12, 0);
  const paidToday =
    depositNum > 0 && depositNum !== totalNum ? depositNum : totalNum;
  doc.text(
    `Paid today: $${Number(paidToday || 0).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} on ${todayPretty}`,
    20,
    y
  );
  y += 8;

  if (paymentSummary) {
    ensureRoom();
    setBodyFont(doc, 12, 0);
    const wrapped = doc.splitTextToSize(
      `Payment Plan: ${sanitizeText(paymentSummary)}`,
      w - 40
    );
    for (const ln of wrapped) {
      doc.text(ln, 20, y);
      y += 7;
    }
    y += 3;
  }

  // ————— Venue Specific Details (VSDs) —————
  ensureRoom();
  setHeader(doc, "Venue Specific Details", w, y);
  y += 10;

  setBodyFont(doc, 12, 0);
  y = writeBulletedLines(doc, venueSpecificDetails, 20, y, w - 40);

  // ————— Booking Terms —————
  ensureRoom();
  setHeader(doc, "Booking Terms", w, y);
  y += 10;

  setBodyFont(doc, 12, 0);
  y = writeBulletedLines(doc, bookingTerms, 20, y, w - 40);

  // ---------- signature block on the LAST page ----------
  const sigBlockHeight = 55;
  if (y + sigBlockHeight > h - bottomMargin) {
    renderFooter(doc);
    doc.addPage();
    // keep font consistent on the new page
    setBodyFont(doc, 12, 0);
    doc.addImage(lock, "JPEG", 40, 60, 130, 130);
    y = 30;
  }

  setBodyFont(doc, 12, 0);
  doc.text("Signature:", 20, y);
  y += 5;

  const sigW = 100;
  const sigH = 35;
  try {
    if (signatureImageUrl) {
      doc.addImage(signatureImageUrl, "PNG", 20, y, sigW, sigH);
    } else {
      throw new Error("no signature");
    }
  } catch {
    // placeholder box if image missing/unloadable
    doc.setDrawColor(180);
    doc.rect(20, y, sigW, sigH);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text("Signature image unavailable", 25, y + sigH / 2);
  }
  y += sigH + 8;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(
    `Signed by: ${sanitizeText(firstName)} ${sanitizeText(lastName)}`,
    20,
    y
  );
  y += 7;
  doc.text(`Signature date: ${todayPretty}`, 20, y);

  // footer on last page
  renderFooter(doc);

  return doc.output("blob");
};