import React, { useEffect } from "react";
import { getAuth } from "firebase/auth";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../../../../firebase/firebaseConfig";
import playMagicSound from "../../../../utils/playMagicSound";

interface Props {
  onBookDessertNow?: () => void | Promise<void>;
  onClose: () => void;
}

const BatesCateringThankYou: React.FC<Props> = ({ onBookDessertNow, onClose }) => {
  useEffect(() => {
    // 1) Sparkle sound
    try {
      const res = playMagicSound() as void | Promise<void>;
      Promise.resolve(res).catch(() => {/* ignore */});
    } catch {/* ignore */}

    // 2) Local flags (guest-safe) + breadcrumb
    try {
      localStorage.setItem("batesCateringBooked", "true");      // venue-specific
      localStorage.setItem("batesJustBookedCatering", "true");
      localStorage.setItem("yumCateringBooked", "true");        // ✅ generic (new)
      localStorage.setItem("yumBookedCatering", "true");        // ✅ legacy support
      localStorage.setItem("yumLastCompleted", "catering");     // ✅ drives HUD image
      localStorage.setItem("yumStep", "batesCateringThankYou");
    } catch {}

    // 3) Firestore progress + booking flag (if logged in)
    const user = getAuth().currentUser;
    if (user) {
      updateDoc(doc(db, "users", user.uid), {
        "progress.yumYum.step": "batesCateringThankYou",
        "bookings.catering": true, // ✅ mark catering booked
      }).catch(() => {});
    }

    // 4) Fan-out events for instant UI updates
    window.dispatchEvent(new Event("purchaseMade"));
    window.dispatchEvent(new Event("cateringCompletedNow")); // ✅ new explicit event
    window.dispatchEvent(new Event("yum:lastCompleted"));    // optional breadcrumb event
    window.dispatchEvent(
      new CustomEvent("bookingsChanged", { detail: { catering: true } })
    );
  }, []);

  const handleBookDesserts = async () => {
    // move user into the dessert flow
    try {
      localStorage.setItem("yumStep", "dessertCart");
    } catch {}

    const user = getAuth().currentUser;
    if (user) {
      try {
        await updateDoc(doc(db, "users", user.uid), {
          "progress.yumYum.step": "dessertCart",
        });
      } catch {
        /* ignore */
      }
    }

    if (onBookDessertNow) {
      try {
        await Promise.resolve(onBookDessertNow());
      } catch { /* ignore */ }
      return;
    }

    // fallback launcher
    onClose?.();
    setTimeout(() => {
      try {
        localStorage.setItem("yumBookingType", "dessert");
        localStorage.setItem("yumActiveBookingType", "dessert");
      } catch {}
      window.dispatchEvent(
        new CustomEvent("openDesserts", {
          detail: { vendor: "whiskAndPaddle" },
        })
      );
    }, 0);
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        width: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem 1rem",
        boxSizing: "border-box",
      }}
    >
      <div
        className="pixie-card pixie-card--modal"
        style={{ maxWidth: 700, position: "relative" }}
      >
        {/* 🩷 Pink X Close */}
        <button
          className="pixie-card__close"
          onClick={onClose}
          aria-label="Close"
        >
          <img
            src={`${import.meta.env.BASE_URL}assets/icons/pink_ex.png`}
            alt="Close"
          />
        </button>

        <div
          className="pixie-card__body"
          style={{
            textAlign: "center",
            padding: "2rem 2.5rem",
          }}
        >
          <video
            src={`${import.meta.env.BASE_URL}assets/videos/yum_thanks.mp4`}
            autoPlay
            loop
            muted
            playsInline
            className="px-media"
            style={{
              maxWidth: 180,
              margin: "0 auto 12px",
              borderRadius: 12,
              display: "block",
            }}
          />

          <h2 className="px-title-lg" style={{ marginBottom: 8 }}>
            Catering Locked &amp; Confirmed!
          </h2>

          <p className="px-prose-narrow" style={{ marginBottom: 8 }}>
            You'll find your receipt and selection confirmation in your{" "}
            <em>Documents</em> folder.
          </p>

          <p className="px-prose-narrow" style={{ marginBottom: 14 }}>
            Ready to add a sweet finish? Click the little button below to book
            desserts!
          </p>

          <div className="px-cta-col" style={{ marginTop: 6 }}>
            <button
              className="boutique-primary-btn"
              onClick={handleBookDesserts}
              style={{ width: 240 }}
            >
              🍰 Book Desserts
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BatesCateringThankYou;