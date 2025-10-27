// src/components/NewYumBuild/CustomVenues/Rubi/RubiDessertContract.tsx
import React, { useEffect, useRef, useState } from "react";
import SignatureCanvas from "react-signature-canvas";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { db } from "../../../../firebase/firebaseConfig";

interface RubiDessertContractProps {
  total: number;
  guestCount: number;
  weddingDate: string | null; // "YYYY-MM-DD"
  dayOfWeek: string | null;
  lineItems: string[];
  signatureImage: string | null;
  setSignatureImage: (value: string) => void;
  setStep: (step: any) => void; // parent overlay step controller
  onClose: () => void;
  onComplete: (signatureImage: string) => void;
  dessertStyle: string; // "tieredCake" | "smallCakeTreats" | "treatsOnly"
  flavorCombo: string;
}

const DEPOSIT_PCT = 0.25;
const FINAL_DUE_DAYS = 35;
const MS_DAY = 24 * 60 * 60 * 1000;

const round2 = (n: number) =>
  Math.round((n + Number.EPSILON) * 100) / 100;

const parseLocalYMD = (ymd?: string | null): Date | null => {
  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  // noon guard so TZ doesn't shift the date
  return new Date(`${ymd}T12:00:00`);
};

// First second of a local Date as UTC ISO (good for crons / billing anchors)
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

// inclusive-ish month math (partial month counts as 1)
function monthsBetweenInclusive(from: Date, to: Date) {
  const a = new Date(from.getFullYear(), from.getMonth(), 1);
  const b = new Date(to.getFullYear(), to.getMonth(), 1);
  let months =
    (b.getFullYear() - a.getFullYear()) * 12 +
    (b.getMonth() - a.getMonth());
  if (to.getDate() >= from.getDate()) months += 1;
  return Math.max(1, months);
}

// first auto-charge ~1 month after booking
function firstMonthlyChargeAtUTC(from = new Date()): string {
  const y = from.getUTCFullYear();
  const m = from.getUTCMonth();
  const d = from.getUTCDate();
  const dt = new Date(
    Date.UTC(y, m + 1, d, 0, 0, 1)
  );
  return dt.toISOString();
}

const RubiDessertContract: React.FC<
  RubiDessertContractProps
> = ({
  total,
  guestCount,
  weddingDate,
  dayOfWeek,
  lineItems,
  signatureImage,
  setSignatureImage,
  setStep,
  dessertStyle,
  flavorCombo,
  onClose,
  onComplete,
}) => {
  const auth = getAuth();
  const [userId, setUserId] = useState<string | null>(null);

  // store wedding date + weekday pretties locally,
  // hydrate from Firestore if we can
  const [weddingYMD, setWeddingYMD] = useState<string | null>(
    weddingDate || null
  );
  const [weekdayPretty, setWeekdayPretty] = useState<
    string | null
  >(dayOfWeek || null);

  const initialPlan = (localStorage.getItem("rubiDessertPayPlan") ||
    localStorage.getItem("rubiDessertPaymentPlan") ||
    "full") as "full" | "monthly";
  const [payFull, setPayFull] = useState(
    initialPlan === "full"
  );

  const [agreeChecked, setAgreeChecked] =
    useState(false);

  const [showSignatureModal, setShowSignatureModal] =
    useState(false);

  const [useTextSignature, setUseTextSignature] =
    useState(false);
  const [typedSignature, setTypedSignature] =
    useState("");

  const sigCanvasRef = useRef<SignatureCanvas | null>(
    null
  );

  // if they already signed on this run, we should show the ✅ stamp + enable Continue
  const [signatureSubmitted, setSignatureSubmitted] =
    useState<boolean>(() =>
      Boolean(
        signatureImage ||
          localStorage.getItem("rubiDessertSignature")
      )
    );

  // ─────────────────────────────────────────────
  // Boot: capture user, hydrate wedding date, pin progress
  // ─────────────────────────────────────────────
  useEffect(() => {
    try {
      localStorage.setItem(
        "rubiStep",
        "dessertContract"
      );
      if (dessertStyle)
        localStorage.setItem(
          "rubiDessertStyle",
          dessertStyle
        );
      if (flavorCombo)
        localStorage.setItem(
          "rubiFlavorFilling",
          JSON.stringify(
            flavorCombo.split(" + ")
          )
        );
      if (lineItems)
        localStorage.setItem(
          "rubiDessertLineItems",
          JSON.stringify(lineItems)
        );
    } catch {}

    const unsub = onAuthStateChanged(
      auth,
      async (user) => {
        if (!user) return;
        setUserId(user.uid);

        try {
          // grab minimal user doc to hydrate wedding info
          const userRef = doc(db, "users", user.uid);
          const snap = await getDoc(userRef);
          const data = snap.exists()
            ? (snap.data() as any)
            : {};

          const ymdFromFS =
            data?.weddingDate ||
            data?.wedding?.date ||
            localStorage.getItem(
              "rubiWeddingDate"
            ) ||
            localStorage.getItem(
              "yumWeddingDate"
            ) || // fallback from other flow
            localStorage.getItem(
              "weddingDate"
            ) ||
            weddingDate ||
            null;

          if (
            ymdFromFS &&
            /^\d{4}-\d{2}-\d{2}$/.test(ymdFromFS)
          ) {
            setWeddingYMD(ymdFromFS);
            try {
              localStorage.setItem(
                "rubiWeddingDate",
                ymdFromFS
              );
            } catch {}
            const d = new Date(
              `${ymdFromFS}T12:00:00`
            );
            setWeekdayPretty(
              d.toLocaleDateString("en-US", {
                weekday: "long",
              })
            );
          }

          // mark progress in Firestore
          await updateDoc(userRef, {
            "progress.rubiHouse.step":
              "dessertContract",
          });

          // mirror current dessert cart snapshot into a subdoc
          await setDoc(
            doc(
              userRef,
              "rubiHouseData",
              "dessertCartSnapshot"
            ),
            {
              dessertStyle,
              flavorCombo,
              lineItems,
              total,
              guestCount,
            },
            { merge: true }
          );
        } catch (err) {
          console.error(
            "🔥 [RubiDessertContract] boot error:",
            err
          );
        }
      }
    );

    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // persist pay plan choice to localStorage whenever toggled
  useEffect(() => {
    try {
      const plan = payFull ? "full" : "monthly";
      localStorage.setItem(
        "rubiDessertPayPlan",
        plan
      );
      localStorage.setItem(
        "rubiDessertPaymentPlan",
        plan
      );
    } catch {}
  }, [payFull]);

  // ─────────────────────────────────────────────
  // Payment math for summary
  // ─────────────────────────────────────────────
  const totalSafe = round2(Number(total) || 0);

  const depositDollars = round2(
    totalSafe * DEPOSIT_PCT
  );

  // If they choose monthly, today they’re paying just deposit (25%).
  // If they choose "full", they’re paying the entire total.
  const amountDueToday = payFull
    ? totalSafe
    : Math.min(totalSafe, depositDollars);

  const remainingBalance = round2(
    Math.max(0, totalSafe - amountDueToday)
  );

  // figure out final due date (35 days before wedding)
  const wedDate = parseLocalYMD(
    weddingYMD || ""
  );
  const finalDueDate = wedDate
    ? new Date(
        wedDate.getTime() -
          FINAL_DUE_DAYS * MS_DAY
      )
    : null;

  // this is what we actually save in LS for checkout
  const finalDueISO = finalDueDate
    ? asStartOfDayUTC(finalDueDate).toISOString()
    : "";

  // build installment math
  let planMonths = 0;
  let perMonthCents = 0;
  let lastPaymentCents = 0;
  let nextChargeAtISO = "";

  if (
    !payFull &&
    finalDueDate &&
    remainingBalance > 0
  ) {
    const months = monthsBetweenInclusive(
      new Date(),
      finalDueDate
    );
    const remainingCents = Math.round(
      remainingBalance * 100
    );
    const base = Math.floor(
      remainingCents / months
    );
    const tail =
      remainingCents -
      base * Math.max(0, months - 1);

    planMonths = months;
    perMonthCents = base;
    lastPaymentCents = tail;
    nextChargeAtISO =
      firstMonthlyChargeAtUTC(
        new Date()
      );
  }

  const finalDuePretty = finalDueDate
    ? finalDueDate.toLocaleDateString(
        "en-US",
        {
          year: "numeric",
          month: "long",
          day: "numeric",
        }
      )
    : `${FINAL_DUE_DAYS} days before your wedding date`;

  const monthlyAmount =
    planMonths > 0
      ? round2(perMonthCents / 100)
      : 0;

  // ─────────────────────────────────────────────
  // Signature helpers
  // ─────────────────────────────────────────────
  // draw typed text to canvas -> dataURL so downstream is uniform
  const generateImageFromText = (
    text: string
  ): string => {
    const canvas =
      document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    canvas.width = 600;
    canvas.height = 150;
    if (!ctx) return "";
    ctx.fillStyle = "#000";
    ctx.font =
      "48px 'Jenna Sue', cursive";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(
      text,
      canvas.width / 2,
      canvas.height / 2
    );
    return canvas.toDataURL("image/png");
  };

  const handleSignClick = () => {
    if (agreeChecked)
      setShowSignatureModal(true);
  };

  const handleSignatureSubmit = () => {
    let finalSig = "";

    if (
      useTextSignature &&
      typedSignature.trim()
    ) {
      finalSig = generateImageFromText(
        typedSignature.trim()
      );
    } else if (
      !useTextSignature &&
      sigCanvasRef.current
    ) {
      try {
        const c =
          sigCanvasRef.current.getCanvas?.() ||
          (sigCanvasRef.current as unknown as {
            _canvas?: HTMLCanvasElement;
          })._canvas;
        if (
          !c ||
          typeof (
            c as HTMLCanvasElement
          ).toDataURL !== "function"
        ) {
          throw new Error("No canvas");
        }
        finalSig = (
          c as HTMLCanvasElement
        ).toDataURL("image/png");
      } catch (e) {
        alert(
          "⚠️ Error capturing signature. Please try again."
        );
        return;
      }
    } else {
      alert(
        "⚠️ Please enter or draw a signature before saving."
      );
      return;
    }

    if (
      !finalSig.startsWith(
        "data:image/png"
      )
    ) {
      alert(
        "⚠️ Signature image could not be generated. Please try again."
      );
      return;
    }

    // Persist signature + billing plan hints in LS for checkout flow.
    try {
      const plan = payFull
        ? "full"
        : "monthly";

      localStorage.setItem(
        "rubiDessertSignature",
        finalSig
      );
      localStorage.setItem(
        "rubiDessertPayPlan",
        plan
      );
      localStorage.setItem(
        "rubiDessertPaymentPlan",
        plan
      );

      localStorage.setItem(
        "rubiDessertTotal",
        String(totalSafe)
      );
      localStorage.setItem(
        "rubiDessertDepositAmount",
        String(
          payFull
            ? totalSafe
            : depositDollars
        )
      );
      localStorage.setItem(
        "rubiDessertRemainingBalance",
        String(remainingBalance)
      );

      localStorage.setItem(
        "rubiDessertFinalDueAt",
        finalDueISO
      );
      localStorage.setItem(
        "rubiDessertFinalDuePretty",
        finalDuePretty
      );

      localStorage.setItem(
        "rubiDessertPlanMonths",
        String(planMonths)
      );
      localStorage.setItem(
        "rubiDessertPerMonthCents",
        String(perMonthCents)
      );
      localStorage.setItem(
        "rubiDessertLastPaymentCents",
        String(lastPaymentCents)
      );
      localStorage.setItem(
        "rubiDessertNextChargeAt",
        nextChargeAtISO
      );

      localStorage.setItem(
        "rubiDessertGuestCount",
        String(guestCount || 0)
      );

      if (lineItems?.length) {
        localStorage.setItem(
          "rubiDessertLineItems",
          JSON.stringify(
            lineItems
          )
        );
      }
    } catch {}

    setSignatureImage(finalSig);
    setSignatureSubmitted(true);
    setShowSignatureModal(false);
  };

  const formattedDate = weddingYMD
    ? new Date(
        `${weddingYMD}T12:00:00`
      ).toLocaleDateString(
        "en-US",
        {
          year: "numeric",
          month: "long",
          day: "numeric",
        }
      )
    : "your wedding date";

  // ─────────────────────────────────────────────
  // UI
  // ─────────────────────────────────────────────
  return (
    // parent should already be giving us overlay,
    // so just render the white card
    <div
      className="pixie-card pixie-card--modal"
      style={{ maxWidth: 680 }}
    >
      {/* 💗 Pink X close */}
      <button
        className="pixie-card__close"
        onClick={onClose}
        aria-label="Close"
      >
        <img
          src={`${
            import.meta.env
              .BASE_URL
          }assets/icons/pink_ex.png`}
          alt="Close"
        />
      </button>

      <div
        className="pixie-card__body"
        style={{ textAlign: "center" }}
      >
        <img
          src={`${
            import.meta.env
              .BASE_URL
          }assets/images/yum_yum_button.png`}
          alt="Rubi House Dessert"
          className="px-media"
          style={{
            width: 110,
            margin: "0 auto 12px",
          }}
        />

        <h2
          className="px-title-lg"
          style={{
            marginBottom: 8,
          }}
        >
          Rubi House Dessert Agreement
        </h2>

        <p
          className="px-prose-narrow"
          style={{ marginBottom: 6 }}
        >
          You’re booking desserts for{" "}
          <strong>
            {formattedDate}
          </strong>{" "}
          ({weekdayPretty || "TBD"}).
        </p>

        <p
          className="px-prose-narrow"
          style={{ marginBottom: 16 }}
        >
          Total dessert cost:{" "}
          <strong>
            $
            {totalSafe.toFixed(
              2
            )}
          </strong>
        </p>

        {/* Terms */}
        <div
          className="px-section"
          style={{
            maxWidth: 620,
            margin: "0 auto 12px",
            textAlign: "left",
          }}
        >
          <h3
            className="px-title-lg"
            style={{
              fontSize:
                "1.8rem",
              marginBottom: 8,
              textAlign:
                "center",
            }}
          >
            Booking Terms
          </h3>

          <ul
            className="px-prose-narrow"
            style={{
              margin: 0,
              paddingLeft:
                "1.25rem",
              lineHeight: 1.6,
            }}
          >
            <li>
              You may pay in
              full today, or
              place a{" "}
              <strong>
                {Math.round(
                  DEPOSIT_PCT *
                    100
                )}
                % non-refundable
                deposit
              </strong>
              . Any
              remaining
              balance will be
              split into
              monthly
              installments
              and must be
              fully paid{" "}
              <strong>
                {FINAL_DUE_DAYS}{" "}
                days
                before your
                wedding date
              </strong>
              .
            </li>

            <li>
              Final guest
              count is due
              30 days before
              your wedding.
              You may
              increase your
              guest count
              starting 45
              days before
              your wedding,
              but the count
              cannot be
              lowered after
              booking.
            </li>

            <li>
              <strong>
                Cancellation
                &amp;
                Refunds:
              </strong>{" "}
              If you cancel
              more than{" "}
              {
                FINAL_DUE_DAYS
              }{" "}
              days prior,
              amounts paid
              beyond the
              non-refundable
              portion will
              be refunded
              less any
              non-recoverable
              costs already
              incurred.
              Within{" "}
              {
                FINAL_DUE_DAYS
              }{" "}
              days, all
              payments are
              non-refundable.
            </li>

            <li>
              <strong>
                Missed
                Payments:
              </strong>{" "}
              We’ll
              automatically
              retry your
              card. After 7
              days, a $25
              late fee
              applies; after
              14 days,
              services may
              be suspended
              and this
              agreement may
              be in default.
            </li>

            <li>
              <strong>
                Food Safety
                &amp; Venue
                Policies:
              </strong>{" "}
              We’ll follow
              standard
              food-safety
              guidelines and
              comply with
              venue rules,
              which may limit
              display/setup
              options.
            </li>

            <li>
              <strong>
                Force
                Majeure:
              </strong>{" "}
              Neither party
              is liable for
              delays beyond
              reasonable
              control. We’ll
              work in good
              faith to
              reschedule; if
              not possible,
              we’ll refund
              amounts paid
              beyond
              non-recoverable
              costs already
              incurred.
            </li>

            <li>
              In the
              unlikely
              event of our
              cancellation
              or issue,
              liability is
              limited to a
              refund of
              payments
              made.
            </li>
          </ul>
        </div>

        {/* Pay plan toggle */}
        <h4
          className="px-title"
          style={{
            fontSize:
              "1.8rem",
            marginTop: 14,
            marginBottom: 8,
            textAlign:
              "center",
          }}
        >
          Choose how you’d
          like to pay:
        </h4>

        <div
          className="px-toggle"
          style={{
            display: "flex",
            justifyContent:
              "center",
            gap: 8,
            marginBottom: 12,
          }}
        >
          <button
            type="button"
            className={`px-toggle__btn ${
              payFull
                ? "px-toggle__btn--blue px-toggle__btn--active"
                : ""
            }`}
            style={{
              minWidth: 150,
              padding:
                "0.6rem 1rem",
              fontSize:
                ".9rem",
            }}
            onClick={() => {
              setPayFull(true);
              setSignatureSubmitted(
                false
              );
              try {
                localStorage.setItem(
                  "rubiDessertPayPlan",
                  "full"
                );
              } catch {}
            }}
            aria-pressed={
              payFull
            }
          >
            Pay Full
            Amount
          </button>

          <button
            type="button"
            className={`px-toggle__btn ${
              !payFull
                ? "px-toggle__btn--pink px-toggle__btn--active"
                : ""
            }`}
            style={{
              minWidth: 150,
              padding:
                "0.6rem 1rem",
              fontSize:
                ".9rem",
            }}
            onClick={() => {
              setPayFull(false);
              setSignatureSubmitted(
                false
              );
              try {
                localStorage.setItem(
                  "rubiDessertPayPlan",
                  "monthly"
                );
              } catch {}
            }}
            aria-pressed={
              !payFull
            }
          >
            Deposit +
            Monthly
          </button>
        </div>

        {/* Plan summary line */}
        <p
          className="px-prose-narrow"
          style={{
            marginTop: 4,
            textAlign:
              "center",
          }}
        >
          {payFull ? (
            <>
              You’ll pay{" "}
              <strong>
                $
                {totalSafe.toFixed(
                  2
                )}
              </strong>{" "}
              today.
            </>
          ) : (
            <>
              <strong>
                $
                {depositDollars.toFixed(
                  2
                )}
              </strong>{" "}
              due today +
              {` `}
              {planMonths}{" "}
              monthly
              payments of
              about{" "}
              <strong>
                $
                {monthlyAmount.toFixed(
                  2
                )}
              </strong>
              ; final
              payment due{" "}
              <strong>
                {finalDuePretty}
              </strong>
              .
            </>
          )}
        </p>

        {/* Agree */}
        <div
          style={{
            margin:
              "8px 0 6px",
          }}
        >
          <label
            className="px-prose-narrow"
            style={{
              display:
                "inline-flex",
              alignItems:
                "center",
              gap: 8,
            }}
          >
            <input
              type="checkbox"
              checked={
                agreeChecked
              }
              onChange={(e) =>
                setAgreeChecked(
                  e.target
                    .checked
                )
              }
            />
            I agree to the
            terms above.
          </label>
        </div>

        {/* Signature / Continue */}
        {!signatureSubmitted ? (
          <div
            style={{
              display:
                "flex",
              justifyContent:
                "center",
              marginTop:
                "1rem",
            }}
          >
            <button
              className="boutique-primary-btn"
              onClick={
                handleSignClick
              }
              disabled={
                !agreeChecked
              }
              style={{
                width: 250,
                opacity: agreeChecked
                  ? 1
                  : 0.5,
                cursor: agreeChecked
                  ? "pointer"
                  : "not-allowed",
              }}
            >
              Sign
              Agreement
            </button>
          </div>
        ) : (
          <div
            style={{
              textAlign:
                "center",
              marginTop: 8,
            }}
          >
            {/* ✅ show the same contract_signed.png stamp we use everywhere else */}
            <img
              src={`${
                import.meta.env
                  .BASE_URL
              }assets/images/contract_signed.png`}
              alt="Agreement Signed"
              className="px-media"
              style={{
                maxWidth: 140,
                display:
                  "block",
                margin:
                  "0 auto 12px",
              }}
            />

            <div className="px-cta-col">
              <button
                className="boutique-primary-btn"
                onClick={() => {
                  // persist plan details for checkout
                  try {
                    const plan = payFull
                      ? "full"
                      : "monthly";

                    localStorage.setItem(
                      "rubiDessertPayPlan",
                      plan
                    );
                    localStorage.setItem(
                      "rubiDessertPaymentPlan",
                      plan
                    );

                    localStorage.setItem(
                      "rubiDessertTotal",
                      String(
                        totalSafe
                      )
                    );
                    localStorage.setItem(
                      "rubiDessertDepositAmount",
                      String(
                        payFull
                          ? totalSafe
                          : depositDollars
                      )
                    );
                    localStorage.setItem(
                      "rubiDessertRemainingBalance",
                      String(
                        remainingBalance
                      )
                    );

                    localStorage.setItem(
                      "rubiDessertFinalDueAt",
                      finalDueISO
                    );
                    localStorage.setItem(
                      "rubiDessertFinalDuePretty",
                      finalDuePretty
                    );

                    localStorage.setItem(
                      "rubiDessertPlanMonths",
                      String(
                        planMonths
                      )
                    );
                    localStorage.setItem(
                      "rubiDessertPerMonthCents",
                      String(
                        perMonthCents
                      )
                    );
                    localStorage.setItem(
                      "rubiDessertLastPaymentCents",
                      String(
                        lastPaymentCents
                      )
                    );
                    localStorage.setItem(
                      "rubiDessertNextChargeAt",
                      nextChargeAtISO
                    );
                  } catch {}

                  // pass sig to parent
                  const sig =
                    localStorage.getItem(
                      "rubiDessertSignature"
                    ) ||
                    signatureImage ||
                    "";

                  // step → checkout
                  try {
                    localStorage.setItem(
                      "rubiStep",
                      "dessertCheckout"
                    );
                  } catch {}
                  setStep(
                    "dessertCheckout"
                  );

                  // let parent mount checkout before final callback
                  setTimeout(
                    () =>
                      onComplete(
                        sig
                      ),
                    0
                  );
                }}
                style={{
                  width: 250,
                }}
              >
                Continue to
                Payment
              </button>

              <button
                className="boutique-back-btn"
                onClick={() => {
                  try {
                    localStorage.setItem(
                      "rubiStep",
                      "dessertCart"
                    );
                  } catch {}
                  setStep(
                    "dessertCart"
                  );
                }}
                style={{
                  width: 250,
                }}
              >
                ⬅ Back to
                Cart
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Signature picker modal */}
      {showSignatureModal && (
        <div
          style={{
            position:
              "fixed",
            inset: 0,
            background:
              "rgba(0,0,0,.5)",
            display:
              "flex",
            alignItems:
              "center",
            justifyContent:
              "center",
            zIndex: 1200,
            padding: 16,
          }}
        >
          <div
            className="pixie-card pixie-card--modal"
            style={{
              maxWidth: 520,
              position:
                "relative",
              overflowY:
                "hidden",
            }}
          >
            <button
              className="pixie-card__close"
              onClick={() =>
                setShowSignatureModal(
                  false
                )
              }
              aria-label="Close"
            >
              <img
                src={`${
                  import.meta
                    .env
                    .BASE_URL
                }assets/icons/blue_ex.png`}
                alt="Close"
              />
            </button>

            <div
              className="pixie-card__body"
              style={{
                textAlign:
                  "center",
              }}
            >
              <h3
                className="px-title-lg"
                style={{
                  fontSize:
                    "1.8rem",
                  marginBottom: 12,
                }}
              >
                Sign below or
                enter a text
                signature
              </h3>

              {/* toggle Draw / Type */}
              <div
                style={{
                  display:
                    "flex",
                  justifyContent:
                    "center",
                  gap: 8,
                  marginBottom: 12,
                }}
              >
                <button
                  type="button"
                  className={`px-toggle__btn ${
                    !useTextSignature
                      ? "px-toggle__btn--blue px-toggle__btn--active"
                      : ""
                  }`}
                  style={{
                    minWidth: 110,
                    padding:
                      ".5rem 1rem",
                  }}
                  onClick={() =>
                    setUseTextSignature(
                      false
                    )
                  }
                  aria-pressed={
                    !useTextSignature
                  }
                >
                  Draw
                </button>

                <button
                  type="button"
                  className={`px-toggle__btn ${
                    useTextSignature
                      ? "px-toggle__btn--pink px-toggle__btn--active"
                      : ""
                  }`}
                  style={{
                    minWidth: 110,
                    padding:
                      ".5rem 1rem",
                  }}
                  onClick={() =>
                    setUseTextSignature(
                      true
                    )
                  }
                  aria-pressed={
                    useTextSignature
                  }
                >
                  Type
                </button>
              </div>

              {useTextSignature ? (
                <input
                  type="text"
                  placeholder="Type your name"
                  value={
                    typedSignature
                  }
                  onChange={(e) =>
                    setTypedSignature(
                      e.target
                        .value
                    )
                  }
                  className="px-input"
                  style={{
                    maxWidth: 420,
                    margin:
                      "0 auto 12px",
                  }}
                />
              ) : (
                <SignatureCanvas
                  penColor="#2c62ba"
                  ref={
                    sigCanvasRef
                  }
                  backgroundColor="#ffffff"
                  canvasProps={{
                    width: 420,
                    height: 160,
                    style: {
                      border:
                        "1px solid #e5e7f0",
                      borderRadius: 10,
                      width:
                        "100%",
                      maxWidth: 420,
                      margin:
                        "0 auto 12px",
                      display:
                        "block",
                    },
                  }}
                />
              )}

              <button
                className="boutique-primary-btn"
                onClick={
                  handleSignatureSubmit
                }
                style={{
                  width: 260,
                  margin:
                    "0 auto",
                }}
              >
                Save
                Signature
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RubiDessertContract;