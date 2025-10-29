// src/utils/signInWithGoogleAndEnsureUser.ts
import {
    getAuth,
    GoogleAuthProvider,
    signInWithPopup,
  } from "firebase/auth";
  import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
  import { db } from "../firebase/firebaseConfig";
  
  /**
   * After Google login, make sure Firestore has firstName/lastName.
   * Returns whether we still need to ask the user for them.
   */
  export async function signInWithGoogleAndEnsureUser() {
    const auth = getAuth();
    const provider = new GoogleAuthProvider();
  
    const result = await signInWithPopup(auth, provider);
    const user = result.user;
  
    const uid = user.uid;
    const email = user.email || "";
    const displayName = user.displayName || "";
    const [guessFirst, ...rest] = displayName.split(" ");
    const guessLast = rest.join(" ");
  
    const userRef = doc(db, "users", uid);
    const snap = await getDoc(userRef);
  
    if (!snap.exists()) {
      // brand new user: create doc
      await setDoc(
        userRef,
        {
          email,
          firstName: guessFirst || "",
          lastName: guessLast || "",
          profileImage:
            user.photoURL ||
            `${import.meta.env.BASE_URL}assets/images/profile_placeholder.png`,
          createdAt: new Date().toISOString(),
        },
        { merge: true }
      );
    } else {
      // existing doc: don't blow it away, but fill blanks IF empty
      const data = snap.data() as any;
      const needsFirst = !data.firstName && guessFirst;
      const needsLast = !data.lastName && guessLast;
  
      if (needsFirst || needsLast) {
        await updateDoc(userRef, {
          firstName: data.firstName || guessFirst || "",
          lastName: data.lastName || guessLast || "",
        });
      }
    }
  
    // Reload after write so we have the truth
    const afterSnap = await getDoc(userRef);
    const after = (afterSnap.data() || {}) as any;
  
    const firstName = (after.firstName || "").trim();
    const lastName = (after.lastName || "").trim();
  
    const missingName = !(firstName && lastName);
  
    return {
      uid,
      email,
      firstName,
      lastName,
      missingName,
    };
  }