/**
 * Verifica que los productos de comercios que no están "activa" no se muestren al público.
 * Solo lectura: no crea ni modifica datos.
 *
 * Uso (con la app de producción en el puerto 3100 y puppeteer-core disponible):
 *   node comercios-suspendidos.mjs <carpetaCapturas> <archivoResultados>
 * Necesita NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY en el entorno.
 */
import puppeteer from 'puppeteer-core';
import { writeFileSync } from 'node:fs';

const [, , SHOTS, RESULTS] = process.argv;
const BASE = 'http://localhost:3100';
const API = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1`;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rest = async (path) => {
  const response = await fetch(`${API}/${path}`, { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } });
  if (!response.ok) throw new Error(`${path}: ${response.status} ${await response.text()}`);
  return response.json();
};
const results = [];
const check = (id, requisito, ok, detalle) => {
  results.push({ id, requisito, resultado: ok ? 'Cumple' : 'No cumple', detalle });
  console.log(ok ? 'OK   ' : 'FALLA', id, requisito, '-', detalle);
};

// Productos disponibles por estado del comercio (control: debe existir al menos uno oculto que probar)
const all = await rest('productos?select=id,titulo,descripcion,tienda:tiendas(slug,estado)&disponible=eq.true');
const hidden = all.filter((p) => p.tienda?.estado !== 'activa');
const visible = all.filter((p) => p.tienda?.estado === 'activa');
check('S00', 'Control: existen productos disponibles de un comercio no activo', hidden.length > 0, hidden.map((p) => `${p.titulo} (${p.tienda.slug}, ${p.tienda.estado})`).join('; '));

const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, defaultViewport: { width: 1366, height: 860 } });
const page = await browser.newPage();
const go = async (path, wait = 5000) => { const r = await page.goto(BASE + path, { waitUntil: 'domcontentloaded', timeout: 60000 }); await sleep(wait); return r; };
const titles = (sel) => page.$$eval(sel, (els) => els.map((e) => e.innerText.trim()));
const hiddenTitles = hidden.map((p) => p.titulo.trim().toLowerCase()).filter((t) => !visible.some((v) => v.titulo.trim().toLowerCase() === t));
const leaks = (list) => list.filter((t) => hiddenTitles.includes(t.trim().toLowerCase()));

await go('/tiendas');
const catalog = await titles('article h2');
check('S01', 'El catálogo muestra solo productos de comercios activos', catalog.length === visible.length && leaks(catalog).length === 0, `${catalog.length} productos mostrados, ${visible.length} de comercios activos`);

// Buscador, por texto y por categoría
for (const term of ['pizza', 'teclado', 'auricular']) {
  await go('/', 3000);
  const input = await page.$('header input[type="search"], header input[placeholder*="Buscar"]');
  await input.type(term);
  await sleep(3500);
  const header = (await page.$eval('header', (h) => h.innerText)).split('\n').map((t) => t.trim());
  // Cada resultado muestra un precio: la cantidad debe ser exactamente la de los comercios activos.
  const shown = header.filter((t) => /Gs\.?\s?[\d.]+/.test(t)).length;
  const match = (p) => new RegExp(term, 'i').test(`${p.titulo} ${p.descripcion ?? ''}`);
  const expected = visible.filter(match).length;
  check(`S02-${term}`, `El buscador ("${term}") muestra solo productos de comercios activos`, shown === expected && leaks(header).length === 0, `${shown} resultados; ${expected} de comercios activos, ${hidden.filter(match).length} ocultos`);
  if (term === 'pizza') await page.screenshot({ path: `${SHOTS}/02-busqueda.png` });
}

const sample = hidden[0];
const permalink = await go(`/productos/${sample.id}`, 2500);
const stillInside = page.url().includes('/tienda/');
check('S03', 'El enlace directo de un producto oculto no lo muestra', permalink.status() === 404 || !stillInside, `HTTP ${permalink.status()}, ${page.url().replace(BASE, '')}`.replace(sample.id, '<id>'));

await go(`/tienda/${sample.tienda.slug}`, 4000);
const storeTitles = await titles('main h3, article h2, article h3, h3');
const storeText = await page.evaluate(() => document.body.innerText);
check('S04', 'La vitrina del comercio suspendido avisa su estado y no lista productos', /suspendido/i.test(storeText) && leaks(storeTitles).length === 0 && !hiddenTitles.some((t) => storeText.toLowerCase().includes(t)), 'aviso visible, sin productos');

// Consultas de favoritos y checkout, con las mismas condiciones que usa la aplicación
const ids = all.map((p) => p.id).join(',');
const favorites = await rest(`productos?select=id,tienda:tiendas!inner(estado)&id=in.(${ids})&tienda.estado=eq.activa`);
check('S05', 'La consulta de favoritos excluye los productos de comercios no activos', favorites.length === visible.length, `${favorites.length} de ${all.length}`);

// Control positivo: una vitrina activa sigue mostrando sus productos
await go(`/tienda/${visible[0].tienda.slug}`, 4000);
const activeText = (await page.evaluate(() => document.body.innerText)).toLowerCase();
const expected = visible.filter((p) => p.tienda.slug === visible[0].tienda.slug);
check('S06', 'Control: un comercio activo sigue mostrando sus productos', expected.every((p) => activeText.includes(p.titulo.trim().toLowerCase())), `${expected.length} productos`);

// Captura del catálogo sin conexión (mismo corte que F23: pestaña y service worker)
await go('/tiendas', 6000); await go('/tiendas', 5000);
const sw = browser.targets().find((t) => t.type() === 'service_worker' && t.url().startsWith(BASE));
await page.setOfflineMode(true);
if (sw) { const s = await sw.createCDPSession(); await s.send('Network.enable'); await s.send('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: -1, uploadThroughput: -1 }); }
await go('/tiendas', 5000);
const offline = await titles('article h2');
check('S07', 'Sin conexión: el catálogo guardado tampoco muestra productos de comercios no activos', Boolean(sw) && offline.length > 0 && leaks(offline).length === 0, `${offline.length} productos`);
await page.screenshot({ path: `${SHOTS}/13-offline-catalogo.png` });

writeFileSync(RESULTS, JSON.stringify({ fecha: new Date().toISOString(), pruebas: results }, null, 2));
console.log(`${results.filter((r) => r.resultado === 'Cumple').length}/${results.length} cumplen`);
await browser.close();
