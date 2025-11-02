import React from "react";

interface VenueVideoProps {
  vimeoId: string;
  title: string;
}

const VenueVideo: React.FC<VenueVideoProps> = ({ vimeoId, title }) => {
  // show normal Vimeo controls so user sees fullscreen etc
  const src = `https://player.vimeo.com/video/${vimeoId}?title=0&byline=0&portrait=0&controls=1&playsinline=1`;

  return (
    <div className="px-video-wrap">
      <iframe
        className="px-video-iframe"
        src={src}
        title={title}
        allow="autoplay; fullscreen; picture-in-picture"
        allowFullScreen
      />
    </div>
  );
};

export default VenueVideo;