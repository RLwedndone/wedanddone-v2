// src/components/NewYumBuild/shared/MenuController.tsx
import React, { useEffect, useState } from "react";
import { onAuthStateChanged, getAuth } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../../firebase/firebaseConfig";
import SchnepfOverlay from "../CustomVenues/SchnepfFarms/SchnepfOverlay";

// Overlays
import NoVenueOverlay from "../shared/NoVenueOverlay";
import BatesOverlay from "../CustomVenues/Bates/BatesOverlay";
import VicVerradoOverlay from "../CustomVenues/VicandVerrado/VicVerradoOverlay";
import EncanterraOverlay from "../CustomVenues/Encanterra/EncanterraOverlay";
import TubacOverlay from "../CustomVenues/Tubac/TubacOverlay";
import ValleyHoOverlay from "../CustomVenues/ValleyHo/ValleyHoOverlay";
import RubiOverlay, { type RubiStep } from "../CustomVenues/Rubi/RubiOverlay";
import OcotilloOverlay, {
  type OcotilloStep,
} from "../CustomVenues/Ocotillo/OcotilloOverlay";

// Steps
import type { YumStep } from "../yumTypes";
import type { BatesStep } from "../CustomVenues/Bates/BatesOverlay";
import type { EncanterraStep } from "../CustomVenues/Encanterra/EncanterraOverlay";

interface MenuControllerProps {
  onClose: () => void;
  startAt?: YumStep | BatesStep | EncanterraStep | RubiStep | OcotilloStep;
}

// defensively normalize values we might read from Firestore
function normalizeSlug(input?: string | null): string {
  return (input || "").toString().trim().toLowerCase().replace(/\s+/g, "-");
}
function normalizeName(input?: string | null): string {
  return (input || "").toString().trim().toLowerCase();
}

// true if the user's venue is The Vic or The Verrado
function isVicOrVerrado(data: any): boolean {
  const fields = [
    data?.venueSlug,
    data?.bookings?.venueSlug,
    data?.venueRankerData?.booking?.venueSlug,
  ].map(normalizeSlug);

  const names = [
    data?.venueName,
    data?.bookings?.venueName,
    data?.venueRankerData?.booking?.venueName,
    data?.selectedVenueName,
  ].map(normalizeName);

  // slug checks
  const slugHit = fields.some((s) =>
    ["the-vic", "vic", "the-verrado", "verrado", "vic-verrado", "vicandverrado"].includes(s)
  );

  // name checks
  const nameHit = names.some((n) =>
    ["the vic", "vic", "the verrado", "verrado", "vic & verrado", "vic and verrado"].includes(n)
  );

  return slugHit || nameHit;
}

// ✅ NEW: helpers for Rubi (Brother John’s) detection
const RUBI_SLUGS = [
  "rubi", "rubi-house", "rubi-catering", "brother-johns",
  "brother-johns-bbq", "brother-johns-catering", "brotherjohns",
];
function isRubiBySlug(slug?: string | null) {
  const s = normalizeSlug(slug);
  return RUBI_SLUGS.includes(s);
}
function isRubiByName(name?: string | null) {
  const n = normalizeName(name);
  return (
    n.includes("rubi") ||
    n.includes("brother john") ||
    n.includes("brother john’s") || // curly apostrophe variant
    n.includes("brother johns")
  );
}

// ✅ NEW: helpers for Ocotillo detection
const OCOTILLO_SLUGS = [
  "ocotillo",
  "ocotillo-restaurant",
  "ocotillo-venue",
  "ocotillo-catering",
  "ocotillo-az",
];

function isOcotilloBySlug(slug?: string | null) {
  const s = normalizeSlug(slug);
  return OCOTILLO_SLUGS.includes(s);
}

function isOcotilloByName(name?: string | null) {
  const n = normalizeName(name);
  // let’s be forgiving because venues might come through like "Ocotillo Restaurant & Bar"
  return n.includes("ocotillo");
}

const MenuController: React.FC<MenuControllerProps> = ({ onClose, startAt }) => {
  const [loading, setLoading] = useState(true);
  const [venueSlug, setVenueSlug] = useState<string | null>(null);
  const [rawUserData, setRawUserData] = useState<any>(null);

  useEffect(() => {
    const auth = getAuth();
    const unsub = onAuthStateChanged(auth, async (user) => {
      try {
        if (!user) {
          setVenueSlug(null);
          setRawUserData(null);
          return;
        }
        const snap = await getDoc(doc(db, "users", user.uid));
        const data = snap.data() || {};

        // Prefer explicit slug if present
        const slug: string | null =
          data?.venueSlug ||
          data?.bookings?.venueSlug ||
          (data?.venueRankerData?.booking?.venueSlug ?? null);

        setVenueSlug(slug ? String(slug).toLowerCase() : null);
        setRawUserData(data);
      } catch (e) {
        console.warn("[MenuController] Failed to load venueSlug:", e);
        setVenueSlug(null);
        setRawUserData(null);
      } finally {
        setLoading(false);
      }
    });
    return () => unsub();
  }, []);

  if (loading) return null;

  // 🔀 Route by venue
  if (venueSlug === "batesmansion") {
    return <BatesOverlay onClose={onClose} startAt={(startAt as BatesStep) || "intro"} />;
  }

  // Schnepf Farms branch
  if (
    venueSlug &&
    [
      "themeadow",
      "farmhouse",
      "schnepfbarn",
      "schnepf-farms",
      "schnepffarms",
      "schnepf",
      "the-meadow",
      "meadow",
      "the-farmhouse",
      "the-farm-house",
      "farm-house",
      "big-red-barn",
    ].includes(venueSlug)
  ) {
    return <SchnepfOverlay onClose={onClose} startAt={(startAt as any) || "schnepfIntro"} />;
  }

  // NEW: Encanterra branch (Firestore venue id = "encanterra")
  if (venueSlug === "encanterra") {
    return (
      <EncanterraOverlay
        onClose={onClose}
        startAt={(startAt as EncanterraStep) || "intro"}
      />
    );
  }

  // Vic/Verrado branch
  if (rawUserData && isVicOrVerrado(rawUserData)) {
    return <VicVerradoOverlay onClose={onClose} />;
  }

  // Valley Ho by slug
  if (
    venueSlug &&
    ["hotel-valley-ho", "valleyho", "valley-ho", "hotelvalleyho"].includes(venueSlug)
  ) {
    return (
      <ValleyHoOverlay
        onClose={onClose}
        startAt={(startAt as any) || "intro"}
      />
    );
  }

  // Valley Ho by name (fallback)
  const vhName =
    (rawUserData?.venueName ||
      rawUserData?.bookings?.venueName ||
      rawUserData?.venueRankerData?.booking?.venueName ||
      rawUserData?.selectedVenueName ||
      ""
    ).toString().trim().toLowerCase();

  if (vhName.includes("valley ho") || vhName.includes("hotel valley ho")) {
    return (
      <ValleyHoOverlay
        onClose={onClose}
        startAt={(startAt as any) || "intro"}
      />
    );
  }

  // ✅ NEW: Rubi (Brother John’s) by slug first…
  if (isRubiBySlug(venueSlug)) {
    return <RubiOverlay onClose={onClose} startAt={(startAt as RubiStep) || "intro"} />;
  }

  // …then by name if slug is missing/unknown
  const venueNameAll =
    (rawUserData?.venueName ||
      rawUserData?.bookings?.venueName ||
      rawUserData?.venueRankerData?.booking?.venueName ||
      rawUserData?.selectedVenueName ||
      ""
    ).toString();

  if (isRubiByName(venueNameAll)) {
    return <RubiOverlay onClose={onClose} startAt={(startAt as RubiStep) || "intro"} />;
  }

  // NEW: Tubac branch
  if (
    venueSlug &&
    [
      "tubac",
      "tubacgolfresort",
      "tubac-golf-resort",
      "tubac-resort",
      "tubacgolf",
    ].includes(venueSlug)
  ) {
    return <TubacOverlay onClose={onClose} startAt={(startAt as any) || "intro"} />;
  }

  // Fallback by name if slug is missing but name is present
  const venueName =
    (rawUserData?.venueName ||
      rawUserData?.bookings?.venueName ||
      rawUserData?.venueRankerData?.booking?.venueName ||
      rawUserData?.selectedVenueName ||
      ""
    ).toString().trim().toLowerCase();

  if (venueName.includes("tubac")) {
    return <TubacOverlay onClose={onClose} startAt={(startAt as any) || "intro"} />;
  }

    // ✅ NEW: Ocotillo by slug first…
    if (isOcotilloBySlug(venueSlug)) {
      return (
        <OcotilloOverlay
          onClose={onClose}
          startAt={(startAt as OcotilloStep) || "intro"}
        />
      );
    }
  
    // …then by name if slug is missing/unknown
    const ocotilloNameGuess =
      (rawUserData?.venueName ||
        rawUserData?.bookings?.venueName ||
        rawUserData?.venueRankerData?.booking?.venueName ||
        rawUserData?.selectedVenueName ||
        ""
      ).toString();
  
    if (isOcotilloByName(ocotilloNameGuess)) {
      return (
        <OcotilloOverlay
          onClose={onClose}
          startAt={(startAt as OcotilloStep) || "intro"}
        />
      );
    }

  // Default / guests / unknown venue → generic flow
  return <NoVenueOverlay onClose={onClose} startAt={(startAt as YumStep) || "intro"} />;
};

export default MenuController;