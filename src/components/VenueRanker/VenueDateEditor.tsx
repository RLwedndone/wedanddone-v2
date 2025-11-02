import React, { useMemo } from "react";
import Calendar from "react-calendar";
import { doc, updateDoc } from "firebase/firestore";
import { auth, db } from "../../firebase/firebaseConfig";

interface VenueDateEditorProps {
  isUnavailable: boolean;
  isClosedOnThatDay: boolean;
  hasBookedOtherVendors: boolean;
  weddingDate: string | null;
  setWeddingDate: (date: string) => void;
  selectedDate: string | null;
  setSelectedDate: (date: string) => void;
  isNewDateConfirmed: boolean;
  setIsNewDateConfirmed: (confirmed: boolean) => void;
  newDate: Date | null;
  setNewDate: (date: Date | null) => void;
  bookedDates: string[];
  venueSlug: string;
  setCurrentScreen: (screen: string) => void;
  onClose: () => void;
  proposedDate: string | null;
  setProposedDate: (date: string | null) => void;
}

const weekdayMap = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

const VenueDateEditor: React.FC<VenueDateEditorProps> = ({
  isUnavailable,
  isClosedOnThatDay,
  hasBookedOtherVendors,
  weddingDate,
  setWeddingDate,
  selectedDate,
  setSelectedDate,
  proposedDate,
  setProposedDate,
  isNewDateConfirmed,
  setIsNewDateConfirmed,
  newDate,
  setNewDate,
  bookedDates,
  venueSlug,
  setCurrentScreen,
  onClose,
}) => {

  // ✅ Decide what month/year the calendar should open on
  // Priority:
  // 1. proposedDate (user just clicked a new date in this modal)
  // 2. selectedDate (the date we think is "their" date for this venue)
  // 3. weddingDate (their global wedding date)
  // 4. today (fallback)
  const initialVisibleMonth: Date = useMemo(() => {
    // helper to parse "YYYY-MM-DD" safely into Date
    const parseISOToDate = (iso: string | null | undefined): Date | null => {
      if (!iso) return null;
      // force midday so we don't accidentally shift because of timezone
      const d = new Date(iso + "T12:00:00");
      if (isNaN(d.getTime())) return null;
      return d;
    };

    const fromProposed = parseISOToDate(proposedDate || undefined);
    const fromSelected = parseISOToDate(selectedDate || undefined);
    const fromWedding = parseISOToDate(weddingDate || undefined);

    const base =
      fromProposed ||
      fromSelected ||
      fromWedding ||
      new Date(); // fallback: "today"

    // we give Calendar the first day of that month just to anchor view
    return new Date(base.getFullYear(), base.getMonth(), 1);
  }, [proposedDate, selectedDate, weddingDate]);

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        backgroundColor: "rgba(0, 0, 0, 0.6)",
        zIndex: 1000,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        overflowY: "auto",
        padding: "2rem",
      }}
    >
      <div
        style={{
          backgroundColor: "#fff",
          borderRadius: "20px",
          maxWidth: "700px",
          width: "90%",
          padding: "2rem",
          boxShadow: "0 8px 20px rgba(0, 0, 0, 0.2)",
          fontFamily: "'Nunito', sans-serif",
          position: "relative",
          zIndex: 10,
        }}
      >
        <button className="modal-close" onClick={onClose}>
          ✖
        </button>

        {isUnavailable && hasBookedOtherVendors && (
          <div
            style={{
              backgroundColor: "#fff6f6",
              border: "1px solid #ffaaaa",
              borderRadius: "12px",
              padding: "1.5rem",
              marginTop: "1rem",
              fontFamily: "'Nunito', sans-serif",
              textAlign: "center",
              color: "#990000",
            }}
          >
            <p style={{ fontWeight: 600, fontSize: "1.1rem" }}>
              Sorry, this venue is unavailable for your wedding date.
            </p>
            <p style={{ fontSize: "1rem", marginTop: "0.5rem" }}>
              Because you've already booked other vendors for this date,
              you'll need to pick a different venue.
            </p>
          </div>
        )}

        {isUnavailable && !hasBookedOtherVendors && (
          <div className="calendar-wrapper">
            <div style={{ textAlign: "center", marginBottom: "1rem" }}>
              <video
                src={`${import.meta.env.BASE_URL}assets/videos/calendar_loop.mp4`}
                autoPlay
                muted
                loop
                playsInline
                style={{
                  width: "120px",
                  height: "120px",
                  borderRadius: "12px",
                  marginBottom: "0.5rem",
                }}
              />
              <h4 className="modal-subtext" style={{ margin: 0 }}>
                Pick a new date to see if it's available:
              </h4>
            </div>

            <div className="calendar-container">
              <Calendar
                // ✅ force the calendar to OPEN on their date's month
                activeStartDate={initialVisibleMonth}
                // (react-calendar will re-center to this on first render)

                onChange={(date) => {
                  if (date instanceof Date) {
                    const iso = date.toISOString().split("T")[0];
                    setProposedDate(iso);
                    setIsNewDateConfirmed(false);
                  }
                }}
                tileDisabled={({ date }) => {
                  const isoDate = date.toISOString().split("T")[0];
                  const weekdayName = weekdayMap[date.getDay()];
                  const isClosedDay =
                    venueSlug === "desertfoothills" &&
                    ["monday", "tuesday", "wednesday", "thursday"].includes(
                      weekdayName
                    );

                  return bookedDates.includes(isoDate) || isClosedDay;
                }}
                tileClassName={({ date, view }) => {
                  if (view !== "month") return null;
                  const iso = date.toISOString().split("T")[0];
                  const weekdayName = weekdayMap[date.getDay()];
                  const isClosedDay =
                    venueSlug === "desertfoothills" &&
                    ["monday", "tuesday", "wednesday", "thursday"].includes(
                      weekdayName
                    );

                  if (bookedDates.includes(iso) || isClosedDay) {
                    return "react-calendar__tile--booked";
                  }
                  return null;
                }}
              />

              {(newDate || proposedDate) && (
                <div style={{ marginTop: "1rem" }}>
                  <p
                    className="venue-warning"
                    style={{ fontWeight: "bold", fontSize: "1.1rem" }}
                  >
                    Selected:{" "}
                    {(
                      newDate ||
                      new Date((proposedDate as string) + "T12:00:00")
                    ).toLocaleDateString("en-US", {
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </p>

                  {proposedDate && (
  <div style={{ textAlign: "center", marginTop: "1rem" }}>
    <button
      className="boutique-primary-btn"
      onClick={() => {
        const confirmedDate = new Date(proposedDate + "T12:00:00");
        const formattedDate = confirmedDate.toISOString().split("T")[0];

        setNewDate(confirmedDate);
        setIsNewDateConfirmed(true);
        setWeddingDate(formattedDate);
        setSelectedDate(formattedDate);
        localStorage.setItem("weddingDate", formattedDate);

        if (auth.currentUser) {
          const userRef = doc(db, "users", auth.currentUser.uid);
          updateDoc(userRef, { weddingDate: formattedDate });
        }

        onClose();
      }}
    >
      Pick This New Date
    </button>
  </div>
)}
                </div>
              )}
            </div>
          </div>
        )}

        {isClosedOnThatDay && weddingDate && (
          <div
            style={{
              color: "red",
              fontWeight: "bold",
              marginTop: "1rem",
            }}
          >
            ⚠️ This venue is not available on{" "}
            {new Date(weddingDate + "T12:00:00").toLocaleDateString("en-US", {
              weekday: "long",
            })}
            s.
          </div>
        )}
      </div>
    </div>
  );
};

export default VenueDateEditor;