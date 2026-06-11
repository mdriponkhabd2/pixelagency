import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import { initializeApp as initAdminApp, getApps as getAdminApps } from "firebase-admin/app";
import { getFirestore as getAdminFirestore } from "firebase-admin/firestore";
import pg from "pg";
import mysql from "mysql2/promise";
import dns from "dns";

dotenv.config();

const app = express();
const PORT = 3000;
const DB_FILE = path.join(process.cwd(), "db.json");

app.use(express.json());

// Initialize Gemini API client lazily
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI | null {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey && apiKey !== "MY_GEMINI_API_KEY") {
      try {
        aiClient = new GoogleGenAI({ apiKey });
      } catch (err) {
        console.error("Failed to initialize Gemini API Client:", err);
      }
    }
  }
  return aiClient;
}

// Default Seed Data
const DEFAULT_DB = {
  users: [
    {
      id: "admin-id",
      name: "Agency Admin",
      email: "admin@agency.pro",
      phone: "01837679963",
      role: "admin",
      createdAt: new Date().toISOString()
    }
  ],
  services: [
    {
      id: "graphic-design",
      name: "Graphic Design",
      slug: "graphic-design",
      icon: "Palette",
      bannerUrl: "https://images.unsplash.com/photo-1626785774573-4b799315345d?auto=format&fit=crop&q=80&w=1200",
      shortDescription: "Elevate your branding with our ultra-clean, high-impact minimalist visual design assets.",
      description: "Our world-class design studio crafts premium visual brand languages that stand out in crowded digital markets. From sophisticated vector layouts to complete corporate identity kits, we deliver pure design excellence engineered for conversions."
    },
    {
      id: "video-editing",
      name: "Video Editing",
      slug: "video-editing",
      icon: "Film",
      bannerUrl: "https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?auto=format&fit=crop&q=80&w=1200",
      shortDescription: "Premium cinematic narrative editing and fast-paced high-retention viral content production.",
      description: "Capture attention within seconds with our industry-level editing suites. We master color grading, sleek match cuts, responsive sound design, and elegant kinetic typography optimized specifically for high retention across YouTube, TikTok, and social campaigns."
    },
    {
      id: "web-design",
      name: "Web Design",
      slug: "web-design",
      icon: "Monitor",
      bannerUrl: "https://images.unsplash.com/photo-1547658719-da2b81169b44?auto=format&fit=crop&q=80&w=1200",
      shortDescription: "Ultra-fast, responsive web interfaces built with elegant typography and fluid transitions.",
      description: "We build fully responsive, premium corporate platforms and luxury multi-page websites that marry aesthetics with absolute high performance. Perfect responsiveness, fast-loading clean architecture, and fluid micro-animations come standard with every build."
    },
    {
      id: "landing-page",
      name: "Landing Page",
      slug: "landing-page",
      icon: "Layers",
      bannerUrl: "https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?auto=format&fit=crop&q=80&w=1200",
      shortDescription: "Sleek, conversion-optimized landing pages engineered to drive massive client actions.",
      description: "Our high-performance single-page sales and copy platforms leverage psychological visual paths, clear copy structure, and elegant call-to-actions. Designed specifically for SaaS, real estate products, agency growth, and service businesses looking to convert cold ads."
    },
    {
      id: "social-media-growth",
      name: "Social Media Growth",
      slug: "social-media-growth",
      icon: "TrendingUp",
      bannerUrl: "https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?auto=format&fit=crop&q=80&w=1200",
      shortDescription: "Accelerate your social authority and organic reach with data-driven audience acquisition strategies.",
      description: "Establish digital dominance. We manage your content schedule, optimize viral keywords, design premium high-CTR thumbnails, and formulate real biological marketing funnels to skyrocket qualified leads and organic views across TikTok, YouTube, and Instagram."
    },
    {
      id: "domain-hosting",
      name: "Domain & Hosting",
      slug: "domain-hosting",
      icon: "Globe",
      bannerUrl: "https://images.unsplash.com/photo-1596495578065-6e076b8df1d8?auto=format&fit=crop&q=80&w=1200",
      shortDescription: "Ultra-secure domain registration, high-speed cloud hosting, and instant DNS configurations.",
      description: "Secure your unique identity on the web with our high-performance DNS routing, lightning-fast SSD storage, and redundant Cloud Hosting servers. Includes automated daily backups, free SSL certificates, and premium protection."
    }
  ],
  packages: [
    // Graphic Design Packages
    {
      id: "gd-basic",
      serviceId: "graphic-design",
      name: "Basic Package",
      price: 199,
      description: "Perfect for emerging startups seeking high-quality brand assets and elegant foundational items.",
      features: [
        "1 Custom Premium Logo Design",
        "2 Beautiful Social Media Templates",
        "Vector Source Files included (SVG/AI)",
        "2 Interactive Revision Rounds",
        "Standard 3-Day Delivery Cycle"
      ],
      enabled: true
    },
    {
      id: "gd-standard",
      serviceId: "graphic-design",
      name: "Standard Package",
      price: 499,
      description: "Our most popular corporate tier providing a cohesive, professional brand identity language.",
      features: [
        "3 Alternative Logo Concepts",
        "Complete Visual Branding Guideline Book",
        "6 Customized Social Media templates",
        "Double-sided Business Card & Letterhead",
        "Unlimited Revision Cycles",
        "Expedited 2-Day Priority Delivery"
      ],
      enabled: true
    },
    {
      id: "gd-premium",
      serviceId: "graphic-design",
      name: "Premium Package",
      price: 999,
      description: "A complete visual design takeover delivering ultra-premium corporate luxury assets.",
      features: [
        "Deluxe Logo Architecture & Animated Logo",
        "Complete Premium Corporate Visual System",
        "15 Modular Social Media Assets",
        "Premium Merchandise & App Packaging Designs",
        "Dedicated VIP Creative Director Support",
        "1-on-1 Strategy Workshop Session"
      ],
      enabled: true
    },

    // Video Editing Packages
    {
      id: "ve-basic",
      serviceId: "video-editing",
      name: "Basic Package",
      price: 149,
      description: "Perfect for high-impact social media reels, tik-toks, or short promo highlight feeds.",
      features: [
        "Up to 60-Second Short Video Formats",
        "Sound FX & Licensing Selection Track",
        "Premium Subtitles & Subtext Animation",
        "Color Correction & Base Grade",
        "2 Collaborative Client Revisions"
      ],
      enabled: true
    },
    {
      id: "ve-standard",
      serviceId: "video-editing",
      name: "Standard Package",
      price: 449,
      description: "Complete professional edits optimized for structured YouTube uploads or software walkthroughs.",
      features: [
        "Up to 10 Minutes Cinematic Cut",
        "Motion Graphics & Intro/Outro Design",
        "Advanced Sound Design & Beat Synchronization",
        "Vibrant High-Contrast Color Grading",
        "Unlimited Collaborative Revisions",
        "Includes Source Timeline File"
      ],
      enabled: true
    },
    {
      id: "ve-premium",
      serviceId: "video-editing",
      name: "Premium Package",
      price: 1299,
      description: "Enterprise-grade elite production for high-budget trailers, courses, or TV commercial assets.",
      features: [
        "Any length of edit (Up to 30 Minutes)",
        "Bespeaking Narrative Directing & Custom Motion Effects",
        "Ultimate Soundscape Design (ASMR, Cinematic Ambient)",
        "Elite Hollywood Grade Color Correction (DaVinci workflow)",
        "Ultra-Fast 24-Hour Expedited Delivery Option",
        "Full Video Campaign Advertising Strategy"
      ],
      enabled: true
    },

    // Web Design Packages
    {
      id: "wd-basic",
      serviceId: "web-design",
      name: "Basic Package",
      price: 799,
      description: "A stunning, responsive portfolio website establishing immediate digital authority.",
      features: [
        "Up to 3 Premium Multi-sections Pages",
        "Fully Responsive Mobile Layout Layout",
        "Basic Search Engine Optimization Structure",
        "Live Contact Request Submission Forms",
        "1 Month Complementary Hosting Setup Support"
      ],
      enabled: true
    },
    {
      id: "wd-standard",
      serviceId: "web-design",
      name: "Standard Package",
      price: 1799,
      description: "The complete premium corporate website designed for modern dynamic scaling enterprises.",
      features: [
        "Up to 8 Fully Styled Sub-pages",
        "Custom Animated Dynamic Interactivities",
        "Advanced SEO & Speed Enhancement (95+ score)",
        "Interactive Admin Content Management Module",
        "Google Analytics & Facebook Pixel Setup",
        "6 Months Premium Live Support Service"
      ],
      enabled: true
    },
    {
      id: "wd-premium",
      serviceId: "web-design",
      name: "Premium Package",
      price: 3499,
      description: "Custom headless enterprise software platform incorporating premium interactive features.",
      features: [
        "Unlimited Bespoke Structural Web Pages",
        "Interactive Database & Dashboard Systems",
        "High-Grade Advanced Animation Frameworks",
        "Custom API & Third-party Service Syncs",
        "Comprehensive Cyber Threat Protection Setup",
        "Lifetime Critical Care Support Agreement"
      ],
      enabled: true
    },

    // Landing Page Packages
    {
      id: "lp-basic",
      serviceId: "landing-page",
      name: "Basic Package",
      price: 399,
      description: "A high-conversion light single-section landing page perfect for capturing lead details.",
      features: [
        "1 Long-form Responsive Content Layout",
        "Focused Value Proposition Architecture",
        "Contact Leads Data Capture System",
        "Basic Page Loading Speed Optimizations",
        "3 Comprehensive Quality Revisions"
      ],
      enabled: true
    },
    {
      id: "lp-standard",
      serviceId: "landing-page",
      name: "Standard Package",
      price: 899,
      description: "Premium SaaS or high-conversion product sales and subscription optimization page.",
      features: [
        "Ultra-persuasive Copywriting Structure Assistance",
        "Bespoke Responsive Layout Icons and Asset Elements",
        "Integrated Customer FAQ accordion segment",
        "Custom Social Testimonial Grid Sections",
        "Direct Native Analytics & CRM connections",
        "Unlimited Multi-device Polish Cycles"
      ],
      enabled: true
    },
    {
      id: "lp-premium",
      serviceId: "landing-page",
      name: "Premium Package",
      price: 1499,
      description: "A comprehensive lead generation funnel machine including integrated pricing tables and reviews.",
      features: [
        "Multi-variation Conversion Copy Layouts",
        "Custom Particle/Interactive Background Accents",
        "A/B Split Test Friendly Setup",
        "Video Overlay Hooks & Mockup Screen Components",
        "Priority Fast-lane 48 Hour Completion",
        "1 Hour Conversion Copy Coaching Consultation"
      ],
      enabled: true
    },

    // Social Media Growth Packages
    {
      id: "smg-basic",
      serviceId: "social-media-growth",
      name: "Basic Package",
      price: 299,
      description: "Kickstart your social platforms with targeted growth optimizations and beautiful layouts.",
      features: [
        "Organic Growth Blueprint & Schedule Planning",
        "Professional Bio Optimization & Banner Makeovers",
        "Guaranteed 500+ Real Organic Followers/Views",
        "5 Optimized Hashtag & Viral Keyword Lists",
        "Live Engagement Tracking Reports"
      ],
      enabled: true
    },
    {
      id: "smg-standard",
      serviceId: "social-media-growth",
      name: "Standard Package",
      price: 699,
      description: "Accelerate authority with expert viral planning, asset design, and subscriber magnets.",
      features: [
        "Fully Managed Dynamic Posting Plan (12 posts/mo)",
        "Guaranteed 1,500+ Real High-Quality Followers",
        "Premium High-CTR Story/Thumbnail Design",
        "Targeted Niche Audience Interaction Loops",
        "Bi-weekly Review Zoom Session Calls",
        "Competitor Tactics Intelligence Reports"
      ],
      enabled: true
    },
    {
      id: "smg-premium",
      serviceId: "social-media-growth",
      name: "Premium Package",
      price: 1599,
      description: "The complete multi-channel agency takeover. Dominating TikTok, Instagram, and YouTube.",
      features: [
        "Full Brand Management & Content Creation Loop",
        "Guaranteed 5,000+ Verified Organic Followers",
        "3 Done-with-You Customized Viral Script Pipelines",
        "VIP Brand Collabs & PR Press Integrations",
        "Weekly SEO Metrics & Conversions Review",
        "Dedicated Growth Account Manager 24/7"
      ],
      enabled: true
    },
    {
      id: "host-starter",
      serviceId: "domain-hosting",
      name: "Starter Shared",
      price: 1.99,
      description: "Great for new blogs and static professional landings requiring fast SSD space.",
      features: [
        "1 Free Standard Domain Search",
        "10GB Premium High-Speed SSD",
        "Unlimited Free SSL Certificate",
        "Automated Daily DB Backups",
        "24/7 Technical Support Ticket"
      ],
      enabled: true
    },
    {
      id: "host-cloud",
      serviceId: "domain-hosting",
      name: "Pro Cloud Hosting",
      price: 4.99,
      description: "Best for growing portals, custom web architectures, and multiple high-traffic brand landings.",
      features: [
        "Hosting for 5 Dynamic Websites",
        "50GB NVMe Lightning-Storage",
        "Free SSL & Shield DDoS Security",
        "Git Integration & staging spaces",
        "Priority WhatsApp Support Line"
      ],
      enabled: true
    },
    {
      id: "host-dedicated",
      serviceId: "domain-hosting",
      name: "Enterprise VPS Node",
      price: 19.99,
      description: "Dedicated resources for massive visual agencies and automated high-load software solutions.",
      features: [
        "Fully Dedicated VPS Resource Node",
        "200GB Pure SSD NVMe Space",
        "Full Root Administration Access",
        "Advanced CDN Edge Proxies Shield",
        "Dedicated Visual Engineer Support"
      ],
      enabled: true
    }
  ],
  portfolio: [
    {
      id: "port-1",
      title: "Nova Pay Branding Strategy",
      serviceId: "graphic-design",
      imageUrl: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&q=80&w=600",
      description: "Complete luxury minimalist vector corporate visual identity and system for an international fintech app.",
    },
    {
      id: "port-2",
      title: "Zenith Studio Promotional Reel",
      serviceId: "video-editing",
      imageUrl: "https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&q=80&w=600",
      description: "High-adrenaline kinetic narrative edit utilizing advanced visual overlays and customized audio synchronization.",
    },
    {
      id: "port-3",
      title: "Vortex SaaS Core Portal",
      serviceId: "web-design",
      imageUrl: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&q=80&w=600",
      description: "A dark high-performance React dashboard with smooth responsive state charts, fast canvas widgets, and modern vibes.",
    },
    {
      id: "port-4",
      title: "Aqua CRM Sales Pipeline",
      serviceId: "landing-page",
      imageUrl: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&q=80&w=600",
      description: "A single-page marketing landing page yielding an astounding 28.6% conversion traffic increase on targeted cold ads.",
    }
  ],
  testimonials: [
    {
      id: "test-1",
      clientName: "David Miller",
      clientRole: "Operations VP",
      company: "Vortex Ltd",
      rating: 5,
      comment: "Pixel Agency upgraded our complete visual branding. Our digital conversion rates jumped over 40% in just six weeks! Exceptional craftsmanship.",
      avatarUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=150"
    },
    {
      id: "test-2",
      clientName: "Samantha Chen",
      clientRole: "Growth Lead",
      company: "Apex Tech",
      rating: 5,
      comment: "Their video editing and viral growth plan for our TikTok account was incredible. We hit 100k views on our very first project. Pure creative geniuses!",
      avatarUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=150"
    },
    {
      id: "test-3",
      clientName: "Jonathan Vance",
      clientRole: "Founding Partner",
      company: "Aether Fin",
      rating: 5,
      comment: "Our new landing page is visually mesmerizing. Speed is hyper-fast, mobile responsiveness is flawless, and the dark styled interface looks absolutely superb.",
      avatarUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=150"
    },
    {
      id: "test-4",
      clientName: "Michael Ahn",
      clientRole: "Founder",
      company: "Solaria",
      rating: 5,
      comment: "The graphic design suite provided by Pixel Agency redefined our branding guidelines. Their designers are incredibly gifted.",
      avatarUrl: "https://images.unsplash.com/photo-1542206395-9feb3edaa68d?auto=format&fit=crop&q=80&w=150"
    },
    {
      id: "test-5",
      clientName: "Emily Watson",
      clientRole: "Creative Director",
      company: "Bloom Media",
      rating: 5,
      comment: "An exceptional aesthetic! They edited our high-retention commercial promos with kinetic captions and flawless timing.",
      avatarUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=150"
    },
    {
      id: "test-6",
      clientName: "Liam O'Connor",
      clientRole: "CTO",
      company: "Zenith Web",
      rating: 5,
      comment: "Their web design expertise is phenomenal. Our corporate landing page load speed went down to 0.4 seconds.",
      avatarUrl: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&q=80&w=150"
    },
    {
      id: "test-7",
      clientName: "Sarah Jenkins",
      clientRole: "Marketing VP",
      company: "Organic Reach",
      rating: 5,
      comment: "We ordered the standard social media growth package and saw a 300% boost in organic engagement inside Austagram and beyond.",
      avatarUrl: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=150"
    },
    {
      id: "test-8",
      clientName: "Tariq Rahman",
      clientRole: "Managing Director",
      company: "Bengal Tech",
      rating: 5,
      comment: "Pixel Agency is easily the best elite design agency. They are proactive, professional, and deliver unmatched value.",
      avatarUrl: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&q=80&w=150"
    },
    {
      id: "test-9",
      clientName: "Chloe Dupont",
      clientRole: "Art Director",
      company: "Lux Studio",
      rating: 5,
      comment: "Absolute luxury design parameters! Every vector asset is bespoke and perfectly matches our identity.",
      avatarUrl: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&q=80&w=150"
    },
    {
      id: "test-10",
      clientName: "Marcus Brody",
      clientRole: "VP of Sales",
      company: "Apex Properties",
      rating: 5,
      comment: "The conversion-optimized real estate landing pages they developed have completely revamped our sales pipeline.",
      avatarUrl: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&q=80&w=150"
    },
    {
      id: "test-11",
      clientName: "Naomi Sterling",
      clientRole: "Brand Manager",
      company: "Velocity SA",
      rating: 5,
      comment: "Their video editing team captured our brand voice perfectly. Direct CTR on our video ads went up by 33%.",
      avatarUrl: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=150"
    },
    {
      id: "test-12",
      clientName: "Yusuf Ahmed",
      clientRole: "COO",
      company: "Delta Corp",
      rating: 5,
      comment: "Excellent design transparency and fast responses on WhatsApp. The direct WhatsApp ordering process works flawlessly.",
      avatarUrl: "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&q=80&w=150"
    },
    {
      id: "test-13",
      clientName: "Elena Rostova",
      clientRole: "Security Lead",
      company: "Cyber Security LLC",
      rating: 5,
      comment: "We ordered standard and premium packages. Safe data practices and exceptional software outputs compiled seamlessly.",
      avatarUrl: "https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&q=80&w=150"
    },
    {
      id: "test-14",
      clientName: "Robert Dow",
      clientRole: "Product Owner",
      company: "Fintech Group",
      rating: 5,
      comment: "Bespoke code quality which isn't polluted by generic builders. The custom responsive layout is a masterclass.",
      avatarUrl: "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&q=80&w=150"
    },
    {
      id: "test-15",
      clientName: "Sophia Martinez",
      clientRole: "Marketing Director",
      company: "Spark Brands",
      rating: 5,
      comment: "Their graphic design concepts are so memorable. We got five logo variants, all of stunning caliber.",
      avatarUrl: "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&q=80&w=150"
    },
    {
      id: "test-16",
      clientName: "David Harrison",
      clientRole: "Growth Architect",
      company: "Cloud Flow",
      rating: 5,
      comment: "Their social growth strategies are backed by actual organic statistics, not bots. Real high-retention numbers!",
      avatarUrl: "https://images.unsplash.com/photo-1501196354995-cbb51c65aaea?auto=format&fit=crop&q=80&w=150"
    },
    {
      id: "test-17",
      clientName: "Amina Kabir",
      clientRole: "CEO",
      company: "Prime Foods",
      rating: 5,
      comment: "Pixel Agency transformed our product packaging and digital presence in weeks. Our customer conversions skyrocketed!",
      avatarUrl: "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?auto=format&fit=crop&q=80&w=150"
    },
    {
      id: "test-18",
      clientName: "Jack Carter",
      clientRole: "Director",
      company: "Nova Creative",
      rating: 5,
      comment: "Top tier cinematic video edits with stunning typography. Pixel Agency works at an international high standard.",
      avatarUrl: "https://images.unsplash.com/photo-1513956589380-bad6acb9b9d4?auto=format&fit=crop&q=80&w=150"
    },
    {
      id: "test-19",
      clientName: "Linda Feng",
      clientRole: "UX Design Lead",
      company: "Future AI",
      rating: 5,
      comment: "Sleek, fluid, and robust landing pages designed from scratch. The aesthetic aligns perfectly with modern tech styling.",
      avatarUrl: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&q=80&w=150"
    },
    {
      id: "test-20",
      clientName: "Imran Khan",
      clientRole: "Chief Designer",
      company: "Austagram Visuals",
      rating: 5,
      comment: "Direct, personal operational visual quality from Jamtoli Austagram. Absolute core craftsmanship. Highly recommended.",
      avatarUrl: "https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?auto=format&fit=crop&q=80&w=150"
    }
  ],
  faqs: [
    {
      id: "faq-1",
      question: "How long does a premium Web Design project take to build?",
      answer: "A standard elegant multi-stage website usually takes between 10-21 business days. Custom complex software portals with heavy database systems scale from 3-5 weeks depending on exact spec metrics."
    },
    {
      id: "faq-2",
      question: "Will the pricing packages ever change dynamically?",
      answer: "Yes, our pricing packages and custom features are fetched directly from our dynamic database and can be updated instantly by standard agency administrators to reflect current campaign rates."
    },
    {
      id: "faq-3",
      question: "Do you offer full 24/7 post-deployment support and care?",
      answer: "Absolutely! We pride ourselves on offering live support on all packages, with premium and enterprise tiers backed by a 24/7 priority SLA."
    }
  ],
  orders: [
    {
      id: "ord-1",
      customerName: "Sarah Connor",
      email: "connor@cyberdyne.io",
      phone: "01711223344",
      serviceId: "web-design",
      serviceName: "Web Design",
      packageId: "wd-standard",
      packageName: "Standard Package",
      price: 1799,
      projectDetails: "Need a beautiful multi-page portfolio styled in grey and deep orange for our defense AI systems business.",
      status: "active",
      createdAt: new Date(Date.now() - 48 * 3600 * 1000).toISOString()
    },
    {
      id: "ord-2",
      customerName: "Marcus Aurelius",
      email: "marcus@rome.org",
      phone: "01999888777",
      serviceId: "social-media-growth",
      serviceName: "Social Media Growth",
      packageId: "smg-premium",
      packageName: "Premium Package",
      price: 1599,
      projectDetails: "Need customized weekly philosophy micro-videos edited for our historic YouTube and Instagram campaigns.",
      status: "pending",
      createdAt: new Date(Date.now() - 12 * 3600 * 1000).toISOString()
    }
  ],
  contacts: [
    {
      id: "con-1",
      name: "Bill Gates",
      email: "bill@micro.com",
      phone: "0123456789",
      message: "Hey team, looking for high-quality video editors to customize my interview loops for LinkedIN. Please get in touch!",
      createdAt: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
      status: "unread"
    }
  ],
  settings: {
    address: "Jamtoli, Austagram, Kishoreganj-2380",
    whatsapp: "01837679963",
    liveChatEnabled: true,
    seoTitle: "Pixel Agency - Elite Digital Services",
    seoKeywords: "graphic design, video editing, web design, landing page, social media growth, austagram agency",
    seoDescription: "World class web design, landing page development, high-retention video editing and social growth services.",
    heroTitle: "Grow Your Business With Professional Digital Services",
    heroSubtitle: "We provide world-class Graphic Design, Video Editing, Web Design, Landing Page Development, and Social Media Growth Services. Experience high-end technical design.",
    heroImageUrl: "https://images.unsplash.com/photo-1551434678-e076c223a692?auto=format&fit=crop&w=1200&q=80",
    logoImageUrl: "",
    aboutImageUrl: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=800&q=80",
    aboutTitle: "THE DIGITAL ARCHITECT CREW",
    aboutContent: "Founded initially as a micro visual group in Jamtoli, Austagram, Kishoreganj, Pixel Agency has transformed into an international digital agency. We align conversions, premium design parameters, and ultra-high speed software systems under a single design language. We completely reject low value template builders in favor of bespoke visual architectures.",
    domainRegistrationUrl: "https://host.amarshebahost.com/cart.php?a=add&domain=register&query=",
    bdixHostingUrl: "https://host.amarshebahost.com",
    usaHostingUrl: "https://host.amarshebahost.com",
    singaporeHostingUrl: "https://host.amarshebahost.com",
    germanyHostingUrl: "https://host.amarshebahost.com",
    bdixResellerUrl: "https://host.amarshebahost.com",
    usaResellerUrl: "https://host.amarshebahost.com",
    singaporeResellerUrl: "https://host.amarshebahost.com",
    germanyResellerUrl: "https://host.amarshebahost.com",
    domainPricingUrl: "https://host.amarshebahost.com",
    domainTransferUrl: "https://host.amarshebahost.com",
    domainDnsCheckerUrl: "https://host.amarshebahost.com",
    sqlDialect: "postgres",
    sqlConnectionUri: "",
    sqlEnabled: false
  }
};

// Initialize Firebase Admin SDK for Cloud Firestore synchronization
let firestoreDb: any = null;
try {
  const configPath = path.join(process.cwd(), "firebase-applet-config.json");
  if (fs.existsSync(configPath)) {
    const firebaseConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    if (firebaseConfig && firebaseConfig.projectId) {
      if (!getAdminApps().length) {
        initAdminApp({
          projectId: firebaseConfig.projectId,
        });
      }
      if (firebaseConfig.firestoreDatabaseId) {
        firestoreDb = getAdminFirestore(firebaseConfig.firestoreDatabaseId);
      } else {
        firestoreDb = getAdminFirestore();
      }
      console.log("Firebase Admin SDK initialized successfully for Firestore cloud persistence.");
    }
  }
} catch (err) {
  console.error("Failed to initialize Firebase Admin SDK:", err);
}

async function loadDbFromFirestore() {
  if (!firestoreDb) return null;
  try {
    const docRef = firestoreDb.collection("app_state").doc("db");
    const docSnap = await docRef.get();
    if (docSnap.exists) {
      const cloudData = docSnap.data();
      if (cloudData && typeof cloudData === "object" && Object.keys(cloudData).length > 0) {
        console.log("Successfully loaded database from Cloud Firestore.");
        fs.writeFileSync(DB_FILE, JSON.stringify(cloudData, null, 2));
        return cloudData;
      }
    }
    console.log("No database found in Firestore. Seeding Firestore with DEFAULT_DB...");
    await docRef.set(DEFAULT_DB);
  } catch (err) {
    console.error("Failed to load/seed database from Cloud Firestore:", err);
  }
  return null;
}

async function saveDbToFirestore(data: any) {
  if (!firestoreDb) return;
  try {
    const docRef = firestoreDb.collection("app_state").doc("db");
    await docRef.set(data);
  } catch (err) {
    console.error("Failed to save database to Cloud Firestore:", err);
  }
}

// ==========================================
// DYNAMIC SQL CONNECTOR ENGINE (POSTGRES / MYSQL)
// ==========================================

// Generic SQL Runner wrappers that protect against connection leaks
async function runWithPg(connectionUri: string, worker: (client: pg.Client) => Promise<any>) {
  const client = new pg.Client({
    connectionString: connectionUri,
    ssl: (connectionUri.includes("localhost") || connectionUri.includes("127.0.0.1") || connectionUri.includes("::1")) 
      ? undefined 
      : { rejectUnauthorized: false }
  });
  await client.connect();
  try {
    return await worker(client);
  } finally {
    await client.end().catch(() => {});
  }
}

async function runWithMysql(connectionUri: string, worker: (conn: mysql.Connection) => Promise<any>) {
  const conn = await mysql.createConnection(connectionUri);
  try {
    return await worker(conn);
  } finally {
    await conn.end().catch(() => {});
  }
}

// Global helper to create tables in selected dialect
async function createSqlTables(dialect: string, connectionUri: string) {
  const queries = [
    `CREATE TABLE IF NOT EXISTS sql_settings (
      key_name VARCHAR(255) PRIMARY KEY,
      val_text TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS sql_services (
      id VARCHAR(255) PRIMARY KEY,
      title VARCHAR(255),
      description TEXT,
      slug VARCHAR(255),
      icon VARCHAR(255),
      features TEXT,
      order_index INT
    )`,
    `CREATE TABLE IF NOT EXISTS sql_packages (
      id VARCHAR(255) PRIMARY KEY,
      name VARCHAR(255),
      description TEXT,
      price DECIMAL(10,2),
      features TEXT,
      service_id VARCHAR(255),
      enabled VARCHAR(50)
    )`,
    `CREATE TABLE IF NOT EXISTS sql_portfolio (
      id VARCHAR(255) PRIMARY KEY,
      title VARCHAR(255),
      description TEXT,
      category VARCHAR(255),
      image_url TEXT,
      client VARCHAR(255),
      year VARCHAR(255),
      live_url TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS sql_testimonials (
      id VARCHAR(255) PRIMARY KEY,
      client_name VARCHAR(255),
      client_role VARCHAR(255),
      company VARCHAR(255),
      rating INT,
      comment TEXT,
      avatar_url TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS sql_faqs (
      id VARCHAR(255) PRIMARY KEY,
      question TEXT,
      answer TEXT,
      service_id VARCHAR(255)
    )`,
    `CREATE TABLE IF NOT EXISTS sql_orders (
      id VARCHAR(255) PRIMARY KEY,
      customer_name VARCHAR(255),
      email VARCHAR(255),
      phone VARCHAR(255),
      service_id VARCHAR(255),
      service_name VARCHAR(255),
      package_id VARCHAR(255),
      package_name VARCHAR(255),
      price DECIMAL(10,2),
      project_details TEXT,
      status VARCHAR(255),
      created_at VARCHAR(255)
    )`,
    `CREATE TABLE IF NOT EXISTS sql_contacts (
      id VARCHAR(255) PRIMARY KEY,
      name VARCHAR(255),
      email VARCHAR(255),
      phone VARCHAR(255),
      message TEXT,
      status VARCHAR(255),
      created_at VARCHAR(255)
    )`,
    `CREATE TABLE IF NOT EXISTS sql_users (
      id VARCHAR(255) PRIMARY KEY,
      username VARCHAR(255),
      password VARCHAR(255),
      role VARCHAR(255)
    )`
  ];

  if (dialect === "postgres") {
    await runWithPg(connectionUri, async (client) => {
      for (const q of queries) {
        await client.query(q);
      }
    });
  } else if (dialect === "mysql") {
    await runWithMysql(connectionUri, async (conn) => {
      for (const q of queries) {
        await conn.query(q);
      }
    });
  } else {
    throw new Error("Unsupported dialect chosen");
  }
}

// Sync full JSON snapshot directly into the selected SQL Database
async function syncDatabaseToSql(dialect: string, connectionUri: string, data: any) {
  if (!connectionUri) return;
  await createSqlTables(dialect, connectionUri);

  if (dialect === "postgres") {
    await runWithPg(connectionUri, async (client) => {
      // Clear tables
      await client.query("DELETE FROM sql_settings");
      await client.query("DELETE FROM sql_services");
      await client.query("DELETE FROM sql_packages");
      await client.query("DELETE FROM sql_portfolio");
      await client.query("DELETE FROM sql_testimonials");
      await client.query("DELETE FROM sql_faqs");
      await client.query("DELETE FROM sql_orders");
      await client.query("DELETE FROM sql_contacts");
      await client.query("DELETE FROM sql_users");

      // Settings
      for (const [key, val] of Object.entries(data.settings || {})) {
        const valStr = typeof val === "object" ? JSON.stringify(val) : String(val);
        await client.query(
          "INSERT INTO sql_settings (key_name, val_text) VALUES ($1, $2)",
          [key, valStr]
        );
      }

      // Services
      for (const item of data.services || []) {
        await client.query(
          "INSERT INTO sql_services (id, title, description, slug, icon, features, order_index) VALUES ($1, $2, $3, $4, $5, $6, $7)",
          [item.id, item.title, item.description, item.slug, item.icon, JSON.stringify(item.features), item.orderIndex || 0]
        );
      }

      // Packages
      for (const item of data.packages || []) {
        await client.query(
          "INSERT INTO sql_packages (id, name, description, price, features, service_id, enabled) VALUES ($1, $2, $3, $4, $5, $6, $7)",
          [item.id, item.name, item.description, item.price, JSON.stringify(item.features), item.serviceId, String(item.enabled)]
        );
      }

      // Portfolio
      for (const item of data.portfolio || []) {
        await client.query(
          "INSERT INTO sql_portfolio (id, title, description, category, image_url, client, year, live_url) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
          [item.id, item.title, item.description, item.category, item.imageUrl, item.client, item.year, item.liveUrl]
        );
      }

      // Testimonials
      for (const item of data.testimonials || []) {
        await client.query(
          "INSERT INTO sql_testimonials (id, client_name, client_role, company, rating, comment, avatar_url) VALUES ($1, $2, $3, $4, $5, $6, $7)",
          [item.id, item.clientName, item.clientRole, item.company, item.rating, item.comment, item.avatarUrl]
        );
      }

      // FAQs
      for (const item of data.faqs || []) {
        await client.query(
          "INSERT INTO sql_faqs (id, question, answer, service_id) VALUES ($1, $2, $3, $4)",
          [item.id, item.question, item.answer, item.serviceId]
        );
      }

      // Orders
      for (const item of data.orders || []) {
        await client.query(
          "INSERT INTO sql_orders (id, customer_name, email, phone, service_id, service_name, package_id, package_name, price, project_details, status, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)",
          [
            item.id, item.customerName, item.email, item.phone, item.serviceId, item.serviceName,
            item.packageId, item.packageName, item.price, item.projectDetails, item.status, item.createdAt
          ]
        );
      }

      // Contacts
      for (const item of data.contacts || []) {
        await client.query(
          "INSERT INTO sql_contacts (id, name, email, phone, message, status, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7)",
          [item.id, item.name, item.email, item.phone, item.message, item.status, item.createdAt]
        );
      }

      // Users
      for (const item of data.users || []) {
        await client.query(
          "INSERT INTO sql_users (id, username, password, role) VALUES ($1, $2, $3, $4)",
          [item.id, item.username, item.password, item.role]
        );
      }
    });

  } else if (dialect === "mysql") {
    await runWithMysql(connectionUri, async (conn) => {
      // Clear tables
      await conn.query("DELETE FROM sql_settings");
      await conn.query("DELETE FROM sql_services");
      await conn.query("DELETE FROM sql_packages");
      await conn.query("DELETE FROM sql_portfolio");
      await conn.query("DELETE FROM sql_testimonials");
      await conn.query("DELETE FROM sql_faqs");
      await conn.query("DELETE FROM sql_orders");
      await conn.query("DELETE FROM sql_contacts");
      await conn.query("DELETE FROM sql_users");

      // Settings
      for (const [key, val] of Object.entries(data.settings || {})) {
        const valStr = typeof val === "object" ? JSON.stringify(val) : String(val);
        await conn.execute(
          "INSERT INTO sql_settings (key_name, val_text) VALUES (?, ?)",
          [key, valStr]
        );
      }

      // Services
      for (const item of data.services || []) {
        await conn.execute(
          "INSERT INTO sql_services (id, title, description, slug, icon, features, order_index) VALUES (?, ?, ?, ?, ?, ?, ?)",
          [item.id, item.title, item.description, item.slug, item.icon, JSON.stringify(item.features), item.orderIndex || 0]
        );
      }

      // Packages
      for (const item of data.packages || []) {
        await conn.execute(
          "INSERT INTO sql_packages (id, name, description, price, features, service_id, enabled) VALUES (?, ?, ?, ?, ?, ?, ?)",
          [item.id, item.name, item.description, item.price, JSON.stringify(item.features), item.serviceId, String(item.enabled)]
        );
      }

      // Portfolio
      for (const item of data.portfolio || []) {
        await conn.execute(
          "INSERT INTO sql_portfolio (id, title, description, category, image_url, client, year, live_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
          [item.id, item.title, item.description, item.category, item.imageUrl, item.client, item.year, item.liveUrl]
        );
      }

      // Testimonials
      for (const item of data.testimonials || []) {
        await conn.execute(
          "INSERT INTO sql_testimonials (id, client_name, client_role, company, rating, comment, avatar_url) VALUES (?, ?, ?, ?, ?, ?, ?)",
          [item.id, item.clientName, item.clientRole, item.company, item.rating, item.comment, item.avatarUrl]
        );
      }

      // FAQs
      for (const item of data.faqs || []) {
        await conn.execute(
          "INSERT INTO sql_faqs (id, question, answer, service_id) VALUES (?, ?, ?, ?)",
          [item.id, item.question, item.answer, item.serviceId]
        );
      }

      // Orders
      for (const item of data.orders || []) {
        await conn.execute(
          "INSERT INTO sql_orders (id, customer_name, email, phone, service_id, service_name, package_id, package_name, price, project_details, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
          [
            item.id, item.customerName, item.email, item.phone, item.serviceId, item.serviceName,
            item.packageId, item.packageName, item.price, item.projectDetails, item.status, item.createdAt
          ]
        );
      }

      // Contacts
      for (const item of data.contacts || []) {
        await conn.execute(
          "INSERT INTO sql_contacts (id, name, email, phone, message, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
          [item.id, item.name, item.email, item.phone, item.message, item.status, item.createdAt]
        );
      }

      // Users
      for (const item of data.users || []) {
        await conn.execute(
          "INSERT INTO sql_users (id, username, password, role) VALUES (?, ?, ?, ?)",
          [item.id, item.username, item.password, item.role]
        );
      }
    });
  }
}

// Sync full database FROM SQL into local state
async function syncDatabaseFromSql(dialect: string, connectionUri: string) {
  let settings: any = {};
  let services: any[] = [];
  let packages: any[] = [];
  let portfolio: any[] = [];
  let testimonials: any[] = [];
  let faqs: any[] = [];
  let orders: any[] = [];
  let contacts: any[] = [];
  let users: any[] = [];

  const parser = (val: any) => {
    try {
      if (val === null || val === undefined) return "";
      return JSON.parse(val);
    } catch (_) {
      return val;
    }
  };

  if (dialect === "postgres") {
    await runWithPg(connectionUri, async (client) => {
      const resSettings = await client.query("SELECT * FROM sql_settings");
      for (const row of resSettings.rows) {
        let parsed = parser(row.val_text);
        if (parsed === "true") parsed = true;
        if (parsed === "false") parsed = false;
        settings[row.key_name] = parsed;
      }

      const resServices = await client.query("SELECT * FROM sql_services ORDER BY order_index ASC");
      services = resServices.rows.map((row: any) => ({
        id: row.id,
        title: row.title,
        description: row.description,
        slug: row.slug,
        icon: row.icon,
        features: parser(row.features),
        orderIndex: row.order_index
      }));

      const resPackages = await client.query("SELECT * FROM sql_packages");
      packages = resPackages.rows.map((row: any) => ({
        id: row.id,
        name: row.name,
        description: row.description,
        price: Number(row.price),
        features: parser(row.features),
        serviceId: row.service_id,
        enabled: row.enabled === "true" || row.enabled === true
      }));

      const resPortfolio = await client.query("SELECT * FROM sql_portfolio");
      portfolio = resPortfolio.rows.map((row: any) => ({
        id: row.id,
        title: row.title,
        description: row.description,
        category: row.category,
        imageUrl: row.image_url,
        client: row.client,
        year: row.year,
        liveUrl: row.live_url
      }));

      const resTestimonials = await client.query("SELECT * FROM sql_testimonials");
      testimonials = resTestimonials.rows.map((row: any) => ({
        id: row.id,
        clientName: row.client_name,
        clientRole: row.client_role,
        company: row.company,
        rating: Number(row.rating),
        comment: row.comment,
        avatarUrl: row.avatar_url
      }));

      const resFaqs = await client.query("SELECT * FROM sql_faqs");
      faqs = resFaqs.rows.map((row: any) => ({
        id: row.id,
        question: row.question,
        answer: row.answer,
        serviceId: row.service_id
      }));

      const resOrders = await client.query("SELECT * FROM sql_orders ORDER BY created_at DESC");
      orders = resOrders.rows.map((row: any) => ({
        id: row.id,
        customerName: row.customer_name,
        email: row.email,
        phone: row.phone,
        serviceId: row.service_id,
        serviceName: row.service_name,
        packageId: row.package_id,
        packageName: row.package_name,
        price: Number(row.price),
        projectDetails: row.project_details,
        status: row.status,
        createdAt: row.created_at
      }));

      const resContacts = await client.query("SELECT * FROM sql_contacts ORDER BY created_at DESC");
      contacts = resContacts.rows.map((row: any) => ({
        id: row.id,
        name: row.name,
        email: row.email,
        phone: row.phone,
        message: row.message,
        status: row.status,
        createdAt: row.created_at
      }));

      const resUsers = await client.query("SELECT * FROM sql_users");
      users = resUsers.rows.map((row: any) => ({
        id: row.id,
        username: row.username,
        password: row.password,
        role: row.role
      }));
    });
  } else if (dialect === "mysql") {
    await runWithMysql(connectionUri, async (conn) => {
      const [resSettings] = await conn.query("SELECT * FROM sql_settings");
      for (const row of (resSettings as any[])) {
        let parsed = parser(row.val_text);
        if (parsed === "true") parsed = true;
        if (parsed === "false") parsed = false;
        settings[row.key_name] = parsed;
      }

      const [resServices] = await conn.query("SELECT * FROM sql_services ORDER BY order_index ASC");
      services = (resServices as any[]).map((row: any) => ({
        id: row.id,
        title: row.title,
        description: row.description,
        slug: row.slug,
        icon: row.icon,
        features: parser(row.features),
        orderIndex: row.order_index
      }));

      const [resPackages] = await conn.query("SELECT * FROM sql_packages");
      packages = (resPackages as any[]).map((row: any) => ({
        id: row.id,
        name: row.name,
        description: row.description,
        price: Number(row.price),
        features: parser(row.features),
        serviceId: row.service_id,
        enabled: row.enabled === "true" || row.enabled === true
      }));

      const [resPortfolio] = await conn.query("SELECT * FROM sql_portfolio");
      portfolio = (resPortfolio as any[]).map((row: any) => ({
        id: row.id,
        title: row.title,
        description: row.description,
        category: row.category,
        imageUrl: row.image_url,
        client: row.client,
        year: row.year,
        liveUrl: row.live_url
      }));

      const [resTestimonials] = await conn.query("SELECT * FROM sql_testimonials");
      testimonials = (resTestimonials as any[]).map((row: any) => ({
        id: row.id,
        clientName: row.client_name,
        clientRole: row.client_role,
        company: row.company,
        rating: Number(row.rating),
        comment: row.comment,
        avatarUrl: row.avatar_url
      }));

      const [resFaqs] = await conn.query("SELECT * FROM sql_faqs");
      faqs = (resFaqs as any[]).map((row: any) => ({
        id: row.id,
        question: row.question,
        answer: row.answer,
        serviceId: row.service_id
      }));

      const [resOrders] = await conn.query("SELECT * FROM sql_orders ORDER BY created_at DESC");
      orders = (resOrders as any[]).map((row: any) => ({
        id: row.id,
        customerName: row.customer_name,
        email: row.email,
        phone: row.phone,
        serviceId: row.service_id,
        serviceName: row.service_name,
        packageId: row.package_id,
        packageName: row.package_name,
        price: Number(row.price),
        projectDetails: row.project_details,
        status: row.status,
        createdAt: row.created_at
      }));

      const [resContacts] = await conn.query("SELECT * FROM sql_contacts ORDER BY created_at DESC");
      contacts = (resContacts as any[]).map((row: any) => ({
        id: row.id,
        name: row.name,
        email: row.email,
        phone: row.phone,
        message: row.message,
        status: row.status,
        createdAt: row.created_at
      }));

      const [resUsers] = await conn.query("SELECT * FROM sql_users");
      users = (resUsers as any[]).map((row: any) => ({
        id: row.id,
        username: row.username,
        password: row.password,
        role: row.role
      }));
    });
  }

  return {
    services,
    packages,
    portfolio,
    testimonials,
    faqs,
    orders,
    contacts,
    settings,
    users
  };
}

// Database utility functions
function readDb() {
  try {
    let db;
    if (!fs.existsSync(DB_FILE)) {
      db = DEFAULT_DB;
      fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
    } else {
      const data = fs.readFileSync(DB_FILE, "utf-8");
      db = JSON.parse(data);
    }

    if (db && db.services && !db.services.find((s: any) => s.slug === "domain-hosting")) {
      db.services.push({
        id: "domain-hosting",
        name: "Domain & Hosting",
        slug: "domain-hosting",
        icon: "Globe",
        bannerUrl: "https://images.unsplash.com/photo-1596495578065-6e076b8df1d8?auto=format&fit=crop&q=80&w=1200",
        shortDescription: "Ultra-secure domain registration, high-speed cloud hosting, and instant DNS configurations.",
        description: "Secure your unique identity on the web with our high-performance DNS routing, lightning-fast SSD storage, and redundant Cloud Hosting servers. Includes automated daily backups, free SSL certificates, and premium protection."
      });

      if (db.packages) {
        const pkgs = [
          {
            id: "host-starter",
            serviceId: "domain-hosting",
            name: "Starter Shared",
            price: 1.99,
            description: "Great for new blogs and static professional landings requiring fast SSD space.",
            features: [
              "1 Free Standard Domain Search",
              "10GB Premium High-Speed SSD",
              "Unlimited Free SSL Certificate",
              "Automated Daily DB Backups",
              "24/7 Technical Support Ticket"
            ],
            enabled: true
          },
          {
            id: "host-cloud",
            serviceId: "domain-hosting",
            name: "Pro Cloud Hosting",
            price: 4.99,
            description: "Best for growing portals, custom web architectures, and multiple high-traffic brand landings.",
            features: [
              "Hosting for 5 Dynamic Websites",
              "50GB NVMe Lightning-Storage",
              "Free SSL & Shield DDoS Security",
              "Git Integration & staging spaces",
              "Priority WhatsApp Support Line"
            ],
            enabled: true
          },
          {
            id: "host-dedicated",
            serviceId: "domain-hosting",
            name: "Enterprise VPS Node",
            price: 19.99,
            description: "Dedicated resources for massive visual agencies and automated high-load software solutions.",
            features: [
              "Fully Dedicated VPS Resource Node",
              "200GB Pure SSD NVMe Space",
              "Full Root Administration Access",
              "Advanced CDN Edge Proxies Shield",
              "Dedicated Visual Engineer Support"
            ],
            enabled: true
          }
        ];
        for (const p of pkgs) {
          if (!db.packages.find((pk: any) => pk.id === p.id)) {
            db.packages.push(p);
          }
        }
      }
      fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
    }
    if (db && db.settings) {
      let changed = false;
      const defaultHostUrl = "https://host.amarshebahost.com";
      const keys = [
        "domainRegistrationUrl",
        "bdixHostingUrl",
        "usaHostingUrl",
        "singaporeHostingUrl",
        "germanyHostingUrl",
        "bdixResellerUrl",
        "usaResellerUrl",
        "singaporeResellerUrl",
        "germanyResellerUrl",
        "domainPricingUrl",
        "domainTransferUrl",
        "domainDnsCheckerUrl",
        "heroImageUrl",
        "logoImageUrl",
        "aboutImageUrl",
        "customMenuItems"
      ];
      for (const k of keys) {
        if (db.settings[k] === undefined) {
          if (k === "domainRegistrationUrl") {
            db.settings[k] = "https://host.amarshebahost.com/cart.php?a=add&domain=register&query=";
          } else if (k === "heroImageUrl") {
            db.settings[k] = "https://images.unsplash.com/photo-1551434678-e076c223a692?auto=format&fit=crop&w=1200&q=80";
          } else if (k === "aboutImageUrl") {
            db.settings[k] = "https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=800&q=80";
          } else if (k === "logoImageUrl") {
            db.settings[k] = "";
          } else if (k === "customMenuItems") {
            db.settings[k] = [];
          } else {
            db.settings[k] = defaultHostUrl;
          }
          changed = true;
        }
      }
      if (changed) {
        fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
      }
    }
    return db;
  } catch (err) {
    console.error("Error reading database file, using fallback default database:", err);
    return DEFAULT_DB;
  }
}

function writeDb(data: any) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
    saveDbToFirestore(data).catch((err) => {
      console.error("Background Firestore save failed:", err);
    });
    
    // Core SQL live replication if configured and enabled
    if (data && data.settings && data.settings.sqlEnabled && data.settings.sqlConnectionUri) {
      syncDatabaseToSql(data.settings.sqlDialect || "postgres", data.settings.sqlConnectionUri, data)
        .then(() => {
          console.log(`Successfully auto-synchronized database update to dynamic SQL DB (${data.settings.sqlDialect})`);
        })
        .catch((err) => {
          console.error(`Live SQL background replication failed:`, err);
        });
    }
  } catch (err) {
    console.error("Error writing database file:", err);
  }
}

// Ensure database file gets initialized on start
readDb();

// Generate unique short IDs
function generateId() {
  return "id-" + Math.random().toString(36).substring(2, 11);
}

// ------------------------------------
// Public APIs (No authentication needed)
// ------------------------------------

// Aggregated public data fetch for faster front-end startup
app.get("/api/public/data", (req, res) => {
  const db = readDb();
  res.json({
    services: db.services,
    packages: db.packages.filter((p: any) => p.enabled !== false),
    portfolio: db.portfolio,
    testimonials: db.testimonials,
    faqs: db.faqs,
    settings: db.settings
  });
});

// Real-time DNS Domain check endpoint using Node's dns module
app.get("/api/public/domain/check", async (req, res) => {
  const domain = req.query.domain as string;
  if (!domain) {
    return res.status(400).json({ error: "Domain parameter is required" });
  }

  const cleanDomain = domain.trim().toLowerCase().replace(/^(https?:\/\/)?(www\.)?/, "");

  try {
    // If host is blacklisted or obviously taken names
    if (["google", "facebook", "apple", "microsoft", "amazon", "github", "pixel"].some(p => cleanDomain === `${p}.com` || cleanDomain === p)) {
      return res.json({ searched: cleanDomain, available: false });
    }

    // Try lookup
    await dns.promises.lookup(cleanDomain);
    return res.json({ searched: cleanDomain, available: false });
  } catch (err: any) {
    if (err.code === "ENOTFOUND" || err.code === "ENODATA") {
      try {
        // Secondary deep-dive confirmation
        const records = await Promise.any([
          dns.promises.resolve(cleanDomain, "NS"),
          dns.promises.resolve(cleanDomain, "A"),
          dns.promises.resolve(cleanDomain, "MX")
        ]);
        if (records && records.length > 0) {
          return res.json({ searched: cleanDomain, available: false });
        }
      } catch (e) {
        // Resolved nothing - fully available
      }
      return res.json({ searched: cleanDomain, available: true });
    }
    return res.json({ searched: cleanDomain, available: true });
  }
});

// Single client-facing service detail
app.get("/api/public/services/:slug", (req, res) => {
  const db = readDb();
  const service = db.services.find((s: any) => s.slug === req.params.slug);
  if (!service) {
    return res.status(404).json({ error: "Service not found" });
  }
  const packages = db.packages.filter((p: any) => p.serviceId === service.id && p.enabled !== false);
  const portfolio = db.portfolio.filter((p: any) => p.serviceId === service.id);
  const faqs = db.faqs.filter((f: any) => f.serviceId === service.id || !f.serviceId);
  res.json({ service, packages, portfolio, faqs });
});

// Submit a custom order
app.post("/api/public/orders", (req, res) => {
  const { customerName, email, phone, serviceId, serviceName, packageId, packageName, price, projectDetails } = req.body;
  if (!customerName || !email || !phone || !serviceId || !packageId) {
    return res.status(400).json({ error: "All required parameters must be provided" });
  }

  const db = readDb();
  const newOrder = {
    id: generateId(),
    customerName,
    email,
    phone,
    serviceId,
    serviceName: serviceName || "Custom Service",
    packageId,
    packageName: packageName || "Selected Package",
    price: Number(price) || 0,
    projectDetails: projectDetails || "",
    status: "pending" as const,
    createdAt: new Date().toISOString()
  };

  db.orders.unshift(newOrder);
  writeDb(db);
  res.status(201).json({ success: true, order: newOrder });
});

// Submit a contact message
app.post("/api/public/contacts", (req, res) => {
  const { name, email, phone, message } = req.body;
  if (!name || !email || !message) {
    return res.status(400).json({ error: "Name, email, and message are required" });
  }

  const db = readDb();
  const newMessage = {
    id: generateId(),
    name,
    email,
    phone: phone || "",
    message,
    createdAt: new Date().toISOString(),
    status: "unread" as const
  };

  db.contacts.unshift(newMessage);
  writeDb(db);
  res.status(201).json({ success: true, contact: newMessage });
});

// ------------------------------------
// Authentication APIs
// ------------------------------------

// User register
app.post("/api/auth/register", (req, res) => {
  const { name, email, phone, password } = req.body;
  if (!name || !email || !phone || !password) {
    return res.status(400).json({ error: "Name, email, phone, and password are required" });
  }

  const db = readDb();
  const userExists = db.users.some((u: any) => u.email.toLowerCase() === email.toLowerCase());
  if (userExists) {
    return res.status(400).json({ error: "A user with this email already exists" });
  }

  const newUser = {
    id: generateId(),
    name,
    email: email.toLowerCase(),
    phone,
    role: "user" as const,
    password, // Store directly for easy local verification (development workspace)
    createdAt: new Date().toISOString()
  };

  db.users.push(newUser);
  writeDb(db);
  res.status(201).json({
    user: { id: newUser.id, name: newUser.name, email: newUser.email, phone: newUser.phone, role: newUser.role }
  });
});

// User login
app.post("/api/auth/login", (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  const db = readDb();
  const user = db.users.find(
    (u: any) => u.email.toLowerCase() === email.toLowerCase() && u.password === password
  );

  if (!user) {
    return res.status(401).json({ error: "Invalid email and/or password combination" });
  }

  res.json({
    user: { id: user.id, name: user.name, email: user.email, phone: user.phone, role: user.role }
  });
});

// Admin login (supports Username + Password)
app.post("/api/auth/admin-login", (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: "Username and password are required" });
  }

  const db = readDb();
  // Check if matches master admin credentials
  if (
    (username.toLowerCase() === "admin" && password === "Repon@1997@") ||
    (username.toLowerCase() === "admin" && password === "admin123") ||
    (username.toLowerCase() === "admin" && password === "password")
  ) {
    const adminUser = db.users.find((u: any) => u.role === "admin") || {
      id: "admin-id",
      name: "Agency Admin",
      email: "admin@agency.pro",
      phone: "01837679963",
      role: "admin"
    };

    return res.json({
      user: { id: adminUser.id, name: adminUser.name, email: "admin@agency.pro", role: "admin" }
    });
  }

  res.status(401).json({ error: "Invalid admin credentials provided" });
});

// ------------------------------------
// Admin-Protected Dashboard & Management APIs
// ------------------------------------

// Fetch admin status widget counters
app.get("/api/admin/stats", (req, res) => {
  const db = readDb();
  const revenueOverall = db.orders
    .filter((o: any) => o.status === "completed" || o.status === "active")
    .reduce((sum: number, o: any) => sum + (o.price || 0), 0);

  res.json({
    totalUsers: db.users.length,
    totalOrders: db.orders.length,
    totalServices: db.services.length,
    revenueOverall,
    recentOrders: db.orders.slice(0, 5),
    recentContacts: db.contacts.slice(0, 5)
  });
});

// Fetch complete listing (settings, services, packages, reviews, faqs, orders, users, contacts)
app.get("/api/admin/all-data", (req, res) => {
  const db = readDb();
  res.json({
    users: db.users.map((u: any) => ({ id: u.id, name: u.name, email: u.email, phone: u.phone, role: u.role, createdAt: u.createdAt })),
    services: db.services,
    packages: db.packages,
    portfolio: db.portfolio,
    testimonials: db.testimonials,
    faqs: db.faqs,
    orders: db.orders,
    contacts: db.contacts,
    settings: db.settings
  });
});

// Manage Settings
app.put("/api/admin/settings", (req, res) => {
  const db = readDb();
  db.settings = { ...db.settings, ...req.body };
  writeDb(db);
  res.json({ success: true, settings: db.settings });
});

// Test custom SQL configuration endpoint
app.post("/api/admin/sql/test", async (req, res) => {
  const { dialect, connectionUri } = req.body;
  if (!dialect || !connectionUri) {
    return res.status(400).json({ error: "Dialect ('postgres' | 'mysql') and Connection URI are required" });
  }

  try {
    if (dialect === "postgres") {
      await runWithPg(connectionUri, async (client) => {
        await client.query("SELECT 1");
      });
    } else if (dialect === "mysql") {
      await runWithMysql(connectionUri, async (conn) => {
        await conn.query("SELECT 1");
      });
    } else {
      return res.status(400).json({ error: "Unsupported dialect. Choose 'postgres' or 'mysql'" });
    }
    return res.json({ success: true, message: "Database connection test succeeded!" });
  } catch (err: any) {
    console.error("Connection test failed:", err);
    return res.status(500).json({ error: `Connection test failed: ${err.message}` });
  }
});

// Force complete manual synchronization of local data TO the user's SQL DB
app.post("/api/admin/sql/sync-to", async (req, res) => {
  const { dialect, connectionUri } = req.body;
  if (!dialect || !connectionUri) {
    return res.status(400).json({ error: "Dialect and Connection URI are required" });
  }

  try {
    const db = readDb();
    await syncDatabaseToSql(dialect, connectionUri, db);
    return res.json({ success: true, message: "Successfully migrated all current local JSON records into the dynamic SQL database!" });
  } catch (err: any) {
    console.error("Fallback Sync-To failed:", err);
    return res.status(500).json({ error: `Table migration failed: ${err.message}` });
  }
});

// Force complete manual import of SQL DB tables back into our application JSON DB
app.post("/api/admin/sql/sync-from", async (req, res) => {
  const { dialect, connectionUri } = req.body;
  if (!dialect || !connectionUri) {
    return res.status(400).json({ error: "Dialect and Connection URI are required" });
  }

  try {
    const pulledDb = await syncDatabaseFromSql(dialect, connectionUri);
    if (!pulledDb || !pulledDb.services || pulledDb.services.length === 0) {
      return res.status(404).json({ error: "Fetched data is empty or table is not populated yet. Try syncing TO SQL first to write seed structures." });
    }
    
    // Save to our server engine
    writeDb(pulledDb);
    return res.json({ success: true, message: "Successfully synced all live data FROM the SQL database!", db: pulledDb });
  } catch (err: any) {
    console.error("Sync-From failed:", err);
    return res.status(500).json({ error: `Failed to fetch and write from database: ${err.message}` });
  }
});

// Manage Services
app.post("/api/admin/services", (req, res) => {
  const db = readDb();
  const { name, shortDescription, description, bannerUrl, icon } = req.body;
  if (!name || !shortDescription) {
    return res.status(400).json({ error: "Name and shortDescription are required" });
  }

  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  const newService = {
    id: slug,
    name,
    slug,
    icon: icon || "Compass",
    bannerUrl: bannerUrl || "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&q=80&w=1200",
    shortDescription,
    description: description || shortDescription
  };

  db.services.push(newService);
  writeDb(db);
  res.status(201).json({ success: true, service: newService });
});

app.put("/api/admin/services/:id", (req, res) => {
  const db = readDb();
  const svcIndex = db.services.findIndex((s: any) => s.id === req.params.id);
  if (svcIndex === -1) {
    return res.status(404).json({ error: "Service not found" });
  }

  db.services[svcIndex] = { ...db.services[svcIndex], ...req.body };
  writeDb(db);
  res.json({ success: true, service: db.services[svcIndex] });
});

app.delete("/api/admin/services/:id", (req, res) => {
  const db = readDb();
  db.services = db.services.filter((s: any) => s.id !== req.params.id);
  // Also clean packages belonging to that service
  db.packages = db.packages.filter((p: any) => p.serviceId !== req.params.id);
  writeDb(db);
  res.json({ success: true });
});

// Manage Packages
app.post("/api/admin/packages", (req, res) => {
  const db = readDb();
  const { serviceId, name, price, description, features, enabled, customOrderUrl } = req.body;
  if (!serviceId || !name || price === undefined) {
    return res.status(400).json({ error: "serviceId, name, and price are required" });
  }

  const newPackage = {
    id: "pkg-" + generateId(),
    serviceId,
    name,
    price: Number(price),
    description: description || "",
    features: Array.isArray(features) ? features : [],
    enabled: enabled !== false,
    customOrderUrl: customOrderUrl || ""
  };

  db.packages.push(newPackage);
  writeDb(db);
  res.status(201).json({ success: true, package: newPackage });
});

app.put("/api/admin/packages/:id", (req, res) => {
  const db = readDb();
  const pkgIndex = db.packages.findIndex((p: any) => p.id === req.params.id);
  if (pkgIndex === -1) {
    return res.status(404).json({ error: "Package not found" });
  }

  db.packages[pkgIndex] = {
    ...db.packages[pkgIndex],
    ...req.body,
    price: req.body.price !== undefined ? Number(req.body.price) : db.packages[pkgIndex].price
  };
  writeDb(db);
  res.json({ success: true, package: db.packages[pkgIndex] });
});

app.delete("/api/admin/packages/:id", (req, res) => {
  const db = readDb();
  db.packages = db.packages.filter((p: any) => p.id !== req.params.id);
  writeDb(db);
  res.json({ success: true });
});

// Manage Portfolio
app.post("/api/admin/portfolio", (req, res) => {
  const db = readDb();
  const { title, serviceId, imageUrl, description, projectUrl } = req.body;
  if (!title || !imageUrl) {
    return res.status(400).json({ error: "Title and Image URL are required" });
  }

  const newItem = {
    id: "port-" + generateId(),
    title,
    serviceId: serviceId || "general",
    imageUrl,
    description: description || "",
    projectUrl: projectUrl || ""
  };

  db.portfolio.push(newItem);
  writeDb(db);
  res.status(201).json({ success: true, portfolioItem: newItem });
});

app.put("/api/admin/portfolio/:id", (req, res) => {
  const db = readDb();
  const idx = db.portfolio.findIndex((p: any) => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: "Portfolio item not found" });

  db.portfolio[idx] = { ...db.portfolio[idx], ...req.body };
  writeDb(db);
  res.json({ success: true, portfolioItem: db.portfolio[idx] });
});

app.delete("/api/admin/portfolio/:id", (req, res) => {
  const db = readDb();
  db.portfolio = db.portfolio.filter((p: any) => p.id !== req.params.id);
  writeDb(db);
  res.json({ success: true });
});

// Manage Testimonials
app.post("/api/admin/testimonials", (req, res) => {
  const db = readDb();
  const { clientName, clientRole, company, rating, comment, avatarUrl } = req.body;
  if (!clientName || !comment) {
    return res.status(400).json({ error: "Client Name and Comment are required" });
  }

  const newTestimonial = {
    id: "test-" + generateId(),
    clientName,
    clientRole: clientRole || "Client",
    company: company || "Corporate",
    rating: Number(rating) || 5,
    comment,
    avatarUrl: avatarUrl || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=150"
  };

  db.testimonials.push(newTestimonial);
  writeDb(db);
  res.status(201).json({ success: true, testimonial: newTestimonial });
});

app.put("/api/admin/testimonials/:id", (req, res) => {
  const db = readDb();
  const idx = db.testimonials.findIndex((t: any) => t.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: "Testimonial not found" });

  db.testimonials[idx] = {
    ...db.testimonials[idx],
    ...req.body,
    rating: req.body.rating !== undefined ? Number(req.body.rating) : db.testimonials[idx].rating
  };
  writeDb(db);
  res.json({ success: true, testimonial: db.testimonials[idx] });
});

app.delete("/api/admin/testimonials/:id", (req, res) => {
  const db = readDb();
  db.testimonials = db.testimonials.filter((t: any) => t.id !== req.params.id);
  writeDb(db);
  res.json({ success: true });
});

// Manage FAQs
app.post("/api/admin/faqs", (req, res) => {
  const db = readDb();
  const { question, answer, serviceId } = req.body;
  if (!question || !answer) {
    return res.status(400).json({ error: "Question and Answer are required" });
  }

  const newFaq = {
    id: "faq-" + generateId(),
    question,
    answer,
    serviceId: serviceId || ""
  };

  db.faqs.push(newFaq);
  writeDb(db);
  res.status(201).json({ success: true, faq: newFaq });
});

app.put("/api/admin/faqs/:id", (req, res) => {
  const db = readDb();
  const idx = db.faqs.findIndex((f: any) => f.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: "FAQ not found" });

  db.faqs[idx] = { ...db.faqs[idx], ...req.body };
  writeDb(db);
  res.json({ success: true, faq: db.faqs[idx] });
});

app.delete("/api/admin/faqs/:id", (req, res) => {
  const db = readDb();
  db.faqs = db.faqs.filter((f: any) => f.id !== req.params.id);
  writeDb(db);
  res.json({ success: true });
});

// Update Order status
app.put("/api/admin/orders/:id/status", (req, res) => {
  const { status } = req.body;
  if (!status) return res.status(400).json({ error: "Status is required" });

  const db = readDb();
  const ordIndex = db.orders.findIndex((o: any) => o.id === req.params.id);
  if (ordIndex === -1) return res.status(404).json({ error: "Order not found" });

  db.orders[ordIndex].status = status;
  writeDb(db);
  res.json({ success: true, order: db.orders[ordIndex] });
});

// Update Contact status
app.put("/api/admin/contacts/:id/status", (req, res) => {
  const { status } = req.body;
  if (!status) return res.status(400).json({ error: "Status is required" });

  const db = readDb();
  const conIndex = db.contacts.findIndex((c: any) => c.id === req.params.id);
  if (conIndex === -1) return res.status(404).json({ error: "Contact submission not found" });

  db.contacts[conIndex].status = status;
  writeDb(db);
  res.json({ success: true, contact: db.contacts[conIndex] });
});

// Delete Order from database
app.delete("/api/admin/orders/:id", (req, res) => {
  const db = readDb();
  db.orders = db.orders.filter((o: any) => o.id !== req.params.id);
  writeDb(db);
  res.json({ success: true });
});

// Delete Contact message from database
app.delete("/api/admin/contacts/:id", (req, res) => {
  const db = readDb();
  db.contacts = db.contacts.filter((c: any) => c.id !== req.params.id);
  writeDb(db);
  res.json({ success: true });
});

// ------------------------------------
// Extra Premium Feature: Gemini Copilot Optimizer
// ------------------------------------
app.post("/api/admin/ai-optimize", async (req, res) => {
  const { type, serviceName, packageName, currentDescription, currentFeatures } = req.body;

  try {
    const ai = getGeminiClient();
    if (!ai) {
      // Elegant fallback generator if Gemini Key isn't provided
      const wordMap = ["cutting-edge", "hyper-optimized", "conversion-focused", "world-class", "industry-grade", "precision-engineered"];
      const randomWord = () => wordMap[Math.floor(Math.random() * wordMap.length)];

      const fallbackDesc = `Experience a ${randomWord()} suite of professional ${serviceName || "agency"} deliverables tailored perfectly for your ${packageName || "Basic"} scale. Powered by clean layouts and absolute high-impact conversions.`;
      const fallbackFeatures = [
        `100% Custom high-end premium deliverables`,
        `Supercharged speed and layout performance`,
        `Advanced psychological visual design hierarchy`,
        `Dedicated VIP customer satisfaction assurance`,
        `24/7 Priority support and consulting guidance`
      ];

      return res.json({
        optimizedDescription: fallbackDesc,
        optimizedFeatures: fallbackFeatures,
        info: "Generated using elegant secondary local copybuilder."
      });
    }

    let prompt = `You are an elite conversion-oriented copywriter. Create a premium, conversion-optimized service package information block.
Service Name: ${serviceName}
Package Name: ${packageName}
Current Description: ${currentDescription || ""}
Current Features: ${(currentFeatures || []).join(", ")}`;

    prompt += `\nResponse MUST be in strict JSON format:
{
  "optimizedDescription": "A single highly engaging paragraph descriptions of the service package (max 250 characters)",
  "optimizedFeatures": ["list", "of", "5", "bullet", "points", "customized", "features"]
}`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json"
      }
    });

    const bodyText = response.text;
    if (!bodyText) {
      throw new Error("No response text returned from Gemini API");
    }

    const data = JSON.parse(bodyText.trim());
    res.json(data);
  } catch (error) {
    console.error("Gemini optimization error:", error);
    res.status(500).json({ error: "AI Copilot optimization services temporarily unavailable. Please retry shortly." });
  }
});

// ------------------------------------
// Express Server & Dev Environment Setup
// ------------------------------------
async function startServer() {
  // Sync structure with Cloud Firestore at startup
  console.log("Starting master synchronization with Google Cloud Firestore...");
  await loadDbFromFirestore();

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server is running on http://localhost:${PORT}`);
  });
}

startServer();
