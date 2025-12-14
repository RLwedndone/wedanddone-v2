// src/components/jam/CeremonyMusic.tsx
import React from "react";
import { JamSelectionsType, type SongModalKey } from "./JamOverlay";

interface CeremonyMusicProps {
  onBack: () => void;
  onContinue: () => void;
  jamSelections: JamSelectionsType;
  setJamSelections: React.Dispatch<React.SetStateAction<JamSelectionsType>>;
  isGuestUser: boolean;
  currentStep: string;
  onClose?: () => void;
  openSongModal: (key: SongModalKey) => void;   // 👈 add this
}

const CeremonyMusic: React.FC<CeremonyMusicProps> = ({
  onBack,
  onContinue,
  jamSelections,
  setJamSelections,
  currentStep,
  isGuestUser,
  onClose,
  openSongModal,          // 👈 here
}) => {
  return (
    <div className="pixie-card wd-page-turn">
      {/* Pink X (optional; overlay already has a close icon) */}
      {onClose && (
        <button className="pixie-card__close" onClick={onClose} aria-label="Close">
          <img
            src={`${import.meta.env.BASE_URL}assets/icons/pink_ex.png`}
            alt="Close"
          />
        </button>
      )}

      <div className="pixie-card__body" style={{ textAlign: "center" }}>
        <h2 className="px-title" style={{ marginBottom: 6 }}>
          Ceremony Music
        </h2>
        <p className="px-prose-narrow" style={{ marginBottom: 18 }}>
          Tap a scroll to pop open a little song editor. We’ll save everything
          for your Groove Guide and your DJ. 🎶
        </p>

        <div
          style={{
            display: "grid",
            gap: 20,
            justifyItems: "center",
            marginBottom: 16,
          }}
        >
          {/* Party Entrance */}
          <button
            type="button"
            onClick={() => openSongModal("party")}
            style={{ border: "none", background: "transparent", padding: 0, cursor: "pointer" }}
          >
            <img
              src={`${import.meta.env.BASE_URL}assets/images/party_entrance.png`}
              alt="Party Entrance"
              className="px-media"
              style={{ maxWidth: 320, display: "block", margin: "0 auto" }}
            />
          </button>
          <p className="px-prose-narrow" style={{ marginTop: -4, marginBottom: 8 }}>
            Party entrance song
          </p>

          {/* Bride Entrance */}
          <button
            type="button"
            onClick={() => openSongModal("bride")}
            style={{ border: "none", background: "transparent", padding: 0, cursor: "pointer" }}
          >
            <img
              src={`${import.meta.env.BASE_URL}assets/images/bride_entrance.png`}
              alt="Bride Entrance"
              className="px-media"
              style={{ maxWidth: 320, display: "block", margin: "0 auto" }}
            />
          </button>
          <p className="px-prose-narrow" style={{ marginTop: -4, marginBottom: 8 }}>
            Bride’s entrance song
          </p>

          {/* Other Ceremony Songs */}
          <button
            type="button"
            onClick={() => openSongModal("other")}
            style={{ border: "none", background: "transparent", padding: 0, cursor: "pointer" }}
          >
            <img
              src={`${import.meta.env.BASE_URL}assets/images/other_songs.png`}
              alt="Other Ceremony Songs"
              className="px-media"
              style={{ maxWidth: 320, display: "block", margin: "0 auto" }}
            />
          </button>
          <p className="px-prose-narrow" style={{ marginTop: -4, marginBottom: 8 }}>
            Any other ceremony song moments
          </p>

          {/* Recessional */}
          <button
            type="button"
            onClick={() => openSongModal("recessional")}
            style={{ border: "none", background: "transparent", padding: 0, cursor: "pointer" }}
          >
            <img
              src={`${import.meta.env.BASE_URL}assets/images/recessional.png`}
              alt="Recessional Song"
              className="px-media"
              style={{ maxWidth: 320, display: "block", margin: "0 auto" }}
            />
          </button>
          <p className="px-prose-narrow" style={{ marginTop: -4 }}>
            Recessional / exit song
          </p>
        </div>

        {/* CTAs */}
        <div className="px-cta-col" style={{ marginTop: 12 }}>
          <button className="boutique-primary-btn" onClick={onContinue}>
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

export default CeremonyMusic;