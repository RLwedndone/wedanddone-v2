import { collection, addDoc, serverTimestamp, doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { auth, db, app } from "../firebase/firebaseConfig";  // ✅ keep app here
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage"; // ✅ add this

// Get the current user's document
export const getUserDoc = async () => {
  const user = auth.currentUser;
  if (!user) return null;

  const userRef = doc(db, "users", user.uid);
  const docSnap = await getDoc(userRef);

  return docSnap.exists() ? { id: user.uid, data: docSnap.data() } : null;
};

// Update the user's budget
export const saveUserBudget = async (budget: number): Promise<boolean> => {
  try {
    const user = auth.currentUser;
    if (!user) throw new Error("No user logged in");

    const userRef = doc(db, "users", user.uid);
    const docSnap = await getDoc(userRef);

    if (docSnap.exists()) {
      // Document exists, update it
      await updateDoc(userRef, { budget });
    } else {
      // Document doesn't exist, create it
      await setDoc(userRef, {
        budget,
        purchases: [],
        createdAt: new Date().toISOString(),
      });
    }

    return true;
  } catch (err) {
    console.error("Error saving budget:", err);
    return false;
  }
};

// Fetch only the budget value
export const fetchUserBudget = async (): Promise<number | null> => {
  try {
    const user = auth.currentUser;
    if (!user) return null;

    const userRef = doc(db, "users", user.uid);
    const snapshot = await getDoc(userRef);
    const data = snapshot.data();

    return data?.budget || null;
  } catch (err) {
    console.error("Error fetching budget:", err);
    return null;
  }
};

/**
 * Sends a message to a specific user (shown in their Messages tab)
 */
export const sendMessageToUser = async (
  uid: string,
  message: string,
  type: "system" | "admin" = "system"
) => {
  try {
    const messagesRef = collection(db, "users", uid, "messages");
    await addDoc(messagesRef, {
      content: message,
      createdAt: serverTimestamp(),
      read: false,
      type,
      from: "Madge", // she's always the messenger 💌
    });
    console.log("✅ Message sent:", message);
  } catch (error) {
    console.error("❌ Failed to send message:", error);
  }
};

// Sends a test message to the logged-in user
export const sendTestMessage = async () => {
  const user = auth.currentUser;
  if (!user) {
    console.error("No user is logged in");
    return;
  }

  const messagesRef = collection(db, "users", user.uid, "messages");

  await addDoc(messagesRef, {
    sender: "Madge 🧚‍♀️",
    text: "Welcome to Wed&Done! I'm here to help make magic.",
    read: false,
    createdAt: serverTimestamp(),
  });

  console.log("✅ Test message sent!");
};

/**
 * Uploads a PDF blob and returns a download URL.
 * Forces the firebasestorage.app bucket to avoid local CORS issues.
 */
export async function uploadPdfBlob(blob: Blob, filePath: string): Promise<string> {
  const tag = "[uploadPdfBlob]";
  console.log(`${tag} start`, { filePath, size: blob?.size });

  if (!blob || !(blob instanceof Blob) || !blob.size) {
    console.error(`${tag} ❌ invalid blob`, blob);
    throw new Error("Invalid or empty PDF blob");
  }
  if (!filePath || typeof filePath !== "string") {
    console.error(`${tag} ❌ invalid filePath`, filePath);
    throw new Error("Invalid filePath");
  }

  // 🔒 DO NOT rename this to `storage`; avoid shadowing the imported one.
  const storageFB = getStorage(app, "gs://wedndonev2.firebasestorage.app");

  const objectRef = ref(storageFB, filePath);
  // This prints "gs://wedndonev2.firebasestorage.app/users/UID/…"
  console.log(`${tag} ref`, objectRef.toString());

  const snap = await uploadBytes(objectRef, blob, {
    contentType: "application/pdf",
    cacheControl: "private, max-age=0, no-transform",
    customMetadata: { uploadedBy: "PlannerCheckOut" },
  });

  console.log(`${tag} ✅ uploaded`, {
    fullPath: snap.metadata.fullPath,
    bucket: (snap.metadata as any)?.bucket,
    size: blob.size,
  });

  const url = await getDownloadURL(objectRef);
  console.log(`${tag} 🔗 downloadURL`, url);
  return url;
}
