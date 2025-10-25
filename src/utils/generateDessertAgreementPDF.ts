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

  const wrap = (text: string, width = 160) => doc.splitTextToSize(text, width);
  const bullet = (txt: string) => `• ${txt}`;

  const emitList = (label: string, items: string[]) => {
    if (!items?.length) return;
    doc.setFontSize(12);
    doc.text(label, 25, y);
    y += 8;
    items.forEach((item) => {
      const wrapped = wrap(`- ${item}`);
      doc.text(wrapped, 30, y);
      y += wrapped.length * 8;
    });
  };

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

    emitList("Treat Type:", treatType || []);
    emitList("Goodies:", goodies || []);
    emitList("Cupcakes:", cupcakes || []);
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

  if (paymentSummary && paymentSummary.trim()) {
    const wrapped = wrap(paymentSummary.trim());
    doc.text(wrapped, 25, y2);
    y2 += wrapped.length * 8 + 2;
  } else {
    // Fallback wording (no assumptions about number of installments)
    if (deposit > 0 && deposit < total) {
      const remaining = Math.max(0, total - deposit);
      doc.text(`Deposit Paid Today: $${deposit.toFixed(2)}`, 25, y2);
      y2 += 8;
      doc.text(
        `Remaining Balance: $${remaining.toFixed(
          2
        )} (billed per your plan)`,
        25,
        y2
      );
      y2 += 8;
    } else {
      doc.text(`Total Paid in Full: $${total.toFixed(2)}`, 25, y2);
      y2 += 8;
    }
  }

  const todayPretty = prettyDate(new Date().toISOString());
  doc.text(`Date Paid: ${todayPretty}`, 25, y2);
  y2 += 18;

  // Agreement Terms — exact language from the Dessert contract
  doc.setFontSize(12);
  doc.setTextColor(50);
  doc.text("Agreement Terms:", 20, y2);
  y2 += 10;

  const terms = [
    "By purchasing your desserts here in the Yum Yum guide, you acknowledge that either:",
    "• Your booked venue allows outside bakers, OR",
    "• You haven't booked a venue yet, but plan to book one that allows outside bakers.",
    "",
    "A $150 non-refundable deposit is required to book desserts.",
    "Final guest counts are due 30 days prior to the wedding.",
    "You can add more guests anytime—but you can't decrease your guest count after booking.",
  ];

  terms.forEach((line) => {
    const wrapped = wrap(line);
    doc.text(wrapped, 25, y2);
    y2 += wrapped.length * 8;
  });

  // Signature block (safe placement)
  y2 += 12;
  if (y2 > pageH - 70) {
    addFooter();
    doc.addPage();
    addWatermark(lock);
    y2 = 30;
  }

  doc.setTextColor(0);
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