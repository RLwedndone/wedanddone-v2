// utils/venueCollections.ts

// This file maps each venue slug to its collection tag: Novel, Romance, or Fable

export const venueToCollection: Record<string, string> = {
  // Novel Collection (Blue)
  batesmansion: "Novel",
  desertfoothills: "Novel",
  encanterra: "Novel",
  farmhouse: "Novel",
  fabric: "Novel",
  lakehouse: "Novel",
  schnepfbarn: "Novel",   
  sunkist: "Novel",
  themeadow: "Novel",
  verrado: "Novel",       
  vic: "Novel",           
  windmillbarn: "Novel",  

  // Romance Collection (Pink)
  haciendadelsol: "Romance",
  valleyho: "Romance",
  tubac: "Romance",       // align with venueDetails

  // Fable Collection (Purple)
  rubihouse: "Fable",
  soho63: "Fable",
  ocotillo: "Fable",
};

// Add to venueCollections.ts
export const collectionColors: Record<string, string> = {
  Novel: "#4b9cd3",
  Fable: "#9d68e1",
  Romance: "#e66590",
};