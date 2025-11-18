import React, { useState, useEffect, useRef } from "react";
import { auth, db } from "../../../firebase/firebaseConfig";
import { doc, updateDoc, arrayUnion } from "firebase/firestore";
import {
  generateMagicPhotoDeetsPDF,
  type MagicPhotoDeetsData,
} from "../../../utils/generateMagicPhotoDeetsPDF";
import { uploadPdfBlob } from "../../../helpers/firebaseUtils";

/* --------------------------- helpers --------------------------- */

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function titleizeKey(k: string): string {
  return (k || "")
    .replace(/[-_]+/g, " ")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function readSelections(key: string) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const data = JSON.parse(raw);
    const sel =
      data?.selections && typeof data.selections === "object"
        ? data.selections
        : {};
    const out: { id: string; title: string; names: string[] }[] = [];

    (Object.entries(sel) as [string, unknown][])
      .forEach(([shotKey, names]) => {
        const list = Array.isArray(names)
          ? ((names as unknown[]).filter(Boolean) as string[])
          : [];
        out.push({
          id: `${key}:${shotKey}`,
          title: titleizeKey(shotKey),
          names: list,
        });
      });

    return out;
  } catch {
    return [];
  }
}

function buildMagicPhotoPayload(): MagicPhotoDeetsData {
  let lb1First = "";
  let lb1Last = "";
  let lb2First = "";
  let lb2Last = "";
  try {
    const raw = localStorage.getItem("magicBookCoupleInfo");
    if (raw) {
      const parsed = JSON.parse(raw);
      lb1First = parsed?.loveBird1?.first || "";
      lb1Last = parsed?.loveBird1?.last || "";
      lb2First = parsed?.loveBird2?.first || "";
      lb2Last = parsed?.loveBird2?.last || "";
    }
  } catch {}

  const weddingDate = "";

  const list1 = readSelections("photoShotList1").map((s) => ({
    ...s,
    source: "LB1" as const,
  }));
  const list2 = readSelections("photoShotList2").map((s) => ({
    ...s,
    source: "LB2" as const,
  }));
  const listC = readSelections("photoShotListCombined").map((s) => ({
    ...s,
    source: "Combined" as const,
  }));

  const shots = [...list1, ...list2, ...listC];

  return {
    couple: { lb1First, lb2First, weddingDate },
    shots,
    createdAtISO: new Date().toISOString(),
  };
}

/* --------------------------- component --------------------------- */

type Props = {
  onBack: () => void;
  onClose?: () => void;
  goToTOC?: () => void; // ✅ added
};

const PhotoShotPDF: React.FC<Props> = ({ onBack, onClose, goToTOC }) => {
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<MagicPhotoDeetsData | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);

  // Scroll card into view on mount
  useEffect(() => {
    try {
      cardRef.current?.scrollIntoView({ block: "start" });
    } catch {}
  }, []);

  useEffect(() => {
    setPreview(buildMagicPhotoPayload());
  }, []);

  const handleCreatePDF = async () => {
    setLoading(true);
    try {
      const payload = buildMagicPhotoPayload();
      const blob = await generateMagicPhotoDeetsPDF(payload);
      const fileName = `Magical-Photo-Deets-${new Date()
        .toISOString()
        .slice(0, 10)}.pdf`;

      const user = auth.currentUser;
      if (!user) {
        downloadBlob(blob, fileName);
        setLoading(false);
        return;
      }

      const filePath = `users/${user.uid}/documents/magicPhotoDeets/${fileName}`;
      const fileURL = await uploadPdfBlob(blob, filePath);

      const userDocRef = doc(db, "users", user.uid);
      await updateDoc(userDocRef, {
        documents: arrayUnion({
          title: "Your Magical Photo Deets",
          url: fileURL,
          filePath,
          createdAt: new Date().toISOString(),
          type: "magicPhotoDeets",
        }),
      });

      downloadBlob(blob, fileName);
    } catch (e) {
      console.error("Magic Photo Deets PDF error:", e);
      alert("Whoops! Couldn’t create your PDF. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleBackToTOC = () => {
    console.log(
      "[DBG][PhotoShotPDF] TOC click – has goToTOC?",
      typeof goToTOC === "function"
    );
    if (typeof goToTOC === "function") {
      goToTOC();
      return;
    }
    // Fallback: set intent + tell overlay to navigate
    localStorage.setItem("magicStep", "toc");
    window.dispatchEvent(new Event("magic:gotoTOC"));
  };

  return (
    <>
      <div
        ref={cardRef}
        className="pixie-card"
        style={{
          maxWidth: 780,
          margin: "0 auto",
          padding: "1.5rem 2.75rem",
          position: "relative",
          textAlign: "center",
          color: "#111",
        }}
      >
        {/* Pink X close → TOC */}
        <button
          className="pixie-card__close"
          onClick={handleBackToTOC}
          aria-label="Close"
        >
          <img
            src={`${import.meta.env.BASE_URL}assets/icons/pink_ex.png`}
            alt="Close"
          />
        </button>

        <img
          src={`${import.meta.env.BASE_URL}assets/images/Camera_wand.png`}
          alt="Camera Wand"
          style={{
            width: 96,
            height: 96,
            objectFit: "contain",
            margin: "0 auto 12px",
            display: "block",
          }}
          onError={(e) =>
            ((e.currentTarget as HTMLImageElement).style.display = "none")
          }
        />
        <h2
  style={{
    fontFamily: "'Jenna Sue','Jena Sue',cursive",
    fontSize: "2.4rem",
    lineHeight: 1.1,
    color: "#2c62ba",
    textAlign: "center",
    margin: "0 0 0.5rem",
  }}
>
  Your Magical Photo Deets
</h2>
        <p style={{ margin: "0 auto 16px", maxWidth: 560 }}>
          We’ve magically whipped up your formal shots into a clean, printable
          PDF. Once you hit that "Make My PDF!" button below, if you’re logged
          in, we’ll save it to your Documents. If you’re browsing as a guest,
          we’ll simply download it to your device. If you see anything that
          needs to change, just use the back button to edit your VIPs and shots.
        </p>

        {/* ---- On-screen preview ---- */}
        <div
          style={{
            margin: "16px auto",
            maxWidth: 560,
            border: "1px solid #eee",
            borderRadius: 12,
            padding: "12px 14px",
            textAlign: "left",
          }}
        >
          {!preview ? (
            <p style={{ color: "#666", margin: 0 }}>
              Loading your shot list…
            </p>
          ) : (
            (() => {
              let lb1First = preview.couple.lb1First || "";
              let lb2First = preview.couple.lb2First || "";
              let lb1Last = "";
              let lb2Last = "";
              try {
                const raw = localStorage.getItem("magicBookCoupleInfo");
                if (raw) {
                  const parsed = JSON.parse(raw);
                  lb1Last = parsed?.loveBird1?.last || "";
                  lb2Last = parsed?.loveBird2?.last || "";
                }
              } catch {}

              const lb1Full = [lb1First, lb1Last].filter(Boolean).join(" ");
              const lb2Full = [lb2First, lb2Last].filter(Boolean).join(" ");
              const possessive = (name: string) => `${name}’s`;
              const group = (src: "LB1" | "LB2" | "Combined") =>
                preview.shots.filter((s) => (s as any).source === src);

              const sections: Array<{
                title: string;
                items: typeof preview.shots;
                fullName?: string;
              }> = [
                {
                  title: `${possessive(lb1First || "LB1")} Shots`,
                  items: group("LB1"),
                  fullName: lb1Full,
                },
                {
                  title: `${possessive(lb2First || "LB2")} Shots`,
                  items: group("LB2"),
                  fullName: lb2Full,
                },
                { title: "Combined Shots", items: group("Combined") },
              ];

              const hasAny = sections.some((s) => s.items.length > 0);
              if (!hasAny)
                return (
                  <div style={{ color: "#666" }}>No shots selected yet.</div>
                );

              return (
                <div style={{ display: "grid", gap: 12 }}>
                  {sections.map(({ title, items, fullName }) =>
                    items.length ? (
                      <div key={title}>
                        <div
                          style={{
                            fontWeight: 700,
                            marginBottom: 6,
                          }}
                        >
                          {title}
                        </div>
                        {items.map((shot: any, idx: number) => {
                          const whoList =
                            fullName && Array.isArray(shot.names)
                              ? [fullName, ...shot.names]
                              : shot.names || [];
                          return (
                            <div
                              key={`${title}-${shot.id || idx}`}
                              style={{
                                lineHeight: 1.5,
                                marginBottom: 6,
                              }}
                            >
                              <div style={{ fontWeight: 600 }}>
                                {`Shot #${idx + 1} - ${
                                  shot.title || "Untitled Shot"
                                }`}
                              </div>
                              <div style={{ color: "#333" }}>
                                {whoList && whoList.length
                                  ? `Who: ${whoList.join(", ")}`
                                  : "Who: (not specified)"}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : null
                  )}
                </div>
              );
            })()
          )}
        </div>

        {/* Stacked, centered buttons */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 12,
            marginTop: 20,
          }}
        >
          {/* Blue create PDF */}
          <button
            className="pixie-continue"
            onClick={handleCreatePDF}
            disabled={loading}
            style={{
              minWidth: 260,
              padding: "12px 18px",
              borderRadius: 12,
              border: "none",
              fontWeight: 700,
              background: "#2c62ba",
              color: "#fff",
              boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
              cursor: loading ? "default" : "pointer",
            }}
          >
            {loading ? "Creating PDF..." : "Create My Shot List PDF"}
          </button>

          {/* Pink back */}
          <button
            className="boutique-back-btn"
            onClick={onBack}
            disabled={loading}
            style={{ minWidth: 260, padding: "10px 16px", borderRadius: 12 }}
          >
            Back
          </button>

          {/* Purple Back to TOC */}
          <button
            onClick={handleBackToTOC}
            style={{
              backgroundColor: "#7b4bd8",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              padding: "0.75rem 1rem",
              fontSize: "1.05rem",
              fontWeight: 600,
              cursor: "pointer",
              width: 180,
              marginTop: "0.5rem",
            }}
          >
            🪄 Back to TOC
          </button>

          {/* Optional close (exit overlay entirely) */}
          {onClose && (
            <button
              className="boutique-back-btn"
              onClick={onClose}
              disabled={loading}
              style={{ minWidth: 260, padding: "10px 16px", borderRadius: 12 }}
            >
              Close
            </button>
          )}
        </div>

        <p
          style={{
            fontSize: "0.9rem",
            color: "#666",
            marginTop: 16,
          }}
        >
          Tip: double-check names on your VIP list before exporting.
        </p>
      </div>
    </>
  );
};

export default PhotoShotPDF;