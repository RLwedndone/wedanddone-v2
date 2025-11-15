// src/components/admin/VenueAvailabilityAdmin.tsx
import React, { useState } from "react";
import { getAuth } from "firebase/auth";
import { doc, updateDoc, arrayUnion } from "firebase/firestore";
import { db } from "../../firebase/firebaseConfig"; // 🔁 adjust path if needed

// List of venue IDs must match your Firestore doc IDs exactly
const VENUES = [
  { id: "batesmansion", label: "Bates Mansion" },
  { id: "desertfoothills", label: "Desert Foothills" },
  { id: "encanterra", label: "Encanterra" },
  { id: "fabric", label: "Fabric" },
  { id: "farmhouse", label: "Farmhouse" },
  { id: "haciendadelsol", label: "Hacienda Del Sol" },
  { id: "lakehouse", label: "Windmill Lake House" },
  { id: "ocotillo", label: "Ocotillo" },
  { id: "rubihouse", label: "Rubi House" },
  { id: "schnepfbarn", label: "Schnepf Barn" },
  { id: "soho63", label: "SoHo63" },
  { id: "sunkist", label: "Sunkist" },
  { id: "themeadow", label: "The Meadow" },
  { id: "tubac", label: "Tubac" },
  { id: "valleyho", label: "Hotel Valley Ho" },
  { id: "verrado", label: "Vic & Verrado" },
];

interface Props {
  onClose?: () => void; // optional so you can use it as a modal later
}

const VenueAvailabilityAdmin: React.FC<Props> = ({ onClose }) => {
  const [venueId, setVenueId] = useState<string>("batesmansion");
  const [date, setDate] = useState<string>(""); // YYYY-MM-DD from <input type="date">
  const [status, setStatus] = useState<null | "success" | "error">(null);
  const [message, setMessage] = useState<string>("");
  const [bulkDatesText, setBulkDatesText] = useState<string>("");
const [isBulkSaving, setIsBulkSaving] = useState<boolean>(false);

  const handleMarkBooked = async () => {
    setStatus(null);
    setMessage("");

    if (!venueId || !date) {
      setStatus("error");
      setMessage("Pick a venue and a date first.");
      return;
    }

    try {
      const auth = getAuth();
      const user = auth.currentUser;
      const displayUser =
        user?.email || user?.uid || "manual-update-without-auth";

      // 👉 This adds the date string to the bookedDates array
      await updateDoc(doc(db, "venues", venueId), {
        bookedDates: arrayUnion(date),
        lastAvailabilityUpdateBy: displayUser,
        lastAvailabilityUpdateAt: new Date().toISOString(),
      });

      setStatus("success");
      setMessage(
        `Marked ${venueId} as booked on ${date}. (Remember: this is stored as "${date}" in bookedDates.)`
      );
    } catch (err) {
      console.error("Error marking date as booked:", err);
      setStatus("error");
      setMessage("Something went wrong saving to Firestore.");
    }
  };

  const handleBulkAdd = async () => {
    setStatus(null);
    setMessage("");
  
    if (!venueId) {
      setStatus("error");
      setMessage("Pick a venue first.");
      return;
    }
  
    // Split on commas and new lines
    const rawPieces = bulkDatesText.split(/[\n,]+/);
    const cleanedDates = rawPieces
      .map((d) => d.trim())
      .filter((d) => d.length > 0);
  
    if (cleanedDates.length === 0) {
      setStatus("error");
      setMessage("Add at least one date (YYYY-MM-DD) in the bulk box.");
      return;
    }
  
    // Optional: simple format sanity check: YYYY-MM-DD
    const invalid = cleanedDates.filter(
      (d) => !/^\d{4}-\d{2}-\d{2}$/.test(d)
    );
    if (invalid.length > 0) {
      setStatus("error");
      setMessage(
        `These dates don't look like YYYY-MM-DD: ${invalid.join(", ")}`
      );
      return;
    }
  
    try {
      setIsBulkSaving(true);
  
      const auth = getAuth();
      const user = auth.currentUser;
      const displayUser =
        user?.email || user?.uid || "manual-update-without-auth";
  
      await updateDoc(doc(db, "venues", venueId), {
        bookedDates: arrayUnion(...cleanedDates),
        lastAvailabilityUpdateBy: displayUser,
        lastAvailabilityUpdateAt: new Date().toISOString(),
      });
  
      setStatus("success");
      setMessage(
        `Added ${cleanedDates.length} booked date${
          cleanedDates.length > 1 ? "s" : ""
        } for ${venueId}.`
      );
      setBulkDatesText("");
    } catch (err) {
      console.error("Error bulk-adding booked dates:", err);
      setStatus("error");
      setMessage("Something went wrong saving bulk dates to Firestore.");
    } finally {
      setIsBulkSaving(false);
    }
  };

  return (
    <div className="pixie-overlay">
      <div
        className="pixie-card pixie-card--modal"
        style={{
          maxWidth: 600,
          width: "90%",
          padding: 24,
          overflowY: "auto",
          maxHeight: "85vh",
        }}
      >
        {/* Close X */}
        {onClose && (
          <button
            className="pixie-card__close"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        )}
  
        {/* Title */}
        <h2
          className="px-title-lg"
          style={{ marginBottom: 10, marginTop: 0, textAlign: "left" }}
        >
          Venue Availability Admin
        </h2>
  
        <p style={{ marginBottom: 20, color: "#444", fontSize: 14 }}>
          Use this tool to quickly mark a single date as{" "}
          <strong>booked</strong> for a venue. It updates the{" "}
          <code>bookedDates</code> array on the <code>/venues/&lt;venueId&gt;</code> doc.
        </p>
  
        {/* Venue Selector */}
        <label className="px-label" style={{ marginBottom: 6 }}>
          Venue
        </label>
        <select
          className="px-input"
          value={venueId}
          onChange={(e) => setVenueId(e.target.value)}
          style={{ width: "100%", marginBottom: 20 }}
        >
          {VENUES.map((v) => (
            <option key={v.id} value={v.id}>
              {v.label} ({v.id})
            </option>
          ))}
        </select>
  
              {/* Date Selector */}
      <label className="px-label" style={{ marginBottom: 6 }}>
        Date to mark as booked
      </label>
      <input
        type="date"
        className="px-input"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        style={{ width: "100%", marginBottom: 24 }}
      />

      {/* Single-date Button */}
      <button
        className="px-button px-button--primary"
        style={{ width: "100%", marginBottom: 16 }}
        onClick={handleMarkBooked}
      >
        Mark Date as Booked
      </button>

      <hr style={{ margin: "16px 0", opacity: 0.4 }} />

      {/* Bulk add section */}
      <p style={{ marginBottom: 8, fontSize: 13, color: "#555" }}>
        <strong>Bulk add booked dates</strong> (optional)
        <br />
        Paste multiple dates in <code>YYYY-MM-DD</code> format, separated by
        commas or new lines.
      </p>

      <textarea
        className="px-input"
        placeholder={"2026-12-12\n2026-12-19\n2027-01-04"}
        value={bulkDatesText}
        onChange={(e) => setBulkDatesText(e.target.value)}
        style={{
          width: "100%",
          minHeight: 100,
          resize: "vertical",
          marginBottom: 12,
          fontFamily: "monospace",
          fontSize: 13,
        }}
      />

      <button
        className="px-button px-button--secondary"
        style={{ width: "100%", marginBottom: 8 }}
        onClick={handleBulkAdd}
        disabled={isBulkSaving}
      >
        {isBulkSaving ? "Saving..." : "Bulk Add Booked Dates"}
      </button>
  
        {/* Status Message */}
        {status && (
          <div
            style={{
              marginTop: 10,
              padding: "10px 12px",
              borderRadius: 8,
              background:
                status === "success"
                  ? "rgba(46, 204, 113, 0.12)"
                  : "rgba(231, 76, 60, 0.12)",
              color: status === "success" ? "#1e824c" : "#c0392b",
              fontSize: 14,
            }}
          >
            {message}
          </div>
        )}
      </div>
    </div>
  );
};

export default VenueAvailabilityAdmin;