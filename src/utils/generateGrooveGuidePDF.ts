import jsPDF from "jspdf";
import { uploadPdfBlob } from "../helpers/firebaseUtils";
import { db } from "../firebase/firebaseConfig";
import { doc, updateDoc, arrayUnion } from "firebase/firestore";
import emailjs from "emailjs-com";

export interface GrooveGuideData {
  fullName: string;
  weddingDate: string;
  selections: {
    // 🔹 NEW: the field CeremonyOrder.tsx actually writes to
    customProcessional?: Record<string, string>;
    // 🔹 legacy support (if anything still uses ceremonyOrder)
    ceremonyOrder?: Record<string, string>;
    ceremonyMusic?: {
      brideEntranceSong?: any;
      partyEntranceSong?: any;
      otherCeremonySongs?: any;
      recessionalSong?: any;
    };
    cocktailMusic?: string;
    dinnerMusic?: string;
    familyDances?: {
      skipFirstDance?: boolean;
      firstDanceSong?: string;
      firstDanceArtist?: string;
      skipMotherSon?: boolean;
      motherSonSong?: string;
      motherSonArtist?: string;
      skipFatherDaughter?: boolean;
      fatherDaughterSong?: string;
      fatherDaughterArtist?: string;
    };
    preDinnerWelcome?: {
      hasWelcome?: boolean;
      speaker?: string;
    };
    grandEntrances?: {
      selection?: string;
      coupleSong?: string;
      coupleArtist?: string;
      bridesmaidsSong?: string;
      bridesmaidsArtist?: string;
      groomsmenSong?: string;
      groomsmenArtist?: string;
    };
    cakeCutting?: {
      doCakeCutting?: boolean;
      song?: string;
      artist?: string;
    };
    musicalGenres?: Record<string, string>;
  };
}

// 🔹 helper: parse YMD safely (fixes “one day early”)
const parseWeddingDate = (raw: string): Date | null => {
  if (!raw) return null;

  // If it's a plain YYYY-MM-DD, force local noon to avoid timezone slip
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const d = new Date(`${raw}T12:00:00`);
    return isNaN(d.getTime()) ? null : d;
  }

  // Otherwise let Date try, but guard NaN
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
};

export const generateGrooveGuidePDF = async ({
  fullName,
  weddingDate,
  selections,
}: GrooveGuideData): Promise<Blob> => {
  const doc = new jsPDF();
  let y = 20;

  const addImage = (src: string, x: number, yPos: number, w: number, h: number) =>
    new Promise<void>((resolve, reject) => {
      const img = new Image();
      img.src = `${window.location.origin}${src}`;
      img.onload = () => {
        doc.addImage(img, "PNG", x, yPos, w, h);
        resolve();
      };
      img.onerror = (err) => {
        console.error("❌ Image load failed for:", img.src);
        reject(err);
      };
    });

  // 🐸 Frog Header (make it larger + centered)
  const frogImage = new Image();
  frogImage.src = `${window.location.origin}/assets/images/JamPDFIcons/groove_frog_header.png`;

  await new Promise<void>((resolve, reject) => {
    frogImage.onload = () => {
      const naturalW = frogImage.naturalWidth;
      const naturalH = frogImage.naturalHeight;

      // scale up a bit from the old 0.02
      const scale = 0.035;
      const w = naturalW * scale;
      const h = naturalH * scale;

      const pageW = doc.internal.pageSize.getWidth();
      const x = (pageW - w) / 2;

      doc.addImage(frogImage, "PNG", x, y, w, h);
      y += h + 10;
      resolve();
    };
    frogImage.onerror = reject;
  });

  // ✨ Title
  const pageW = doc.internal.pageSize.getWidth();
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("Your Groove Guide!", pageW / 2, y, { align: "center" });
  y += 10;

  // 🔹 Safe, non–off-by-one wedding date
  const parsedWedding = parseWeddingDate(weddingDate);
  const formattedDate = parsedWedding
    ? parsedWedding.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : weddingDate;

  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.text(`Wedding Date: ${formattedDate}`, pageW / 2, y, { align: "center" });
  y += 10;

  // Shared section helper — icon above, centered, bullets underneath
  const section = async (title: string, icon: string, lines: string[]) => {
    const iconSize = 20;
    const iconX = (pageW - iconSize) / 2;

    // icon
    await addImage(`/assets/images/JamPDFIcons/${icon}`, iconX, y, iconSize, iconSize);
    y += iconSize + 6;

    // title
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text(title, pageW / 2, y, { align: "center" });
    y += 8;

    // bullets
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");

    const bottomLimit = doc.internal.pageSize.getHeight() - 20;

    lines.forEach((line) => {
      if (y > bottomLimit) {
        doc.addPage();
        y = 20;
      }
      doc.text(`• ${line}`, pageW / 2, y, { align: "center" });
      y += 7;
    });

    y += 10;
    if (y > bottomLimit) {
      doc.addPage();
      y = 20;
    }
  };

  const s = selections;

  // 🔹 Ceremony Order (NEW wiring from customProcessional)
  {
    const processional = s.customProcessional || s.ceremonyOrder;
    if (processional) {
      const orderLines: string[] = [];
      const labelMap: Record<string, string> = {
        first: "First to enter",
        second: "Second",
        third: "Third",
        fourth: "Fourth",
        fifth: "Fifth",
        sixth: "Sixth",
        additional: "Additional",
      };

      Object.entries(labelMap).forEach(([key, label]) => {
        const val = (processional as any)[key];
        if (val && String(val).trim()) {
          orderLines.push(`${label}: ${val}`);
        }
      });

      await section(
        "Ceremony Order",
        "ceremony_scroll.png",
        orderLines.length > 0 ? orderLines : ["Nothing entered"]
      );
    }
  }

  // Ceremony Songs
  if (s.ceremonyMusic) {
    const lines: string[] = [];
    const format = (label: string, song: any) =>
      `${label}: ${song?.songTitle || "-"} by ${song?.artist || "-"}`;

    if (s.ceremonyMusic.brideEntranceSong)
      lines.push(format("Bride Entrance", s.ceremonyMusic.brideEntranceSong));
    if (s.ceremonyMusic.partyEntranceSong)
      lines.push(format("Party Entrance", s.ceremonyMusic.partyEntranceSong));
    if (s.ceremonyMusic.otherCeremonySongs)
      lines.push(format("Other Ceremony", s.ceremonyMusic.otherCeremonySongs));
    if (s.ceremonyMusic.recessionalSong)
      lines.push(format("Recessional", s.ceremonyMusic.recessionalSong));

    await section(
      "Ceremony Music",
      "ceremony_scroll.png",
      lines.length > 0 ? lines : ["Nothing entered"]
    );
  }

  await section(
    "Cocktail Hour",
    "cocktail_glass.png",
    s.cocktailMusic ? [s.cocktailMusic] : ["Nothing entered"]
  );

  await section(
    "Dinner Music",
    "dinner_music.png",
    s.dinnerMusic ? [s.dinnerMusic] : ["Nothing entered"]
  );

  if (s.familyDances) {
    const lines: string[] = [];
    const fd = s.familyDances;

    if (!fd.skipFirstDance)
      lines.push(
        `First Dance: ${fd.firstDanceSong || "-"} by ${fd.firstDanceArtist || "-"}`
      );
    if (!fd.skipMotherSon)
      lines.push(
        `Mother–Son: ${fd.motherSonSong || "-"} by ${fd.motherSonArtist || "-"}`
      );
    if (!fd.skipFatherDaughter)
      lines.push(
        `Father–Daughter: ${fd.fatherDaughterSong || "-"} by ${
          fd.fatherDaughterArtist || "-"
        }`
      );

    await section(
      "Family Dances",
      "family_dance.png",
      lines.length > 0 ? lines : ["Nothing entered"]
    );
  } else {
    await section("Family Dances", "family_dance.png", ["Nothing entered"]);
  }

  if (s.preDinnerWelcome) {
    await section(
      "Pre-Dinner Welcome",
      "pre_dinner_icon.png",
      s.preDinnerWelcome.hasWelcome
        ? [`Speaker: ${s.preDinnerWelcome.speaker || "TBD"}`]
        : ["Nothing entered"]
    );
  } else {
    await section("Pre-Dinner Welcome", "pre_dinner_icon.png", ["Nothing entered"]);
  }

  if (s.grandEntrances) {
    const ge = s.grandEntrances;
    const lines = [`Type: ${ge.selection || "None"}`];

    if (ge.selection !== "none") {
      lines.push(`Couple: ${ge.coupleSong || "-"} by ${ge.coupleArtist || "-"}`);
    }
    if (ge.selection === "full") {
      lines.push(
        `Bridesmaids: ${ge.bridesmaidsSong || "-"} by ${
          ge.bridesmaidsArtist || "-"
        }`
      );
      lines.push(
        `Groomsmen: ${ge.groomsmenSong || "-"} by ${ge.groomsmenArtist || "-"}`
      );
    }

    await section("Grand Entrances", "grand_entrance.png", lines);
  } else {
    await section("Grand Entrances", "grand_entrance.png", ["Nothing entered"]);
  }

  await section(
    "Cake Cutting",
    "cake_icon.png",
    s.cakeCutting?.doCakeCutting
      ? [`${s.cakeCutting.song || "-"} by ${s.cakeCutting.artist || "-"}`]
      : ["Nothing entered"]
  );

  const genreLines = Object.entries(s.musicalGenres || {}).map(
    ([genre, value]) => `${genre}: ${value}`
  );
  await section(
    "Musical Genres",
    "genres_icon.png",
    genreLines.length > 0 ? genreLines : ["Nothing entered"]
  );

  // Footer
  doc.setDrawColor(200);
  doc.line(20, doc.internal.pageSize.getHeight() - 17, pageW - 20, doc.internal.pageSize.getHeight() - 17);
  doc.setFontSize(10);
  doc.setTextColor(120);
  doc.text(
    "Magically crafted by Wed&Done",
    pageW / 2,
    doc.internal.pageSize.getHeight() - 10,
    { align: "center" }
  );

  return doc.output("blob");
};