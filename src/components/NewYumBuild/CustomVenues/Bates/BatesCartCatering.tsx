import React, { useEffect, useMemo, useState } from "react";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../../../../firebase/firebaseConfig";

const SALES_TAX_RATE = 0.086;
const STRIPE_RATE = 0.029;
const STRIPE_FLAT_FEE = 0.3;

/** Bates pricing */
const PRICE_BIKE_BASE = 350;
const BIKE_INCLUDED_GUESTS = 50;
const PRICE_BIKE_OVERAGE_PER_GUEST = 7;

const PRICE_LATE_NIGHT_PER_GUEST = 7;
const PRICE_MINI_DESSERT_PER_GUEST = 8;

interface BatesMenuSelections {
  hors: string[];
  salads: string[];
  entrees: string[];
  isPairedEntree?: boolean;
}

interface BatesCartProps {
  menuSelections: BatesMenuSelections;
  guestCount: number;
  setTotal: (grandTotal: number) => void;
  setLineItems: (items: string[]) => void;
  setPaymentSummaryText: (text: string) => void;
  setAddonsTotal: (amount: number) => void;
  onContinueToCheckout: () => void;
  onBackToMenu: () => void;
  onClose: () => void;
}

const BatesCartCatering: React.FC<BatesCartProps> = ({
  menuSelections,
  setTotal,
  setLineItems,
  setPaymentSummaryText,
  setAddonsTotal,
  onContinueToCheckout,
  onBackToMenu,
  onClose,
}) => {
  // 🔒 locked guest count from account / venue booking
  const [lockedGuestCount, setLockedGuestCount] = useState<number>(0);

  // 🍽 add-ons state
  const [poffertjesSelected, setPoffertjesSelected] = useState<boolean>(false);
  const [poffertjesExtraGuests, setPoffertjesExtraGuests] = useState<number>(0);

  const [lateNightIncluded, setLateNightIncluded] = useState<boolean>(false);
  const [lateNightGuests, setLateNightGuests] = useState<number>(0);

  const [miniDessertIncluded, setMiniDessertIncluded] = useState<boolean>(false);
  const [miniDessertGuests, setMiniDessertGuests] = useState<number>(0);

  // ✅ Stamp resume + active booking type immediately on mount (NoVenue pattern)
useEffect(() => {
  try {
    localStorage.setItem("yumStep", "cateringCart");
    localStorage.setItem("yumResumeCartStep", "cateringCart");
    localStorage.setItem("yumActiveBookingType", "catering");
    localStorage.setItem("yumBookingType", "catering");
  } catch {}
}, []);

  // 🔄 hydrate from LS / Firestore
  useEffect(() => {
    const unsub = onAuthStateChanged(getAuth(), async (user) => {
      // local mirror first
      const lsLocked = Number(localStorage.getItem("batesLockedGuestCount") || 0);
      if (lsLocked > 0) setLockedGuestCount(lsLocked);

      const ls = localStorage.getItem("batesCartData");
      if (ls) {
        try {
          const p = JSON.parse(ls);
          setPoffertjesSelected(!!p.poffertjesSelected);
          setPoffertjesExtraGuests(Number(p.poffertjesExtraGuests || 0));
          setLateNightIncluded(!!p.lateNightIncluded);
          setLateNightGuests(Number(p.lateNightGuests || 0));
          setMiniDessertIncluded(!!p.miniDessertIncluded);
          setMiniDessertGuests(Number(p.miniDessertGuests || 0));
        } catch {}
      }

      if (!user) return;

      try {
        const userRef = doc(db, "users", user.uid);
        const snap = await getDoc(userRef);
        const data = snap.data() || {};

        const gc =
          Number(data?.guestCount) ||
          Number(data?.profileData?.guestCount) ||
          Number(localStorage.getItem("magicGuestCount") || 0) ||
          0;

        if (gc > 0) {
          setLockedGuestCount(gc);
          localStorage.setItem("batesLockedGuestCount", String(gc));

          // seed guest-based addon qtys if not already set
          setLateNightGuests((n) => (n > 0 ? Math.max(n, gc) : gc));
          setMiniDessertGuests((n) => (n > 0 ? Math.max(n, gc) : gc));

          if (poffertjesSelected) {
            const over = Math.max(0, gc - BIKE_INCLUDED_GUESTS);
            setPoffertjesExtraGuests((v) => (v > 0 ? Math.max(v, over) : over));
          }
        }
      } catch (e) {
        console.warn("⚠️ Unable to load locked guest count:", e);
      }
    });

    return () => unsub();
  }, [poffertjesSelected]);

  // 💵 add-ons subtotal
  const addonsSubtotal = useMemo(() => {
    const bikeBase = poffertjesSelected ? PRICE_BIKE_BASE : 0;
    const bikeExtra = poffertjesSelected
      ? Math.max(0, poffertjesExtraGuests) * PRICE_BIKE_OVERAGE_PER_GUEST
      : 0;

    const lateNightTotal = lateNightIncluded
      ? Math.max(lockedGuestCount, lateNightGuests) * PRICE_LATE_NIGHT_PER_GUEST
      : 0;

    const miniDessertTotal = miniDessertIncluded
      ? Math.max(lockedGuestCount, miniDessertGuests) *
        PRICE_MINI_DESSERT_PER_GUEST
      : 0;

    return bikeBase + bikeExtra + lateNightTotal + miniDessertTotal;
  }, [
    poffertjesSelected,
    poffertjesExtraGuests,
    lateNightIncluded,
    lateNightGuests,
    miniDessertIncluded,
    miniDessertGuests,
    lockedGuestCount,
  ]);

  // 💾 persist → LS + Firestore
  useEffect(() => {
    // local mirrors
    localStorage.setItem(
      "batesCartData",
      JSON.stringify({
        poffertjesSelected,
        poffertjesExtraGuests,
        lateNightIncluded,
        lateNightGuests,
        miniDessertIncluded,
        miniDessertGuests,
      })
    );
    localStorage.setItem("batesAddonsSubtotal", String(addonsSubtotal));
    localStorage.setItem("yumStep", "cateringCart");
    // ✅ resume target (THIS is the missing piece)
  localStorage.setItem("yumResumeCartStep", "cateringCart");

    // Firestore mirrors
    const user = getAuth().currentUser;
    if (!user) return;

    (async () => {
      try {
        await setDoc(
          doc(db, "users", user.uid, "yumYumData", "batesCartData"),
          {
            poffertjesSelected,
            poffertjesExtraGuests,
            lateNightIncluded,
            lateNightGuests,
            miniDessertIncluded,
            miniDessertGuests,
            addonsSubtotal,
            savedAt: new Date().toISOString(),
          },
          { merge: true }
        );

        await setDoc(
          doc(db, "users", user.uid),
          { progress: { yumYum: { step: "cateringCart" } } },
          { merge: true }
        );
      } catch (e) {
        console.error("❌ Failed to save Bates cart to Firestore:", e);
      }
    })();
  }, [
    poffertjesSelected,
    poffertjesExtraGuests,
    lateNightIncluded,
    lateNightGuests,
    miniDessertIncluded,
    miniDessertGuests,
    addonsSubtotal,
  ]);

  // 💰 totals
  const taxes = addonsSubtotal * SALES_TAX_RATE;
  const cardFees =
    addonsSubtotal > 0
      ? addonsSubtotal * STRIPE_RATE + STRIPE_FLAT_FEE
      : 0;
  const grandTotal = addonsSubtotal + taxes + cardFees;

  // 🧾 summary out to parent
  useEffect(() => {
    const items: string[] = [];

    items.push(
      "Bates Catering (menu selections) — $Included"
    );

    if (poffertjesSelected) {
      items.push(
        `Poffertjes Bike — $${PRICE_BIKE_BASE} (includes ${BIKE_INCLUDED_GUESTS} guests)`
      );
      if (poffertjesExtraGuests > 0) {
        items.push(
          `Poffertjes extra guests: ${poffertjesExtraGuests} @ $${PRICE_BIKE_OVERAGE_PER_GUEST}/guest`
        );
      }
    }

    if (lateNightIncluded) {
      items.push(
        `Late Night Snacks: ${Math.max(
          lockedGuestCount,
          lateNightGuests
        )} guests @ $${PRICE_LATE_NIGHT_PER_GUEST}/guest`
      );
    }

    if (miniDessertIncluded) {
      items.push(
        `Mini Dessert Bar: ${Math.max(
          lockedGuestCount,
          miniDessertGuests
        )} guests @ $${PRICE_MINI_DESSERT_PER_GUEST}/guest`
      );
    }

    setLineItems(items);
    setAddonsTotal(addonsSubtotal);
    setTotal(grandTotal);

    setPaymentSummaryText(
      grandTotal > 0
        ? `You're paying $${grandTotal.toFixed(
            2
          )} today for add-ons (taxes & card fees included).`
        : "No add-ons selected. Your Bates catering is included; no payment is due."
    );
  }, [
    lockedGuestCount,
    poffertjesSelected,
    poffertjesExtraGuests,
    lateNightIncluded,
    lateNightGuests,
    miniDessertIncluded,
    miniDessertGuests,
    addonsSubtotal,
    grandTotal,
    setLineItems,
    setAddonsTotal,
    setTotal,
    setPaymentSummaryText,
  ]);

  // 💵 helper
  const money = (n: number) =>
    n.toLocaleString(undefined, {
      style: "currency",
      currency: "USD",
    });

  // ─────────────────────────────
  // BRANDED QUANTITY CONTROLS 💅
  // ─────────────────────────────
  function QuantityControl({
    value,
    setValue,
    min,
    ariaLabelBase,
  }: {
    value: number;
    setValue: (n: number) => void;
    min: number;
    ariaLabelBase: string;
  }) {
    const dec = () => setValue(Math.max(min, value - 1));
    const inc = () => setValue(value + 1);

    return (
      <div
        className="px-qty"
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          width: 180,
          maxWidth: 180,
          justifyContent: "center",
        }}
      >
        <button
          type="button"
          className="px-qty-btn px-qty-btn--minus"
          onClick={dec}
          aria-label={`Decrease ${ariaLabelBase}`}
          disabled={value <= min}
          style={{
            width: 32,
            height: 32,
            flex: "0 0 32px",
          }}
        >
          <img
            src={`${import.meta.env.BASE_URL}assets/icons/qty_minus_pink_glossy.svg`}
            alt=""
            aria-hidden="true"
          />
        </button>

        <input
          type="number"
          min={min}
          value={value}
          onChange={(e) => {
            const raw = parseInt(e.target.value || "0", 10);
            const next = Number.isNaN(raw) ? min : raw;
            setValue(Math.max(min, next));
          }}
          className="px-input-number"
          style={{
            width: 70,
            textAlign: "center",
            boxSizing: "border-box",
          }}
        />

        <button
          type="button"
          className="px-qty-btn px-qty-btn--plus"
          onClick={inc}
          aria-label={`Increase ${ariaLabelBase}`}
          style={{
            width: 32,
            height: 32,
            flex: "0 0 32px",
          }}
        >
          <img
            src={`${import.meta.env.BASE_URL}assets/icons/qty_plus_blue_glossy.svg`}
            alt=""
            aria-hidden="true"
          />
        </button>
      </div>
    );
  }

  // convenience mins for each add-on input
  const poffertjesMinExtra = Math.max(
    0,
    (lockedGuestCount || 0) - BIKE_INCLUDED_GUESTS
  );
  const lateNightMinGuests = lockedGuestCount || 0;
  const miniDessertMinGuests = lockedGuestCount || 0;

  // ===================== RENDER =====================
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
          style={{ textAlign: "center", padding: "2rem 2.5rem" }}
        >
          <video
            src={`${import.meta.env.BASE_URL}assets/videos/yum_cart.mp4`}
            autoPlay
            loop
            muted
            playsInline
            className="px-media"
            style={{
              width: 180,
              margin: "0 auto 14px",
              borderRadius: 12,
              display: "block",
            }}
          />

          <h2 className="px-title-lg" style={{ marginBottom: 8 }}>
            Bates Catering — Review & Add-ons
          </h2>

          {/* Your Selections */}
          <div style={{ marginTop: 10, marginBottom: 18 }}>
            <h3 className="px-title" style={{ marginBottom: 6 }}>
              Your Selections
            </h3>
            <div className="px-prose-narrow">
              <strong>Hors d’oeuvres:</strong>{" "}
              {menuSelections.hors?.length
                ? menuSelections.hors.join(", ")
                : "None selected"}
              <br />
              <br />
              <strong>Salads:</strong>{" "}
              {menuSelections.salads?.length
                ? menuSelections.salads.join(", ")
                : "None selected"}
              <br />
              <br />
              <strong>Entrées:</strong>{" "}
              {menuSelections.entrees?.length
                ? menuSelections.entrees.join(", ")
                : "None selected"}
            </div>
            <div
              style={{
                marginTop: 8,
                fontWeight: 700,
                color: "#2c62ba",
              }}
            >
              $Included
            </div>
          </div>

          {/* Locked guest count box */}
          <div
            style={{
              background: "#f5f7fb",
              border: "1px solid #d9deee",
              borderRadius: 12,
              padding: "12px 16px",
              margin: "0 auto 16px",
              maxWidth: 520,
            }}
          >
            <div
              style={{
                fontWeight: 700,
                marginBottom: 4,
                color: "#2c62ba",
              }}
            >
              Guest Count
            </div>
            <div
              className="px-prose-narrow"
              style={{ marginBottom: 4, color: "#2c62ba" }}
            >
              Locked after venue booking
            </div>
            <div className="px-prose-narrow">
              Number of Guests:{" "}
              <strong>{lockedGuestCount || 0}</strong>
            </div>
          </div>

          {/* Add-ons grid */}
          <div
            style={{
              display: "grid",
              gap: 14,
              margin: "0 auto",
              maxWidth: 620,
              textAlign: "center",
            }}
          >
            {/* 🍽 Poffertjes Bike */}
            <div
              style={{
                background: "rgba(255,255,255,0.95)",
                borderRadius: 12,
                padding: 14,
                textAlign: "center",
                border: "1px solid #e8e8ef",
              }}
            >
              <div className="px-title" style={{ marginBottom: 4 }}>
                The Poffertjes Bike
              </div>
              <div
                className="px-prose-narrow"
                style={{ opacity: 0.9, marginBottom: 8 }}
              >
                {money(PRICE_BIKE_BASE)} flat · includes{" "}
                {BIKE_INCLUDED_GUESTS} guests · +
                {money(PRICE_BIKE_OVERAGE_PER_GUEST)} / extra guest
              </div>

              <label
                className="px-prose-narrow"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <input
                  type="checkbox"
                  checked={poffertjesSelected}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setPoffertjesSelected(checked);
                    if (checked) {
                      const over = Math.max(
                        0,
                        (lockedGuestCount || 0) - BIKE_INCLUDED_GUESTS
                      );
                      setPoffertjesExtraGuests((v) =>
                        v > 0 ? Math.max(v, over) : over
                      );
                    } else {
                      setPoffertjesExtraGuests(0);
                    }
                  }}
                />
                Include the bike
              </label>

              {poffertjesSelected && (
                <div style={{ marginTop: 10 }}>
                  <div
                    className="px-prose-narrow"
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "minmax(0,1fr) minmax(auto,200px)",
                      alignItems: "center",
                      columnGap: "1rem",
                      justifyContent: "center",
                    }}
                  >
                    <div
                      style={{
                        textAlign: "right",
                        fontSize: ".95rem",
                        whiteSpace: "nowrap",
                      }}
                    >
                      Extra guests beyond {BIKE_INCLUDED_GUESTS}:
                    </div>

                    <QuantityControl
                      value={poffertjesExtraGuests}
                      min={poffertjesMinExtra}
                      setValue={(n) =>
                        setPoffertjesExtraGuests(
                          Math.max(poffertjesMinExtra, n)
                        )
                      }
                      ariaLabelBase="poffertjes extra guests"
                    />
                  </div>

                  <div
                    style={{ marginTop: 6, fontWeight: 600 }}
                  >
                    Line total:{" "}
                    {money(
                      PRICE_BIKE_BASE +
                        Math.max(0, poffertjesExtraGuests) *
                          PRICE_BIKE_OVERAGE_PER_GUEST
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* 🌙 Late Night Snacks */}
            <div
              style={{
                background: "rgba(255,255,255,0.95)",
                borderRadius: 12,
                padding: 14,
                textAlign: "center",
                border: "1px solid #e8e8ef",
              }}
            >
              <div className="px-title" style={{ marginBottom: 4 }}>
                Late Night Snacks
              </div>
              <div
                className="px-prose-narrow"
                style={{ opacity: 0.9, marginBottom: 8 }}
              >
                from {money(PRICE_LATE_NIGHT_PER_GUEST)} per guest
              </div>

              <label
                className="px-prose-narrow"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <input
                  type="checkbox"
                  checked={lateNightIncluded}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setLateNightIncluded(checked);
                    if (checked) {
                      setLateNightGuests((n) =>
                        n > 0
                          ? Math.max(n, lockedGuestCount)
                          : lockedGuestCount
                      );
                    }
                  }}
                />
                Include Late Night Snacks
              </label>

              {lateNightIncluded && (
                <div style={{ marginTop: 10 }}>
                  <div
                    className="px-prose-narrow"
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "minmax(0,1fr) minmax(auto,200px)",
                      alignItems: "center",
                      columnGap: "1rem",
                      justifyContent: "center",
                    }}
                  >
                    <div
                      style={{
                        textAlign: "right",
                        fontSize: ".95rem",
                        whiteSpace: "nowrap",
                      }}
                    >
                      Guests to serve:
                    </div>

                    <QuantityControl
                      value={lateNightGuests}
                      min={lateNightMinGuests}
                      setValue={(n) =>
                        setLateNightGuests(
                          Math.max(lateNightMinGuests, n)
                        )
                      }
                      ariaLabelBase="late night snack guests"
                    />
                  </div>

                  <div
                    style={{ marginTop: 6, fontWeight: 600 }}
                  >
                    Line total:{" "}
                    {money(
                      Math.max(
                        lockedGuestCount,
                        lateNightGuests
                      ) * PRICE_LATE_NIGHT_PER_GUEST
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* 🍮 Mini Dessert Bar */}
            <div
              style={{
                background: "rgba(255,255,255,0.95)",
                borderRadius: 12,
                padding: 14,
                textAlign: "center",
                border: "1px solid #e8e8ef",
              }}
            >
              <div className="px-title" style={{ marginBottom: 4 }}>
                Mini Dessert Bar
              </div>
              <div
                className="px-prose-narrow"
                style={{ opacity: 0.9, marginBottom: 8 }}
              >
                {money(PRICE_MINI_DESSERT_PER_GUEST)} per guest
              </div>

              <label
                className="px-prose-narrow"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <input
                  type="checkbox"
                  checked={miniDessertIncluded}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setMiniDessertIncluded(checked);
                    if (checked) {
                      setMiniDessertGuests((n) =>
                        n > 0
                          ? Math.max(n, lockedGuestCount)
                          : lockedGuestCount
                      );
                    }
                  }}
                />
                Include Mini Dessert Bar
              </label>

              {miniDessertIncluded && (
                <div style={{ marginTop: 10 }}>
                  <div
                    className="px-prose-narrow"
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "minmax(0,1fr) minmax(auto,200px)",
                      alignItems: "center",
                      columnGap: "1rem",
                      justifyContent: "center",
                    }}
                  >
                    <div
                      style={{
                        textAlign: "right",
                        fontSize: ".95rem",
                        whiteSpace: "nowrap",
                      }}
                    >
                      Guests to serve:
                    </div>

                    <QuantityControl
                      value={miniDessertGuests}
                      min={miniDessertMinGuests}
                      setValue={(n) =>
                        setMiniDessertGuests(
                          Math.max(miniDessertMinGuests, n)
                        )
                      }
                      ariaLabelBase="mini dessert bar guests"
                    />
                  </div>

                  <div
                    style={{ marginTop: 6, fontWeight: 600 }}
                  >
                    Line total:{" "}
                    {money(
                      Math.max(
                        lockedGuestCount,
                        miniDessertGuests
                      ) * PRICE_MINI_DESSERT_PER_GUEST
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Totals */}
          <div
            className="px-prose-narrow"
            style={{ marginTop: 16 }}
          >
            <div>
              Add-ons Subtotal: {money(addonsSubtotal)}
            </div>
            <div>
              Taxes &amp; Fees: {money(taxes + cardFees)}
            </div>
            <div
              style={{
                fontWeight: 800,
                marginTop: 6,
                color: "#2c62ba",
              }}
            >
              Total: {money(grandTotal)}{" "}
              <span style={{ fontWeight: 400 }}>
                (taxes and fees)
              </span>
            </div>
          </div>

          {/* CTAs */}
          <div
            className="px-cta-col"
            style={{ marginTop: 14 }}
          >
            <button
              className="boutique-primary-btn"
              style={{ width: 260 }}
              onClick={onContinueToCheckout}
            >
              Continue
            </button>
            <button
              className="boutique-back-btn"
              style={{ width: 260 }}
              onClick={onBackToMenu}
            >
              ⬅ Back to Menu
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BatesCartCatering;