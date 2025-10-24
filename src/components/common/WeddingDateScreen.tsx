import React, { useState } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { db } from "../../firebase/firebaseConfig";

interface WeddingDateScreenProps {
  onContinue: (data: { weddingDate: string; dayOfWeek: string }) => void;
  onClose: () => void;
}

const WeddingDateScreen: React.FC<WeddingDateScreenProps> = ({
  onContinue,
  onClose,
}) => {
  const [dateInput, setDateInput] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [dayOfWeek, setDayOfWeek] = useState<string>("");

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value;
    setDateInput(input);
    setError("");

    const date = new Date(input + "T12:00:00"); // avoids timezone offset
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (Number.isNaN(date.getTime())) {
      setDayOfWeek("");
      return;
    }
    if (date <= today) {
      setError("Please choose a date in the future.");
      setDayOfWeek("");
      return;
    }

    const dow = date.toLocaleDateString("en-US", { weekday: "long" });
    setDayOfWeek(dow);
  };

  const handleContinue = async () => {
    if (!dateInput || !dayOfWeek || error) return;

    const user = getAuth().currentUser;
    if (user) {
      await updateDoc(doc(db, "users", user.uid), {
        weddingDate: dateInput,
        dayOfWeek,
        dateLocked: false,
        "jamGrooveSelections.weddingDate": dateInput,
        "jamGrooveSelections.dayOfWeek": dayOfWeek,
      });
    }

    onContinue({ weddingDate: dateInput, dayOfWeek });
  };

  return (
    <div className="pixie-card pixie-card--modal">
      {/* close (pink X) */}
      <button className="pixie-card__close" onClick={onClose} aria-label="Close">
        <img src="/assets/icons/pink_ex.png" alt="Close" />
      </button>
  
      <div className="pixie-card__body">
        {/* 📽️ Calendar Video */}
        <div className="px-media px-media--sm">
          <video
            autoPlay
            loop
            muted
            playsInline
            src="/assets/videos/calendar_loop.mp4"
          />
        </div>
  
        {/* 🧚 Title + Subtitle */}
        <h2 className="px-title" style={{ marginBottom: "0.5rem" }}>
          Let’s lock in your big day!
        </h2>
        <p className="px-prose-narrow" style={{ marginBottom: "1rem" }}>
          Enter your wedding date below:
        </p>
  
        {/* 📅 Date input */}
        <div className="px-section" style={{ maxWidth: "420px", margin: "0 auto" }}>
          <input
            type="date"
            value={dateInput}
            onChange={handleDateChange}
            className="px-input-number"
            style={{
              width: "100%",
              textAlign: "center",
              fontFamily: "var(--font-body, 'Nunito', sans-serif)",
            }}
          />
  
          {dayOfWeek && (
            <p
              style={{
                marginTop: "0.5rem",
                color: "#2c62ba",
                textAlign: "center",
              }}
            >
              Lovely! That’s a <strong>{dayOfWeek}</strong>.
            </p>
          )}
  
          {error && (
            <p
              aria-live="polite"
              style={{ color: "#e53935", marginTop: "0.5rem", textAlign: "center" }}
            >
              {error}
            </p>
          )}
        </div>
  
        {/* 🔘 Buttons (Primary + Back) */}
        <div className="px-cta-col" style={{ marginTop: "1.5rem" }}>
          <button
            className="boutique-primary-btn"
            onClick={handleContinue}
            disabled={!dateInput || !dayOfWeek || !!error}
          >
            Continue
          </button>
          <button className="boutique-back-btn" onClick={onClose}>
            ⬅ Back
          </button>
        </div>
      </div>
    </div>
  );
};

export default WeddingDateScreen;