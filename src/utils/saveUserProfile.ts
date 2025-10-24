import { doc, setDoc } from "firebase/firestore";
import { db, auth } from "../firebase/firebaseConfig";

export interface UserProfile {
  firstName: string;
  lastName: string;
  email: string;
  password?: string;
  uid?: string;
  budget?: number;
  profileImage?: string;
  fianceFirst?: string;
  fianceLast?: string;
  phone?: string;
  weddingDate?: string;
  dayOfWeek?: string;
  guestCount?: number | null; // ✅ Add this line
}

export const saveUserProfile = async (profile: UserProfile) => {
  try {
    const userId = profile.uid || auth.currentUser?.uid;
    if (!userId) throw new Error("No logged in user");

    const userRef = doc(db, "users", userId);

    const {
      firstName,
      lastName,
      email,
      budget,
      profileImage,
      fianceFirst,
      fianceLast,
      phone,
      weddingDate,
      dayOfWeek,
    } = profile;

    const data: any = {
      firstName,
      lastName,
      email,
      createdAt: new Date().toISOString(),
    };

    if (budget !== undefined) data.budget = budget;
    if (profileImage) data.profileImage = profileImage;
    if (fianceFirst) data.fianceFirst = fianceFirst;
    if (fianceLast) data.fianceLast = fianceLast;
    if (phone) data.phone = phone;
    if (weddingDate) data.weddingDate = weddingDate;
    if (dayOfWeek) data.dayOfWeek = dayOfWeek;
    if (profile.guestCount !== undefined) data.guestCount = profile.guestCount;

    await setDoc(userRef, data, { merge: true });
    console.log("✅ User profile saved:", data);
  } catch (err) {
    console.error("❌ Error saving user profile:", err);
    throw err;
  }
};