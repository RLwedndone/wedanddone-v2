// src/components/jam/CeremonyMusic.tsx
import React, { useEffect, useState } from "react";
import { getAuth } from "firebase/auth";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "../../firebase/firebaseConfig";
import { JamSelectionsType } from "./JamOverlay";

interface CeremonyMusicProps {
  onBack: () => void;
  onContinue: () => void;
  jamSelections: JamSelectionsType;
  setJamSelections: React.Dispatch<React.SetStateAction<JamSelectionsType>>;
  isGuestUser: boolean;
  currentStep: string;
  onClose?: () => void; // optional for pink X (overlay already provides a close)
}

const CeremonyMusic: React.FC<CeremonyMusicProps> = ({
  onBack,
  onContinue,
  jamSelections,
  setJamSelections,
  currentStep,
  isGuestUser,
  onClose,
}) => {
  const [formData, setFormData] = useState({
    partyEntrance: "",
    partyEntranceArtist: "",
    partyEntranceVersion: "",

    brideEntrance: "",
    brideEntranceArtist: "",
    brideEntranceVersion: "",

    otherSongs: "",
    otherSongsArtist: "",
    otherSongsVersion: "",

    recessionalSong: "",
    recessionalArtist: "",
    recessionalVersion: "",
  });

  const [expanded, setExpanded] = useState<string | null>(null);

  const toggleSection = (section: string) =>
    setExpanded((prev) => (prev === section ? null : section));

  // Load saved data (Firestore or localStorage)
  useEffect(() => {
    (async () => {
      const user = getAuth().currentUser;
      try {
        if (user) {
          const snap = await getDoc(doc(db, "users", user.uid));
          const saved = snap.data()?.jamGroove?.ceremonyMusic;
          if (saved) {
            setFormData({
              partyEntrance: saved.partyEntranceTitle || "",
              partyEntranceArtist: saved.partyEntranceArtist || "",
              partyEntranceVersion: saved.partyEntranceLink || "",

              brideEntrance: saved.brideEntranceTitle || "",
              brideEntranceArtist: saved.brideEntranceArtist || "",
              brideEntranceVersion: saved.brideEntranceLink || "",

              otherSongs: saved.otherSongs || "",
              otherSongsArtist: saved.otherSongsArtist || "",
              otherSongsVersion: saved.otherSongsVersion || "",

              recessionalSong: saved.recessionalSong || "",
              recessionalArtist: saved.recessionalArtist || "",
              recessionalVersion: saved.recessionalVersion || "",
            });
          }
        } else {
          const local = JSON.parse(localStorage.getItem("jamGrooveProgress") || "{}");
          const saved = local?.ceremonyMusic;
          if (saved) {
            setFormData({
              partyEntrance: saved.partyEntranceTitle || "",
              partyEntranceArtist: saved.partyEntranceArtist || "",
              partyEntranceVersion: saved.partyEntranceLink || "",

              brideEntrance: saved.brideEntranceTitle || "",
              brideEntranceArtist: saved.brideEntranceArtist || "",
              brideEntranceVersion: saved.brideEntranceLink || "",

              otherSongs: saved.otherSongs || "",
              otherSongsArtist: saved.otherSongsArtist || "",
              otherSongsVersion: saved.otherSongsVersion || "",

              recessionalSong: saved.recessionalSong || "",
              recessionalArtist: saved.recessionalArtist || "",
              recessionalVersion: saved.recessionalVersion || "",
            });
          }
        }
      } catch (e) {
        console.error("❌ CeremonyMusic load error:", e);
      }
    })();
  }, [currentStep]);

  // Keep overlay state in sync
  useEffect(() => {
    const ceremonyData = {
      partyEntranceTitle: formData.partyEntrance,
      partyEntranceArtist: formData.partyEntranceArtist,
      partyEntranceLink: formData.partyEntranceVersion,

      brideEntranceTitle: formData.brideEntrance,
      brideEntranceArtist: formData.brideEntranceArtist,
      brideEntranceLink: formData.brideEntranceVersion,

      otherSongs: formData.otherSongs,
      otherSongsArtist: formData.otherSongsArtist,
      otherSongsVersion: formData.otherSongsVersion,

      recessionalSong: formData.recessionalSong,
      recessionalArtist: formData.recessionalArtist,
      recessionalVersion: formData.recessionalVersion,
    };

    setJamSelections((prev: any) => ({
      ...prev,
      ceremonyMusic: ceremonyData,
    }));
  }, [formData, setJamSelections]);

  const handleChange = (field: string, value: string) =>
    setFormData((p) => ({ ...p, [field]: value }));

  const normalizeUrl = (v: string) => {
    const s = v.trim();
    if (!s) return "";
    return /^https?:\/\//i.test(s) ? s : `https://${s}`;
  };

  const handleSave = async () => {
    const user = getAuth().currentUser;

    const ceremonyData = {
      partyEntranceTitle: formData.partyEntrance,
      partyEntranceArtist: formData.partyEntranceArtist,
      partyEntranceLink: normalizeUrl(formData.partyEntranceVersion),

      brideEntranceTitle: formData.brideEntrance,
      brideEntranceArtist: formData.brideEntranceArtist,
      brideEntranceLink: normalizeUrl(formData.brideEntranceVersion),

      otherSongs: formData.otherSongs,
      otherSongsArtist: formData.otherSongsArtist,
      otherSongsVersion: formData.otherSongsVersion,

      recessionalSong: formData.recessionalSong,
      recessionalArtist: formData.recessionalArtist,
      recessionalVersion: normalizeUrl(formData.recessionalVersion),
    };

    try {
      if (user) {
        await updateDoc(doc(db, "users", user.uid), {
          "jamGroove.ceremonyMusic": ceremonyData,
        });
        console.log("✅ CeremonyMusic → Firestore:", ceremonyData);
      } else {
        const local = JSON.parse(localStorage.getItem("jamGrooveProgress") || "{}");
        local.ceremonyMusic = ceremonyData;
        localStorage.setItem("jamGrooveProgress", JSON.stringify(local));
        console.log("💾 CeremonyMusic → localStorage:", ceremonyData);
      }
      onContinue();
    } catch (e) {
      console.error("❌ CeremonyMusic save error:", e);
    }
  };

  const Section: React.FC<{
    sectionKey: string;
    imagePath: string;
    label: string;
    fields: { label: string; key: keyof typeof formData; placeholder?: string }[];
  }> = ({ sectionKey, imagePath, label, fields }) => (
    <div style={{ width: "100%", maxWidth: 560, margin: "0 auto" }}>
      <button
        type="button"
        onClick={() => toggleSection(sectionKey)}
        className="linklike"
        aria-expanded={expanded === sectionKey}
        aria-controls={`${sectionKey}-panel`}
        style={{ display: "block", margin: "0 auto 8px" }}
      >
        <img
          src={imagePath}
          alt={label}
          className="px-media"
          style={{ maxWidth: 320, display: "block", margin: "0 auto" }}
        />
      </button>

      {expanded === sectionKey && (
        <div id={`${sectionKey}-panel`} style={{ margin: "8px auto 16px", maxWidth: 460 }}>
          {fields.map((f) => (
            <div key={String(f.key)} style={{ marginBottom: 10 }}>
              <label style={{ fontWeight: 600, display: "block", marginBottom: 6 }}>
                {f.label}
              </label>
              <input
                className="px-input"
                placeholder={f.placeholder || f.label}
                value={formData[f.key]}
                onChange={(e) => handleChange(f.key as string, e.target.value)}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="pixie-card">
      {/* Pink X (optional; overlay already has a close icon) */}
      {onClose && (
        <button className="pixie-card__close" onClick={onClose} aria-label="Close">
          <img src="/assets/icons/pink_ex.png" alt="Close" />
        </button>
      )}

      <div className="pixie-card__body" style={{ textAlign: "center" }}>
        <h2 className="px-title" style={{ marginBottom: 6 }}>Ceremony Music</h2>
        <p className="px-prose-narrow" style={{ marginBottom: 16 }}>
          Tap a scroll to expand and set the song for each moment.
        </p>

        {/* Sections */}
        <div style={{ display: "grid", gap: 18, justifyItems: "center" }}>
          <Section
            sectionKey="party"
            imagePath="/assets/images/party_entrance.png"
            label="Party Entrance"
            fields={[
              { label: "Song Title", key: "partyEntrance" },
              { label: "Artist", key: "partyEntranceArtist" },
              { label: "Version URL", key: "partyEntranceVersion", placeholder: "youtube.com/…" },
            ]}
          />
          <Section
            sectionKey="bride"
            imagePath="/assets/images/bride_entrance.png"
            label="Bride Entrance"
            fields={[
              { label: "Song Title", key: "brideEntrance" },
              { label: "Artist", key: "brideEntranceArtist" },
              { label: "Version URL", key: "brideEntranceVersion", placeholder: "spotify/YouTube link" },
            ]}
          />
          <Section
            sectionKey="other"
            imagePath="/assets/images/other_songs.png"
            label="Other Ceremony Songs"
            fields={[
              { label: "Song Title(s)", key: "otherSongs" },
              { label: "Artist(s)", key: "otherSongsArtist" },
              { label: "Version URL(s)", key: "otherSongsVersion", placeholder: "optional links" },
            ]}
          />
          <Section
            sectionKey="recessional"
            imagePath="/assets/images/recessional.png"
            label="Recessional Song"
            fields={[
              { label: "Song Title", key: "recessionalSong" },
              { label: "Artist", key: "recessionalArtist" },
              { label: "Version URL", key: "recessionalVersion", placeholder: "apple/YouTube link" },
            ]}
          />
        </div>

        {/* CTAs */}
        <div className="px-cta-col" style={{ marginTop: 12 }}>
          <button className="boutique-primary-btn" onClick={handleSave}>
            Continue
          </button>
          <button className="boutique-back-btn" onClick={onBack}>
            ⬅ Back
          </button>
        </div>
      </div>
    </div>
  );
};

export default CeremonyMusic;