import jsPDF from "jspdf";

interface PDFOptions {
  fullName: string;
  total: number;
  deposit: number;
  guestCount: number;
  weddingDate: string;
  signatureImageUrl: string;
  paymentSummary: string; // will render verbatim if present
  lineItems?: string[];
  dessertType?: string;
  selectedFlavorCombo?: string;
  selectedStyle?: string;
  treatType?: string[];
  goodies?: string[];
  cupcakes?: string[];
}

const FINAL_DUE_DAYS = 35; // matches screen contract (FINAL_DUE_DAYS)

const generateDessertAgreementPDF = async ({
  fullName,
  total,
  deposit,
  guestCount,
  weddingDate,
  signatureImageUrl,
  paymentSummary,
  lineItems = [],
  dessertType = "",
  selectedFlavorCombo = "",
  selectedStyle = "",
  treatType = [],
  goodies = [],
  cupcakes = [],
}: PDFOptions): Promise<Blob> => {
  const doc = new jsPDF();
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

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
    return d;
  };

  const addFooter = () => {
    const y = pageH - 17;
    doc.setDrawColor(200);
    doc.line(20, y - 8, pageW - 20, y - 8);
    doc.setFontSize(10);
    doc.setTextColor(120);
    doc.text("Magically booked by Wed&Done", pageW / 2, y, {
      align: "center",
    });
  };

  const addWatermark = (lockImg: HTMLImageElement) => {
    // tasteful watermark sizing
    doc.addImage(lockImg, "JPEG", 40, 60, 130, 130);
  };

  const wrap = (text: string, width = 160) =>
    doc.splitTextToSize(text, width);

  const bullet = (txt: string) => `• ${txt}`;

  const emitList = (label: string, items: string[], yRef: { value: number }) => {
    if (!items?.length) return;
    doc.setFontSize(12);
    doc.text(label, 25, yRef.value);
    yRef.value += 8;
    items.forEach((item) => {
      const wrapped = wrap(`- ${item}`);
      doc.text(wrapped, 30, yRef.value);
      yRef.value += wrapped.length * 8;
    });
  };

  // ---------- assets ----------
  const [logo, lock] = await Promise.all([
    loadImage(`${import.meta.env.BASE_URL}assets/images/rainbow_logo.jpg`),
    loadImage(`${import.meta.env.BASE_URL}assets/images/lock_grey.jpg`),
  ]);

  // ---------- cover ----------
  addWatermark(lock);
  doc.addImage(logo, "JPEG", 75, 10, 60, 60);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(16);
  doc.setTextColor(0);
  doc.text("Dessert Agreement & Receipt", pageW / 2, 75, {
    align: "center",
  });

  doc.setFontSize(12);
  const weddingPretty = prettyDate(weddingDate);
  doc.text(`Name: ${fullName}`, 20, 90);
  doc.text(`Wedding Date: ${weddingPretty}`, 20, 100);
  if (dessertType) doc.text(`Dessert Type: ${dessertType}`, 20, 110);

  // ---------- included / selections ----------
  let y = 125;

  if (
    lineItems.length > 0 ||
    selectedFlavorCombo ||
    selectedStyle ||
    (treatType?.length ?? 0) > 0 ||
    (goodies?.length ?? 0) > 0 ||
    (cupcakes?.length ?? 0) > 0
  ) {
    doc.setFontSize(14);
    doc.text("Included Items:", 20, y);
    y += 10;

    // generic line items (already pre-formatted upstream)
    lineItems.forEach((it) => {
      const wrapped = wrap(bullet(it));
      doc.setFontSize(12);
      doc.text(wrapped, 25, y);
      y += wrapped.length * 8;
    });

    if (selectedFlavorCombo) {
      doc.setFontSize(12);
      doc.text("Cake Flavor & Filling:", 25, y);
      y += 8;
      const wrapped = wrap(`- ${selectedFlavorCombo}`);
      doc.text(wrapped, 30, y);
      y += wrapped.length * 8;
    }

    if (selectedStyle) {
      doc.setFontSize(12);
      doc.text("Cake Style:", 25, y);
      y += 8;
      const wrapped = wrap(`- ${selectedStyle}`);
      doc.text(wrapped, 30, y);
      y += wrapped.length * 8;
    }

    const yRef = { value: y };
    emitList("Treat Type:", treatType || [], yRef);
    emitList("Goodies:", goodies || [], yRef);
    emitList("Cupcakes:", cupcakes || [], yRef);
    y = yRef.value;
  }

  addFooter();

  // ---------- page 2 ----------
  doc.addPage();
  addWatermark(lock);

  let y2 = 30;

  // Payment Summary (render what caller passed verbatim)
  doc.setFontSize(12);
  doc.setTextColor(0);
  doc.text("Payment Summary:", 20, y2);
  y2 += 10;

  // Compute "due by" date based on FINAL_DUE_DAYS
  let dueByPretty = "";
  const baseDate = new Date(weddingDate);
  if (!isNaN(baseDate.getTime())) {
    const msPerDay = 24 * 60 * 60 * 1000;
    const dueDate = new Date(
      baseDate.getTime() - FINAL_DUE_DAYS * msPerDay
    );
    dueByPretty = prettyDate(dueDate.toISOString());
  }

  if (paymentSummary && paymentSummary.trim()) {
    const wrapped = wrap(paymentSummary.trim());
    doc.text(wrapped, 25, y2);
    y2 += wrapped.length * 8 + 2;
  } else {
    // Fallback wording (no assumptions about number of installments)
    if (deposit > 0 && deposit < total) {
      const remaining = Math.max(0, total - deposit);
      doc.text(`Deposit Paid Today: $${Number(deposit).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}`, 25, y2);
      y2 += 8;

      if (dueByPretty) {
        doc.text(
          `Remaining Balance: $${remaining.toFixed(
            2
          )} (due by ${dueByPretty})`,
          25,
          y2
        );
      } else {
        doc.text(
          `Remaining Balance: $${remaining.toFixed(
            2
          )} (due ${FINAL_DUE_DAYS} days before your wedding date)`,
          25,
          y2
        );
      }
      y2 += 8;
    } else {
      doc.text(`Total Paid in Full: $${Number(total).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}`, 25, y2);
      y2 += 8;
    }
  }

  const todayPretty = prettyDate(new Date().toISOString());
  doc.text(`Date Paid: ${todayPretty}`, 25, y2);
  y2 += 18;

  // ---------- Booking Terms — mirror on-screen contract wording ----------
  doc.setFontSize(12);
doc.setTextColor(0); // BLACK
doc.setFont("helvetica", "bold");
doc.text("Booking Terms", 20, y2);
  y2 += 10;

  doc.setFont("helvetica", "normal");

  const bookingBullets: string[] = [
    // 1) Venue allows outside bakers
    "By signing, you confirm either (a) your venue allows outside bakers, or (b) you’ll book a venue that does.",

    // 2) Deposit + FINAL_DUE_DAYS payoff
    "You may pay in full today, or place a 25% non-refundable deposit. Any remaining balance will be split into monthly installments and must be fully paid 35 days before your wedding date.",

    // 3) Guest count / 30 + 45 days
    "Final guest count is due 30 days before your wedding. You may increase your guest count starting 45 days before your wedding, but the count cannot be lowered after booking.",

    // 4) Cancellation & Refunds
    "Cancellation & Refunds: If you cancel more than 35 days prior, amounts paid beyond the non-refundable portion will be refunded less any non-recoverable costs already incurred. Within 35 days, all payments are non-refundable.",

    // 5) Missed Payments
    "Missed Payments: We’ll automatically retry your card. After 7 days, a $25 late fee applies; after 14 days, services may be suspended and this agreement may be in default.",

    // 6) Food safety & venue policies
    "Food Safety & Venue Policies: We’ll follow standard food-safety guidelines and comply with venue rules, which may limit display/location options.",

    // 7) Force Majeure
    "Force Majeure: Neither party is liable for delays beyond reasonable control. We’ll work in good faith to reschedule; if not possible, we’ll refund amounts paid beyond non-recoverable costs already incurred.",

    // 8) Liability cap
    "In the unlikely event of our cancellation or issue, liability is limited to a refund of payments made.",
  ];

  doc.setTextColor(0); // BLACK for bullets
  bookingBullets.forEach((b) => {
    const wrapped = wrap(`• ${b}`);
    doc.text(wrapped, 25, y2);
    y2 += wrapped.length * 8 + 2;
  });

  // Reset text color for signature area
  doc.setTextColor(0);

  // Signature block (safe placement)
  y2 += 12;
  if (y2 > pageH - 70) {
    addFooter();
    doc.addPage();
    addWatermark(lock);
    y2 = 30;
  }

  doc.text("Signature:", 20, y2);
  y2 += 5;

  // Try PNG first, then JPEG fallback
  try {
    doc.addImage(signatureImageUrl, "PNG", 20, y2, 80, 30);
  } catch {
    try {
      doc.addImage(signatureImageUrl, "JPEG", 20, y2, 80, 30);
    } catch {
      // ignore if un-parseable
    }
  }
  y2 += 38;

  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Signed by: ${fullName}`, 20, y2);
  y2 += 7;
  doc.text(`Signature date: ${todayPretty}`, 20, y2);

  addFooter();

  return doc.output("blob");
};

export default generateDessertAgreementPDF;