import jsPDF from "jspdf";

/* ---------- Layout constants ---------- */
const MARGIN_X = 20;
const TOP_Y = 20;
const FOOTER_Y = 278;
const LINE_GAP = 8;
const PARA_GAP = 10;

const SIG_IMG_H = 30;
const SIG_BLOCK_H = 5 + SIG_IMG_H + 7 + 7;

/* ---------- helpers ---------- */
function addFooter(doc: jsPDF) {
  doc.setDrawColor(200);
  doc.line(MARGIN_X, FOOTER_Y - 8, 190, FOOTER_Y - 8);
  doc.setFontSize(10);
  doc.setTextColor(120);
  doc.text("Magically booked by Wed&Done", 105, FOOTER_Y, {
    align: "center",
  });
}

function resetBodyStyle(doc: jsPDF) {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.setTextColor(0); // black body text
}

function ensureSpace(doc: jsPDF, y: number, needed = 12): number {
  if (y + needed > FOOTER_Y - 12) {
    addFooter(doc);
    doc.addPage();
    resetBodyStyle(doc);
    return TOP_Y;
  }
  return y;
}

function writeWrapped(doc: jsPDF, text: string, x: number, y: number, maxWidth = 170) {
  const lines = doc.splitTextToSize(text, maxWidth) as string[];
  for (const ln of lines) {
    y = ensureSpace(doc, y, LINE_GAP);
    doc.text(ln, x, y);
    y += LINE_GAP;
  }
  return y;
}

// Convert YYYY-MM-DD → "Month Dayth, Year"
function toPrettyDate(input: string | Date) {
  let d: Date | null = null;
  if (typeof input === "string") {
    if (/^\d{4}-\d{2}-\d{2}$/.test(input)) d = new Date(`${input}T12:00:00`);
    else {
      const tryDate = new Date(input);
      if (!isNaN(tryDate.getTime())) d = tryDate;
    }
  } else d = input;
  if (!d) return typeof input === "string" ? input : String(input);

  const month = d.toLocaleString("en-US", { month: "long" });
  const day = d.getDate();
  const year = d.getFullYear();
  const ord =
    day >= 11 && day <= 13
      ? "th"
      : day % 10 === 1
      ? "st"
      : day % 10 === 2
      ? "nd"
      : day % 10 === 3
      ? "rd"
      : "th";
  return `${month} ${day}${ord}, ${year}`;
}

const loadImage = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });

/* ---------- Types ---------- */
export interface RubiAgreementPDFOptions {
  fullName: string;
  venueName: string;
  catererName: string;
  menuChoice: "bbq" | "mexican";
  selectedPackage: string;
  guestCount: number;
  weddingDate: string;
  selections: any;
  lineItems: string[];
  totals: {
    baseCateringSubtotal: number;
    serviceCharge: number;
    taxableBase: number;
    taxes: number;
    cardFees: number;
    grandTotal: number;
  };
  pricePerGuestBase: number;
  pricePerGuestWithExtras: number;
  totalDueOverall: number;
  depositPaidToday: number;
  paymentSummary: string;
  signatureImageUrl: string;
}

/* ---------- Main ---------- */
export default async function generateRubiAgreementPDF(
  opts: RubiAgreementPDFOptions
): Promise<Blob> {
  console.log("🪶 [PDF] generateRubiAgreementPDF called with:", opts);

  const {
    fullName,
    venueName,
    catererName,
    menuChoice,
    selectedPackage,
    guestCount,
    weddingDate,
    selections,
    lineItems,
    totals,
    pricePerGuestBase,
    pricePerGuestWithExtras,
    totalDueOverall,
    depositPaidToday,
    paymentSummary,
    signatureImageUrl,
  } = opts;

  const doc = new jsPDF();

  // 🩵 Safe defaults
  const safeVenueName = venueName || "Rubi House";
  const safeGuestCount =
    typeof guestCount === "number" && guestCount > 0 ? guestCount : 0;

  // 🖼️ Branding
  try {
    const [logo, lock] = await Promise.all([
      loadImage(`${import.meta.env.BASE_URL}assets/images/rainbow_logo.jpg`),
      loadImage(`${import.meta.env.BASE_URL}assets/images/lock_grey.jpg`),
    ]);
    doc.addImage(lock, "JPEG", 40, 60, 130, 130);
    doc.addImage(logo, "JPEG", 75, 10, 60, 60);
  } catch {
    console.warn("⚠️ PDF images missing — continuing without them.");
  }

  // 🏷️ Header
  doc.setFont("helvetica", "normal");
  doc.setFontSize(16);
  doc.setTextColor(0);
  const catererDisplay =
    menuChoice === "bbq"
      ? catererName || "Brother John’s BBQ"
      : catererName || "Brother John’s Mexican";
  doc.text(
    `${safeVenueName} Catering Agreement & Receipt — ${catererDisplay}`,
    105,
    75,
    { align: "center" }
  );

  const weddingPretty = toPrettyDate(weddingDate || "TBD");
  const todayPretty = toPrettyDate(new Date());

  // 🧾 Basics
  resetBodyStyle(doc);
  let y = 90;
  doc.text(`Name: ${fullName}`, MARGIN_X, y);
  y += LINE_GAP;
  doc.text(`Wedding Date: ${weddingPretty}`, MARGIN_X, y);
  y += LINE_GAP;
  if (selectedPackage) {
    doc.text(`Selected Package: ${selectedPackage}`, MARGIN_X, y);
    y += LINE_GAP;
  }
  doc.text(`Caterer: ${catererDisplay}`, MARGIN_X, y);
  y += LINE_GAP;
  doc.text(`Guest Count: ${safeGuestCount}`, MARGIN_X, y);
  y += LINE_GAP * 2;

  // 🍽️ Selections
  const safeSelections: any = selections || {};
  const addGroup = (label: string, items: unknown) => {
    if (!Array.isArray(items) || !items.length) return;
    const line = `${label}: ${items.join(", ")}`;
    y = writeWrapped(doc, line, MARGIN_X + 5, y, 170);
  };

  const allGroups: [string, unknown][] = [
    ["Starters", safeSelections.bbqStarters],
    ["Smoked Meats", safeSelections.bbqMeats],
    ["Sides", safeSelections.bbqSides],
    ["Desserts", safeSelections.bbqDesserts],
    ["Passed Appetizers", safeSelections.mexPassedApps],
    ["Starter or Soup", safeSelections.mexStartersOrSoup],
    ["Entrées", safeSelections.mexEntrees],
    ["Sides", safeSelections.mexSides],
    ["Desserts", safeSelections.mexDesserts],
  ];

  const anyFilled = allGroups.some(
    ([_, val]) => Array.isArray(val) && (val as unknown[]).length
  );
  if (anyFilled || (safeSelections.notes && safeSelections.notes.trim() !== "")) {
    doc.setFontSize(14);
    doc.text("Your Selections:", MARGIN_X, y);
    y += PARA_GAP;
    resetBodyStyle(doc);
    for (const [label, items] of allGroups) addGroup(label, items);
    if (safeSelections.notes?.trim()) {
      const notesText = `Notes: ${safeSelections.notes}`;
      y = writeWrapped(doc, notesText, MARGIN_X + 5, y, 170);
    }
    y += PARA_GAP;
  }

  // 💲 Cost Breakdown (optional line item list)
  if (Array.isArray(lineItems) && lineItems.length) {
    y = ensureSpace(doc, y, PARA_GAP + LINE_GAP);
    doc.setFontSize(14);
    doc.text("Included Items / Pricing:", MARGIN_X, y);
    y += PARA_GAP;
    resetBodyStyle(doc);

    for (const item of lineItems) {
      const text = `• ${item}`;
      y = writeWrapped(doc, text, MARGIN_X + 5, y, 170);
    }
  }

  y += PARA_GAP;

  // 💰 Payment Summary
  doc.setFontSize(12);
  doc.text("Payment Summary:", MARGIN_X, y);
  y += LINE_GAP;
  resetBodyStyle(doc);

  if (paymentSummary) {
    y = writeWrapped(doc, paymentSummary, MARGIN_X + 5, y, 170);
  }

  const safeDeposit = !isNaN(depositPaidToday) ? depositPaidToday : 0;
  const safeTotal = !isNaN(totalDueOverall) ? totalDueOverall : 0;

  y = ensureSpace(doc, y, LINE_GAP);
  doc.text(
    `Amount Paid Today: $${Number(safeDeposit).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`,
    MARGIN_X + 5,
    (y += LINE_GAP)
  );
  doc.text(
    `Total Contract Amount: $${Number(safeTotal).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`,
    MARGIN_X + 5,
    (y += LINE_GAP)
  );
  doc.text(`Date Paid: ${todayPretty}`, MARGIN_X + 5, (y += LINE_GAP));
  y += PARA_GAP;

  // 🏰 Venue Note
  const banner = `${safeVenueName} note: This catering counts toward your food & beverage minimum with ${safeVenueName}. Any remaining spend to hit that minimum (like bar service) is handled directly with the venue and must follow Arizona liquor laws. Guest count locks 30 days before your wedding.`;
  y = writeWrapped(doc, banner, MARGIN_X, y, 170);

  y += PARA_GAP;

  // 📜 Booking Terms (mirror on-screen contract bullets)
  y = ensureSpace(doc, y, PARA_GAP + LINE_GAP);
  doc.setFontSize(13);
  doc.text("Booking Terms:", MARGIN_X, y);
  y += PARA_GAP;
  resetBodyStyle(doc);

  const terms: string[] = [
    "Your selected menu is included with your Rubi House venue package. Any additional food & beverage minimums, bar packages, or upgrades are handled directly with The Rubi House.",
    "Final guest count is due 30 days before your wedding. You may increase your count starting 45 days out, but it cannot be lowered after booking.",
    "Bar Packages: Alcohol is booked directly with the venue in accordance with Arizona liquor laws. Wed&Done does not provide bar service or alcohol.",
    "Cancellation & Refunds: Any changes to your catering package or minimums are governed by The Rubi House’s policies. Wed&Done will assist with documentation but does not control venue refunds.",
  ];

  for (const t of terms) {
    const bullet = "• ";
    const bulletW = doc.getTextWidth(bullet);
    const wrapW = 170 - bulletW;
    const lines = doc.splitTextToSize(t, wrapW) as string[];

    y = ensureSpace(doc, y, LINE_GAP);
    doc.text(bullet, MARGIN_X, y);
    doc.text(lines[0], MARGIN_X + bulletW, y);
    y += LINE_GAP;

    for (const ln of lines.slice(1)) {
      y = ensureSpace(doc, y, LINE_GAP);
      doc.text(ln, MARGIN_X + bulletW, y);
      y += LINE_GAP;
    }
  }

  // ✍️ Signature
  if (y + SIG_BLOCK_H > FOOTER_Y - 12) {
    addFooter(doc);
    doc.addPage();
    resetBodyStyle(doc);
    y = TOP_Y;
  }
  const sigTop = FOOTER_Y - 10 - SIG_BLOCK_H;
  doc.setFontSize(12);
  doc.setTextColor(0);
  doc.text("Signature", MARGIN_X, sigTop);
  try {
    if (signatureImageUrl) {
      doc.addImage(
        signatureImageUrl,
        "PNG",
        MARGIN_X,
        sigTop + 5,
        80,
        SIG_IMG_H
      );
    }
  } catch (err) {
    console.error("❌ Signature image failed:", err);
  }
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(
    `Signed by: ${fullName}`,
    MARGIN_X,
    sigTop + 5 + SIG_IMG_H + 12
  );
  doc.text(
    `Signature date: ${todayPretty}`,
    MARGIN_X,
    sigTop + 5 + SIG_IMG_H + 19
  );

  addFooter(doc);
  return doc.output("blob");
}