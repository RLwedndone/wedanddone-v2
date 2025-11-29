// src/components/WedAndDoneInfo/LegalStuff.tsx
import React from "react";
import { useNavigate } from "react-router-dom";

const LegalStuff: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="pixie-overlay">
      <div className="pixie-card pixie-card--modal" style={{ maxWidth: 720 }}>
        {/* ✨ Close Button */}
        <button
          className="pixie-card__close"
          onClick={() => navigate(-1)}
          aria-label="Close"
        >
          <img
            src={`${import.meta.env.BASE_URL}assets/icons/pink_ex.png`}
            alt="Close"
          />
        </button>

        <div className="pixie-card__body px-prose" style={{ paddingTop: 10 }}>
          {/* TODO: swap this placeholder for your custom legal icon */}
          <div style={{ textAlign: "center", marginBottom: 16 }}>
          <img
  src={`${import.meta.env.BASE_URL}assets/images/LegalStuff.jpg`}
  alt="Legal Icon"
  style={{ width: 120, height: "auto", opacity: 0.95 }}
/>
          </div>

          <h1 className="px-title-lg" style={{ textAlign: "center" }}>
            The Fine Print
          </h1>
          <p className="px-body" style={{ textAlign: "center" }}>
            A friendly peek behind the curtain at how bookings, contracts, and
            your info work inside Wed&amp;Done.
          </p>

          {/* ───────────────────────── SECTION 1 ───────────────────────── */}
          <section style={{ marginTop: 28 }}>
            <h2 className="px-title-md">How Bookings Work</h2>
            <p className="px-body-sm">
              When you book a venue or vendor through Wed&amp;Done, you are
              entering into a direct service agreement with us. Think of us as
              your wedding “general contractor.” Wed&amp;Done coordinates with
              partner venues and vendors behind the scenes, signs the necessary
              contracts, and ensures your selections are communicated accurately
              and fulfilled properly.
            </p>

            <p className="px-body-sm">
              This means you book everything in one magical place, instead of
              managing a dozen separate agreements.
            </p>
          </section>

          {/* ───────────────────────── SECTION 2 ───────────────────────── */}
          <section style={{ marginTop: 28 }}>
            <h2 className="px-title-md">Deposits, Refunds &amp; Cancellations</h2>

            <h3 className="px-subtitle">Deposits</h3>
            <p className="px-body-sm">
              All deposits paid through Wed&amp;Done are{" "}
              <strong>non-refundable</strong>. Deposits lock in your date and
              initiate coordination with your chosen venue or vendor.
            </p>

            <h3 className="px-subtitle">Venue &amp; Vendor Policies</h3>
            <p className="px-body-sm">
              Each partner venue and vendor has their own refund, cancellation,
              and rescheduling policy. These policies are clearly included in
              your Wed&amp;Done digital contract so you can review them before
              booking.
            </p>

            <h3 className="px-subtitle">How We Support You</h3>
            <p className="px-body-sm">
              If you need to cancel or reschedule, we’ll happily help you review
              your options and communicate with your venue/vendor. However, all
              final decisions regarding refunds or policy exceptions are made by
              the venue or vendor according to their policy.
            </p>
          </section>

          {/* ───────────────────────── SECTION 3 ───────────────────────── */}
          <section style={{ marginTop: 28 }}>
            <h2 className="px-title-md">Privacy &amp; Your Info</h2>

            <h3 className="px-subtitle">What We Collect</h3>
            <p className="px-body-sm">
              To make the magic happen, we collect information you share with us,
              including:
            </p>
            <ul className="px-list">
              <li>
                <strong>Account details</strong> – your name, email address, and
                login info (and, if you choose, details like phone number).
              </li>
              <li>
                <strong>Wedding details</strong> – date, location, guest count,
                and preferences that you enter into our boutiques.
              </li>
              <li>
                <strong>Selections &amp; bookings</strong> – venues, packages,
                menus, add-ons, and other choices you make inside Wed&amp;Done.
              </li>
              <li>
                <strong>Payment-related info</strong> – basic billing details
                and payment status so we can track deposits and balances.
              </li>
            </ul>

            <h3 className="px-subtitle">What We Don&apos;t Store</h3>
            <p className="px-body-sm">
              We do <strong>not</strong> store your full credit card number on
              our servers. Payments are processed securely through our
              third-party payment provider. They handle the sensitive card
              details; we receive payment confirmations and limited billing
              metadata so we can keep your booking history accurate.
            </p>

            <h3 className="px-subtitle">How We Use Your Info</h3>
            <p className="px-body-sm">
              We use your information to:
            </p>
            <ul className="px-list">
              <li>Build quotes, contracts, and receipts for your bookings.</li>
              <li>
                Coordinate details with your chosen venues and vendors so they
                know exactly what you&apos;ve booked.
              </li>
              <li>
                Save your progress so you can leave and return to your planning
                without losing work.
              </li>
              <li>
                Improve the platform over time (for example, understanding which
                features couples use the most).
              </li>
            </ul>

            <h3 className="px-subtitle">How Long We Keep It</h3>
            <p className="px-body-sm">
              We keep your account and booking information for as long as it&apos;s
              needed to:
            </p>
            <ul className="px-list">
              <li>Provide your services and support your wedding date.</li>
              <li>
                Maintain accurate financial and booking records (as required for
                business, tax, and accounting purposes).
              </li>
            </ul>
            <p className="px-body-sm">
              If you decide you no longer want to use Wed&amp;Done, you can
              reach out and request that we close your account. In some cases we
              may need to retain limited information for legal or recordkeeping
              reasons, but we&apos;ll explain what that means if you ask.
            </p>

            <h3 className="px-subtitle">Your Choices</h3>
            <p className="px-body-sm">
              You can update many of your details directly inside the app. If
              you ever want to:
            </p>
            <ul className="px-list">
              <li>Update your contact information,</li>
              <li>Ask what information we have on file, or</li>
              <li>Request account closure,</li>
            </ul>
            <p className="px-body-sm">
              just email us at <strong>madge@wedanddone.com</strong> or tap the
              glowing question-mark inside the app and we’ll help.
            </p>
          </section>

          {/* ───────────────────────── SECTION 4 ───────────────────────── */}
          <section style={{ marginTop: 28 }}>
            <h2 className="px-title-md">Need a Human?</h2>
            <p className="px-body-sm">
              If you need clarification on any part of your agreement, payments,
              or how your information is handled, our team is always here to
              help.
            </p>
            <p className="px-body-sm">
              Email us anytime at <strong>madge@wedanddone.com</strong> or tap
              the glowing question-mark inside the app to message support.
            </p>
          </section>

          <p
            className="px-body-xs"
            style={{ marginTop: 28, opacity: 0.6, textAlign: "center" }}
          >
            This summary is provided for convenience. The specific terms in your
            signed Wed&amp;Done contract and the incorporated venue/vendor
            policies will always govern your booking.
          </p>
        </div>
      </div>
    </div>
  );
};

export default LegalStuff;