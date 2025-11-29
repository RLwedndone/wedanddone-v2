// src/pages/BlogPost.tsx
import React, { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { useParams, Link } from "react-router-dom";
import { blogPosts } from "../data/blogPosts";
import LazyVimeo from "../components/common/LazyVimeo";

const BlogPost: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const post = blogPosts.find((p) => p.slug === slug);

  // 🔹 Hero source: use explicit heroImage if present, otherwise first section image
  const heroSrc =
    post?.heroImage || (post?.sections && post.sections[0]?.image) || undefined;

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

  const outerStyle: CSSProperties = {
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
  };

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

  // 404-ish: post not found
  if (!post) {
    return (
      <div className="wd-dashboard-bg" style={outerStyle}>
        {/* dark overlay */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.35)",
            pointerEvents: "none",
          }}
        />

        <div className="pixie-card" style={cardStyle}>
          {/* pink X inside card */}
          <Link
            to="/dashboard"
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
          </Link>

          <div className="pixie-card__body">
            <h1 className="px-title-lg">Whoops, that spell fizzled.</h1>
            <p>
              We couldn’t find that Wedding Wisdom article. Try heading back to
              the list.
            </p>
            <Link
              to="/blog"
              className="pixie-button pixie-button--primary"
              style={{ marginTop: 16 }}
            >
              Back to Wedding Wisdom
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="wd-dashboard-bg" style={outerStyle}>
      {/* 🌙 Dark overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundColor: "rgba(0,0,0,0.35)",
          pointerEvents: "none",
        }}
      />

      <div className="pixie-card" style={cardStyle}>
        {/* 🩷 Pink X Close → back to dashboard */}
        <Link
          to="/dashboard"
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
        </Link>

        <div
          className="pixie-card__body"
          style={{
            padding: "1.75rem 1.5rem 2.25rem",
          }}
        >
          {/* Title + date */}
          <h1
            className="px-title-lg"
            style={{ marginBottom: 8, textAlign: "center" }}
          >
            {post.title}
          </h1>

          <small
            style={{
              display: "block",
              marginBottom: 24,
              color: "#888",
              textAlign: "center",
            }}
          >
            {new Date(post.date).toLocaleDateString()}
          </small>

          {/* Sections: magazine layout, or fallback to plain content */}
          {post.sections && post.sections.length > 0 ? (
            <div
              className="px-prose-narrow"
              style={{
                color: "#333",
                textAlign: "left",
                maxWidth: "100%",
                margin: "0 auto",
              }}
            >
              {/* 🖼 HERO at top of article content */}
              {heroSrc && (
                <div
                  style={{
                    borderRadius: 20,
                    overflow: "hidden",
                    margin: "0 auto 24px",
                    boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
                    maxWidth: "100%",
                  }}
                >
                  <img
                    src={heroSrc}
                    alt={post.title}
                    style={{
                      width: "100%",
                      height: "auto",
                      display: "block",
                      objectFit: "cover",
                    }}
                  />
                </div>
              )}

              {post.sections.map((section, index) => {
                const floatLeft = index % 2 !== 0; // odd indexes float left

                return (
                  <section
                    key={section.id}
                    style={{
                      marginBottom: 36,
                      textAlign: floatLeft ? "right" : "left",
                    }}
                  >
                    {/* Script-style, bigger, blue section heading */}
                    <h2
                      style={{
                        fontSize: "1.6rem",
                        marginBottom: 12,
                        color: "#2c62ba",
                        fontFamily: "'Jenna Sue', 'JennaSue', cursive",
                        fontWeight: 400,
                      }}
                    >
                      {section.heading}
                    </h2>

                    {/* Media: float left/right so text wraps like a magazine */}
                    {(section.vimeoId || section.image) && (
                      <div
                        style={{
                          float: floatLeft ? "left" : "right",
                          width: 380,
                          maxWidth: "55%",
                          margin: floatLeft
                            ? "0 24px 16px 0" // image on the left
                            : "0 0 16px 24px", // image on the right
                          borderRadius: 16,
                          overflow: "hidden",
                          boxShadow: "0 8px 24px rgba(0,0,0,0.22)",
                        }}
                      >
                        {section.vimeoId ? (
                          <LazyVimeo
                            videoId={section.vimeoId}
                            title={section.heading}
                            thumbnail={
                              section.image ||
                              `${import.meta.env.BASE_URL}assets/images/VideoThumbnails/WDintroThumb.jpg`
                            }
                          />
                        ) : (
                          section.image && (
                            <img
                              src={section.image}
                              alt={section.imageAlt || section.heading}
                              style={{
                                width: "100%",
                                height: "100%",
                                maxHeight: 320,
                                objectFit: "cover",
                                display: "block",
                              }}
                            />
                          )
                        )}
                      </div>
                    )}

                    {/* Body text – wraps around the floated media */}
                    <p
                      style={{
                        margin: "0 0 8px 0",
                        whiteSpace: "pre-line",
                        lineHeight: 1.6,
                        fontSize: "1.05rem",
                      }}
                    >
                      {section.body}
                    </p>

                    {/* Clear the float so the next section starts below the media */}
                    <div style={{ clear: "both", marginTop: 8 }} />
                  </section>
                );
              })}

              {/* Back link at the bottom */}
              <div style={{ marginTop: 32 }}>
                <Link
                  to="/blog"
                  style={{
                    display: "inline-block",
                    color: "#0077cc",
                  }}
                >
                  ← Back to Wedding Wisdom
                </Link>
              </div>
            </div>
          ) : (
            // Fallback for older posts that just use `content`
            <div
              className="px-prose-narrow"
              style={{ color: "#333", whiteSpace: "pre-line" }}
            >
              {post.content}

              <div style={{ marginTop: 32 }}>
                <Link
                  to="/blog"
                  style={{
                    display: "inline-block",
                    color: "#0077cc",
                  }}
                >
                  ← Back to Wedding Wisdom
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BlogPost;