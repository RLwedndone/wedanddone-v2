// src/utils/menuConfig.ts
export type MenuType = "santis" | "custom" | "none";

export interface MenuConfig {
  menuType: MenuType;
  // For custom venues you can optionally point to a specific menu id
  setMenuId?: string | null;
}

export const venueMenuMap: Record<string, MenuConfig> = {
  // ✅ custom / in-house venues (drive custom overlays)
  encanterra: { menuType: "custom", setMenuId: "encanterra.standard" },
  farmhouse:  { menuType: "custom" },
  haciendadelsol: { menuType: "custom" },
  valleyho:   { menuType: "custom" },
  ocotillo:   { menuType: "custom" },
  rubihouse:  { menuType: "custom" },
  vic:        { menuType: "custom" },
  verrado:    { menuType: "custom" },
  tubac:      { menuType: "custom" },
  themeadow:  { menuType: "custom" },
  schnepfbarn:{ menuType: "custom" },

  // ✅ Santi’s-allowed venues → use NoVenueOverlay flow
  desertfoothills: { menuType: "santis" },
  fabric:          { menuType: "santis" },
  lakehouse:       { menuType: "santis" },
  windmillbarn:    { menuType: "santis" },
  soho63:          { menuType: "santis" },
  sunkist:         { menuType: "santis" },

  // default / unknown
  batesmansion: { menuType: "custom" },
};