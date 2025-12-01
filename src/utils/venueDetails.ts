export interface VenueDetails {
  title: string;
  castleConsiderations: string[];
  videoLink: string;
  collection: 'novel' | 'fable' | 'romance';
}

export const venueDetails: Record<string, VenueDetails> = {
  verrado: {
    title: "The Verrado Golf Club",
    castleConsiderations: [
      "🍽️ ❌ Catering <strong>is not included</strong> in the venue price",
      "💵 Food & bev minimum: <strong>Friday & Saturday $7k, $0K (waived) Sunday through Thursday.",
      "Live music may be playing in the bar or patio during your event",
      "More than one event may take place at a time",
      "📍 Located in Buckeye — about <strong>30 miles</strong> / <strong>30 minutes</strong> from Phoenix Sky Harbor Airport"
  
    ],
    videoLink: "https://player.vimeo.com/video/829968623",
    collection: "novel"
  },

  vic: {
    title: "The Vic",
    castleConsiderations: [
      "🍽️ ❌ Catering <strong>is not included</strong> in the venue price",
      "💵 Food & bev minimum: <strong>Friday & Saturday $7k, $0K (waived) Sunday through Thursday.",
      "Live music may be playing in the bar or patio during your event",
      "More than one event may take place at a time",
      "📍 Located in Buckeye — about <strong>30 miles</strong> / <strong>30 minutes</strong> from Phoenix Sky Harbor Airport"
  
    ],
    videoLink: "https://player.vimeo.com/video/849617225",
    collection: "novel"
  },

  tubac: {
    title: "Tubac Golf Resort and Spa",
    castleConsiderations: [
      "🍽️ ❌ Catering <strong>is not included</strong> in the venue price",
      "💵 Food & bev minimum: <strong>$10K-$17K</strong> (before service charge and tax)",
      "📍 Located in Tubac — about <strong>150 miles</strong> / <strong>2 hours 10 minutes</strong> from Phoenix Sky Harbor Airport"
    ],
    videoLink: "https://player.vimeo.com/video/829959547",
    collection: "romance"
  },

  windmillbarn: {
    title: "The Big Red Barn at Windmill Winery",
    castleConsiderations: [
      "The Windmill Winery is located in Florence, Arizona and is about an hour drive from Phoenix Sky Harbor Airport"
    ],
    videoLink: "https://player.vimeo.com/video/849188155",
    collection: "novel"
  },

  lakehouse: {
    title: "The Windmill Winery Lake House",
    castleConsiderations: [
      "The Windmill Winery is located in Florence, Arizona and is about an hour drive from Phoenix Sky Harbor Airport"
    ],
    videoLink: "https://player.vimeo.com/video/848914703",
    collection: "novel"
  },

  sunkist: {
    title: "The Sunkist Warehouse",
    castleConsiderations: [
      "🍽️ ❌ Catering <strong>is not included</strong> in the venue price",
      "Historic warehouse space with vintage charm",
      "Air conditioning is present but not airtight—space may be warmer than expected",
      "No discounts or refunds for temperature-related concerns",
      "📍 Located in Mesa — industrial distric"
    ],
    videoLink: "https://player.vimeo.com/video/829585100",
    collection: "novel"
  },

  soho63: {
    title: "Soho63",
    castleConsiderations: [
      "🍽️ ❌ Catering <strong>is not included</strong> in the venue price",
      "📍 Located in Tempe — business distric"
    ],
    videoLink: "https://player.vimeo.com/video/829956929",
    collection: "fable"
  },

  farmhouse: {
    title: "Schnepf's Farmhouse",
    castleConsiderations: [
      "🍽️ ❌ Catering <strong>is not included</strong> in the venue price",
      "💵 Food & bev minimum: <strong>$1,000</strong>",
      "📍 Located in Queen Creek — about <strong>37 miles</strong> / <strong>40 minutes</strong> from Phoenix Sky Harbor Airport"
    ],
    videoLink: "https://player.vimeo.com/video/829958523",
    collection: "novel"
  },

  schnepfbarn: {
    title: "Schnepf's Big Red Barn",
    castleConsiderations: [
      "🍽️ ❌ Catering <strong>is not included</strong> in the venue price",
      "💵 Food & bev minimum: <strong>$1,000</strong>",
      "📍 Located in Queen Creek — about <strong>37 miles</strong> / <strong>40 minutes</strong> from Phoenix Sky Harbor Airport"
    ],
    videoLink: "https://player.vimeo.com/video/829959049",
    collection: "novel"
  },

  themeadow: {
    title: "Schnepf's Meadow",
    castleConsiderations: [
      "🍽️ ❌ Catering <strong>is not included</strong> in the venue price",
      "💵 Food & bev minimum: <strong>$1,000</strong>",
      "📍 Located in Queen Creek — about <strong>37 miles</strong> / <strong>40 minutes</strong> from Phoenix Sky Harbor Airport"
    ],
    videoLink: "https://player.vimeo.com/video/829575414",
    collection: "novel"
  },

  ocotillo: {
    title: "The Ocotillo",
    castleConsiderations: [
      "🍽️ ❌ Catering <strong>is not included</strong> in the venue price",
      "💵 Food & bev minimum: <strong>$8K</strong> (before service charge and tax)",
      "All-outdoor venue with optional tenting or indoor move available at added cost",
      "Amplified sound must end by 9PM due to City of Phoenix noise ordinance",
      "Event may be rescheduled with 60 days' notice"
    ],
    videoLink: "https://player.vimeo.com/video/829585981",
    collection: "fable"
  },

  valleyho: {
    title: "Hotel Valley Ho",
    castleConsiderations: [
      "🍽️ ❌ Catering <strong>is not included</strong> in the venue price",
      "💵 Food & bev minimum: <strong>$15K</strong> (before service charge and tax)",
      "Hotel accommodations for the couple are included in the cost"
    ],
    videoLink: "https://player.vimeo.com/video/829580336",
    collection: "romance"
  },

  haciendadelsol: {
    title: "Hacienda Del Sol",
    castleConsiderations: [
      "🍽️ ❌ Catering <strong>is not included</strong> in the venue price",
      "💵 Food & bev minimum: <strong>$10K (Mon–Thu), $22.5K (Fri/Sun), $25K (Sat)</strong> (before service charge and tax)",
      "📍 Located in Tucson — about <strong>110 miles</strong> / <strong>1 hour 45 minutes</strong> from Phoenix Sky Harbor Airport"
    ],
    videoLink: "https://player.vimeo.com/video/829579059",
    collection: "fable"
  },

  fabric: {
    title: "Fabric",
    castleConsiderations: [
      "🍽️ ❌ Catering <strong>is not included</strong> in the venue price",
      "📍 Located in downtown Tempe — large, industrial blank space often used for fashion shows"
    ],
    videoLink: "https://player.vimeo.com/video/829583210",
    collection: "novel"
  },

  encanterra: {
    title: "Encanterra Country Club",
    castleConsiderations: [
      "🍽️ ❌ Catering <strong>is not included</strong> in the venue price",
      "💵 Food & bev minimum: <strong>$8,000</strong> (before service charge and tax)",
      "📍 Located in Queen Creak — about <strong>40 miles</strong> / <strong>45 minutes</strong> from Phoenix Sky Harbor Airport"
    ],
    videoLink: "https://player.vimeo.com/video/829574455",
    collection: "novel"
  },

  desertfoothills: {
    title: "Desert Foothills",
    castleConsiderations: [
      "🍽️ ❌ Catering <strong>is not included</strong> in the venue price",
      "☀️🌧️ Rain or shine venue — indoor space and patio are sufficient for full event",
      "🌵 Located in the wide-open desert — private and self-contained, but the drive feels rustic and remote",
      "⛺ Tent rental available at client's cost",
      "🦉 Wildlife and ranch activity may be visible or audible during events"
    ],
    videoLink: "https://player.vimeo.com/video/829584056",
    collection: "novel"
  },

  batesmansion: {
    title: "Bates Mansion",
    castleConsiderations: [
      "📍 Located in Tucson — about 110 miles and nearly 2 hours from Phoenix Sky Harbor Airport",
      "🍽️ Catering <strong>is included</strong> in the venue price",
      "🥂 Alcohol is BYO — you bring it, and Bates’ licensed bartenders must serve it",
      "🏛️ Historic building quirks — rented 'as-is', so expect charm with some character",
      "📊 Bates uses tiered guest pricing — if your guest count falls between tiers, your booking aligns to the next tier up."
    ],
    videoLink: "https://player.vimeo.com/video/829586701",
    collection: "novel"
  },

  rubihouse: {
    title: "The Rubi House",
      castleConsiderations: [
        "📍 Located in Tucson — about 110 miles and nearly 2 hours from Phoenix Sky Harbor Airport",
        "🍽️ Catering <strong>is included</strong> in the venue price",
        "🏙️ City setting — Expect classic Tucson streetscapes around this historic gem, including nearby sidewalks, utility lines, and local flavor.",
        "🏛️ Historic building quirks — rented 'as-is', so expect charm with some character",
      ],
    videoLink: "https://player.vimeo.com/video/829596336",
    collection: "fable"
  }
};