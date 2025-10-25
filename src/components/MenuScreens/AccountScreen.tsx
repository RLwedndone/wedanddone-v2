import React, { useState, useEffect } from "react";
import { db } from "../../firebase/firebaseConfig";
import { doc, getDoc } from "firebase/firestore";
import {
  getAuth,
  createUserWithEmailAndPassword,
  updateProfile,
  sendPasswordResetEmail,
  GoogleAuthProvider,
  signInWithPopup,
} from "firebase/auth";
import { saveUserProfile } from "../../utils/saveUserProfile";
import {
  getGuestState,
  setGuestCount,
  type GuestLockReason,
} from "../../utils/guestCountStore";

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "0.75rem",
  fontSize: "1rem",
  marginBottom: "1rem",
  borderRadius: "12px",
  border: "1px solid #ccc",
};

// 🔍 helper: is a given YYYY-MM-DD date in the past?
const isPastYMD = (ymd?: string) => {
  if (!ymd) return false;
  const d = new Date(`${ymd}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d.getTime() < today.getTime();
};

// For the <input type="date" min=...>
const todayYMD = new Date().toISOString().slice(0, 10);

type AccountScreenProps = {
  onClose: () => void;
};

const AccountScreen: React.FC<AccountScreenProps> = ({ onClose }) => {
  const [firstName, setFirstName] = useState("Magic");
  const [lastName, setLastName] = useState("User");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fianceFirst, setFianceFirst] = useState("");
  const [fianceLast, setFianceLast] = useState("");
  const [phone, setPhone] = useState("");
  const [profileImage, setProfileImage] = useState(
    `${import.meta.env.BASE_URL}assets/images/profile_placeholder.png`
  );
  const [isGuest, setIsGuest] = useState(false);
  const [accountCreated, setAccountCreated] = useState(false);

  const [weddingDate, setWeddingDate] = useState("");
  const [dayOfWeek, setDayOfWeek] = useState("");
  const [dateLocked, setDateLocked] = useState(false);
  const [dateError, setDateError] = useState<string | null>(null);

  // 🔢 Single-source guest count state
  const [gc, setGC] = useState<number>(0);
  const [originalGC, setOriginalGC] = useState<number>(0);
  const [locked, setLocked] = useState<boolean>(false);
  const [lockReasons, setLockReasons] = useState<GuestLockReason[]>([]);
  const [bannerMsg, setBannerMsg] = useState<string | null>(null);
  const [changesSaved, setChangesSaved] = useState(false);

  // ─────────────────────────────────────────────────────────────
  // Load profile (names, contact, date, etc.)
  // ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const auth = getAuth();
    const user = auth.currentUser;

    if (!user) {
      setIsGuest(true);
      return;
    }

    (async () => {
      const userDoc = await getDoc(doc(db, "users", user.uid));
      if (!userDoc.exists()) return;

      const data = userDoc.data() as any;

      setFirstName(data.firstName || "");
      setLastName(data.lastName || "");
      setEmail(data.email || user.email || "");
      setProfileImage(
        data.profileImage ||
          `${import.meta.env.BASE_URL}assets/images/profile_placeholder.png`
      );
      setFianceFirst(data.fianceFirst || "");
      setFianceLast(data.fianceLast || "");
      setPhone(data.phone || "");

      const savedDate = data.weddingDate || "";
      setWeddingDate(savedDate);

      if (savedDate) {
        const parsedDate = new Date(savedDate + "T12:00:00");
        const weekday = parsedDate.toLocaleDateString("en-US", {
          weekday: "long",
        });
        setDayOfWeek(weekday);
      } else {
        setDayOfWeek("");
      }

      setDateLocked(!!data.weddingDateLocked);
    })();
  }, []);

  // ─────────────────────────────────────────────────────────────
  // Load guestCount from single-source store + keep in sync
  // ─────────────────────────────────────────────────────────────
  useEffect(() => {
    let mounted = true;

    function lockBanner(reasons: GuestLockReason[]) {
      if (!reasons || reasons.length === 0)
        return "Guest count is locked.";
      const pretty: Record<GuestLockReason, string> = {
        venue: "a venue booking",
        planner: "a planner booking",
        catering: "a catering booking",
        dessert: "a dessert booking",
        "yum:catering": "a Yum Yum catering booking",
        "yum:dessert": "a Yum Yum dessert booking",
        final_submission: "final submission lock",
      };
      return `Guest count is locked due to ${reasons
        .map((r) => pretty[r] ?? r)
        .join(" & ")}.`;
    }

    const sync = async () => {
      const st = await getGuestState();
      if (!mounted) return;

      const current = Number((st as any).value ?? 0); // guest count
      const isLocked = Boolean((st as any).locked); // lock flag

      // normalize reasons from any key the store might use
      const reasons =
        ((st as any).lockedReasons ??
          (st as any).guestCountLockedBy ??
          (st as any).lockedBy ??
          (st as any).reasons ??
          []) as GuestLockReason[];

      setGC(current);
      setOriginalGC(current);
      setLocked(isLocked);
      setLockReasons(reasons);
      setBannerMsg(isLocked ? lockBanner(reasons) : null);
    };

    sync();

    const onUpdate = () => sync();
    window.addEventListener("guestCountUpdated", onUpdate);
    window.addEventListener("guestCountLocked", onUpdate);
    window.addEventListener("guestCountUnlocked", onUpdate);

    return () => {
      mounted = false;
      window.removeEventListener("guestCountUpdated", onUpdate);
      window.removeEventListener("guestCountLocked", onUpdate);
      window.removeEventListener("guestCountUnlocked", onUpdate);
    };
  }, []);

  // ─────────────────────────────────────────────────────────────
  // Handlers
  // ─────────────────────────────────────────────────────────────
  const handlePhotoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result) setProfileImage(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleGuestSignup = async () => {
    // 🚫 prevent saving a past wedding date
    if (weddingDate && isPastYMD(weddingDate)) {
      setDateError("Please choose a future date.");
      return;
    }

    const auth = getAuth();
    try {
      // create account
      const userCred = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );

      // set display name
      await updateProfile(userCred.user, {
        displayName: `${firstName} ${lastName}`,
      });

      // persist profile (guestCount stays owned by the store → null here)
      await saveUserProfile({
        uid: userCred.user.uid,
        firstName,
        lastName,
        email,
        profileImage,
        fianceFirst,
        fianceLast,
        phone,
        weddingDate,
        dayOfWeek,
        guestCount: null, // single source of truth is the store
      });

      // ensure current GC (if any) is saved under this new uid
      const n = Math.max(
        0,
        Math.min(250, Math.floor(Number(gc) || 0))
      );
      await setGuestCount(n);

      setIsGuest(false);
      setAccountCreated(true);
      setTimeout(() => setAccountCreated(false), 3000);
    } catch (err: any) {
      console.error("❌ Failed to create account:", err);
      alert(
        err?.message || "Account creation failed. Please try again."
      );
    }
  };

  const handleGoogleSignup = async () => {
    const auth = getAuth();
    const provider = new GoogleAuthProvider();

    try {
      const result = await signInWithPopup(auth, provider);
      const u = result.user;

      // Derive a first/last from displayName (fallbacks are friendly)
      const [given, ...rest] = (u.displayName || "Magic User").split(
        " "
      );
      const first = given || "Magic";
      const last = rest.join(" ") || "User";

      // Persist base profile (guestCount is managed by guestCountStore)
      await saveUserProfile({
        uid: u.uid,
        firstName: first,
        lastName: last,
        email: u.email || "",
        profileImage:
          u.photoURL ||
          `${import.meta.env.BASE_URL}assets/images/profile_placeholder.png`,
        fianceFirst: "",
        fianceLast: "",
        phone: "",
        weddingDate: "",
        dayOfWeek: "",
        guestCount: null,
      });

      // Reflect in local UI
      setIsGuest(false);
      setEmail(u.email || "");
      setFirstName(first);
      setLastName(last);
      setProfileImage(
        u.photoURL ||
          `${import.meta.env.BASE_URL}assets/images/profile_placeholder.png`
      );
      setAccountCreated(true);
      setTimeout(() => setAccountCreated(false), 3000);
    } catch (err: any) {
      // common auth errors made human
      if (err?.code === "auth/popup-closed-by-user") return; // silent
      if (
        err?.code ===
        "auth/account-exists-with-different-credential"
      ) {
        alert(
          "An account with this email exists with a different sign-in method. Try email/password."
        );
        return;
      }
      console.error("❌ Google sign-up failed:", err);
      alert("Google sign-up failed. Please try again.");
    }
  };

  const handleSave = async () => {
    setBannerMsg(null);

    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) {
      setBannerMsg(
        "Please create an account first (email + password)."
      );
      return;
    }

    // 🚫 block saving a past date (if editable)
    if (!dateLocked && weddingDate && isPastYMD(weddingDate)) {
      setDateError("Please choose a future date.");
      setBannerMsg(
        "Your wedding date appears to be in the past. Please update it before saving."
      );
      return;
    }

    try {
      // 1) Save profile (do NOT write GC here)
      await saveUserProfile({
        uid: user.uid,
        firstName,
        lastName,
        email,
        profileImage,
        fianceFirst,
        fianceLast,
        phone,
        weddingDate,
        dayOfWeek,
        guestCount: null, // keep null; store owns GC
      });

      // 2) Guest-count: only update if not locked & changed
      const gcChanged = Number(gc) !== Number(originalGC);

      if (locked && gcChanged) {
        window.dispatchEvent(
          new CustomEvent("openUserMenuScreen", {
            detail: "guestListScroll",
          })
        );
        setBannerMsg(
          "Guest count is locked after a booking. Use the Guest Count Scroll to request a change."
        );
        return;
      }

      if (!locked && gcChanged) {
        const GLOBAL_MAX = 250;
        let n = Math.floor(Number(gc) || 0);
        if (n < 0) n = 0;
        if (n > GLOBAL_MAX) n = GLOBAL_MAX;

        await setGuestCount(n); // updates Firestore/localStorage/emits events
        setGC(n);
        setOriginalGC(n);
      }

      setChangesSaved(true);
      setTimeout(() => setChangesSaved(false), 3000);
    } catch (error) {
      console.error("❌ Failed to save account info:", error);
      setBannerMsg(
        "Something went wrong saving your changes. Please try again."
      );
    }
  };

  const handlePasswordReset = async () => {
    const auth = getAuth();
    if (!email) return alert("No email address found.");

    try {
      await sendPasswordResetEmail(auth, email);
      alert(
        "📩 A password reset link has been sent to your email."
      );
    } catch (error) {
      console.error("❌ Password reset failed:", error);
      alert("Something went wrong. Please try again.");
    }
  };

  // ─────────────────────────────────────────────────────────────
  // UI
  // ─────────────────────────────────────────────────────────────
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0,0,0,0.5)",
        zIndex: 1000,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: "24px",
          padding: "2.5rem",
          maxWidth: "600px",
          width: "90%",
          maxHeight: "90vh",
          overflowY: "auto",
          boxShadow: "0 0 20px rgba(0,0,0,0.3)",
          position: "relative",
          textAlign: "center",
        }}
      >
        <button
          onClick={onClose}
          style={{
            position: "absolute",
            top: "1rem",
            right: "1rem",
            fontSize: "1.5rem",
            background: "none",
            border: "none",
            cursor: "pointer",
          }}
          aria-label="Close"
        >
          ✖
        </button>

        {/* Avatar */}
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <div
            style={{
              position: "relative",
              display: "inline-block",
              cursor: "pointer",
            }}
            onClick={() =>
              document.getElementById("fileInput")?.click()
            }
          >
            <img
              src={profileImage}
              alt="Profile"
              style={{
                width: 120,
                height: 120,
                borderRadius: "50%",
                objectFit: "cover",
              }}
            />
            <img
              src={`${import.meta.env.BASE_URL}assets/images/camera_overlay.png`}
              alt=""
              style={{
                position: "absolute",
                bottom: 0,
                right: 0,
                width: 40,
                height: 40,
              }}
            />
          </div>
          <input
            type="file"
            id="fileInput"
            accept="image/*"
            style={{ display: "none" }}
            onChange={handlePhotoChange}
          />
        </div>

        {/* Fields */}
        <div style={{ textAlign: "left" }}>
          <label>First Name</label>
          <input
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            style={inputStyle}
          />

          <label>Last Name</label>
          <input
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            style={inputStyle}
          />

          <label>Email</label>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={inputStyle}
            disabled={!isGuest}
          />

          {isGuest && (
            <>
              <label>Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) =>
                  setPassword(e.target.value)
                }
                style={inputStyle}
              />
            </>
          )}

          <label>Fiancé’s First Name</label>
          <input
            value={fianceFirst}
            onChange={(e) =>
              setFianceFirst(e.target.value)
            }
            style={inputStyle}
          />

          <label>Fiancé’s Last Name</label>
          <input
            value={fianceLast}
            onChange={(e) =>
              setFianceLast(e.target.value)
            }
            style={inputStyle}
          />

          <label>Phone Number</label>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            style={inputStyle}
          />

          <label>Wedding Date</label>
          {dateLocked ? (
            <>
              <p
                style={{
                  fontSize: "1rem",
                  marginBottom: ".5rem",
                  color: "#333",
                  fontWeight: "bold",
                }}
              >
                {weddingDate} —{" "}
                <span style={{ color: "#2c62ba" }}>
                  {dayOfWeek}
                </span>
              </p>
              <p
                style={{
                  fontSize: ".9rem",
                  fontStyle: "italic",
                  color: "#666",
                  marginBottom: "1.5rem",
                }}
              >
                Your date is locked after a booking. Contact us
                if you need to make a change!
              </p>
            </>
          ) : (
            <>
              <input
                type="date"
                value={weddingDate}
                min={todayYMD} // 🔒 blocks selecting past dates via picker
                onChange={(e) => {
                  const date = e.target.value;
                  setWeddingDate(date);

                  if (
                    date &&
                    !isNaN(
                      new Date(`${date}T12:00:00`).getTime()
                    )
                  ) {
                    const weekday = new Date(
                      `${date}T12:00:00`
                    ).toLocaleDateString("en-US", {
                      weekday: "long",
                    });
                    setDayOfWeek(weekday);
                  } else {
                    setDayOfWeek("");
                  }

                  // live validation
                  if (date && isPastYMD(date)) {
                    setDateError(
                      "Please choose a future date."
                    );
                  } else {
                    setDateError(null);
                  }
                }}
                style={{
                  ...inputStyle,
                  fontFamily: "inherit",
                  borderColor: dateError ? "#d33" : "#ccc",
                }}
                aria-invalid={!!dateError}
                aria-describedby={
                  dateError ? "weddingDateError" : undefined
                }
              />
              {dayOfWeek && !dateError && (
                <p
                  style={{
                    marginTop: "-0.5rem",
                    marginBottom: "1rem",
                    fontStyle: "italic",
                    color: "#2c62ba",
                  }}
                >
                  That’s a <strong>{dayOfWeek}</strong>!
                </p>
              )}
              {dateError && (
                <p
                  id="weddingDateError"
                  style={{
                    color: "#d33",
                    marginTop: "-0.25rem",
                    marginBottom: "1rem",
                  }}
                >
                  {dateError}
                </p>
              )}
            </>
          )}

          {/* Guest Count section (single source of truth) */}
          <section style={{ marginTop: "1rem" }}>
            <label
              style={{
                display: "block",
                marginBottom: "0.5rem",
                fontWeight: 600,
                color: "#333",
              }}
            >
              Guest Count
            </label>

            {locked ? (
              <>
                <input
                  type="text"
                  value={String(gc)}
                  disabled
                  style={{
                    ...inputStyle,
                    background: "#f4f6fb",
                    color: "#666",
                  }}
                />
                <div
                  style={{
                    fontSize: ".9rem",
                    color: "#666",
                    marginTop: ".25rem",
                  }}
                >
                  Locked after:{" "}
                  <strong>
                    {(lockReasons || []).join(", ") ||
                      "a booking"}
                  </strong>
                  .
                </div>
                <button
                  className="boutique-secondary-btn"
                  style={{ marginTop: ".75rem" }}
                  onClick={() =>
                    window.dispatchEvent(
                      new CustomEvent(
                        "openUserMenuScreen",
                        { detail: "guestListScroll" }
                      )
                    )
                  }
                >
                  Change my guest count
                </button>
              </>
            ) : (
              <>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={String(gc)}
                  onChange={(e) => {
                    const raw =
                      e.target.value.replace(/[^\d]/g, "");
                    const n =
                      raw === "" ? 0 : Number(raw);
                    setGC(
                      Number.isFinite(n) ? n : 0
                    );
                  }}
                  onBlur={() => {
                    const GLOBAL_MAX = 250;
                    let n = Math.floor(
                      Number(gc) || 0
                    );
                    if (n < 0) n = 0;
                    if (n > GLOBAL_MAX)
                      n = GLOBAL_MAX;
                    if (n !== gc) setGC(n);
                  }}
                  style={inputStyle}
                  placeholder="0–250"
                  aria-label="Guest count"
                />
                <div
                  style={{
                    fontSize: ".9rem",
                    color: "#666",
                    marginTop: ".25rem",
                  }}
                >
                  Max allowed:{" "}
                  <strong>250</strong>
                </div>
              </>
            )}
          </section>
        </div>

        {/* Toast/Banner */}
        {bannerMsg && (
          <div
            style={{
              background: "#fff7d1",
              border: "1px solid #eed27a",
              padding: "0.6rem 0.8rem",
              borderRadius: 10,
              marginTop: "1rem",
              marginBottom: "1rem",
              fontSize: ".95rem",
              textAlign: "left",
            }}
          >
            {bannerMsg}
          </div>
        )}

        {accountCreated && (
          <p
            style={{
              color: "#2c62ba",
              fontWeight: "bold",
              marginBottom: "1rem",
              fontSize: "1rem",
            }}
          >
            ✨ Account created!
          </p>
        )}
        {changesSaved && (
          <p
            style={{
              color: "#2c62ba",
              fontWeight: "bold",
              marginBottom: "1rem",
              fontSize: "1rem",
            }}
          >
            ✅ Changes saved!
          </p>
        )}

        {/* Logged-in: Save + Save GC Only + Reset Password */}
        {!isGuest && (
          <div
            style={{
              display: "flex",
              gap: "0.75rem",
              flexWrap: "wrap",
              justifyContent: "center",
            }}
          >
            <button
              className="boutique-primary-btn"
              onClick={handleSave}
              style={{
                marginTop: "0.5rem",
                width: "260px",
                padding: "0.65rem",
                fontSize: "0.95rem",
                borderRadius: "12px",
              }}
            >
              Save Changes
            </button>

              <button
                className="boutique-secondary-btn"
                onClick={async () => {
                  if (locked) {
                    setBannerMsg(
                      "Guest count is locked after a booking. Use the Guest Count Scroll to request a change."
                    );
                    return;
                  }
                  const n = Math.max(
                    0,
                    Math.min(
                      250,
                      Math.floor(Number(gc) || 0)
                    )
                  );
                  await setGuestCount(n);
                  setOriginalGC(n);
                  setChangesSaved(true);
                  setTimeout(
                    () => setChangesSaved(false),
                    2000
                  );
                }}
                style={{
                  marginTop: "0.5rem",
                  width: "260px",
                  padding: "0.65rem",
                  fontSize: "0.95rem",
                  borderRadius: "12px",
                }}
              >
                Save Guest Count Only
              </button>

            <button
              className="boutique-back-btn"
              onClick={handlePasswordReset}
              type="button"
              title="Send a password reset email"
              style={{
                marginTop: "0.5rem",
                width: "260px",
                padding: "0.65rem",
                fontSize: "0.95rem",
                borderRadius: "12px",
              }}
            >
              Reset Password
            </button>
          </div>
        )}

        {/* Guest: Create Account + Google */}
        {isGuest && (
          <>
            <button
              className="boutique-primary-btn"
              onClick={handleGuestSignup}
              style={{
                marginTop: "1rem",
                width: "80%",
                maxWidth: "300px",
                padding: "0.65rem",
                fontSize: "0.95rem",
                borderRadius: "12px",
              }}
            >
              Create Account
            </button>

            <div style={{ marginTop: "1rem" }}>
              <img
                src={`${import.meta.env.BASE_URL}assets/images/google_signup.png`}
                alt="Sign up with Google"
                onClick={handleGoogleSignup}
                style={{
                  width: "80%",
                  maxWidth: "300px",
                  display: "block",
                  margin: "0 auto",
                  cursor: "pointer",
                }}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default AccountScreen;