import React from "react";
import "./UserMenu.css";

type UserMenuScreenType =
  | "menu"
  | "account"
  | "docs"
  | "bookings"
  | "guestListScroll"
  | "payments"; // ✅ add payments

type UserMenuProps = {
  onClose: () => void;
  onSelect: (section: UserMenuScreenType) => void;
  onLogout: () => void;
  showGuestListScroll?: boolean; // controls visibility
};

const UserMenu: React.FC<UserMenuProps> = ({
  onClose,
  onSelect,
  onLogout,
  showGuestListScroll = false,
}) => {
  const handleClick = (section: UserMenuScreenType) => onSelect(section);

  return (
    <div className="user-menu-overlay">
      <div className="user-menu-container">
        <button className="user-menu-close" onClick={onClose}>✖</button>

        <ul className="image-menu-list">
          <li>
            <button className="menu-btn" onClick={() => handleClick("account")}>
              <img
                src={`${import.meta.env.BASE_URL}assets/images/account_bar.png`}
                alt="Account"
                className="menu-item-img"
              />
            </button>
          </li>

          <li>
            <button className="menu-btn" onClick={() => handleClick("docs")}>
              <img
                src={`${import.meta.env.BASE_URL}assets/images/docs_bar.png`}
                alt="Docs"
                className="menu-item-img"
              />
            </button>
          </li>

          <li>
            <button className="menu-btn" onClick={() => handleClick("bookings")}>
              <img
                src={`${import.meta.env.BASE_URL}assets/images/bookings_bar.png`}
                alt="Bookings"
                className="menu-item-img"
              />
            </button>
          </li>

          {/* ⭐ Payments */}
          <li>
            <button
              className="menu-btn"
              onClick={() => handleClick("payments")}
              title="Manage payment method"
              aria-label="Payments"
            >
              <img
                src={`${import.meta.env.BASE_URL}assets/images/credit_card.png`}
                alt="Payments"
                className="menu-item-img"
              />
            </button>
          </li>

          {/* ⭐ Guest List Scroll — visible only after a booking */}
          {showGuestListScroll && (
            <li>
              <button
                className="menu-btn"
                onClick={() => handleClick("guestListScroll")}
                title="Need to add more loved ones? Use your Guest List Scroll to update your count ✨"
                aria-label="Guest List Scroll"
              >
                <img
                  src={`${import.meta.env.BASE_URL}assets/images/guest_bar.png`}
                  alt="Guest List Scroll"
                  className="menu-item-img"
                />
              </button>
            </li>
          )}

          <li>
            <button className="menu-btn" onClick={onLogout}>
              <img
                src={`${import.meta.env.BASE_URL}assets/images/LogOut_Bar.png`}
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