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

  // Safer pretty date (handles raw YYYY-MM-DD)
  const prettyDate = (input: string): string => {
    if (!input) return "";
    const ymd = /^\d{4}-\d{2}-\d{2}$/;
    let d: Date | null = null;

    if (ymd.test(input)) {
      d = new Date(`${input}T12:00:00`); // noon guard against TZ shift
    } else {
      const tmp = new Date(input);
      if (!isNaN(tmp.getTime())) d = tmp;
    }

    if (!d) return input;

    return d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
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
    // tasteful watermark sizing – only on page 1
    doc.addImage(lockImg, "JPEG", 40, 60, 130, 130);
  };

  const wrap = (text: string, width = 160) =>
    doc.splitTextToSize(text, width);

  const bullet = (txt: string) => `• ${txt}`;

  const emitList = (
    label: string,
    items: string[],
    yRef: { value: number }
  ) => {
    if (!items?.length) return;
    doc.setFontSize(12);
    doc.setTextColor(0);
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

  // ---------- cover (page 1) ----------
  addWatermark(lock); // 🔒 lock only used on page 1
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
    doc.setTextColor(0);
    doc.text("Included Items:", 20, y);
    y += 10;

    // generic line items (already pre-formatted upstream)
    lineItems.forEach((it) => {
      const wrapped = wrap(bullet(it));
      doc.setFontSize(12);
      doc.setTextColor(0);
      doc.text(wrapped, 25, y);
      y += wrapped.length * 8;
    });

    if (selectedFlavorCombo) {
      doc.setFontSize(12);
      doc.setTextColor(0);
      doc.text("Cake Flavor & Filling:", 25, y);
      y += 8;
      const wrapped = wrap(`- ${selectedFlavorCombo}`);
      doc.text(wrapped, 30, y);
      y += wrapped.length * 8;
    }

    if (selectedStyle) {
      doc.setFontSize(12);
      doc.setTextColor(0);
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

  // ---------- page 2 (no watermark) ----------
  doc.addPage();
  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.setTextColor(0); // reset to BLACK after grey footer on page 1

  let y2 = 30;

  // Payment Summary (render what caller passed verbatim)
  doc.text("Payment Summary:", 20, y2);
  y2 += 10;

  // Compute "due by" date based on FINAL_DUE_DAYS
  let dueByPretty = "";
  const baseDate = (() => {
    const ymd = /^\d{4}-\d{2}-\d{2}$/;
    if (ymd.test(weddingDate)) {
      return new Date(`${weddingDate}T12:00:00`);
    }
    const dt = new Date(weddingDate);
    return isNaN(dt.getTime()) ? null : dt;
  })();

  if (baseDate) {
    const msPerDay = 24 * 60 * 60 * 1000;
    const dueDate = new Date(
      baseDate.getTime() - FINAL_DUE_DAYS * msPerDay
    );
    dueByPretty = prettyDate(dueDate.toISOString());
  }

  const hasDeposit =
    typeof deposit === "number" &&
    deposit > 0 &&
    deposit < total;

  const remaining =
    hasDeposit && total > deposit ? Math.max(0, total - deposit) : 0;

  if (paymentSummary && paymentSummary.trim()) {
    const wrapped = wrap(paymentSummary.trim());
    doc.text(wrapped, 25, y2);
    y2 += wrapped.length * 8 + 4;
  } else {
    // Fallback summary if caller didn't pass a custom paymentSummary
    if (hasDeposit) {
      doc.text(
        `Deposit Paid Today: $${Number(deposit).toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`,
        25,
        y2
      );
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
      y2 += 10;
    } else {
      doc.text(
        `Total Paid in Full: $${Number(total).toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`,
        25,
        y2
      );
      y2 += 10;
    }
  }

  // ⬇️ Extra clarity: always show the actual paid mode, even if paymentSummary handled the prose
  if (hasDeposit) {
    doc.text(
      `Deposit Paid Today: $${Number(deposit).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`,
      25,
      y2
    );
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
    y2 += 10;
  } else {
    doc.text(
      `Total Paid in Full Today: $${Number(total).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`,
      25,
      y2
    );
    y2 += 10;
  }

  const todayPretty = prettyDate(new Date().toISOString());
  doc.text(`Date Paid: ${todayPretty}`, 25, y2);
  y2 += 18;

  // ---------- Booking Terms — mirror on-screen contract wording ----------
  doc.setFontSize(12);
  doc.setTextColor(0);
  doc.setFont("helvetica", "bold");
  doc.text("Booking Terms", 20, y2);
  y2 += 10;

  doc.setFont("helvetica", "normal");

  const bookingBullets: string[] = [
    // 1) Venue allows outside bakers (matches non-shared-flow copy on screen)
    "By signing, you confirm either (a) your venue allows outside bakers, or (b) you’ll book a venue that does.",

    // 2) Deposit + FINAL_DUE_DAYS payoff
    `You may pay in full today, or place a 25% non-refundable deposit. Any remaining balance will be split into monthly installments and must be fully paid ${FINAL_DUE_DAYS} days before your wedding date.`,

    // 3) Card-on-file consent (matches contract bullet)
    "By agreeing and completing checkout, you authorize Wed&Done and its payment partners to securely store your card and charge it for this dessert booking, including any scheduled installments and any remaining balance, using the payment method you select at checkout or any updated card you add later.",

    // 4) Guest count / 30 + 45 days
    "Final guest count is due 30 days before your wedding. You may increase your guest count starting 45 days before your wedding, but the count cannot be lowered after booking.",

    // 5) Cancellation & Refunds
    `Cancellation & Refunds: If you cancel more than ${FINAL_DUE_DAYS} days prior, amounts paid beyond the non-refundable portion will be refunded less any non-recoverable costs already incurred. Within ${FINAL_DUE_DAYS} days, all payments are non-refundable.`,

    // 6) Missed Payments
    "Missed Payments: We’ll automatically retry your card. After 7 days, a $25 late fee applies; after 14 days, services may be suspended and this agreement may be in default.",

    // 7) Food safety & venue policies
    "Food Safety & Venue Policies: We’ll follow standard food-safety guidelines and comply with venue rules, which may limit display/location options.",

    // 8) Force Majeure
    "Force Majeure: Neither party is liable for delays beyond reasonable control. We’ll work in good faith to reschedule; if not possible, we’ll refund amounts paid beyond non-recoverable costs already incurred.",

    // 9) Liability cap
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

  // ---------- Signature block (safe placement) ----------
  y2 += 12;
  if (y2 > pageH - 70) {
    addFooter();
    doc.addPage();
    doc.setFont("helvetica", "normal");
    doc.setFontSize(12);
    doc.setTextColor(0);
    y2 = 30;
  }

  doc.text("Signature:", 20, y2);
  y2 += 5;

  // Helper: detect format from data URL
  const detectFormat = (url: string): "PNG" | "JPEG" | undefined => {
    if (!url) return undefined;
    if (url.startsWith("data:image/png")) return "PNG";
    if (url.startsWith("data:image/jpeg") || url.startsWith("data:image/jpg"))
      return "JPEG";
    return undefined; // let jsPDF guess if needed
  };

  try {
    if (signatureImageUrl) {
      const sigW = 100;
      const sigH = 40;
      const fmt = detectFormat(signatureImageUrl);

      if (signatureImageUrl.startsWith("data:")) {
        // data URL → add directly
        doc.addImage(
          signatureImageUrl,
          (fmt as any) || "PNG",
          20,
          y2,
          sigW,
          sigH
        );
      } else {
        // blob:/http(s): → load first
        const img = await (async () => {
          try {
            return await loadImage(signatureImageUrl);
          } catch {
            return null;
          }
        })();
        if (img) {
          doc.addImage(img, "PNG", 20, y2, sigW, sigH);
        } else {
          console.warn(
            "⚠️ Could not load signature image; leaving signature area blank."
          );
        }
      }
    }
  } catch (err) {
    console.error("❌ Failed to add signature image:", err);
  }

  y2 += 40 + 8;

  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Signed by: ${fullName}`, 20, y2);
  y2 += 7;
  doc.text(`Signature date: ${todayPretty}`, 20, y2);

  addFooter();

  return doc.output("blob");
};

export default generateDessertAgreementPDF;