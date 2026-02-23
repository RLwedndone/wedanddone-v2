// src/pages/BlogPostV2.tsx
import React, { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { useParams, Link } from "react-router-dom";
import { blogPosts } from "../data/blogPosts";
import LazyVimeo from "../components/common/LazyVimeo";

/**
 * BlogPostV2
 * - Text-first, calm, authority layout
 * - No floated media (no alternating left/right)
 * - Supports **bold**, URL autolinks, and bullet lines that start with "• "
 */
const renderBlogBodyHtml = (text: string) => {
  // Escape HTML so nobody can inject tags from blogPosts.ts
  let safe = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Support **bold** markdown
  safe = safe.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");

  // Auto-link full URLs (http/https)
  safe = safe.replace(
    /(https?:\/\/[^\s<]+[^\s<\.)])/g,
    `<a href="$1" target="_blank" rel="noreferrer" style="color:#2c62ba;font-weight:800;text-decoration:underline;">$1</a>`
  );

  // Support simple bullet lines that start with "• "
  // (turns "• item" into "• item" with a real bullet entity)
  safe = safe.replace(/^•\s(.+)$/gm, "&#8226; $1");

  // Preserve line breaks
  safe = safe.replace(/\n/g, "<br/>");

  return safe;
};

const BlogPostV2: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const post = useMemo(() => blogPosts.find((p) => p.slug === slug), [slug]);

  // Hero: use explicit heroImage if present, otherwise first section image
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

        <div className="pixie-card wd-page-turn" style={cardStyle}>
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

  const hasSections = !!post.sections && post.sections.length > 0;

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

      <div className="pixie-card wd-page-turn" style={cardStyle}>
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
            {new Date(`${post.date}T12:00:00`).toLocaleDateString()}
          </small>

          {!hasSections ? (
            <div className="px-prose-narrow" style={{ color: "#333" }}>
              <p style={{ marginBottom: 16 }}>
                This post isn’t published yet (the pixies are still editing).
              </p>

              <Link to="/blog" className="pixie-button pixie-button--primary">
                Back to Wedding Wisdom
              </Link>
            </div>
          ) : (
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

              {/* Sections (stacked, no floats) */}
              {post.sections!.map((section) => (
                <section key={section.id} style={{ marginBottom: 40 }}>
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

                  {/* Media: centered + stacked */}
                  {(section.vimeoId || section.image) && (
                    <div
                      style={{
                        width: "100%",
                        maxWidth: 520,
                        margin: "18px auto 22px",
                        borderRadius: 16,
                        overflow: "hidden",
                        boxShadow: "0 8px 24px rgba(0,0,0,0.22)",
                      }}
                    >
                      {section.vimeoId ? (
                        <LazyVimeo
                          videoId={section.vimeoId}
                          title={section.heading}
                          thumbnail={section.image}
                        />
                      ) : (
                        section.image && (
                          <img
                            src={section.image}
                            alt={section.imageAlt || section.heading}
                            style={{
                              width: "100%",
                              height: "auto",
                              objectFit: "cover",
                              display: "block",
                            }}
                          />
                        )
                      )}
                    </div>
                  )}

                  {/* Body text (supports **bold**, bullet lines, and URL links) */}
                  <div
                    style={{
                      lineHeight: 1.7,
                      fontSize: "1.05rem",
                    }}
                    dangerouslySetInnerHTML={{
                      __html: renderBlogBodyHtml(section.body),
                    }}
                  />
                </section>
              ))}

              {/* Back link at the bottom */}
              <div style={{ marginTop: 28 }}>
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

export default BlogPostV2;