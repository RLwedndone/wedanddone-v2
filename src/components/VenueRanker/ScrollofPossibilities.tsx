// src/components/venue-ranker/ScrollOfPossibilities.tsx
import { useEffect, useState } from "react";
import { auth, db } from "../../firebase/firebaseConfig";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { venueToCastleImage } from "../../utils/venueToCastleImage";
import CastleModal from "./CastleModal";

interface ScrollOfPossibilitiesProps {
  onClose: () => void;
  setCurrentScreen: (screen: string) => void;
  setCurrentIndex: (index: number) => void;
  screenList: string[];
}

interface VenueRankerSelections {
  exploreMode: "all" | "vibe";
  vibeSelections: string[];
  rankings: Record<string, number>;
}

const ScrollOfPossibilities: React.FC<ScrollOfPossibilitiesProps> = ({
  onClose,
  setCurrentScreen,
  setCurrentIndex,
  screenList,
}) => {
  const [availableVenues, setAvailableVenues] = useState<string[]>([]);
  const [modalVenue, setModalVenue] = useState<string | null>(null);
  const [weddingDate, setWeddingDate] = useState<string | null>(null);
  const [guestCount, setGuestCount] = useState<number>(0);
  const [venueDetails, setVenueDetails] = useState<Record<string, any>>({});

  useEffect(() => {
    localStorage.setItem("venueRankerCheckpoint", "scroll-of-possibilities");

    // Pull persisted date + guests
    const storedDate = localStorage.getItem("venueWeddingDate");
    const storedGuests = localStorage.getItem("venueGuestCount");
    if (storedDate) setWeddingDate(storedDate);
    if (storedGuests) setGuestCount(parseInt(storedGuests));

    const fetchVenueSelections = async () => {
      let selections: VenueRankerSelections | null = null;
      const user = auth.currentUser;

      if (user) {
        try {
          const docRef = doc(db, "users", user.uid);
          const snap = await getDoc(docRef);
          if (snap.exists()) selections = snap.data().venueRankerSelections;
        } catch (error) {
          console.error("Error fetching Firestore venueRankerSelections:", error);
        }
      }

      if (!selections) {
        const stored = localStorage.getItem("venueRankerSelections");
        if (stored) selections = JSON.parse(stored);
      }

      if (selections) {
        const selectedVenues: string[] = [];
        for (const [venue, score] of Object.entries(selections.rankings || {})) {
          if (score === 3 || score === 2) selectedVenues.push(venue);
        }
        setAvailableVenues(selectedVenues);

        // Load venue docs for pricing/availability (kept for future use)
        const venueInfo: Record<string, any> = {};
        for (const venueSlug of selectedVenues) {
          try {
            const venueRef = doc(db, "venues", venueSlug);
            const vsnap = await getDoc(venueRef);
            if (vsnap.exists()) venueInfo[venueSlug] = vsnap.data();
          } catch (err) {
            console.error(`Error fetching venue data for ${venueSlug}:`, err);
          }
        }
        setVenueDetails(venueInfo);
      }
    };

    fetchVenueSelections();
  }, []);

  const handleVenueClick = (venue: string) => setModalVenue(venue);
  const closeModal = () => setModalVenue(null);

  const handleBookIt = async (venueId: string) => {
    const user = auth.currentUser;

    localStorage.setItem("venueRankerSelectedVenue", JSON.stringify(venueId));
    localStorage.setItem("venueStep", user ? "calendar" : "account");

    if (user) {
      try {
        const docRef = doc(db, "users", user.uid, "venueRankerData", "booking");
        await setDoc(
          docRef,
          { selectedVenue: venueId, step: "calendar", timestamp: new Date() },
          { merge: true }
        );
      } catch (err) {
        console.error("🔥 Firestore write failed:", err);
      }
    }

    setCurrentScreen(user ? "calendar" : "account");
  };

  const handleStartContract = ({
    venueSlug,
    venueName,
    guestCount,
    weddingDate,
    price,
  }: {
    venueSlug: string;
    venueName: string;
    guestCount: number;
    weddingDate: string;
    price: number;
  }) => {
    localStorage.setItem("venueSlug", venueSlug);
    localStorage.setItem("venueName", venueName);
    localStorage.setItem("venueWeddingDate", weddingDate + "T12:00:00");
    localStorage.setItem("venueGuestCount", String(guestCount));
    localStorage.setItem("venuePrice", String(price));
    setCurrentScreen("venuecontract");
  };

  return (
    <div className="pixie-card" style={{ position: "relative" }}>
      {/* 🩷 Pink X */}
      <button className="pixie-card__close" onClick={onClose} aria-label="Close">
        <img src={`${import.meta.env.BASE_URL}assets/icons/pink_ex.png`} alt="Close" />
      </button>

      <div className="pixie-card__body">
        {/* Scoped styles */}
        <style>{`
          .scroll-header-video {
            display: block;
            width: 100%;
            max-width: 560px;
            margin: 0 auto 8px;
            border-radius: 12px;
            object-fit: cover;
          }
          .scroll-explainer-text {
            margin: 10px auto 14px;
            max-width: 680px;
            text-align: center;
            line-height: 1.5;
            color: #333;
          }
          @media (max-width: 480px) {
            .scroll-explainer-text {
              font-size: 0.95rem;
              line-height: 1.45;
              margin: 8px auto 12px;
              padding: 0 4px;
            }
          }
          .venue-grid {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 16px;
            margin: 20px auto 6px;
            width: 100%;
            max-width: 340px;
          }
          .castle-card {
            width: 100%;
            display: flex;
            justify-content: center;
          }
          .castle-button {
            display: block;
            width: 100%;
            max-width: 280px;
            height: auto;
            margin: 0 auto;
            object-fit: contain;
            cursor: pointer;
          }
          @media (max-width: 480px) { .castle-button { max-width: 240px; } }
          .castle-modal-overlay {
            position: fixed;
            inset: 0;
            background: rgba(0,0,0,.5);
            display: grid;
            place-items: center;
            padding: 16px;
            box-sizing: border-box;
            z-index: 2000; /* above card */
          }
        `}</style>

        {/* 🎥 Header video */}
        <video
          className="scroll-header-video"
          src={`${import.meta.env.BASE_URL}assets/videos/scroll_quill.mp4`}
          autoPlay
          muted
          loop
          playsInline
        />

        {/* Copy */}
        <p className="scroll-explainer-text" style={{ fontSize: "1rem" }}>
          Here are the venues you told us were favorites or might work. Click each of the castles below to compare!
        </p>

        <p className="scroll-explainer-text" style={{ fontSize: "1rem" }}>
          <strong>Madge Tip!</strong> As you’re comparing costs, keep in mind that some castles roll the feast right
          into their price, while others are just renting you the great hall. <br /><br />
          On top of that, a few have <strong>food &amp; beverage minimums</strong> — meaning you’ll need to spend a set
          amount on catering and bar service whether your guest list is large or small. Keep an eye out, because those
          minimums (and what’s included) can change the total investment.
        </p>

        <p className="scroll-explainer-text" style={{ fontSize: "1rem" }}>
          Be sure to select the <strong>"Castle Considerations" </strong> on each castle to get the skinny on pricing and pro tips.
        </p>

        {/* 🏰 Castles */}
        <div className="venue-grid">
          {availableVenues.map((venue) => (
            <div key={venue} className="castle-card">
              <img
                src={`/assets/images/CastleButtons/${venueToCastleImage[venue]}`}
                alt={venue}
                className="castle-button"
                onClick={() => handleVenueClick(venue)}
              />
            </div>
          ))}
        </div>

        {/* 🏰 Modal */}
        {modalVenue && (
          <div className="castle-modal-overlay">
            <CastleModal
              venueSlug={modalVenue}
              onClose={closeModal}
              onBook={(slug: string) => handleBookIt(slug)}
              handleStartContract={({ venueSlug, venueName, guestCount, weddingDate, price }) =>
                handleStartContract({ venueSlug, venueName, guestCount, weddingDate, price })
              }
            />
          </div>
        )}

        {/* 🔙 Back */}
        <div style={{ textAlign: "center", marginTop: "1.5rem" }}>
          <button
            className="boutique-back-btn"
            onClick={() => {
              setCurrentScreen("vibe");
              setCurrentIndex(0);
              localStorage.removeItem("venueRankerCheckpoint");
            }}
          >
            ← Back to Vibes
          </button>
        </div>
      </div>
    </div>
  );
};

export default ScrollOfPossibilities;