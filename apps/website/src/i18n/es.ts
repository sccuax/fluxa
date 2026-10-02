import type { Dictionary } from "./en";

export const es: Dictionary = {
  meta: {
    title: "Fluxa — Fondos con shaders en vivo para Webflow",
    description:
      "Diseña gradientes animados y efectos de cristal dentro del Webflow Designer. Sin código, sin exportar, en vivo en tu sitio publicado.",
  },
  nav: {
    shaders: "Gradientes de shaders",
    solutions: "Soluciones Webflow",
    pricing: "Precios",
    about: "Nosotros",
    login: "Iniciar sesión",
    cta: "Prueba Fluxa gratis",
    menu: "Menú",
  },
  hero: {
    eyebrow: "Extensión del Webflow Designer",
    title: "Fondos vivos para tu sitio en Webflow",
    subtitle:
      "Diseña gradientes con shaders, cristal líquido y ruido evolutivo dentro del Designer: se renderizan en vivo en tus páginas publicadas.",
    primary: "Añadir a Webflow",
    secondary: "Ver presets",
    reveal: {
      badge: "Webflow designer",
      title: "Movimiento, sin código.",
      body: "Fluxa añade gradientes con shaders animados a cualquier Div block, Section o Link block directamente en el Designer de Webflow. Sin shaders que escribir, sin plugins que instalar.",
      ctaSecondary: "Ver la demo",
    },
  },
  steps: {
    badge: "Soluciones",
    titlePre: "De cero ",
    titleAccent: "a movimiento",
    titlePost: " en tres pasos.",
    items: [
      { title: "Abre Fluxa", body: "Lanza el panel sin salir nunca del Designer de Webflow." },
      { title: "Elige un gradiente", body: "Parte de un preset o crea tu propio plano, esfera o líquido." },
      {
        title: "Suéltalo sobre tu elemento",
        body: "Aplícalo a cualquier Div block, Section o Link block. Queda activo al instante, directo en el canvas.",
      },
    ],
  },
  featuresIntro: {
    badge: "Funciones",
    line1: "Todo lo que necesitas.",
    line2: "Nada que tengas que aprender.",
    cards: [
      { title: "Tres formas de darle forma", body: "Gradientes plano, esfera o líquido: eliges el tipo que encaja con tu layout, y no al revés." },
      { title: "Profundidad real, no ruido plano", body: "Formas plano, esfera o líquido, cada una con sus propios controles de distorsión y resolución." },
      { title: "Movimiento bajo tu control", body: "Velocidad, escala, rotación y desplazamiento: ajusta cómo se mueve con total precisión, hasta el detalle." },
      { title: "Color, exacto", body: "HEX, RGB o HSL. Toma el color directo de tu pantalla con el gotero y iguala tu marca sin adivinar." },
      { title: "Una biblioteca para empezar", body: "Explora presets por color, popularidad o licencia. Evita el lienzo en blanco cuando no necesitas empezar de cero." },
    ],
  },
  features: {
    title: "Hecho para diseñadores, optimizado para rendir",
    items: [
      {
        title: "En vivo, nunca estático",
        body: "WebGL real en tu sitio publicado, no una captura. Se pausa fuera de pantalla para que las páginas sigan rápidas.",
      },
      {
        title: "Presets para empezar",
        body: "Una galería curada de shaders. Elige uno, ajústalo y aplícalo a cualquier sección.",
      },
      {
        title: "Webflow Solutions",
        body: "Galerías multi-imagen del CMS y staging seguro para posts, sin tocar código.",
      },
    ],
  },
  pricing: {
    badge: "Planes",
    titlePre: "Precios simples. ",
    titleAccent: "Empieza gratis.",
    monthly: "Mensual",
    annual: "Anual",
    discount: "-20%",
    billedYearly: "Facturado {total} al año",
    popular: "Más popular",
    cta: "Instalar en Webflow",
    free: {
      name: "Free",
      description: "Para probar Fluxa.",
      features: ["3 presets gratis", "Gradientes estáticos ilimitados", "Funciona en cualquier Div block, Section o Link block"],
    },
    pro: {
      name: "Pro",
      description: "Para equipos y freelancers que entregan proyectos reales.",
      features: ["Presets ilimitados", "Gradientes animados ilimitados", "Biblioteca de equipo (próximamente)", "Todo lo de Free"],
    },
  },
  faq: {
    badge: "FAQ",
    titlePre: "¿Tienes preguntas?",
    titlePost: "Tenemos ",
    titleAccent: "respuestas",
    items: [
      { q: "¿Necesito saber programar?", a: "No. Fluxa funciona por completo dentro del Designer de Webflow, sin código de shaders ni herramientas externas." },
      { q: "¿Funciona con cualquier plan de Webflow?", a: "Fluxa funciona en cualquier sitio de Webflow. Tus gradientes se ven en vivo en el dominio de staging y en tu dominio propio una vez que publicas." },
      { q: "¿A qué datos accede Fluxa?", a: "Solo a lo que cada función necesita: el elemento que seleccionas en el Designer y, si usas Webflow Solutions, tus items del CMS y tus páginas. De tu cuenta guardamos tu nombre y correo." },
      { q: "¿Puedo usarlo en proyectos de clientes?", a: "Sí. Instala Fluxa en cualquier sitio que puedas abrir en el Designer, tuyo o de un cliente. La Licencia tiene los detalles." },
      { q: "¿Qué incluye el plan gratis?", a: "3 presets gratis, gradientes estáticos ilimitados, y funciona en cualquier Div block, Section o Link block." },
      { q: "¿Cómo cancelo mi suscripción?", a: "Abre Plan y facturación en el panel de Fluxa y cancela con un clic. Pro sigue activo hasta el final del periodo que pagaste y luego tu cuenta vuelve a Free." },
      { q: "¿Qué pasa con mis gradientes Pro si bajo de plan?", a: "Los gradientes que dependen de Pro dejan de verse en tus sitios publicados cuando termina tu periodo pagado. Lo que hiciste con Free sigue funcionando." },
    ],
  },
  cta: {
    titleTop: "Agrega gradientes animados a",
    titleLead: "Webflow",
    titleTail: "sin escribir código",
    body: "Instala Fluxa y agrega tu primer gradiente animado en menos de un minuto.",
    button: "Instalar en Webflow",
  },
  footer: {
    rights: "Todos los derechos reservados.",
    licenses: "Licencias",
    privacy: "Política de privacidad",
    terms: "Términos del servicio",
  },
};
