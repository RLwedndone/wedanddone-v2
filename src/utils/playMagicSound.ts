// src/utils/playMagicSound.ts
let lastPlayedAt = 0;

/**
 * Plays the sparkle sound. If the browser blocks autoplay, we set up a
 * one-time pointer/touch listener to retry as soon as the user taps/clicks.
 *
 * Optionally pass a sessionStorage key to ensure we chime only once
 * per "flow" (e.g., 'chimed:bates:thankyou').
 */
const playMagicSound = (sessionKey?: string) => {
  try {
    if (sessionKey && sessionStorage.getItem(sessionKey)) {
      return;
    }

    // Avoid spam if multiple components try to chime at once
    const now = Date.now();
    if (now - lastPlayedAt < 800) return;

    const audio = new Audio(`${import.meta.env.BASE_URL}assets/sounds/sparkle.MP3`); // keep your path/case
    audio.currentTime = 0;

    const tryPlay = () =>
      audio
        .play()
        .then(() => {
          lastPlayedAt = Date.now();
          if (sessionKey) sessionStorage.setItem(sessionKey, "1");
        })
        .catch(() => {
          // Browser blocked autoplay — wait for the very next user gesture
          const handler = () => {
            audio
              .play()
              .finally(() => {
                lastPlayedAt = Date.now();
                if (sessionKey) sessionStorage.setItem(sessionKey, "1");
              })
              .catch((err) => console.warn("🔇 Magic sound play failed after gesture:", err));
            window.removeEventListener("pointerdown", handler);
            window.removeEventListener("touchstart", handler);
            window.removeEventListener("click", handler);
          };
          window.addEventListener("pointerdown", handler, { once: true });
          window.addEventListener("touchstart", handler, { once: true });
          window.addEventListener("click", handler, { once: true });
        });

    tryPlay();
  } catch (error) {
    console.warn("🔇 Magic sound play failed:", error);
  }
};

export default playMagicSound;