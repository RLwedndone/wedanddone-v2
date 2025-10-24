import React, { useState, useEffect } from "react";
import { getAuth } from "firebase/auth";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "../../firebase/firebaseConfig";
import { JamSelectionsType } from "./JamOverlay";

interface MusicalGenresProps {
  onBack: () => void;
  onContinue: () => void;
  onClose: () => void;
  jamSelections: JamSelectionsType;
  setJamSelections: React.Dispatch<React.SetStateAction<JamSelectionsType>>;
  isGuestUser: boolean;
}

const genreList = [
  { key: "1950s", label: "1950's & 60's", img: "elvis.png", explainer: "Elvis, Chuck Berry, Beatles, etc." },
  { key: "1970s", label: "1970's", img: "1970s_music.png", explainer: "Bee Gees, Earth Wind & Fire, ABBA..." },
  { key: "1990s", label: "1990's", img: "1990s_music.png", explainer: "MC Hammer, Spice Girls, Snoop Dogg..." },
  { key: "top40", label: "Top 40 / Hip-Hop", img: "top40music.png", explainer: "Popular current artists." },
  { key: "line", label: "Line Dances", img: "line_dancing.png", explainer: "Electric Slide, Wobble, Macarena..." },
  { key: "rnb", label: "R&B", img: "alicia.png", explainer: "Ne-Yo, Alicia Keys, H.E.R., Ashanti..." },
  { key: "religious", label: "Religious", img: "religious_music.png", explainer: "Hillsong, Elevation Worship, etc." },
  { key: "cultural", label: "Cultural", img: "cultural_music.png", explainer: "Latin, Lebanese, Bollywood, etc." },
  { key: "missing", label: "Missing Genres?", img: "missing_music.png", explainer: "Anything else we missed?" },
];

const MusicalGenres: React.FC<MusicalGenresProps> = ({
  onBack,
  onContinue,
  onClose,
  jamSelections,
  setJamSelections,
  isGuestUser,
}) => {
  const [activeGenre, setActiveGenre] = useState<string | null>(null);

  // hydrate from saved data
  useEffect(() => {
    const user = getAuth().currentUser;
    const hydrate = async () => {
      if (!user || isGuestUser) {
        const localData = JSON.parse(localStorage.getItem("jamGrooveProgress") || "{}");
        if (localData.musicalGenres) {
          setJamSelections((prev) => ({ ...prev, musicalGenres: localData.musicalGenres }));
          console.log("📥 Loaded genres from localStorage:", localData.musicalGenres);
        }
      } else {
        try {
          const snap = await getDoc(doc(db, "users", user.uid));
          const data = snap.data();
          if (data?.jamGrooveSelections?.musicalGenres) {
            setJamSelections((prev) => ({
              ...prev,
              musicalGenres: data.jamGrooveSelections.musicalGenres,
            }));
            console.log("📥 Loaded genres from Firestore:", data.jamGrooveSelections.musicalGenres);
          }
        } catch (e) {
          console.error("❌ Firestore load error:", e);
        }
      }
    };
    hydrate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSaveAll = async () => {
    const user = getAuth().currentUser;
    const selections = jamSelections.musicalGenres || {};

    if (!user || isGuestUser) {
      const localData = JSON.parse(localStorage.getItem("jamGrooveProgress") || "{}");
      localData.musicalGenres = selections;
      localStorage.setItem("jamGrooveProgress", JSON.stringify(localData));
      console.log("💾 Genres saved locally:", selections);
      onContinue();
      return;
    }

    try {
      await updateDoc(doc(db, "users", user.uid), {
        "jamGrooveSelections.musicalGenres": selections,
      });
      console.log("✅ Genres saved to Firestore:", selections);
      onContinue();
    } catch (e) {
      console.error("❌ Firestore save error:", e);
    }
  };

  const setChoice = (key: string, value: string) => {
    setJamSelections((prev) => ({
      ...prev,
      musicalGenres: {
        ...(prev.musicalGenres || {}),
        [key]: value,
      },
    }));
  };

  const closeGenreModal = () => setActiveGenre(null);

  const activeMeta = genreList.find((g) => g.key === activeGenre);

  return (
    <div className="pixie-card">
      {/* 🩷 Pink X close */}
      <button className="pixie-card__close" onClick={onClose} aria-label="Close">
        <img src="/assets/icons/pink_ex.png" alt="Close" />
      </button>

      <div className="pixie-card__body">
        {/* Title */}
        <h2 className="px-title" style={{ marginBottom: 8 }}>
          Musical Genres
        </h2>

        {/* Explainer */}
        <p className="px-prose-narrow" style={{ marginBottom: 18 }}>
          Tell us what kinds of music you'd love to hear during your reception (and what you want your DJ to skip).
        </p>

        {/* Genre list (stacked, mobile-friendly) */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr",
            gap: 16,
            justifyItems: "center",
            marginBottom: 16,
          }}
        >
          {genreList.map((g) => (
            <button
              key={g.key}
              onClick={() => setActiveGenre(g.key)}
              style={{
                background: "transparent",
                border: "none",
                padding: 0,
                cursor: "pointer",
                width: "100%",
                maxWidth: 320,
              }}
            >
              <img
                src={`/assets/images/${g.img}`}
                alt={g.label}
                className="px-media"
                style={{
                  width: "100%",
                  borderRadius: 16,
                  display: "block",
                }}
              />
            </button>
          ))}
        </div>

        {/* Footer buttons */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "center" }}>
          <button className="boutique-primary-btn" onClick={handleSaveAll}>
            {getAuth().currentUser ? "Save & Continue" : "Continue"}
          </button>
          <button className="boutique-back-btn" onClick={onBack}>
            ⬅ Back
          </button>
        </div>
      </div>

      {/* Per-genre modal editor */}
      {activeGenre && activeMeta && (
        <div className="pixie-overlay">
          <div className="pixie-card pixie-card--modal" style={{ maxWidth: 520 }}>
            <button className="pixie-card__close" onClick={closeGenreModal} aria-label="Close">
              <img src="/assets/icons/pink_ex.png" alt="Close" />
            </button>

            <div className="pixie-card__body">
              <h3 className="px-title" style={{ marginBottom: 6 }}>
                {activeMeta.label}
              </h3>
              <p className="px-prose-narrow" style={{ marginBottom: 12 }}>
                {activeMeta.explainer}
              </p>

              {["missing", "cultural"].includes(activeGenre) ? (
                <textarea
                  placeholder={
                    activeGenre === "cultural"
                      ? "List culture, artist, and specific songs"
                      : "Type your ideas here…"
                  }
                  value={jamSelections.musicalGenres?.[activeGenre] || ""}
                  onChange={(e) => setChoice(activeGenre, e.target.value)}
                  style={{
                    width: "100%",
                    minHeight: 96,
                    padding: "0.75rem",
                    borderRadius: 12,
                    border: "1px solid #ccc",
                    fontSize: "1rem",
                    marginBottom: 12,
                    fontFamily: "Nunito, sans-serif",
                  }}
                />
              ) : (
                <div style={{ display: "grid", gap: 8, marginBottom: 10 }}>
                  {["None", "A Little", "A Lot!"].map((opt) => (
                    <label key={opt} className="px-prose-narrow" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <input
                        type="radio"
                        name={`genre-${activeGenre}`}
                        value={opt}
                        checked={jamSelections.musicalGenres?.[activeGenre] === opt}
                        onChange={() => setChoice(activeGenre, opt)}
                      />
                      {opt}
                    </label>
                  ))}
                </div>
              )}

              <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
                <button
                  className="boutique-primary-btn"
                  onClick={() => {
                    // persist immediately for guests
                    const user = getAuth().currentUser;
                    if (!user || isGuestUser) {
                      const localData = JSON.parse(localStorage.getItem("jamGrooveProgress") || "{}");
                      localData.musicalGenres = jamSelections.musicalGenres || {};
                      localStorage.setItem("jamGrooveProgress", JSON.stringify(localData));
                      console.log("💾 Genre saved (modal):", localData.musicalGenres);
                    }
                    closeGenreModal();
                  }}
                >
                  Save
                </button>
                <button className="boutique-back-btn" onClick={closeGenreModal}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MusicalGenres;