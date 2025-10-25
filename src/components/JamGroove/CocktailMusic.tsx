// src/components/jam/CocktailMusic.tsx
import React, { useEffect, useState } from "react";
import { getAuth } from "firebase/auth";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "../../firebase/firebaseConfig";
import { JamSelectionsType } from "./JamOverlay";

interface CocktailMusicProps {
  onBack: () => void;
  onContinue: () => void;
  onClose?: () => void;
  jamSelections: JamSelectionsType;
  setJamSelections: React.Dispatch<React.SetStateAction<JamSelectionsType>>;
  isGuestUser: boolean;
}

const CocktailMusic: React.FC<CocktailMusicProps> = ({
  onBack,
  onContinue,
  onClose,
  jamSelections,
  setJamSelections,
  isGuestUser,
}) => {
  const [notes, setNotes] = useState("");

  // Load from state → Firestore → localStorage (same pattern as other screens)
  useEffect(() => {
    if (jamSelections?.cocktailMusic) {
      setNotes(jamSelections.cocktailMusic);
      return;
    }

    const loadSaved = async () => {
      const user = getAuth().currentUser;

      try {
        if (user && !isGuestUser) {
          const snap = await getDoc(doc(db, "users", user.uid));
          const data = snap.data();
          const saved = data?.jamGrooveSelections?.cocktailMusic;
          if (saved) setNotes(saved);
        } else {
          const local = JSON.parse(localStorage.getItem("jamGrooveProgress") || "{}");
          const saved = local?.jamGrooveSelections?.cocktailMusic;
          if (saved) setNotes(saved);
        }
      } catch (e) {
        console.error("❌ Error loading cocktail music:", e);
      }
    };

    loadSaved();
  }, [jamSelections, isGuestUser]);

  const handleSave = async () => {
    setJamSelections((prev) => ({
      ...prev,
      cocktailMusic: notes,
    }));

    const user = getAuth().currentUser;

    try {
      if (user && !isGuestUser) {
        await updateDoc(doc(db, "users", user.uid), {
          "jamGrooveSelections.cocktailMusic": notes,
        });
        console.log("✅ Cocktail music → Firestore:", notes);
      } else {
        const local = JSON.parse(localStorage.getItem("jamGrooveProgress") || "{}");
        local.jamGrooveSelections = local.jamGrooveSelections || {};
        local.jamGrooveSelections.cocktailMusic = notes;
        localStorage.setItem("jamGrooveProgress", JSON.stringify(local));
        console.log("💾 Cocktail music → localStorage:", notes);
      }
    } catch (e) {
      console.error("❌ Save error:", e);
    }

    onContinue();
  };

  return (
    <div className="pixie-card">
      {/* Pink X Close */}
      {onClose && (
        <button className="pixie-card__close" onClick={onClose} aria-label="Close">
          <img src={`${import.meta.env.BASE_URL}assets/icons/pink_ex.png`} alt="Close" />
        </button>
      )}

      <div className="pixie-card__body" style={{ textAlign: "center" }}>
        <h2 className="px-title" style={{ marginBottom: "0.5rem" }}>
          Cocktail Hour Music
        </h2>

        <img
          src={`${import.meta.env.BASE_URL}assets/images/cocktail_hour.png`}
          alt="Cocktail Hour"
          className="px-media"
          style={{ maxWidth: 300, marginBottom: 12 }}
        />

        <p className="px-prose-narrow" style={{ marginBottom: 16 }}>
          List any music you'd like played during cocktail hour — song titles,
          genres, albums, or even a general vibe!
        </p>

        <textarea
  className="px-textarea"
  value={notes}
  onChange={(e) => setNotes(e.target.value)}
  placeholder="Example: Instrumental jazz, Taylor Swift 'Lover' album, classic Sinatra..."
  rows={6}
/>

        <div className="px-cta-col" style={{ marginTop: 8 }}>
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

export default CocktailMusic;