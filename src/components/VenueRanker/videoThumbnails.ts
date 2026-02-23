// src/components/VenueRanker/videoThumbnails.ts
export const VIDEO_THUMBNAILS = {
    Bates: `${import.meta.env.BASE_URL}assets/images/VideoThumbnails/BatesThumb.jpg`,
    DesertFoot: `${import.meta.env.BASE_URL}assets/images/VideoThumbnails/DesertFootThumb.jpg`,
    Encanterra: `${import.meta.env.BASE_URL}assets/images/VideoThumbnails/EncantThumb.jpg`,
    Fabric: `${import.meta.env.BASE_URL}assets/images/VideoThumbnails/FabricThumb.jpg`,
    FarmHouse: `${import.meta.env.BASE_URL}assets/images/VideoThumbnails/FarmHouseThumb.jpg`,
    Hacienda: `${import.meta.env.BASE_URL}assets/images/VideoThumbnails/HaciendaThumb.jpg`,
    ValleyHo: `${import.meta.env.BASE_URL}assets/images/VideoThumbnails/ValleyHoThumb.jpg`,
    LakeHouse: `${import.meta.env.BASE_URL}assets/images/VideoThumbnails/LakeHouseThumb.jpg`,
    Ocotillo: `${import.meta.env.BASE_URL}assets/images/VideoThumbnails/OcotilloThumb.jpg`,
    Rubi: `${import.meta.env.BASE_URL}assets/images/VideoThumbnails/RubiThumb.jpg`,
    SchnepfBRB: `${import.meta.env.BASE_URL}assets/images/VideoThumbnails/SchnepfBRBThumb.jpg`,
    Soho: `${import.meta.env.BASE_URL}assets/images/VideoThumbnails/SohoThumb.jpg`,
    Sunkist: `${import.meta.env.BASE_URL}assets/images/VideoThumbnails/SunkistThumb.jpg`,
    Meadow: `${import.meta.env.BASE_URL}assets/images/VideoThumbnails/MeadowThumb.jpg`,
    Vic: `${import.meta.env.BASE_URL}assets/images/VideoThumbnails/VicThumb.jpg`,
    Tubac: `${import.meta.env.BASE_URL}assets/images/VideoThumbnails/TubacThumb.jpg`,
    Verrado: `${import.meta.env.BASE_URL}assets/images/VideoThumbnails/verradoThumb.jpg`,
    WindmillBarn: `${import.meta.env.BASE_URL}assets/images/VideoThumbnails/BRBWindThumb.jpg`,
  } as const;

  /**
 * ✅ Slug-based lookup for invite flow
 * This keeps existing VenueRanker screens untouched
 */
export const VIDEO_THUMBNAILS_BY_SLUG: Record<string, string> = {
  batesmansion: VIDEO_THUMBNAILS.Bates,
  desertfoothills: VIDEO_THUMBNAILS.DesertFoot,
  encanterra: VIDEO_THUMBNAILS.Encanterra,
  fabric: VIDEO_THUMBNAILS.Fabric,
  farmhouse: VIDEO_THUMBNAILS.FarmHouse,
  haciendadelsol: VIDEO_THUMBNAILS.Hacienda,
  valleyho: VIDEO_THUMBNAILS.ValleyHo,
  lakehouse: VIDEO_THUMBNAILS.LakeHouse,
  ocotillo: VIDEO_THUMBNAILS.Ocotillo,
  rubihouse: VIDEO_THUMBNAILS.Rubi,
  schnepfbarn: VIDEO_THUMBNAILS.SchnepfBRB,
  soho63: VIDEO_THUMBNAILS.Soho,
  sunkist: VIDEO_THUMBNAILS.Sunkist,
  themeadow: VIDEO_THUMBNAILS.Meadow,
  vic: VIDEO_THUMBNAILS.Vic,
  tubac: VIDEO_THUMBNAILS.Tubac,
  verrado: VIDEO_THUMBNAILS.Verrado,
  windmillbarn: VIDEO_THUMBNAILS.WindmillBarn,
};