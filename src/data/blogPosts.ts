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
  renderer?: "v1" | "v2";
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
    date: "2026-01-08",
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
  "Wed&Done was built by people who’ve spent years inside weddings — watching what actually works and what quietly causes stress later.\n\n" +
  "Instead of listing everything, we chose to curate.\n\n" +
  "If you want the full breakdown (and why directories create decision fatigue in the first place), read this:\n" +
  "→ A Better Alternative to WeddingWire & The Knot\n" +
  "https://wedndone.com/weddingwire-the-knot-alternative\n\n" +
  "We work with:\n" +
  "• Venues we know operate smoothly\n" +
  "• Vendors we’ve seen deliver, repeatedly\n" +
  "• Professionals who collaborate well and protect the couple’s experience\n\n" +
  "We don’t sell placement.\n" +
  "We don’t rank by ad spend.\n" +
  "We don’t flood couples with endless options.\n\n" +
  "Wed&Done isn’t a marketplace. It’s a vetted system.",
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

  // ─────────────────────────────────────────────────────────────
// BLOG #5 — Budget clarity (Budget Wand)
// ─────────────────────────────────────────────────────────────
{
  slug: "wedding-budget-clarity",
  title: "Your wedding budget shouldn’t feel like a mystery",
  date: "2026-01-09",
  excerpt:
    "Most budget stress comes from hidden costs and unclear pricing. Here’s how to set a realistic wedding budget—and stay calm while you plan.",
  thumbnail: `${import.meta.env.BASE_URL}assets/images/blog/wedding_budget_clarity_thumb.webp`,
  heroImage: `${import.meta.env.BASE_URL}assets/images/blog/wedding_budget_clarity_hero.webp`,
  sections: [
    {
      id: "intro",
      heading: "Budget stress isn’t about being “bad with money”",
      body:
        "Most couples don’t feel stressed because they can’t budget.\n\nThey feel stressed because wedding pricing is often unclear up front.\n\nQuotes change. Fees appear later. A “starting at” number turns into a totally different total once you add guest count, rentals, staffing, service fees, and timeline needs.\n\nSo if your wedding budget already feels confusing… you’re not behind.\nYou’re just trying to plan inside a system that hides the real numbers until the end.\n\nLet’s make it simple.",
    },

    {
      id: "section-1",
      heading: "1. Why wedding budgets fall apart early",
      image: `${import.meta.env.BASE_URL}assets/images/blog/wedding_budget_hidden_costs.webp`,
      imageAlt:
        "Reception setup in progress with rentals and details that hint at hidden costs adding up",
      body:
        "Most couples start with a budget number… and then feel shocked when the math doesn’t match.\n\nThat’s usually not because they underestimated. It’s because so many wedding costs show up as add-ons:\n\n• Service fees and staffing\n• Rentals and required minimums\n• Setup and cleanup\n• Time limits and overtime\n• Bar policies and security\n\nWhen pricing is missing pieces, couples plan with incomplete information.\nAnd incomplete information creates stress fast.",
    },

    {
      id: "section-2",
      heading: "2. Why “average wedding cost” is misleading",
      image: `${import.meta.env.BASE_URL}assets/images/blog/wedding_budget_context_matters.webp`,
      imageAlt:
        "Editorial wedding scene showing how the same venue can look dramatically different depending on styling and spend",
      body:
        "Online averages are everywhere… and they rarely help.\n\nA wedding can cost wildly different amounts based on:\n\n• Guest count\n• Venue rules and inclusions\n• Catering requirements\n• Rental needs\n• What’s already provided vs. what you have to bring in\n\nTwo weddings can happen at the same venue and have completely different totals.\n\nSo instead of asking “What does a wedding cost?”\nA better question is:\n\n“What will *our* wedding cost with *our* guest count, venue, and vendor choices?”",
    },

    {
      id: "section-3",
      heading: "3. How guest count quietly drives pricing",
      image: `${import.meta.env.BASE_URL}assets/images/blog/wedding_budget_guest_count.webp`,
      imageAlt:
        "Wide reception table layout emphasizing scale and repetition of place settings",
      body:
        "Guest count isn’t just a planning detail.\nIt’s a budget multiplier.\n\nMore guests affects:\n\n• Catering totals\n• Bar totals\n• Rentals (chairs, tables, place settings)\n• Staffing\n• Transportation and parking\n• Space requirements\n\nA small guest count change can shift your total dramatically.\n\nThat’s why locking a realistic guest estimate early is one of the best budget moves you can make.",
    },

    {
      id: "section-4",
      heading: "4. What actually makes budgeting easier",
      image: `${import.meta.env.BASE_URL}assets/images/blog/wedding_budget_clarity_system.webp`,
      imageAlt:
        "Calm, organized planning workspace with a notebook and soft natural light",
      body:
        "The couples who feel calm while planning aren’t magically more chill.\nThey just have clearer information.\n\nBudgeting gets easier when you can:\n\n• See real pricing up front\n• Compare options side by side\n• Understand what’s included vs. add-on\n• Track your running total as you book\n\nWhen the numbers stay visible, you stop second-guessing.\nAnd planning stops feeling like a financial jump-scare.",
    },

    {
      id: "section-5",
      heading: "5. Why we built Wed&Done’s budget tool",
      image: `${import.meta.env.BASE_URL}assets/images/blog/wedding_budget_wedndone.webp`,
      imageAlt:
        "Two people planning calmly together with a laptop in the background, no visible branding",
      body:
        "After years inside real weddings, the pattern was obvious:\n\nCouples don’t need more budgeting advice.\nThey need a clearer system.\n\nThat’s why Wed&Done’s Budget Wand keeps your numbers visible as you plan.\nAs you book inside Wed&Done, your totals update automatically—so you always know where you stand.\n\nNo spreadsheet spiral.\nNo “wait… how much did we spend?” moment.\nJust clarity you can trust.",
    },

    {
      id: "section-6",
      heading: "6. When budgeting stops feeling stressful",
      image: `${import.meta.env.BASE_URL}assets/images/blog/wedding_budget_calm.webp`,
      imageAlt:
        "Peaceful reception space fully set before guests arrive, warm and calm atmosphere",
      body:
        "Once your budget is built on real numbers, everything shifts.\n\nYou choose intentionally.\nYou feel confident.\nYou stop bracing for surprise costs.\n\nYour wedding budget shouldn’t feel like a mystery you solve at the end.\nIt should feel like a plan you can actually trust—while you’re making decisions.\n\nThat’s when planning gets fun again.",
    },
  ],
},
// ─────────────────────────────────────────────────────
// BLOG #6 — When should you actually book your wedding venue?
// ─────────────────────────────────────────────────────
{
  slug: "when-should-you-book-your-wedding-venue",
  title: "When should you actually book your wedding venue?",
  date: "2026-01-19",
  excerpt:
    "Most couples worry they’re behind — but the real goal is booking at the right moment with the right info. Here’s the timeline that keeps you calm (and gets you the date you want).",
  thumbnail: `${import.meta.env.BASE_URL}assets/images/blog/book_venue_when_thumb.webp`,
  heroImage: `${import.meta.env.BASE_URL}assets/images/blog/book_venue_when_hero.webp`,
  sections: [
    {
      id: "quick-answer",
      heading: "Quick answer: when should you book your wedding venue?",
      // Image file: book_venue_when_quick_answer.webp
      // Description: Clean, minimal timeline graphic showing engagement → guest count → venue shortlist → booking window
      image: `${import.meta.env.BASE_URL}assets/images/blog/book_venue_when_quick_answer.webp`,
      imageAlt:
        "Simple timeline visual showing engagement through venue booking",
      body:
        "Most couples should book their wedding venue **12–18 months before the wedding** if they want a prime weekend date — especially for popular seasons.\n\nBut the real “right time” isn’t just a number. It’s when you can answer three things:\n\n• Your **guest count range** (even a rough range)\n• Your **budget comfort zone**\n• Your **non-negotiables** (location, vibe, indoor/outdoor, restrictions)\n\nWhen those are clear, booking stops feeling like a panic decision and starts feeling like an anchored one.",
    },

    {
      id: "why-it-feels-urgent",
      heading: "Why does booking a venue feel so urgent?",
      // Image file: book_venue_when_urgency.webp
      // Description: Abstract pressure image — calendar pages, subtle clock elements, overlapping notes — no couple shown
      image: `${import.meta.env.BASE_URL}assets/images/blog/book_venue_when_urgency.webp`,
      imageAlt:
        "Visual metaphor for time pressure and urgency in wedding planning",
      body:
        "Because venues are the first big domino.\n\nYour venue influences:\n• Your date availability\n• Your overall budget (and hidden add-ons)\n• Your vendor options (approved lists, restrictions)\n• Your timeline and logistics\n\nSo when people say “dates are disappearing,” they’re not totally wrong — but what’s missing is **how to book smart without rushing**.",
    },

    {
      id: "how-far-out",
      heading: "How far in advance do venues book up?",
      // Image file: book_venue_when_calendar.webp
      // Description: Calendar-style visual with weekends blocked out and prime dates clearly marked as booked
      image: `${import.meta.env.BASE_URL}assets/images/blog/book_venue_when_calendar.webp`,
      imageAlt:
        "Calendar showing prime wedding dates booked far in advance",
      body:
        "Prime dates — especially **Saturday weddings in spring and fall** — often book **12–18 months out**.\n\nFriday and Sunday dates usually have more flexibility, and off-season months can open things up even sooner.\n\nThe key takeaway: it’s normal for popular dates to book early — but that doesn’t mean you should book blindly.",
    },

    {
      id: "what-not-to-do",
      heading: "What couples get wrong when booking too early",
      // Image file: book_venue_when_mistake.webp
      // Description: Conceptual image showing crossed-out lists or mismatched puzzle pieces symbolizing premature decisions
      image: `${import.meta.env.BASE_URL}assets/images/blog/book_venue_when_mistake.webp`,
      imageAlt:
        "Symbolic image representing rushed decisions and mismatched planning pieces",
      body:
        "The biggest mistake isn’t booking late — it’s booking **before the picture is clear**.\n\nCouples often lock in a venue:\n• Before they understand real costs\n• Before guest count stabilizes\n• Before knowing vendor restrictions\n\nThat’s when budgets stretch, compromises pile up, and planning starts to feel heavy.",
    },

    {
      id: "wedndone",
      heading: "How booking your venue becomes easier with the right system",
      // Image file: book_venue_when_system.webp
      // Description: Clean, confident venue overview image showing clarity, space, and organization (not a directory grid)
      image: `${import.meta.env.BASE_URL}assets/images/blog/book_venue_when_system.webp`,
      imageAlt:
        "Clear, simplified venue selection experience",
      body:
        "The goal isn’t to rush — it’s to remove friction.\n\nWhen couples can see pricing, availability, guest fit, and logistics together, booking stops feeling like a gamble.\n\nThat’s why tools like Wed&Done focus on **clarity first**, so couples can book confidently when the timing is right — without months of back-and-forth or pressure.",
    },

    {
      id: "takeaway",
      heading: "The calm way to book your venue",
      // Image file: book_venue_when_wrap.webp
      // Description: Calm, grounded closing image — warm light, open space, sense of completion and confidence
      image: `${import.meta.env.BASE_URL}assets/images/blog/book_venue_when_wrap.webp`,
      imageAlt:
        "Grounded, confident moment signaling clarity and calm planning",
      body:
        "You’re not behind.\n\nYou don’t need to rush.\n\nYou just need the right information before you commit.\n\nWhen venue booking is anchored correctly, everything else in wedding planning feels lighter — not heavier.",
    },
  ],
},

// ─────────────────────────────────────────────────────
// BLOG #7 — How to Book Wedding Vendors Without Endless Emails
// ─────────────────────────────────────────────────────
{
  slug: "how-to-book-wedding-vendors-without-endless-emails",
  title: "How to Book Wedding Vendors Without Endless Emails",
  date: "2026-01-24",
  excerpt:
    "Most wedding platforms help couples browse vendors, not actually book them. Here’s why planning feels busy but nothing feels secured — and what booking should actually look like.",
  thumbnail: `${import.meta.env.BASE_URL}assets/images/blog/book_vendors_no_emails_thumb.webp`,
  heroImage: `${import.meta.env.BASE_URL}assets/images/blog/book_vendors_no_emails_hero.webp`,
  sections: [
    {
      id: "tldr",
      heading: "Quick Take",
      body:
        "Most wedding platforms help couples browse vendors, not actually book them. That’s why planning feels busy but nothing feels secured.\n\nWed&Done was built as a booking-first system — so couples can book venues and vendors with clear steps and pricing, without chasing emails or waiting on replies.",
    },

    {
      id: "pain",
      heading: "Why booking wedding vendors feels harder than it should",
      image: `${import.meta.env.BASE_URL}assets/images/blog/book_vendors_busy_not_booked.webp`,
      imageAlt:
        "Overwhelmed planning workspace showing effort without confirmed bookings",
      body:
        "If you’ve started reaching out to photographers, caterers, or DJs, this probably sounds familiar:\n\n• You’ve sent multiple inquiries\n• You’re waiting on replies\n• Some vendors respond quickly, others disappear\n• Pricing is vague or “starts at”\n• Availability isn’t confirmed\n\nYou’re doing a lot — but nothing is actually booked.\n\nThis is what we call false progress.\nYou’re busy, but you’re not booked.",
    },

    {
      id: "emails",
      heading: "Why emailing vendors doesn’t actually move things forward",
      image: `${import.meta.env.BASE_URL}assets/images/blog/book_vendors_email_loop.webp`,
      imageAlt:
        "Abstract representation of emails looping without resolution",
      body:
        "Most couples are taught that vendor booking works like this:\n\n1. Find a vendor profile\n2. Send an inquiry\n3. Wait\n4. Compare replies\n5. Follow up\n6. Repeat\n\nOn the surface, it feels responsible. In reality, it creates friction.\n\nEmails introduce:\n\n• Delays\n• Inconsistent information\n• Unclear pricing\n• Uncertain availability\n\nAnd because nothing is locked in, couples hesitate to commit — so the process stretches on for weeks or months.",
    },

    {
      id: "directories",
      heading: "Why wedding directories make vendor booking harder",
      image: `${import.meta.env.BASE_URL}assets/images/blog/book_vendors_directories_fail.webp`,
      imageAlt:
        "Endless vendor listings fading into the distance without resolution",
        body:
        "This is the part most couples don’t realize early on.\n\nWedding directories aren’t built to help you book vendors.\nThey’re built to display listings and sell visibility.\n\nThat means:\n\n• Vendors pay to appear\n• Placement is influenced by advertising\n• Couples do all the coordination work\n• Pricing and availability live outside the platform\n• Nothing is actually secured until contracts are signed elsewhere\n\nPlatforms like WeddingWire are great for browsing — but browsing isn’t booking.\n\nIf you want the full breakdown (and why directories create decision fatigue), read this:\nhttps://wedndone.com/weddingwire-the-knot-alternative\n\nAnd browsing alone doesn’t move your wedding forward.",
    },

    {
      id: "reframe",
      heading: "Browsing vendors ≠ booking vendors",
      image: `${import.meta.env.BASE_URL}assets/images/blog/book_vendors_browsing_vs_booking.webp`,
      imageAlt:
        "Split visual showing chaotic browsing versus calm booking confirmation",
      body:
        "This is the core reframe most couples never hear:\n\nSearching is not progress.\nOpening tabs is not progress.\nSaving favorites is not progress.\n\nProgress happens when:\n\n• A vendor is confirmed\n• A contract is signed\n• A date is secured\n\nBooking is a system, not a search.\n\nUntil that system exists, couples stay stuck in comparison mode — endless options, no decisions.",
    },

    {
      id: "system",
      heading: "What booking wedding vendors should actually look like",
      image: `${import.meta.env.BASE_URL}assets/images/blog/book_vendors_system_reframe.webp`,
      imageAlt:
        "Clean step-based path leading to a confirmed booking",
      body:
        "A booking-first experience removes guesswork.\n\nThat means:\n\n• Clear pricing up front\n• Real availability tied to your date\n• Guided steps instead of open-ended inquiries\n• Fewer options, but better ones\n• Actual booking — not just introductions\n\nWhen those pieces are visible together, decisions stop feeling risky.",
    },

    {
      id: "wedndone",
      heading: "Why Wed&Done exists",
      image: `${import.meta.env.BASE_URL}assets/images/blog/book_vendors_wedndone_difference.webp`,
      imageAlt:
        "Calm, confident booking confirmation moment",
      body:
        "That gap — between browsing and booking — is exactly why Wed&Done was built.\n\nInstead of sending couples into inbox chaos, Wed&Done uses a booking-first system that lets couples:\n\n• Book venues and vendors directly\n• See pricing clearly\n• Move through guided steps\n• Know what’s actually secured\n\nNo endless emails.\nNo vendor stalking.\nNo wondering what’s real.\n\nJust booking — done the way it should be.\n\nWant to see how we compare to traditional directories?\nhttps://wedndone.com/weddingwire-the-knot-alternative",
    },

    {
      id: "arizona",
      heading: "Why this matters even more in Arizona",
      image: `${import.meta.env.BASE_URL}assets/images/blog/book_vendors_arizona.webp`,
      imageAlt:
        "Arizona destination wedding context with planning complexity",
      body:
        "In Arizona, this problem is amplified.\n\nMany couples:\n\n• Are planning from out of state\n• Are booking destination weddings\n• Are competing for peak-season dates\n• Need vendors aligned with venue rules and timelines\n\nWhen vendor booking depends on emails and guesswork, planning slows down fast — especially for destination couples.\n\nBooking-first systems remove that friction.",
    },

    {
      id: "close",
      heading: "The calm truth about vendor booking",
      image: `${import.meta.env.BASE_URL}assets/images/blog/book_vendors_calm_booking.webp`,
      imageAlt:
        "Minimal, peaceful space representing clarity and completion",
      body:
        "Booking your wedding vendors shouldn’t feel this hard.\n\nCouples don’t need more inspiration.\nThey don’t need more tabs.\nThey don’t need more inquiries.\n\nThey need a clearer path to being booked.\n\nThat’s what booking should actually feel like — confident, guided, and real.",
    },
  ],
},
// ─────────────────────────────────────────────────────
// BLOG #8 — Why pricing transparency is rare in weddings
// ─────────────────────────────────────────────────────
{
  slug: "why-pricing-transparency-is-rare-in-weddings",
  title: "Why pricing transparency is rare in wedding planning (and what that does to couples)",
  date: "2026-02-01",
  excerpt:
    "Wedding pricing feels confusing not because couples are bad with money, but because most platforms were built for inquiries, not booking. Here’s why transparency is rare — and what actually fixes it.",
  thumbnail: `${import.meta.env.BASE_URL}assets/images/blog/pricing_transparency_thumb.webp`,
  heroImage: `${import.meta.env.BASE_URL}assets/images/blog/pricing_transparency_hero.webp`,
  renderer: "v2",
  sections: [
    {
      id: "tldr",
      heading: "TL;DR",
      body:
        "Most wedding platforms and vendors don’t show clear pricing because the system was built around inquiries, not booking. That lack of transparency creates stress, delays decisions, and keeps couples busy but not booked.\n\nBooking-first systems change this by tying real pricing to availability, contracts, and confirmed steps — not vague estimates.",
    },

    {
      id: "early-anxiety",
      heading: "Why couples feel anxious about wedding pricing so early",
      body:
        "Many couples don’t start planning worried about money.\n\nThey start planning confused.\n\nPrices feel inconsistent. Quotes vary wildly. One vendor says starting at, another says it depends, and timelines stretch while numbers remain fuzzy.\n\nWhat couples experience is not overspending — it’s uncertainty.\n\nThey want to make responsible decisions, but the information they’re given isn’t complete enough to trust.\n\nThat’s why budget stress shows up so early — even before anything is booked.",
    },

    {
      id: "vague-on-purpose",
      heading: "Why wedding pricing is usually vague on purpose",
      body:
        "This part surprises most couples.\n\nWedding pricing isn’t unclear because vendors are hiding something malicious. It’s unclear because the system was never designed for direct booking.\n\nMost traditional wedding platforms operate on inquiry-based workflows, which means:\n• Vendors respond manually\n• Pricing depends on guest count, date, timing, and rules\n• Availability isn’t tied to a live system\n• Nothing is confirmed until contracts are handled elsewhere\n\nSo instead of showing real prices, platforms encourage conversations.\n\nThat keeps couples emailing — but not booking.",
    },

    {
      id: "false-progress",
      heading: "Why inquiry-based pricing slows everything down",
      image: `${import.meta.env.BASE_URL}assets/images/blog/pricing_false_progress.webp`,
      imageAlt:
        "Overwhelmed desk with open tabs, scattered notes, and no clear decision",
      body:
        "When pricing isn’t visible up front, couples can’t compare meaningfully.\n\nThey hesitate because:\n• They don’t know what’s included\n• They don’t know what will change later\n• They don’t know what’s actually available\n• They don’t know when it’s safe to commit\n\nThis creates false progress.\n\nCouples feel busy — sending messages, collecting PDFs, opening tabs — but nothing is secured.\n\nAnd because nothing is secured, they keep waiting.",
    },

    {
      id: "directories-limit",
      heading: "Why directories can’t fix pricing transparency",
      body:
        "Large wedding directories were built to display listings, not outcomes.\n\nThey optimize for:\n• Vendor visibility\n• Lead generation\n• Traffic volume\n\nThey don’t manage:\n• Contracts\n• Payments\n• Availability logic\n• Confirmations\n\nSo pricing stays external to the platform.\n\nThat’s not a flaw — it’s a design limitation.\n\nBut it means couples are left to assemble clarity on their own.",
    },

    {
      id: "what-transparency-requires",
      heading: "What pricing transparency actually requires",
      body:
        "True pricing transparency isn’t just a number on a page.\n\nIt requires:\n• Pricing tied to guest count\n• Availability tied to a specific date\n• Rules baked into the quote\n• A path to contract and confirmation\n\nWithout those pieces, pricing is always conditional.\n\nWith them, pricing becomes usable.\n\nThis is why transparency only works inside a booking-first system — not a browsing platform.",
    },

    {
      id: "wedndone",
      heading: "Why Wed&Done approaches pricing differently",
      body:
        "That gap between browsing and booking is exactly where most couples get stuck.\n\nInstead of asking couples to guess, Wed&Done was built to surface pricing in context — tied to real availability, real rules, and real steps toward booking.\n\nThe goal isn’t to force decisions.\n\nIt’s to remove the guesswork that causes hesitation.\n\nWhen couples can see what something actually costs — and what that cost includes — planning stops feeling risky.",
    },

    {
      id: "arizona",
      heading: "Why this matters even more in Arizona",
      body:
        "In Arizona, pricing uncertainty compounds quickly.\n\nMany couples are:\n• Planning from out of state\n• Booking destination weddings\n• Working within venue-specific vendor rules\n• Competing for peak-season dates 12–18 months out\n\nWhen pricing clarity depends on email threads, delays add up fast.\n\nBooking-first systems reduce that friction by making the numbers visible before momentum is lost.",
    },

    {
      id: "takeaway",
      heading: "The calm truth about wedding pricing",
      body:
        "Wedding pricing doesn’t need to be mysterious.\n\nCouples don’t need perfect numbers.\nThey need clear ones.\n\nWhen pricing is transparent enough to trust, decisions become easier.\nWhen decisions become easier, booking actually happens.\n\nThat’s what wedding planning should feel like — grounded, informed, and real.",
    },
  ],
},
];