// src/components/jam/GrandEntrances.tsx
import React, { useEffect, useState } from "react";
import { getAuth } from "firebase/auth";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "../../firebase/firebaseConfig";
import { JamSelectionsType } from "./JamOverlay";

interface GrandEntrancesProps {
  onBack: () => void;
  onContinue: () => void;
  onClose: () => void; // ✅ added
  jamSelections: JamSelectionsType;
  setJamSelections: React.Dispatch<React.SetStateAction<JamSelectionsType>>;
  isGuestUser: boolean;
}

const GrandEntrances: React.FC<GrandEntrancesProps> = ({
  onBack,
  onContinue,
  onClose,
  jamSelections,
  setJamSelections,
  isGuestUser,
}) => {
  const [selection, setSelection] = useState<string>("");
  const [formData, setFormData] = useState({
    bridesmaidsSong: "",
    groomsmenSong: "",
    coupleSong: "",
    bridesmaidsArtist: "",
    groomsmenArtist: "",
    coupleArtist: "",
    bridesmaidsUrl: "",
    groomsmenUrl: "",
    coupleUrl: "",
  });

  // Load saved data
  useEffect(() => {
    const fetchData = async () => {
      const user = getAuth().currentUser;

      if (user && !isGuestUser) {
        const snap = await getDoc(doc(db, "users", user.uid));
        if (snap.exists()) {
          const saved = (snap.data() as any)?.jamGroove?.grandEntrances;
          if (saved) {
            setSelection(saved.selection || "");
            setFormData((prev) => ({ ...prev, ...saved }));
          }
        }
      } else {
        const local = JSON.parse(localStorage.getItem("jamGrooveProgress") || "{}");
        const saved = local.grandEntrances;
        if (saved) {
          setSelection(saved.selection || "");
          setFormData((prev) => ({ ...prev, ...saved }));
        }
      }
    };
    fetchData();
  }, [isGuestUser]);

  const handleChange = (field: string, value: string) =>
    setFormData((prev) => ({ ...prev, [field]: value }));

  const handleSave = async () => {
    const saveData = { selection, ...formData };

    // keep central state in sync (nice-to-have)
    setJamSelections((prev) => ({ ...prev, grandEntrances: saveData }));

    const user = getAuth().currentUser;
    try {
      if (user && !isGuestUser) {
        await updateDoc(doc(db, "users", user.uid), {
          "jamGroove.grandEntrances": saveData,
        });
        console.log("🎉 Grand Entrances → Firestore:", saveData);
      } else {
        const local = JSON.parse(localStorage.getItem("jamGrooveProgress") || "{}");
        local.grandEntrances = saveData;
        localStorage.setItem("jamGrooveProgress", JSON.stringify(local));
        console.log("💾 Grand Entrances → localStorage:", saveData);
      }
      onContinue();
    } catch (e) {
      console.error("❌ Save error:", e);
    }
  };

  return (
    <div className="pixie-card">
      {/* Pink X */}
      <button className="pixie-card__close" onClick={onClose} aria-label="Close">
        <img src="/assets/icons/pink_ex.png" alt="Close" />
      </button>

      <div className="pixie-card__body" style={{ textAlign: "center" }}>
        <h2 className="px-title" style={{ marginBottom: 8 }}>Grand Entrances</h2>
        <p className="px-prose-narrow" style={{ marginBottom: 16 }}>
          Will your wedding party be introduced with a musical grand entrance?
        </p>

        <img
          src="/assets/images/grand_entrance.jpg"
          alt="Grand Entrances"
          className="px-media"
          style={{ maxWidth: 300, marginBottom: 12 }}
        />

        {/* Choice group */}
<div
  className="px-radio-group"
  style={{
    display: "flex",
    flexDirection: "column",   // 👈 stack vertically
    alignItems: "center",
    gap: "0.75rem",
    marginBottom: 18,
  }}
>
  <label className="px-radio" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
    <input
      type="radio"
      name="entrance"
      value="full"
      checked={selection === "full"}
      onChange={() => setSelection("full")}
    />
    <span>Full Party Grand Entrance</span>
  </label>

  <label className="px-radio" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
    <input
      type="radio"
      name="entrance"
      value="couple"
      checked={selection === "couple"}
      onChange={() => setSelection("couple")}
    />
    <span>Just the Couple</span>
  </label>

  <label className="px-radio" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
    <input
      type="radio"
      name="entrance"
      value="none"
      checked={selection === "none"}
      onChange={() => setSelection("none")}
    />
    <span>No Grand Entrance</span>
  </label>
</div>

        {selection === "full" && (
          <EntranceInputs
            formData={formData}
            handleChange={handleChange}
            sections={["bridesmaids", "groomsmen", "couple"]}
          />
        )}

        {selection === "couple" && (
          <EntranceInputs
            formData={formData}
            handleChange={handleChange}
            sections={["couple"]}
          />
        )}

        {selection === "none" && (
          <p className="px-prose-narrow" style={{ marginTop: 12, fontStyle: "italic" }}>
            You’re skipping the dramatic entrance? Bold move. We respect it. 🖖
          </p>
        )}

        <div className="px-cta-col" style={{ marginTop: 18 }}>
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

const EntranceInputs = ({
  formData,
  handleChange,
  sections,
}: {
  formData: any;
  handleChange: (field: string, value: string) => void;
  sections: string[];
}) => {
  const SectionBlock = ({ name }: { name: string }) => (
    <div style={{ marginBottom: 16 }}>
      <h4 className="px-subtitle" style={{ marginBottom: 8 }}>
        {name.charAt(0).toUpperCase() + name.slice(1)} Entrance
      </h4>
      <input
        className="px-input"
        placeholder="Song Title"
        value={formData[`${name}Song`] || ""}
        onChange={(e) => handleChange(`${name}Song`, e.target.value)}
        style={{ maxWidth: 420 }}
      />
      <input
        className="px-input"
        placeholder="Artist"
        value={formData[`${name}Artist`] || ""}
        onChange={(e) => handleChange(`${name}Artist`, e.target.value)}
        style={{ maxWidth: 420 }}
      />
      <input
        className="px-input"
        placeholder="Version URL (optional)"
        value={formData[`${name}Url`] || ""}
        onChange={(e) => handleChange(`${name}Url`, e.target.value)}
        style={{ maxWidth: 420 }}
      />
    </div>
  );

  return (
    <div style={{ display: "grid", gap: 12, justifyItems: "center", marginBottom: 8 }}>
      {sections.map((s) => (
        <SectionBlock key={s} name={s} />
      ))}
    </div>
  );
};

export default GrandEntrances;