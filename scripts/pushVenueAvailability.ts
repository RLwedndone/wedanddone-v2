// scripts/pushVenueAvailability.ts

/**
 * Admin-ish sync script you run locally to push our hard-coded
 * venueAvailabilitySeed dates into Firestore.
 *
 * Usage:
 *   npx ts-node scripts/pushVenueAvailability.ts
 *
 * What it does:
 *   For each venueSlug in venueAvailabilitySeed:
 *     - writes a de-duped, sorted array of YYYY-MM-DD strings
 *       to /venues/{slug}.bookedDates in Firestore
 *
 * NOTE:
 *   This is using the normal web Firestore SDK, not firebase-admin.
 *   That means it will only work if your local machine is allowed by
 *   your Firestore security rules to write to /venues/*.
 */

import { initializeApp, type FirebaseApp } from "firebase/app";
import {
  getFirestore,
  doc,
  getDoc,
  updateDoc,
  setDoc,
} from "firebase/firestore";

// ✅ ADD .ts EXTENSIONS so ESM ts-node can resolve them
import { firebaseConfig, db } from "../src/firebase/firebaseConfig.ts";
import { venueAvailabilitySeed } from "../src/data/venueAvailabilitySeed.ts";

// Utility: ensure YYYY-MM-DD stays YYYY-MM-DD
function normalizeDateStr(raw: string): string {
  // handles things like "2026-1-3" or "2026/01/03" or "1/3/2026"
  // but our seed is already clean, so mainly this is a safety net.
  const cleaned = raw.replace(/\./g, "-").replace(/\//g, "-").trim();
  const parts = cleaned.split("-");
  if (parts.length === 3) {
    const [a, b, c] = parts;
    // guess which is year
    if (a.length === 4) {
      // "2026-03-21"
      const yyyy = a;
      const mm = b.padStart(2, "0");
      const dd = c.padStart(2, "0");
      return `${yyyy}-${mm}-${dd}`;
    } else if (c.length === 4) {
      // "3-21-2026"
      const yyyy = c;
      const mm = a.padStart(2, "0");
      const dd = b.padStart(2, "0");
      return `${yyyy}-${mm}-${dd}`;
    }
  }
  // fallback, assume it's already correct
  return cleaned;
}

// Merge, sort, de-dupe dates
function mergeDates(existing: string[], incoming: string[]): string[] {
  const set = new Set<string>();
  existing.forEach((d) => set.add(normalizeDateStr(d)));
  incoming.forEach((d) => set.add(normalizeDateStr(d)));

  // sort ascending by actual date
  return [...set].sort((a, b) => {
    const da = new Date(a + "T12:00:00").getTime();
    const db = new Date(b + "T12:00:00").getTime();
    return da - db;
  });
}

// --- MAIN RUNNER -------------------------------------------------

async function pushAvailability() {
  console.log("🪄 Starting venue availability sync…");

  // sanity check that firebase initialized
  let app: FirebaseApp | null = null;
  try {
    // we ALREADY initialized in firebaseConfig in the app runtime.
    // but if this gets called twice, initializeApp will throw.
    // So we just try/catch a duplicate init. Safe in ts-node runs.
    app = initializeApp(firebaseConfig);
    console.log("✅ Firebase app initialized (fresh).");
  } catch (err: any) {
    // If it's "Firebase App named '[DEFAULT]' already exists" that's fine.
    if (err && err.message && err.message.includes("already exists")) {
      console.log("ℹ️ Firebase app already initialized, continuing.");
    } else {
      console.error("❌ Firebase init error:", err);
      throw err;
    }
  }

  // get Firestore instance (we also imported db already, but this double-checks)
  const firestore = getFirestore();
  console.log("✅ Got Firestore instance.");

  // loop each venue slug in our seed
  for (const [venueSlug, newDates] of Object.entries(venueAvailabilitySeed)) {
    console.log(`\n🏰 Syncing ${venueSlug}…`);

    const venueRef = doc(db, "venues", venueSlug);

    // 1. read current doc
    const snap = await getDoc(venueRef);
    let currentDates: string[] = [];
    if (snap.exists()) {
      const data = snap.data() as any;
      if (Array.isArray(data.bookedDates)) {
        currentDates = data.bookedDates.map((d: any) => String(d)).filter(Boolean);
      }
    } else {
      console.log(`⚠️ /venues/${venueSlug} does NOT exist in Firestore. Creating it.`);
    }

    // 2. merge + sort + dedupe
    const merged = mergeDates(currentDates, newDates);

    // 3. write back
    if (snap.exists()) {
      console.log(
        `→ writing ${merged.length} dates to /venues/${venueSlug}.bookedDates (updateDoc)`
      );
      await updateDoc(venueRef, {
        bookedDates: merged,
      });
    } else {
      console.log(
        `→ writing ${merged.length} dates to /venues/${venueSlug}.bookedDates (setDoc NEW DOC)`
      );
      await setDoc(venueRef, {
        bookedDates: merged,
        isActive: true,
      });
    }

    console.log(`✅ ${venueSlug} done. Sample:`, merged.slice(0, 5), "…");
  }

  console.log("\n🎉 All venues synced. You're good.");
}

// actually run it, and print any fatal errors
pushAvailability()
  .then(() => {
    console.log("✨ Finished without throwing.");
    process.exit(0);
  })
  .catch((err) => {
    console.error("💥 Script crashed:", err);
    process.exit(1);
  });