// src/utils/venueMenuMap.ts
export type CateringType = "set" | "custom";

export interface VenueMenuMeta {
  cateringType: CateringType;
  setMenuId?: string; // only for "set" venues
}

export const VENUE_MENU_MAP: Record<string, VenueMenuMeta> = {
  // --- In-house / set-menu venues ---
  batesmansion:   { cateringType: "set", setMenuId: "batesmansion.standard" },
  encanterra:     { cateringType: "set", setMenuId: "encanterra.standard" },
  farmhouse:      { cateringType: "set", setMenuId: "farmhouse.standard" },
  themeadow:      { cateringType: "set", setMenuId: "themeadow.standard" },
  schnepfbarn:    { cateringType: "set", setMenuId: "schnepfbarn.standard" },
  haciendadelsol: { cateringType: "set", setMenuId: "haciendadelsol.standard" },
  valleyho:       { cateringType: "set", setMenuId: "valleyho.standard" },
  ocotillo:       { cateringType: "set", setMenuId: "ocotillo.standard" },
  rubihouse:      { cateringType: "set", setMenuId: "rubihouse.standard" },
  vic:            { cateringType: "set", setMenuId: "vic.standard" },
  verrado:        { cateringType: "set", setMenuId: "verrado.standard" },
  tubac:          { cateringType: "set", setMenuId: "tubac.standard" },

  // --- Santi’s / custom-catering venues ---
  desertfoothills: { cateringType: "custom" },
  fabric:          { cateringType: "custom" },
  lakehouse:       { cateringType: "custom" },
  windmillbarn:    { cateringType: "custom" },
  soho63:          { cateringType: "custom" },
  sunkist:         { cateringType: "custom" },

  // --- Default / fallback ---
  santi_default:   { cateringType: "custom" }, // “no venue selected” → always Santi’s
};