// src/components/venue-ranker/ScrollofPossibilities.tsx
import { useEffect, useState } from "react";
import { auth, db } from "../../firebase/firebaseConfig";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { venueToCastleImage } from "../../utils/venueToCastleImage";
import CastleModal from "./CastleModal";

interface ScrollofPossibilitiesProps {
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

// Cache keys
const LS_SELECTED_KEY = "venueRankerSelectedVenues"; // JSON stringified array of slugs
const LS_DATE_KEY = "venueWeddingDate";
const LS_GUESTS_KEY = "venueGuestCount";

// Coerce rankings object into a selected list (scores >= 2)
function computeSelectedFromRankings(rankings: Record<string, any> | undefined | null): string[] {
  if (!rankings || typeof rankings !== "object") return [];
  return Object.entries(rankings)
    .filter(([, v]) => Number(v) >= 2) // 3=favorite, 2=could work
    .map(([slug]) => slug);
}

const ScrollofPossibilities: React.FC<ScrollofPossibilitiesProps> = ({
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
  
    // Pull persisted date + guests (kept as-is)
    const storedDate = localStorage.getItem(LS_DATE_KEY);
    const storedGuests = localStorage.getItem(LS_GUESTS_KEY);
    if (storedDate) setWeddingDate(storedDate);
    if (storedGuests) setGuestCount(parseInt(storedGuests));
  
    const fetchVenueSelections = async () => {
      // 0) Fast path: cached selected slugs from a previous visit
      try {
        const cached = localStorage.getItem(LS_SELECTED_KEY);
        if (cached) {
          const arr = JSON.parse(cached);
          if (Array.isArray(arr) && arr.length) {
            setAvailableVenues(arr);
            // also hydrate venueDetails in background
            const info: Record<string, any> = {};
            await Promise.all(
              arr.map(async (venueSlug: string) => {
                try {
                  const venueRef = doc(db, "venues", venueSlug);
                  const vsnap = await getDoc(venueRef);
                  if (vsnap.exists()) info[venueSlug] = vsnap.data();
                } catch {}
              })
            );
            setVenueDetails(info);
            return; // done
          }
        }
      } catch {}
  
      // 1) Try Firestore on the user doc
      const user = auth.currentUser;
      let selected: string[] = [];
  
      if (user) {
        try {
          const userRef = doc(db, "users", user.uid);
          const snap = await getDoc(userRef);
          const data: any = snap.exists() ? snap.data() : null;
  
          // Primary (current) shape
          if (!selected.length && data?.venueRankerSelections?.rankings) {
            selected = computeSelectedFromRankings(data.venueRankerSelections.rankings);
          }
  
          // Older shape: venueRanker.rankings
          if (!selected.length && data?.venueRanker?.rankings) {
            selected = computeSelectedFromRankings(data.venueRanker.rankings);
          }
  
          // Older shape: separate arrays favorites/couldWork
          if (!selected.length && (data?.venueRanker?.favorites || data?.venueRanker?.couldWork)) {
            const favs = Array.isArray(data?.venueRanker?.favorites) ? data.venueRanker.favorites : [];
            const could = Array.isArray(data?.venueRanker?.couldWork) ? data.venueRanker.couldWork : [];
            selected = [...new Set([...favs, ...could])];
          }
        } catch (error) {
          console.error("Error fetching Firestore user doc for venue selections:", error);
        }
  
        // 2) Fallback: subcollection doc `users/{uid}/venueRankerData/prefs`
        if (!selected.length) {
          try {
            const prefsRef = doc(db, "users", user.uid, "venueRankerData", "prefs");
            const psnap = await getDoc(prefsRef);
            if (psnap.exists()) {
              const pdata: any = psnap.data();
              if (pdata?.rankings) {
                selected = computeSelectedFromRankings(pdata.rankings);
              } else if (Array.isArray(pdata?.favorites) || Array.isArray(pdata?.couldWork)) {
                const favs = Array.isArray(pdata?.favorites) ? pdata.favorites : [];
                const could = Array.isArray(pdata?.couldWork) ? pdata.couldWork : [];
                selected = [...new Set([...favs, ...could])];
              }
            }
          } catch (e) {
            console.error("Error fetching venueRankerData/prefs:", e);
          }
        }
      }
  
      // 3) Final fallback: localStorage blob we used earlier in the flow
      if (!selected.length) {
        try {
          const stored = localStorage.getItem("venueRankerSelections");
          if (stored) {
            const selections = JSON.parse(stored);
            selected = computeSelectedFromRankings(selections?.rankings);
            if (!selected.length && Array.isArray(selections?.vibeSelections)) {
              // old guest-mode fallback (just show vibe picks if rankings missing)
              selected = selections.vibeSelections;
            }
          }
        } catch {}
      }
  
      // Save + render
      setAvailableVenues(selected);
      try {
        localStorage.setItem(LS_SELECTED_KEY, JSON.stringify(selected));
      } catch {}
  
      // hydrate venueDetails (non-blocking)
      const venueInfo: Record<string, any> = {};
      await Promise.all(
        selected.map(async (venueSlug) => {
          try {
            const venueRef = doc(db, "venues", venueSlug);
            const vsnap = await getDoc(venueRef);
            if (vsnap.exists()) venueInfo[venueSlug] = vsnap.data();
          } catch (err) {
            console.error(`Error fetching venue data for ${venueSlug}:`, err);
          }
        })
      );
      setVenueDetails(venueInfo);
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
    <div className="pixie-card wd-page-turn" style={{ position: "relative" }}>
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
  src={`${import.meta.env.BASE_URL}assets/images/CastleButtons/${venueToCastleImage[venue]}`}
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

export default ScrollofPossibilities;