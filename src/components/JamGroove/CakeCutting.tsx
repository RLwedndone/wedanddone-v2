// src/components/jam/CakeCutting.tsx
import React, { useEffect, useState } from "react";
import { getAuth } from "firebase/auth";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "../../firebase/firebaseConfig";
import { JamSelectionsType } from "./JamOverlay";

interface CakeCuttingProps {
  onClose: () => void;
  onBack: () => void;
  onContinue: () => void;
  jamSelections: JamSelectionsType;
  setJamSelections: React.Dispatch<React.SetStateAction<JamSelectionsType>>;
  isGuestUser: boolean;
}

const CakeCutting: React.FC<CakeCuttingProps> = ({
  onClose,
  onBack,
  onContinue,
  jamSelections,
  setJamSelections,
  isGuestUser,
}) => {
  const [doCakeCutting, setDoCakeCutting] = useState<null | boolean>(null);
  const [song, setSong] = useState("");
  const [artist, setArtist] = useState("");
  const [url, setUrl] = useState("");

  // Load saved values (Firestore or localStorage)
  useEffect(() => {
    (async () => {
      const user = getAuth().currentUser;

      try {
        if (user) {
          const snap = await getDoc(doc(db, "users", user.uid));
          const data = snap.data();
          const saved = data?.jamGroove?.cakeCutting;
          if (saved) {
            setDoCakeCutting(saved.doCakeCutting ?? null);
            setSong(saved.song || "");
            setArtist(saved.artist || "");
            setUrl(saved.url || "");
          }
        } else {
          const local = JSON.parse(localStorage.getItem("jamGrooveProgress") || "{}");
          const saved = local?.cakeCutting;
          if (saved) {
            setDoCakeCutting(saved.doCakeCutting ?? null);
            setSong(saved.song || "");
            setArtist(saved.artist || "");
            setUrl(saved.url || "");
          }
        }
      } catch (e) {
        console.error("❌ CakeCutting load error:", e);
      }
    })();
  }, []);

  const normalizeUrl = (v: string) => {
    const s = v.trim();
    if (!s) return "";
    return /^https?:\/\//i.test(s) ? s : `https://${s}`;
  };

  const handleSave = async () => {
    const payload = {
      doCakeCutting,
      song: doCakeCutting ? song.trim() : "",
      artist: doCakeCutting ? artist.trim() : "",
      url: doCakeCutting ? normalizeUrl(url) : "",
    };

    // Update in-memory selections so downstream screens stay in sync
    setJamSelections((prev) => ({
      ...prev,
      cakeCutting: payload,
    }));

    const user = getAuth().currentUser;

    try {
      if (user) {
        await updateDoc(doc(db, "users", user.uid), {
          "jamGroove.cakeCutting": payload, // keep existing path
        });
        console.log("🍰 Cake Cutting → Firestore:", payload);
      } else {
        const local = JSON.parse(localStorage.getItem("jamGrooveProgress") || "{}");
        local.cakeCutting = payload;
        localStorage.setItem("jamGrooveProgress", JSON.stringify(local));
        console.log("💾 Cake Cutting → localStorage:", payload);
      }
    } catch (e) {
      console.error("❌ CakeCutting save error:", e);
    }

    onContinue();
  };

  return (
    <div className="pixie-card wd-page-turn">
      {/* Pink X */}
      <button className="pixie-card__close" onClick={onClose} aria-label="Close">
        <img src={`${import.meta.env.BASE_URL}assets/icons/pink_ex.png`} alt="Close" />
      </button>

      <div className="pixie-card__body" style={{ textAlign: "center" }}>
        <h2 className="px-title" style={{ marginBottom: "0.5rem" }}>
          Cake Cutting
        </h2>

        <img
          src={`${import.meta.env.BASE_URL}assets/images/cake_cutting.png`}
          alt="Cake Cutting"
          className="px-media"
          style={{ maxWidth: 300, marginBottom: 12 }}
        />

        <p className="px-prose-narrow" style={{ marginBottom: "1rem" }}>
          Will you be doing a cake cutting during your reception?
        </p>

        {/* Yes/No toggle */}
        <div style={{ display: "flex", justifyContent: "center", gap: "1.25rem", marginBottom: "1rem" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input
              type="radio"
              value="yes"
              checked={doCakeCutting === true}
              onChange={() => setDoCakeCutting(true)}
            />
            Yes
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input
              type="radio"
              value="no"
              checked={doCakeCutting === false}
              onChange={() => setDoCakeCutting(false)}
            />
            No
          </label>
        </div>

        {/* Song fields */}
        {doCakeCutting && (
          <div style={{ width: "100%", maxWidth: 420, margin: "0 auto 1rem", textAlign: "left" }}>
            <label style={{ fontWeight: 600, display: "block", marginBottom: 6 }}>Song Title</label>
            <input
              className="px-input"
              placeholder="e.g., Sugar"
              value={song}
              onChange={(e) => setSong(e.target.value)}
            />

            <label style={{ fontWeight: 600, display: "block", margin: "10px 0 6px" }}>Artist</label>
            <input
              className="px-input"
              placeholder="e.g., Maroon 5"
              value={artist}
              onChange={(e) => setArtist(e.target.value)}
            />

            <label style={{ fontWeight: 600, display: "block", margin: "10px 0 6px" }}>
              Version URL (optional)
            </label>
            <input
              className="px-input"
              placeholder="youtube.com/watch?v=…"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
            <small style={{ color: "#666", display: "block", marginTop: 4 }}>
              Add a link if there’s a specific version (YouTube/Spotify/Apple, etc.).
            </small>
          </div>
        )}

        {/* CTAs */}
        <div className="px-cta-col" style={{ marginTop: 8 }}>
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

export default CakeCutting;