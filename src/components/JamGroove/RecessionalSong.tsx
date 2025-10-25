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

  // Load from central state (first choice), no guest/local fallback needed here unless you want it
  useEffect(() => {
    const saved = jamSelections?.jamGrooveSelections?.recessionalSong;
    if (saved) {
      setFormData({
        songTitle: saved.songTitle || "",
        artist: saved.artist || "",
        versionUrl: saved.versionUrl || "",
      });
    } else if (isGuestUser) {
      // fallback to localStorage for guests
      try {
        const local = JSON.parse(
          localStorage.getItem("jamGrooveProgress") || "{}"
        );
        const ls = local?.jamGrooveSelections?.recessionalSong;
        if (ls) {
          setFormData({
            songTitle: ls.songTitle || "",
            artist: ls.artist || "",
            versionUrl: ls.versionUrl || "",
          });
        }
      } catch {
        /* ignore */
      }
    }
  }, [jamSelections, isGuestUser]);

  const handleChange = (field: keyof typeof formData, value: string) => {
    const updated = { ...formData, [field]: value };
    setFormData(updated);

    // keep central state in sync live
    setJamSelections((prev) => ({
      ...prev,
      jamGrooveSelections: {
        ...(prev.jamGrooveSelections || {}),
        recessionalSong: updated,
      },
    }));
  };

  const handleSave = async () => {
    const cleaned = {
      songTitle: formData.songTitle.trim(),
      artist: formData.artist.trim(),
      versionUrl: formData.versionUrl.trim(),
    };

    // sync in-memory first so UI is always latest
    setJamSelections((prev) => ({
      ...prev,
      jamGrooveSelections: {
        ...(prev.jamGrooveSelections || {}),
        recessionalSong: cleaned,
      },
    }));

    const user = getAuth().currentUser;

    if (user && !isGuestUser) {
      try {
        await updateDoc(doc(db, "users", user.uid), {
          "jamGrooveSelections.recessionalSong": cleaned,
        });
        console.log("✅ Recessional song saved to Firestore:", cleaned);
      } catch (error) {
        console.error("❌ Firestore save error:", error);
      }
    } else {
      try {
        const localData = JSON.parse(
          localStorage.getItem("jamGrooveProgress") || "{}"
        );
        localData.jamGrooveSelections = {
          ...(localData.jamGrooveSelections || {}),
          recessionalSong: cleaned,
        };
        localStorage.setItem(
          "jamGrooveProgress",
          JSON.stringify(localData)
        );
        console.log(
          "💾 Recessional song saved to localStorage:",
          cleaned
        );
      } catch (error) {
        console.error("❌ localStorage save error:", error);
      }
    }

    onClose();
  };

  return (
    <ScrollSongLayout
      title="Recessional Song"
      // match this prop name to ScrollSongLayout's actual interface
      sealImageSrc={`${import.meta.env.BASE_URL}assets/images/recessional_seal.png`}
      onClose={onClose}
      onSave={handleSave}
    >
      <p className="scroll-header">
        What song should be played as everyone walks back down the aisle?
        (recessional)
      </p>

      <input
        className="px-input"
        placeholder="Song Title"
        value={formData.songTitle}
        onChange={(e) => handleChange("songTitle", e.target.value)}
      />
      <input
        className="px-input"
        placeholder="Artist Name"
        value={formData.artist}
        onChange={(e) => handleChange("artist", e.target.value)}
      />
      <input
        className="px-input"
        placeholder="Version URL (www.example.com)"
        value={formData.versionUrl}
        onChange={(e) => handleChange("versionUrl", e.target.value)}
      />
    </ScrollSongLayout>
  );
};

export default RecessionalSong;