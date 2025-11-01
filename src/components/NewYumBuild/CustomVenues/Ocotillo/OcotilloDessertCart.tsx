// src/components/NewYumBuild/CustomVenues/Ocotillo/OcotilloDessertCart.tsx
import React, { useEffect, useMemo, useState } from "react";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { db } from "../../../../firebase/firebaseConfig";

import {
  DESSERT_PRICING,
  GOODIE_CATALOG,
} from "../../dessert/dessertPricing";

import {
  getGuestState,
  setGuestCount,
  setAndLockGuestCount,
  type GuestLockReason,
} from "../../../../utils/guestCountStore";

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

/** Normalize goodies keys: "Group::Label" → "Label". */
const goodieLabel = (k: string) =>
  k.includes("::") ? k.split("::")[1] : k;

interface Props {
  guestCount: number; // kept for compatibility
  onGuestCountChange: (count: number) => void;

  dessertStyle: "tieredCake" | "smallCakeTreats" | "treatsOnly";
  flavorFilling: string[];
  cakeStyle?: string;

  treatType?: "" | "cupcakes" | "goodies";
  cupcakes?: string[];
  goodies?: string[];

  setTotal: (grandTotal: number) => void;
  setLineItems: (items: string[]) => void;
  setPaymentSummaryText: (text: string) => void;
  onContinueToCheckout: () => void;
  onStartOver: () => void;
  onClose?: () => void;
  weddingDate: string | null;
}

const OcotilloDessertCart: React.FC<Props> = ({
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
  weddingDate,
}) => {
  // ===== Guest Count store sync =====
  const [gc, setGC] = useState<number>(0);
  const [locked, setLocked] = useState<boolean>(false);
  const [lockReasons, setLockReasons] = useState<
    GuestLockReason[] | undefined
  >([]);
  const [banner, setBanner] = useState<string | null>(null);

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


      if (!hydratedFromAccount && currentValue === 0) {
        hydratedFromAccount = true;

        // try local snapshot first
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

        // then Firestore
        const user = getAuth().currentUser;
        if (user) {
          try {
            const { doc, getDoc } = await import(
              "firebase/firestore"
            );
            const userSnap = await getDoc(
              doc(db, "users", user.uid)
            );
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

  // ===== Quantities (auto-filled + editable) =====
  const [cupcakeEachByFlavor, setCupcakeEachByFlavor] = useState<
    Record<string, number>
  >(() => {
    try {
      return JSON.parse(
        localStorage.getItem("ocotilloCupcakeEachByFlavor") || "{}"
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
        localStorage.getItem("ocotilloGoodieDozens") || "{}"
      );
    } catch {
      return {};
    }
  });

  // auto-fill cupcakes per flavor
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

  // auto-fill goodies by dozen
  useEffect(() => {
    if (treatType !== "goodies" || goodies.length === 0)
      return;

    const targetDz = Math.max(
      1,
      Math.ceil(gc / 12)
    );
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
      const label = goodieLabel(goodies[i % goodies.length]);
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

  // persist mirrors for quantities
  useEffect(() => {
    localStorage.setItem(
      "ocotilloCupcakeEachByFlavor",
      JSON.stringify(cupcakeEachByFlavor || {})
    );
  }, [cupcakeEachByFlavor]);

  useEffect(() => {
    localStorage.setItem(
      "ocotilloGoodieDozens",
      JSON.stringify(goodieDozens || {})
    );
  }, [goodieDozens]);

  // ===== Pricing math =====
  const baseSubtotal = useMemo(() => {
    let subtotal = 0;

    if (dessertStyle === "tieredCake") {
      subtotal += gc * PER_GUEST_TIERED;
    }

    if (dessertStyle === "smallCakeTreats") {
      // always includes the cutting cake
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
          subtotal += dz *
            (GOODIE_CATALOG[label]?.retailPerDozen || 0);
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

  const taxesAndFees = useMemo(() => {
    const taxes = baseSubtotal * SALES_TAX_RATE;
    const stripe =
      baseSubtotal * STRIPE_RATE + STRIPE_FLAT_FEE;
    return round2(taxes + stripe);
  }, [baseSubtotal]);

  const grandTotal = useMemo(
    () => round2(baseSubtotal + taxesAndFees),
    [baseSubtotal, taxesAndFees]
  );

  // ===== Plan helper =====
  const deposit25 = round2(grandTotal * DEPOSIT_PCT);
  const remainingAfterDeposit = round2(
    Math.max(0, grandTotal - deposit25)
  );

  const finalDueDate = (() => {
    const d = parseLocalYMD(weddingDate || "");
    if (!d) return null;
    d.setTime(
      d.getTime() - FINAL_DUE_DAYS * MS_DAY
    );
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
    setTotal(grandTotal);

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

    if (items.length === 0) items.push(`${labelStyle}`);

    setLineItems(items);

    setPaymentSummaryText(
      `Total $${grandTotal.toFixed(
        2
      )} (incl. taxes & fees). Optional ${Math.round(
        DEPOSIT_PCT * 100
      )}% deposit available; final due ${finalDuePretty}.`
    );
  }, [
    grandTotal,
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
    localStorage.setItem("yumCakeStyle", cakeStyle || "");
    localStorage.setItem("yumTreatType", treatType || "");
    localStorage.setItem(
      "yumCupcakes",
      JSON.stringify(cupcakes)
    );
    localStorage.setItem(
      "yumGoodies",
      JSON.stringify(goodies)
    );
    localStorage.setItem(
      "ocotilloCupcakeEachByFlavor",
      JSON.stringify(cupcakeEachByFlavor || {})
    );
    localStorage.setItem(
      "ocotilloGoodieDozens",
      JSON.stringify(goodieDozens || {})
    );

    // Overlay resume hint for THIS venue flow
    localStorage.setItem(
      "ocotilloStep",
      "ocotilloDessertCart"
    );

    // Also keep global yumStep pointing at cart for shared listeners
    localStorage.setItem("yumStep", "cart");

    onAuthStateChanged(getAuth(), async (user) => {
      if (!user) return;
      try {
        // Save dessert cart snapshot under this boutique
        await setDoc(
          doc(
            db,
            "users",
            user.uid,
            "yumYumData",
            "ocotilloDessertCartData"
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

        // Progress breadcrumb
        await setDoc(
          doc(db, "users", user.uid),
          { progress: { yumYum: { step: "cart" } } },
          { merge: true }
        );
      } catch (err) {
        console.error(
          "❌ Failed to save Ocotillo dessert cart data:",
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

  // ===== Continue → lock GC & stash plan hints for checkout =====
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
      // These keys are what checkout/contract screens expect
      localStorage.setItem("yumTotal", String(grandTotal));

      const deposit25 = round2(grandTotal * DEPOSIT_PCT);
      localStorage.setItem(
        "yumDepositAmount",
        String(deposit25)
      );
      localStorage.setItem(
        "yumRemainingBalance",
        String(
          round2(
            Math.max(
              0,
              grandTotal - deposit25
            )
          )
        )
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

      if (
        finalDueDate &&
        grandTotal - deposit25 > 0
      ) {
        const m = monthsBetweenInclusive(
          new Date(),
          finalDueDate
        );
        const remCents = Math.round(
          (grandTotal - deposit25) * 100
        );
        const base = Math.floor(remCents / m);
        const tail =
          remCents -
          base *
            Math.max(0, m - 1);

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
        localStorage.setItem("yumPlanMonths", "0");
        localStorage.setItem("yumPerMonthCents", "0");
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
      /* ignore */
    }

    onContinueToCheckout();
  };

  const formattedDessertStyle =
    (
      {
        tieredCake: "Tiered Cake",
        smallCakeTreats: "Small Cake + Treats",
        treatsOnly: "Treats Only",
      } as const
    )[dessertStyle] ?? dessertStyle;

  // ===== RENDER =====
  return (
    <div className="pixie-overlay">
      <div
        className="pixie-card"
        style={{
          maxWidth: "700px",
          textAlign: "center",
        }}
      >
        <video
          src={`${
            import.meta.env.BASE_URL
          }assets/videos/yum_cart.mp4`}
          autoPlay
          loop
          muted
          playsInline
          style={{
            width: "180px",
            margin: "0 auto 1.5rem",
            borderRadius: "12px",
          }}
        />

        <h2
          style={{
            fontFamily: "'Jenna Sue', cursive",
            fontSize: "2.2rem",
            color: "#2c62ba",
          }}
        >
          Your Dessert Order
        </h2>

        {banner && (
          <div
            style={{
              background: "#fff7d1",
              border: "1px solid #eed27a",
              padding: "0.6rem 0.8rem",
              borderRadius: 10,
              margin: "0 0 1rem",
              fontSize: ".95rem",
            }}
          >
            {banner}
          </div>
        )}

        {/* 👥 Guest Count */}
        <div style={{ marginBottom: "1.25rem" }}>
          <div
            style={{
              fontWeight: 700,
              marginBottom: ".35rem",
            }}
          >
            Guest Count
          </div>

          {locked ? (
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: ".5rem",
                background: "#f5f5f5",
                border: "1px solid #bbb",
                padding: ".5rem .75rem",
                borderRadius: 10,
                fontWeight: 600,
                minWidth: 120,
                justifyContent: "center",
              }}
              title="Guest count is locked by another booking"
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
              style={{
                padding: "0.5rem",
                fontSize: "1rem",
                width: "110px",
                borderRadius: "8px",
                textAlign: "center",
                border: "1px solid #ccc",
                background: "#fff",
              }}
            />
          )}

          {/* 💲 Per-serving cost line (tiered cake only) */}
          {dessertStyle === "tieredCake" &&
            gc > 0 && (
              <div
                style={{
                  marginTop: ".4rem",
                  fontSize: ".95rem",
                  color: "#444",
                }}
              >
                ${PER_GUEST_TIERED}/guest × {gc}{" "}
                guests = $
                {(
                  gc * PER_GUEST_TIERED
                ).toFixed(2)}
              </div>
            )}
        </div>

        {/* Selections summary */}
        <div style={{ marginBottom: "2rem" }}>
          <h3
            style={{
              fontFamily: "'Jenna Sue', cursive",
              fontSize: "1.6rem",
              color: "#2c62ba",
            }}
          >
            Style:
          </h3>
          <p>{formattedDessertStyle}</p>

          {/* For tiered cake OR smallCakeTreats, show cake info */}
          {dessertStyle !== "treatsOnly" && (
            <>
              <h3
                style={{
                  fontFamily: "'Jenna Sue', cursive",
                  fontSize: "1.6rem",
                  color: "#2c62ba",
                  marginTop: "1rem",
                }}
              >
                {dessertStyle ===
                "smallCakeTreats"
                  ? "Small Cake Flavor Combo:"
                  : "Flavor Combo:"}
              </h3>
              <p>
                {flavorFilling.length > 0
                  ? flavorFilling.join(" + ")
                  : "Not selected"}
              </p>

              {cakeStyle && (
                <>
                  <h3
                    style={{
                      fontFamily:
                        "'Jenna Sue', cursive",
                      fontSize: "1.6rem",
                      color: "#2c62ba",
                      marginTop: "1rem",
                    }}
                  >
                    {dessertStyle ===
                    "smallCakeTreats"
                      ? "Small Cake Style:"
                      : "Cake Style:"}
                  </h3>
                  <p>{cakeStyle}</p>
                </>
              )}

              {dessertStyle ===
                "smallCakeTreats" && (
                <>
                  <h3
                    style={{
                      fontFamily:
                        "'Jenna Sue', cursive",
                      fontSize: "1.6rem",
                      color: "#2c62ba",
                      marginTop: "1rem",
                    }}
                  >
                    Included:
                  </h3>
                  <p>
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
                style={{
                  fontFamily:
                    "'Jenna Sue', cursive",
                  fontSize: "1.6rem",
                  color: "#2c62ba",
                  marginTop: "1rem",
                }}
              >
                Treat Type:
              </h3>
              <p>
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
                    style={{
                      marginTop: ".5rem",
                    }}
                  >
                    Cupcake Flavors:
                  </h4>
                  <p>
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
                      style={{
                        marginTop: ".5rem",
                      }}
                    >
                      Goodies:
                    </h4>
                    <p>
                      {goodies
                        .map(goodieLabel)
                        .join(", ")}
                    </p>
                  </>
                )}
            </>
          )}
        </div>

        {/* Quantities block */}
        {treatType === "cupcakes" &&
          cupcakes.length > 0 && (
            <div
              style={{
                margin: "1rem auto 2rem",
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
                  fontSize: ".95rem",
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
                  const value =
                    Math.max(
                      CUPCAKE_MIN_EACH,
                      cupcakeEachByFlavor[
                        title
                      ] || 0
                    );
                  return (
                    <div
                      key={title}
                      style={{
                        display:
                          "grid",
                        gridTemplateColumns:
                          "1fr auto",
                        alignItems:
                          "center",
                        gap: "0.75rem",
                        padding:
                          "0.5rem 0",
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
                      <div>
                        <label
                          style={{
                            display:
                              "block",
                            fontSize:
                              ".9rem",
                            color: "#444",
                          }}
                        >
                          Quantity
                          (each):
                          <input
                            type="number"
                            min={
                              CUPCAKE_MIN_EACH
                            }
                            step={1}
                            value={
                              value
                            }
                            onChange={(
                              e
                            ) => {
                              const nextVal =
                                Math.max(
                                  CUPCAKE_MIN_EACH,
                                  parseInt(
                                    e
                                      .target
                                      .value ||
                                      "0",
                                    10
                                  ) ||
                                    0
                                );
                              setCupcakeEachByFlavor(
                                (
                                  prev
                                ) => ({
                                  ...prev,
                                  [title]:
                                    nextVal,
                                })
                              );
                            }}
                            style={{
                              display:
                                "block",
                              marginTop:
                                ".25rem",
                              width: 120,
                              padding:
                                ".45rem",
                              border:
                                "1px solid #ccc",
                              borderRadius:
                                8,
                              textAlign:
                                "center",
                            }}
                          />
                        </label>
                      </div>
                    </div>
                  );
                }
              )}
            </div>
          )}

        {treatType === "goodies" &&
          goodies.length > 0 && (
            <div
              style={{
                margin: "1rem auto 2rem",
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
                  fontSize: ".95rem",
                  marginBottom:
                    "1rem",
                  color: "#444",
                }}
              >
                Auto-filled
                for your
                guest count
                (≈ 1 piece per
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
                  return (
                    <div
                      key={
                        label
                      }
                      style={{
                        display:
                          "grid",
                        gridTemplateColumns:
                          "1fr auto auto",
                        alignItems:
                          "center",
                        gap: "0.75rem",
                        padding:
                          "0.5rem 0",
                        borderBottom:
                          "1px dashed #eee",
                      }}
                    >
                      <div>
                        <div
                          style={{
                            fontWeight: 600,
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

                      <div>
                        <label
                          style={{
                            display:
                              "block",
                            fontSize:
                              ".9rem",
                            color: "#444",
                          }}
                        >
                          Dozens:
                          <input
                            type="number"
                            min={
                              min
                            }
                            step={1}
                            value={
                              dz
                            }
                            onChange={(
                              e
                            ) => {
                              const next =
                                Math.max(
                                  min,
                                  parseInt(
                                    e
                                      .target
                                      .value ||
                                      "0",
                                    10
                                  ) ||
                                    0
                                );
                              setGoodieDozens(
                                (
                                  prev
                                ) => ({
                                  ...prev,
                                  [label]:
                                    next,
                                })
                              );
                            }}
                            style={{
                              display:
                                "block",
                              marginTop:
                                ".25rem",
                              width: 90,
                              padding:
                                ".4rem",
                              border:
                                "1px solid #ccc",
                              borderRadius:
                                8,
                              textAlign:
                                "center",
                            }}
                          />
                        </label>
                      </div>

                      <div
                        style={{
                          textAlign:
                            "right",
                          fontWeight: 600,
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
          style={{
            marginTop: ".25rem",
          }}
        >
          <div
            style={{
              fontWeight: 700,
              marginBottom:
                ".25rem",
            }}
          >
            Subtotal: $
            {baseSubtotal.toFixed(
              2
            )}
          </div>
          <div
            style={{
              marginBottom:
                ".25rem",
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
              marginBottom:
                ".75rem",
              fontWeight: 800,
            }}
          >
            Total: $
            {grandTotal.toFixed(
              2
            )}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection:
              "column",
            alignItems:
              "center",
            gap: "1rem",
          }}
        >
          <button
            className="boutique-primary-btn"
            onClick={handleContinue}
            style={{
              width: "250px",
            }}
          >
            Confirm & Book
          </button>

          <button
            className="boutique-back-btn"
            onClick={onStartOver}
            style={{
              width: "250px",
            }}
          >
            ⬅ Back to Menu
          </button>
        </div>
      </div>
    </div>
  );
};

export default OcotilloDessertCart;