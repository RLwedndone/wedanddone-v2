// src/components/jam/CeremonyOrder.tsx
import React, { useState, useEffect } from "react";
import { getAuth } from "firebase/auth";
import { db } from "../../firebase/firebaseConfig";
import { doc, updateDoc, getDoc } from "firebase/firestore";
import { JamSelectionsType } from "./JamOverlay";

interface CeremonyOrderProps {
  onBack: () => void;
  onContinue: () => void;
  onClose: () => void; // ✅ add for the pink X
  jamSelections: JamSelectionsType;
  setJamSelections: React.Dispatch<React.SetStateAction<JamSelectionsType>>;
  isGuestUser: boolean;
}

const CeremonyOrder: React.FC<CeremonyOrderProps> = ({
  onBack,
  onContinue,
  onClose,
  jamSelections,
  setJamSelections,
  isGuestUser,
}) => {
  const [fields, setFields] = useState({
    first: "",
    second: "",
    third: "",
    fourth: "",
    fifth: "",
    sixth: "",
    additional: "",
  });

  // Load existing (guest -> localStorage, user -> Firestore)
  useEffect(() => {
    if (isGuestUser) {
      const savedData = localStorage.getItem("jamGrooveProgress");
      if (savedData) {
        try {
          const parsed = JSON.parse(savedData);
          if (parsed.customProcessional) setFields(parsed.customProcessional);
        } catch (err) {
          console.error("❌ Failed to parse jamGrooveProgress:", err);
        }
      }
    }
  }, [isGuestUser]);

  useEffect(() => {
    const fetchData = async () => {
      const user = getAuth().currentUser;
      if (user && !isGuestUser) {
        try {
          const snap = await getDoc(doc(db, "users", user.uid));
          const data = snap.data();
          if (data?.jamSelections?.customProcessional) {
            setFields(data.jamSelections.customProcessional);
          }
        } catch (err) {
          console.error("❌ Error loading processional from Firestore:", err);
        }
      }
    };
    fetchData();
  }, [isGuestUser]);

  // Guest auto-save
  useEffect(() => {
    if (!isGuestUser) return;
    try {
      const existing = JSON.parse(localStorage.getItem("jamGrooveProgress") || "{}");
      existing.customProcessional = fields;
      localStorage.setItem("jamGrooveProgress", JSON.stringify(existing));
    } catch (err) {
      console.error("❌ Error auto-saving processional:", err);
    }
  }, [fields, isGuestUser]);

  const handleChange = (key: string, value: string) =>
    setFields((p) => ({ ...p, [key]: value }));

  const saveAndContinue = async () => {
    const user = getAuth().currentUser;

    if (user) {
      try {
        await updateDoc(doc(db, "users", user.uid), {
          "jamSelections.customProcessional": fields,
        });
      } catch (error) {
        console.error("❌ Error saving to Firestore:", error);
      }
    } else {
      try {
        const localData = JSON.parse(localStorage.getItem("jamGrooveProgress") || "{}");
        localData.customProcessional = fields;
        localStorage.setItem("jamGrooveProgress", JSON.stringify(localData));
      } catch (error) {
        console.error("❌ Error saving to localStorage:", error);
      }
    }

    // ✅ keep local React state in sync (bug fix: use fields, not FormData)
    setJamSelections((prev) => ({ ...prev, customProcessional: fields }));

    onContinue();
  };

  const rows = [
    { label: "First to enter:", key: "first", helper: "Typically: Officiant or Groom + Officiant" },
    { label: "2nd:", key: "second", helper: "Typically: Grandparents or Groom’s Parents" },
    { label: "3rd:", key: "third", helper: "Typically: Bridesmaids + Groomsmen" },
    { label: "4th:", key: "fourth", helper: "Typically: Flower Girl and/or Ring Bearer" },
    { label: "5th:", key: "fifth", helper: "Typically: Bride + Escort" },
    { label: "6th:", key: "sixth", helper: "Optional: Additional family/friends" },
    { label: "Additional:", key: "additional", helper: "List anyone else who will be part of the ceremony" },
  ] as const;

  return (
    <div className="pixie-card wd-page-turn">
      {/* Pink X */}
      <button className="pixie-card__close" onClick={onClose} aria-label="Close">
        <img src={`${import.meta.env.BASE_URL}assets/icons/pink_ex.png`} alt="Close" />
      </button>

      <div className="pixie-card__body" style={{ textAlign: "center" }}>
        {/* Header image */}
        <img
          src={`${import.meta.env.BASE_URL}assets/images/jam_procession_image.png`}
          alt="Custom Processional"
          className="px-media"
          style={{ maxWidth: 260, marginBottom: 12 }}
        />

        <h2 className="px-title" style={{ marginBottom: 8 }}>
          Who’s walking in when?
        </h2>

        <p className="px-prose-narrow" style={{ marginBottom: 16 }}>
          Tell us your processional order below. List their role and their full names.
        </p>

        {/* Inputs */}
        <div style={{ width: "100%", maxWidth: 480, margin: "0 auto 16px" }}>
          <div style={{ display: "grid", gap: 12 }}>
            {rows.map(({ label, key, helper }) => (
              <div key={key} style={{ textAlign: "left" }}>
                <label style={{ display: "block", marginBottom: 6, fontWeight: 600 }}>{label}</label>
                <input
                  className="px-input"
                  type="text"
                  value={(fields as any)[key]}
                  onChange={(e) => handleChange(key, e.target.value)}
                  placeholder="Type here…"
                />
                <small style={{ color: "#666", display: "block", marginTop: 4 }}>{helper}</small>
              </div>
            ))}
          </div>
        </div>

        {/* CTAs */}
        <div className="px-cta-col" style={{ marginTop: 8 }}>
          <button className="boutique-primary-btn" onClick={saveAndContinue}>
            Lock it in
          </button>
          <button className="boutique-back-btn" onClick={onBack}>
            ⬅ Back
          </button>
        </div>
      </div>
    </div>
  );
};

export default CeremonyOrder;