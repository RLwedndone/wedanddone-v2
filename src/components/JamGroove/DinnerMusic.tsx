// src/components/jam/DinnerMusic.tsx
import React, { useState, useEffect } from "react";
import { getAuth } from "firebase/auth";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "../../firebase/firebaseConfig";
import { JamSelectionsType } from "./JamOverlay";

interface DinnerMusicProps {
  onBack: () => void;
  onContinue: () => void;
  onClose?: () => void;
  jamSelections: JamSelectionsType;
  setJamSelections: React.Dispatch<React.SetStateAction<JamSelectionsType>>;
  isGuestUser: boolean;
}

const DinnerMusic: React.FC<DinnerMusicProps> = ({
  onBack,
  onContinue,
  onClose,
  jamSelections,
  setJamSelections,
  isGuestUser,
}) => {
  const [notes, setNotes] = useState("");

  useEffect(() => {
    // Prefer in-memory state
    if (jamSelections?.dinnerMusic) {
      setNotes(jamSelections.dinnerMusic as unknown as string);
      return;
    }

    const load = async () => {
      const user = getAuth().currentUser;
      try {
        if (user && !isGuestUser) {
          const snap = await getDoc(doc(db, "users", user.uid));
          const saved = snap.data()?.jamGroove?.dinnerMusic;
          if (saved) setNotes(saved);
        } else {
          const local = JSON.parse(localStorage.getItem("jamGrooveProgress") || "{}");
          if (local?.dinnerMusic) setNotes(local.dinnerMusic);
        }
      } catch (e) {
        console.error("❌ Error loading dinner music:", e);
      }
    };
    load();
  }, [jamSelections, isGuestUser]);

  const handleSave = async () => {
    // Sync to central state
    setJamSelections((prev) => ({ ...prev, dinnerMusic: notes }));

    const user = getAuth().currentUser;
    try {
      if (user && !isGuestUser) {
        await updateDoc(doc(db, "users", user.uid), {
          "jamGroove.dinnerMusic": notes,
        });
        console.log("🍽️ Dinner music → Firestore");
      } else {
        const local = JSON.parse(localStorage.getItem("jamGrooveProgress") || "{}");
        local.dinnerMusic = notes;
        localStorage.setItem("jamGrooveProgress", JSON.stringify(local));
        console.log("🍽️ Dinner music → localStorage");
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
          <img src="/assets/icons/pink_ex.png" alt="Close" />
        </button>
      )}

      <div className="pixie-card__body" style={{ textAlign: "center" }}>
        <h2 className="px-title" style={{ marginBottom: 8 }}>Dinner Music</h2>

        <img
          src="/assets/images/dinner_music.png"
          alt="Dinner Music"
          className="px-media"
          style={{ maxWidth: 300, marginBottom: 12 }}
        />

        <p className="px-prose-narrow" style={{ marginBottom: 16 }}>
          List any music you’d like during dinner—song titles, artists, genres, albums, or just a general vibe.
        </p>

        <textarea
          className="px-textarea"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Example: Jazz standards, string quartet covers, Frank Sinatra…"
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

export default DinnerMusic;