import React, { useState, useEffect } from "react";
import ScrollSongLayout from "../layouts/ScrollSongLayout";
import { getAuth } from "firebase/auth";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../../firebase/firebaseConfig";
import { JamSelectionsType } from "./JamOverlay";

interface RecessionalSongProps {
  onClose: () => void;
  jamSelections: JamSelectionsType;
  setJamSelections: React.Dispatch<React.SetStateAction<JamSelectionsType>>;
  isGuestUser: boolean;
}

const RecessionalSong: React.FC<RecessionalSongProps> = ({
  onClose,
  jamSelections,
  setJamSelections,
  isGuestUser,
}) => {
  const [formData, setFormData] = useState({
    songTitle: "",
    artist: "",
    versionUrl: "",
  });

  // Load from central state
  useEffect(() => {
    const saved = jamSelections.jamGrooveSelections?.recessionalSong;
    if (saved) {
      setFormData({
        songTitle: saved.songTitle || "",
        artist: saved.artist || "",
        versionUrl: saved.versionUrl || "",
      });
    }
  }, [jamSelections]);

  const handleChange = (field: keyof typeof formData, value: string) => {
    const updated = { ...formData, [field]: value };
    setFormData(updated);

    // Keep central state in sync while typing
    setJamSelections((prev) => ({
      ...prev,
      jamGrooveSelections: {
        ...prev.jamGrooveSelections,
        recessionalSong: updated,
      },
    }));
  };

  const handleSave = async () => {
    const user = getAuth().currentUser;

    if (user && !isGuestUser) {
      try {
        const userRef = doc(db, "users", user.uid);
        await updateDoc(userRef, {
          "jamGrooveSelections.recessionalSong": formData,
        });
        console.log("✅ Recessional song saved to Firestore:", formData);
      } catch (error) {
        console.error("❌ Firestore save error:", error);
      }
    } else {
      try {
        const localData = JSON.parse(localStorage.getItem("jamGrooveProgress") || "{}");
        localData.jamGrooveSelections = {
          ...(localData.jamGrooveSelections || {}),
          recessionalSong: formData,
        };
        localStorage.setItem("jamGrooveProgress", JSON.stringify(localData));
        console.log("💾 Recessional song saved to localStorage:", formData);
      } catch (error) {
        console.error("❌ localStorage save error:", error);
      }
    }

    onClose();
  };

  return (
    <ScrollSongLayout
      title="Recessional Song"
      sealImageSrc="/assets/images/recessional_seal.png"
      onClose={onClose}
      onSave={handleSave}
    >
      <p className="scroll-header">
        What song should be played as everyone walks back down the aisle? (recessional)
      </p>
      <input
        placeholder="Song Title"
        value={formData.songTitle}
        onChange={(e) => handleChange("songTitle", e.target.value)}
      />
      <input
        placeholder="Artist Name"
        value={formData.artist}
        onChange={(e) => handleChange("artist", e.target.value)}
      />
      <input
        placeholder="Version URL (www.example.com)"
        value={formData.versionUrl}
        onChange={(e) => handleChange("versionUrl", e.target.value)}
      />
    </ScrollSongLayout>
  );
};

export default RecessionalSong;