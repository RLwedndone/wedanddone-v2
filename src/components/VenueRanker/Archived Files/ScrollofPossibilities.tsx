// src/components/venue-ranker/ScrollofPossibilities.tsx
import React, { useEffect, useState } from "react";
import { auth, db } from "../../../firebase/firebaseConfig";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { venueToCastleImage } from "../../../utils/venueToCastleImage";
import CastleModal from "../CastleModal";
import { resetVenueRankerSession } from "../../../utils/resetVenueRanker";
import SaveProgressMini from "../SaveProgressMini";
import { ph } from "../../../utils/posthogTrack";

interface ScrollofPossibilitiesProps {
  onClose: () => void;
  setCurrentScreen: (screen: string) => void;
  setCurrentIndex: (index: number) => void;
  screenList: string[];
  onBackToIntro: () => void;
  onSaveProgress: () => void;
  requireAuthForCastleBooking: (
    venueSlug: string,
    intent: "venuecontract" | "manual"
  ) => boolean;
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
const LS_LOCKED_VENUE_KEY = "wd_lockedVenueSlug";


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
  onBackToIntro,
  onSaveProgress,
  requireAuthForCastleBooking, // ✅ ADD THIS
}) => {
  const [availableVenues, setAvailableVenues] = useState<string[]>([]);
  const [modalVenue, setModalVenue] = useState<string | null>(null);
  const [weddingDate, setWeddingDate] = useState<string | null>(null);
  const [guestCount, setGuestCount] = useState<number>(0);
  const [venueDetails, setVenueDetails] = useState<Record<string, any>>({});
  const [autoOpenManualConfirm, setAutoOpenManualConfirm] = useState(false);
  const device = window.innerWidth < 480 ? "mobile" : "desktop";

  const [isDirectBooking, setIsDirectBooking] = useState(
    !!localStorage.getItem(LS_LOCKED_VENUE_KEY)
  );

  /* ───────────────────────── Starred Shelf ───────────────────────── */

const LS_STARRED_KEY = "venueStarred";

const [starredSlugs, setStarredSlugs] = useState<string[]>([]);

const readStarredFromLocalStorage = (): string[] => {
  try {
    const raw = localStorage.getItem(LS_STARRED_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    const arr = Array.isArray(parsed)
      ? (parsed as unknown[]).filter(
          (v): v is string => typeof v === "string" && v.trim().length > 0
        )
      : [];

    // de-dupe
    return Array.from(new Set(arr));
  } catch {
    return [];
  }
};

// initial load
useEffect(() => {
  setStarredSlugs(readStarredFromLocalStorage());
}, []);

// live updates (when CastleModal stars/unstars)
useEffect(() => {
  const onStarredUpdated = (e: Event) => {
    const ce = e as CustomEvent;
    const nextFromEvent = ce?.detail?.starred;

    // Prefer payload if present, otherwise re-read localStorage
    if (Array.isArray(nextFromEvent)) {
      const clean = nextFromEvent.filter(
        (v: unknown): v is string => typeof v === "string" && v.trim().length > 0
      );
      setStarredSlugs(Array.from(new Set(clean)));
    } else {
      setStarredSlugs(readStarredFromLocalStorage());
    }
  };

  window.addEventListener("venueStarredUpdated", onStarredUpdated as EventListener);
  return () => {
    window.removeEventListener("venueStarredUpdated", onStarredUpdated as EventListener);
  };
}, []);

  useEffect(() => {
    localStorage.setItem("venueRankerCheckpoint", "scroll-of-possibilities");
  
    // Pull persisted date + guests (kept as-is)
    const storedDate = localStorage.getItem(LS_DATE_KEY);
    const storedGuests = localStorage.getItem(LS_GUESTS_KEY);
    if (storedDate) setWeddingDate(storedDate);
    if (storedGuests) setGuestCount(parseInt(storedGuests));

      // ✅ DIRECT BOOKING MODE: only show the locked venue
  const lockedVenue = localStorage.getItem(LS_LOCKED_VENUE_KEY);
  if (lockedVenue) {
    setAvailableVenues([lockedVenue]);

    // Load venue details for CastleModal
    (async () => {
      try {
        const venueRef = doc(db, "venues", lockedVenue);
        const vsnap = await getDoc(venueRef);
        if (vsnap.exists()) {
          setVenueDetails({ [lockedVenue]: vsnap.data() });
        }
      } catch {}
    })();

    return;
  }
  
    const fetchVenueSelections = async () => {
      // 0) Fast path: cached selected slugs from a previous visit
try {
  const cached = localStorage.getItem(LS_SELECTED_KEY);
  if (cached) {
    const arr = JSON.parse(cached);

    // ✅ Guard: if the cache is suspiciously only 1 venue, don't trust it.
    // This prevents stale direct-booking overwrites from breaking explore mode.
    if (Array.isArray(arr) && arr.length > 1) {
      setAvailableVenues(arr);

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
      return;
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

  useEffect(() => {
    // ✅ If the user just created/logged into an account from a castle action,
    // reopen that same castle modal ONCE so they continue the flow.
    try {
      const raw = localStorage.getItem("wd_pendingVenueBooking");
      if (!raw) return;
  
      const pending = JSON.parse(raw) as {
        venueSlug?: string;
        intent?: "contract" | "manual_confirm";
      };
  
      const slug = pending?.venueSlug;
      if (!slug) return;
  
      // ✅ Open the same castle modal again
      setModalVenue(slug);
  
      // ✅ If it was a manual-confirm venue, auto-open that confirm inside the modal
      const shouldAutoOpen = pending.intent === "manual_confirm";
      setAutoOpenManualConfirm(shouldAutoOpen);
  
      // ✅ CONSUME-ONCE: clear resume tokens so the modal doesn't reopen forever
      localStorage.removeItem("wd_pendingVenueBooking");
      localStorage.removeItem("wd_openCastleAfterAuth");
      localStorage.removeItem("wd_openManualConfirmAfterAuth");
    } catch (e) {
      console.warn("Could not resume pending venue booking:", e);
    }
  }, []);

  useEffect(() => {
    try {
      const slug = localStorage.getItem("wd_openCastleAfterAuth");
      if (!slug) return;
  
      const manual = localStorage.getItem("wd_openManualConfirmAfterAuth") === "true";
  
      setModalVenue(slug);
      setAutoOpenManualConfirm(manual);
  
      // ✅ CRITICAL: clear immediately so it only happens once
      localStorage.removeItem("wd_openCastleAfterAuth");
      localStorage.removeItem("wd_openManualConfirmAfterAuth");
    } catch (e) {
      console.warn("Could not open castle after auth:", e);
    }
  }, []);


  const handleVenueClick = (venue: string) => setModalVenue(venue);
  const closeModal = () => setModalVenue(null);

  const handleBookIt = async (_venueId: string) => {
    // no-op now — booking/locking happens inside CastleModal
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
  
    // ✅ store plain ISO date
    localStorage.setItem("venueWeddingDate", weddingDate);
  
    localStorage.setItem("venueGuestCount", String(guestCount));
    localStorage.setItem("venuePrice", String(price));
  
    setCurrentScreen("venuecontract");
  };
  
  const starredOnThisScroll = starredSlugs.filter((slug) =>
    availableVenues.includes(slug)
  );
  
  const unstarredVenues = availableVenues.filter(
    (slug) => !starredOnThisScroll.includes(slug)
  );

  useEffect(() => {
    ph("vr_scroll_viewed", {
      device,
      is_logged_in: !!auth.currentUser,
      source: "venueRanker",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

<SaveProgressMini onClick={onSaveProgress} />
        {/* Copy */}
        <p className="scroll-explainer-text" style={{ fontSize: "1.05rem", fontWeight: 600 }}>
  {isDirectBooking
    ? "✨ Your venue awaits! Click the castle below to review details and make it official."
    : "✨ Your magical matches are ready! Click any castle below to explore and compare."}
</p>

{!isDirectBooking && (
  <p
    className="scroll-explainer-text"
    style={{
      fontSize: "0.95rem",
      color: "#555",
      marginTop: "-6px",
    }}
  >
    💡 <strong>Madge Tip:</strong> Each castle prices things a little differently —
    check <strong>Castle Considerations</strong> inside any venue for the full scoop.
  </p>
)}

{/* ───────────────────────── Starred Shelf UI ───────────────────────── */}
{(() => {
  // Only show starred venues that are actually in the current scroll list
  const starredOnThisScroll = starredSlugs.filter((slug) =>
    availableVenues.includes(slug)
  );

  if (starredOnThisScroll.length === 0) return null;

  return (
    <div
    style={{
      margin: "0 0 1.25rem",
      padding: "1.15rem 1rem 1.25rem",
      borderRadius: 20,
      background: "#fff",
    
      // ✨ soft magical glow only (no solid line)
      boxShadow: `
        0 0 22px rgba(120,190,255,0.35),
        0 0 44px rgba(120,190,255,0.25),
        0 0 72px rgba(120,190,255,0.18)
      `,
    }}
    >
      {/* Banner */}
      <div style={{ textAlign: "center", marginBottom: 10 }}>
        <img
          src={`${import.meta.env.BASE_URL}assets/images/starred_banner.png`}
          alt="Starred"
          style={{
            width: "min(340px, 78%)",
            height: "auto",
            display: "inline-block",
          }}
        />
      </div>

      {/* Starred castles */}
      <div className="venue-grid" style={{ marginTop: 6 }}>
        {starredOnThisScroll.map((venue) => (
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

      <div
        style={{
          marginTop: 10,
          fontSize: 13,
          color: "#666",
          textAlign: "center",
        }}
      >
        Unstar a venue and it’ll hop back into the main list ✨
      </div>
    </div>
  );
})()}

        {/* 🏰 Castles */}
        <div className="venue-grid">
        {(isDirectBooking ? availableVenues : unstarredVenues).map((venue) => (
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
      onClose={() => {
        closeModal();
        setAutoOpenManualConfirm(false);
      }}
      onBook={(slug: string) => handleBookIt(slug)}
      handleStartContract={handleStartContract}
      requireAuthForBooking={(intent: "venuecontract" | "manual") =>
        requireAuthForCastleBooking(modalVenue, intent)
      }
      onBackToIntro={onBackToIntro}
      autoOpenManualConfirm={autoOpenManualConfirm}
      setAutoOpenManualConfirm={setAutoOpenManualConfirm}
    />
  </div>
)}

        {/* 🔙 Back */}
        <div style={{ textAlign: "center", marginTop: "1.5rem" }}>
        <button
  className="boutique-back-btn"
  onClick={() => {
    const locked = localStorage.getItem(LS_LOCKED_VENUE_KEY);

    setCurrentIndex(0);
    localStorage.removeItem("venueRankerCheckpoint");

    // ✅ If they were in direct-booking mode, a “Back to the beginning”
    // must wipe the lock + cached venue selections so ranker can run fresh.
    if (locked) {
      resetVenueRankerSession();
      setIsDirectBooking(false);
      setCurrentScreen("intro");
      return;
    }

    setCurrentScreen("vibe");
  }}
>
    {localStorage.getItem(LS_LOCKED_VENUE_KEY)
      ? "← Back to the beginning"
      : "← Back to Vibes"}
  </button>
</div>
      </div>
    </div>
  );
};

export default ScrollofPossibilities;