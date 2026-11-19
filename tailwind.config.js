/**
 * Tema dinámico: primary, accent y slate leen variables CSS (--c-primary-600, …) definidas
 * en src/globals.css y reemplazadas en tiempo real por la personalización del usuario
 * (src/lib/appearance.ts). Los temas disponibles están en THEME_PRESETS.
 * Los colores semánticos (emerald = éxito/precios, amber = aviso, rose/red = error) son fijos.
 */
const SHADES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];
const themeColor = (name) => Object.fromEntries(
  SHADES.map((shade) => [shade, `rgb(var(--c-${name}-${shade}) / <alpha-value>)`]),
);
// Bordes: --radius-scale = 0.35 (recto), 1 (normal) o 1.6 (redondeado).
const radius = (rem) => `calc(${rem}rem * var(--radius-scale, 1))`;

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: themeColor('primary'),
        accent: themeColor('accent'),
        slate: themeColor('slate'),
      },
      borderRadius: {
        sm: radius(0.125),
        DEFAULT: radius(0.25),
        md: radius(0.375),
        lg: radius(0.5),
        xl: radius(0.75),
        '2xl': radius(1),
        '3xl': radius(1.5),
      },
      fontFamily: {
        sans: ['var(--font-jakarta)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
