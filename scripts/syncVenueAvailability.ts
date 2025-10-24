// scripts/syncVenueAvailability.ts

import { google } from "googleapis";
import admin from "firebase-admin";
import fs from "fs";

// 🔐 Load service account
const serviceAccountPath = "./venuesync-prod.json";
const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, "utf-8"));

// 🔥 Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

// 📄 Your Google Sheet info
const SHEET_ID = "1pIQSwWpbG5nkpPhfswvwHS3-_zG2Ka7bo4VxaCMFeP8";
const SCOPES = ["https://www.googleapis.com/auth/spreadsheets.readonly"];

// 📡 Setup Google Sheets API
const auth = new google.auth.GoogleAuth({
  credentials: serviceAccount,
  scopes: SCOPES,
});
const sheets = google.sheets({ version: "v4", auth });

// ✅ Map Google Sheet tab names → Firestore slugs
const TAB_TO_SLUG: Record<string, string> = {
  // Canonical names
  "Bates Mansion": "batesmansion",
  "Desert Foothills": "desertfoothills",
  "Encanterra": "encanterra",
  "FABRIC": "fabric",
  "Farmhouse": "farmhouse",
  "The Meadow": "themeadow",
  "Schnepf Barn": "schnepfbarn",
  "Hacienda del Sol": "haciendadelsol",
  "Hotel Valley Ho": "valleyho",
  "Lake House": "lakehouse",
  "Windmill Barn": "windmillbarn",
  "Ocotillo": "ocotillo",
  "Rubi House": "rubihouse",
  "Soho63": "soho63",
  "Sunkist": "sunkist",
  "The Vic": "vic",
  "Verrado Golf Club": "verrado",
  "Tubac Golf Resort": "tubac",

  // Safety nets for current typos/variants you saw in logs
  "Dessert Foothills": "desertfoothills",   // typo
  "Farm House": "farmhouse",                 // spacing variant
  "Sunkist Warehouse": "sunkist",            // verbose variant
  "Lake House ": "lakehouse",                // trailing space variant
  "Verrado Gold Club": "verrado",            // typo
};

async function syncSheetTabs() {
  try {
    // Get all tab (sheet) names
    const metadata = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
    const tabs =
      metadata.data.sheets
        ?.map((sheet) => sheet.properties?.title)
        .filter(Boolean) as string[];

    for (const tab of tabs) {
      const venueSlug = TAB_TO_SLUG[tab];
      if (!venueSlug) {
        console.warn(`⚠️ No slug mapping found for tab: "${tab}" — skipping`);
        continue;
      }

      const range = `${tab}!A2:A`; // Skip header, only date values
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: SHEET_ID,
        range,
      });

      const rows = response.data.values || [];
      const dates: string[] = [];

      for (const [dateString] of rows) {
        if (!dateString) continue;
        const parsed = new Date(dateString);
        if (!isNaN(parsed.getTime())) {
          dates.push(parsed.toISOString().split("T")[0]); // YYYY-MM-DD
        }
      }

      const docRef = db.collection("venues").doc(venueSlug);
      await docRef.set({ bookedDates: dates }, { merge: true });

      console.log(`✅ Synced ${dates.length} dates to: ${venueSlug}`);
    }

    console.log("🎉 All venue tabs synced!");
    process.exit(0);
  } catch (err) {
    console.error("❌ Error syncing availability:", err);
    process.exit(1);
  }
}

syncSheetTabs();