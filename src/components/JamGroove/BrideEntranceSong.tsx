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

type FormData = {
  songTitle: string;
  artist: string;
  versionUrl: string;
};

const STORAGE_KEY_LOCAL = "jamGrooveProgress";

const BrideEntranceSong: React.FC<BrideEntranceSongProps> = ({
  onClose,
  jamSelections,
  setJamSelections,
  isGuestUser,
}) => {
  const [formData, setFormData] = useState<FormData>({
    songTitle: "",
    artist: "",
    versionUrl: "",
  });

  // Load from in-memory state first, fallback to Firestore/localStorage
  useEffect(() => {
    const fromState = jamSelections?.ceremonyMusic || {};
    const title = fromState.bride || "";
    const artist = fromState.brideArtist || "";
    const url = fromState.brideVersion || "";

    if (title || artist || url) {
      setFormData({ songTitle: title, artist, versionUrl: url });
      return;
    }

    (async () => {
      try {
        if (isGuestUser) {
          // guest path → localStorage
          const localRaw = localStorage.getItem(STORAGE_KEY_LOCAL);
          if (localRaw) {
            const local = JSON.parse(localRaw);
            const cm = local?.ceremonyMusic || {};
            setFormData({
              songTitle: cm.bride || "",
              artist: cm.brideArtist || "",
              versionUrl: cm.brideVersion || "",
            });
          }
        } else {
          // logged-in path → Firestore
          const user = getAuth().currentUser;
          if (user) {
            const snap = await getDoc(doc(db, "users", user.uid));
            if (snap.exists()) {
              const data = snap.data() || {};
              const cm = (data as any)?.jamSelections?.ceremonyMusic || {};
              setFormData({
                songTitle: cm.bride || "",
                artist: cm.brideArtist || "",
                versionUrl: cm.brideVersion || "",
              });
            }
          }
        }
      } catch (e) {
        console.error("❌ Failed to load bride entrance song:", e);
      }
    })();
  }, [jamSelections, isGuestUser]);

  const handleChange = (field: keyof FormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // Normalize URL before save (adds https:// if user typed just "youtube.com/...")
  const normalizeUrl = (v: string) => {
    const s = v.trim();
    if (!s) return "";
    if (/^https?:\/\//i.test(s)) return s;
    return `https://${s}`;
  };

  const handleSave = async () => {
    const user = getAuth().currentUser;

    // 1) Update in-memory app state
    setJamSelections((prev) => ({
      ...prev,
      ceremonyMusic: {
        ...(prev.ceremonyMusic || {}),
        bride: formData.songTitle.trim(),
        brideArtist: formData.artist.trim(),
        brideVersion: normalizeUrl(formData.versionUrl),
      },
    }));

    // 2) Persist to Firestore or localStorage
    try {
      if (user && !isGuestUser) {
        await updateDoc(doc(db, "users", user.uid), {
          "jamSelections.ceremonyMusic.bride": formData.songTitle.trim(),
          "jamSelections.ceremonyMusic.brideArtist": formData.artist.trim(),
          "jamSelections.ceremonyMusic.brideVersion": normalizeUrl(formData.versionUrl),
        });
        console.log("👰 Bride Entrance saved (Firestore):", formData);
      } else {
        const localRaw = localStorage.getItem(STORAGE_KEY_LOCAL);
        const local = localRaw ? JSON.parse(localRaw) : {};
        local.ceremonyMusic = {
          ...(local.ceremonyMusic || {}),
          bride: formData.songTitle.trim(),
          brideArtist: formData.artist.trim(),
          brideVersion: normalizeUrl(formData.versionUrl),
        };
        localStorage.setItem(STORAGE_KEY_LOCAL, JSON.stringify(local));
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
      /* if your ScrollSongLayout prop is actually `sealImagesrc`, change this name back */
      sealImageSrc={`${import.meta.env.BASE_URL}assets/images/bride_seal.png`}
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

      <label style={{ fontWeight: 600, margin: "10px 0 6px" }}>
        Version URL (optional)
      </label>
      <input
        className="px-input"
        placeholder="youtube.com/watch?v=…"
        value={formData.versionUrl}
        onChange={(e) => handleChange("versionUrl", e.target.value)}
      />
      <small
        style={{
          color: "#666",
          display: "block",
          marginTop: 4,
          lineHeight: 1.4,
          fontSize: ".9rem",
        }}
      >
        Add a link if there’s a specific version (YouTube / Spotify / Apple,
        etc.).
      </small>
    </ScrollSongLayout>
  );
};

export default BrideEntranceSong;