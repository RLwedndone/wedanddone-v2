import jsPDF from "jspdf";

/* layout */
const MARGIN_X = 20,
  TOP_Y = 20,
  FOOTER_Y = 278,
  LINE_GAP = 8,
  PARA_GAP = 10;
const SIG_IMG_H = 40;
// we can keep this around if you ever want it, but it's no longer used
const SIG_BLOCK_H = 5 + SIG_IMG_H + 19 + 10;
const FINAL_DUE_DAYS = 35;

/* helpers */
function addFooter(doc: jsPDF) {
  doc.setDrawColor(200);
  doc.line(MARGIN_X, FOOTER_Y - 8, 190, FOOTER_Y - 8);
  doc.setFontSize(10);
  doc.setTextColor(120);
  doc.text("Magically booked by Wed&Done", 105, FOOTER_Y, { align: "center" });
}

function ensureSpace(doc: jsPDF, y: number, needed = 12) {
  if (y + needed > FOOTER_Y - 12) {
    addFooter(doc);
    doc.addPage();
    return TOP_Y;
  }
  return y;
}

function toPrettyDate(input: string) {
  const ymd = /^\d{4}-\d{2}-\d{2}$/;
  let d: Date | null = null;

  if (ymd.test(input)) {
    d = new Date(`${input}T12:00:00`);
  } else {
    const t = new Date(input);
    if (!isNaN(t.getTime())) d = t;
  }

  if (!d) return input;

  const m = d.toLocaleString("en-US", { month: "long" });
  const day = d.getDate();
  const y = d.getFullYear();
  const ord =
    day >= 11 && day <= 13
      ? "th"
      : [,"st", "nd", "rd"][day % 10] ?? "th";

  return `${m} ${day}${ord}, ${y}`;
}

function addDays(d: Date, days: number) {
  return new Date(d.getTime() + days * 86400000);
}

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((res, rej) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = src;
  });

/* types */
export interface BatesPDFOptions {
  fullName: string;
  total: number;
  deposit: number;
  guestCount: number;
  weddingDate: string;
  signatureImageUrl: string;
  paymentSummary: string;
  lineItems?: string[];
  menuSelections?: {
    appetizers?: string[];
    mains?: string[];
    sides?: string[];
  };
}

/* generator */
const generateBatesCateringAgreementPDF = async ({
  fullName,
  total,
  deposit,
  guestCount,
  weddingDate,
  signatureImageUrl,
  paymentSummary,
  lineItems = [],
  menuSelections = {},
}: BatesPDFOptions): Promise<Blob> => {
  const doc = new jsPDF();

  // header art
  const [logo, lock] = await Promise.all([
    loadImage(`${import.meta.env.BASE_URL}assets/images/rainbow_logo.jpg`),
    loadImage(`${import.meta.env.BASE_URL}assets/images/lock_grey.jpg`),
  ]);
  doc.addImage(lock, "JPEG", 40, 60, 130, 130);
  doc.addImage(logo, "JPEG", 75, 10, 60, 60);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(16);
  doc.setTextColor(0);
  doc.text("Bates Catering Agreement & Receipt (Add-Ons)", 105, 75, {
    align: "center",
  });

  // ⭐ Resolve wedding date with fallbacks
  let resolvedWeddingDate = weddingDate;
  try {
    if (!resolvedWeddingDate) {
      resolvedWeddingDate =
        localStorage.getItem("yumWeddingDate") ||
        localStorage.getItem("weddingDate") ||
        "";
    }
  } catch {
    // ignore localStorage errors
  }

  const prettyWedding = resolvedWeddingDate
    ? toPrettyDate(resolvedWeddingDate)
    : "TBD";

  const todayPretty = toPrettyDate(new Date().toISOString());

  // ⭐ final due = resolved wedding − 35 days (if valid)
  let dueByPretty = "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(resolvedWeddingDate)) {
    dueByPretty = toPrettyDate(
      addDays(new Date(`${resolvedWeddingDate}T12:00:00`), -FINAL_DUE_DAYS).toISOString()
    );
  }

  // ⭐ Guest-count display: avoid "0", show TBD if not provided
  const displayGuestCount =
    typeof guestCount === "number" && guestCount > 0
      ? String(guestCount)
      : "TBD";

  // basics
  doc.setFontSize(12);
  let y = 90;
  doc.text(`Name: ${fullName}`, MARGIN_X, y);
  y += LINE_GAP;
  doc.text(`Wedding Date: ${prettyWedding}`, MARGIN_X, y);
  y += LINE_GAP;
  doc.text(`Guest Count: ${displayGuestCount}`, MARGIN_X, y);
  y += LINE_GAP + LINE_GAP;

  // selections / included
  if (
    lineItems.length ||
    menuSelections.appetizers?.length ||
    menuSelections.mains?.length ||
    menuSelections.sides?.length
  ) {
    y = ensureSpace(doc, y, PARA_GAP + LINE_GAP);
    doc.setFontSize(14);
    doc.text("Selections / Included:", MARGIN_X, y);
    y += PARA_GAP;
    doc.setFontSize(12);

    for (const item of lineItems) {
      for (const ln of doc.splitTextToSize(`• ${item}`, 170)) {
        y = ensureSpace(doc, y, LINE_GAP);
        doc.text(ln, MARGIN_X + 5, y);
        y += LINE_GAP;
      }
    }

    const section = (label: string, items?: string[]) => {
      if (!items?.length) return;
      y = ensureSpace(doc, y, LINE_GAP);
      doc.text(`${label}:`, MARGIN_X + 5, y);
      y += LINE_GAP;
      for (const it of items) {
        for (const ln of doc.splitTextToSize(`- ${it}`, 165)) {
          y = ensureSpace(doc, y, LINE_GAP);
          doc.text(ln, MARGIN_X + 10, y);
          y += LINE_GAP;
        }
      }
    };

    section("Appetizers", menuSelections.appetizers);
    section("Main Courses", menuSelections.mains);
    section("Sides", menuSelections.sides);
  }

  // payment summary
  y += PARA_GAP;
  y = ensureSpace(doc, y, LINE_GAP * 4 + PARA_GAP);
  doc.setTextColor(0);
  doc.setFontSize(12);
  doc.text("Payment Summary:", MARGIN_X, y);
  y += LINE_GAP;

  for (const ln of doc.splitTextToSize(paymentSummary, 170)) {
    y = ensureSpace(doc, y, LINE_GAP);
    doc.text(ln, MARGIN_X + 5, y);
    y += LINE_GAP;
  }

  if (deposit > 0 && deposit < total) {
    doc.text(`Deposit Paid Today: $${deposit.toFixed(2)}`, MARGIN_X + 5, y);
    y += LINE_GAP;
    if (dueByPretty) {
      doc.text(
        `Remaining balance due by: ${dueByPretty}`,
        MARGIN_X + 5,
        y
      );
      y += LINE_GAP;
    }
  } else {
    doc.text(
      `Total Paid in Full Today: $${total.toFixed(2)}`,
      MARGIN_X + 5,
      y
    );
    y += LINE_GAP;
  }

  doc.text(`Date Paid: ${todayPretty}`, MARGIN_X + 5, y);
  y += PARA_GAP;

  /* Terms section */
  const H = () => {
    y = ensureSpace(doc, y, LINE_GAP + PARA_GAP);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text("Terms", MARGIN_X, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(12);
    y += 6;
  };

  const OL = (n: number, text: string) => {
    for (const ln of doc.splitTextToSize(`${n}. ${text}`, 170)) {
      y = ensureSpace(doc, y, LINE_GAP);
      doc.text(ln, MARGIN_X, y);
      y += LINE_GAP;
    }
    y += 2;
  };

  H();
  OL(
    1,
    "Included Services. Catering included in your Bates venue package is covered by your venue booking. Only selected add-ons are billed through this agreement."
  );
  OL(
    2,
    `Payment. ${
      total > 0
        ? "You agree to pay for the selected add-ons."
        : "No add-ons selected; no payment is due."
    } If you choose Deposit + Monthly, you authorize Wed&Done to automatically charge the remaining balance in monthly installments. The final payment is due ${FINAL_DUE_DAYS} days before your wedding date.`
  );
  OL(
    3,
    "Non-Refundable Add-Ons. Add-on purchases are non-refundable once confirmed."
  );
  OL(
    4,
    "Guest Count Policy. Final guest counts are due 30 days prior to the wedding. Guest count changes are only accepted via the Guest Count Scroll between 45–30 days before your wedding."
  );
  OL(
    5,
    "Substitutions & Availability. Menu items, brands, or ingredients may be substituted with comparable alternatives based on seasonality or supply constraints at the caterer’s discretion."
  );
  OL(
    6,
    "Allergies & Dietary Needs. You are responsible for communicating allergies or dietary restrictions to Wed&Done at least 30 days prior to the event. While reasonable efforts will be made, the caterer cannot guarantee an allergen-free environment."
  );
  OL(
    7,
    "Force Majeure. Neither party is liable for delays or failure to perform due to events beyond reasonable control (e.g., severe weather, government action, labor disputes, supply chain issues). In such cases, services may be rescheduled or modified in good faith."
  );

  // ───────── Signature block: inline, just after Terms ─────────
  // Make sure there's room for the signature + two small lines
  y = ensureSpace(doc, y, SIG_IMG_H + 30);

  doc.setTextColor(0);
  doc.setFontSize(12);
  doc.text("Signature", MARGIN_X, y);

  let sigY = y + 5;

  const detectFmt = (url: string): "PNG" | "JPEG" | undefined =>
    url?.startsWith("data:image/png")
      ? "PNG"
      : url?.startsWith("data:image/jpeg") || url?.startsWith("data:image/jpg")
      ? "JPEG"
      : undefined;

  try {
    if (signatureImageUrl) {
      if (signatureImageUrl.startsWith("data:")) {
        doc.addImage(
          signatureImageUrl,
          detectFmt(signatureImageUrl) as any,
          MARGIN_X,
          sigY,
          100,
          SIG_IMG_H
        );
      } else {
        const img = await loadImage(signatureImageUrl).catch(() => null as any);
        if (img) {
          doc.addImage(img, "PNG", MARGIN_X, sigY, 100, SIG_IMG_H);
        }
      }
    }
  } catch {
    // swallow signature image errors so the PDF still generates
  }

  // Text under the signature image
  const textY = sigY + SIG_IMG_H + 12;
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Signed by: ${fullName}`, MARGIN_X, textY);
  doc.text(
    `Signature date: ${todayPretty}`,
    MARGIN_X,
    textY + 7
  );

  addFooter(doc);
  return doc.output("blob");
};

export default generateBatesCateringAgreementPDF;