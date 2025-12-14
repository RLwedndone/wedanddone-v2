// src/components/jam/FamilyDances.tsx
import React, { useEffect, useRef, useState } from "react";
import { getAuth } from "firebase/auth";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "../../firebase/firebaseConfig";
import { JamSelectionsType } from "./JamOverlay";

interface FamilyDancesProps {
  onBack: () => void;
  onContinue: () => void;
  onClose: () => void;
  jamSelections: JamSelectionsType;
  setJamSelections: React.Dispatch<React.SetStateAction<JamSelectionsType>>;
  isGuestUser: boolean;
}

type FamilyDancesData = {
  firstDanceSong: string;
  firstDanceArtist: string;
  firstDanceUrl: string;
  skipFirstDance: boolean;
  motherSonSong: string;
  motherSonArtist: string;
  motherSonUrl: string;
  skipMotherSon: boolean;
  fatherDaughterSong: string;
  fatherDaughterArtist: string;
  fatherDaughterUrl: string;
  skipFatherDaughter: boolean;
};

const EMPTY_DATA: FamilyDancesData = {
  firstDanceSong: "",
  firstDanceArtist: "",
  firstDanceUrl: "",
  skipFirstDance: false,
  motherSonSong: "",
  motherSonArtist: "",
  motherSonUrl: "",
  skipMotherSon: false,
  fatherDaughterSong: "",
  fatherDaughterArtist: "",
  fatherDaughterUrl: "",
  skipFatherDaughter: false,
};

const FamilyDances: React.FC<FamilyDancesProps> = ({
  onBack,
  onContinue,
  onClose,
  jamSelections,
  setJamSelections,
  isGuestUser,
}) => {
  const [initialData, setInitialData] = useState<FamilyDancesData | null>(null);

  // text field refs (uncontrolled)
  const firstSongRef = useRef<HTMLInputElement | null>(null);
  const firstArtistRef = useRef<HTMLInputElement | null>(null);
  const firstUrlRef = useRef<HTMLInputElement | null>(null);

  const motherSongRef = useRef<HTMLInputElement | null>(null);
  const motherArtistRef = useRef<HTMLInputElement | null>(null);
  const motherUrlRef = useRef<HTMLInputElement | null>(null);

  const fatherSongRef = useRef<HTMLInputElement | null>(null);
  const fatherArtistRef = useRef<HTMLInputElement | null>(null);
  const fatherUrlRef = useRef<HTMLInputElement | null>(null);

  // checkbox state (can stay controlled; they’re simple)
  const [skipFirst, setSkipFirst] = useState(false);
  const [skipMother, setSkipMother] = useState(false);
  const [skipFather, setSkipFather] = useState(false);

  // Load once on mount (jamSelections → Firestore → localStorage)
  useEffect(() => {
    const load = async () => {
      // 1) jamSelections if present
      if (jamSelections.familyDances) {
        const merged = { ...EMPTY_DATA, ...jamSelections.familyDances };
        setInitialData(merged);
        setSkipFirst(!!merged.skipFirstDance);
        setSkipMother(!!merged.skipMotherSon);
        setSkipFather(!!merged.skipFatherDaughter);
        return;
      }

      const user = getAuth().currentUser;

      try {
        // 2) Firestore
        if (user && !isGuestUser) {
          const snap = await getDoc(doc(db, "users", user.uid));
          const data = snap.data() as any | undefined;
          const saved = data?.jamGroove?.familyDances;
          if (saved) {
            const merged = { ...EMPTY_DATA, ...saved };
            setInitialData(merged);
            setSkipFirst(!!merged.skipFirstDance);
            setSkipMother(!!merged.skipMotherSon);
            setSkipFather(!!merged.skipFatherDaughter);
            return;
          }
        }

        // 3) localStorage
        const local = JSON.parse(localStorage.getItem("jamGrooveProgress") || "{}");
        if (local?.familyDances) {
          const merged = { ...EMPTY_DATA, ...local.familyDances };
          setInitialData(merged);
          setSkipFirst(!!merged.skipFirstDance);
          setSkipMother(!!merged.skipMotherSon);
          setSkipFather(!!merged.skipFatherDaughter);
          return;
        }
      } catch (e) {
        console.error("❌ Error loading family dances:", e);
      }

      // Fallback: empty
      setInitialData(EMPTY_DATA);
    };

    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // While we don’t know initial values yet, show nothing / small loader
  if (!initialData) {
    return (
      <div className="pixie-card wd-page-turn">
        <div className="pixie-card__body" style={{ textAlign: "center" }}>
          <p className="px-prose-narrow">Loading your family dances…</p>
        </div>
      </div>
    );
  }

  const Field = ({
    placeholder,
    defaultValue,
    inputRef,
  }: {
    placeholder: string;
    defaultValue: string;
    inputRef: React.RefObject<HTMLInputElement>;
  }) => (
    <input
      className="px-input"
      placeholder={placeholder}
      defaultValue={defaultValue}
      ref={inputRef}
      style={{
        width: "100%",
        maxWidth: 420,
        margin: "0 auto 10px",
        display: "block",
      }}
    />
  );

  const avatarStyle = (color: string): React.CSSProperties => ({
    width: 150,
    height: 150,
    objectFit: "cover",
    borderRadius: "50%",
    cursor: "pointer",
    transition: "transform .2s ease-in-out, box-shadow .2s ease-in-out",
    boxShadow: `0 0 15px 5px ${color}`,
  });

  const handleSave = async () => {
    const dataToSave: FamilyDancesData = {
      firstDanceSong: firstSongRef.current?.value || "",
      firstDanceArtist: firstArtistRef.current?.value || "",
      firstDanceUrl: firstUrlRef.current?.value || "",
      skipFirstDance: skipFirst,
      motherSonSong: motherSongRef.current?.value || "",
      motherSonArtist: motherArtistRef.current?.value || "",
      motherSonUrl: motherUrlRef.current?.value || "",
      skipMotherSon: skipMother,
      fatherDaughterSong: fatherSongRef.current?.value || "",
      fatherDaughterArtist: fatherArtistRef.current?.value || "",
      fatherDaughterUrl: fatherUrlRef.current?.value || "",
      skipFatherDaughter: skipFather,
    };

    // Update overlay state
    setJamSelections((prev) => ({
      ...prev,
      familyDances: dataToSave,
    }));

    const user = getAuth().currentUser;

    try {
      if (user && !isGuestUser) {
        await updateDoc(doc(db, "users", user.uid), {
          "jamGroove.familyDances": dataToSave,
        });
        console.log("✅ Family dances → Firestore:", dataToSave);
      } else {
        const local = JSON.parse(localStorage.getItem("jamGrooveProgress") || "{}");
        local.familyDances = dataToSave;
        localStorage.setItem("jamGrooveProgress", JSON.stringify(local));
        console.log("💾 Family dances → localStorage:", dataToSave);
      }
    } catch (e) {
      console.error("❌ Save error:", e);
    }

    onContinue();
  };

  return (
    <div className="pixie-card wd-page-turn">
      {/* Pink X Close Button */}
      <button className="pixie-card__close" onClick={onClose} aria-label="Close">
        <img src={`${import.meta.env.BASE_URL}assets/icons/pink_ex.png`} alt="Close" />
      </button>

      <div className="pixie-card__body" style={{ textAlign: "center" }}>
        <h2 className="px-title" style={{ marginBottom: 8 }}>
          Family Dances
        </h2>
        <p className="px-prose-narrow" style={{ marginBottom: 18 }}>
          Let us know which special dances you'll include so your DJ can cue the perfect song.
        </p>

        <div style={{ display: "grid", gap: 24, justifyItems: "center" }}>
          {/* First Dance */}
          <section>
            <img
              src={`${import.meta.env.BASE_URL}assets/images/couple_dance.jpg`}
              alt="First Dance"
              style={avatarStyle("rgba(177,139,232,0.6)")}
            />
            <div style={{ marginTop: 12 }}>
              <h4 className="px-subtitle">Couple’s First Dance</h4>
              <Field
                placeholder="Song Title"
                defaultValue={initialData.firstDanceSong}
                inputRef={firstSongRef}
              />
              <Field
                placeholder="Artist"
                defaultValue={initialData.firstDanceArtist}
                inputRef={firstArtistRef}
              />
              <Field
                placeholder="Version URL (optional)"
                defaultValue={initialData.firstDanceUrl}
                inputRef={firstUrlRef}
              />
              <label className="px-helper">
                <input
                  type="checkbox"
                  checked={skipFirst}
                  onChange={() => setSkipFirst((v) => !v)}
                  style={{ marginRight: 6 }}
                />
                Not doing this one
              </label>
            </div>
          </section>

          {/* Mother–Son */}
          <section>
            <img
              src={`${import.meta.env.BASE_URL}assets/images/mother_son_dance.png`}
              alt="Mother Son Dance"
              style={avatarStyle("rgba(79,145,232,0.6)")}
            />
            <div style={{ marginTop: 12 }}>
              <h4 className="px-subtitle">Mother &amp; Son Dance</h4>
              <Field
                placeholder="Song Title"
                defaultValue={initialData.motherSonSong}
                inputRef={motherSongRef}
              />
              <Field
                placeholder="Artist"
                defaultValue={initialData.motherSonArtist}
                inputRef={motherArtistRef}
              />
              <Field
                placeholder="Version URL (optional)"
                defaultValue={initialData.motherSonUrl}
                inputRef={motherUrlRef}
              />
              <label className="px-helper">
                <input
                  type="checkbox"
                  checked={skipMother}
                  onChange={() => setSkipMother((v) => !v)}
                  style={{ marginRight: 6 }}
                />
                Not doing this one
              </label>
            </div>
          </section>

          {/* Father–Daughter */}
          <section>
            <img
              src={`${import.meta.env.BASE_URL}assets/images/daughter_father_dance.jpg`}
              alt="Father Daughter Dance"
              style={avatarStyle("rgba(247,140,180,0.6)")}
            />
            <div style={{ marginTop: 12 }}>
              <h4 className="px-subtitle">Father &amp; Daughter Dance</h4>
              <Field
                placeholder="Song Title"
                defaultValue={initialData.fatherDaughterSong}
                inputRef={fatherSongRef}
              />
              <Field
                placeholder="Artist"
                defaultValue={initialData.fatherDaughterArtist}
                inputRef={fatherArtistRef}
              />
              <Field
                placeholder="Version URL (optional)"
                defaultValue={initialData.fatherDaughterUrl}
                inputRef={fatherUrlRef}
              />
              <label className="px-helper">
                <input
                  type="checkbox"
                  checked={skipFather}
                  onChange={() => setSkipFather((v) => !v)}
                  style={{ marginRight: 6 }}
                />
                Not doing this one
              </label>
            </div>
          </section>
        </div>

        <div className="px-cta-col" style={{ marginTop: 20 }}>
          <button className="boutique-primary-btn" onClick={handleSave}>
            Continue
          </button>
          <button className="boutique-back-btn" onClick={onBack}>
            ⬅ Back
          </button>
        </div>
      </div>
    </div>
  );
};

export default FamilyDances;