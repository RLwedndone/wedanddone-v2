// src/components/Account/AccountScreen.tsx
import React, { useState, useEffect } from "react";
import { db } from "../../firebase/firebaseConfig";
import { doc, getDoc, setDoc } from "firebase/firestore";
import {
  getAuth,
  createUserWithEmailAndPassword,
  updateProfile,
  sendPasswordResetEmail,
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged,
} from "firebase/auth";
import { saveUserProfile } from "../../utils/saveUserProfile";
import {
  getGuestState,
  setGuestCount,
  type GuestLockReason,
} from "../../utils/guestCountStore";

// ✅ Use non-resumable upload to avoid “Saving photo… 0%” hangs
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "../../firebase/firebaseConfig";

const DEFAULT_AVATAR = `${import.meta.env.BASE_URL}assets/images/profile_placeholder.png`;

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

// Pretty date helper, e.g. "December 12th, 2027"
function prettyWeddingDate(ymd: string | null | undefined) {
  if (!ymd) return "";
  const d = new Date(`${ymd}T12:00:00`);
  if (isNaN(d.getTime())) return ymd;

  const month = d.toLocaleString("en-US", { month: "long" });
  const dayNum = d.getDate();
  const year = d.getFullYear();

  const suffix =
    dayNum % 10 === 1 && dayNum !== 11
      ? "st"
      : dayNum % 10 === 2 && dayNum !== 12
      ? "nd"
      : dayNum % 10 === 3 && dayNum !== 13
      ? "rd"
      : "th";

  return `${month} ${dayNum}${suffix}, ${year}`;
}

const reqStar: React.CSSProperties = {
  color: "#2c62ba",
  fontWeight: 700,
  marginLeft: 4,
};
const Required = () => <span style={reqStar}>*</span>;

type AccountScreenProps = {
  onClose: () => void;
};

const AccountScreen: React.FC<AccountScreenProps> = ({ onClose }) => {
  const [firstName, setFirstName] = useState("Magic");
  const [lastName, setLastName] = useState("User");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [profileLoaded, setProfileLoaded] = useState(false);

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [fianceFirst, setFianceFirst] = useState("");
  const [fianceLast, setFianceLast] = useState("");
  const [phone, setPhone] = useState("");
  const [profileImage, setProfileImage] = useState(DEFAULT_AVATAR);
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

  // NEW: final lock + increase request (from user doc)
  const [finalLocked, setFinalLocked] = useState<boolean>(false);
  const [increaseRequested, setIncreaseRequested] = useState<number | null>(
    null
  );

  // Inline validation errors (for guest sign-up fields)
  const [fieldErrors, setFieldErrors] = useState<{
    email?: string;
    password?: string;
    confirmPassword?: string;
    firstName?: string;
    lastName?: string;
  }>({});

  // ✅ Helper: if img is a base64 data URL, resize + upload to Storage and return URL
  // (Uses uploadBytes to avoid resumable “stuck at 0%” issues.)
  const uploadProfileImageIfDataUrl = async (uid: string, img: string) => {
    if (!img || !img.startsWith("data:image/")) return img;

    // base64 -> blob
    const res = await fetch(img);
    const originalBlob = await res.blob();
    const bitmap = await createImageBitmap(originalBlob);

    const MAX = 512;
    const scale = Math.min(MAX / bitmap.width, MAX / bitmap.height, 1);
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;

    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas not supported");
    ctx.drawImage(bitmap, 0, 0, w, h);

    const jpegBlob: Blob = await new Promise((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("Image conversion failed"))),
        "image/jpeg",
        0.85
      );
    });

    const fileRef = ref(storage, `users/${uid}/profile.jpg`);

    await uploadBytes(fileRef, jpegBlob, {
      contentType: "image/jpeg",
      cacheControl: "public,max-age=3600",
    });

    return await getDownloadURL(fileRef);
  };

  // ─────────────────────────────────────────────────────────────
  // Load profile (auth-safe)
  // ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const auth = getAuth();

    const unsub = onAuthStateChanged(auth, async (user) => {
      // default: not loaded yet (only set true once we finish this callback)
      try {
        if (!user) {
          setIsGuest(true);
    
          // guest photo draft restore
          try {
            const draft = localStorage.getItem("wd_profileImageDraft");
            if (draft) setProfileImage(draft);
          } catch {}
    
          setProfileLoaded(true);
          return;
        }
    
        setIsGuest(false);
    
        const userDoc = await getDoc(doc(db, "users", user.uid));
    
        // ✅ Even if their Firestore doc doesn't exist yet, we still finish loading
        if (!userDoc.exists()) {
          // (Optional) keep defaults, but at least keep email in sync
          setEmail(user.email || "");
          setProfileLoaded(true);
          return;
        }
    
        const data = userDoc.data() as any;
    
        setFirstName(data.firstName || "");
        setLastName(data.lastName || "");
        setEmail(data.email || user.email || "");
        setProfileImage(data.profileImage || DEFAULT_AVATAR);
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
    
        setFinalLocked(!!data.guestCountFinalLocked);
        setIncreaseRequested(
          typeof data.guestCountIncreaseRequested === "number"
            ? data.guestCountIncreaseRequested
            : null
        );
    
        setProfileLoaded(true);
      } catch (err) {
        console.error("❌ AccountScreen profile load failed:", err);
        // ✅ Don’t trap the UI in loading if Firestore hiccups
        setProfileLoaded(true);
      }
    });

    return () => unsub();
  }, []);

  // ─────────────────────────────────────────────────────────────
  // Load guestCount from single-source store + keep in sync
  // ─────────────────────────────────────────────────────────────
  useEffect(() => {
    let mounted = true;

    function lockBanner(reasons: GuestLockReason[]) {
      if (!reasons || reasons.length === 0) return "Guest count is locked.";
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

      const current = Number((st as any).value ?? 0);
      const isLocked = Boolean((st as any).locked);

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
  // Photo autosave handler
  // ─────────────────────────────────────────────────────────────
  const handlePhotoChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // allow re-selecting same file
    event.currentTarget.value = "";

    const auth = getAuth();
    const user = auth.currentUser;

    // Guests: just keep a local draft preview
    if (!user) {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        if (!dataUrl) return;
        setProfileImage(dataUrl);
        try {
          localStorage.setItem("wd_profileImageDraft", dataUrl);
        } catch {}
        setBannerMsg("Photo saved for now — create your account to lock it in. ✨");
      };
      reader.readAsDataURL(file);
      return;
    }

    try {
      setBannerMsg("Saving photo…");
      setChangesSaved(false);

      // Resize client-side so uploads are fast
      const bitmap = await createImageBitmap(file);

      const MAX = 512;
      const scale = Math.min(MAX / bitmap.width, MAX / bitmap.height, 1);
      const w = Math.round(bitmap.width * scale);
      const h = Math.round(bitmap.height * scale);

      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;

      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas not supported");
      ctx.drawImage(bitmap, 0, 0, w, h);

      const blob: Blob = await new Promise((resolve, reject) => {
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error("Image conversion failed"))),
          "image/jpeg",
          0.85
        );
      });

      const fileRef = ref(storage, `users/${user.uid}/profile.jpg`);

      await uploadBytes(fileRef, blob, {
        contentType: "image/jpeg",
        cacheControl: "public,max-age=3600",
      });

      const url = await getDownloadURL(fileRef);

      // Update UI + Firestore
      setProfileImage(url);

      await setDoc(
        doc(db, "users", user.uid),
        { profileImage: url },
        { merge: true }
      );

      setBannerMsg("✅ Photo saved!");
      setChangesSaved(true);
      window.setTimeout(() => setChangesSaved(false), 1500);
    } catch (err: any) {
      console.error("❌ Photo save failed:", err);
      const code = err?.code ? ` (${err.code})` : "";
      setBannerMsg(`Couldn’t save your photo${code}.`);
    }
  };

  // ─────────────────────────────────────────────────────────────
  // Guest account creation
  // ─────────────────────────────────────────────────────────────
  const handleGuestSignup = async () => {
    setFieldErrors({});
    setBannerMsg(null);

    if (weddingDate && isPastYMD(weddingDate)) {
      setDateError("Please choose a future date.");
      return;
    }

    const errors: {
      email?: string;
      password?: string;
      confirmPassword?: string;
      firstName?: string;
      lastName?: string;
    } = {};

    if (!firstName.trim()) errors.firstName = "First name is required.";
    if (!lastName.trim()) errors.lastName = "Last name is required.";

    if (!email.trim()) errors.email = "Email is required.";
    else if (!/^\S+@\S+\.\S+$/.test(email.trim()))
      errors.email = "Please enter a valid email address.";

    if (!password) errors.password = "Password is required.";
    else if (password.length < 6)
      errors.password = "Password must be at least 6 characters.";

    if (!confirmPassword) errors.confirmPassword = "Please confirm your password.";
    else if (password && confirmPassword !== password)
      errors.confirmPassword = "Passwords do not match.";

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    const auth = getAuth();
    try {
      const userCred = await createUserWithEmailAndPassword(
        auth,
        email.trim(),
        password
      );

      await updateProfile(userCred.user, {
        displayName: `${firstName.trim()} ${lastName.trim()}`,
      });

      // If guest picked an image, it might be base64 → upload + use URL
      let finalProfileImage = profileImage;
      try {
        finalProfileImage = await uploadProfileImageIfDataUrl(
          userCred.user.uid,
          profileImage
        );
        setProfileImage(finalProfileImage);
        try {
          localStorage.removeItem("wd_profileImageDraft");
        } catch {}
      } catch (e) {
        console.warn("⚠️ Photo upload during signup failed (non-blocking):", e);
      }

      await saveUserProfile({
        uid: userCred.user.uid,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        profileImage: finalProfileImage,
        fianceFirst,
        fianceLast,
        phone,
        weddingDate,
        dayOfWeek,
        guestCount: null,
      });

      const n = Math.max(0, Math.min(250, Math.floor(Number(gc) || 0)));
      await setGuestCount(n);

      setIsGuest(false);
      setAccountCreated(true);
      setPassword("");
      setConfirmPassword("");
      setTimeout(() => setAccountCreated(false), 3000);
    } catch (err: any) {
      console.error("❌ Failed to create account:", err);

      let message = "Account creation failed. Please try again.";

      if (err?.code === "auth/email-already-in-use") {
        message =
          "Looks like you already have an account with this email. Try logging in or resetting your password.";
      }

      setBannerMsg(message);
    }
  };

  // ─────────────────────────────────────────────────────────────
  // Google signup
  // ─────────────────────────────────────────────────────────────
  const handleGoogleSignup = async () => {
    const auth = getAuth();
    const provider = new GoogleAuthProvider();

    try {
      const result = await signInWithPopup(auth, provider);
      const u = result.user;

      const [given, ...rest] = (u.displayName || "Magic User").split(" ");
      const first = given || "Magic";
      const last = rest.join(" ") || "User";

      const photo = u.photoURL || DEFAULT_AVATAR;

      await saveUserProfile({
        uid: u.uid,
        firstName: first,
        lastName: last,
        email: u.email || "",
        profileImage: photo,
        fianceFirst: "",
        fianceLast: "",
        phone: "",
        weddingDate: "",
        dayOfWeek: "",
        guestCount: null,
      });

      setIsGuest(false);
      setEmail(u.email || "");
      setFirstName(first);
      setLastName(last);
      setProfileImage(photo);
      setAccountCreated(true);
      setTimeout(() => setAccountCreated(false), 3000);
    } catch (err: any) {
      if (err?.code === "auth/popup-closed-by-user") return;

      let message = "Google sign-up failed. Please try again.";

      if (err?.code === "auth/account-exists-with-different-credential") {
        message =
          "An account with this email already exists under a different sign-in method. Try signing in with email and password instead.";
      }

      console.error("❌ Google sign-up failed:", err);
      setBannerMsg(message);
    }
  };

  // ─────────────────────────────────────────────────────────────
  // Save changes (logged-in)
  // ─────────────────────────────────────────────────────────────
  const handleSave = async () => {
    setBannerMsg(null);

    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) {
      setBannerMsg("Please create an account first (email + password).");
      return;
    }

    if (!dateLocked && weddingDate && isPastYMD(weddingDate)) {
      setDateError("Please choose a future date.");
      setBannerMsg(
        "Your wedding date appears to be in the past. Please update it before saving."
      );
      return;
    }

    try {
      // Ensure profileImage is a URL (not base64) before writing profile
      let finalProfileImage = profileImage;
      if (finalProfileImage?.startsWith("data:image/")) {
        setBannerMsg("Saving photo…");
        finalProfileImage = await uploadProfileImageIfDataUrl(
          user.uid,
          finalProfileImage
        );
        setProfileImage(finalProfileImage);
        await setDoc(
          doc(db, "users", user.uid),
          { profileImage: finalProfileImage },
          { merge: true }
        );
        setBannerMsg(null);
      }

      await saveUserProfile({
        uid: user.uid,
        firstName,
        lastName,
        email,
        profileImage: finalProfileImage,
        fianceFirst,
        fianceLast,
        phone,
        weddingDate,
        dayOfWeek,
        guestCount: null,
      });

      const gcChanged = Number(gc) !== Number(originalGC);

      if (locked && gcChanged) {
        window.dispatchEvent(
          new CustomEvent("openUserMenuScreen", { detail: "guestListScroll" })
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

        await setGuestCount(n);
        setGC(n);
        setOriginalGC(n);
      }

      setChangesSaved(true);
      setTimeout(() => setChangesSaved(false), 3000);
    } catch (error) {
      console.error("❌ Failed to save account info:", error);
      setBannerMsg("Something went wrong saving your changes. Please try again.");
    }
  };

  const handlePasswordReset = async () => {
    const auth = getAuth();
    if (!email) return alert("No email address found.");

    try {
      await sendPasswordResetEmail(auth, email);
      alert("📩 A password reset link has been sent to your email.");
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
            onClick={() => document.getElementById("fileInput")?.click()}
          >
            {!profileLoaded ? (
  <div
    style={{
      width: 120,
      height: 120,
      borderRadius: "50%",
      background: "#eee",
      display: "inline-block",
    }}
  />
) : (
  <img
    src={profileImage || DEFAULT_AVATAR}
    alt="Profile"
    style={{
      width: 120,
      height: 120,
      borderRadius: "50%",
      objectFit: "cover",
    }}
  />
)}
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
          {/* First Name */}
          <label>First Name {isGuest && <Required />}</label>
          <input
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            style={inputStyle}
          />
          {fieldErrors.firstName && (
            <p
              style={{
                color: "#d33",
                fontSize: "0.8rem",
                marginTop: "-0.5rem",
                marginBottom: "0.75rem",
              }}
            >
              {fieldErrors.firstName}
            </p>
          )}

          {/* Last Name */}
          <label>Last Name {isGuest && <Required />}</label>
          <input
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            style={inputStyle}
          />
          {fieldErrors.lastName && (
            <p
              style={{
                color: "#d33",
                fontSize: "0.8rem",
                marginTop: "-0.5rem",
                marginBottom: "0.75rem",
              }}
            >
              {fieldErrors.lastName}
            </p>
          )}

          {/* Email */}
          <label>Email {isGuest && <Required />}</label>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={inputStyle}
            disabled={!isGuest}
          />
          {fieldErrors.email && (
            <p
              style={{
                color: "#d33",
                fontSize: "0.8rem",
                marginTop: "-0.5rem",
                marginBottom: "0.75rem",
              }}
            >
              {fieldErrors.email}
            </p>
          )}

          {/* Guest sign-up only: password + confirm password */}
          {isGuest && (
            <>
              <label>
                Password <Required />
              </label>
              <div style={{ position: "relative", marginBottom: "0.5rem" }}>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{ ...inputStyle, marginBottom: 0, paddingRight: "3rem" }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  style={{
                    position: "absolute",
                    right: "0.75rem",
                    top: "50%",
                    transform: "translateY(-50%)",
                    border: "none",
                    background: "none",
                    fontSize: "0.8rem",
                    color: "#2c62ba",
                    cursor: "pointer",
                  }}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
              {fieldErrors.password && (
                <p
                  style={{
                    color: "#d33",
                    fontSize: "0.8rem",
                    marginTop: "0.25rem",
                    marginBottom: "0.75rem",
                  }}
                >
                  {fieldErrors.password}
                </p>
              )}

              <label>
                Confirm Password <Required />
              </label>
              <div style={{ position: "relative", marginBottom: "0.5rem" }}>
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  style={{ ...inputStyle, marginBottom: 0, paddingRight: "3rem" }}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((v) => !v)}
                  style={{
                    position: "absolute",
                    right: "0.75rem",
                    top: "50%",
                    transform: "translateY(-50%)",
                    border: "none",
                    background: "none",
                    fontSize: "0.8rem",
                    color: "#2c62ba",
                    cursor: "pointer",
                  }}
                >
                  {showConfirmPassword ? "Hide" : "Show"}
                </button>
              </div>
              {fieldErrors.confirmPassword && (
                <p
                  style={{
                    color: "#d33",
                    fontSize: "0.8rem",
                    marginTop: "0.25rem",
                    marginBottom: "0.75rem",
                  }}
                >
                  {fieldErrors.confirmPassword}
                </p>
              )}
            </>
          )}

          <label>Fiancé’s First Name</label>
          <input
            value={fianceFirst}
            onChange={(e) => setFianceFirst(e.target.value)}
            style={inputStyle}
          />

          <label>Fiancé’s Last Name</label>
          <input
            value={fianceLast}
            onChange={(e) => setFianceLast(e.target.value)}
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
                {prettyWeddingDate(weddingDate)} —{" "}
                <span style={{ color: "#2c62ba" }}>{dayOfWeek}</span>
              </p>
              <p
                style={{
                  fontSize: ".9rem",
                  fontStyle: "italic",
                  color: "#666",
                  marginBottom: "1.5rem",
                }}
              >
                Your date is locked after a booking. Contact us if you need to make a change!
              </p>
            </>
          ) : (
            <>
              <input
                type="date"
                value={weddingDate}
                min={todayYMD}
                onChange={(e) => {
                  const date = e.target.value;
                  setWeddingDate(date);

                  if (date && !isNaN(new Date(`${date}T12:00:00`).getTime())) {
                    const weekday = new Date(`${date}T12:00:00`).toLocaleDateString(
                      "en-US",
                      { weekday: "long" }
                    );
                    setDayOfWeek(weekday);
                  } else {
                    setDayOfWeek("");
                  }

                  if (date && isPastYMD(date)) setDateError("Please choose a future date.");
                  else setDateError(null);
                }}
                style={{
                  ...inputStyle,
                  fontFamily: "inherit",
                  borderColor: dateError ? "#d33" : "#ccc",
                }}
                aria-invalid={!!dateError}
                aria-describedby={dateError ? "weddingDateError" : undefined}
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

          {/* Guest Count section */}
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
                    marginBottom: ".5rem",
                  }}
                />
                <div style={{ fontSize: ".9rem", color: "#666", marginBottom: ".5rem" }}>
                  Locked after:{" "}
                  <strong>{(lockReasons || []).join(", ") || "a booking"}</strong>.
                </div>

                {finalLocked && increaseRequested == null && (
                  <div style={{ fontSize: ".9rem", color: "#2c62ba", marginBottom: ".75rem" }}>
                    Guest count confirmed: <strong>{gc || 0}</strong> guests
                  </div>
                )}

                {!finalLocked && increaseRequested != null && (
                  <div style={{ fontSize: ".9rem", color: "#c0392b", marginBottom: ".75rem" }}>
                    Guest count increase requested: <strong>{increaseRequested}</strong> guests
                  </div>
                )}
              </>
            ) : (
              <>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={String(gc)}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/[^\d]/g, "");
                    const n = raw === "" ? 0 : Number(raw);
                    setGC(Number.isFinite(n) ? n : 0);
                  }}
                  onBlur={() => {
                    const GLOBAL_MAX = 250;
                    let n = Math.floor(Number(gc) || 0);
                    if (n < 0) n = 0;
                    if (n > GLOBAL_MAX) n = GLOBAL_MAX;
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
                    marginTop: "-0.5rem",
                    marginBottom: "1rem",
                  }}
                >
                  Max allowed: <strong>250</strong>
                </div>
              </>
            )}
          </section>
        </div>

        {/* Status banners */}
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
          <p style={{ color: "#2c62ba", fontWeight: "bold", marginBottom: "1rem", fontSize: "1rem" }}>
            ✨ Account created!
          </p>
        )}
        {changesSaved && (
          <p style={{ color: "#2c62ba", fontWeight: "bold", marginBottom: "1rem", fontSize: "1rem" }}>
            ✅ Changes saved!
          </p>
        )}

        {/* Logged-in: Save + Reset Password */}
        {!isGuest && (
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", justifyContent: "center" }}>
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

              {/* Arizona-only notice */}
              <div style={{ marginTop: "2rem", textAlign: "center" }}>
                <img
                  src={`${import.meta.env.BASE_URL}assets/images/AZLogo.png`}
                  alt="Wed&Done Arizona logo"
                  style={{
                    width: "140px",
                    maxWidth: "60%",
                    display: "block",
                    margin: "0 auto 0.5rem",
                  }}
                />
                <p
                  style={{
                    fontSize: "0.85rem",
                    lineHeight: 1.4,
                    color: "#666",
                    maxWidth: "360px",
                    margin: "0 auto",
                  }}
                >
                  ✨ Just a note: Wed&Done is currently all about Arizona weddings.
                  We&apos;re growing our magic, but for now, we&apos;re sprinkling
                  fairy dust only in Arizona! ✨
                </p>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default AccountScreen;