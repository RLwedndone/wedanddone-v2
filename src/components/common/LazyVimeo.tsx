import React, { useState } from "react";

interface LazyVimeoProps {
  videoId: string;
  title?: string;
  thumbnail?: string;
}

const LazyVimeo: React.FC<LazyVimeoProps> = ({
  videoId,
  title = "Venue walkthrough",
  thumbnail,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);

  const vimeoSrc = `https://player.vimeo.com/video/${videoId}?autoplay=1&title=0&byline=0&portrait=0`;

  return (
    <div className="px-video-wrap">
      <div className="px-video-inner">
        {!isPlaying ? (
          <button
            type="button"
            onClick={() => setIsPlaying(true)}
            aria-label="Play video"
            style={{
              all: "unset",
              cursor: "pointer",
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              display: "block",
            }}
          >
            {thumbnail ? (
              <img
                src={thumbnail}
                alt={title}
                className="px-video-thumb" 
              />
            ) : (
              <div className="px-video-iframe" />
            )}

            {/* Play button overlay */}
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
                  background: "rgba(255,255,255,0.9)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 6px 18px rgba(0,0,0,0.35)",
                }}
              >
                <div
                  style={{
                    marginLeft: 4,
                    width: 0,
                    height: 0,
                    borderTop: "14px solid transparent",
                    borderBottom: "14px solid transparent",
                    borderLeft: "22px solid #2c62ba",
                  }}
                />
              </div>
            </div>
          </button>
        ) : (
          <iframe
            src={vimeoSrc}
            title={title}
            allow="autoplay; fullscreen; picture-in-picture"
            allowFullScreen
            className="px-video-iframe"
          />
        )}
      </div>
    </div>
  );
};

export default LazyVimeo;