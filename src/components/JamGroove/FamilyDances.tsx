// src/components/jam/FamilyDances.tsx
import React, { useEffect, useState } from "react";
import { getAuth } from "firebase/auth";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "../../firebase/firebaseConfig";
import { JamSelectionsType } from "./JamOverlay";

interface FamilyDancesProps {
  onBack: () => void;
  onContinue: () => void;
  onClose: () => void; // ✅ added here
  jamSelections: JamSelectionsType;
  setJamSelections: React.Dispatch<React.SetStateAction<JamSelectionsType>>;
  isGuestUser: boolean;
}

const FamilyDances: React.FC<FamilyDancesProps> = ({
  onBack,
  onContinue,
  onClose, // ✅ destructured
  jamSelections,
  setJamSelections,
  isGuestUser,
}) => {
  const [expanded, setExpanded] = useState({
    first: false,
    mother: false,
    father: false,
  });

  const [formData, setFormData] = useState({
    firstDanceSong: "",
    firstDanceArtist: "",
    firstDanceUrl: "",
    skipFirstDance: false,
    motherSonSong: "",
    motherSonArtist: "",
    motherSonUrl: "",
    skipMotherSon: false,
    fatherDaughterSong: "",
    fatherDaughterArtist: "",
    fatherDaughterUrl: "",
    skipFatherDaughter: false,
  });

  useEffect(() => {
    const saved = jamSelections.familyDances;
    if (saved) {
      setFormData(saved);
      return;
    }

    const fetchData = async () => {
      const user = getAuth().currentUser;
      try {
        if (user && !isGuestUser) {
          const snap = await getDoc(doc(db, "users", user.uid));
          const data = snap.data();
          const savedFirestore = (data as any)?.jamGroove?.familyDances;
          if (savedFirestore) setFormData(savedFirestore);
        } else {
          const local = JSON.parse(localStorage.getItem("jamGrooveProgress") || "{}");
          if (local?.familyDances) setFormData(local.familyDances);
        }
      } catch (e) {
        console.error("❌ Error loading family dances:", e);
      }
    };

    fetchData();
  }, [jamSelections, isGuestUser]);

  const handleChange = (field: keyof typeof formData, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setJamSelections((prev) => ({ ...prev, familyDances: formData }));

    const user = getAuth().currentUser;
    try {
      if (user && !isGuestUser) {
        await updateDoc(doc(db, "users", user.uid), {
          "jamGroove.familyDances": formData,
        });
        console.log("✅ Family dances → Firestore:", formData);
      } else {
        const local = JSON.parse(localStorage.getItem("jamGrooveProgress") || "{}");
        local.familyDances = formData;
        localStorage.setItem("jamGrooveProgress", JSON.stringify(local));
        console.log("💾 Family dances → localStorage:", formData);
      }
    } catch (e) {
      console.error("❌ Save error:", e);
    }

    onContinue();
  };

  const avatarStyle = (active: boolean, color: string): React.CSSProperties => ({
    width: 150,
    height: 150,
    objectFit: "cover",
    borderRadius: "50%",
    cursor: "pointer",
    transition: "transform .2s ease-in-out, box-shadow .2s ease-in-out",
    boxShadow: active ? `0 0 15px 5px ${color}` : "none",
  });

  const Field = ({
    placeholder,
    value,
    onChange,
  }: {
    placeholder: string;
    value: string;
    onChange: (v: string) => void;
  }) => (
    <input
      className="px-input"
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{ width: "100%", maxWidth: 420, margin: "0 auto 10px", display: "block" }}
    />
  );

  return (
    <div className="pixie-card">
      {/* ✅ Pink X Close Button */}
      <button className="pixie-card__close" onClick={onClose} aria-label="Close">
        <img src={`${import.meta.env.BASE_URL}assets/icons/pink_ex.png`} alt="Close" />
      </button>

      <div className="pixie-card__body" style={{ textAlign: "center" }}>
        <h2 className="px-title" style={{ marginBottom: 8 }}>Family Dances</h2>
        <p className="px-prose-narrow" style={{ marginBottom: 18 }}>
          Let us know which special dances you'll include so your DJ can cue the perfect song.
        </p>

        <div style={{ display: "grid", gap: 24, justifyItems: "center" }}>
          {/* First Dance */}
          <section>
            <img
              src={`${import.meta.env.BASE_URL}assets/images/couple_dance.jpg`}
              alt="First Dance"
              onClick={() => setExpanded((p) => ({ ...p, first: !p.first }))}
              style={avatarStyle(expanded.first, "rgba(177,139,232,0.6)")}
            />
            {expanded.first && (
              <div style={{ marginTop: 12 }}>
                <h4 className="px-subtitle">Couple’s First Dance</h4>
                <Field
                  placeholder="Song Title"
                  value={formData.firstDanceSong}
                  onChange={(v) => handleChange("firstDanceSong", v)}
                />
                <Field
                  placeholder="Artist"
                  value={formData.firstDanceArtist}
                  onChange={(v) => handleChange("firstDanceArtist", v)}
                />
                <Field
                  placeholder="Version URL (optional)"
                  value={formData.firstDanceUrl}
                  onChange={(v) => handleChange("firstDanceUrl", v)}
                />
                <label className="px-helper">
                  <input
                    type="checkbox"
                    checked={formData.skipFirstDance}
                    onChange={() =>
                      handleChange("skipFirstDance", !formData.skipFirstDance)
                    }
                  />
                  Not doing this one
                </label>
              </div>
            )}
          </section>

          {/* Mother–Son */}
          <section>
            <img
              src={`${import.meta.env.BASE_URL}assets/images/mother_son_dance.png`}
              alt="Mother Son Dance"
              onClick={() => setExpanded((p) => ({ ...p, mother: !p.mother }))}
              style={avatarStyle(expanded.mother, "rgba(79,145,232,0.6)")}
            />
            {expanded.mother && (
              <div style={{ marginTop: 12 }}>
                <h4 className="px-subtitle">Mother & Son Dance</h4>
                <Field
                  placeholder="Song Title"
                  value={formData.motherSonSong}
                  onChange={(v) => handleChange("motherSonSong", v)}
                />
                <Field
                  placeholder="Artist"
                  value={formData.motherSonArtist}
                  onChange={(v) => handleChange("motherSonArtist", v)}
                />
                <Field
                  placeholder="Version URL (optional)"
                  value={formData.motherSonUrl}
                  onChange={(v) => handleChange("motherSonUrl", v)}
                />
                <label className="px-helper">
                  <input
                    type="checkbox"
                    checked={formData.skipMotherSon}
                    onChange={() =>
                      handleChange("skipMotherSon", !formData.skipMotherSon)
                    }
                  />
                  Not doing this one
                </label>
              </div>
            )}
          </section>

          {/* Father–Daughter */}
          <section>
            <img
              src={`${import.meta.env.BASE_URL}assets/images/daughter_father_dance.jpg`}
              alt="Father Daughter Dance"
              onClick={() => setExpanded((p) => ({ ...p, father: !p.father }))}
              style={avatarStyle(expanded.father, "rgba(247,140,180,0.6)")}
            />
            {expanded.father && (
              <div style={{ marginTop: 12 }}>
                <h4 className="px-subtitle">Father & Daughter Dance</h4>
                <Field
                  placeholder="Song Title"
                  value={formData.fatherDaughterSong}
                  onChange={(v) => handleChange("fatherDaughterSong", v)}
                />
                <Field
                  placeholder="Artist"
                  value={formData.fatherDaughterArtist}
                  onChange={(v) => handleChange("fatherDaughterArtist", v)}
                />
                <Field
                  placeholder="Version URL (optional)"
                  value={formData.fatherDaughterUrl}
                  onChange={(v) => handleChange("fatherDaughterUrl", v)}
                />
                <label className="px-helper">
                  <input
                    type="checkbox"
                    checked={formData.skipFatherDaughter}
                    onChange={() =>
                      handleChange(
                        "skipFatherDaughter",
                        !formData.skipFatherDaughter
                      )
                    }
                  />
                  Not doing this one
                </label>
              </div>
            )}
          </section>
        </div>

        <div className="px-cta-col" style={{ marginTop: 20 }}>
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

export default FamilyDances;