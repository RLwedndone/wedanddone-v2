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
    // 1) Chime
    try {
      const res = playMagicSound() as void | Promise<void>;
      Promise.resolve(res).catch(() => {/* ignore */});
    } catch {/* ignore */}

    // 2) Local flags + Firestore progress
    try {
      localStorage.setItem("valleyHoCateringBooked", "true");
      localStorage.setItem("valleyHoJustBookedCatering", "true");
      localStorage.setItem("yumStep", "valleyHoCateringThankYou");
    } catch {}

    const user = getAuth().currentUser;
    if (user) {
      updateDoc(doc(db, "users", user.uid), {
        "progress.yumYum.step": "valleyHoCateringThankYou",
      }).catch(() => {});
    }

    // 3) Fan-out events
    window.dispatchEvent(new Event("purchaseMade"));
    window.dispatchEvent(new Event("cateringCompletedNow"));
    window.dispatchEvent(new CustomEvent("bookingsChanged", { detail: { catering: true } }));
  }, []);

  return (
    <div className="pixie-card pixie-card--modal" style={{ maxWidth: 700 }}>
      {/* 🩷 Pink X Close */}
      <button className="pixie-card__close" onClick={onClose} aria-label="Close">
        <img src="/assets/icons/pink_ex.png" alt="Close" />
      </button>

      <div className="pixie-card__body" style={{ textAlign: "center" }}>
        <video
          src="/assets/videos/yum_thanks.mp4"
          autoPlay
          loop
          muted
          playsInline
          className="px-media"
          style={{ maxWidth: 180, margin: "0 auto 12px", borderRadius: 12 }}
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