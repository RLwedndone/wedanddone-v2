// Central registry of EmailJS template IDs
export const EMAIL_TEMPLATES = {
    // User-triggered emails
    WELCOME: "template_tmxu1sn",
    VENUE_BOOKED_USER: "template_vpa9uw3",
    FLORAL_BOOKED_USER: "template_ayo7j4q",
    FLORAL_ADDON_USER: "template_i9ntzwt",
    PHOTO_BOOKED_USER: "template_z6xanln",
    PHOTO_ADDON_USER: "template_9fb76zd",
    PLANNER_BOOKED_USER: "template_ima4r4n",
    JAM_BOOKED_USER: "template_94zzcdl",
    YUM_CATERING_BOOKED_USER: "template_psi8cbh",
    YUM_DESSERT_BOOKED_USER: "template_30f0vsi",
  
    // Admin alerts
    VENUE_BOOKED_ADMIN: "template_xavptub",
    FLORAL_BOOKED_ADMIN: "template_q4nghcq",
    FLORAL_ADDON_ADMIN: "template_srlk4gh",
    PHOTO_BOOKED_ADMIN: "template_mgm37ce",
    PLANNER_BOOKED_ADMIN: "template_4fdximn",
    JAM_BOOKED_ADMIN: "template_jq2xexq",
    YUM_CATERING_BOOKED_ADMIN: "template_zjakayk",
    YUM_DESSERT_BOOKED_ADMIN: "template_auk8n3q",
    MANUAL_VENUE_REQUEST: "template_vawsamm",
  } as const;
  
  export type TemplateKey = keyof typeof EMAIL_TEMPLATES;
  
  // Products we support for the “notifyBooking” helper.
  export type BookingProductKey =
    | "venue"
    | "floral"
    | "floral_addon"
    | "photo"
    | "photo_addon"
    | "planner"
    | "jam"
    | "yum_catering"
    | "yum_dessert";
  
  // Map a product to the user/admin templates
  export const TEMPLATE_MAP: Record<
    BookingProductKey,
    { user: TemplateKey; admin: TemplateKey }
  > = {
    venue:          { user: "VENUE_BOOKED_USER",          admin: "VENUE_BOOKED_ADMIN" },
    floral:         { user: "FLORAL_BOOKED_USER",         admin: "FLORAL_BOOKED_ADMIN" },
    floral_addon:   { user: "FLORAL_ADDON_USER",          admin: "FLORAL_ADDON_ADMIN" },
    photo:          { user: "PHOTO_BOOKED_USER",          admin: "PHOTO_BOOKED_ADMIN" },
    photo_addon:    { user: "PHOTO_ADDON_USER",           admin: "PHOTO_BOOKED_ADMIN" }, // reuse admin
    planner:        { user: "PLANNER_BOOKED_USER",        admin: "PLANNER_BOOKED_ADMIN" },
    jam:            { user: "JAM_BOOKED_USER",            admin: "JAM_BOOKED_ADMIN" },
    yum_catering:   { user: "YUM_CATERING_BOOKED_USER",   admin: "YUM_CATERING_BOOKED_ADMIN" },
    yum_dessert:    { user: "YUM_DESSERT_BOOKED_USER",    admin: "YUM_DESSERT_BOOKED_ADMIN" },
  };