import React, { useMemo, useState } from "react";
import "./UserMenu.css";

type UserMenuScreenType =
  | "menu"
  | "account"
  | "docs"
  | "bookings"
  | "guestListScroll"
  | "payments"
  | "pixiePurchases";

type UserMenuProps = {
  onClose: () => void;
  onSelect: (section: UserMenuScreenType) => void;
  onLogout: () => void;
  showGuestListScroll?: boolean;
  showPixiePurchases?: boolean;
  hasDocsNotifications?: boolean;
};

const UserMenu: React.FC<UserMenuProps> = ({
  onClose,
  onSelect,
  onLogout,
  showGuestListScroll = false,
  showPixiePurchases = false,
  hasDocsNotifications = false,
}) => {
  const handleClick = (section: UserMenuScreenType) => onSelect(section);

  const BASE = import.meta.env.BASE_URL;

  const normalDocsSrc = `${BASE}assets/images/docs_bar.png`;
  const alertCandidates = useMemo(
    () => [
      `${BASE}assets/images/docs_bar_alert.png`,  // underscore version
      `${BASE}assets/images/docs_bar-alert.png`,  // hyphen version
    ],
    [BASE]
  );

  // track which docs image we're currently trying
  const [docsSrc, setDocsSrc] = useState(
    hasDocsNotifications ? alertCandidates[0] : normalDocsSrc
  );

  // if notifications flag changes while menu is open, update src
  React.useEffect(() => {
    setDocsSrc(hasDocsNotifications ? alertCandidates[0] : normalDocsSrc);
  }, [hasDocsNotifications, alertCandidates, normalDocsSrc]);

  const handleDocsImgError = () => {
    // If alert is requested, try the next candidate; otherwise keep normal.
    if (!hasDocsNotifications) return;

    if (docsSrc === alertCandidates[0]) {
      setDocsSrc(alertCandidates[1]);
      return;
    }

    // both failed → fall back to normal (so you don't get a broken image)
    setDocsSrc(normalDocsSrc);
  };

  return (
    <div className="user-menu-overlay">
      <div className="user-menu-container">
        <button className="user-menu-close" onClick={onClose}>✖</button>

        <ul className="image-menu-list">
          <li>
            <button className="menu-btn" onClick={() => handleClick("account")}>
              <img
                src={`${BASE}assets/images/account_bar.png`}
                alt="Account"
                className="menu-item-img"
              />
            </button>
          </li>

          <li>
            <button className="menu-btn" onClick={() => handleClick("docs")}>
              <img
                src={docsSrc}
                onError={handleDocsImgError}
                alt="Docs"
                className="menu-item-img"
              />
            </button>
          </li>

          <li>
            <button className="menu-btn" onClick={() => handleClick("bookings")}>
              <img
                src={`${BASE}assets/images/bookings_bar.png`}
                alt="Bookings"
                className="menu-item-img"
              />
            </button>
          </li>

          <li>
            <button
              className="menu-btn"
              onClick={() => handleClick("payments")}
              title="Manage payment method"
              aria-label="Payments"
            >
              <img
                src={`${BASE}assets/images/credit_card.png`}
                alt="Payments"
                className="menu-item-img"
              />
            </button>
          </li>

          {showGuestListScroll && (
            <li>
              <button
                className="menu-btn"
                onClick={() => handleClick("guestListScroll")}
                title="Need to add more loved ones? Use your Guest List Scroll to update your count ✨"
                aria-label="Guest List Scroll"
              >
                <img
                  src={`${BASE}assets/images/guest_bar.png`}
                  alt="Guest List Scroll"
                  className="menu-item-img"
                />
              </button>
            </li>
          )}

          {showPixiePurchases && (
            <li>
              <button
                className="menu-btn"
                onClick={() => handleClick("pixiePurchases")}
                title="Pixie Purchases"
                aria-label="Pixie Purchases"
              >
                <img
                  src={`${BASE}assets/images/pixie_purchase.png`}
                  alt="Pixie Purchases"
                  className="menu-item-img"
                />
              </button>
            </li>
          )}

          <li>
            <button className="menu-btn" onClick={onLogout}>
              <img
                src={`${BASE}assets/images/LogOut_Bar.png`}
                alt="Log Out"
                className="menu-item-img"
              />
            </button>
          </li>
        </ul>
      </div>
    </div>
  );
};

export default UserMenu;