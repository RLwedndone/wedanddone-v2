// src/data/blogPosts.ts

export interface BlogPostSection {
  id: string;
  heading: string;
  image?: string;
  imageAlt?: string;
  vimeoId?: string;
  body: string;
}

export interface BlogPost {
  slug: string;
  title: string;
  date: string;
  excerpt: string;
  thumbnail: string;
  heroImage: string;
  sections: BlogPostSection[];
}

export const blogPosts: BlogPost[] = [
  // ─────────────────────────────────────────────
  // BLOG #1 — Just Engaged
  // ─────────────────────────────────────────────
  {
    slug: "bask-in-engaged-bliss",
    title: "Bask in Your Engaged Bliss (Without the Planning Panic)",
    date: "2025-11-01",
    excerpt:
      "Just got engaged? Here are the five things to do first—without spiraling into planning overwhelm.",
    thumbnail: `${import.meta.env.BASE_URL}assets/images/blog/bask_engaged_thumb.webp`,
    heroImage: `${import.meta.env.BASE_URL}assets/images/blog/bask_engaged_hero.webp`,
    sections: [
      {
        id: "intro",
        heading: "You’re engaged—now what?",
        image: `${import.meta.env.BASE_URL}assets/images/blog/bask_engaged_intro.webp`,
        imageAlt: "Newly engaged couple celebrating with sparkling lights",
        body:
          "Congratulations, lovebirds! You said YES, the ring is stunning, and you’re officially in that dreamy, floating “we’re engaged!” bubble.\n\nBefore you get swallowed by Pinterest boards, group texts, and a thousand competing opinions… let’s ground you with the actual first steps that matter."
      },
      {
        id: "budget-wand",
        heading: "1. Set a budget (and let the Budget Wand do the heavy lifting)",
        image: `${import.meta.env.BASE_URL}assets/images/blog/bask_engaged_budget.webp`,
        imageAlt: "Wed&Done Budget Wand dashboard glowing",
        body:
          "Weddings get pricey fast, and guessing your way through it is… not the vibe.\n\nInside Wed&Done, your Budget Wand tracks everything you book inside the app, auto-updates your spend, and even lets you log outside purchases so nothing slips through the cracks."
      },
      {
        id: "guest-list",
        heading: "2. Build your guest list (this one drives everything)",
        image: `${import.meta.env.BASE_URL}assets/images/blog/bask_engaged_guests.webp`,
        imageAlt: "Couple reviewing a guest list together",
        body:
          "Guest count affects venues, catering, rentals, and timelines.\n\nWed&Done builds your guest count directly into every booking flow so pricing stays accurate—even when numbers change later."
      },
      {
        id: "wedding-style",
        heading: "3. Discover your wedding style (your vibe leads the way)",
        image: `${import.meta.env.BASE_URL}assets/images/blog/bask_engaged_style.webp`,
        imageAlt: "Wedding style inspiration collage",
        body:
          "Your style naturally narrows venues, florals, menus, and photography.\n\nWed&Done helps you explore real options that match your aesthetic—without overwhelm."
      },
      {
        id: "venue-date",
        heading: "4. Choose your venue and set your date",
        vimeoId: "829968623",
        image: `${import.meta.env.BASE_URL}assets/images/blog/bask_engaged_venue.webp`,
        imageAlt: "Arizona wedding venues featured in Wed&Done",
        body:
          "Venue hunting doesn’t need to be a rabbit hole.\n\nWed&Done’s Venue Ranker lets you compare Arizona venues across Tucson, Tubac, and the Valley with real pricing and walkthroughs—before emotions take over."
      },
      {
        id: "vendor-team",
        heading: "5. Book your vendor dream team",
        image: `${import.meta.env.BASE_URL}assets/images/blog/bask_engaged_vendors.webp`,
        imageAlt: "Wedding vendor team working together",
        body:
          "From photography to catering to music, Wed&Done guides you step by step.\n\nEverything stays organized, priced clearly, and automatically saved."
      },
      {
        id: "wrap-up",
        heading: "Enjoy this moment—you’re engaged",
        image: `${import.meta.env.BASE_URL}assets/images/blog/bask_engaged_wrap.webp`,
        imageAlt: "Engaged couple walking away together",
        body:
          "Wed&Done is here to help you keep the magic and the clarity as you move from engaged to booked—with confidence."
      }
    ]
  },

// ─────────────────────────────────────────────
// BLOG #2 — Venue Insider Knowledge
// ─────────────────────────────────────────────
{
  slug: "venue-mistakes-no-one-tells-you",
  title: "The venue mistakes no one tells you about (until it’s too late)",
  date: "2026-01-03",
  excerpt:
    "After 15+ years inside weddings, here’s what couples unknowingly get wrong when choosing a venue—and how to avoid expensive, stressful surprises.",
  thumbnail: `${import.meta.env.BASE_URL}assets/images/blog/blog2_thumb.webp`,
  heroImage: `${import.meta.env.BASE_URL}assets/images/blog/blog2_hero.webp`,
  sections: [
    {
      id: "intro",
      heading: "Why venue decisions quietly shape your entire wedding",
      image: `${import.meta.env.BASE_URL}assets/images/blog/blog2_section1_venue.webp`,
      imageAlt: "Elegant real wedding venue at golden hour with guests arriving",
      body:
        "Most couples think choosing a venue is just about falling in love with a space. Pretty views, good vibes, maybe a dramatic entrance moment.\n\nBut here’s the insider truth: your venue choice silently controls your budget, your vendor options, your timeline, and how stressful (or smooth) the rest of planning becomes.\n\nAfter years inside real weddings—not styled shoots—we’ve watched the same venue mistakes repeat over and over. Not because couples are careless, but because no one explains the downstream effects until it’s too late.\n\nLet’s fix that."
    },
    {
      id: "mistake-one",
      heading: "Mistake #1: choosing a venue before understanding the real cost",
      image: `${import.meta.env.BASE_URL}assets/images/blog/blog2_section2_comparison.webp`,
      imageAlt: "Wedding reception setup showing rentals, tables, and staffing details",
      body:
        "Many venues advertise a base price that feels reasonable—until you realize what’s not included.\n\nService fees, required rentals, catering minimums, staffing, cleanup, alcohol policies, and timing restrictions often live in the fine print. Couples commit emotionally before they’ve seen the full financial picture.\n\nThe result? Budget stress, uncomfortable compromises, or cutting vendors you actually cared about.\n\nA venue should work *with* your budget, not quietly consume it."
    },
    {
      id: "mistake-two",
      heading: "Mistake #2: ignoring how guest count changes everything",
      image: `${import.meta.env.BASE_URL}assets/images/blog/blog2_section3_insider.webp`,
      imageAlt: "Wide shot of wedding reception filled with guests at long tables",
      body:
        "Guest count isn’t just a number—it’s a pricing multiplier.\n\nCapacity limits, per-person catering costs, bar packages, rentals, staffing, parking, and even restrooms scale with headcount. A venue that works beautifully for 120 guests can become restrictive or wildly expensive at 160.\n\nCouples often book a venue early with a ‘rough estimate,’ only to discover later that their final guest list pushes them into overage fees or forced upgrades.\n\nYour venue should flex with your guest count, not punish you for refining it."
    },
    {
      id: "mistake-three",
      heading: "Mistake #3: not understanding vendor restrictions",
      image: `${import.meta.env.BASE_URL}assets/images/blog/blog2_section4_ranker.webp`,
      imageAlt: "Wedding vendors setting up florals and lighting at a venue",
      body:
        "Some venues require you to use in-house catering. Others restrict outside vendors, charge coordination fees, or limit setup and breakdown windows.\n\nNone of these are inherently bad—but they dramatically affect who you can hire, how long your vendors can work, and what kind of experience your guests have.\n\nCouples often discover these rules *after* they’ve emotionally committed to vendors they love.\n\nVenue rules shape your vendor team more than most people realize."
    },
    {
      id: "mistake-four",
      heading: "Mistake #4: assuming all venues work the same way",
      image: `${import.meta.env.BASE_URL}assets/images/blog/blog2_section5_protection.webp`,
      imageAlt: "Comparison of different wedding venue styles: ballroom, estate, desert",
      body:
        "A ballroom, a historic estate, a desert venue, and a private club all operate under completely different logistics.\n\nSome include coordination support. Others expect you to manage every detail. Some allow flexible timelines. Others enforce strict end times.\n\nWhen couples assume venues are interchangeable, they’re often blindsided by stress they didn’t anticipate.\n\nThe venue experience should match your planning style—not fight it."
    },
    {
      id: "wrap-up",
      heading: "What experienced couples do differently",
      image: `${import.meta.env.BASE_URL}assets/images/blog/blog2_wrap.webp`,
      imageAlt: "Relaxed couple walking through a wedding venue at sunset",
      body:
        "Couples who feel calm and confident later in planning aren’t luckier—they’re better informed.\n\nThey understand the true cost early. They know how guest count affects decisions. They choose venues that support their vision instead of limiting it.\n\nThat’s why Wed&Done built the Venue Ranker—to let couples compare venues with real pricing, real logistics, and real clarity before emotions take over.\n\nChoosing a venue shouldn’t feel like a gamble. It should feel like the smartest move you made."
      },
    ],
  },

  // ─────────────────────────────────────────────
  // BLOG #3 — Planning shouldn’t feel like a race
  // ─────────────────────────────────────────────
  {
    slug: "wedding-planning-shouldnt-feel-like-a-race",
    title: "Wedding planning shouldn’t feel like a race",
    date: "2026-01-04",
    excerpt:
      "Planning feels urgent way too early—but it’s not because you’re behind. It’s because the process is slow.",
    thumbnail: `${import.meta.env.BASE_URL}assets/images/blog/planning_not_a_race_thumb.webp`,
    heroImage: `${import.meta.env.BASE_URL}assets/images/blog/planning_not_a_race_hero.webp`,
    sections: [
      {
        id: "intro",
        heading: "Somehow, the moment couples get engaged, the clock starts ticking",
        body:
          "Friends ask what you’ve booked. Instagram shows venues already filled. Vendors talk about dates disappearing. Suddenly it feels like if you don’t move now, you’re already behind.\n\nBut here’s the quiet truth most couples don’t hear early enough:\n\nWedding planning only feels rushed because the process is slow.\n\nNot because you’re doing it wrong.",
      },
      {
        id: "urgent-early",
        heading: "Why everything feels urgent so early",
        image: `${import.meta.env.BASE_URL}assets/images/blog/planning_not_a_race_urgency.webp`,
        imageAlt: "Quiet wedding venue setup before guests arrive",
        body:
          "Most traditional wedding planning happens one vendor at a time.\n\nYou inquire. You wait. You follow up. You tour. You compare notes weeks later when the details are already fuzzy. Each decision drags on, so pressure builds — even before you’ve made a single commitment.\n\nThe stress doesn’t come from the wedding itself.\n\nIt comes from waiting in the dark.\n\nWhen you don’t have clear pricing, availability, or logistics upfront, every decision feels risky. And when decisions feel risky, couples rush — not because they want to, but because uncertainty is exhausting.",
      },
      {
        id: "myth-time",
        heading: "The myth of “take your time”",
        image: `${import.meta.env.BASE_URL}assets/images/blog/planning_not_a_race_time.webp`,
        imageAlt: "Relaxed couple reviewing wedding plans together",
        body:
          "You’ll hear this advice a lot:\n\n“Don’t rush. Take your time planning.”\n\nIt’s well-intentioned. It’s also misleading.\n\nTaking your time only works when the information is easy to access. When planning requires weeks of emails and scattered PDFs, “slowing down” actually stretches stress over months.\n\nCouples don’t need more time.\n\nThey need clear answers sooner.",
      },
      {
        id: "reduce-stress",
        heading: "What actually reduces wedding stress",
        image: `${import.meta.env.BASE_URL}assets/images/blog/planning_not_a_race_clarity.webp`,
        imageAlt: "Wedding reception fully set with cohesive design and lighting",
        body:
          "After years inside real weddings, one pattern shows up consistently:\n\nCouples who feel calm aren’t moving faster — they’re just deciding with better information.\n\nThey can see pricing clearly.\nThey understand how guest count affects choices.\nThey know how venues, vendors, and logistics connect before committing.\n\nWhen the pieces fit together early, urgency disappears.",
      },
      {
        id: "why-wedndone",
        heading: "Why we built Wed&Done this way",
        vimeoId: "829968623",
        image: `${import.meta.env.BASE_URL}assets/images/blog/planning_not_a_race_vid_thumb.webp`,
        imageAlt: "Wed&Done Venue Ranker showing venues, pricing, and availability clearly",
        body:
          "Watching couples burn out before they even booked a venue made one thing obvious: the problem wasn’t decision-making — it was the process around it.\n\nWhen everything takes weeks, planning feels like a race. When everything is visible and connected, it doesn’t.\n\nThat’s why Wed&Done lets couples explore venues, pricing, availability, and logistics in one sitting. What used to take months of tours and follow-ups can happen in about an hour — without pressure, without sales calls, and without the constant fear of missing something.\n\nEfficiency isn’t about rushing.\n\nIt’s about removing friction.",
      },
      {
        id: "calm-again",
        heading: "When planning stops feeling urgent",
        image: `${import.meta.env.BASE_URL}assets/images/blog/planning_not_a_race_wrap.webp`,
        imageAlt: "Couple walking together at sunset feeling calm and confident",
        body:
          "Once the information is clear, couples naturally slow down.\n\nThey choose intentionally instead of reactively. They stop second-guessing. They enjoy the process instead of bracing for it.\n\nWedding planning shouldn’t feel like something you’re already behind on.\n\nWhen the system supports you, it becomes exactly what it should be: thoughtful, exciting, and calm.\n\nThat’s the experience we believe every couple deserves.",
      },
    ],
  },
    // ──────────────────────────────────────────────────
  // BLOG #4 — What Wedding Directories Don’t Tell You
  // ────────────────────────────────────────────────────
  {
    slug: "what-wedding-directories-dont-tell-you",
    title: "What wedding directories don’t tell you about choosing vendors",
    date: "2026-01-07",
    excerpt:
      "Those huge “top-rated” lists aren’t neutral. Here’s what wedding directories really are — and how to choose vendors with confidence.",
    thumbnail: `${import.meta.env.BASE_URL}assets/images/blog/directories_hidden_truth_thumb.webp`,
    heroImage: `${import.meta.env.BASE_URL}assets/images/blog/directories_hidden_truth_hero.webp`,
    sections: [
      {
        id: "intro",
        heading: "Wedding planning usually starts the same way",
        body:
          "Wedding planning usually starts the same way.\n\nYou open a directory.\nYou type in your city.\nYou’re shown hundreds of venues and vendors — all with glowing reviews, all labeled “top-rated,” all seemingly perfect.\n\nIt feels like research. It feels responsible.\nAnd yet… it often leaves couples more overwhelmed than when they started.\n\nHere’s the part most couples don’t realize early enough:\n\nYou’re not browsing a neutral list. You’re shopping inside an advertising platform.\n\nThat doesn’t make it evil.\nBut it does change what you’re actually looking at.",
      },
      {
        id: "default",
        heading: "How “vendor hunting” became the default",
        image: `${import.meta.env.BASE_URL}assets/images/blog/vendor_hunting.webp`,
        imageAlt:
          "Decision fatigue moment: too many vendor tabs, notes, and saved links",
        body:
          "The wedding industry taught couples to hunt.\n\nSearch. Filter. Compare. Save favorites. Read reviews. Repeat.\n\nOn paper, it makes sense. Big decisions should involve research, right?\n\nBut most wedding directories weren’t designed to help couples decide — they were designed to display inventory. Lots of it.\n\nAnd when every option looks amazing, couples don’t feel confident.\nThey feel stuck.\n\nMore choices don’t create clarity.\nThey create hesitation.",
      },
      {
        id: "what-they-are",
        heading: "What wedding directories actually are",
        image: `${import.meta.env.BASE_URL}assets/images/blog/directories_paid_visibility.webp`,
        imageAlt:
          "Visual metaphor for paid placement and “featured” visibility in online directories",
        body:
          "Most large wedding platforms operate on paid visibility.\n\nVendors and venues pay to be listed.\nThey pay more to appear higher.\nThey pay more again to stay visible.\n\nThis doesn’t mean the vendors are bad. Many are excellent professionals.\n\nBut it does mean:\n• Placement is influenced by advertising, not consistency\n• “Five stars” often reflects volume, not reliability\n• Great marketing can look identical to great execution\n\nFrom the outside, everything blends together.\n\nAnd couples are left trying to spot real differences where none are clearly explained.",
      },
      {
        id: "stress",
        heading: "Why this creates stress before planning even begins",
        image: `${import.meta.env.BASE_URL}assets/images/blog/directories_decision_fatigue.webp`,
        imageAlt:
          "Overwhelmed planning desk with crossed-out lists and too many options",
        body:
          "When every option looks equally good, every decision feels risky.\n\nCouples worry:\n• What if there’s a better option one page deeper?\n• What if we choose wrong too early?\n• What if we miss something important?\n\nSo they keep searching.\n\nWeeks turn into months.\nDetails blur together.\nUrgency builds — not because time is running out, but because uncertainty is exhausting.\n\nThis is where wedding planning starts to feel like a race.",
      },
      {
        id: "pros-choose",
        heading: "How wedding professionals actually choose vendors",
        image: `${import.meta.env.BASE_URL}assets/images/blog/directories_pro_insider_view.webp`,
        imageAlt:
          "Behind-the-scenes wedding pro work: checklist, setup hands, coordination in motion",
        body:
          "Here’s the part couples rarely get to see.\n\nWedding pros don’t choose vendors based on profiles.\n\nThey choose based on:\n• Who shows up early\n• Who handles problems calmly\n• Who works well with other vendors\n• Who delivers consistently — even on hard days\n\nIt’s not about who looks best online.\nIt’s about who performs well in real weddings.\n\nThat kind of trust doesn’t come from directories.\nIt comes from experience.",
      },
      {
        id: "wedndone",
        heading: "Why Wed&Done doesn’t work like a directory",
        image: `${import.meta.env.BASE_URL}assets/images/blog/directories_wedndone_curated.webp`,
        imageAlt:
          "Curated, simplified selection concept — clarity over endless vendor lists",
        body:
          "Wed&Done was built by people who’ve spent years inside weddings — watching what actually works and what quietly causes stress later.\n\nInstead of listing everything, we chose to curate.\n\nWe work with:\n• Venues we know operate smoothly\n• Vendors we’ve seen deliver, repeatedly\n• Professionals who collaborate well and protect the couple’s experience\n\nWe don’t sell placement.\nWe don’t rank by ad spend.\nWe don’t flood couples with endless options.\n\nWed&Done isn’t a marketplace. It’s a vetted system.",
      },
      {
        id: "calm",
        heading: "What changes when couples stop “hunting”",
        image: `${import.meta.env.BASE_URL}assets/images/blog/directories_calm_choice.webp`,
        imageAlt:
          "Calm planning moment: closed notebook, warm light, a sense of clarity and relief",
        body:
          "When couples aren’t buried in options, something surprising happens.\n\nThey decide faster — without rushing.\nThey feel confident instead of anxious.\nThey stop second-guessing every choice.\n\nPlanning becomes intentional instead of reactive.\n\nThe goal was never to see everything.\nIt was to choose well — once.\n\nAnd when the system is designed to support that, wedding planning finally feels like what it should have been all along: clear, calm, and exciting.",
      },
    ],
  },
];