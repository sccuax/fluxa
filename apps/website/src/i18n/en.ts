// English is the source dictionary: `es.ts` must satisfy the same shape, so a
// missing translation is a type error, not a runtime hole.
export const en = {
  meta: {
    title: "Fluxa — Live shader backgrounds for Webflow",
    description:
      "Design animated shader gradients and glass effects inside the Webflow Designer. No code, no exports, live on your published site.",
  },
  nav: {
    shaders: "Shaders gradients",
    solutions: "Webflow solutions",
    pricing: "Pricing",
    about: "About us",
    login: "Login",
    cta: "Try Fluxa free",
    menu: "Menu",
  },
  hero: {
    eyebrow: "Webflow Designer Extension",
    title: "Living backgrounds for your Webflow site",
    subtitle:
      "Design shader gradients, liquid glass and evolving noise right inside the Designer — they render live on your published pages.",
    primary: "Add to Webflow",
    secondary: "Browse presets",
    // Copy revealed once the scroll transition lands on the light background (Hero-Animation-4).
    reveal: {
      badge: "Webflow designer",
      title: "Motion, without the code.",
      body: "Fluxa adds animated shader gradients to any Div block, Section, or Link block right inside Webflow's Designer. No shaders to write, no plugins to install.",
      ctaSecondary: "Watch the demo",
    },
  },
  steps: {
    badge: "Solutions",
    titlePre: "From zero ",
    titleAccent: "to motion",
    titlePost: " in three steps.",
    items: [
      { title: "Open Fluxa", body: "Launch the panel without ever leaving Webflow's Designer." },
      { title: "Pick a gradient", body: "Start from a preset or build your own plane, sphere, liquid." },
      {
        title: "Drop it on your element",
        body: "Apply it to any Div block, Section, or Link block. It's live instantly, right in the canvas.",
      },
    ],
  },
  featuresIntro: {
    badge: "Features",
    line1: "Everything you need.",
    line2: "Nothing you have to learn.",
    cards: [
      { title: "Three ways to shape it", body: "Plane, sphere, or liquid gradients pick the type that fits your layout, not the other way around." },
      { title: "Real depth, not flat noise", body: "Plane, sphere, or liquid shapes, each with its own distortion and resolution controls." },
      { title: "Motion you control", body: "Speed, scale, rotation, offset dial in exactly how it moves, down to the detail." },
      { title: "Color, exact", body: "HEX, RGB, or HSL. Pick straight from your screen with the eyedropper match your brand without guessing." },
      { title: "A library to start from", body: "Browse presets by color, popularity, or license. Skip the blank canvas when you don't need to start from scratch." },
    ],
  },
  features: {
    title: "Built for designers, tuned for performance",
    items: [
      {
        title: "Live, never static",
        body: "Real WebGL on your published site, not a screenshot. Pauses off-screen so pages stay fast.",
      },
      {
        title: "Presets you can start from",
        body: "A curated gallery of shaders. Pick one, tweak it, apply it to any section.",
      },
      {
        title: "Webflow Solutions",
        body: "Multi-image CMS galleries and safe staging for blog posts, without touching code.",
      },
    ],
  },
  pricing: {
    badge: "Pricing plans",
    titlePre: "Simple pricing. ",
    titleAccent: "Start free.",
    monthly: "Monthly",
    annual: "Annual",
    discount: "-20%",
    billedYearly: "Billed {total} per year",
    popular: "Most popular",
    cta: "Install on Webflow",
    free: {
      name: "Free",
      description: "For trying Fluxa out.",
      features: ["3 free presets", "Unlimited static gradients", "Works on any Div block, Section, or Link block"],
    },
    pro: {
      name: "Pro",
      description: "For teams and freelancers shipping real projects.",
      features: ["Unlimited presets", "Unlimited animated gradients", "Team library (coming soon)", "Everything in Free"],
    },
  },
  faq: {
    badge: "FAQ",
    titlePre: "Got questions?",
    titlePost: "We've got ",
    titleAccent: "answers",
    items: [
      { q: "Do I need to know how to code?", a: "No. Fluxa runs entirely inside Webflow's Designer, no shader code, no external tools." },
      { q: "Does it work with any Webflow plan?", a: "Fluxa works on any Webflow site. Your gradients render live on the staging domain and on your custom domain once you publish." },
      { q: "What data does Fluxa access?", a: "Only what each feature needs: the element you select in the Designer and, if you use Webflow Solutions, your CMS items and pages. For your account we keep your name and email." },
      { q: "Can I use it on client projects?", a: "Yes. Install Fluxa on any site you can open in the Designer, yours or a client's. The License has the details." },
      { q: "What's included in the free plan?", a: "3 free presets, unlimited static gradients, and it works on any Div block, Section, or Link block." },
      { q: "How do I cancel my subscription?", a: "Open Plan & billing in the Fluxa panel and cancel in one click. Pro stays active until the end of the period you paid for, then your account goes back to Free." },
      { q: "What happens to my Pro gradients if I downgrade?", a: "Gradients that depend on Pro stop rendering on your published sites when your paid period ends. Everything built with Free keeps working." },
    ],
  },
  cta: {
    titleTop: "Add animated gradients to",
    titleLead: "Webflow",
    titleTail: "No-Code Required",
    body: "Install Fluxa and add your first animated gradient in under a minute.",
    button: "Install on Webflow",
  },
  footer: {
    rights: "All rights reserved.",
    licenses: "Licenses",
    privacy: "Privacy policy",
    terms: "Terms of service",
  },
};

export type Dictionary = typeof en;
