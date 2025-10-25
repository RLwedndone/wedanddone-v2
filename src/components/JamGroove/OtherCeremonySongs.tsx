import React, { useState, useEffect } from "react";
import ScrollSongLayout from "../layouts/ScrollSongLayout";
import { getAuth } from "firebase/auth";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../../firebase/firebaseConfig";
import { JamSelectionsType } from "./JamOverlay";

interface OtherCeremonySongsProps {
  onClose: () => void;
  jamSelections: JamSelectionsType;
  setJamSelections: React.Dispatch<React.SetStateAction<JamSelectionsType>>;
  isGuestUser: boolean;
}

const OtherCeremonySongs: React.FC<OtherCeremonySongsProps> = ({
  onClose,
  jamSelections,
  setJamSelections,
  isGuestUser,
}) => {
  const [formData, setFormData] = useState({
    event: "",
    songTitle: "",
    artist: "",
    versionUrl: "",
  });

  // Hydrate from central state first; if empty, peek at localStorage (guest)
  useEffect(() => {
    const saved = jamSelections?.jamGrooveSelections?.otherSongs;
    if (saved) {
      setFormData({
        event: saved.event || "",
        songTitle: saved.songTitle || "",
        artist: saved.artist || "",
        versionUrl: saved.versionUrl || "",
      });
      return;
    }

    if (isGuestUser) {
      try {
        const local = JSON.parse(localStorage.getItem("jamGrooveProgress") || "{}");
        const ls = local?.jamGrooveSelections?.otherSongs;
        if (ls) {
          setFormData({
            event: ls.event || "",
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
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    const cleaned = {
      event: formData.event.trim(),
      songTitle: formData.songTitle.trim(),
      artist: formData.artist.trim(),
      versionUrl: formData.versionUrl.trim(),
    };

    // Update central state immediately
    setJamSelections((prev) => ({
      ...prev,
      jamGrooveSelections: {
        ...(prev.jamGrooveSelections || {}),
        otherSongs: cleaned,
      },
    }));

    const user = getAuth().currentUser;

    if (user && !isGuestUser) {
      try {
        await updateDoc(doc(db, "users", user.uid), {
          "jamGrooveSelections.otherSongs": cleaned,
        });
        console.log("✅ Other ceremony songs saved to Firestore:", cleaned);
      } catch (error) {
        console.error("❌ Firestore save error:", error);
      }
    } else {
      try {
        const local = JSON.parse(localStorage.getItem("jamGrooveProgress") || "{}");
        local.jamGrooveSelections = {
          ...(local.jamGrooveSelections || {}),
          otherSongs: cleaned,
        };
        localStorage.setItem("jamGrooveProgress", JSON.stringify(local));
        console.log("💾 Other ceremony songs saved to localStorage:", cleaned);
      } catch (error) {
        console.error("❌ localStorage save error:", error);
      }
    }

    onClose();
  };

  return (
    <ScrollSongLayout
      title="Other Ceremony Songs"
      // if ScrollSongLayout expects 'sealImagesrc', change this prop name back
      sealImageSrc={`${import.meta.env.BASE_URL}assets/images/other_seal.png`}
      onClose={onClose}
      onSave={handleSave}
    >
      <p className="scroll-header">
        Are you having any other special ceremony moments that need music? List them below:
      </p>

      <input
        className="px-input"
        placeholder="Event (e.g. candle lighting)"
        value={formData.event}
        onChange={(e) => handleChange("event", e.target.value)}
      />
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

export default OtherCeremonySongs;