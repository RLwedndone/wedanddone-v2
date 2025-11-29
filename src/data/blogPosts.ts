// src/data/blogPosts.ts

export interface BlogPostSection {
    id: string;
    heading: string;      // rendered as <h2> in the post
    image?: string;       // optional section image
    imageAlt?: string;
    vimeoId?: string;     // 🔹 optional Vimeo video for this section
    body: string;
  }
  
  export interface BlogPost {
    slug: string;         // used in the URL, e.g. /blog/bask-in-engaged-bliss
    title: string;
    date: string;         // ISO string or simple text
    excerpt: string;
    thumbnail: string;    // small image for the index list
    heroImage: string;    // large hero image at top of the article
    sections?: BlogPostSection[];
    content?: string;     // optional full post text fallback
  }
  
  export const blogPosts: BlogPost[] = [
    {
      slug: "bask-in-engaged-bliss",
      title: "Bask in Your Engaged Bliss (Without the Planning Panic)",
      date: "2025-11-01",
      excerpt:
        "Just got engaged? Here are the five things to do first—without spiraling into planning overwhelm.",
      // 👇 drop your actual files into assets/images/blog and either use these
      // names or tweak them to match
      thumbnail: `${import.meta.env.BASE_URL}assets/images/blog/bask_engaged_thumb.webp`,
      heroImage: `${import.meta.env.BASE_URL}assets/images/blog/bask_engaged_hero.webp`,
      sections: [
        {
          id: "intro",
          heading: "You’re Engaged—Now What?",
          image: `${import.meta.env.BASE_URL}assets/images/blog/bask_engaged_intro.webp`,
          imageAlt: "Newly engaged couple celebrating with sparkling lights in the background",
          body:
            "Congratulations, lovebirds! You said YES, the ring is stunning, and you’re officially in that dreamy, floating “we’re engaged!” bubble. Before you get swallowed by Pinterest boards, group texts, and a thousand competing opinions… let’s ground you with the actual first steps that matter.\n\nIf you’re planning an Arizona wedding, this is your golden moment to set yourselves up for an easy, organized, beautifully automated planning process. Here are the five things to do right after getting engaged, minus the overwhelm."
        },
        {
          id: "budget-wand",
          heading: "1. Set a Budget (and Let the Budget Wand Do the Heavy Lifting)",
          image: `${import.meta.env.BASE_URL}assets/images/blog/bask_engaged_budget.webp`,
          imageAlt: "Wed&Done Budget Wand glowing as numbers fill in on a dashboard",
          body:
            "Weddings get pricey fast, and guessing your way through it is… not the vibe. Setting a realistic number early keeps you in control.\n\nInside Wed&Done, your Budget Wand tracks everything you book inside the app, auto-updates your total spend, shows exactly where your money is going, and gives you a running tally of remaining funds. And if you book anything outside Wed&Done, the Budget Wand lets you log those purchases too, so your spend stays accurate and complete.\n\nNo spreadsheets. No mystery charges. No “wait… how much have we spent?!” moments. Just crystal-clear pricing every step of the way."
        },
        {
          id: "guest-list",
          heading: "2. Build Your Guest List (This One Drives Everything)",
          image: `${import.meta.env.BASE_URL}assets/images/blog/bask_engaged_guests.webp`,
          imageAlt: "Couple looking at a guest list with heart icons next to names",
          body:
            "Your guest count is the foundation for venue capacity, catering cost, decor quantities, and seating logistics. Before you choose a venue or vendor, you need a ballpark number.\n\nHere’s the good news: every Wed&Done boutique builds your guest count right into the booking process. As you move from catering to florals to entertainment, prices auto-adjust, menus update, capacity alerts trigger, and the app keeps everything synced with your wedding date and details.\n\nYou get full transparency now and the flexibility to adjust your guest count as you get closer. Automation = peace of mind."
        },
        {
          id: "wedding-style",
          heading: "3. Discover Your Wedding Style (Your Vibe Leads the Way)",
          image: `${import.meta.env.BASE_URL}assets/images/blog/bask_engaged_style.webp`,
          imageAlt: "Collage of different wedding styles from desert chic to classic ballroom",
          body:
            "Are you classic ballroom? Desert-chic? Modern garden? Old-world romance? Your vibe will naturally narrow the right venues, menus, florals, and photography styles.\n\nInside Wed&Done, the boutiques help you explore real cuisine options from our catering partners, floral palettes matched to your aesthetic, photography styles curated to your wedding mood, and entertainment that fits your energy. Finding your style becomes fun instead of overwhelming."
        },
        {
          id: "venue-date",
          heading: "4. Choose Your Venue & Set Your Date (The Castle Button is Your Friend)",
          image: `${import.meta.env.BASE_URL}assets/images/blog/bask_engaged_venue.webp`, 
  imageAlt: "Arizona wedding venues in Wed&Done",
  vimeoId: "829968623",
          body:
            "Venue hunting used to be a rabbit hole of Google searches, site tours, and contradictory pricing. Now… it’s one tap.\n\nInside Wed&Done, the Venue Ranker gives you a curated list of Arizona venues across Tucson, Tubac, and the Valley, with real pricing, walkthrough videos, style-based sorting, guest count matching, and a simple side-by-side comparison tool.\n\nYou get the big picture instantly—and booking your dream venue becomes the easy part."
        },
        {
          id: "vendor-team",
          heading: "5. Book Your Vendor Dream Team (All in One Afternoon)",
          image: `${import.meta.env.BASE_URL}assets/images/blog/bask_engaged_vendors.webp`,
          imageAlt: "Wedding vendor team smiling together: photographer, florist, caterer, and DJ",
          body:
            "Wed&Done replaces dozens of tabs, phone calls, spreadsheets, and random DMs with one unified flow.\n\nChoose your photographer, florals, catering, DJ and entertainment, menu upgrades, and dessert options.\n\nEach boutique guides you step-by-step with photos, real pricing, availability, customization menus, and automatic contract and receipt generation. Everything updates inside your Budget Wand automatically, keeping your planning beautifully organized."
        },
        {
          id: "wrap-up",
          heading: "Enjoy This Moment—You’re Engaged",
          image: `${import.meta.env.BASE_URL}assets/images/blog/bask_engaged_wrap.webp`,
          imageAlt: "Engaged couple walking hand-in-hand down a colorful path with confetti in the air",
          body:
            "Wed&Done is here to help you keep the magic and the clarity as you move from the “We’re engaged!” glow into actually booking the wedding of your dreams.\n\nWhen you’re ready, log in, tap a button, and we’ll guide you from the first decision to the aisle."
        }
      ],
      // optional: keep the original full text as a fallback / export
      content: `
  Bask in Your Engaged Bliss (Without the Planning Panic)
  
  Congratulations, lovebirds! You said YES, the ring is stunning, and you’re officially in that dreamy, floating “we’re engaged!” bubble. Before you get swallowed by Pinterest boards, group texts, and a thousand competing opinions… let’s ground you with the actual first steps that matter.
  
  If you’re planning an Arizona wedding, this is your golden moment to set yourselves up for an easy, organized, beautifully automated planning process. Here are the five things to do right after getting engaged, minus the overwhelm.
  
  1. Set a Budget (and Let the Budget Wand Do the Heavy Lifting)
  
  Weddings get pricey fast, and guessing your way through it is… not the vibe. Setting a realistic number early keeps you in control.
  
  Inside Wed&Done, your Budget Wand tracks everything you book inside the app, auto-updates your total spend, shows exactly where your money is going, and gives you a running tally of remaining funds. And if you book anything outside Wed&Done, the Budget Wand lets you log those purchases too, so your spend stays accurate and complete.
  
  No spreadsheets. No mystery charges. No “wait… how much have we spent?!” moments. Just crystal-clear pricing every step of the way.
  
  2. Build Your Guest List (This One Drives Everything)
  
  Your guest count is the foundation for venue capacity, catering cost, decor quantities, and seating logistics. Before you choose a venue or vendor, you need a ballpark number.
  
  Here’s the good news: every Wed&Done boutique builds your guest count right into the booking process. As you move from catering to florals to entertainment, prices auto-adjust, menus update, capacity alerts trigger, and the app keeps everything synced with your wedding date and details.
  
  You get full transparency now and the flexibility to adjust your guest count as you get closer. Automation = peace of mind.
  
  3. Discover Your Wedding Style (Your Vibe Leads the Way)
  
  Are you classic ballroom? Desert-chic? Modern garden? Old-world romance? Your vibe will naturally narrow the right venues, menus, florals, and photography styles.
  
  Inside Wed&Done, the boutiques help you explore real cuisine options from our catering partners, floral palettes matched to your aesthetic, photography styles curated to your wedding mood, and entertainment that fits your energy. Finding your style becomes fun instead of overwhelming.
  
  4. Choose Your Venue & Set Your Date (The Castle Button is Your Friend)
  
  Venue hunting used to be a rabbit hole of Google searches, site tours, and contradictory pricing. Now… it’s one tap.
  
  Inside Wed&Done, the Venue Ranker gives you a curated list of Arizona venues across Tucson, Tubac, and the Valley, with real pricing, walkthrough videos, style-based sorting, guest count matching, and a simple side-by-side comparison tool.
  
  You get the big picture instantly—and booking your dream venue becomes the easy part.
  
  5. Book Your Vendor Dream Team (All in One Afternoon)
  
  Wed&Done replaces dozens of tabs, phone calls, spreadsheets, and random DMs with one unified flow.
  
  Choose your photographer, florals, catering, DJ and entertainment, menu upgrades, and dessert options.
  
  Each boutique guides you step-by-step with photos, real pricing, availability, customization menus, and automatic contract and receipt generation. Everything updates inside your Budget Wand automatically, keeping your planning beautifully organized.
  
  Enjoy this moment — you’re engaged.
  
  Wed&Done is here to help you keep the magic and the clarity as you move from the “We’re engaged!” glow into actually booking the wedding of your dreams. When you’re ready, log in, tap a button, and we’ll guide you from the first decision to the aisle.
  `,
    },
  ];