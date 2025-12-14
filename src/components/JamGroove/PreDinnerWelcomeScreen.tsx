import React, { useState, useEffect } from "react";
import { getAuth } from "firebase/auth";
import { doc, updateDoc, getDoc } from "firebase/firestore";
import { db } from "../../firebase/firebaseConfig";
import { JamSelectionsType } from "./JamOverlay";

interface PreDinnerWelcomeScreenProps {
  onBack: () => void;
  onContinue: () => void;
  onClose: () => void; // 👈 added for pink X
  jamSelections: JamSelectionsType;
  setJamSelections: React.Dispatch<React.SetStateAction<JamSelectionsType>>;
  isGuestUser: boolean;
}

const PreDinnerWelcomeScreen: React.FC<PreDinnerWelcomeScreenProps> = ({
  onBack,
  onContinue,
  onClose,
  jamSelections,
  setJamSelections,
  isGuestUser,
}) => {
  const [hasWelcome, setHasWelcome] = useState<null | boolean>(null);
  const [speaker, setSpeaker] = useState("");

  useEffect(() => {
    const saved = jamSelections.preDinnerWelcome;
    if (saved) {
      setHasWelcome(saved.hasWelcome);
      setSpeaker(saved.speaker || "");
      return;
    }

    const fetchData = async () => {
      const user = getAuth().currentUser;

      if (user && !isGuestUser) {
        const userRef = doc(db, "users", user.uid);
        const docSnap = await getDoc(userRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          const savedFirestore = (data as any)?.jamGroove?.preDinnerWelcome;
          if (savedFirestore) {
            setHasWelcome(savedFirestore.hasWelcome);
            setSpeaker(savedFirestore.speaker || "");
            setJamSelections((prev) => ({ ...prev, preDinnerWelcome: savedFirestore }));
          }
        }
      } else {
        const localData = JSON.parse(localStorage.getItem("jamGrooveProgress") || "{}");
        const savedLocal = localData.preDinnerWelcome;
        if (savedLocal) {
          setHasWelcome(savedLocal.hasWelcome);
          setSpeaker(savedLocal.speaker || "");
          setJamSelections((prev) => ({ ...prev, preDinnerWelcome: savedLocal }));
        }
      }
    };
    fetchData();
  }, [jamSelections.preDinnerWelcome, isGuestUser, setJamSelections]);

  const handleSave = async () => {
    const saveData = {
      hasWelcome,
      speaker: hasWelcome ? speaker : "",
    };

    setJamSelections((prev) => ({ ...prev, preDinnerWelcome: saveData }));

    const user = getAuth().currentUser;

    if (user && !isGuestUser) {
      try {
        const userRef = doc(db, "users", user.uid);
        await updateDoc(userRef, { "jamGroove.preDinnerWelcome": saveData });
        console.log("🙏 Pre-dinner welcome saved to Firestore:", saveData);
      } catch (error) {
        console.error("❌ Firestore error:", error);
      }
    } else {
      try {
        const localData = JSON.parse(localStorage.getItem("jamGrooveProgress") || "{}");
        localData.preDinnerWelcome = saveData;
        localStorage.setItem("jamGrooveProgress", JSON.stringify(localData));
        console.log("💾 Pre-dinner welcome saved to localStorage:", saveData);
      } catch (error) {
        console.error("❌ localStorage error:", error);
      }
    }

    onContinue();
  };

  return (
    <div className="pixie-card wd-page-turn">
      {/* 🩷 Pink X */}
      <button className="pixie-card__close" onClick={onClose} aria-label="Close">
        <img src={`${import.meta.env.BASE_URL}assets/icons/pink_ex.png`} alt="Close" />
      </button>

      <div className="pixie-card__body" style={{ textAlign: "center" }}>
        {/* Title image / media */}
        <img
          src={`${import.meta.env.BASE_URL}assets/images/pre_dinner.jpg`}
          alt="Pre-Dinner Welcome"
          className="px-media px-media--lg"
          style={{ borderRadius: 12 }}
        />

        {/* Title */}
        <h2 className="px-title" style={{ marginTop: 8, marginBottom: 8 }}>
          Pre-Dinner Welcome
        </h2>

        {/* Explainer */}
        <p className="px-prose-narrow" style={{ marginBottom: 18 }}>
          Will you have a pre-dinner welcome speech or prayer?
        </p>

        {/* Radios */}
        <div style={{ display: "flex", justifyContent: "center", gap: "1.5rem", marginBottom: 18 }}>
          <label>
            <input
              type="radio"
              value="yes"
              checked={hasWelcome === true}
              onChange={() => setHasWelcome(true)}
              style={{ marginRight: "0.5rem" }}
            />
            Yes
          </label>
          <label>
            <input
              type="radio"
              value="no"
              checked={hasWelcome === false}
              onChange={() => setHasWelcome(false)}
              style={{ marginRight: "0.5rem" }}
            />
            No
          </label>
        </div>

        {/* Speaker input */}
        {hasWelcome && (
          <input
            type="text"
            value={speaker}
            onChange={(e) => setSpeaker(e.target.value)}
            placeholder="Who will be giving the welcome/prayer?"
            className="px-input"
            style={{
              width: "100%",
              maxWidth: 420,
              padding: "0.75rem",
              borderRadius: 12,
              border: "1px solid #ccc",
              fontSize: "1rem",
              margin: "0 auto 1.25rem",
              display: "block",
            }}
          />
        )}

        {/* CTAs */}
        <div className="px-cta-col">
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

export default PreDinnerWelcomeScreen;