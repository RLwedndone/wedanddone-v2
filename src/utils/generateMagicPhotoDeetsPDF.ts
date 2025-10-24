// src/utils/generateMagicPhotoDeetsPDF.ts
import jsPDF from "jspdf";

/** Optional "source" lets us group like the preview */
export type ShotSource = "LB1" | "LB2" | "Combined";

export interface Shot {
  id: string;
  title: string;     // e.g., "Whole Family"
  names: string[];   // people in the shot
  source?: ShotSource;
}

export interface MagicPhotoDeetsData {
  couple: {
    lb1First?: string;
    lb2First?: string;
    weddingDate?: string;
  };
  /** Flattened list from photoShotList1/2/Combined with source tagged */
  shots: Shot[];
  createdAtISO?: string;
}

/** Small text wrap helper */
function wrapLines(doc: jsPDF, text: string, maxWidth: number): string[] {
  const lines = doc.splitTextToSize(text, maxWidth);
  return Array.isArray(lines) ? (lines as string[]) : [String(lines)];
}

/** Draw a section header with spacing + page break handling */
function drawSectionHeader(doc: jsPDF, title: string, y: number): number {
  if (y > 270) {
    doc.addPage();
    y = 20;
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(title, 20, y);
  return y + 8;
}

/** Draw a shot block: "Shot #n - Title" + "Who: ..." */
function drawShotBlock(
  doc: jsPDF,
  index: number,
  title: string,
  whoList: string[],
  y: number,
  maxWidth: number
): number {
  if (y > 270) {
    doc.addPage();
    y = 20;
  }

  // Shot title line
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  const shotTitle = `Shot #${index + 1} - ${title || "Untitled Shot"}`;
  const titleLines = wrapLines(doc, shotTitle, maxWidth);
  titleLines.forEach((ln: string) => {
    doc.text(ln, 20, y);
    y += 6;
  });

  // Who line
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  const whoText = whoList.length ? `Who: ${whoList.join(", ")}` : "Who: (not specified)";
  const whoLines = wrapLines(doc, whoText, maxWidth);
  whoLines.forEach((ln: string) => {
    doc.text(ln, 20, y);
    y += 5;
  });

  // trailing space between shots
  return y + 4;
}

/** Read last names from localStorage (to build full names in LB1/LB2 sections) */
function readCoupleLastsFromLocalStorage(): { lb1Last: string; lb2Last: string } {
  try {
    const raw = localStorage.getItem("magicBookCoupleInfo");
    if (!raw) return { lb1Last: "", lb2Last: "" };
    const parsed = JSON.parse(raw);
    return {
      lb1Last: parsed?.loveBird1?.last || "",
      lb2Last: parsed?.loveBird2?.last || "",
    };
  } catch {
    return { lb1Last: "", lb2Last: "" };
  }
}

/** Always use ’s for possessives (Chris -> Chris’s) */
function possessive(name?: string): string {
  const n = (name || "").trim();
  if (!n) return "LB’s";
  return `${n}’s`;
}

/** MAIN: generate the PDF blob */
export async function generateMagicPhotoDeetsPDF(payload: MagicPhotoDeetsData): Promise<Blob> {
  const doc = new jsPDF();
  let y = 20;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentMaxWidth = pageWidth - 40; // 20 left + 20 right

  // === HEADER CAMERA WAND (PNG) ===
  try {
    const wandImg = new Image();
    wandImg.src = `${window.location.origin}/assets/images/Camera_wand.png`;
    await new Promise<void>((res, rej) => {
      wandImg.onload = () => {
        // scale based on pixels -> points (approx 72/96) and a multiplier
        const scale = 0.08;
        const w = wandImg.naturalWidth * (72 / 96) * scale;
        const h = wandImg.naturalHeight * (72 / 96) * scale;
        const x = (pageWidth - w) / 2;
        doc.addImage(wandImg, "PNG", x, y, w, h);
        y += h + 8; // push content down
        res();
      };
      wandImg.onerror = () => rej();
    });
  } catch {
    // non-fatal
    console.warn("Camera wand image failed to load.");
  }

  // Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("Your Magical Photo Deets", pageWidth / 2, y, { align: "center" });
  y += 8;

  // Optional wedding date
  if (payload.couple?.weddingDate) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    const d = new Date(payload.couple.weddingDate);
    const friendly = !isNaN(d.getTime())
      ? d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
      : payload.couple.weddingDate;
    doc.text(friendly, pageWidth / 2, y, { align: "center" });
    y += 8;
  }

  y += 4; // breathing room

  // Names for headings and full‑name prepend (LB1/LB2 sections)
  const { lb1Last, lb2Last } = readCoupleLastsFromLocalStorage();
  const lb1First = (payload.couple?.lb1First || "LB1").trim();
  const lb2First = (payload.couple?.lb2First || "LB2").trim();
  const lb1Full = [lb1First, lb1Last].filter(Boolean).join(" ");
  const lb2Full = [lb2First, lb2Last].filter(Boolean).join(" ");

  // Group shots by source
  const bySource = {
    LB1: payload.shots.filter((s) => s.source === "LB1"),
    LB2: payload.shots.filter((s) => s.source === "LB2"),
    Combined: payload.shots.filter((s) => s.source === "Combined"),
  };

  // Render sections in order LB1, LB2, Combined
  const sections: Array<{ title: string; list: Shot[]; prepend?: string }> = [
    { title: `${possessive(lb1First)} Shots`, list: bySource.LB1, prepend: lb1Full },
    { title: `${possessive(lb2First)} Shots`, list: bySource.LB2, prepend: lb2Full },
    { title: "Combined Shots", list: bySource.Combined },
  ];

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);

  for (const section of sections) {
    if (!section.list.length) continue;

    // Section header
    y = drawSectionHeader(doc, section.title, y);

    // Shots inside section
    section.list.forEach((shot: Shot, idx: number) => {
      const names = Array.isArray(shot.names) ? [...shot.names] : [];
      if (section.prepend) {
        names.unshift(section.prepend); // add full name first
      }
      y = drawShotBlock(doc, idx, shot.title, names, y, contentMaxWidth);
    });

    y += 4;
  }

  // Footer line + tagline
  if (y > 270) {
    doc.addPage();
    y = 20;
  }
  doc.setDrawColor(200);
  doc.line(20, pageHeight - 12, pageWidth - 20, pageHeight - 12);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(120);
  doc.text("Magically crafted by Wed&Done", pageWidth / 2, pageHeight - 4, { align: "center" });

  // === FOOTER RAINBOW LOGO (JPG) ===
  try {
    const rainbowImg = new Image();
    rainbowImg.src = `${window.location.origin}/assets/images/rainbow_logo.jpg`;
    await new Promise<void>((res, rej) => {
      rainbowImg.onload = () => {
        const scale = 0.15;
        const w = rainbowImg.naturalWidth * (72 / 96) * scale;
        const h = rainbowImg.naturalHeight * (72 / 96) * scale;
        const x = pageWidth - w - 20; // right margin
        const yPos = pageHeight - h - 16; // above the footer line/tagline
        doc.addImage(rainbowImg, "JPG", x, yPos, w, h);
        res();
      };
      rainbowImg.onerror = () => rej();
    });
  } catch {
    console.warn("Rainbow logo failed to load.");
  }

  return doc.output("blob");
}