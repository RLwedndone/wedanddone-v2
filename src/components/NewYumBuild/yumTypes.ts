// yumTypes.ts

export type YumStep =
  | "intro" // 🍽️ Initial split: catering vs. dessert
  // 🥘 Catering Flow
  | "cateringCuisine"
  | "cateringTier"
  | "cateringMenu"
  | "cateringCart"
  | "cateringContract"
  | "cateringCheckout"
  | "thankyouCateringOnly"
  // 🍰 Dessert Flow
  | "dessertStyle"
  | "dessertMenu"
  | "dessertCart"
  | "dessertContract"
  | "dessertCheckout"
  | "thankyouDessertOnly"
  // 🌟 Shared / Combo
  | "calendar"
  | "confirm"
  | "thankyouBoth"
  | "returnNoCatering"
  | "returnNoDessert"
  | "returnBothBooked"
    | "editdate"
  | "updateGuests";

  

  export interface YumBookings {
    catering?: boolean;
    dessert?: boolean;
  }