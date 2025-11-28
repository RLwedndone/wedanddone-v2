import React, { useState } from "react";

interface LazyVimeoProps {
  videoId: string;           // e.g. "1106994127"
  thumbnailSrc: string;      // local image for poster
  alt?: string;
}

const LazyVimeo: React.FC<LazyVimeoProps> = ({ videoId, thumbnailSrc, alt }) => {
  const [playing, setPlaying] = useState(false);

  const vimeoSrc = `https://player.vimeo.com/video/${videoId}?autoplay=1`;

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        paddingTop: "56.25%", // 16:9
        borderRadius: 12,
        overflow: "hidden",
        backgroundColor: "#000",
      }}
    >
      {playing ? (
        <iframe
          src={vimeoSrc}
          title={alt || "Video"}
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
          loading="lazy"
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            border: "none",
          }}
        />
      ) : (
        <button
          type="button"
          onClick={() => setPlaying(true)}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            border: "none",
            padding: 0,
            cursor: "pointer",
            background: "none",
          }}
        >
          <img
            src={thumbnailSrc}
            alt={alt || "Video thumbnail"}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: "block",
            }}
          />

          {/* Play button overlay */}
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              width: 72,
              height: 72,
              borderRadius: "50%",
              background: "rgba(0,0,0,0.65)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                width: 0,
                height: 0,
                borderTop: "12px solid transparent",
                borderBottom: "12px solid transparent",
                borderLeft: "20px solid #fff",
                marginLeft: 4,
              }}
            />
          </div>
        </button>
      )}
    </div>
  );
};

export default LazyVimeo;