// src/utils/saveRankerProgress.ts
import { doc, setDoc } from "firebase/firestore";
import { db, auth } from "../firebase/firebaseConfig";

export const saveRankerProgress = async (screenId: string) => {
  const user = auth.currentUser;
  if (!user) {
    console.warn("No user logged in — skipping ranker progress save.");
    return;
  }

  const userRef = doc(db, "users", user.uid);
  try {
    await setDoc(userRef, { rankerProgress: screenId }, { merge: true });
    console.log(`✅ Ranker progress saved: ${screenId}`);
  } catch (error) {
    console.error("❌ Error saving ranker progress:", error);
  }
};