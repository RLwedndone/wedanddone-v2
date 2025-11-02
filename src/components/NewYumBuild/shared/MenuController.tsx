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

// Pricing data (for pretty printing venue names)
import { venuePricing } from "../../../data/venuePricing";

interface MenuControllerProps {
  onClose: () => void;
  startAt?: YumStep | BatesStep | EncanterraStep | RubiStep | OcotilloStep;
}

/* ───────────────────────── Helpers ───────────────────────── */

/** normalizeSlug: turns anything into a lowercase, hyphenated slug */
function normalizeSlug(input?: string | null): string {
  return (input || "")
    .toString()
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-") // spaces -> hyphens
    .replace(/[^a-z0-9-]/g, ""); // drop weird punctuation (&, ’, etc)
}

/** normalizeName: lowercase plain name for fuzzy matching */
function normalizeName(input?: string | null): string {
  return (input || "").toString().trim().toLowerCase();
}

/** isVicOrVerrado: true if user's venue is The Vic or Verrado */
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
    [
      "the-vic",
      "vic",
      "the-verrado",
      "verrado",
      "vic-verrado",
      "vicandverrado",
    ].includes(s)
  );

  // name checks
  const nameHit = names.some((n) =>
    [
      "the vic",
      "vic",
      "the verrado",
      "verrado",
      "vic & verrado",
      "vic and verrado",
    ].includes(n)
  );

  return slugHit || nameHit;
}

/* Rubi (Brother John's) detection */
const RUBI_SLUGS = [
  "rubi",
  "rubi-house",
  "rubi-catering",
  "brother-johns",
  "brother-johns-bbq",
  "brother-johns-catering",
  "brotherjohns",
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
    n.includes("brother john’s") ||
    n.includes("brother johns")
  );
}

/* Ocotillo detection */
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
  // be forgiving; "Ocotillo Restaurant & Bar", etc.
  return n.includes("ocotillo");
}

/**
 * Venues that STILL use the shared NoVenueOverlay flow
 * instead of having their own fully custom overlay, and should
 * get the "you already booked your venue" wording and dessert delivery logic.
 *
 * IMPORTANT: all values here must be normalized via normalizeSlug().
 */
const SHARED_FLOW_VENUES = [
  // Desert Foothills (include likely variations)
  "desertfoothills",
  "desert-foothills",
  "desertfoothillsbarn",
  "desert-foothills-barn",
  "desertfoothills-wedding",
  "desert-foothills-wedding",

  // Windmill Winery Lake House
  "lakehouse",
  "lake-house",
  "windmill-lake-house",
  "windmilllakehouse",

  // Windmill Winery Big Red Barn
  "windmillbarn",
  "windmill-barn",
  "big-red-barn",
  "bigredbarn",
  "windmill-big-red-barn",
];

/**
 * Pull the booked venue slug out of user data in a consistent way,
 * then normalize it so we can match it against SHARED_FLOW_VENUES.
 */
function getBookedVenueSlug(data: any): string | null {
  const slugGuess =
    data?.venueSlug ||
    data?.bookings?.venueSlug ||
    data?.venueRankerData?.booking?.venueSlug ||
    data?.selectedVenueSlug ||
    null;

  return slugGuess ? normalizeSlug(slugGuess) : null;
}

/**
 * Turn a slug like "windmillbarn" into something human-facing.
 * Priority:
 * 1. venuePricing[slug].displayName
 * 2. Whatever readable name we saw in Firestore (venueName / selectedVenueName / etc)
 * 3. "your venue"
 */
function friendlyVenueName(slug: string | null, rawUserData: any): string {
  if (slug) {
    const displayName = venuePricing[slug]?.displayName;
    if (displayName) return displayName;
  }

  const guessName =
    rawUserData?.venueName ||
    rawUserData?.bookings?.venueName ||
    rawUserData?.venueRankerData?.booking?.venueName ||
    rawUserData?.selectedVenueName ||
    "";

  if (guessName) return guessName.toString();

  return "your venue";
}

/* ───────────────────────── Component ───────────────────────── */

const MenuController: React.FC<MenuControllerProps> = ({ onClose, startAt }) => {
  const [loading, setLoading] = useState(true);

  // venueSlug is used to route to the right overlay branch
  const [venueSlug, setVenueSlug] = useState<string | null>(null);

  // bookedVenueSlug is our normalized "this is what they actually booked" slug
  // even if we still point them to NoVenueOverlay
  const [bookedVenueSlug, setBookedVenueSlug] = useState<string | null>(null);

  // rawUserData holds the full Firestore snapshot so we can run helper checks
  const [rawUserData, setRawUserData] = useState<any>(null);

  useEffect(() => {
    const auth = getAuth();
    const unsub = onAuthStateChanged(auth, async (user) => {
      try {
        if (!user) {
          setVenueSlug(null);
          setBookedVenueSlug(null);
          setRawUserData(null);
          setLoading(false);
          return;
        }

        const snap = await getDoc(doc(db, "users", user.uid));
        const data = snap.data() || {};

        // normalize the booked venue slug once
        const slugFromData = getBookedVenueSlug(data);

        setVenueSlug(slugFromData);
        setBookedVenueSlug(slugFromData);
        setRawUserData(data);
      } catch (e) {
        console.warn("[MenuController] Failed to load venueSlug:", e);
        setVenueSlug(null);
        setBookedVenueSlug(null);
        setRawUserData(null);
      } finally {
        setLoading(false);
      }
    });

    return () => unsub();
  }, []);

  if (loading) return null;

  /* ───────────────── Routing logic by venue ───────────────── */

  // Bates Mansion branch
  if (venueSlug === "batesmansion") {
    return (
      <BatesOverlay
        onClose={onClose}
        startAt={(startAt as BatesStep) || "intro"}
      />
    );
  }

  // Schnepf Farms branch
  if (
    venueSlug &&
    [
      "themeadow",
      "the-meadow",
      "meadow",
      "farmhouse",
      "the-farmhouse",
      "the-farm-house",
      "farm-house",
      "schnepfbarn",
      "big-red-barn",
      "bigredbarn",
      "schnepf-farms",
      "schnepffarms",
      "schnepf",
    ].includes(venueSlug)
  ) {
    return (
      <SchnepfOverlay
        onClose={onClose}
        startAt={(startAt as any) || "schnepfIntro"}
      />
    );
  }

  // Encanterra branch
  if (venueSlug === "encanterra") {
    return (
      <EncanterraOverlay
        onClose={onClose}
        startAt={(startAt as EncanterraStep) || "intro"}
      />
    );
  }

  // Vic / Verrado branch
  if (rawUserData && isVicOrVerrado(rawUserData)) {
    return <VicVerradoOverlay onClose={onClose} />;
  }

  // Valley Ho by slug
  if (
    venueSlug &&
    ["hotel-valley-ho", "valleyho", "valley-ho", "hotelvalleyho"].includes(
      venueSlug
    )
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
    (
      rawUserData?.venueName ||
      rawUserData?.bookings?.venueName ||
      rawUserData?.venueRankerData?.booking?.venueName ||
      rawUserData?.selectedVenueName ||
      ""
    )
      .toString()
      .trim()
      .toLowerCase();

  if (vhName.includes("valley ho") || vhName.includes("hotel valley ho")) {
    return (
      <ValleyHoOverlay
        onClose={onClose}
        startAt={(startAt as any) || "intro"}
      />
    );
  }

  // Rubi / Brother John's branch (slug first)
  if (isRubiBySlug(venueSlug)) {
    return (
      <RubiOverlay
        onClose={onClose}
        startAt={(startAt as RubiStep) || "intro"}
      />
    );
  }

  // Rubi / Brother John's branch (fallback by name)
  const venueNameAll = (
    rawUserData?.venueName ||
    rawUserData?.bookings?.venueName ||
    rawUserData?.venueRankerData?.booking?.venueName ||
    rawUserData?.selectedVenueName ||
    ""
  ).toString();

  if (isRubiByName(venueNameAll)) {
    return (
      <RubiOverlay
        onClose={onClose}
        startAt={(startAt as RubiStep) || "intro"}
      />
    );
  }

  // Tubac branch (slug)
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
    return (
      <TubacOverlay
        onClose={onClose}
        startAt={(startAt as any) || "intro"}
      />
    );
  }

  // Tubac branch (fallback by name)
  const venueNameLower =
    (
      rawUserData?.venueName ||
      rawUserData?.bookings?.venueName ||
      rawUserData?.venueRankerData?.booking?.venueName ||
      rawUserData?.selectedVenueName ||
      ""
    )
      .toString()
      .trim()
      .toLowerCase();

  if (venueNameLower.includes("tubac")) {
    return (
      <TubacOverlay
        onClose={onClose}
        startAt={(startAt as any) || "intro"}
      />
    );
  }

  // Ocotillo branch (slug)
  if (isOcotilloBySlug(venueSlug)) {
    return (
      <OcotilloOverlay
        onClose={onClose}
        startAt={(startAt as OcotilloStep) || "intro"}
      />
    );
  }

  // Ocotillo branch (name fallback)
  const ocotilloNameGuess = (
    rawUserData?.venueName ||
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

  /* ───────────────── Shared / default path ─────────────────
     If we get here, we're showing the generic NoVenueOverlay.
     BUT we might actually already know their venue, and that venue
     might be one of the "shared flow" venues (Desert Foothills,
     Windmill Lake House, Windmill Barn, etc.) that reuse this overlay.

     In that case we want:
     - different intro text ("Get ready to experience deliciousness! ... for <VenueName>")
     - contract wording that assumes we're serving/delivering there
     - dessert delivery fee logic to know it's this venue
  */

  const isSharedFlowBookedVenue =
    bookedVenueSlug != null &&
    SHARED_FLOW_VENUES.includes(bookedVenueSlug);

  const bookedVenuePrettyName = friendlyVenueName(
    bookedVenueSlug,
    rawUserData
  );

  // Default / guests / shared-flow venues → generic overlay with context
  return (
    <NoVenueOverlay
      onClose={onClose}
      startAt={(startAt as YumStep) || "intro"}
      isSharedFlowBookedVenue={isSharedFlowBookedVenue}
      bookedVenueSlug={bookedVenueSlug}
      bookedVenueName={bookedVenuePrettyName}
    />
  );
};

export default MenuController;