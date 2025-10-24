// src/firebase/firebaseConfig.ts
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyBy5mXND_So9Fu88PqE8mrxcUvL6I31oyA",
  authDomain: "wedndonev2.firebaseapp.com",
  projectId: "wedndonev2",
  storageBucket: "wedndonev2.appspot.com", // ✅ bucket ID (not the .firebasestorage.app host)
  messagingSenderId: "927810222422",
  appId: "1:927810222422:web:1aff9f90e13b95ebc33ef7",
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// ✅ IMPORTANT: no second arg here—this uses the bucket above
export const storage = getStorage(app);