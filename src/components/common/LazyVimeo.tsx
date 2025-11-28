import React, { useState } from "react";

interface LazyVimeoProps {
  videoId: string;
  title: string;
  thumbnail: string;
}

const LazyVimeo: React.FC<LazyVimeoProps> = ({ videoId, title, thumbnail }) => {
  const [isPlaying, setIsPlaying] = useState(false);

  // 🔹 Thumbnail state
  if (!isPlaying) {
    return (
      <button
        type="button"
        onClick={() => setIsPlaying(true)}
        style={{
          position: "relative",
          display: "block",
          width: "100%",
          maxWidth: 520,
          margin: "0 auto",
          borderRadius: 16,
          overflow: "hidden",
          border: "none",
          padding: 0,
          cursor: "pointer",
          background: "transparent",
        }}
      >
        <img
          src={thumbnail}
          alt={title}
          style={{
            display: "block",
            width: "100%",
            height: "auto",
          }}
        />

        {/* ▶️ Play button overlay */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "none",
          }}
        >
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: "50%",
              background: "rgba(255,255,255,0.92)",
              boxShadow: "0 6px 18px rgba(0,0,0,0.25)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                width: 0,
                height: 0,
                borderTop: "14px solid transparent",
                borderBottom: "14px solid transparent",
                borderLeft: "22px solid #2c62ba",
                marginLeft: 4,
              }}
            />
          </div>
        </div>
      </button>
    );
  }

  // 🔹 Playing state – no more height: 0 / padding-bottom trick
  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        maxWidth: 520,
        margin: "0 auto",
        borderRadius: 16,
        overflow: "hidden",
      }}
    >
      <iframe
        src={`https://player.vimeo.com/video/${videoId}?autoplay=1`}
        title={title}
        frameBorder="0"
        allow="autoplay; fullscreen; picture-in-picture"
        allowFullScreen
        style={{
          display: "block",
          width: "100%",
          aspectRatio: "16 / 9",
          height: "auto",
        }}
      />
    </div>
  );
};

export default LazyVimeo;