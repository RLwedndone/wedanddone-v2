// src/pages/BlogIndex.tsx
import React, { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { Link, useNavigate } from "react-router-dom";
import { blogPosts } from "../data/blogPosts";

const BlogIndex: React.FC = () => {
  const now = new Date();
  const navigate = useNavigate();

  const visiblePosts = blogPosts
    .filter((post) => new Date(post.date) <= now)
    .sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );

  const [bgStyle, setBgStyle] = useState<CSSProperties>({});
  const [cardVisible, setCardVisible] = useState(false);

  useEffect(() => {
    const updateBg = () => {
      const isMobile = window.innerWidth <= 768;

      const imgPath = isMobile
        ? `${import.meta.env.BASE_URL}assets/images/dashboard_mobile.webp`
        : `${import.meta.env.BASE_URL}assets/images/dashboard_wide.webp`;

      setBgStyle({
        backgroundImage: `url(${imgPath})`,
        backgroundSize: "cover",
        backgroundRepeat: "no-repeat",
        backgroundPosition: "center top",
      });
    };

    updateBg();
    window.addEventListener("resize", updateBg);
    return () => window.removeEventListener("resize", updateBg);
  }, []);

  useEffect(() => {
    setCardVisible(true);
  }, []);

  const cardStyle: CSSProperties = {
    maxWidth: 900,
    width: "100%",
    margin: "0 auto",
    zIndex: 2,
    position: "relative",
    boxShadow: "0 16px 45px rgba(0,0,0,0.35)",
    opacity: cardVisible ? 1 : 0,
    transform: cardVisible ? "translateY(0)" : "translateY(12px)",
    transition: "opacity 300ms ease-out, transform 300ms ease-out",
  };

  const handleBackToCloud = () => {
    navigate("/dashboard", {
      state: {
        openWedAndDoneInfo: true,
        wedAndDoneStartScreen: "intro",
      },
    });
  };

  return (
    <div
      className="wd-dashboard-bg"
      style={{
        ...bgStyle,
        minHeight: "100vh",
        height: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        padding: "40px 16px",
        boxSizing: "border-box",
        position: "relative",
        backgroundColor: "#000",
      }}
    >
      {/* Dark overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundColor: "rgba(0,0,0,0.35)",
          pointerEvents: "none",
        }}
      />

      {/* White card */}
      <div className="pixie-card wd-page-turn" style={cardStyle}>
        {/* Pink X = always returns to Dashboard */}
        <button
          onClick={() => navigate("/dashboard")}
          className="pixie-card__close"
          style={{
            position: "absolute",
            top: "1rem",
            right: "1rem",
            background: "none",
            border: "none",
            padding: 0,
            cursor: "pointer",
            zIndex: 5,
          }}
          aria-label="Close"
        >
          <img
            src={`${import.meta.env.BASE_URL}assets/icons/pink_ex.png`}
            alt="Close"
            style={{ width: 32, height: 32, display: "block" }}
          />
        </button>

        <div className="pixie-card__body">
          {/* Wedding Wisdom Video */}
          <video
            src={`${import.meta.env.BASE_URL}assets/videos/weddingwisdom.mp4`}
            autoPlay
            loop
            muted
            playsInline
            style={{
              width: "100%",
              maxWidth: "520px",
              borderRadius: "16px",
              margin: "0 auto 20px",
              display: "block",
            }}
          />

          {/* Title */}
          <h1
            className="px-title-lg"
            style={{ marginBottom: 12, textAlign: "center" }}
          >
            Wedding Wisdom
          </h1>

          <p
            style={{
              marginBottom: 24,
              color: "#555",
              textAlign: "center",
            }}
          >
            Deep dives, real talk, and a little pixie dust to help you plan
            smarter inside Wed&Done.
          </p>

          {/* Posts */}
          <div>
            {visiblePosts.map((post) => {
              const thumbSrc =
                post.thumbnail ||
                post.heroImage ||
                (post.sections && post.sections.length > 0
                  ? post.sections[0].image
                  : undefined);

              return (
                <article
                  key={post.slug}
                  style={{
                    borderBottom: "1px solid #eee",
                    paddingBottom: 24,
                    marginBottom: 24,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      gap: 24,
                    }}
                  >
                    {/* LEFT: Text content */}
                    <div style={{ flex: "1 1 auto" }}>
                      <h2
                        className="px-title-md"
                        style={{ marginBottom: 4, lineHeight: 1.25 }}
                      >
                        <Link
                          to={`/blog/${post.slug}`}
                          style={{ textDecoration: "none", color: "#333" }}
                        >
                          {post.title}
                        </Link>
                      </h2>

                      <small
                        style={{
                          display: "block",
                          marginBottom: 8,
                          color: "#888",
                        }}
                      >
                        {new Date(post.date).toLocaleDateString()}
                      </small>

                      <p style={{ marginBottom: 12, color: "#444" }}>
                        {post.excerpt}
                      </p>

                      <Link
                        to={`/blog/${post.slug}`}
                        className="pixie-button pixie-button--primary"
                      >
                        Read this guide
                      </Link>
                    </div>

                    {/* RIGHT: THUMBNAIL */}
                    {thumbSrc && (
                      <Link
                        to={`/blog/${post.slug}`}
                        style={{
                          flex: "0 0 200px",
                          display: "block",
                          borderRadius: 16,
                          overflow: "hidden",
                          boxShadow: "0 8px 24px rgba(0,0,0,0.22)",
                        }}
                      >
                        <img
                          src={thumbSrc}
                          alt={post.title}
                          style={{
                            width: "100%",
                            height: "140px",
                            objectFit: "cover",
                            display: "block",
                          }}
                        />
                      </Link>
                    )}
                  </div>
                </article>
              );
            })}
          </div>

         
          <div style={{ textAlign: "center", marginTop: 32 }}>
            {/* Pink “Back” button (matches logo-cloud screens) */}
<button
  onClick={handleBackToCloud}
  className="boutique-back-btn"
  style={{
    marginTop: "24px",
    display: "block",
    marginLeft: "auto",
    marginRight: "auto",
  }}
>
  ← Back
</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BlogIndex;