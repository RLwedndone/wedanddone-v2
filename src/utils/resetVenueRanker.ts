// src/utils/resetVenueRanker.ts
export function resetVenueRankerSession() {
    const keysToRemove = [
      // ✅ THIS is the big one causing your issue
      "wd_lockedVenueSlug",
  
      // Ranker step/progress (if you have any of these in play)
      "venueRankerStep",
      "rankerStep",
      "rankerSelectedVenue",
      "selectedVenueSlug",
  
      // Venue booking carry-forward (safe to clear when restarting ranker)
      "venueSlug",
      "venueName",
      "venueWeddingDate",
      "venueGuestCount",
      "venuePrice",
  
      // Contract artifacts (safe to clear when restarting ranker)
      "venueAgreeChecked",
      "venueContractData",
    ];
  
    keysToRemove.forEach((k) => {
      try {
        localStorage.removeItem(k);
      } catch {
        /* ignore */
      }
    });
  }