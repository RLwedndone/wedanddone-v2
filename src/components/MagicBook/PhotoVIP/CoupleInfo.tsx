import React, { useState, useEffect } from "react";
import { auth, db } from "../../../firebase/firebaseConfig";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";

interface CoupleInfoProps {
  onNext: () => void;
  onBack: () => void;
  goToTOC?: () => void; // ✅ added
}

const CoupleInfo: React.FC<CoupleInfoProps> = ({ onNext, onBack, goToTOC }) => {
  const [loveBird1Title, setLoveBird1Title] = useState("");
  const [loveBird1First, setLoveBird1First] = useState("");
  const [loveBird1Last, setLoveBird1Last] = useState("");
  const [loveBird2Title, setLoveBird2Title] = useState("");
  const [loveBird2First, setLoveBird2First] = useState("");
  const [loveBird2Last, setLoveBird2Last] = useState("");

  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUserId(user.uid);
        const coupleDocRef = doc(db, "users", user.uid, "magicBookData", "coupleInfo");
        const docSnap = await getDoc(coupleDocRef);
        if (docSnap.exists()) {
          const data = docSnap.data() as any;
          if (data.loveBird1) {
            setLoveBird1Title(data.loveBird1.label || "");
            setLoveBird1First(data.loveBird1.first || "");
            setLoveBird1Last(data.loveBird1.last || "");
          }
          if (data.loveBird2) {
            setLoveBird2Title(data.loveBird2.label || "");
            setLoveBird2First(data.loveBird2.first || "");
            setLoveBird2Last(data.loveBird2.last || "");
          }
        }
      } else {
        // Guest user: load from localStorage
        const saved = localStorage.getItem("magicBookCoupleInfo");
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.loveBird1) {
            setLoveBird1Title(parsed.loveBird1.label || "");
            setLoveBird1First(parsed.loveBird1.first || "");
            setLoveBird1Last(parsed.loveBird1.last || "");
          }
          if (parsed.loveBird2) {
            setLoveBird2Title(parsed.loveBird2.label || "");
            setLoveBird2First(parsed.loveBird2.first || "");
            setLoveBird2Last(parsed.loveBird2.last || "");
          }
        }
      }
    });

    return () => unsubscribe();
  }, []);

  const handleNext = () => {
    const coupleInfo = {
      loveBird1: { first: loveBird1First, last: loveBird1Last, label: loveBird1Title },
      loveBird2: { first: loveBird2First, last: loveBird2Last, label: loveBird2Title },
    };

    localStorage.setItem("magicBookCoupleInfo", JSON.stringify(coupleInfo));
    localStorage.setItem("magicStep", "vip"); // next screen
    if (userId) {
      const coupleDocRef = doc(db, "users", userId, "magicBookData", "coupleInfo");
      setDoc(coupleDocRef, coupleInfo, { merge: true });
    }

    onNext();
  };

  const handleBack = () => {
    // go back to PhotoVIP intro (matches MagicBookOverlay step key)
    localStorage.setItem("magicStep", "photoVIPIntro");
    onBack();
  };

  return (
    <div className="pixie-overlay">
      <div className="pixie-card" style={{ paddingTop: "1.25rem", paddingBottom: "1.25rem" }}>
        {/* 🔷 Top icon (optional) */}
        <div style={{ textAlign: "center", marginBottom: "0.75rem" }} />

        {/* ✅ Content container keeps things comfy on mobile */}
        <div
          style={{
            width: "100%",
            maxWidth: 560,
            margin: "0 auto",
          }}
        >
          {/* 🌟 Icon image */}
          <div style={{ textAlign: "center" }}>
            <img
              src="/assets/images/all_about.png"
              alt="Love Birds Icon"
              style={{ maxWidth: "320px", width: "82%", height: "auto", marginBottom: "1.5rem" }}
            />
          </div>

          {/* ✨ Explainer Block */}
          <div style={{ maxWidth: 700, textAlign: "center", margin: "0 auto 2rem" }}>
            <h2 style={{ fontSize: "2rem", marginBottom: "0.75rem", color: "#2c62ba" }}>
              Let's meet the stars of the show… you two!
            </h2>
            <p>
              To help us tailor your photo shot list, we’d love to know your names and the title you'd like to use.
            </p>
            <p>
              Pick one from the dropdown <strong>(Bride, Groom, or Partner)</strong> and enter your first and last name.
            </p>
          </div>

          {/* 🐦 Love Bird 1 */}
          <div style={{ marginBottom: "1.5rem", width: "100%", maxWidth: 500, marginInline: "auto" }}>
            <h3 style={{ color: "#2c62ba", marginBottom: "0.5rem", fontSize: "1.5rem", textAlign: "center" }}>
              Love Bird #1
            </h3>
            <select
              value={loveBird1Title}
              onChange={(e) => setLoveBird1Title(e.target.value)}
              style={{
                width: "100%",
                padding: "0.75rem 1rem",
                borderRadius: 10,
                border: "1px solid #ccc",
                fontSize: "1rem",
                marginBottom: "0.75rem",
                appearance: "none",
                backgroundColor: "#fff",
                backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='%232c62ba' stroke-width='2'/%3E%3C/svg%3E")`,
                backgroundRepeat: "no-repeat",
                backgroundPosition: "right 1rem center",
                backgroundSize: 12,
              }}
            >
              <option value="">Select a title</option>
              <option value="Bride">Bride</option>
              <option value="Groom">Groom</option>
              <option value="Partner">Partner</option>
            </select>

            <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
              <input
                type="text"
                placeholder="First name"
                value={loveBird1First}
                onChange={(e) => setLoveBird1First(e.target.value)}
                style={{
                  flex: "1 1 240px",
                  minWidth: 0,
                  padding: "0.75rem 1rem",
                  borderRadius: 10,
                  border: "1px solid #ccc",
                }}
              />
              <input
                type="text"
                placeholder="Last name"
                value={loveBird1Last}
                onChange={(e) => setLoveBird1Last(e.target.value)}
                style={{
                  flex: "1 1 240px",
                  minWidth: 0,
                  padding: "0.75rem 1rem",
                  borderRadius: 10,
                  border: "1px solid #ccc",
                }}
              />
            </div>
          </div>

          {/* 🐦 Love Bird 2 */}
          <div style={{ marginBottom: "2rem", width: "100%", maxWidth: 500, marginInline: "auto" }}>
            <h3 style={{ color: "#2c62ba", marginBottom: "0.5rem", fontSize: "1.5rem", textAlign: "center" }}>
              Love Bird #2
            </h3>
            <select
              value={loveBird2Title}
              onChange={(e) => setLoveBird2Title(e.target.value)}
              style={{
                width: "100%",
                padding: "0.75rem 1rem",
                borderRadius: 10,
                border: "1px solid #ccc",
                fontSize: "1rem",
                marginBottom: "0.75rem",
                appearance: "none",
                backgroundColor: "#fff",
                backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='%232c62ba' stroke-width='2'/%3E%3C/svg%3E")`,
                backgroundRepeat: "no-repeat",
                backgroundPosition: "right 1rem center",
                backgroundSize: 12,
              }}
            >
              <option value="">Select a title</option>
              <option value="Bride">Bride</option>
              <option value="Groom">Groom</option>
              <option value="Partner">Partner</option>
            </select>

            <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
              <input
                type="text"
                placeholder="First name"
                value={loveBird2First}
                onChange={(e) => setLoveBird2First(e.target.value)}
                style={{
                  flex: "1 1 240px",
                  minWidth: 0,
                  padding: "0.75rem 1rem",
                  borderRadius: 10,
                  border: "1px solid #ccc",
                }}
              />
              <input
                type="text"
                placeholder="Last name"
                value={loveBird2Last}
                onChange={(e) => setLoveBird2Last(e.target.value)}
                style={{
                  flex: "1 1 240px",
                  minWidth: 0,
                  padding: "0.75rem 1rem",
                  borderRadius: 10,
                  border: "1px solid #ccc",
                }}
              />
            </div>
          </div>

          {/* 📘 Navigation Buttons */}
          <div style={{ textAlign: "center", marginTop: "2rem" }}>
            {/* Blue Next */}
            <button
              onClick={handleNext}
              style={{
                width: 180,
                backgroundColor: "#2c62ba",
                color: "#fff",
                fontSize: "1.1rem",
                padding: "0.75rem 1rem",
                borderRadius: 8,
                border: "none",
                cursor: "pointer",
              }}
            >
              Turn the Page →
            </button>

            {/* Pink Back */}
            <div style={{ marginTop: "0.75rem" }}>
              <button
                onClick={handleBack}
                className="boutique-back-btn"
                style={{ width: 180, padding: "0.75rem 1rem", fontSize: "1.1rem", fontWeight: 600 }}
              >
                ⬅ Back
              </button>
            </div>

            {/* Purple Back to TOC */}
            <div style={{ marginTop: "0.5rem" }}>
            <button
  onClick={() => {
    console.log("[DBG][Style] TOC click – has goToTOC?", typeof goToTOC === "function");
    if (typeof goToTOC === "function") {
      goToTOC();
      return;
    }
    // Fallback: set intent + tell overlay to navigate
    localStorage.setItem("magicStep", "toc");
    window.dispatchEvent(new Event("magic:gotoTOC"));
  }}
  style={{
    backgroundColor: "#7b4bd8",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    padding: "0.75rem 1rem",
    fontSize: "1.05rem",
    fontWeight: 600,
    cursor: "pointer",
    width: 180,
    marginTop: "0.5rem",
  }}
>
  🪄 Back to TOC
</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CoupleInfo;