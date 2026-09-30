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
    title: "Simple pricing",
    free: { name: "Free", price: "$0", body: "Up to 3 shaders." },
    pro: { name: "Pro", price: "Soon", body: "Unlimited shaders, Pro presets and all Webflow Solutions." },
  },
  footer: {
    rights: "All rights reserved.",
    licenses: "Licenses",
    privacy: "Privacy",
    terms: "Terms",
  },
};

export type Dictionary = typeof en;
