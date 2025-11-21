// src/components/jam/JamIncludedCart.tsx
import React, { useState } from "react";
import { getAuth } from "firebase/auth";
import { generateGrooveGuidePDF } from "../../utils/generateGrooveGuidePDF";
import { uploadDocToFirestore } from "../../utils/uploadDocToFirestore";
import emailjs from "@emailjs/browser";
import {
  EMAILJS_SERVICE_ID,
  EMAILJS_PUBLIC_KEY,
} from "../../config/emailjsConfig";


interface JamIncludedCartProps {
  onBack: () => void;
  onClose: () => void;
  jamSelections: any;
  fullName: string;
  weddingDate: string | null;
}

const JamIncludedCart: React.FC<JamIncludedCartProps> = ({
  onBack,
  onClose,
  jamSelections,
  fullName,
  weddingDate,
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    setError(null);
    setIsGenerating(true);

    try {
      const user = getAuth().currentUser;
      if (!user) {
        setError(
          "You’ll need to be logged into your Wed&Done account so we can save your Groove Guide to your Docs."
        );
        setIsGenerating(false);
        return;
      }

      const safeDate =
        weddingDate ||
        localStorage.getItem("weddingDate") ||
        new Date().toISOString().slice(0, 10);

      // Make it pretty for the email
      const formattedDate = new Date(`${safeDate}T12:00:00`).toLocaleDateString(
        "en-US",
        { year: "numeric", month: "long", day: "numeric" }
      );

      // 1) Build PDF blob from selections
      const pdfBlob = await generateGrooveGuidePDF({
        fullName: fullName || user.displayName || "Your DJ Client",
        weddingDate: safeDate,
        selections: jamSelections,
      });

      // 2) Upload to Storage + add to user's docs; get URL back
      const title = `Groove Guide – Jam & Groove (${safeDate})`;
      const downloadURL = await uploadDocToFirestore(user.uid, pdfBlob, title);

            // 3) Send admin “New Booking – product_name” email with View PDF link
            try {
              await emailjs.send(
                EMAILJS_SERVICE_ID,
                "template_jq2xexq",
                {
                  product_name: "Jam & Groove Groove Guide – Rubi House DJ",
                  user_full_name: fullName || user.displayName || "Unknown User",
                  user_email: user.email || "unknown@wedndone.com",
                  wedding_date: formattedDate,
                  pdf_url: downloadURL,
                },
                EMAILJS_PUBLIC_KEY
              );
              console.log("📧 Rubi DJ Groove Guide admin email sent");
            } catch (emailErr) {
              console.error("❌ Error sending Rubi DJ email:", emailErr);
              // don’t block success if the email fails; PDF is still saved
            }

      setIsDone(true);
    } catch (err) {
      console.error("❌ Error generating Groove Guide PDF:", err);
      setError(
        "Something went wrong while creating your Groove Guide. Please try again in a moment."
      );
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="pixie-card pixie-card--modal" style={{ maxWidth: 720 }}>
      {/* 🩷 Pink X close */}
      <button className="pixie-card__close" onClick={onClose} aria-label="Close">
        <img
          src={`${import.meta.env.BASE_URL}assets/icons/pink_ex.png`}
          alt="Close"
        />
      </button>

      <div className="pixie-card__body" style={{ textAlign: "center" }}>
        <img
          src={`${import.meta.env.BASE_URL}assets/images/jam_groove_button.png`}
          alt="Jam & Groove"
          className="px-media"
          style={{ width: 120, margin: "0 auto 12px" }}
        />

        <h2 className="px-title-lg" style={{ marginBottom: 8 }}>
          Your Groove Guide is almost ready!
        </h2>

        <p className="px-prose-narrow" style={{ marginBottom: 12 }}>
          You’ve finished picking all your songs and musical vibes. 🪩{" "}
          Since your Rubi House package already includes your DJ, there’s{" "}
          <strong>nothing to pay here</strong>.
        </p>

        <p className="px-prose-narrow" style={{ marginBottom: 18 }}>
          Smash the button below to bundle up all your Jam &amp; Groove choices
          into a handy PDF, save it to your Wed&amp;Done Docs, and share it with
          your Rubi House DJ so they know exactly what magic to spin. 🎶✨
        </p>

        {error && (
          <p
            className="px-prose-narrow"
            style={{ color: "#b30000", marginBottom: 10 }}
          >
            {error}
          </p>
        )}

        {!isDone ? (
          <div className="px-cta-col" style={{ marginTop: 10 }}>
            <button
              className="boutique-primary-btn"
              style={{ width: 260 }}
              onClick={handleGenerate}
              disabled={isGenerating}
            >
              {isGenerating
                ? "Creating your Groove Guide…"
                : "Create My Groove Guide PDF"}
            </button>
            <button
              className="boutique-back-btn"
              style={{ width: 260 }}
              onClick={onBack}
            >
              ⬅ Back to Music Choices
            </button>
          </div>
        ) : (
          <div style={{ marginTop: 16 }}>
            <img
              src={`${import.meta.env.BASE_URL}assets/images/agreement_signed.png`}
              alt="Groove Guide Saved"
              className="px-media"
              style={{ maxWidth: 120, margin: "0 auto 6px" }}
            />
            <p className="px-prose-narrow" style={{ marginBottom: 16 }}>
              Boom! Your Groove Guide has been saved to your Wed&amp;Done
              Documents. You can download it anytime and send it straight to your
              DJ.
            </p>
            <div className="px-cta-col">
              <button
                className="boutique-primary-btn"
                style={{ width: 260 }}
                onClick={onClose}
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default JamIncludedCart;