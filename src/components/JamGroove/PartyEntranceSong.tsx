import React, { useState, useEffect } from "react";
import ScrollSongLayout from "../layouts/ScrollSongLayout";
import { getAuth } from "firebase/auth";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../../firebase/firebaseConfig";
import { JamSelectionsType } from "./JamOverlay";

interface PartyEntranceSongProps {
  onClose: () => void;
  jamSelections: JamSelectionsType;
  setJamSelections: React.Dispatch<React.SetStateAction<JamSelectionsType>>;
  isGuestUser: boolean;
}

const PartyEntranceSong: React.FC<PartyEntranceSongProps> = ({
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

  // Hydrate from central state first; if guest & empty, peek at localStorage
  useEffect(() => {
    const saved = jamSelections?.jamGrooveSelections?.partyEntranceSong;
    if (saved) {
      setFormData({
        songTitle: saved.songTitle || "",
        artist: saved.artist || "",
        versionUrl: saved.versionUrl || "",
      });
      return;
    }

    if (isGuestUser) {
      try {
        const local = JSON.parse(
          localStorage.getItem("jamGrooveProgress") || "{}"
        );
        const ls = local?.jamGrooveSelections?.partyEntranceSong;
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
        partyEntranceSong: updated,
      },
    }));
  };

  const handleSave = async () => {
    const cleaned = {
      songTitle: formData.songTitle.trim(),
      artist: formData.artist.trim(),
      versionUrl: formData.versionUrl.trim(),
    };

    // update in-memory
    setJamSelections((prev) => ({
      ...prev,
      jamGrooveSelections: {
        ...(prev.jamGrooveSelections || {}),
        partyEntranceSong: cleaned,
      },
    }));

    const user = getAuth().currentUser;

    if (user && !isGuestUser) {
      try {
        await updateDoc(doc(db, "users", user.uid), {
          "jamGrooveSelections.partyEntranceSong": cleaned,
        });
        console.log("✅ Saved partyEntranceSong to Firestore:", cleaned);
      } catch (err) {
        console.error("❌ Firestore error:", err);
      }
    } else {
      try {
        const local = JSON.parse(
          localStorage.getItem("jamGrooveProgress") || "{}"
        );
        local.jamGrooveSelections = {
          ...(local.jamGrooveSelections || {}),
          partyEntranceSong: cleaned,
        };
        localStorage.setItem(
          "jamGrooveProgress",
          JSON.stringify(local)
        );
        console.log(
          "💾 Saved partyEntranceSong to localStorage:",
          cleaned
        );
      } catch (err) {
        console.error("❌ localStorage error:", err);
      }
    }

    onClose();
  };

  return (
    <ScrollSongLayout
      title="Bridal Party Entrance Song"
      // if your ScrollSongLayout prop is actually `sealImagesrc` (lowercase s),
      // change this name to match
      sealImageSrc={`${import.meta.env.BASE_URL}assets/images/party_seal.png`}
      onClose={onClose}
      onSave={handleSave}
    >
      <p className="scroll-header">
        What song should be played as the bridal party (bridesmaids,
        groomsmen, flower girls, etc.) walk down the aisle?
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

export default PartyEntranceSong;