// src/components/MenuScreens/Bookings.tsx
import React, { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../../firebase/firebaseConfig";

type BoutiqueKey =
  | "venue"
  | "photography"
  | "floral"
  | "planner"
  | "catering"
  | "desserts"
  | "jam";

interface BookingsScreenProps {
  onClose: () => void;
  onLaunchBoutique?: (
    type: "venueRanker" | "photo" | "floral" | "planner" | "yumyum" | "jam",
    startAt?: string
  ) => void;
  /** Optional override; defaults to your cobbles PNG */
  backgroundSrc?: string;
}

type BookingsFirestore = Partial<{
  venue: boolean;
  photography: boolean;
  floral: boolean;
  planner: boolean;
  catering: boolean;
  dessert: boolean; // Firestore may be singular
  jam: boolean;
  venueSlug: string;
}>;

/** Toggle debug with: localStorage.setItem('hotspotDebug','true'|'false') */
const useDebugBoxes = () => {
  const [debug, setDebug] = useState(false);
  useEffect(() => {
    setDebug(localStorage.getItem("hotspotDebug") === "true");
  }, []);
  return debug;
};

/** Completed buttons (same art you’re already using) */
const COMPLETED_BUTTON: Record<BoutiqueKey, string> = {
  floral: `${import.meta.env.BASE_URL}assets/images/completed_floral_button.png`,
  photography: `${import.meta.env.BASE_URL}assets/images/completed_photo_button.png`,
  catering: `${import.meta.env.BASE_URL}assets/images/completed_catering_button.png`, // ⬅️ specific
  venue: `${import.meta.env.BASE_URL}assets/images/completed_venue_button.png`,
  planner: `${import.meta.env.BASE_URL}assets/images/completed_planner_button.png`,
  desserts: `${import.meta.env.BASE_URL}assets/images/completed_dessert_button.png`,  // ⬅️ specific
  jam: `${import.meta.env.BASE_URL}assets/images/completed_jam_button.png`,
};

/** Small icons shown at the top of the explainer modal */
const MODAL_ICON: Record<BoutiqueKey, string> = {
  venue: `${import.meta.env.BASE_URL}assets/images/BookingIcons/venue.png`,
  photography: `${import.meta.env.BASE_URL}assets/images/BookingIcons/photography.png`,
  floral: `${import.meta.env.BASE_URL}assets/images/BookingIcons/florist.png`,
  planner: `${import.meta.env.BASE_URL}assets/images/BookingIcons/planner.png`,
  catering: `${import.meta.env.BASE_URL}assets/images/BookingIcons/catering.png`,
  desserts: `${import.meta.env.BASE_URL}assets/images/BookingIcons/desserts.png`,
  jam: `${import.meta.env.BASE_URL}assets/images/BookingIcons/DJ.png`,
};

/** Button copy in the modal (“Go to the ___”) */
const BOUTIQUE_NAME: Record<BoutiqueKey, string> = {
  venue: "Venue Ranker",
  photography: "Photo Styler",
  floral: "Floral Picker",
  planner: "Pixie Planner",
  catering: "Yum Yum (Catering)",
  desserts: "Yum Yum (Desserts)",
  jam: "Jam Groove",
};

/** Why-book-now blurbs */
const EXPLAINER: Record<BoutiqueKey, string> = {
  venue:
    "✨ Venues are the crown jewel of your wedding day! They often book out a year (sometimes even a year and a half!) in advance. Snagging your venue first sets your date, defines your style, and unlocks the rules and menus that all your other vendors will follow. 🏰",
  photography:
    "📸 Great photographers go fast! Booking them earlier means your love story will be captured in perfect Wed&Done style, with a timeline built around your venue and vision. No blurry regrets here—only magical memories. ✨",
  floral:
    "🌸 Flowers tie the whole look together! Booking your florist early gives them time to dream, plan, and order seasonal blooms that match your vibe. Wed&Done magic means no wilted surprises—just picture-perfect petals.",
  planner:
    "💫 A planner sprinkles pixie dust over the whole process! With Wed&Done, full planning is included when you book any venue through us. Your planner will wrangle vendors, timelines, and logistics—keeping everything stress-free.",
  catering:
    "🍴 Food is the heart of the party! Catering gets booked a little later in the journey—closer to when RSVPs are in and guest counts are locked. That way, every guest has a seat and a plate of deliciousness waiting for them.",
  desserts:
    "🍰 Sweet treats are the grand finale! Like catering, desserts get booked later—once your RSVPs are in and guest counts are set. That way, your cake, cupcakes, and goodies match your final numbers without a sugar scramble. 🎂",
  jam:
    "🎶 Music sets the mood and keeps the dance floor hopping! We book DJs after your venue and main vendors are secured, so we know travel fees and coordination details. Your MC will work hand-in-hand with your venue and planner for a seamless celebration. 🕺✨",
};

/** Hotspot positions (percentages). Adjust these to your baked PNG. */
const HOTSPOTS: Array<{
  id: BoutiqueKey;
  top: number; // %
  left: number; // %
  width: number; // %
  height: number; // %
}> = [
  { id: "venue", top: 16, left: 52, width: 20, height: 15 },
  { id: "photography", top: 27, left: 78, width: 24, height: 10 },
  { id: "floral", top: 34, left: 33, width: 28, height: 11 },
  { id: "jam", top: 49, left: 72, width: 28, height: 13 },
  { id: "catering", top: 66, left: 48, width: 30, height: 12 },
  { id: "desserts", top: 87, left: 48, width: 30, height: 12 },
];

/** Map booking key -> overlay type + (optional) startAt */
const LAUNCH_MAP: Record<
  BoutiqueKey,
  {
    type:
      | "venueRanker"
      | "photo"
      | "floral"
      | "planner"
      | "yumyum"
      | "jam";
    startAt?: string;
  }
> = {
  venue: { type: "venueRanker" },
  photography: { type: "photo" },
  floral: { type: "floral" },
  planner: { type: "planner" },
  catering: { type: "yumyum" },
desserts: { type: "yumyum" },
  jam: { type: "jam" },
};

const Bookings: React.FC<BookingsScreenProps> = ({
  onClose,
  onLaunchBoutique,
  backgroundSrc = `${import.meta.env.BASE_URL}assets/images/BookingIcons/cobbles.png`,
}) => {
  const debug = useDebugBoxes();

  const [bookings, setBookings] = useState<BookingsFirestore>({});
  const [modalKey, setModalKey] = useState<BoutiqueKey | null>(null);

  // Normalize “desserts” UI key to Firestore “dessert” and only
  // use LS fallbacks for Catering/Desserts (not other stones).
  const isBooked = (key: BoutiqueKey) => {
    // Firestore truth
    const fsKey = key === "desserts" ? "dessert" : key; // FS uses singular "dessert"
    const fromFS = Boolean((bookings as any)?.[fsKey]);

    // LocalStorage fallbacks ONLY for catering/desserts
const scanForBookedFlag = (regex: RegExp) => {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i) || "";
      if (regex.test(k) && localStorage.getItem(k) === "true") return true;
    }
  } catch {}
  return false;
};

if (key === "catering") {
  const fromLS =
    localStorage.getItem("yumCateringBooked") === "true" ||
    localStorage.getItem("yumBookedCatering") === "true" ||
    localStorage.getItem("schnepfCateringBooked") === "true" ||
    localStorage.getItem("vvCateringBooked") === "true" ||
    localStorage.getItem("batesCateringBooked") === "true" ||
    // generic catch-all like "*CateringBooked"
    scanForBookedFlag(/cateringBooked$/i);

  return fromFS || fromLS;
}

if (key === "desserts") {
  const fromLS =
    localStorage.getItem("yumDessertBooked") === "true" ||
    localStorage.getItem("yumBookedDessert") === "true" ||
    localStorage.getItem("schnepfDessertBooked") === "true" ||
    localStorage.getItem("vvDessertBooked") === "true" ||
    localStorage.getItem("batesDessertBooked") === "true" ||
    // generic catch-all like "*DessertBooked"
    scanForBookedFlag(/dessertBooked$/i);

  return fromFS || fromLS;
}

    // All other stones: rely on Firestore only (unchanged behavior)
    return fromFS;
  };

  const cateringBooked = isBooked("catering");
  const dessertsBooked = isBooked("desserts");

  const isYumModal = modalKey === "catering" || modalKey === "desserts";
  const otherYumBooked =
    modalKey === "catering"
      ? dessertsBooked
      : modalKey === "desserts"
      ? cateringBooked
      : false;

  const bookedLabel = modalKey === "catering" ? "desserts" : "catering";

  const actionLabel =
    modalKey === "catering"
      ? "add your catering menu"
      : "finish your dessert menu";

  // Load bookings from Firestore and keep fresh via window events
  useEffect(() => {
    const load = async () => {
      const u = auth.currentUser;
      if (!u) return;
      const snap = await getDoc(doc(db, "users", u.uid));
      const data = snap.data() || {};
      setBookings(data.bookings || {});
    };

    const unsubAuth = onAuthStateChanged(auth, () => load());
    load();

    const refresh = () => load();
    const evts = [
      "floralCompletedNow",
      "photoCompletedNow",
      "jamCompletedNow",
      "cateringCompletedNow", // ✅ replaces yumCompletedNow
      "dessertCompletedNow",
      "venueCompletedNow",
      "plannerCompletedNow",
    ];
    evts.forEach((e) => window.addEventListener(e, refresh));
    return () => {
      unsubAuth();
      evts.forEach((e) => window.removeEventListener(e, refresh));
    };
  }, []);

  const openModal = (key: BoutiqueKey) => setModalKey(key);
  const closeModal = () => setModalKey(null);

  const goToOverlay = (key: BoutiqueKey) => {
    const target = LAUNCH_MAP[key];
    if (!target) {
      closeModal();
      onClose();
      return;
    }

    // Prefer parent launcher; otherwise dispatch a generic event
    if (onLaunchBoutique) {
      if (key === "catering" || key === "desserts") {
        onLaunchBoutique(target.type); // ✅ let Dashboard/MenuController decide
      } else {
        onLaunchBoutique(target.type, target.startAt);
      }
    } else {
      window.dispatchEvent(
        new CustomEvent("openOverlay", {
          detail: {
            type: target.type,
            startAt: target.startAt || "intro",
          },
        })
      );
    }

    closeModal();
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-label="Your Bookings"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        zIndex: 1000,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        padding: "1rem",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff",
          borderRadius: 24,
          width: "min(560px, 92vw)",
          maxHeight: "92vh",
          padding: "1.25rem 1.25rem 1.75rem",
          boxShadow: "0 12px 40px rgba(0,0,0,0.25)",
          position: "relative",
          overflow: "hidden",

          display: "flex", // make this card a flex column
          flexDirection: "column",
        }}
      >
        {/* Close */}
        <button
          onClick={onClose}
          aria-label="Close"
          style={{
            position: "absolute",
            top: 12,
            right: 12,
            background: "transparent",
            border: "none",
            fontSize: 22,
            cursor: "pointer",
          }}
        >
          ✖
        </button>

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: "0.75rem" }}>
          <h2
            style={{
              fontFamily: "'Jenna Sue', cursive",
              fontSize: "3rem",
              color: "#2c62ba",
              margin: 0,
            }}
          >
            Your Magical Booking Path!
          </h2>
          <p style={{ margin: "0.25rem 0 0.75rem", color: "#444" }}>
            Tap a stone to start checking off your wedding planning
            to-do's!
          </p>
        </div>

        {/* Scrollable image + hotspots */}
        <div
          style={{
            flex: 1, // fill remaining space
            minHeight: 0, // allow child to scroll
            position: "relative",
            maxHeight: "70vh",
            overflowY: "auto",
            WebkitOverflowScrolling: "touch",
            paddingRight: 6,
          }}
        >
          <div
            style={{
              position: "relative",
              width: "100%",
              aspectRatio: "9 / 16",
              borderRadius: 16,
              overflow: "hidden",
              background: "#fff",
            }}
          >
            <img
              src={backgroundSrc}
              alt="Suggested booking path"
              style={{
                width: "100%",
                height: "100%",
                objectFit: "contain",
                display: "block",
                userSelect: "none",
                pointerEvents: "none",
              }}
              draggable={false}
            />

            {/* Hotspots or 'Booked' badges */}
            {HOTSPOTS.map((h) => {
              const booked = isBooked(h.id);

              if (booked) {
                return (
                  <img
                    key={`${h.id}-done`}
                    src={COMPLETED_BUTTON[h.id]}
                    alt={`${BOUTIQUE_NAME[h.id]} booked`}
                    title={`${BOUTIQUE_NAME[h.id]} booked`}
                    style={{
                      position: "absolute",
                      top: `${h.top}%`,
                      left: `${h.left}%`,
                      width: `${h.width}%`,
                      height: "auto",
                      transform: "translate(-50%, -50%)",
                      pointerEvents: "none",
                    }}
                  />
                );
              }

              return (
                <button
                  key={h.id}
                  aria-label={`About ${BOUTIQUE_NAME[h.id]}`}
                  onClick={() => openModal(h.id)}
                  style={{
                    position: "absolute",
                    top: `${h.top}%`,
                    left: `${h.left}%`,
                    width: `${h.width}%`,
                    height: `${h.height}%`,
                    transform: "translate(-50%, -50%)",
                    background: debug
                      ? "rgba(255, 200, 0, 0.25)"
                      : "transparent",
                    border: debug
                      ? "1px dashed #f8b400"
                      : "none",
                    borderRadius: 16,
                    cursor: "pointer",
                  }}
                  title={`Why book ${BOUTIQUE_NAME[h.id]} now?`}
                />
              );
            })}
          </div>
        </div>

        {/* Modal */}
        {modalKey && (
          <div
            onClick={closeModal}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.5)",
              zIndex: 1100,
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              padding: "1rem",
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                background: "#fff",
                borderRadius: 24,
                width: "min(560px, 92vw)",
                maxHeight: "92vh",
                padding: "1.25rem 1.25rem 1.75rem",
                boxShadow:
                  "0 12px 40px rgba(0,0,0,0.25)",
                position: "relative",
                overflow: "hidden",
                textAlign: "center",
              }}
            >
              <button
                onClick={closeModal}
                aria-label="Close"
                style={{
                  position: "absolute",
                  top: 10,
                  right: 10,
                  background: "transparent",
                  border: "none",
                  fontSize: 20,
                  cursor: "pointer",
                }}
              >
                ✖
              </button>

              <img
                src={MODAL_ICON[modalKey]}
                alt={modalKey}
                style={{
                  width: "300px",
                  margin:
                    "0 auto 1rem auto",
                  display: "block",
                }}
              />

              <h3
                style={{
                  margin:
                    "0.25rem 0 0.25rem",
                  color: "#2c62ba",
                  fontFamily:
                    "'Jenna Sue', cursive",
                  fontSize: "1.6rem",
                }}
              >
                {BOUTIQUE_NAME[modalKey]}
              </h3>

              <p
                style={{
                  margin: "0.25rem 0 1rem",
                  color: "#444",
                  lineHeight: 1.5,
                }}
              >
                {EXPLAINER[modalKey]}
              </p>

              {isYumModal && otherYumBooked ? (
                <p
                  style={{
                    margin: "0.5rem 0 0",
                    color: "#444",
                    lineHeight: 1.5,
                    fontWeight: 500,
                  }}
                >
                  You’ve already booked {bookedLabel} in the Yum Yum Guide.{" "}
                  Head back to your dashboard and open Yum Yum to {actionLabel}.
                </p>
              ) : (
                <button
                  onClick={() => goToOverlay(modalKey)}
                  className="boutique-primary-btn"
                  style={{ minWidth: 220 }}
                >
                  Go to the {BOUTIQUE_NAME[modalKey]}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Bookings;