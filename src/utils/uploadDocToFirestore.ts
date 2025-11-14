// src/utils/uploadDocToFirestore.ts
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { doc, updateDoc, arrayUnion } from "firebase/firestore";
import { storage, db } from "../firebase/firebaseConfig";

export const uploadDocToFirestore = async (
  userId: string,
  pdfBlob: Blob,
  title: string
) => {
  const timestamp = Date.now();

  // ✅ SAFER: replace ANY non-filename-friendly chars
  const safeTitle = title
    .replace(/[^\w\-\.]+/g, "_") // keep letters, numbers, _, -, .
    .replace(/_+/g, "_")          // collapse multiple underscores
    .replace(/^_+|_+$/g, "");     // trim underscores

  const filename = `${safeTitle || "document"}_${timestamp}.pdf`;

  // Upload to Firebase Storage
  const storageRef = ref(storage, `user_docs/${userId}/${filename}`);
  await uploadBytes(storageRef, pdfBlob);

  const downloadURL = await getDownloadURL(storageRef);

  // Add reference to Firestore
  await updateDoc(doc(db, "users", userId), {
    docs: arrayUnion({
      title,                      // <-- user-friendly display name stays the same
      url: downloadURL,
      createdAt: new Date().toISOString(),
    }),
  });

  console.log(`📄 PDF uploaded and linked to user's docs: ${title}`);

  // Let flows send admin emails, etc.
  return downloadURL;
};