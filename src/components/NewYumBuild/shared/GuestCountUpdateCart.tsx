import React, { useEffect, useState } from "react";
import { auth, db } from "../../../firebase/firebaseConfig";
import { doc, getDoc } from "firebase/firestore";
import { Elements } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import CheckoutForm from "../../../CheckoutForm";

const stripePromise = loadStripe("pk_test_51Kh0qWD48xRO93UMFwIMguVpNpuICcWmVvZkD1YvK7naYFwLlhhiFtSU5requdOcmj1lKPiR0I0GhFgEAIhUVENZ00vFo6yI20");

const GuestCountUpdateCart = () => {
  const [currentGuestCount, setCurrentGuestCount] = useState(0);
  const [additionalGuests, setAdditionalGuests] = useState(0);
  const [cateringBooked, setCateringBooked] = useState(false);
  const [dessertBooked, setDessertBooked] = useState(false);
  const [loading, setLoading] = useState(true);

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
    return <p style={{ textAlign: "center" }}>Loading guest info...</p>;
  }

  const totalGuests = currentGuestCount + additionalGuests;

  const getAddOnCost = () => {
    const perGuest = (cateringBooked && dessertBooked)
      ? 72
      : cateringBooked
      ? 65
      : dessertBooked
      ? 7
      : 0;
    return perGuest * additionalGuests;
  };

  const totalDue = getAddOnCost();

  return (
    <div className="pixie-overlay">
      <div className="pixie-card">
        <video
          src="/assets/videos/yum_cart.mp4"
          autoPlay
          loop
          muted
          playsInline
          style={{ width: "100%", maxWidth: "300px", margin: "0 auto 1.5rem", display: "block" }}
        />

        <h2 style={{ fontFamily: "'Jenna Sue', cursive", fontSize: "2rem", color: "#2c62ba", textAlign: "center" }}>
          Add Guests
        </h2>

        <p style={{ textAlign: "center" }}>
          Current Guest Count: <strong>{currentGuestCount}</strong><br />
          Additional Guests: <strong>{additionalGuests}</strong><br />
          Total After Update: <strong>{totalGuests}</strong><br />
          
          {cateringBooked && <span>Catering Add-On: ${cateringBooked ? (additionalGuests * 65).toFixed(2) : "0.00"}<br /></span>}
          {dessertBooked && <span>Dessert Add-On: ${dessertBooked ? (additionalGuests * 7).toFixed(2) : "0.00"}<br /></span>}

          <strong>Total Due Today: ${totalDue.toFixed(2)}</strong>
        </p>

        <div style={{ textAlign: "center", marginTop: "1rem" }}>
          <label>Add More Guests:</label>
          <input
            type="number"
            min="0"
            value={additionalGuests}
            onChange={(e) => setAdditionalGuests(parseInt(e.target.value) || 0)}
            style={{ width: "80px", fontSize: "1.1rem", marginLeft: "0.5rem" }}
          />
        </div>

        <div style={{ marginTop: "2rem" }}>
          <Elements stripe={stripePromise}>
            <CheckoutForm total={totalDue} onSuccess={async () => {
  alert("Guest add-on purchase complete!");
}} />
          </Elements>
        </div>
      </div>
    </div>
  );
};

export default GuestCountUpdateCart;