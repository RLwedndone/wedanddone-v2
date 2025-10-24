import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { doc, updateDoc, arrayUnion } from "firebase/firestore";
import { storage, db } from "../firebase/firebaseConfig";

export const uploadDocToFirestore = async (
  userId: string,
  pdfBlob: Blob,
  title: string
) => {
  const timestamp = Date.now();
  const filename = `${title.replace(/\s+/g, "_")}_${timestamp}.pdf`;

  // Upload to Firebase Storage
  const storageRef = ref(storage, `user_docs/${userId}/${filename}`);
  await uploadBytes(storageRef, pdfBlob);

  const downloadURL = await getDownloadURL(storageRef);

  // Add to user's 'docs' array in Firestore
  await updateDoc(doc(db, "users", userId), {
    docs: arrayUnion({
      title,
      url: downloadURL,
      createdAt: new Date().toISOString(),
    }),
  });

  console.log(`📄 PDF uploaded and linked to user's docs: ${title}`);
};