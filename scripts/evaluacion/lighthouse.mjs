/**
 * Auditoría Lighthouse reproducible del prototipo (Capítulo V de la tesis).
 *
 * Uso: con la app corriendo (NEXT_DIST_DIR=.next-prod npx next build && npx next start -p 3100):
 *      CHROME_PATH="ruta/a/chrome" node scripts/evaluacion/lighthouse.mjs [http://localhost:3100]
 *
 * - Lighthouse 12 (sin categoría PWA: Google la retiró en la versión 12). La instalabilidad PWA se
 *   verifica aparte en las pruebas E2E (manifiesto, service worker, Page.getInstallabilityErrors).
 * - Modos: "móvil" (perfil por defecto: Moto G Power, CPU ×4, 4G lenta simulada) y "escritorio".
 * - 3 corridas por página y modo; se informa la MEDIANA del puntaje de rendimiento (recomendación
 *   de la documentación de Lighthouse por la variabilidad entre corridas).
 * Resultado: docs/evaluacion/lighthouse/resumen.json, resumen.md e informes HTML de la corrida mediana.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, copyFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const BASE = process.argv[2] || 'http://localhost:3100';
const OUT = join(ROOT, 'docs', 'evaluacion', 'lighthouse');
const RUNS = 3;
const MAX_ATTEMPTS = 15; // Lighthouse falla a veces con NO_NAVSTART; los reintentos quedan registrados
const PAGES = [
  ['inicio', '/'],
  ['productos', '/tiendas'],
  ['mapa', '/comercios'],
  ['categorias', '/categorias'],
  ['tienda', '/tienda/vendedor-1'],
];
const MODES = [['movil', []], ['escritorio', ['--preset=desktop']]];
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
mkdirSync(OUT, { recursive: true });

function runOnce(url, extra, base, attempt = 1) {
  // Se quita el informe de un intento anterior para no leer nunca un resultado viejo.
  rmSync(`${base}.report.json`, { force: true });
  rmSync(`${base}.report.html`, { force: true });
  const profile = join(tmpdir(), `pg-lh-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  try {
    execFileSync(npx, ['-y', 'lighthouse@12.8.2', url, ...extra, '--quiet', '--output=json', '--output=html', `--output-path=${base}`,
      '--only-categories=performance,accessibility,best-practices,seo',
      `--chrome-flags=--headless=new --user-data-dir=${profile}`], { stdio: 'ignore', shell: process.platform === 'win32' });
  } catch { /* Lighthouse sale con código ≠ 0 en algunos avisos: se valida el JSON abajo */ }
  try { rmSync(profile, { recursive: true, force: true }); } catch { /* Chrome aún libera el perfil temporal */ }
  let report = null;
  try { report = JSON.parse(readFileSync(`${base}.report.json`, 'utf8')); } catch { /* no se generó el informe */ }
  if (!report || report.runtimeError || report.categories.performance.score == null) {
    console.log(`  intento ${attempt} sin resultado: ${report?.runtimeError?.code ?? 'sin informe'}`);
    if (attempt < MAX_ATTEMPTS) return runOnce(url, extra, base, attempt + 1);
    throw new Error(`${url}: ${report?.runtimeError?.code ?? 'sin informe'}`);
  }
  const a = report.audits;
  return {
    rendimiento: Math.round(report.categories.performance.score * 100),
    accesibilidad: Math.round(report.categories.accessibility.score * 100),
    buenasPracticas: Math.round(report.categories['best-practices'].score * 100),
    seo: Math.round(report.categories.seo.score * 100),
    fcp: a['first-contentful-paint'].numericValue,
    lcp: a['largest-contentful-paint'].numericValue,
    tbt: a['total-blocking-time'].numericValue,
    cls: a['cumulative-layout-shift'].numericValue,
    si: a['speed-index'].numericValue,
    version: report.lighthouseVersion,
    perfil: report.configSettings.formFactor,
    intentos: attempt,
  };
}

const summary = { fecha: new Date().toISOString(), base: BASE, corridas: RUNS, resultados: [] };
for (const [mode, extra] of MODES) {
  for (const [name, path] of PAGES) {
    const runs = [];
    for (let i = 1; i <= RUNS; i += 1) {
      const base = join(OUT, `${mode}-${name}-${i}`);
      runs.push({ ...runOnce(BASE + path, extra, base), base });
      console.log(`${mode} ${name} #${i}: ${runs.at(-1).rendimiento}`);
    }
    const sorted = [...runs].sort((x, y) => x.rendimiento - y.rendimiento);
    const median = sorted[Math.floor(RUNS / 2)];
    copyFileSync(`${median.base}.report.html`, join(OUT, `${mode}-${name}.html`));
    copyFileSync(`${median.base}.report.json`, join(OUT, `${mode}-${name}.json`));
    for (const run of runs) { rmSync(`${run.base}.report.html`, { force: true }); rmSync(`${run.base}.report.json`, { force: true }); }
    summary.resultados.push({
      modo: mode,
      pagina: name,
      ruta: path,
      rendimientoCorridas: runs.map((r) => r.rendimiento),
      reintentos: runs.reduce((sum, r) => sum + r.intentos - 1, 0),
      ...Object.fromEntries(Object.entries(median).filter(([k]) => k !== 'base')),
    });
  }
}

const fmt = (ms) => `${(ms / 1000).toFixed(1)} s`;
const rows = summary.resultados.map((r) => `| ${r.modo} | ${r.ruta} | ${r.rendimiento} (${r.rendimientoCorridas.join(', ')}) | ${r.accesibilidad} | ${r.buenasPracticas} | ${r.seo} | ${fmt(r.fcp)} | ${fmt(r.lcp)} | ${Math.round(r.tbt)} ms | ${r.cls.toFixed(3)} | ${fmt(r.si)} |`);
const avg = (mode, key) => {
  const list = summary.resultados.filter((r) => r.modo === mode).map((r) => r[key]);
  return (list.reduce((s, v) => s + v, 0) / list.length).toFixed(1);
};
summary.promedios = Object.fromEntries(MODES.map(([mode]) => [mode, Object.fromEntries(['rendimiento', 'accesibilidad', 'buenasPracticas', 'seo'].map((k) => [k, Number(avg(mode, k))]))]));
writeFileSync(join(OUT, 'resumen.json'), JSON.stringify(summary, null, 2));
writeFileSync(join(OUT, 'resumen.md'), [
  `# Lighthouse ${summary.resultados[0].version} · ${summary.fecha.slice(0, 10)} · ${RUNS} corridas por página (mediana)`,
  '',
  '| Modo | Página | Rendimiento (corridas) | Accesibilidad | Buenas prácticas | SEO | FCP | LCP | TBT | CLS | Speed Index |',
  '|---|---|---|---|---|---|---|---|---|---|---|',
  ...rows,
  '',
  ...MODES.map(([mode]) => `**Promedio ${mode}:** rendimiento ${summary.promedios[mode].rendimiento} · accesibilidad ${summary.promedios[mode].accesibilidad} · buenas prácticas ${summary.promedios[mode].buenasPracticas} · SEO ${summary.promedios[mode].seo}`),
].join('\n'));
console.log(readFileSync(join(OUT, 'resumen.md'), 'utf8'));
