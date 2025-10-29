import React, { useEffect, useState } from "react";
import { getAuth, onAuthStateChanged, User } from "firebase/auth";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { db } from "../firebase/firebaseConfig";

interface ProfileGateProps {
  children: React.ReactNode;
}

const ProfileGate: React.FC<ProfileGateProps> = ({ children }) => {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);

  // local form state if we need to prompt
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

  // whether profile is missing names
  const [needsName, setNeedsName] = useState(false);
  const [saving, setSaving] = useState(false);

  // 1. watch auth
  useEffect(() => {
    const unsub = onAuthStateChanged(getAuth(), async (u) => {
      setUser(u);
      if (!u) {
        setLoading(false);
        return;
      }

      // 2. pull Firestore user doc
      const ref = doc(db, "users", u.uid);
      const snap = await getDoc(ref);
      let data = snap.exists() ? (snap.data() as any) : null;

      // if it's a brand new google signup, you may not even have a user doc yet
      if (!data) {
        data = {};
        // create a stub so we have somewhere to write names later
        await setDoc(
          ref,
          {
            email: u.email || "",
            createdAt: new Date().toISOString(),
          },
          { merge: true }
        );
      }

      // 3. see if names are missing / blank
      const rawFirst = (data.firstName || "").trim();
      const rawLast = (data.lastName || "").trim();

      if (!rawFirst || !rawLast) {
        // prefill from Google displayName if we have it
        // e.g. "Taylor Swift" → { firstName: "Taylor", lastName: "Swift" }
        let guessFirst = "";
        let guessLast = "";

        const display = (u.displayName || "").trim();
        if (display) {
          const parts = display.split(/\s+/);
          if (parts.length === 1) {
            guessFirst = parts[0];
          } else if (parts.length > 1) {
            guessFirst = parts[0];
            guessLast = parts.slice(1).join(" ");
          }
        }

        setFirstName(rawFirst || guessFirst);
        setLastName(rawLast || guessLast);

        setNeedsName(true);
      }

      setLoading(false);
    });

    return () => unsub();
  }, []);

  // 4. save handler
  const handleSave = async () => {
    if (!user) return;
    const cleanFirst = firstName.trim();
    const cleanLast = lastName.trim();
    if (!cleanFirst || !cleanLast) return; // keep them here until both entered

    try {
      setSaving(true);
      const ref = doc(db, "users", user.uid);
      await updateDoc(ref, {
        firstName: cleanFirst,
        lastName: cleanLast,
        updatedAt: new Date().toISOString(),
      });
      setNeedsName(false);
    } catch (e) {
      console.error("⚠️ Failed to save names:", e);
    } finally {
      setSaving(false);
    }
  };

  // ---------- UI states ----------

  // still checking auth / firestore
  if (loading) {
    return null; // or a tiny spinner if you want
  }

  // not signed in? just render children, overlay login will handle auth later
  if (!user) {
    return <>{children}</>;
  }

  // signed in but missing names → block with modal
  if (needsName) {
    return (
      <div
        className="pixie-overlay"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 16,
          background: "rgba(0,0,0,.5)",
          zIndex: 9999,
        }}
      >
        <div
          className="pixie-card pixie-card--modal"
          style={{ maxWidth: 480, width: "100%", position: "relative" }}
        >
          <div className="pixie-card__body" style={{ textAlign: "center" }}>
            <h2
              className="px-title-lg"
              style={{ marginBottom: 12, lineHeight: 1.2 }}
            >
              Let’s grab your name real quick ✍️
            </h2>

            <p className="px-prose-narrow" style={{ marginBottom: 16 }}>
              We’ll use this on your contracts and receipts.
            </p>

            <div style={{ display: "grid", gap: 12, maxWidth: 360, margin: "0 auto" }}>
              <input
                className="px-input"
                placeholder="First name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                disabled={saving}
              />
              <input
                className="px-input"
                placeholder="Last name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                disabled={saving}
              />
            </div>

            <button
              className="boutique-primary-btn"
              style={{ width: 250, marginTop: 20, opacity: firstName && lastName ? 1 : 0.5 }}
              disabled={saving || !firstName.trim() || !lastName.trim()}
              onClick={handleSave}
            >
              Save & Continue
            </button>

            <p
              className="px-prose-narrow"
              style={{ marginTop: 12, fontSize: ".8rem", color: "#666" }}
            >
              This is required before you can book catering or desserts.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // profile complete → let the app render as normal
  return <>{children}</>;
};

export default ProfileGate;