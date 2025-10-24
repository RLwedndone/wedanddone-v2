// src/components/jam/BrideEntranceSong.tsx
import React, { useEffect, useState } from "react";
import ScrollSongLayout from "../layouts/ScrollSongLayout";
import { getAuth } from "firebase/auth";
import { doc, updateDoc, getDoc } from "firebase/firestore";
import { db } from "../../firebase/firebaseConfig";
import { JamSelectionsType } from "./JamOverlay";

interface BrideEntranceSongProps {
  jamSelections: JamSelectionsType;
  setJamSelections: React.Dispatch<React.SetStateAction<JamSelectionsType>>;
  onClose: () => void;
  isGuestUser: boolean;
}

const BrideEntranceSong: React.FC<BrideEntranceSongProps> = ({
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

  // Load from in-memory state (primary), then local/remote as fallback
  useEffect(() => {
    const fromState = jamSelections?.ceremonyMusic || {};
    const title  = fromState.bride || "";
    const artist = fromState.brideArtist || "";
    const url    = fromState.brideVersion || "";

    if (title || artist || url) {
      setFormData({ songTitle: title, artist, versionUrl: url });
      return;
    }

    // Fallbacks
    (async () => {
      try {
        if (isGuestUser) {
          const local = JSON.parse(localStorage.getItem("jamGrooveProgress") || "{}");
          const cm = local?.ceremonyMusic || {};
          setFormData({
            songTitle: cm.bride || "",
            artist: cm.brideArtist || "",
            versionUrl: cm.brideVersion || "",
          });
        } else {
          const user = getAuth().currentUser;
          if (user) {
            const snap = await getDoc(doc(db, "users", user.uid));
            const data = snap.data() || {};
            const cm = data?.jamSelections?.ceremonyMusic || {};
            setFormData({
              songTitle: cm.bride || "",
              artist: cm.brideArtist || "",
              versionUrl: cm.brideVersion || "",
            });
          }
        }
      } catch (e) {
        console.error("❌ Failed to load bride entrance song:", e);
      }
    })();
  }, [jamSelections, isGuestUser]);

  const handleChange = (field: keyof typeof formData, value: string) =>
    setFormData((p) => ({ ...p, [field]: value }));

  const normalizeUrl = (v: string) => {
    const s = v.trim();
    if (!s) return "";
    if (/^https?:\/\//i.test(s)) return s;
    return `https://${s}`;
  };

  const handleSave = async () => {
    const user = getAuth().currentUser;

    // 1) Update app state (single source of truth)
    setJamSelections((prev) => ({
      ...prev,
      ceremonyMusic: {
        ...(prev.ceremonyMusic || {}),
        bride: formData.songTitle.trim(),
        brideArtist: formData.artist.trim(),
        brideVersion: normalizeUrl(formData.versionUrl),
      },
    }));

    // 2) Persist
    try {
      if (user && !isGuestUser) {
        await updateDoc(doc(db, "users", user.uid), {
          "jamSelections.ceremonyMusic.bride": formData.songTitle.trim(),
          "jamSelections.ceremonyMusic.brideArtist": formData.artist.trim(),
          "jamSelections.ceremonyMusic.brideVersion": normalizeUrl(formData.versionUrl),
        });
        console.log("👰 Bride Entrance saved (Firestore):", formData);
      } else {
        const local = JSON.parse(localStorage.getItem("jamGrooveProgress") || "{}");
        local.ceremonyMusic = {
          ...(local.ceremonyMusic || {}),
          bride: formData.songTitle.trim(),
          brideArtist: formData.artist.trim(),
          brideVersion: normalizeUrl(formData.versionUrl),
        };
        localStorage.setItem("jamGrooveProgress", JSON.stringify(local));
        console.log("💾 Bride Entrance saved (localStorage):", local.ceremonyMusic);
      }
    } catch (err) {
      console.error("❌ Save error:", err);
    }

    onClose();
  };

  return (
    <ScrollSongLayout
      title="Bride’s Entrance Song"
      sealImageSrc="/assets/images/bride_seal.png"
      onClose={onClose}
      onSave={handleSave}
    >
      <p className="scroll-header">
        What song should play as the bride walks down the aisle?
      </p>

      <label style={{ fontWeight: 600, marginBottom: 6 }}>Song Title</label>
      <input
        className="px-input"
        placeholder="e.g., Canon in D"
        value={formData.songTitle}
        onChange={(e) => handleChange("songTitle", e.target.value)}
      />

      <label style={{ fontWeight: 600, margin: "10px 0 6px" }}>Artist</label>
      <input
        className="px-input"
        placeholder="e.g., Pachelbel"
        value={formData.artist}
        onChange={(e) => handleChange("artist", e.target.value)}
      />

      <label style={{ fontWeight: 600, margin: "10px 0 6px" }}>Version URL (optional)</label>
      <input
        className="px-input"
        placeholder="youtube.com/watch?v=…"
        value={formData.versionUrl}
        onChange={(e) => handleChange("versionUrl", e.target.value)}
      />
      <small style={{ color: "#666", display: "block", marginTop: 4 }}>
        Add a link if there’s a specific version (YouTube/Spotify/Apple, etc.).
      </small>
    </ScrollSongLayout>
  );
};

export default BrideEntranceSong;