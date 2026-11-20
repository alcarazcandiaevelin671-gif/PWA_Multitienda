/**
 * Personalización del entorno: temas, colores por zona, bordes y tamaño de letra.
 *
 * Los colores de Tailwind (primary, accent, slate) leen variables CSS (--c-primary-600, …),
 * así que un tema se aplica al instante cambiando variables en <html>, sin recompilar.
 * Todo color elegido pasa por controles de contraste para que el texto siempre se lea.
 */

export type NeutralTone = 'malva' | 'pizarra' | 'piedra' | 'zinc';
export type HeaderStyle = 'claro' | 'tinte' | 'vidrio';
export type RadiusStyle = 'recto' | 'normal' | 'redondeado';
export type FontScale = 'compacto' | 'normal' | 'grande';

export type Appearance = {
  preset: string; // id de tema o 'personalizado'
  primary: string; // hex del tono 600 (botones, enlaces)
  accent: string; // hex del tono 600 (degradados, insignias)
  neutral: NeutralTone;
  header: HeaderStyle;
  hero: string; // portadas oscuras (inicio, cabecera de tiendas)
  footer: string;
  background: string; // fondo de página (modo claro)
  radius: RadiusStyle;
  fontScale: FontScale;
};

export type ThemePreset = {
  id: string;
  nombre: string;
  descripcion: string;
  grupo: 'Clásicos' | 'Paletas de color';
  /** Colores originales de la paleta (para la muestra del panel). Si falta, se usan los del tema. */
  muestra?: string[];
  appearance: Appearance;
};

const SHADES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const;
type Shade = typeof SHADES[number];
type Palette = Record<Shade, string>;

const HEX = /^#[0-9a-f]{6}$/i;
export const isHexColor = (value: unknown): value is string => typeof value === 'string' && HEX.test(value);

// Paletas exactas de Tailwind indexadas por su tono 600 (los temas usan colores conocidos).
const tw = (values: string): Palette => {
  const list = values.split(' ');
  return Object.fromEntries(SHADES.map((shade, index) => [shade, list[index]])) as Palette;
};
const KNOWN_PALETTES: Record<string, Palette> = {
  '#db2777': tw('#fdf2f8 #fce7f3 #fbcfe8 #f9a8d4 #f472b6 #ec4899 #db2777 #be185d #9d174d #831843 #500724'), // pink
  '#e11d48': tw('#fff1f2 #ffe4e6 #fecdd3 #fda4af #fb7185 #f43f5e #e11d48 #be123c #9f1239 #881337 #4c0519'), // rose
  '#7c3aed': tw('#f5f3ff #ede9fe #ddd6fe #c4b5fd #a78bfa #8b5cf6 #7c3aed #6d28d9 #5b21b6 #4c1d95 #2e1065'), // violet
  '#c026d3': tw('#fdf4ff #fae8ff #f5d0fe #f0abfc #e879f9 #d946ef #c026d3 #a21caf #86198f #701a75 #4a044e'), // fuchsia
  '#2563eb': tw('#eff6ff #dbeafe #bfdbfe #93c5fd #60a5fa #3b82f6 #2563eb #1d4ed8 #1e40af #1e3a8a #172554'), // blue
  '#0891b2': tw('#ecfeff #cffafe #a5f3fc #67e8f9 #22d3ee #06b6d4 #0891b2 #0e7490 #155e75 #164e63 #083344'), // cyan
  '#059669': tw('#ecfdf5 #d1fae5 #a7f3d0 #6ee7b7 #34d399 #10b981 #059669 #047857 #065f46 #064e3b #022c22'), // emerald
  '#d97706': tw('#fffbeb #fef3c7 #fde68a #fcd34d #fbbf24 #f59e0b #d97706 #b45309 #92400e #78350f #451a03'), // amber
  '#ea580c': tw('#fff7ed #ffedd5 #fed7aa #fdba74 #fb923c #f97316 #ea580c #c2410c #9a3412 #7c2d12 #431407'), // orange
  '#65a30d': tw('#f7fee7 #ecfccb #d9f99d #bef264 #a3e635 #84cc16 #65a30d #4d7c0f #3f6212 #365314 #1a2e05'), // lime
  '#4f46e5': tw('#eef2ff #e0e7ff #c7d2fe #a5b4fc #818cf8 #6366f1 #4f46e5 #4338ca #3730a3 #312e81 #1e1b4b'), // indigo
  '#0d9488': tw('#f0fdfa #ccfbf1 #99f6e4 #5eead4 #2dd4bf #14b8a6 #0d9488 #0f766e #115e59 #134e4a #042f2e'), // teal
};

const NEUTRALS: Record<NeutralTone, Palette> = {
  malva: tw('#faf7fa #f6f0f7 #eee7f0 #ddd2e0 #a199a8 #7b7082 #6b6272 #3d3245 #2d2433 #1f1724 #0d0a10'),
  pizarra: tw('#f8fafc #f1f5f9 #e2e8f0 #cbd5e1 #94a3b8 #64748b #475569 #334155 #1e293b #0f172a #020617'),
  piedra: tw('#fafaf9 #f5f5f4 #e7e5e4 #d6d3d1 #a8a29e #78716c #57534e #44403c #292524 #1c1917 #0c0a09'),
  zinc: tw('#fafafa #f4f4f5 #e4e4e7 #d4d4d8 #a1a1aa #71717a #52525b #3f3f46 #27272a #18181b #09090b'),
};

export const NEUTRAL_LABELS: Record<NeutralTone, string> = {
  malva: 'Malva (cálido rosado)',
  pizarra: 'Pizarra (frío azulado)',
  piedra: 'Piedra (cálido terroso)',
  zinc: 'Zinc (gris neutro)',
};

// ---------------------------------------------------------------------------
// Utilidades de color
// ---------------------------------------------------------------------------
type RGB = [number, number, number];

export const hexToRgb = (hex: string): RGB => {
  const value = parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
};
const rgbToHex = ([r, g, b]: RGB) => `#${[r, g, b].map((c) => Math.round(Math.min(255, Math.max(0, c))).toString(16).padStart(2, '0')).join('')}`;
const mix = (hex: string, target: RGB, amount: number) => {
  const [r, g, b] = hexToRgb(hex);
  return rgbToHex([r + (target[0] - r) * amount, g + (target[1] - g) * amount, b + (target[2] - b) * amount]);
};
const WHITE: RGB = [255, 255, 255];
const BLACK: RGB = [0, 0, 0];

/** Luminancia relativa WCAG (0 = negro, 1 = blanco). */
export const luminance = (hex: string) => {
  const [r, g, b] = hexToRgb(hex).map((c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
export const contrastRatio = (a: string, b: string) => {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
};

/** Oscurece hasta que el texto blanco sobre el color tenga contraste AA (4.5:1). */
export function ensureReadableOnWhite(hex: string) {
  let color = hex.toLowerCase();
  let steps = 0;
  while (contrastRatio(color, '#ffffff') < 4.5 && steps < 12) {
    color = mix(color, BLACK, 0.08);
    steps += 1;
  }
  return { color, adjusted: steps > 0 };
}

/** Escala de 11 tonos anclada en el tono 600 elegido. */
export function paletteFrom600(hex600: string): Palette {
  const known = KNOWN_PALETTES[hex600.toLowerCase()];
  if (known) return known;
  const lighter: Record<number, number> = { 50: 0.94, 100: 0.87, 200: 0.74, 300: 0.57, 400: 0.37, 500: 0.16 };
  const darker: Record<number, number> = { 700: 0.17, 800: 0.33, 900: 0.47, 950: 0.66 };
  return Object.fromEntries(SHADES.map((shade) => [
    shade,
    shade === 600 ? hex600 : shade < 600 ? mix(hex600, WHITE, lighter[shade]) : mix(hex600, BLACK, darker[shade]),
  ])) as Palette;
}

/** El fondo de página debe ser claro para que el texto oscuro se lea. */
export function ensureLightBackground(hex: string) {
  let color = hex.toLowerCase();
  let steps = 0;
  while (luminance(color) < 0.82 && steps < 20) {
    color = mix(color, WHITE, 0.12);
    steps += 1;
  }
  return { color, adjusted: steps > 0 };
}

/** Tono de una zona: 'dark' => texto claro encima; 'light' => texto oscuro encima. */
export const zoneTone = (hex: string): 'dark' | 'light' => (luminance(hex) > 0.4 ? 'light' : 'dark');

// ---------------------------------------------------------------------------
// Temas
// ---------------------------------------------------------------------------
const base = { header: 'claro', radius: 'normal', fontScale: 'normal' } as const;

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: 'rosa', nombre: 'Rosa boutique', descripcion: 'Rosa y frambuesa con neutros malva', grupo: 'Clásicos',
    appearance: { ...base, preset: 'rosa', primary: '#db2777', accent: '#e11d48', neutral: 'malva', hero: '#0d0a10', footer: '#0d0a10', background: '#faf7fa' },
  },
  {
    id: 'violeta', nombre: 'Violeta moderno', descripcion: 'Violeta y fucsia, estilo app moderna', grupo: 'Clásicos',
    appearance: { ...base, preset: 'violeta', primary: '#7c3aed', accent: '#c026d3', neutral: 'zinc', hero: '#1e1033', footer: '#18181b', background: '#fafaff' },
  },
  {
    id: 'oceano', nombre: 'Océano', descripcion: 'Azul profundo y turquesa', grupo: 'Clásicos',
    appearance: { ...base, preset: 'oceano', primary: '#2563eb', accent: '#0e7490', neutral: 'pizarra', hero: '#0b1a33', footer: '#0f172a', background: '#f8fafc' },
  },
  {
    id: 'esmeralda', nombre: 'Esmeralda', descripcion: 'Verde fresco con acento ámbar', grupo: 'Clásicos',
    appearance: { ...base, preset: 'esmeralda', primary: '#047857', accent: '#b45309', neutral: 'piedra', hero: '#062e24', footer: '#1c1917', background: '#f7faf8' },
  },
  {
    id: 'guarani', nombre: 'Guaraní cálido', descripcion: 'Terracota y verde yerba', grupo: 'Clásicos',
    appearance: { ...base, preset: 'guarani', primary: '#c2410c', accent: '#4d7c0f', neutral: 'piedra', hero: '#2a1608', footer: '#1c1917', background: '#fffbf5', radius: 'redondeado' },
  },
  {
    id: 'grafito', nombre: 'Grafito', descripcion: 'Sobrio, índigo y teal sobre grises', grupo: 'Clásicos',
    appearance: { ...base, preset: 'grafito', primary: '#4f46e5', accent: '#0f766e', neutral: 'zinc', hero: '#18181b', footer: '#09090b', background: '#fafafa', radius: 'recto' },
  },

  // --- Paletas de color --------------------------------------------------------
  // Basadas en paletas de referencia. Los tonos muy claros se usan en zonas (portada, pie, fondo);
  // para botones y enlaces se eligió el tono de la misma familia que cumple contraste AA (≥ 4.5:1).
  {
    id: 'bosque', nombre: 'Bosque', descripcion: 'Verdes profundos con toque lima', grupo: 'Paletas de color',
    muestra: ['#142c14', '#315a2d', '#52782f', '#93ab58', '#e9f2a6'],
    appearance: { ...base, preset: 'bosque', primary: '#315a2d', accent: '#52782f', neutral: 'zinc', hero: '#142c14', footer: '#142c14', background: '#f8fbe8', radius: 'redondeado' },
  },
  {
    id: 'azul-profundo', nombre: 'Azul profundo', descripcion: 'Marino, acero y celeste', grupo: 'Paletas de color',
    muestra: ['#001d39', '#0a4174', '#49769f', '#4e8ea2', '#6ea2b3', '#7bbde8', '#bdd8e9'],
    appearance: { ...base, preset: 'azul-profundo', primary: '#0a4174', accent: '#49769f', neutral: 'pizarra', hero: '#001d39', footer: '#001d39', background: '#f2f8fc', header: 'tinte' },
  },
  {
    id: 'vino', nombre: 'Vino y durazno', descripcion: 'Borravino, coral y durazno', grupo: 'Paletas de color',
    muestra: ['#4c1d3d', '#852e4e', '#a33757', '#dc586d', '#fb9590', '#ffbb94'],
    appearance: { ...base, preset: 'vino', primary: '#a33757', accent: '#ba4b5c', neutral: 'malva', hero: '#4c1d3d', footer: '#4c1d3d', background: '#fff6f1' },
  },
  {
    id: 'cafe', nombre: 'Café con leche', descripcion: 'Chocolate, caramelo y crema', grupo: 'Paletas de color',
    muestra: ['#3e2522', '#8c6e63', '#d3a376', '#ffe0b2', '#fff2df'],
    appearance: { ...base, preset: 'cafe', primary: '#8c6e63', accent: '#8b6c4e', neutral: 'piedra', hero: '#3e2522', footer: '#3e2522', background: '#fff8ee', radius: 'redondeado' },
  },
  {
    id: 'pastel', nombre: 'Pastel arcoíris', descripcion: 'Lila, celeste, menta y rosa', grupo: 'Paletas de color',
    muestra: ['#e8c0fc', '#a8defa', '#d0f4e0', '#fcf5bf', '#ff99c8'],
    appearance: { ...base, preset: 'pastel', primary: '#c2185b', accent: '#7e57c2', neutral: 'zinc', hero: '#e8c0fc', footer: '#a8defa', background: '#fffdf2', header: 'tinte', radius: 'redondeado' },
  },
  {
    id: 'atardecer', nombre: 'Atardecer', descripcion: 'Noche índigo, ciruela y naranja', grupo: 'Paletas de color',
    muestra: ['#1d1a39', '#451952', '#662549', '#ae445a', '#f39f5a', '#e8bcb9'],
    appearance: { ...base, preset: 'atardecer', primary: '#ae445a', accent: '#c2410c', neutral: 'malva', hero: '#1d1a39', footer: '#451952', background: '#fdf4f2' },
  },
  {
    id: 'vintage', nombre: 'Vintage', descripcion: 'Salvia, mostaza y terracota suave', grupo: 'Paletas de color',
    muestra: ['#9eaba2', '#bdd1c5', '#eecc8c', '#e8b298', '#d3a29d', '#a36361'],
    appearance: { ...base, preset: 'vintage', primary: '#a36361', accent: '#56705f', neutral: 'piedra', hero: '#56705f', footer: '#a36361', background: '#fbf6ec', radius: 'redondeado' },
  },
];

export const DEFAULT_APPEARANCE: Appearance = THEME_PRESETS[0].appearance;

/** Normaliza datos guardados/recibidos: cualquier campo inválido vuelve al valor por defecto. */
export function normalizeAppearance(value: unknown): Appearance {
  const input = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
  const pick = <T extends string>(key: string, allowed: readonly T[], fallback: T): T =>
    (allowed.includes(input[key] as T) ? input[key] as T : fallback);
  const d = DEFAULT_APPEARANCE;
  return {
    preset: typeof input.preset === 'string' && input.preset.length <= 30 ? input.preset : d.preset,
    primary: isHexColor(input.primary) ? input.primary.toLowerCase() : d.primary,
    accent: isHexColor(input.accent) ? input.accent.toLowerCase() : d.accent,
    neutral: pick('neutral', ['malva', 'pizarra', 'piedra', 'zinc'] as const, d.neutral),
    header: pick('header', ['claro', 'tinte', 'vidrio'] as const, d.header),
    hero: isHexColor(input.hero) ? input.hero.toLowerCase() : d.hero,
    footer: isHexColor(input.footer) ? input.footer.toLowerCase() : d.footer,
    background: isHexColor(input.background) ? input.background.toLowerCase() : d.background,
    radius: pick('radius', ['recto', 'normal', 'redondeado'] as const, d.radius),
    fontScale: pick('fontScale', ['compacto', 'normal', 'grande'] as const, d.fontScale),
  };
}

// ---------------------------------------------------------------------------
// Aplicar
// ---------------------------------------------------------------------------
export type AppearanceTokens = {
  vars: Record<string, string>;
  attrs: Record<string, string>;
  adjustments: string[];
};

const rgbVar = (hex: string) => hexToRgb(hex).join(' ');

/** Convierte la apariencia en variables CSS + atributos, aplicando las reglas de legibilidad. */
export function computeAppearanceTokens(input: Appearance): AppearanceTokens {
  const appearance = normalizeAppearance(input);
  const adjustments: string[] = [];
  const primary = ensureReadableOnWhite(appearance.primary);
  const accent = ensureReadableOnWhite(appearance.accent);
  const background = ensureLightBackground(appearance.background);
  if (primary.adjusted) adjustments.push('El color principal se oscureció un poco para que el texto blanco de los botones se lea.');
  if (accent.adjusted) adjustments.push('El color de acento se oscureció un poco para mantener la legibilidad.');
  if (background.adjusted) adjustments.push('El fondo se aclaró para que los textos se lean bien.');

  const vars: Record<string, string> = {};
  const palettes: Array<[string, Palette]> = [
    ['primary', paletteFrom600(primary.color)],
    ['accent', paletteFrom600(accent.color)],
    ['slate', NEUTRALS[appearance.neutral]],
  ];
  for (const [name, palette] of palettes) {
    for (const shade of SHADES) vars[`--c-${name}-${shade}`] = rgbVar(palette[shade]);
  }
  vars['--zone-hero'] = rgbVar(appearance.hero);
  vars['--zone-footer'] = rgbVar(appearance.footer);
  vars['--zone-page'] = rgbVar(background.color);
  vars['--radius-scale'] = { recto: '0.35', normal: '1', redondeado: '1.6' }[appearance.radius];
  vars['--font-scale'] = { compacto: '93.75%', normal: '100%', grande: '112.5%' }[appearance.fontScale];

  return {
    vars,
    attrs: {
      'data-hero-tone': zoneTone(appearance.hero),
      'data-footer-tone': zoneTone(appearance.footer),
      'data-header-style': appearance.header,
    },
    adjustments,
  };
}

export const APPEARANCE_STORAGE_KEY = 'pg-apariencia';
export const APPEARANCE_EVENT = 'pg-apariencia-cambio';

/** Aplica en <html>. `persist` guarda en el dispositivo para aplicarla antes del primer pintado. */
export function applyAppearance(appearance: Appearance, { persist = true, owner = readAppearanceOwner() }: { persist?: boolean; owner?: string | null } = {}) {
  if (typeof document === 'undefined') return;
  const tokens = computeAppearanceTokens(appearance);
  const root = document.documentElement;
  Object.entries(tokens.vars).forEach(([key, value]) => root.style.setProperty(key, value));
  Object.entries(tokens.attrs).forEach(([key, value]) => root.setAttribute(key, value));
  // Color de la barra del navegador / app instalada.
  const [r, g, b] = tokens.vars['--c-primary-600'].split(' ').map(Number);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', rgbToHex([r, g, b]));
  if (persist) {
    try {
      localStorage.setItem(APPEARANCE_STORAGE_KEY, JSON.stringify({ appearance: normalizeAppearance(appearance), vars: tokens.vars, attrs: tokens.attrs, owner }));
    } catch {
      // almacenamiento bloqueado: solo se aplica en esta sesión
    }
  }
  window.dispatchEvent(new CustomEvent(APPEARANCE_EVENT, { detail: normalizeAppearance(appearance) }));
}

/** Usuario dueño de la apariencia guardada en el dispositivo (null = visitante). */
export function readAppearanceOwner(): string | null {
  try {
    const raw = localStorage.getItem(APPEARANCE_STORAGE_KEY);
    return raw ? (JSON.parse(raw).owner ?? null) : null;
  } catch {
    return null;
  }
}

export function readStoredAppearance(): Appearance | null {
  try {
    const raw = localStorage.getItem(APPEARANCE_STORAGE_KEY);
    return raw ? normalizeAppearance(JSON.parse(raw).appearance) : null;
  } catch {
    return null;
  }
}

/**
 * Script en línea para <head>: aplica la apariencia guardada antes de pintar la página
 * (evita el parpadeo con los colores por defecto).
 */
export const APPEARANCE_BOOT_SCRIPT = `(function(){try{var s=localStorage.getItem('${APPEARANCE_STORAGE_KEY}');if(!s)return;var d=JSON.parse(s),r=document.documentElement,k;for(k in d.vars)r.style.setProperty(k,d.vars[k]);for(k in d.attrs)r.setAttribute(k,d.attrs[k]);}catch(e){}})();`;

/** Color actual de un tono (para PDF/canvas), leído de las variables CSS. */
export function readThemeRgb(name: 'primary' | 'accent' | 'slate', shade: Shade, fallback: RGB): RGB {
  if (typeof document === 'undefined') return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(`--c-${name}-${shade}`).trim();
  const parts = value.split(/\s+/).map(Number);
  return parts.length === 3 && parts.every((n) => Number.isFinite(n)) ? parts as RGB : fallback;
}
