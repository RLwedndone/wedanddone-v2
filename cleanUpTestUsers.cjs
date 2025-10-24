const admin = require("firebase-admin");

admin.initializeApp({
    credential: admin.credential.cert(require("./serviceAccountKey.json")),
  });

const auth = admin.auth();
const db = admin.firestore();

async function deleteAllFirestoreUsers() {
  const usersCollection = db.collection("users");
  const snapshot = await usersCollection.get();

  const deletePromises = snapshot.docs.map((doc) => doc.ref.delete());
  await Promise.all(deletePromises);
  console.log(`✅ Deleted ${snapshot.size} user documents from Firestore.`);
}

async function deleteAllAuthUsers(nextPageToken) {
  const listUsersResult = await auth.listUsers(1000, nextPageToken);
  const deletePromises = listUsersResult.users.map((userRecord) =>
    auth.deleteUser(userRecord.uid)
  );
  await Promise.all(deletePromises);
  console.log(`✅ Deleted ${listUsersResult.users.length} Firebase Auth users.`);

  if (listUsersResult.pageToken) {
    await deleteAllAuthUsers(listUsersResult.pageToken);
  }
}

(async () => {
  try {
    await deleteAllFirestoreUsers();
    await deleteAllAuthUsers();
    console.log("🎉 Cleanup complete!");
  } catch (error) {
    console.error("❌ Error during cleanup:", error);
  }
})();