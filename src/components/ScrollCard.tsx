import React from "react";
import { useNavigate } from "react-router-dom";
import "./ScrollCard.css"; // make sure this file exists!

interface ScrollCardProps {
  venue: {
    title: string;
    cost: string;
    maxCapacity: string;
    collection: string;
    castleConsiderations: string[];
    videoLink: string;
  };
  venueId: string;
}

const ScrollCard: React.FC<ScrollCardProps> = ({ venue, venueId }) => {
  const navigate = useNavigate();

  return (
    <div className="scroll-card">
      <img
        src={`${import.meta.env.BASE_URL}assets/images/scroll.png`}
        alt="Scroll Background"
        className="scroll-bg"
      />

      <div className="scroll-content">
        <h3 className="scroll-title">{venue.title}</h3>

        <a
          href={venue.videoLink}
          target="_blank"
          rel="noopener noreferrer"
          className="scroll-video-link"
        >
          View Venue Video ↗
        </a>

        <p className="scroll-cost">{venue.cost}</p>
        <p className="scroll-guests">Up to {venue.maxCapacity} guests</p>

        <h4 className="scroll-subheading">Castle Considerations</h4>
        <ul className="scroll-list">
          {venue.castleConsiderations.map((item, index) => (
            <li key={index} className="scroll-list-item">
              {item}
            </li>
          ))}
        </ul>

        <img
  src={`${import.meta.env.BASE_URL}assets/images/gold_seal.png`}
  alt="Book Now Seal"
  className="scroll-seal clickable-seal"
  onClick={() => navigate(`/book/${venueId}`)}
/>
      </div>
    </div>
  );
};

export default ScrollCard;