// src/utils/authHelpers.ts

import { getAuth, GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { db } from "../firebase/firebaseConfig";

export async function handleGoogleSignIn(): Promise<{
    success: boolean;
    error?: string;
  }> {
    const provider = new GoogleAuthProvider();
    const auth = getAuth();
  
    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
  
      if (!user) {
        return { success: false, error: "No user returned from Google sign-in." };
      }
  
      const fullName = user.displayName || "";
      const [firstName, ...rest] = fullName.split(" ");
      const lastName = rest.join(" ") || "";
  
      await setDoc(
        doc(db, "users", user.uid),
        {
          email: user.email || "",
          firstName,
          lastName,
          createdAt: new Date().toISOString(),
        },
        { merge: true }
      );
  
      console.log("✅ Google sign-in success and user data saved.");
      return { success: true };
    } catch (error: any) {
      console.error("❌ Google sign-in failed:", error);
      return { success: false, error: error.message };
    }
  }
