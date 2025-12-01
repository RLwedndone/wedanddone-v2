import React, { useState, useEffect } from "react";
import SelectionModal from "../shared/SelectionModal";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../../../firebase/firebaseConfig";

interface MenuSelectionCateringProps {
  selectedCuisine: string | null;
  menuSelections: {
    appetizers: string[];
    mains: string[];
    sides: string[];
  };
  setMenuSelections: (data: {
    appetizers: string[];
    mains: string[];
    sides: string[];
  }) => void;
  onContinue: () => void;
  onBack: () => void;
  onClose: () => void;
}

const menuData: {
    [key: string]: {
      appetizers: string[];
      mains: string[];
      sides: string[];
    };
  } = {
      italian: {
        appetizers: [
          "roasted bell pepper bruschetta",
          "grilled asparagus with prosciutto bruschetta",
          "smoked salmon with brie bruschetta",
          "salami caprese skewer",
          "sirloin steak skewer",
          "three cream tortellini with pesto",
          "smoked salmon and brie cheese bruschetta",
          "sirloin steak skewers with chipotle aioli",
          "veggies platter",
          "fresh fruit platter",
          "cheese and meat platter",
        ],
        mains: [
          "chicken piccata",
          "chicken parmesan",
          "tuscan grilled chicken breast",
          "bacon wrapped sirloin",
          "lemon glazed grilled salmon",
          "baked vegetable lasagna",
          "chicken rolatini",
          "pesto cream chicken",
          "chicken cordon bleu",
        ],
        sides: [
          "vodka rotelli with tomato cream sauce",
          "fettuccine alfredo",
          "penne with marinara",
          "creamy mashed potatoes",
          "green beans",
          "steamed mixed vegetables",
          "three cheese tortellini",
          "cinnamon caramelized carrots",
          "seasoned roasted red potatoes",
          "rice pilaf",
        ],
      },
      american: {
        appetizers: [
          "cream cheese balls",
          "sirloin steak skewers with chipotle aioli",
          "grilled vegetable skewers with balsamic vinaigrette reduction",
          "wrapped in bacon stuffed jalapenos",
          "veggie platter",
          "fresh fruit platter",
          "cheese and meats platter",
        ],
        mains: [
          "bbq glazed pork chops",
          "smoked bbq beef brisket",
          "baked vegetable lasagna",
          "lemon glazed grilled salmon",
          "bacon wrapped sirloin medallion",
          "bbq pulled pork",
          "bbq ribs",
          "herb crusted roast beef brisket",
          "jack daniel's smoked bbq chicken",
        ],
        sides: [
          "chipotle mac & cheese",
          "caramel cinnamon carrots",
          "roasted red potatoes",
          "creamy mashed potatoes",
          "green beans",
          "steamed mixed vegetables",
          "smoked beans",
          "baked potato",
          "coleslaw",
          "sweet corn",
        ],
      },
      mexican: {
        appetizers: [
          "sopecitos (chorizo with potatoes sopecitos)",
          "bacon wrapped stuffed jalapenos",
          "mini tinga tostada (chicken)",
          "mexican shrimp ceviche",
          "poblano cheese dip & chips",
          "mango & cranberry guacamole cone",
          "guacamole, salsas & chips bar",
        ],
        mains: [
          "creamy chicken poblano",
          "steak fajitas",
          "chicken fajitas",
          "beef barbacoa with potatoes",
          "shredded pork in ancho sauce",
          "baked mahi mahi",
          "veracruz style",
          "chile en nogada (stuffed poblano pepper - ground beef, apples, pears, peaches, pecans and almonds, walnut cream sauce, fresh pomegranate)",
          "traditional mole poblano",
        ],
        sides: [
          "spanish rice",
          "refried beans",
          "chorizo beans",
          "cilantro lime rice",
          "sauteed corn and mexican squash",
          "mexican style pasta salad",
        ],
      },
      taco: {
        appetizers: [
          "sopecitos (chorizo with potatoes sopecitos)",
          "bacon wrapped stuffed jalapenos",
          "mini tinga tostada (chicken)",
          "mexican shrimp ceviche",
          "poblano cheese dip & chips",
          "mango & cranberry guacamole cone",
          "guacamole, salsas & chips bar",
        ],
        mains: [
          "grilled chicken",
          "carne asada",
          "beef brisket",
          "chicken tinga",
          "cochinita pibil (adobo marinated pulled pork)",
          "barbacoa",
          "carnitas",
          "rajas con queso (vegetarian)",
          "nopales (grilled mexican cactus, vegetarian)",
        ],
        sides: [
          "spanish rice",
          "refried beans",
          "chorizo beans",
          "cilantro lime rice",
          "mexican style pasta salad",
        ],
      },
    };

    const MenuSelectionCatering: React.FC<MenuSelectionCateringProps> = ({
        selectedCuisine,
        menuSelections,
        setMenuSelections,
        onContinue,
        onBack,
        onClose,
      }) => {
        console.log("🧪 YumMenuBuilder mounted");
        console.log("🍽️ selectedCuisine:", selectedCuisine);
        console.log("📋 menuData keys:", Object.keys(menuData));
      
        if (selectedCuisine && menuData[selectedCuisine]) {
          console.log("📋 menuData[selectedCuisine]:", menuData[selectedCuisine]);
        }
      
        const [showModal, setShowModal] = useState<"apps" | "mains" | "sides" | null>(null);
        const [hovered, setHovered] = useState<string | null>(null);
      
        useEffect(() => {
            const auth = getAuth();
          
            const unsubscribe = onAuthStateChanged(auth, async (user) => {
              if (user) {
                try {
                  const docRef = doc(db, "users", user.uid, "yumYumData", "menuSelections");
                  const docSnap = await getDoc(docRef);
                  if (docSnap.exists()) {
                    const saved = docSnap.data();
                    if (saved?.appetizers || saved?.mains || saved?.sides) {
                      setMenuSelections({
                        appetizers: saved.appetizers || [],
                        mains: saved.mains || [],
                        sides: saved.sides || [],
                      });
                      return; // ✅ Don’t load localStorage if Firestore data exists
                    }
                  }
                } catch (error) {
                  console.error("❌ Error fetching menuSelections:", error);
                }
              }
          
              // 👤 Guest or no Firestore data → fallback to localStorage
              const local = localStorage.getItem("yumMenuSelections");
              if (local) {
                setMenuSelections(JSON.parse(local));
              }
            });
          
            return () => unsubscribe();
          }, []);
      
        const handleModalClose = (type: "apps" | "mains" | "sides", selections: string[]) => {
          const newSelections = {
            ...menuSelections,
            [type === "apps" ? "appetizers" : type]: selections,
          };
      
          setMenuSelections(newSelections);
      
          // ✅ Immediately update localStorage regardless of auth
          localStorage.setItem("yumMenuSelections", JSON.stringify(newSelections));
          localStorage.setItem("yumStep", "menu");
      
          onAuthStateChanged(getAuth(), async (user) => {
            if (user) {
              try {
                const docRef = doc(db, "users", user.uid, "yumYumData", "menuSelections");
                await setDoc(docRef, newSelections, { merge: true });
      
                const progressRef = doc(db, "users", user.uid);
                await setDoc(
                  progressRef,
                  {
                    progress: {
                      yumYum: {
                        step: "menu",
                      },
                    },
                  },
                  { merge: true }
                );
              } catch (error) {
                console.error("❌ Error saving menu selections:", error);
              }
            }
          });
      
          setShowModal(null);
        };
      
        if (!selectedCuisine || !menuData[selectedCuisine]) {
          console.log("🚫 Menu data missing or invalid. Not rendering menu builder.");
          return null;
        }
        const menu = menuData[selectedCuisine];
      

        return (
          <div
            className="pixie-card pixie-card--modal"
            style={{ maxWidth: 560, position: "relative" }}
          >
            {/* Close (Floral-style) */}
            <button
              className="pixie-card__close"
              aria-label="Close"
              onClick={onClose}
            >
              <img src={`${import.meta.env.BASE_URL}assets/icons/pink_ex.png`} alt="Close" />
            </button>
        
            <div className="pixie-card__body" style={{ textAlign: "center" }}>
              <h2
                style={{
                  fontFamily: "'Jenna Sue', cursive",
                  fontSize: "2.2rem",
                  color: "#2c62ba",
                  textAlign: "center",
                }}
              >
                Make your menu selections!
              </h2>
        
              <img
                src={`${import.meta.env.BASE_URL}assets/images/YumYum/piglet1.png`}
                alt="Piglet Chef"
                style={{ width: "160px", margin: "0 auto 30px", display: "block" }}
              />
        
              {(["apps", "mains", "sides"] as const).map((type) => (
                <div key={type} style={{ textAlign: "center", marginBottom: "2rem" }}>
                  <img
  src={`${import.meta.env.BASE_URL}assets/images/YumYum/${type}.png`}
  alt={type}
  onClick={() => setShowModal(type)}
  onMouseEnter={() => setHovered(type)}
  onMouseLeave={() => setHovered(null)}
  style={{
    width: "260px",
    cursor: "pointer",
    transition: "transform 0.3s ease",
    transform: hovered === type ? "scale(1.05)" : "scale(1)",
  }}
/>
                  {menuSelections[type === "apps" ? "appetizers" : type].map((item) => (
                    <div
                      key={item}
                      onClick={() => setShowModal(type)}
                      style={{
                        fontFamily: "'Jenna Sue', cursive",
                        fontSize: "2rem",
                        color: "#2c62ba",
                        cursor: "pointer",
                      }}
                    >
                      {item}
                    </div>
                  ))}
                </div>
              ))}
        
              {/* ─────────── Bottom Buttons (stacked layout) ─────────── */}
<div
  style={{
    marginTop: "2rem",
    display: "flex",
    flexDirection: "column", // ✅ stack vertically
    alignItems: "center",
    gap: "1rem",
  }}
>
  <button
    className="boutique-primary-btn"
    onClick={() => {
      localStorage.setItem("yumStep", "cart");
      onContinue();
    }}
    style={{ width: "250px" }}
  >
    Continue
  </button>

  <button
    className="boutique-back-btn"
    onClick={onBack}
    style={{ width: "250px" }}
  >
    Back
  </button>
</div>
            </div>
        
            {/* Modals (unchanged) */}
            {showModal === "apps" && (
              <SelectionModal
                title="Select up to 3 appetizers"
                options={menu.appetizers}
                max={3}
                selected={menuSelections.appetizers}
                onChange={(selections) => handleModalClose("apps", selections)}
                onClose={() => setShowModal(null)}
              />
            )}
            {showModal === "mains" && (
              <SelectionModal
                title="Select up to 2 mains"
                options={menu.mains}
                max={2}
                selected={menuSelections.mains}
                onChange={(selections) => handleModalClose("mains", selections)}
                onClose={() => setShowModal(null)}
              />
            )}
            {showModal === "sides" && (
              <SelectionModal
                title="Select up to 2 sides"
                options={menu.sides}
                max={2}
                selected={menuSelections.sides}
                onChange={(selections) => handleModalClose("sides", selections)}
                onClose={() => setShowModal(null)}
              />
            )}
          </div>
        );
};

export default MenuSelectionCatering;