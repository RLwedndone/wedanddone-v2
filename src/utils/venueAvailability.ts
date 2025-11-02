// src/utils/venueAvailability.ts
// helper we call after successful venue checkout
// this writes the wedding date into /venues/{slug}.bookedDates

import {
    doc,
    getDoc,
    setDoc,
    updateDoc,
    arrayUnion,
  } from "firebase/firestore";
  import { db } from "../firebase/firebaseConfig";
  
  /**
   * markVenueDateUnavailable
   *
   * After someone books a venue, we call this ONCE.
   * It adds the booked date into /venues/{venueSlug}.bookedDates
   * (which CastleModal reads to block that date for future users).
   *
   * We also pass bookingId so later we could audit who blocked it.
   */
  export async function markVenueDateUnavailable(opts: {
    venueSlug: string;
    weddingDate: string; // "YYYY-MM-DD"
    bookingId?: string;  // optional metadata
  }): Promise<void> {
    const { venueSlug, weddingDate, bookingId } = opts;
  
    // guard: we MUST have both
    if (!venueSlug || !weddingDate) {
      console.warn(
        "[markVenueDateUnavailable] Missing venueSlug or weddingDate, skipping."
      );
      return;
    }
  
    // normalize date -> YYYY-MM-DD
    // (if someone passed "2026-03-09T12:00:00", trim it)
    const finalDate = weddingDate.includes("T")
      ? weddingDate.split("T")[0]
      : weddingDate;
  
    const venueRef = doc(db, "venues", venueSlug);
  
    // 1. read existing doc
    const snap = await getDoc(venueRef);
  
    if (!snap.exists()) {
      // venue doc doesn't exist yet → create it with bookedDates array
      console.warn(
        `[markVenueDateUnavailable] /venues/${venueSlug} did not exist. Creating it.`
      );
      await setDoc(venueRef, {
        bookedDates: [finalDate],
        lastUpdatedByBookingId: bookingId || null,
        lastUpdatedAt: new Date().toISOString(),
      });
      console.log(
        `[markVenueDateUnavailable] ✅ Created /venues/${venueSlug} with first booked date ${finalDate}`
      );
      return;
    }
  
    // 2. merge into existing array
    // we use arrayUnion so we don't duplicate or overwrite
    await updateDoc(venueRef, {
      bookedDates: arrayUnion(finalDate),
      lastUpdatedByBookingId: bookingId || null,
      lastUpdatedAt: new Date().toISOString(),
    });
  
    console.log(
      `[markVenueDateUnavailable] ✅ Added ${finalDate} to /venues/${venueSlug}.bookedDates`
    );
  }