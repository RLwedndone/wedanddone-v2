// src/components/planner/PlannerExplainer.tsx
import React from "react";

interface PlannerExplainerProps {
  onContinue: () => void;
  onClose: () => void;
}

const PlannerExplainer: React.FC<PlannerExplainerProps> = ({ onContinue, onClose }) => {
  return (
    <div className="pixie-card">
      {/* Pink Close X */}
      <button
        className="pixie-card__close"
        onClick={onClose}
        aria-label="Close"
      >
        <img src="/assets/icons/pink_ex.png" alt="Close" />
      </button>

      {/* Scrollable body */}
      <div className="pixie-card__body">
        {/* Header media */}
        <img
          src="/assets/images/pixie_included.jpg"
          alt="Pixie Planner Included"
          className="px-media-sm"
          style={{ maxWidth: 300, marginBottom: "1rem" }}
        />

        {/* BEFORE YOUR DAY */}
        <h3
          className="px-title"
          style={{ marginTop: "0.75rem", marginBottom: "0.5rem", fontSize: "2.2rem" }}
        >
          Before Your Day
        </h3>
        <ul className="px-bullet-list">
          <li>Personalized support via email and one 1-hour online chat 45 days before the wedding</li>
          <li>Review of all venue and vendor contracts</li>
          <li>Coordination with vendors for logistics and setup (tables, linens, outlets, etc.)</li>
          <li>Vendor meal counts collected and submitted to caterer</li>
          <li>Day-of timeline prepared 2+ weeks before the event</li>
          <li>Review or creation of layout for ceremony, cocktail hour, and reception</li>
          <li>Vendor confirmations and final timeline coordination</li>
          <li>Rehearsal coordination (subject to availability)</li>
        </ul>

        {/* ON YOUR DAY */}
        <h3
          className="px-title"
          style={{ marginTop: "0.75rem", marginBottom: "0.5rem", fontSize: "2.2rem" }}
        >
          On Your Day
        </h3>
        <ul className="px-bullet-list">
          <li>1 coordinator + assistants (based on guest count)</li>
          <li>Up to 10 hours on-site</li>
          <li>Oversee and coordinate all vendors and timeline</li>
          <li>Set up personal decor (guestbook, signage, place cards, etc.)</li>
          <li>Distribute personal flowers (bouquets, boutonnieres, etc.)</li>
          <li>Line up bridal party and cue entrances</li>
          <li>Manage assigned seating setup</li>
          <li>Oversee vendor strike and ensure personal items are packed</li>
        </ul>

        <br />

        {/* CTA */}
        <div className="px-cta-col" style={{ marginTop: 8 }}>
          <button className="boutique-primary-btn" onClick={onContinue}>
            Let’s Get Planning!
          </button>
        </div>
      </div>
    </div>
  );
};

export default PlannerExplainer;