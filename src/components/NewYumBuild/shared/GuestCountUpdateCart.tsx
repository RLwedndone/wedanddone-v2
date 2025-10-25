// src/components/NewYumBuild/shared/GuestCountUpdateCart.tsx
import React, { useEffect, useState } from "react";
import { auth, db } from "../../../firebase/firebaseConfig";
import { doc, getDoc } from "firebase/firestore";
import { Elements } from "@stripe/react-stripe-js";
import { stripePromise } from "../../../utils/stripePromise";
import CheckoutForm from "../../../CheckoutForm";

const GuestCountUpdateCart: React.FC = () => {
  const [currentGuestCount, setCurrentGuestCount] = useState(0);
  const [additionalGuests, setAdditionalGuests] = useState(0);
  const [cateringBooked, setCateringBooked] = useState(false);
  const [dessertBooked, setDessertBooked] = useState(false);
  const [loading, setLoading] = useState(true);

  // ─────────────────────────────────────────────
  // Load current guest info & booking status
  // ─────────────────────────────────────────────
  useEffect(() => {
    const fetchUserBookingStatus = async () => {
      const user = auth.currentUser;
      if (!user) return;

      const userRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userRef);
      const userData = userSnap.data();

      setCurrentGuestCount(userData?.guestCount || 0);
      setCateringBooked(!!userData?.bookings?.catering);
      setDessertBooked(!!userData?.bookings?.dessert);
      setLoading(false);
    };

    fetchUserBookingStatus();
  }, []);

  if (loading) {
    return (
      <div className="pixie-card pixie-card--modal" style={{ textAlign: "center" }}>
        <p>Loading guest info...</p>
      </div>
    );
  }

  const totalGuests = currentGuestCount + additionalGuests;

  const getAddOnCost = () => {
    const perGuest =
      cateringBooked && dessertBooked
        ? 72
        : cateringBooked
        ? 65
        : dessertBooked
        ? 7
        : 0;
    return perGuest * additionalGuests;
  };

  const totalDue = getAddOnCost();

  // ─────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────
  return (
    <div className="pixie-card pixie-card--modal" style={{ maxWidth: 700 }}>
      {/* 🩷 Pink X Close */}
      <button
        className="pixie-card__close"
        onClick={() => window.dispatchEvent(new Event("closeGuestCountModal"))}
        aria-label="Close"
      >
        <img src={`${import.meta.env.BASE_URL}assets/icons/pink_ex.png`} alt="Close" />
      </button>

      <div className="pixie-card__body" style={{ textAlign: "center" }}>
        <video
          src={`${import.meta.env.BASE_URL}assets/videos/yum_cart.mp4`}
          autoPlay
          loop
          muted
          playsInline
          style={{
            width: "100%",
            maxWidth: 320,
            margin: "0 auto 1.5rem",
            borderRadius: 12,
            display: "block",
          }}
        />

        <h2
          className="px-title"
          style={{
            fontFamily: "'Jenna Sue', cursive",
            fontSize: "2rem",
            color: "#2c62ba",
            textAlign: "center",
            marginBottom: "0.5rem",
          }}
        >
          Add Guests
        </h2>

        <p className="px-prose-narrow" style={{ marginBottom: "1rem" }}>
          Current Guest Count: <strong>{currentGuestCount}</strong>
          <br />
          Additional Guests: <strong>{additionalGuests}</strong>
          <br />
          Total After Update: <strong>{totalGuests}</strong>
          <br />
          {cateringBooked && (
            <>
              Catering Add-On: $
              {(additionalGuests * 65).toFixed(2)}
              <br />
            </>
          )}
          {dessertBooked && (
            <>
              Dessert Add-On: $
              {(additionalGuests * 7).toFixed(2)}
              <br />
            </>
          )}
          <strong>Total Due Today: ${totalDue.toFixed(2)}</strong>
        </p>

        <div style={{ marginBottom: "1.5rem" }}>
          <label htmlFor="addGuests">Add More Guests:</label>
          <input
            id="addGuests"
            type="number"
            min="0"
            value={additionalGuests}
            onChange={(e) =>
              setAdditionalGuests(
                parseInt(e.target.value) || 0
              )
            }
            style={{
              width: "80px",
              fontSize: "1.1rem",
              marginLeft: "0.5rem",
            }}
          />
        </div>

        {/* Stripe checkout for add-on */}
        <div style={{ marginTop: "1rem" }}>
          <Elements stripe={stripePromise}>
            <CheckoutForm
              total={totalDue}
              onSuccess={async () => {
                alert("Guest add-on purchase complete!");
                window.dispatchEvent(new Event("purchaseMade"));
              }}
              setStepSuccess={() => {}}
            />
          </Elements>
        </div>
      </div>
    </div>
  );
};

export default GuestCountUpdateCart;