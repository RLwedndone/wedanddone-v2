// src/utils/venueAvailability.ts
import { db } from "../firebase/firebaseConfig";
import {
  doc,
  getDoc,
  updateDoc,
  arrayUnion,
} from "firebase/firestore";

/**
 * Safely append a newly-booked date to a venue's bookedDates array.
 * Called AFTER successful Stripe checkout.
 *
 * Preconditions:
 * - User is authenticated
 * - Checkout succeeded
 * - weddingDate is a "YYYY-MM-DD" string
 */
export async function markVenueDateUnavailable(params: {
  venueSlug: string;
  weddingDate: string;
  bookingId: string; // we generate this in VenueCheckOut
}): Promise<void> {
  const { venueSlug, weddingDate, bookingId } = params;

  // 1. Guard: if there's no date, do nothing
  if (!weddingDate || weddingDate.trim() === "") {
    console.warn(
      "[markVenueDateUnavailable] No weddingDate, skipping venue block"
    );
    return;
  }

  // 2. weddingDate is already "YYYY-MM-DD" from localStorage / contract.
  // No attempt to re-parse -> avoids NaN-NaN-NaN
  const finalDate = weddingDate.trim();

  try {
    const venueRef = doc(db, "venues", venueSlug);
    const snap = await getDoc(venueRef);

    if (!snap.exists()) {
      console.error(
        "[markVenueDateUnavailable] Venue doc does not exist:",
        venueSlug
      );
      return;
    }

    // 3. Append to bookedDates array on the venue doc
    await updateDoc(venueRef, {
      bookedDates: arrayUnion(finalDate),
      // optional: you COULD write lastBookingId if you want traceability
      lastBookingId: bookingId,
    });

    console.log(
      `[markVenueDateUnavailable] ✅ Added ${finalDate} to venues/${venueSlug}.bookedDates`
    );
  } catch (err) {
    console.error(
      "[markVenueDateUnavailable] ❌ Firestore write failed:",
      err
    );
    throw err;
  }
}