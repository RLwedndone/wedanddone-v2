// src/components/NewYumBuild/CustomVenues/ValleyHo/ValleyHoCateringThankYou.tsx
import React, { useEffect } from "react";
import { getAuth } from "firebase/auth";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../../../../firebase/firebaseConfig";
import playMagicSound from "../../../../utils/playMagicSound";

interface Props {
  onClose: () => void;
}

const ValleyHoCateringThankYou: React.FC<Props> = ({ onClose }) => {
  useEffect(() => {
    // 1) ✨ chime (non-blocking)
    try {
      const res = playMagicSound() as void | Promise<void>;
      Promise.resolve(res).catch(() => { /* ignore */ });
    } catch { /* ignore */ }

    // 2) Local flags + generic cues + breadcrumb for HUD
    try {
      // venue-specific
      localStorage.setItem("valleyHoCateringBooked", "true");
      localStorage.setItem("valleyHoJustBookedCatering", "true");

      // generic + legacy + HUD breadcrumb
      localStorage.setItem("yumCateringBooked", "true");    // ✅ generic
      localStorage.setItem("yumBookedCatering", "true");    // ✅ legacy support
      localStorage.setItem("yumLastCompleted", "catering"); // ✅ drives HUD image

      localStorage.setItem("yumStep", "valleyHoCateringThankYou");
    } catch { /* ignore */ }

    // 3) Firestore progress + booking flag
    const user = getAuth().currentUser;
    if (user) {
      updateDoc(doc(db, "users", user.uid), {
        "progress.yumYum.step": "valleyHoCateringThankYou",
        "bookings.catering": true, // ✅ mark catering booked
      }).catch(() => {});
    }

    // 4) Fan-out so dashboard/booking path update instantly
    window.dispatchEvent(new Event("purchaseMade"));
    window.dispatchEvent(new Event("cateringCompletedNow"));
    window.dispatchEvent(new Event("yum:lastCompleted")); // breadcrumb event
    window.dispatchEvent(new CustomEvent("bookingsChanged", { detail: { catering: true } }));
  }, []);

  const handleClose = () => {
    try {
      localStorage.setItem("yumStep", "home");
      window.dispatchEvent(new Event("yumStepChanged"));
    } catch { /* ignore */ }
    onClose();
  };

  return (
    <div className="pixie-card pixie-card--modal" style={{ maxWidth: 700, position: "relative" }}>
      {/* 🩷 Pink X Close */}
      <button className="pixie-card__close" onClick={handleClose} aria-label="Close">
        <img src={`${import.meta.env.BASE_URL}assets/icons/pink_ex.png`} alt="Close" />
      </button>

      <div className="pixie-card__body" style={{ textAlign: "center" }}>
        <video
          src={`${import.meta.env.BASE_URL}assets/videos/yum_thanks.mp4`}
          autoPlay
          loop
          muted
          playsInline
          className="px-media"
          style={{ maxWidth: 180, margin: "0 auto 12px", borderRadius: 12, display: "block" }}
        />

        <h2 className="px-title-lg" style={{ marginBottom: 8 }}>
          Catering Locked &amp; Confirmed!
        </h2>

        <p className="px-prose-narrow" style={{ marginBottom: 8 }}>
          You'll find your receipt and selection confirmation in your <em>Documents</em> folder.
        </p>

        {/* Valley Ho bakery note */}
        <div
          className="px-prose-narrow"
          style={{
            margin: "10px auto 14px",
            maxWidth: 560,
            textAlign: "left",
            background: "#f7f9ff",
            border: "1px solid #e3ebff",
            borderRadius: 12,
            padding: "12px 14px",
          }}
        >
          <p style={{ marginTop: 0 }}>
            <strong>Custom Cake at Hotel Valley Ho</strong>
          </p>
          <p style={{ marginBottom: 8 }}>
            Wedding cake or cupcake pricing is included in your wedding menu pricing. If you’re
            interested in a custom design that goes beyond the included package, any additional
            cost will be assessed by the bakery.
          </p>
          <p style={{ marginBottom: 8 }}>
            To schedule your cake tasting, please contact PJ directly. Appointments are required,
            and we recommend meeting <strong>3–6 months</strong> before your wedding.
          </p>
          <div style={{ lineHeight: 1.6 }}>
            <div>
              <strong>Contact:</strong>{" "}
              <a href="tel:14807378676">480-737-8676</a> &nbsp;|&nbsp;{" "}
              <a href="mailto:pj@paulajacqueline.com">pj@paulajacqueline.com</a>
            </div>
            <div>
              <strong>Address:</strong> 4151 North Marshall Way, Suite 8, Scottsdale, AZ 85251
            </div>
            <div>
              <strong>Website:</strong>{" "}
              <a href="https://paulajacqueline.com" target="_blank" rel="noreferrer">
                paulajacqueline.com
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ValleyHoCateringThankYou;