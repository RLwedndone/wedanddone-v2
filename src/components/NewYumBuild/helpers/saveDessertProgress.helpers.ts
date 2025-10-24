import { getAuth, onAuthStateChanged } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { db } from "../../../firebase/firebaseConfig";

/**
 * Save dessert flow progress (step or input) for both guest and logged-in users
 */
export const saveDessertProgress = async ({
  key,
  value,
  stepValue = null,
}: {
  key: string;
  value: any;
  stepValue?: string | null;
}) => {
  // Always save to localStorage
  localStorage.setItem(key, typeof value === "string" ? value : JSON.stringify(value));
  if (stepValue) {
    localStorage.setItem("yumStep", stepValue);
  }

  // If user is logged in, save to Firestore too
  onAuthStateChanged(getAuth(), async (user) => {
    if (user) {
      try {
        const userRef = doc(db, "users", user.uid);
        const dessertRef = doc(db, "users", user.uid, "yumYumData", "dessertData");

        await setDoc(
          dessertRef,
          { [key]: value },
          { merge: true }
        );

        if (stepValue) {
          await setDoc(
            userRef,
            {
              progress: {
                yumYum: {
                  step: stepValue,
                },
              },
            },
            { merge: true }
          );
        }
      } catch (err) {
        console.error("❌ Error saving dessert progress:", err);
      }
    }
  });
};