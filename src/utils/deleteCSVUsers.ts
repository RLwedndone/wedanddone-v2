import fs from "fs";
import { createRequire } from "module";
import { initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

// ✅ Use createRequire to import JSON
const require = createRequire(import.meta.url);
const serviceAccount = require("../../serviceAccountKey.json");

initializeApp({
  credential: cert(serviceAccount),
});

const auth = getAuth();
const db = getFirestore();

const deleteUsersFromCSV = async () => {
  const data = fs.readFileSync("users.csv", "utf-8");
  const lines = data.split("\n").slice(1); // skip header
  const uids = lines.map((line) => line.split(",")[0]).filter((uid) => uid);

  console.log(`🧼 Deleting ${uids.length} users from Auth and Firestore...`);

  for (const uid of uids) {
    try {
      await auth.deleteUser(uid);
      console.log(`✅ Deleted Auth: ${uid}`);

      await db.collection("users").doc(uid).delete();
      console.log(`🧻 Deleted Firestore doc: users/${uid}`);
    } catch (err) {
      if (err instanceof Error) {
        console.error(`❌ Error for ${uid}:`, err.message);
      } else {
        console.error(`❌ Error for ${uid}:`, err);
      }
    }
  }

  console.log("🎉 Done deleting users and Firestore docs.");
};

deleteUsersFromCSV();