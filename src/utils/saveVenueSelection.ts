import { doc, setDoc, getDoc, updateDoc } from "firebase/firestore";
import { auth, db } from "../firebase/firebaseConfig";

// 🔧 Update the type to expect number instead of string
export const saveVenueSelection = async (venueId: string, selection: number) => {
  const user = auth.currentUser;

  if (user) {
    const docRef = doc(db, "users", user.uid);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      await updateDoc(docRef, {
        [`venueSelections.${venueId}`]: selection,  // 👈 safely save numeric value
      });
    } else {
      await setDoc(docRef, {
        venueSelections: {
          [venueId]: selection,
        },
      });
    }
  } else {
    // ✅ Fallback to localStorage for guest users
    const storedSelections = localStorage.getItem("venueSelections");
    const parsed: Record<string, number> = storedSelections ? JSON.parse(storedSelections) : {};
    parsed[venueId] = selection;
    localStorage.setItem("venueSelections", JSON.stringify(parsed));
  }
};