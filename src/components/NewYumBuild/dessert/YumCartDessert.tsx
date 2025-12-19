// src/components/NewYumBuild/dessert/YumCartDessert.tsx
import React, { useEffect, useMemo, useState } from "react";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { db } from "../../../firebase/firebaseConfig";

// Pricing + catalog
import { DESSERT_PRICING, GOODIE_CATALOG } from "./dessertPricing";

// Delivery fee helper (central source of truth)
import {
  getDessertDeliveryFee,
} from "../../../data/dessertDeliveryFees";

// Single source of truth for guest count
import {
  getGuestState,
  setGuestCount,
  setAndLockGuestCount,
  type GuestLockReason,
} from "../../../utils/guestCountStore";

const {
  SALES_TAX_RATE,
  STRIPE_RATE,
  STRIPE_FLAT_FEE,
  DEPOSIT_PCT,
  FINAL_DUE_DAYS,
  PER_GUEST_TIERED,
  SMALL_CAKE_PRICE,
  CUPCAKE_PRICE_EACH,
  CUPCAKE_MIN_EACH,
} = DESSERT_PRICING;

const MS_DAY = 24 * 60 * 60 * 1000;
const round2 = (n: number) =>
  Math.round((n + Number.EPSILON) * 100) / 100;

const asStartOfDayUTC = (d: Date) =>
  new Date(
    Date.UTC(
      d.getUTCFullYear(),
      d.getUTCMonth(),
      d.getUTCDate(),
      0,
      0,
      1
    )
  );

const parseLocalYMD = (ymd?: string | null): Date | null =>
  !ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)
    ? null
    : new Date(`${ymd}T12:00:00`);

function monthsBetweenInclusive(from: Date, to: Date) {
  const a = new Date(from.getFullYear(), from.getMonth(), 1);
  const b = new Date(to.getFullYear(), to.getMonth(), 1);
  let months =
    (b.getFullYear() - a.getFullYear()) * 12 +
    (b.getMonth() - a.getMonth());
  if (to.getDate() >= from.getDate()) months += 1;
  return Math.max(1, months);
}
function firstMonthlyChargeAtUTC(from = new Date()): string {
  const y = from.getUTCFullYear();
  const m = from.getUTCMonth();
  const d = from.getUTCDate();
  const dt = new Date(Date.UTC(y, m + 1, d, 0, 0, 1));
  return dt.toISOString();
}

const clamp = (n: number, lo = 1, hi = 250) =>
  Math.max(lo, Math.min(hi, n));

function lockBanner(reasons: GuestLockReason[] | undefined) {
  if (!reasons || reasons.length === 0)
    return "Guest count is locked.";
  const pretty: Record<GuestLockReason, string> = {
    venue: "a venue booking",
    planner: "a planner booking",
    catering: "a catering booking",
    dessert: "a dessert booking",
    "yum:catering": "a Yum Yum catering booking",
    "yum:dessert": "a Yum Yum dessert booking",
    final_submission: "your final submission",
  };
  const parts = reasons.map((r) => pretty[r] ?? r);
  return `Guest count is locked due to ${parts.join(" & ")}.`;
}

const YUM_RESUME_CART_KEY = "yumResumeCartStep"; // "cateringCart" | "dessertCart"

/** Normalize goodies keys: "Group::Label" → "Label". */
const goodieLabel = (k: string) =>
  k.includes("::") ? k.split("::")[1] : k;

interface YumCartDessertProps {
  guestCount: number; // kept for compatibility with callers
  onGuestCountChange: (count: number) => void;

  dessertStyle: "tieredCake" | "smallCakeTreats" | "treatsOnly";
  flavorFilling: string[];
  cakeStyle?: string;

  treatType?: "" | "cupcakes" | "goodies";
  cupcakes?: string[]; // cupcake flavor titles (up to 2)
  goodies?: string[]; // can be plain labels or "Group::Label"

  setTotal: (grandTotal: number) => void;
  setLineItems: (items: string[]) => void;
  setPaymentSummaryText: (text: string) => void; // still set, but not shown in UI
  onContinueToCheckout: () => void;
  onStartOver: () => void;
  onClose: () => void;
  weddingDate: string | null;
}

const YumCartDessert: React.FC<YumCartDessertProps> = ({
  dessertStyle,
  flavorFilling,
  cakeStyle,
  treatType = "",
  cupcakes = [],
  goodies = [],
  setTotal,
  setLineItems,
  setPaymentSummaryText,
  onContinueToCheckout,
  onStartOver,
  onClose,
  weddingDate,
}) => {

  useEffect(() => {
    try {
      localStorage.setItem(YUM_RESUME_CART_KEY, "dessertCart");
      localStorage.setItem("yumStep", "dessertCart");
      localStorage.setItem("yumActiveBookingType", "dessert");
      localStorage.setItem("yumBookingType", "dessert");
    } catch {}
  }, []);

  // ===== Guest Count (single source of truth) =====
  const [gc, setGC] = useState<number>(0);
  const [locked, setLocked] = useState<boolean>(false);
  const [lockReasons, setLockReasons] = useState<
    GuestLockReason[] | undefined
  >([]);
  const [banner, setBanner] = useState<string | null>(null);


  // ===== Booked venue (used for delivery fee lookup) =====
  const [bookedVenue, setBookedVenue] = useState<string | null>(
    null
  );

  // Delivery fee from central helper
  const deliveryFee = useMemo(
    () => getDessertDeliveryFee(bookedVenue),
    [bookedVenue]
  );

  useEffect(() => {
    try {
      localStorage.setItem("yumResumeCartStep", "dessertCart");
    } catch {}
  }, []);

  // hydrate guest count (localStorage / Firestore) + lock state
  useEffect(() => {
    let mounted = true;
    let hydratedFromAccount = false;

    const sync = async () => {
      const st = await getGuestState();
      if (!mounted) return;

      const currentValue = Number((st as any).value ?? 0);
      const isLocked = Boolean((st as any).locked);
      setGC(currentValue || 0);
      setLocked(isLocked);

      const reasons = (
        (st as any).lockedReasons ??
        (st as any).guestCountLockedBy ??
        (st as any).lockedBy ??
        (st as any).reasons ??
        []
      ) as GuestLockReason[];

      setLockReasons(reasons);
      setBanner(isLocked ? lockBanner(reasons) : null);

      if (!hydratedFromAccount && currentValue === 0) {
        hydratedFromAccount = true;

        // 1) localStorage seed
        const lsSeed = Number(
          localStorage.getItem("guestCount") ||
            localStorage.getItem("yumGuestCount") ||
            "0"
        );
        if (lsSeed > 0) {
          setGC(lsSeed);
          await setGuestCount(lsSeed);
          return;
        }

        // 2) Firestore seed
        const user = getAuth().currentUser;
        if (user) {
          try {
            const { doc, getDoc } = await import(
              "firebase/firestore"
            );
            const userSnap = await getDoc(doc(db, "users", user.uid));
            const data = userSnap.exists()
              ? (userSnap.data() as any)
              : null;
            const fsSeed = Number(data?.guestCount || 0);
            if (fsSeed > 0) {
              setGC(fsSeed);
              await setGuestCount(fsSeed);
            }
          } catch (e) {
            console.warn(
              "⚠️ Could not hydrate guest count from Firestore:",
              e
            );
          }
        }
      }
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

  const handleGCInput = (val: string) => {
    if (locked) return;
    const next = clamp(parseInt(val || "0", 10) || 0);
    setGC(next);
    setGuestCount(next);
    localStorage.setItem("yumGuestCount", String(next));
  };

  // ===== Quantities (auto-filled, editable) =====

  // Per-flavor cupcake quantities (title -> each)
  const [cupcakeEachByFlavor, setCupcakeEachByFlavor] = useState<
    Record<string, number>
  >(() => {
    try {
      return JSON.parse(
        localStorage.getItem("nvCupcakeEachByFlavor") || "{}"
      );
    } catch {
      return {};
    }
  });

  const [goodieDozens, setGoodieDozens] = useState<
    Record<string, number>
  >(() => {
    try {
      return JSON.parse(
        localStorage.getItem("nvGoodieDozens") || "{}"
      );
    } catch {
      return {};
    }
  });

  // Auto-fill per-flavor cupcakes
  useEffect(() => {
    if (treatType !== "cupcakes") return;

    const n = Math.max(1, cupcakes.length || 1);
    const suggestedPerFlavor = Math.max(
      CUPCAKE_MIN_EACH,
      Math.ceil((gc || 0) / n)
    );

    const next: Record<string, number> = {};
    for (const title of cupcakes) {
      const prev = cupcakeEachByFlavor[title] || 0;
      next[title] = Math.max(
        prev,
        suggestedPerFlavor,
        CUPCAKE_MIN_EACH
      );
    }

    const changed =
      cupcakes.length !==
        Object.keys(cupcakeEachByFlavor).length ||
      cupcakes.some(
        (t) =>
          (cupcakeEachByFlavor[t] || 0) !== next[t]
      );

    if (changed) setCupcakeEachByFlavor(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [treatType, cupcakes, gc]);

  // Auto-fill goodies (by dozen)
  useEffect(() => {
    if (treatType !== "goodies" || goodies.length === 0) return;

    // baseline target ~1 piece/guest ≈ 1 dozen / 12 guests
    const targetDz = Math.max(1, Math.ceil(gc / 12));
    const next: Record<string, number> = {};
    let baseline = 0;

    for (const key of goodies) {
      const label = goodieLabel(key);
      const minDz =
        GOODIE_CATALOG[label]?.minDozens ?? 1;
      next[label] = minDz;
      baseline += minDz;
    }

    let remaining = Math.max(0, targetDz - baseline);
    let i = 0;
    while (remaining > 0 && goodies.length > 0) {
      const label = goodieLabel(
        goodies[i % goodies.length]
      );
      next[label] = (next[label] || 0) + 1;
      remaining -= 1;
      i += 1;
    }

    const changed =
      goodies.some(
        (k) =>
          (goodieDozens[goodieLabel(k)] || 0) !==
          (next[goodieLabel(k)] || 0)
      ) ||
      Object.keys(goodieDozens).some(
        (k) => !goodies.map(goodieLabel).includes(k)
      );

    if (changed) setGoodieDozens(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gc, treatType, goodies]);

  // Persist mirrors for qtys
  useEffect(() => {
    localStorage.setItem(
      "nvCupcakeEachByFlavor",
      JSON.stringify(cupcakeEachByFlavor || {})
    );
  }, [cupcakeEachByFlavor]);
  useEffect(() => {
    localStorage.setItem(
      "nvGoodieDozens",
      JSON.stringify(goodieDozens || {})
    );
  }, [goodieDozens]);

  // ===== Pricing math =====

  // Dessert subtotal only (no delivery yet)
  const dessertSubtotal = useMemo(() => {
    let subtotal = 0;

    if (dessertStyle === "tieredCake") {
      subtotal += gc * PER_GUEST_TIERED;
    }

    if (dessertStyle === "smallCakeTreats") {
      // base includes the cutting cake
      subtotal += SMALL_CAKE_PRICE;

      if (treatType === "cupcakes") {
        for (const title of cupcakes) {
          const each = Math.max(
            CUPCAKE_MIN_EACH,
            cupcakeEachByFlavor[title] || 0
          );
          subtotal += each * CUPCAKE_PRICE_EACH;
        }
      } else if (treatType === "goodies") {
        for (const key of goodies) {
          const label = goodieLabel(key);
          const meta = GOODIE_CATALOG[label];
          if (!meta) continue;
          const dz = Math.max(
            meta.minDozens ?? 0,
            goodieDozens[label] || 0
          );
          subtotal += dz * (meta.retailPerDozen || 0);
        }
      }
    }

    if (dessertStyle === "treatsOnly") {
      if (treatType === "cupcakes") {
        for (const title of cupcakes) {
          const each = Math.max(
            CUPCAKE_MIN_EACH,
            cupcakeEachByFlavor[title] || 0
          );
          subtotal += each * CUPCAKE_PRICE_EACH;
        }
      } else if (treatType === "goodies") {
        for (const key of goodies) {
          const label = goodieLabel(key);
          const dz = Math.max(
            0,
            goodieDozens[label] || 0
          );
          subtotal +=
            dz *
            (GOODIE_CATALOG[label]?.retailPerDozen ||
              0);
        }
      }
    }

    return round2(subtotal);
  }, [
    dessertStyle,
    gc,
    treatType,
    cupcakes,
    cupcakeEachByFlavor,
    goodies,
    goodieDozens,
  ]);

  // subtotal after adding delivery fee
  const subtotalWithDelivery = useMemo(
    () => round2(dessertSubtotal + deliveryFee),
    [dessertSubtotal, deliveryFee]
  );

  // tax + stripe fee should apply to dessertSubtotal + deliveryFee
  const taxesAndFees = useMemo(() => {
    // sales tax on (desserts + delivery)
    const taxes = subtotalWithDelivery * SALES_TAX_RATE;

    // stripe % on (desserts + delivery) + flat
    const stripe =
      subtotalWithDelivery * STRIPE_RATE +
      STRIPE_FLAT_FEE;

    return round2(taxes + stripe);
  }, [subtotalWithDelivery]);

  // final total for this purchase
  // (desserts + delivery + tax + stripe)
  const grandTotalFinal = useMemo(
    () => round2(subtotalWithDelivery + taxesAndFees),
    [subtotalWithDelivery, taxesAndFees]
  );

  // ===== Plan helper (stored for checkout/contract; not shown here) =====
  const deposit25 = round2(grandTotalFinal * DEPOSIT_PCT);
  const remainingAfterDeposit = round2(
    Math.max(0, grandTotalFinal - deposit25)
  );

  const finalDueDate = (() => {
    const d = parseLocalYMD(weddingDate || "");
    if (!d) return null;
    d.setTime(d.getTime() - FINAL_DUE_DAYS * MS_DAY);
    return d;
  })();

  const finalDuePretty = finalDueDate
    ? finalDueDate.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : `${FINAL_DUE_DAYS} days before your wedding date`;

  // ===== Reflect to parent + build line items =====
  useEffect(() => {
    // let parent / checkout screens know the final number
    // (includes delivery, tax, stripe)
    setTotal(grandTotalFinal);

    const items: string[] = [];
    const labelStyle =
      (
        {
          tieredCake: "Tiered Cake",
          smallCakeTreats: "Small Cake + Treats",
          treatsOnly: "Treats Only",
        } as const
      )[dessertStyle] ?? dessertStyle;

    if (dessertStyle === "tieredCake") {
      items.push(
        `Tiered Cake for ${gc} guests @ $${PER_GUEST_TIERED}/guest`
      );
      if (flavorFilling.length)
        items.push(
          `Flavor combo: ${flavorFilling.join(" + ")}`
        );
      if (cakeStyle)
        items.push(`Cake style: ${cakeStyle}`);
    }

    if (
      dessertStyle === "smallCakeTreats" ||
      dessertStyle === "treatsOnly"
    ) {
      if (dessertStyle === "smallCakeTreats") {
        items.push(
          `Small Cutting Cake = $${SMALL_CAKE_PRICE.toFixed(
            2
          )}`
        );
        if (flavorFilling.length)
          items.push(
            `Flavor combo: ${flavorFilling.join(" + ")}`
          );
        if (cakeStyle)
          items.push(`Cake style: ${cakeStyle}`);
      }

      if (treatType === "cupcakes" && cupcakes.length > 0) {
        for (const title of cupcakes) {
          const qty = Math.max(
            CUPCAKE_MIN_EACH,
            cupcakeEachByFlavor[title] || 0
          );
          items.push(
            `${title} — ${qty} @ $${CUPCAKE_PRICE_EACH}/ea`
          );
        }
      } else if (
        treatType === "goodies" &&
        goodies.length
      ) {
        for (const key of goodies) {
          const label = goodieLabel(key);
          const meta = GOODIE_CATALOG[label];
          if (!meta) continue;
          const min = meta.minDozens ?? 1;
          const dz = Math.max(
            min,
            goodieDozens[label] || 0
          );
          items.push(
            `${label} — ${dz} dozen @ $${meta.retailPerDozen}/dz (min ${min})`
          );
        }
      }
    }

    if (items.length === 0) {
      items.push(`${labelStyle}`);
    }

    // delivery line item
    if (deliveryFee > 0) {
      if (deliveryFee === 250) {
        items.push(
          "Outside Delivery Fee — $250 flat"
        );
      } else {
        items.push(
          "Delivery / Set-Up Fee — $80 flat"
        );
      }
    }

    setLineItems(items);

    setPaymentSummaryText(
      `Total $${grandTotalFinal.toFixed(
        2
      )} (incl. delivery, tax, & card fees). ` +
        `${Math.round(
          DEPOSIT_PCT * 100
        )}% deposit available; final due ${finalDuePretty}.`
    );
  }, [
    grandTotalFinal,
    deliveryFee,
    gc,
    dessertStyle,
    flavorFilling,
    cakeStyle,
    treatType,
    cupcakes,
    cupcakeEachByFlavor,
    goodies,
    goodieDozens,
    finalDuePretty,
    setLineItems,
    setPaymentSummaryText,
    setTotal,
  ]);

  // ===== Persist mirrors =====
  useEffect(() => {
    localStorage.setItem("yumGuestCount", String(gc));
    localStorage.setItem("yumDessertStyle", dessertStyle);
    localStorage.setItem(
      "yumFlavorFilling",
      JSON.stringify(flavorFilling)
    );
    localStorage.setItem(
      "yumCakeStyle",
      cakeStyle || ""
    );
    localStorage.setItem(
      "yumTreatType",
      treatType || ""
    );
    localStorage.setItem(
      "yumCupcakes",
      JSON.stringify(cupcakes)
    );
    localStorage.setItem(
      "yumGoodies",
      JSON.stringify(goodies)
    );
    localStorage.setItem(
      "yumNvCupcakeEachByFlavor",
      JSON.stringify(
        cupcakeEachByFlavor || {}
      )
    );
    localStorage.setItem(
      "yumNvGoodieDozens",
      JSON.stringify(
        goodieDozens || {}
      )
    );
    localStorage.setItem("yumStep", "dessertCart");

    onAuthStateChanged(getAuth(), async (user) => {
      if (!user) return;
      try {
        await setDoc(
          doc(
            db,
            "users",
            user.uid,
            "yumYumData",
            "cartDessertData"
          ),
          {
            guestCount: gc,
            dessertStyle,
            flavorFilling,
            cakeStyle: cakeStyle || "",
            treatType: treatType || "",
            cupcakes,
            goodies,
            cupcakeEachByFlavor,
            goodieDozens,
          },
          { merge: true }
        );
        await setDoc(
          doc(db, "users", user.uid),
          {
            progress: {
              yumYum: { step: "dessertCart" },
            },
          },
          { merge: true }
        );
      } catch (err) {
        console.error(
          "❌ Failed to save dessert cart data:",
          err
        );
      }
    });
  }, [
    gc,
    dessertStyle,
    flavorFilling,
    cakeStyle,
    treatType,
    cupcakes,
    goodies,
    cupcakeEachByFlavor,
    goodieDozens,
  ]);

  // ===== Continue → lock GC & stash plan hints =====
  const handleContinue = async () => {
    try {
      if (!locked)
        await setAndLockGuestCount(gc || 0, "dessert");
    } catch (e) {
      console.error(
        "⚠️ Could not lock guest count for dessert:",
        e
      );
    }

    try {
      // store the FINAL total (delivery + tax + stripe)
      localStorage.setItem(
        "yumTotal",
        String(grandTotalFinal)
      );

      const deposit25Local = round2(
        grandTotalFinal * DEPOSIT_PCT
      );
      localStorage.setItem(
        "yumDepositAmount",
        String(deposit25Local)
      );

      const remainingLocal = round2(
        grandTotalFinal - deposit25Local
      );
      localStorage.setItem(
        "yumRemainingBalance",
        String(remainingLocal)
      );

      localStorage.setItem(
        "yumFinalDueAt",
        finalDueDate
          ? asStartOfDayUTC(
              finalDueDate
            ).toISOString()
          : ""
      );
      localStorage.setItem(
        "yumFinalDuePretty",
        finalDueDate
          ? finalDueDate.toLocaleDateString(
              "en-US",
              {
                year: "numeric",
                month: "long",
                day: "numeric",
              }
            )
          : `${FINAL_DUE_DAYS} days before your wedding date`
      );

      if (finalDueDate && remainingLocal > 0) {
        const m = monthsBetweenInclusive(
          new Date(),
          finalDueDate
        );
        const remCents = Math.round(
          remainingLocal * 100
        );

        const base = Math.floor(remCents / m);
        const tail =
          remCents - base * Math.max(0, m - 1);

        localStorage.setItem(
          "yumPlanMonths",
          String(m)
        );
        localStorage.setItem(
          "yumPerMonthCents",
          String(base)
        );
        localStorage.setItem(
          "yumLastPaymentCents",
          String(tail)
        );
        localStorage.setItem(
          "yumNextChargeAt",
          firstMonthlyChargeAtUTC(
            new Date()
          )
        );
      } else {
        localStorage.setItem(
          "yumPlanMonths",
          "0"
        );
        localStorage.setItem(
          "yumPerMonthCents",
          "0"
        );
        localStorage.setItem(
          "yumLastPaymentCents",
          "0"
        );
        localStorage.setItem(
          "yumNextChargeAt",
          ""
        );
      }
    } catch {
      /* swallow */
    }

    onContinueToCheckout();
  };

  // ===== Get booked venue (for delivery fee logic) =====
  useEffect(() => {
    let active = true;

    onAuthStateChanged(getAuth(), async (user) => {
      if (!user || !active) return;
      try {
        const { doc, getDoc } = await import(
          "firebase/firestore"
        );
        const userRef = doc(db, "users", user.uid);
        const snap = await getDoc(userRef);
        if (!snap.exists()) return;

        const data = snap.data() as any;

        // try to grab their booked venue slug consistently
        const venueSlugGuess =
          data?.venueRankerData?.booking?.venueSlug ||
          data?.bookings?.venue ||
          data?.bookings?.venueSlug ||
          data?.selectedVenueSlug ||
          null;

        if (active) {
          setBookedVenue(
            typeof venueSlugGuess === "string"
              ? venueSlugGuess
              : null
          );
        }
      } catch (err) {
        console.warn(
          "⚠️ Could not load booked venue:",
          err
        );
      }
    });

    return () => {
      active = false;
    };
  }, []);

  const formattedDessertStyle =
    (
      {
        tieredCake: "Tiered Cake",
        smallCakeTreats: "Small Cake + Treats",
        treatsOnly: "Treats Only",
      } as const
    )[dessertStyle] ?? dessertStyle;

  // ===================== RENDER =====================
  return (
    <div
      className="pixie-card pixie-card--modal"
      style={{ maxWidth: 700 }}
    >
      {/* 🩷 Pink X Close */}
      <button
        className="pixie-card__close"
        onClick={onClose}
        aria-label="Close"
      >
        <img
          src={`${
            import.meta.env.BASE_URL
          }assets/icons/pink_ex.png`}
          alt="Close"
        />
      </button>

      <div
        className="pixie-card__body"
        style={{ textAlign: "center" }}
      >
        <video
          src={`${
            import.meta.env.BASE_URL
          }assets/videos/yum_cart.mp4`}
          autoPlay
          loop
          muted
          playsInline
          className="px-media"
          style={{
            width: 180,
            margin: "0 auto 16px",
            borderRadius: 12,
          }}
        />

        <h2
          className="px-title-lg"
          style={{ marginBottom: 8 }}
        >
          Your Dessert Order
        </h2>

        {/* 👥 Guest Count */}
        <div style={{ marginBottom: 16 }}>
          <div
            style={{
              fontWeight: 700,
              marginBottom: 6,
            }}
          >
            Guest Count
          </div>

          {locked ? (
            <div
              title="Guest count is locked by another booking"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                background: "#f5f7fb",
                border: "1px solid #d9deee",
                padding: "8px 12px",
                borderRadius: 10,
                fontWeight: 700,
                minWidth: 120,
                justifyContent: "center",
              }}
            >
              {gc || 0}
              <span
                style={{
                  fontWeight: 400,
                  fontSize: ".9rem",
                  color: "#666",
                }}
              >
                (locked)
              </span>
            </div>
          ) : (
            <input
              type="number"
              min={1}
              max={250}
              value={gc}
              onChange={(e) =>
                handleGCInput(e.target.value)
              }
              className="px-input"
              style={{
                width: 120,
                textAlign: "center",
              }}
            />
          )}

          {dessertStyle === "tieredCake" &&
            gc > 0 && (
              <div
                className="px-prose-narrow"
                style={{ marginTop: 6 }}
              >
                ${PER_GUEST_TIERED}/guest × {gc} guests ={" "}
                {(
                  gc * PER_GUEST_TIERED
                ).toFixed(2)}
              </div>
            )}
        </div>

        {/* Selections summary */}
        <div style={{ marginBottom: 24 }}>
          <h3
            className="px-title"
            style={{ marginBottom: 4 }}
          >
            Style:
          </h3>
          <p className="px-prose-narrow">
            {formattedDessertStyle}
          </p>

          {dessertStyle !== "treatsOnly" && (
            <>
              <h3
                className="px-title"
                style={{ marginTop: 10 }}
              >
                {dessertStyle ===
                "smallCakeTreats"
                  ? "Small Cake Flavor Combo:"
                  : "Flavor Combo:"}
              </h3>
              <p className="px-prose-narrow">
                {flavorFilling.length > 0
                  ? flavorFilling.join(
                      " + "
                    )
                  : "Not selected"}
              </p>

              {cakeStyle && (
                <>
                  <h3
                    className="px-title"
                    style={{ marginTop: 10 }}
                  >
                    {dessertStyle ===
                    "smallCakeTreats"
                      ? "Small Cake Style:"
                      : "Cake Style:"}
                  </h3>
                  <p className="px-prose-narrow">
                    {cakeStyle}
                  </p>
                </>
              )}

              {dessertStyle ===
                "smallCakeTreats" && (
                <>
                  <h3
                    className="px-title"
                    style={{ marginTop: 10 }}
                  >
                    Included:
                  </h3>
                    <p className="px-prose-narrow">
                      Small cutting cake —{" "}
                      <strong>
                        $
                        {SMALL_CAKE_PRICE.toFixed(
                          2
                        )}
                      </strong>
                    </p>
                </>
              )}
            </>
          )}

          {(dessertStyle ===
            "smallCakeTreats" ||
            dessertStyle ===
              "treatsOnly") && (
            <>
              <h3
                className="px-title"
                style={{ marginTop: 10 }}
              >
                Treat Type:
              </h3>
              <p className="px-prose-narrow">
                {treatType
                  ? treatType ===
                    "cupcakes"
                    ? "Cupcakes"
                    : "Goodies"
                  : "Not selected"}
              </p>

              {treatType ===
                "cupcakes" && (
                <>
                  <h4
                    className="px-prose-narrow"
                    style={{
                      marginTop: 6,
                      fontWeight: 700,
                    }}
                  >
                    Cupcake Flavors:
                  </h4>
                  <p className="px-prose-narrow">
                    {(cupcakes || [])
                      .map((t) =>
                        t
                          .split("–")[0]
                          .trim()
                      )
                      .join(", ")}
                  </p>
                </>
              )}

              {treatType ===
                "goodies" &&
                (goodies?.length ??
                  0) > 0 && (
                  <>
                    <h4
                      className="px-prose-narrow"
                      style={{
                        marginTop: 6,
                        fontWeight: 700,
                      }}
                    >
                      Goodies:
                    </h4>
                    <p className="px-prose-narrow">
                      {goodies
                        .map(
                          goodieLabel
                        )
                        .join(", ")}
                    </p>
                  </>
                )}
            </>
          )}
        </div>

        {/* Quantities – Cupcakes */}
        {treatType === "cupcakes" &&
          cupcakes.length > 0 && (
            <div
              style={{
                margin:
                  "1rem auto 2rem",
                padding: "1rem",
                border:
                  "1px solid #e5e5e5",
                borderRadius: 12,
                maxWidth: 520,
                textAlign: "left",
              }}
            >
              <div
                style={{
                  fontWeight: 700,
                  marginBottom:
                    ".5rem",
                }}
              >
                Cupcakes
              </div>
              <div
                style={{
                  fontSize:
                    ".95rem",
                  marginBottom:
                    "0.75rem",
                  color: "#444",
                }}
              >
                ${CUPCAKE_PRICE_EACH}
                /each • Minimum{" "}
                {CUPCAKE_MIN_EACH} per
                flavor
              </div>

              {cupcakes.map(
                (title) => {
                  const each = Math.max(
                    CUPCAKE_MIN_EACH,
                    cupcakeEachByFlavor[
                      title
                    ] || 0
                  );
                  const setEach = (
                    val: number
                  ) => {
                    const next =
                      Math.max(
                        CUPCAKE_MIN_EACH,
                        val
                      );
                    setCupcakeEachByFlavor(
                      (prev) => ({
                        ...prev,
                        [title]:
                          next,
                      })
                    );
                  };

                  return (
                    <div
                      key={title}
                      style={{
                        display:
                          "grid",
                        gridTemplateColumns:
                          "minmax(0,1fr) 88px 180px",
                        alignItems:
                          "center",
                        columnGap:
                          "1rem",
                        padding:
                          ".6rem 0",
                        borderBottom:
                          "1px dashed #eee",
                      }}
                    >
                      <div
                        style={{
                          fontWeight: 600,
                        }}
                      >
                        {title}
                      </div>
                      <div
                        style={{
                          fontSize:
                            ".95rem",
                          textAlign:
                            "right",
                        }}
                      >
                        Each:
                      </div>

                      <div
                        className="px-qty"
                        style={{
                          display:
                            "flex",
                          alignItems:
                            "center",
                          gap: "0.5rem",
                          width: 220,
                        }}
                      >
                        <button
                          type="button"
                          className="px-qty-btn px-qty-btn--minus"
                          onClick={() =>
                            setEach(
                              each -
                                1
                            )
                          }
                          aria-label={`Decrease ${title}`}
                          style={{
                            width: 36,
                            height: 36,
                            flex: "0 0 36px",
                          }}
                        >
                          <img
                            src={`${
                              import.meta
                                .env
                                .BASE_URL
                            }assets/icons/qty_minus_pink_glossy.svg`}
                            alt=""
                            aria-hidden="true"
                          />
                        </button>

                        <input
                          type="number"
                          min={
                            CUPCAKE_MIN_EACH
                          }
                          value={
                            each
                          }
                          onChange={(
                            e
                          ) =>
                            setEach(
                              parseInt(
                                e
                                  .target
                                  .value ||
                                  "0",
                                10
                              ) ||
                                CUPCAKE_MIN_EACH
                            )
                          }
                          className="px-input-number"
                          style={{
                            width: 90,
                            textAlign:
                              "center",
                            boxSizing:
                              "border-box",
                          }}
                        />

                        <button
                          type="button"
                          className="px-qty-btn px-qty-btn--plus"
                          onClick={() =>
                            setEach(
                              each +
                                1
                            )
                          }
                          aria-label={`Increase ${title}`}
                          style={{
                            width: 36,
                            height: 36,
                            flex: "0 0 36px",
                          }}
                        >
                          <img
                            src={`${
                              import.meta
                                .env
                                .BASE_URL
                            }assets/icons/qty_plus_blue_glossy.svg`}
                            alt=""
                            aria-hidden="true"
                          />
                        </button>
                      </div>
                    </div>
                  );
                }
              )}
            </div>
          )}

        {/* Quantities – Goodies */}
        {treatType === "goodies" &&
          goodies.length > 0 && (
            <div
              style={{
                margin:
                  "1rem auto 2rem",
                padding: "1rem",
                border:
                  "1px solid #e5e5e5",
                borderRadius: 12,
                maxWidth: 620,
                textAlign: "left",
              }}
            >
              <div
                style={{
                  fontWeight: 700,
                  marginBottom:
                    ".5rem",
                }}
              >
                Goodies (by the
                dozen)
              </div>
              <div
                style={{
                  fontSize:
                    ".95rem",
                  marginBottom:
                    "1rem",
                  color: "#444",
                }}
              >
                Auto-filled for
                your guest
                count (≈ 1
                piece per
                guest). Edit
                as you like.
                Minimums per
                flavor apply.
              </div>

              {goodies.map(
                (key) => {
                  const label =
                    goodieLabel(
                      key
                    );
                  const meta =
                    GOODIE_CATALOG[
                      label
                    ];
                  if (!meta)
                    return null;

                  const min =
                    meta.minDozens ??
                    1;
                  const dz = Math.max(
                    min,
                    goodieDozens[
                      label
                    ] || 0
                  );
                  const extended =
                    round2(
                      dz *
                        (meta.retailPerDozen ||
                          0)
                    );
                  const setDz = (
                    val: number
                  ) => {
                    const next =
                      Math.max(
                        min,
                        val
                      );
                    setGoodieDozens(
                      (prev) => ({
                        ...prev,
                        [label]:
                          next,
                      })
                    );
                  };

                  return (
                    <div
                      key={label}
                      style={{
                        display:
                          "grid",
                        gridTemplateColumns:
                          "minmax(0,1fr) 88px 180px auto",
                        alignItems:
                          "center",
                        columnGap:
                          "0.75rem",
                        padding:
                          ".75rem 0",
                        borderBottom:
                          "1px dashed #eee",
                        maxWidth:
                          "100%",
                      }}
                    >
                      {/* Label + meta */}
                      <div
                        style={{
                          minWidth: 0,
                        }}
                      >
                        <div
                          style={{
                            fontWeight: 600,
                            wordBreak:
                              "break-word",
                          }}
                        >
                          {label}
                        </div>
                        <div
                          style={{
                            fontSize:
                              ".9rem",
                            color: "#666",
                          }}
                        >
                          $
                          {
                            meta.retailPerDozen
                          }
                          /dz • Min{" "}
                          {min} dz
                        </div>
                      </div>

                      {/* Dozens label */}
                      <div
                        style={{
                          fontSize:
                            ".95rem",
                          textAlign:
                            "right",
                          whiteSpace:
                            "nowrap",
                        }}
                      >
                        Dozens:
                      </div>

                      {/* Qty controls */}
                      <div
                        className="px-qty"
                        style={{
                          display:
                            "flex",
                          alignItems:
                            "center",
                          gap: "0.5rem",
                          width: 180,
                          maxWidth: 180,
                          justifyContent:
                            "center",
                        }}
                      >
                        <button
                          type="button"
                          className="px-qty-btn px-qty-btn--minus"
                          onClick={() =>
                            setDz(
                              dz - 1
                            )
                          }
                          aria-label={`Decrease dozens for ${label}`}
                          disabled={
                            dz <= min
                          }
                          style={{
                            width: 32,
                            height: 32,
                            flex: "0 0 32px",
                          }}
                        >
                          <img
                            src={`${
                              import.meta
                                .env
                                .BASE_URL
                            }assets/icons/qty_minus_pink_glossy.svg`}
                            alt=""
                            aria-hidden="true"
                          />
                        </button>

                        <input
                          id={`dz-${label}`}
                          type="number"
                          min={min}
                          value={dz}
                          onChange={(e) =>
                            setDz(
                              parseInt(
                                e
                                  .target
                                  .value ||
                                  "0",
                                10
                              ) ||
                                min
                            )
                          }
                          className="px-input-number"
                          style={{
                            width: 70,
                            textAlign:
                              "center",
                            boxSizing:
                              "border-box",
                          }}
                        />

                        <button
                          type="button"
                          className="px-qty-btn px-qty-btn--plus"
                          onClick={() =>
                            setDz(
                              dz + 1
                            )
                          }
                          aria-label={`Increase dozens for ${label}`}
                          style={{
                            width: 32,
                            height: 32,
                            flex: "0 0 32px",
                          }}
                        >
                          <img
                            src={`${
                              import.meta
                                .env
                                .BASE_URL
                            }assets/icons/qty_plus_blue_glossy.svg`}
                            alt=""
                            aria-hidden="true"
                          />
                        </button>
                      </div>

                      {/* Price */}
                      <div
                        style={{
                          textAlign:
                            "right",
                          fontWeight: 600,
                          whiteSpace:
                            "nowrap",
                        }}
                      >
                        $
                        {extended.toFixed(
                          2
                        )}
                      </div>
                    </div>
                  );
                }
              )}
            </div>
          )}

        {/* Price summary */}
        <div
          className="px-prose-narrow"
          style={{ marginTop: 4 }}
        >
          <div
            style={{
              fontWeight: 700,
              marginBottom: 4,
            }}
          >
            Dessert Subtotal: $
            {dessertSubtotal.toFixed(
              2
            )}
          </div>

          {deliveryFee > 0 && (
            <div
              style={{
                marginBottom: 4,
                color: "#444",
              }}
            >
              {deliveryFee ===
              250
                ? "Delivery Fee: $250.00"
                : "Delivery Fee: $80.00"}
            </div>
          )}

          <div
            style={{
              marginBottom: 4,
              color: "#444",
            }}
          >
            Taxes & fees: $
            {taxesAndFees.toFixed(
              2
            )}
          </div>

          <div
            style={{
              marginBottom: 10,
              fontWeight: 800,
            }}
          >
            Total: $
            {grandTotalFinal.toFixed(
              2
            )}
          </div>
        </div>

        <div
          className="px-cta-col"
          style={{ marginTop: 6 }}
        >
          <button
            className="boutique-primary-btn"
            onClick={handleContinue}
          >
            Confirm & Book
          </button>
          <button
            className="boutique-back-btn"
            onClick={onStartOver}
          >
            ← Back to Menu
          </button>
        </div>
      </div>
    </div>
  );
};

export default YumCartDessert;