// src/components/jam/GrandEntrances.tsx
import React, { useEffect, useState } from "react";
import { getAuth } from "firebase/auth";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "../../firebase/firebaseConfig";
import { JamSelectionsType } from "./JamOverlay";

interface GrandEntrancesProps {
  onBack: () => void;
  onContinue: () => void;
  onClose: () => void;
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
  // selection: "full" | "couple" | "none"
  const [selection, setSelection] = useState<"full" | "couple" | "none" | "">("");
  const [bridesmaidsSong, setBridesmaidsSong] = useState("");
  const [bridesmaidsArtist, setBridesmaidsArtist] = useState("");
  const [bridesmaidsUrl, setBridesmaidsUrl] = useState("");

  const [groomsmenSong, setGroomsmenSong] = useState("");
  const [groomsmenArtist, setGroomsmenArtist] = useState("");
  const [groomsmenUrl, setGroomsmenUrl] = useState("");

  const [coupleSong, setCoupleSong] = useState("");
  const [coupleArtist, setCoupleArtist] = useState("");
  const [coupleUrl, setCoupleUrl] = useState("");

  // Load once on mount
  useEffect(() => {
    (async () => {
      // 1) Overlay state first
      const existing = (jamSelections as any)?.grandEntrances;
      if (existing) {
        hydrateFromSaved(existing);
        return;
      }

      const user = getAuth().currentUser;

      try {
        // 2) Firestore
        if (user && !isGuestUser) {
          const snap = await getDoc(doc(db, "users", user.uid));
          const data = snap.data() as any | undefined;
          const saved = data?.jamGroove?.grandEntrances;
          if (saved) {
            hydrateFromSaved(saved);
            return;
          }
        }

        // 3) localStorage
        const local = JSON.parse(localStorage.getItem("jamGrooveProgress") || "{}");
        if (local.grandEntrances) {
          hydrateFromSaved(local.grandEntrances);
        }
      } catch (e) {
        console.error("❌ GrandEntrances load error:", e);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hydrateFromSaved = (saved: any) => {
    const sel = saved.selection as "full" | "couple" | "none" | undefined;
    setSelection(sel || "none");

    setBridesmaidsSong(saved.bridesmaidsSong || "");
    setBridesmaidsArtist(saved.bridesmaidsArtist || "");
    setBridesmaidsUrl(saved.bridesmaidsUrl || "");

    setGroomsmenSong(saved.groomsmenSong || "");
    setGroomsmenArtist(saved.groomsmenArtist || "");
    setGroomsmenUrl(saved.groomsmenUrl || "");

    setCoupleSong(saved.coupleSong || "");
    setCoupleArtist(saved.coupleArtist || "");
    setCoupleUrl(saved.coupleUrl || "");
  };

  const normalizeUrl = (v: string) => {
    const s = v.trim();
    if (!s) return "";
    return /^https?:\/\//i.test(s) ? s : `https://${s}`;
  };

  const handleSave = async () => {
    let finalSelection: "full" | "couple" | "none" = selection || "none";

    const payload =
      finalSelection === "none"
        ? {
            selection: "none" as const,
            bridesmaidsSong: "",
            bridesmaidsArtist: "",
            bridesmaidsUrl: "",
            groomsmenSong: "",
            groomsmenArtist: "",
            groomsmenUrl: "",
            coupleSong: "",
            coupleArtist: "",
            coupleUrl: "",
          }
        : {
            selection: finalSelection,
            bridesmaidsSong: finalSelection === "full" ? bridesmaidsSong.trim() : "",
            bridesmaidsArtist: finalSelection === "full" ? bridesmaidsArtist.trim() : "",
            bridesmaidsUrl:
              finalSelection === "full" ? normalizeUrl(bridesmaidsUrl) : "",
            groomsmenSong: finalSelection === "full" ? groomsmenSong.trim() : "",
            groomsmenArtist: finalSelection === "full" ? groomsmenArtist.trim() : "",
            groomsmenUrl:
              finalSelection === "full" ? normalizeUrl(groomsmenUrl) : "",
            coupleSong: coupleSong.trim(),
            coupleArtist: coupleArtist.trim(),
            coupleUrl: normalizeUrl(coupleUrl),
          };

    // Keep overlay state in sync
    setJamSelections((prev) => ({
      ...prev,
      grandEntrances: payload,
    }));

    const user = getAuth().currentUser;

    try {
      if (user && !isGuestUser) {
        await updateDoc(doc(db, "users", user.uid), {
          "jamGroove.grandEntrances": payload,
        });
        console.log("🎉 Grand Entrances → Firestore:", payload);
      } else {
        const local = JSON.parse(localStorage.getItem("jamGrooveProgress") || "{}");
        local.grandEntrances = payload;
        localStorage.setItem("jamGrooveProgress", JSON.stringify(local));
        console.log("💾 Grand Entrances → localStorage:", payload);
      }
    } catch (e) {
      console.error("❌ Save error:", e);
    }

    onContinue();
  };

  const showFields = selection === "full" || selection === "couple";

  return (
    <div className="pixie-card wd-page-turn">
      {/* Pink X */}
      <button className="pixie-card__close" onClick={onClose} aria-label="Close">
        <img src={`${import.meta.env.BASE_URL}assets/icons/pink_ex.png`} alt="Close" />
      </button>

      <div className="pixie-card__body" style={{ textAlign: "center" }}>
        <h2 className="px-title" style={{ marginBottom: 8 }}>
          Grand Entrances
        </h2>
        <p className="px-prose-narrow" style={{ marginBottom: 16 }}>
          Will your wedding party be introduced with a musical grand entrance?
        </p>

        <img
          src={`${import.meta.env.BASE_URL}assets/images/grand_entrance.jpg`}
          alt="Grand Entrances"
          className="px-media"
          style={{ maxWidth: 300, marginBottom: 12 }}
        />

        {/* 3-option radio group */}
        <div
          className="px-radio-group"
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "0.75rem",
            marginBottom: 18,
          }}
        >
          <label
            className="px-radio"
            style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
          >
            <input
              type="radio"
              name="grandEntrance"
              value="full"
              checked={selection === "full"}
              onChange={() => setSelection("full")}
            />
            <span>Full Party Grand Entrance</span>
          </label>

          <label
            className="px-radio"
            style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
          >
            <input
              type="radio"
              name="grandEntrance"
              value="couple"
              checked={selection === "couple"}
              onChange={() => setSelection("couple")}
            />
            <span>Just the Couple</span>
          </label>

          <label
            className="px-radio"
            style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
          >
            <input
              type="radio"
              name="grandEntrance"
              value="none"
              checked={selection === "none"}
              onChange={() => setSelection("none")}
            />
            <span>No Grand Entrance</span>
          </label>
        </div>

        {selection === "none" && (
          <p
            className="px-prose-narrow"
            style={{ marginTop: 8, fontStyle: "italic" }}
          >
            You’re skipping the dramatic entrance? Bold move. We respect it. 🖖
          </p>
        )}

        {/* Song fields */}
        {showFields && (
          <div
            style={{
              width: "100%",
              maxWidth: 520,
              margin: "0 auto 1rem",
              textAlign: "left",
            }}
          >
            {/* Bridesmaids + groomsmen only when "full" */}
            {selection === "full" && (
              <>
                <div style={{ marginBottom: 16 }}>
                  <h4 className="px-subtitle" style={{ marginBottom: 8 }}>
                    Bridesmaids Entrance
                  </h4>
                  <label style={{ fontWeight: 600, display: "block", marginBottom: 6 }}>
                    Song Title
                  </label>
                  <input
                    className="px-input"
                    value={bridesmaidsSong}
                    onChange={(e) => setBridesmaidsSong(e.target.value)}
                    placeholder="Song Title"
                  />
                  <label
                    style={{ fontWeight: 600, display: "block", margin: "10px 0 6px" }}
                  >
                    Artist
                  </label>
                  <input
                    className="px-input"
                    value={bridesmaidsArtist}
                    onChange={(e) => setBridesmaidsArtist(e.target.value)}
                    placeholder="Artist"
                  />
                  <label
                    style={{ fontWeight: 600, display: "block", margin: "10px 0 6px" }}
                  >
                    Version URL (optional)
                  </label>
                  <input
                    className="px-input"
                    value={bridesmaidsUrl}
                    onChange={(e) => setBridesmaidsUrl(e.target.value)}
                    placeholder="youtube.com/…"
                  />
                </div>

                <div style={{ marginBottom: 16 }}>
                  <h4 className="px-subtitle" style={{ marginBottom: 8 }}>
                    Groomsmen Entrance
                  </h4>
                  <label style={{ fontWeight: 600, display: "block", marginBottom: 6 }}>
                    Song Title
                  </label>
                  <input
                    className="px-input"
                    value={groomsmenSong}
                    onChange={(e) => setGroomsmenSong(e.target.value)}
                    placeholder="Song Title"
                  />
                  <label
                    style={{ fontWeight: 600, display: "block", margin: "10px 0 6px" }}
                  >
                    Artist
                  </label>
                  <input
                    className="px-input"
                    value={groomsmenArtist}
                    onChange={(e) => setGroomsmenArtist(e.target.value)}
                    placeholder="Artist"
                  />
                  <label
                    style={{ fontWeight: 600, display: "block", margin: "10px 0 6px" }}
                  >
                    Version URL (optional)
                  </label>
                  <input
                    className="px-input"
                    value={groomsmenUrl}
                    onChange={(e) => setGroomsmenUrl(e.target.value)}
                    placeholder="youtube.com/…"
                  />
                </div>
              </>
            )}

            {/* Couple entrance (for both full + couple) */}
            <div style={{ marginBottom: 4 }}>
              <h4 className="px-subtitle" style={{ marginBottom: 8 }}>
                Couple Entrance
              </h4>
              <label style={{ fontWeight: 600, display: "block", marginBottom: 6 }}>
                Song Title
              </label>
              <input
                className="px-input"
                value={coupleSong}
                onChange={(e) => setCoupleSong(e.target.value)}
                placeholder="Song Title"
              />
              <label
                style={{ fontWeight: 600, display: "block", margin: "10px 0 6px" }}
              >
                Artist
              </label>
              <input
                className="px-input"
                value={coupleArtist}
                onChange={(e) => setCoupleArtist(e.target.value)}
                placeholder="Artist"
              />
              <label
                style={{ fontWeight: 600, display: "block", margin: "10px 0 6px" }}
              >
                Version URL (optional)
              </label>
              <input
                className="px-input"
                value={coupleUrl}
                onChange={(e) => setCoupleUrl(e.target.value)}
                placeholder="youtube.com/…"
              />
            </div>
          </div>
        )}

        {/* CTAs */}
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

export default GrandEntrances;