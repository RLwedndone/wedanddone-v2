import { doc, setDoc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../firebase/firebaseConfig";

/**
 * Save a single venue ranking selection.
 * - Logged-in users: Firestore (AND we also mirror to the overlay-friendly structure)
 * - Guests: localStorage
 */
export const saveVenueSelection = async (venueId: string, selection: number) => {
  const user = auth.currentUser;

  // ✅ Guest fallback
  if (!user) {
    try {
      const stored = localStorage.getItem("venueSelections");
      const parsed: Record<string, number> = stored ? JSON.parse(stored) : {};
      parsed[venueId] = selection;
      localStorage.setItem("venueSelections", JSON.stringify(parsed));

      // Optional mirror: also keep overlay-friendly shape for guests
      const rawRanker = localStorage.getItem("venueRankerSelections");
      const ranker = rawRanker ? JSON.parse(rawRanker) : {};
      const next = {
        exploreMode: ranker?.exploreMode ?? "vibe",
        vibeSelections: Array.isArray(ranker?.vibeSelections) ? ranker.vibeSelections : [],
        rankings: { ...(ranker?.rankings ?? {}), [venueId]: selection },
      };
      localStorage.setItem("venueRankerSelections", JSON.stringify(next));
    } catch {}
    return;
  }

  // ✅ Logged-in user
  const docRef = doc(db, "users", user.uid);
  const snap = await getDoc(docRef);

  // Always try to update the two ranking locations:
  // 1) legacy: venueSelections.{venueId}
  // 2) ranker-native: venueRankerSelections.rankings.{venueId}
  if (snap.exists()) {
    await updateDoc(docRef, {
      [`venueSelections.${venueId}`]: selection,
      [`venueRankerSelections.rankings.${venueId}`]: selection,
      "progress.ranker.updatedAt": serverTimestamp(),
    });
  } else {
    // Create doc but DO NOT overwrite anything else later — merge:true
    await setDoc(
      docRef,
      {
        venueSelections: { [venueId]: selection },
        venueRankerSelections: {
          exploreMode: "vibe",
          vibeSelections: [],
          rankings: { [venueId]: selection },
        },
        progress: {
          ranker: { updatedAt: serverTimestamp() },
        },
      },
      { merge: true }
    );
  }

  // Optional: also keep local cache warm for instant UI on refresh
  try {
    const rawRanker = localStorage.getItem("venueRankerSelections");
    const ranker = rawRanker ? JSON.parse(rawRanker) : {};
    const next = {
      exploreMode: ranker?.exploreMode ?? "vibe",
      vibeSelections: Array.isArray(ranker?.vibeSelections) ? ranker.vibeSelections : [],
      rankings: { ...(ranker?.rankings ?? {}), [venueId]: selection },
    };
    localStorage.setItem("venueRankerSelections", JSON.stringify(next));
  } catch {}
};