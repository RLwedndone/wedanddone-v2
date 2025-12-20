// src/components/NewYumBuild/catering/santisMenuConfig.ts

export type SantiCuisineKey = "italian" | "mexican" | "american" | "taco";

export interface SantiMenuItem {
  name: string;
  /** Short, marketing-style blurb used in the selection modal only */
  description?: string;
  /** Extra dollars per guest on top of the tier price (optional) */
  upgradeFeePerGuest?: number;
  /** Optional code so the cart can group certain upgrades (steak / fish / veg / tacoCondiments, etc.) */
  upgradeCode?: string;
}

export interface SantiCuisineConfig {
  label: string;
  appetizers: SantiMenuItem[];
  entrees: SantiMenuItem[];
  sides: SantiMenuItem[];
  salads: SantiMenuItem[];
}

export interface SantiExtrasConfig {
  /** Taco bar full condiments bar upgrade */
  tacoFullCondiments: {
    label: string;
    description: string;
    upgradeFeePerGuest: number;
    appliesTo: "taco";
    upgradeCode: string;
  };
}

export interface SantiMenuConfig {
  basePricePerGuest: {
    signature: number; // tier price before upgrades
    chef: number;
  };
  /** How many picks each tier gets in each section */
  allowances: {
    signature: {
      appetizers: number;
      entrees: number;
      sides: number;
      salads: number;
    };
    chef: {
      appetizers: number;
      entrees: number;
      sides: number;
      salads: number;
    };
  };
  cuisines: Record<SantiCuisineKey, SantiCuisineConfig>;
  extras: SantiExtrasConfig;
}

const SHARED_APPETIZERS: SantiMenuItem[] = [
  // Bruschettas
  {
    name: "Smoked Salmon Bruschetta",
    description: "With brie cheese.",
  },
  {
    name: "Roasted Red Bell Pepper Bruschetta",
    description: "With goat cheese.",
  },
  {
    name: "Grilled Asparagus Bruschetta",
    description: "Wrapped in prosciutto.",
  },

  // Kabobs / Skewers
  { name: "Lemon Cilantro Chicken Kabob" },
  { name: "Pineapple Hawaiian Chicken Kabob" },
  { name: "Sirloin Steak Skewers" },
  { name: "Salami Caprese Skewer" },

  // Mexican appetizers (available to all cuisines)
  {
    name: "Sopecitos",
    description:
      "Chorizo con papas (chopped potatoes) served on a handmade sope topped with sour cream and cotija cheese.",
  },
  {
    name: "Mini Tinga Tostada",
    description:
      "Shredded chicken with chipotle adobo topped with sour cream and cotija cheese.",
  },
  {
    name: "Stuffed Jalapeños",
    description:
      "Stuffed jalapeños wrapped in bacon and filled with cream cheese and cheddar cheese.",
  },
  {
    name: "Poblano Cheese Dip",
    description: "Creamy roasted poblano cheese dip. (Includes chips.)",
  },
  {
    name: "Cream Cheese Balls",
    description: "Deep fried cream cheese balls.",
  },
  {
    name: "Mexican Shrimp or Fish Ceviche",
    description: "(Includes individual chip.)",
  },
];

export const santisMenuConfig: SantiMenuConfig = {
  basePricePerGuest: {
    signature: 44,
    chef: 86,
  },

  allowances: {
    // Signature Feast – 1 of each
    signature: {
      appetizers: 1, 
      entrees: 1,
      sides: 1,
      salads: 1,
    },
    // Chef’s Feast – 2 of each
    chef: {
      appetizers: 2,
      entrees: 2,
      sides: 2,
      salads: 2,
    },
  },

  cuisines: {
        /* ───────────────── ITALIAN ───────────────── */

        italian: {
          label: "Italian Bounty",
          appetizers: SHARED_APPETIZERS,
    
          entrees: [
            {
              name: "Chicken Piccata",
              description:
                "Breaded chicken breast topped with lemon capers and white wine sauce.",
            },
            {
              name: "Chicken Parmesan",
              description:
                "Parmesan crusted chicken breast with marinara sauce and mozzarella cheese gratin.",
            },
            {
              name: "Chicken Cordon Bleu",
              description:
                "Chicken breast stuffed with ham and mozzarella cheese covered with chipotle cream sauce.",
            },
            {
              name: "Chicken Rollatini Style",
              description:
                "Chicken stuffed with sautéed mushrooms, spinach, bacon, mozzarella cheese and covered with alfredo mushroom sauce.",
            },
            {
              name: "Romano Chicken",
              description:
                "Breaded chicken with Pecorino Romano cheese, parsley and bread crumbs.",
            },
            {
              name: "Tuscan Chicken",
              description:
                "Grilled chicken breast with a three-cheese garlic cream sauce, spinach and cherry tomatoes.",
            },
            {
              name: "Pesto Creme Chicken",
              description:
                "Seasoned chicken breast covered with pesto cream sauce.",
            },
            {
              name: "Chicken Marsala",
              description:
                "Grilled or breaded chicken breast served with marsala sauce.",
            },
    
            // 🔼 Premium upgrade entrées
            {
              name: "Bacon Wrapped Sirloin Medallion",
              description:
                "Grilled sirloin medallion wrapped in bacon over asparagus with mushroom brown sauce.",
              upgradeFeePerGuest: 5,
              upgradeCode: "steak",
            },
            {
              name: "Lemon Glazed Grilled Salmon",
              description:
                "Grilled Atlantic salmon over asparagus topped with lemon honey glaze.",
              upgradeFeePerGuest: 5,
              upgradeCode: "fish",
            },
            {
              name: "Baked Vegetables Lasagna",
              description:
                "Layers of squash, zucchini and mushrooms baked with vegan marinara and vegan cheese.",
              upgradeFeePerGuest: 20,
              upgradeCode: "veg",
            },
          ],
    
          sides: [
            { name: "Three Cheese Tortellini" },
            { name: "Vodka Rotelle with Tomato Cream Sauce" },
            { name: "Penne Pasta with Marinara Sauce" },
            { name: "Fettuccine Alfredo" },
            { name: "Creamy Mashed Potatoes (add garlic)" },
            { name: "Cinnamon Caramelized Carrots" },
            { name: "Steamed Broccoli" },
            { name: "Baked Potato with Sour Cream and Green Onions" },
            { name: "Roasted Seasoned Red Potatoes" },
            { name: "Yellow Rice" },
            { name: "Steamed Mixed Vegetables" },
            { name: "Scalloped Potatoes" },
          ],
    
          salads: [
            {
              name: "Garden Salad",
              description:
                "Mixed greens, carrots and tomatoes with choice of dressing.",
            },
            {
              name: "Lemon Garlic Caesar Salad",
              description:
                "Romaine lettuce, parmesan, croutons and lemon garlic Caesar dressing.",
            },
            {
              name: "Spinach Salad",
              description:
                "Spinach, mushrooms, onions, cranberries, tomatoes and bacon bits with raspberry vinaigrette.",
            },
          ],
        },

    /* ───────────────── MEXICAN ───────────────── */

    mexican: {
      label: "Mexican Fiesta",
      appetizers: SHARED_APPETIZERS,

      entrees: [
        {
          name: "Mole Poblano",
          description: "Classic mole poblano over chicken.",
        },
        {
          name: "Pollo Poblano",
          description:
            "Chicken breast with chipotle poblano cream sauce.",
        },
        {
          name: "Pollo Philadelphia",
          description:
            "Grilled chicken with creamy chipotle Philadelphia sauce.",
        },
        {
          name: "Fajitas de Pollo o Carne",
          description: "Grilled chicken or steak fajitas.",
        },
        {
          name: "Barbacoa de Res",
          description: "Slow-cooked beef with chiles and spices.",
        },
        {
          name: "Chilorio",
          description: "Shredded pork in mild chile sauce.",
        },
        // 🔼 Mexican upgrade entrees ($8/guest in the PDF)
        {
          name: "Chile en Nogada",
          description:
            "Stuffed poblano with beef and fruit in walnut cream sauce.",
          upgradeFeePerGuest: 8,
          upgradeCode: "premiumMex",
        },
        {
          name: "Pescado a la Veracruzana",
          description:
            "Baked mahi mahi in tomato sauce with olives and capers.",
          upgradeFeePerGuest: 8,
          upgradeCode: "fish",
        },
      ],

      sides: [
        {
          name: "Cilantro Rice",
          description: "Fluffy rice with cilantro and lime.",
        },
        {
          name: "Mexican Rice",
          description: "Tomato-based rice with spices.",
        },
        {
          name: "Refried Beans",
          description: "Traditional refried pinto beans.",
        },
        {
          name: "Whole Beans",
          description: "Seasoned whole beans.",
        },
        {
          name: "Papas con Chorizo",
          description: "Potatoes sautéed with chorizo.",
        },
        {
          name: "Nopalitos",
          description: "Grilled Mexican cactus.",
        },
      ],

      salads: [
        {
          name: "House Mexican Salad",
          description:
            "Romaine, tomato, corn, tortilla strips, and choice of dressing.",
        },
        {
          name: "Chipotle Ranch Salad",
          description:
            "Greens with beans, pico de gallo, and chipotle ranch.",
        },
        {
          name: "Lemon Citrus Salad",
          description:
            "Spinach, cranberries, onions, tomatoes, and citrus vinaigrette.",
        },
      ],
    },

    /* ───────────────── AMERICAN ───────────────── */

    american: {
      label: "Classic American",
      appetizers: SHARED_APPETIZERS,

      entrees: [
        {
          name: "BBQ Glazed Pork Chops",
          description: "Pork chops finished with house BBQ glaze.",
        },
        {
          name: "BBQ Pulled Pork",
          description: "Slow-cooked pulled pork in BBQ sauce.",
        },
        {
          name: "BBQ Ribs",
          description: "Tender ribs with barbecue sauce.",
        },
        {
          name: "Herb Crusted Beef Brisket",
          description: "Slow-roasted brisket with herb crust.",
        },
        {
          name: "Smoked BBQ Beef Brisket",
          description: "Smoked brisket with BBQ finish.",
        },
        {
          name: "Jack Daniels Smoked BBQ Chicken",
          description: "Smoked chicken with whiskey BBQ glaze.",
        },
        {
          name: "BBQ Lemon Glazed Chicken",
          description: "Chicken with bright lemon BBQ sauce.",
        },
        {
          name: "Herb Crusted Roast Beef",
          description: "Roast beef with herb rub.",
        },
      ],

      sides: [
        {
          name: "Chipotle Mac & Cheese",
          description: "Creamy mac with a chipotle kick.",
        },
        {
          name: "Mashed Yams with Pineapple",
          description: "Sweet yams with pineapple.",
        },
        {
          name: "Sweet Corn",
          description: "Seasoned sweet corn.",
        },
        {
          name: "Creamy Mashed Potatoes",
          description: "Classic mashed potatoes.",
        },
        {
          name: "Cinnamon Caramelized Carrots",
          description: "Roasted carrots with cinnamon and brown sugar.",
        },
        {
          name: "Smoked Beans",
          description: "Slow-smoked beans.",
        },
        {
          name: "Baked Potato",
          description: "Classic baked potato with toppings.",
        },
        {
          name: "Roasted Seasoned Red Potatoes",
          description: "Roasted red potatoes with herbs.",
        },
        {
          name: "Green Beans",
          description: "Seasoned green beans.",
        },
        {
          name: "Cole Slaw",
          description: "Creamy slaw with cabbage.",
        },
      ],

      salads: [
        {
          name: "Garden Salad",
          description:
            "Mixed greens, carrots, tomatoes, and choice of dressing.",
        },
        {
          name: "Southwest Salad",
          description:
            "Greens with beans, corn, tomatoes, cheese, chips, and chipotle ranch.",
        },
        {
          name: "Potato Salad",
          description: "Classic potato salad.",
        },
        {
          name: "Broccoli Salad",
          description: "Broccoli salad with creamy dressing.",
        },
      ],
    },

    /* ───────────────── TACO BAR ───────────────── */

    taco: {
      label: "Taco Bar",
      appetizers: SHARED_APPETIZERS,

      entrees: [
        {
          name: "Chicken",
          description: "Seasoned grilled chicken taco meat.",
        },
        {
          name: "Asada",
          description: "Grilled steak for tacos.",
        },
        {
          name: "Adobada",
          description: "Marinated pork adobada.",
        },
        {
          name: "Brisket",
          description: "Slow-cooked brisket for tacos.",
        },
        {
          name: "Carnitas",
          description: "Crispy shredded pork.",
        },
        {
          name: "Tinga de Pollo",
          description: "Shredded chipotle chicken.",
        },
        {
          name: "Cochinita Pibil",
          description: "Achiote-marinated pork.",
        },
        {
          name: "Barbacoa",
          description: "Slow-braised beef barbacoa.",
        },
        {
          name: "Rajas con Queso (Vegetarian)",
          description:
            "Roasted peppers with cheese – vegetarian meat substitute.",
        },
      ],

      sides: [
        {
          name: "Rice",
          description: "Mexican-style rice.",
        },
        {
          name: "Refried Pinto Beans with Chorizo",
          description: "Refried beans with chorizo (can be made without).",
        },
      ],

      salads: [
        {
          name: "House Mexican Salad",
          description:
            "Romaine, tomatoes, corn, tortilla chips, and chipotle ranch.",
        },
      ],
    },
  },

  extras: {
    tacoFullCondiments: {
      label: "Full Taco Condiments Bar",
      description:
        "Upgrade from basic toppings to a 13-item condiments bar (guacamole, pico, cheeses, pickled veg, and more).",
      upgradeFeePerGuest: 12,
      appliesTo: "taco",
      upgradeCode: "tacoCondiments",
    },
  },
};

export default santisMenuConfig;