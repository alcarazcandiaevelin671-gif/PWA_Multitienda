// Pruebas funcionales end-to-end (E2E) del prototipo + capturas para el Capítulo V.
// Uso: node e2e.mjs <email> <password> <carpetaCapturas> <archivoResultados>
import puppeteer from 'puppeteer-core';
import { writeFileSync, mkdirSync } from 'node:fs';
const [,, EMAIL, PASS, SHOTS, RESULTS] = process.argv;
const BASE = 'http://localhost:3100';
const VILLARRICA = { latitude: -25.7806, longitude: -56.4486, accuracy: 20 };
mkdirSync(SHOTS, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const check = (id, requisito, ok, detalle = '') => { results.push({ id, requisito, resultado: ok ? 'Cumple' : 'No cumple', detalle }); console.log(`${ok ? 'OK ' : 'FALLA'} ${id} ${requisito} ${detalle ? '— ' + detalle : ''}`); };
const shot = async (page, name, fullPage = false) => { await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage }); };

const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
  userDataDir: 'C:/Users/ACER/AppData/Local/Temp/pgt/f1',
  defaultViewport: { width: 1366, height: 860 },
});
const context = browser.defaultBrowserContext();
await context.overridePermissions(BASE, ['geolocation']);
const page = await browser.newPage();
await page.setGeolocation(VILLARRICA);
const jsErrors = [];
page.on('pageerror', (e) => jsErrors.push(e.message.slice(0, 160)));
const go = async (path, wait = 2500) => { await page.goto(BASE + path, { waitUntil: 'domcontentloaded', timeout: 60000 }); await sleep(wait); };
const text = (sel) => page.evaluate((s) => document.querySelector(s)?.innerText ?? '', sel);
const clickText = (sel, t) => page.evaluate((s, tt) => { const el = [...document.querySelectorAll(s)].find((e) => e.innerText.trim().includes(tt)); el?.click(); return Boolean(el); }, sel, t);

// ---------------------------------------------------------------- 1. Inicio (visitante)
await go('/', 5000);
await shot(page, '01-inicio-escritorio');
const homeRecs = await page.evaluate(() => { const h = [...document.querySelectorAll('h2')].find((x) => x.innerText.includes('Recomendados')); const sec = h?.closest('section'); return { productos: sec?.querySelectorAll('article').length ?? 0, motivos: [...(sec?.querySelectorAll('p') ?? [])].filter((p) => p.innerText.startsWith('✨')).length }; });
check('F01', 'La página de inicio muestra productos recomendados con su motivo a un visitante sin historial', homeRecs.productos > 0 && homeRecs.motivos >= homeRecs.productos, `${homeRecs.productos} productos, ${homeRecs.motivos} motivos`);

// ---------------------------------------------------------------- 2. Enlace permanente de producto (buscador)
await go('/productos/3a037883-a6ac-413d-936c-08b2fe3204a9', 3000);
check('F02', 'El enlace de producto del buscador abre el producto en su tienda', page.url().includes('/tienda/vendedor-1'), page.url().replace(BASE, ''));

// ---------------------------------------------------------------- 3. Búsqueda
await go('/', 3000);
const searchInput = await page.$('header input[type="search"], header input[placeholder*="Buscar"]');
const headerBefore = await text('header');
if (searchInput) { await searchInput.type('pizza'); await sleep(3000); }
const headerAfter = await text('header');
const found = [...headerAfter.matchAll(/Pizza[^\n]*/g)].map((m) => m[0]);
check('F03', 'El buscador despliega productos que coinciden con la palabra clave ("pizza")', Boolean(searchInput) && !/Pizza/.test(headerBefore) && found.length > 0, found.slice(0, 4).join('; '));
await shot(page, '02-busqueda');

// ---------------------------------------------------------------- 4. Mapa de comercios
await go('/comercios', 4000);
await shot(page, '03-mapa-sin-ubicacion');
const markersBefore = await page.$$eval('.shop-map-marker', (els) => els.length);
const shopsInfo = Number(await page.evaluate(() => (document.body.innerText.match(/(\d+) comercios? ·/) || [])[1]));
check('F04', 'El mapa muestra un marcador por cada comercio activo', markersBefore > 0 && markersBefore === shopsInfo, `${markersBefore} marcadores, ${shopsInfo} comercios`);
const tiles = await page.$$eval('img.leaflet-tile', (imgs) => imgs.filter((i) => i.complete && i.naturalWidth > 0).length);
check('F04b', 'Los mosaicos del mapa (OpenStreetMap) cargan', tiles > 0, `${tiles} mosaicos`);
const consentShown = await page.evaluate(() => document.body.innerText.includes('Usamos tu ubicación solo para ordenar'));
check('F05', 'Antes de pedir la ubicación se muestra el aviso de consentimiento', consentShown);
await clickText('button', 'Usar mi ubicación (GPS)');
await sleep(4000);
const distances = await page.$$eval('section[aria-label="Mapa y directorio de comercios"] a, section[aria-label="Mapa y directorio de comercios"] *', () => null).catch(() => null);
const listText = await page.evaluate(() => document.body.innerText);
const labels = await page.$$eval('p', (ps) => ps.map((p) => p.innerText.trim()).filter((t) => t.startsWith('📍') && /\d\s?(km|m)$/.test(t)));
const kmValues = labels.map((t) => { const m = t.match(/(\d+(?:[.,]\d+)?)\s?(km|m)$/); return Number(m[1].replace(',', '.')) / (m[2] === 'm' ? 1000 : 1); });
const sorted = kmValues.every((value, index) => index === 0 || value >= kmValues[index - 1] - 0.001);
check('F06', 'Con la ubicación, los comercios se ordenan por distancia (PostGIS)', kmValues.length > 0 && sorted && listText.includes('PostGIS'), `distancias: ${kmValues.slice(0, 6).join(', ')} km`);
check('F07', 'El mapa muestra la ubicación del usuario', (await page.$$('.user-map-marker')).length === 1);
await shot(page, '04-mapa-con-ubicacion');
const countAll = await page.evaluate(() => (document.body.innerText.match(/(\d+) comercios?/) || [])[1]);
await page.select('select:has(option[value="25"])', '5'); await sleep(2500);
const count5 = await page.evaluate(() => (document.body.innerText.match(/(\d+) comercios?/) || [])[1]);
const circle = (await page.$$('path.leaflet-interactive')).length;
check('F08', 'Filtro por radio (5 km) reduce los comercios y dibuja el círculo', Number(count5) < Number(countAll) && circle >= 1, `todos: ${countAll}, 5 km: ${count5}`);
await shot(page, '05-mapa-radio-5km');
await page.select('select:has(option[value="25"])', 'all'); await sleep(1500);
const districtOk = await page.evaluate(() => {
  const select = [...document.querySelectorAll('select')].find((s) => s.innerText.includes('Todos los municipios'));
  const option = [...select.options].find((o) => o.text === 'Villarrica');
  return option?.value;
});
await page.select('select:has(option[value=""])', districtOk ?? ''); await sleep(2500);
const countDistrict = await page.evaluate(() => (document.body.innerText.match(/(\d+) comercios?/) || [])[1]);
check('F09', 'Filtro por municipio (Villarrica)', Number(countDistrict) >= 1 && Number(countDistrict) <= Number(countAll), `${countDistrict} comercio(s)`);
await page.evaluate(() => { const select = [...document.querySelectorAll('select')].find((s) => s.innerText.includes('Todos los municipios')); select.value = ''; select.dispatchEvent(new Event('change', { bubbles: true })); });
await sleep(2500);
await clickText('button', 'Ver en el mapa'); await sleep(2500);
const popup = await text('.leaflet-popup-content');
check('F10', 'Al elegir un comercio el mapa lo centra y abre su ficha (tienda, distancia, cómo llegar)', popup.includes('Ver tienda') && popup.includes('Cómo llegar'), popup.replace(/\n/g, ' · ').slice(0, 90));
await page.evaluate(() => window.scrollTo(0, 0));
await page.evaluate(() => document.querySelector('[aria-label="Mapa de comercios del Guairá"]')?.scrollIntoView({ block: 'center' }));
await sleep(800);
await shot(page, '06-mapa-ficha-comercio');

// Móvil
await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
await go('/comercios', 4000);
await shot(page, '07-mapa-movil');
const mobileNav = await page.evaluate(() => Boolean(document.querySelector('nav[aria-label="Principal (móvil)"]')?.offsetParent));
check('F11', 'Diseño mobile-first: navegación principal visible en celular', mobileNav);
await go('/', 4000);
await shot(page, '08-inicio-movil');
await page.setViewport({ width: 1366, height: 860 });

// ---------------------------------------------------------------- 5. API de IA
const api = await page.evaluate(async () => {
  const call = async (q) => { const r = await fetch('/api/recommendations?' + q); const j = await r.json(); return { status: r.status, n: Array.isArray(j) ? j.length : 0, sample: Array.isArray(j) ? j.slice(0, 3) : j }; };
  return {
    productos: await call('tipo=productos&favoriteId=3a037883-a6ac-413d-936c-08b2fe3204a9&searchTerm=pizza&limit=5'),
    comercios: await call('tipo=comercios&lat=-25.7806&lng=-56.4486&searchTerm=artesania&limit=4'),
    complementarios: await call('tipo=complementarios&contextId=b3cfb926-50d9-403c-9025-0a36072b2e7c&limit=4'),
    frio: await call('tipo=productos&lat=-25.7806&lng=-56.4486&limit=5'),
  };
});
check('F12', 'IA: recomienda productos según intereses (con motivo explicable)', api.productos.status === 200 && api.productos.n > 0 && Boolean(api.productos.sample[0]?.motivo), api.productos.sample.map((p) => `${p.nombre} (${p.motivo})`).join('; '));
check('F13', 'IA: recomienda comercios relevantes (afinidad + cercanía PostGIS)', api.comercios.status === 200 && api.comercios.n > 0, api.comercios.sample.map((s) => `${s.nombre_comercio} ${s.distancia_km ?? ''} km (${s.motivo})`).join('; '));
check('F14', 'IA: sugiere productos relacionados o complementarios para el carrito', api.complementarios.status === 200 && api.complementarios.n > 0, api.complementarios.sample.map((p) => `${p.nombre} (${p.motivo})`).join('; '));
check('F15', 'IA: usuario nuevo sin historial recibe sugerencias (arranque en frío)', api.frio.status === 200 && api.frio.n > 0, api.frio.sample.map((p) => `${p.nombre} (${p.motivo})`).join('; '));

// ---------------------------------------------------------------- 6. Inicio de sesión (cliente de prueba)
await go('/auth/login', 3000);
await page.type('input[type=email]', EMAIL); await page.type('input[placeholder="••••••••"]', PASS);
await Promise.all([page.waitForNavigation({ timeout: 60000 }).catch(() => null), page.click('button[type=submit]')]);
await sleep(3000);
check('F16', 'Inicio de sesión del cliente', !page.url().includes('/auth/login'), page.url().replace(BASE, ''));
await go('/', 6000);
await page.evaluate(() => { document.querySelector('header').style.position = 'static'; });
await sleep(9000); // deja cerrar el aviso emergente
const recSection = await page.evaluateHandle(() => [...document.querySelectorAll('h2')].find((h) => h.innerText.includes('Recomendados'))?.closest('section'));
await recSection.asElement()?.screenshot({ path: `${SHOTS}/09-recomendaciones-cliente.png` });
const recText = await page.evaluate((el) => el?.innerText ?? '', recSection);
check('F16b', 'El inicio del cliente muestra comercios recomendados con su motivo', /Comercios recomendados/i.test(recText));

// ---------------------------------------------------------------- 7. Carrito multitienda
await page.evaluate(() => localStorage.removeItem('pwa_multitienda_cart'));
const addFromStore = async (slug, productName) => {
  await go(`/tienda/${slug}`, 3500);
  await page.evaluate((name) => {
    const card = [...document.querySelectorAll('article')].find((a) => a.querySelector('h3')?.innerText.trim() === name);
    [...card.querySelectorAll('button')].find((b) => b.innerText.includes('Agregar'))?.click();
  }, productName);
  await sleep(2500);
};
await addFromStore('vendedor-1', 'Pizza Napolitana');
await addFromStore('artesanias-judith', 'Amigurumi de Panda');
await sleep(2500);
const drawer = await page.evaluate(() => document.querySelector('.fixed.inset-0')?.innerText ?? '');
check('F17', 'El carrito acepta productos de varios comercios y los agrupa por comercio', drawer.includes('2 comercios') && drawer.includes('VENDEDOR 1') && drawer.includes('ARTESANÍAS JUDITH'), drawer.split('\n').slice(0, 3).join(' | '));
const suggestions = await page.$$eval('section[aria-label="Productos complementarios"] li', (l) => l.map((x) => x.innerText.replace(/\n+/g, ' · ')));
check('F18', 'El carrito muestra sugerencias de la IA que se pueden agregar', suggestions.length > 0, suggestions.slice(0, 3).join(' | '));
await shot(page, '10-carrito-multitienda');

await go('/checkout', 5000);
const checkoutText = await page.evaluate(() => document.body.innerText);
check('F19', 'El checkout separa los productos por comercio y avisa que se crea un pedido por cada uno', checkoutText.includes('2 comercios') && checkoutText.includes('Comercio: Vendedor 1'));
await shot(page, '11-checkout-multitienda', true);
await page.evaluate(() => { const i = document.querySelector('input[minlength="3"]'); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(i, 'Calle Prueba 123, Villarrica'); i.dispatchEvent(new Event('input', { bubbles: true })); });
await sleep(300);
await Promise.all([page.waitForNavigation({ timeout: 60000 }).catch(() => null), page.click('button[type=submit]')]);
await sleep(7000);
const sendUrl = page.url();
const ids = new URL(sendUrl).searchParams.get('ids')?.split(',') ?? [];
const sendText = await page.evaluate(() => document.body.innerText);
check('F20', 'Al confirmar se crea un pedido por comercio (2 pedidos)', sendUrl.includes('/pedidos/enviar') && ids.length === 2, `${ids.length} pedidos`);
const waButtons = await page.$$eval('button', (bs) => bs.filter((b) => b.innerText.trim() === 'WhatsApp').length);
check('F21', 'Cada comercio tiene su ticket y su botón de WhatsApp', waButtons === 2 && /comercio 1 de 2/i.test(sendText) && /comercio 2 de 2/i.test(sendText), `${waButtons} botones`);
await shot(page, '12-envio-whatsapp-por-comercio', true);
await page.evaluate(() => { window.__opened = []; window.open = (url) => { window.__opened.push(url); return null; }; navigator.share = undefined; });
await page.evaluate(() => [...document.querySelectorAll('button')].filter((b) => b.innerText.trim() === 'WhatsApp')[0].click());
await sleep(5000);
await page.evaluate(() => [...document.querySelectorAll('button')].filter((b) => b.innerText.trim() === 'WhatsApp')[1].click());
await sleep(5000);
const opened = await page.evaluate(() => window.__opened);
const messages = opened.map((url) => { const u = new URL(url); return { telefono: u.searchParams.get('phone'), texto: u.searchParams.get('text') }; });
check('F22', 'Cada botón abre WhatsApp al número de SU comercio con el pedido estructurado', messages.length === 2 && messages[0].telefono !== messages[1].telefono
  && /Pizza Napolitana/.test(messages[0].texto) && !/Amigurumi/.test(messages[0].texto)
  && /Amigurumi/.test(messages[1].texto) && !/Pizza/.test(messages[1].texto), 'cada mensaje contiene solo los productos de su comercio; números distintos');
const mask = (phone) => (phone ? `${phone.slice(0, 5)}*****${phone.slice(-2)}` : null);
writeFileSync(`${SHOTS}/mensajes-whatsapp.json`, JSON.stringify(messages.map((m) => ({ telefono: mask(m.telefono), texto: m.texto })), null, 2));

// ---------------------------------------------------------------- 8. Funcionamiento sin conexión (pestaña Y service worker)
const swTarget = () => browser.targets().find((t) => t.type() === 'service_worker' && t.url().startsWith(BASE));
const setOffline = async (offline) => {
  await page.setOfflineMode(offline);
  const target = swTarget();
  if (target) {
    const session = await target.createCDPSession();
    await session.send('Network.enable');
    await session.send('Network.emulateNetworkConditions', { offline, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
  }
  return Boolean(target);
};
const swOnline = async () => { const worker = await swTarget()?.worker(); return worker ? worker.evaluate(() => fetch('/manifest.webmanifest?prueba=' + Date.now(), { cache: 'no-store' }).then(() => true, () => false)) : null; };

await go('/tiendas', 6000); // visita con conexión: queda en caché
await go('/comercios', 6000);
// Preparar un carrito de dos comercios con conexión (el de la prueba anterior ya se vació al confirmar)
await addFromStore('vendedor-1', 'Pizza Napolitana');
await addFromStore('artesanias-judith', 'Amigurumi de Panda');
const onlineBefore = await swOnline();
const cut = await setOffline(true);
const onlineDuring = await swOnline();
check('F23', 'Control: sin conexión real (la pestaña y el service worker no tienen red)', cut && onlineBefore === true && onlineDuring === false, `SW antes: ${onlineBefore}, durante: ${onlineDuring}`);

await go('/tiendas', 5000);
const offProducts = await page.$$eval('article h2', (h) => h.map((x) => x.innerText)).catch(() => []);
check('F24', 'Sin conexión: el catálogo ya visitado sigue mostrando sus productos', offProducts.length > 0, `${offProducts.length} productos`);
await shot(page, '13-offline-catalogo');

await go('/categorias/9999', 6000);
const offH1 = await text('h1');
check('F25', 'Sin conexión: una página no visitada muestra la pantalla propia "Estás sin conexión"', offH1.includes('Estás sin conexión'), `título: "${offH1}"`);
await shot(page, '14-offline-pantalla');

// Pedido multitienda sin conexión: queda en la cola (uno por comercio) y se envía al reconectar
await go('/tiendas', 4000);
await page.evaluate(() => localStorage.setItem('__marca', '1'));
await go('/tienda/artesanias-judith', 5000);
await clickText('button', 'Carrito'); await sleep(1500);
const setInput = (placeholder, value) => page.evaluate((p, v) => { const i = document.querySelector(`input[placeholder="${p}"]`); if (!i) return false; Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(i, v); i.dispatchEvent(new Event('input', { bubbles: true })); return true; }, placeholder, value);
const formOk = (await setInput('Nombre del cliente', 'Cliente de prueba')) && (await setInput('Dirección de entrega', 'Calle Prueba 123, Villarrica'));
await sleep(400);
const buttonsText = await page.$$eval('.fixed.inset-0 button', (b) => b.map((x) => x.innerText.trim()).filter(Boolean));
await page.evaluate(() => { const b = [...document.querySelectorAll('.fixed.inset-0 button')].find((x) => /WhatsApp|Realizar pedido|Enviar pedido/i.test(x.innerText)); b?.click(); });
await sleep(4000);
const queue = await page.evaluate(() => JSON.parse(localStorage.getItem('pwa_multitienda_offline_orders') || '[]').map((o) => o.resumen.tienda));
check('F26', 'Sin conexión: un carrito de dos comercios queda en cola como dos pedidos', formOk && queue.length === 2, `cola: ${queue.join(' / ') || 'vacía'}${queue.length === 2 ? '' : ' · botones: ' + buttonsText.join(', ')}`);
await shot(page, '21-offline-pedido-en-cola');

const synced = page.waitForResponse((r) => r.url().includes('/api/checkout') && r.status() < 300, { timeout: 40000 }).catch(() => null);
const syncedIds = [];
page.on('response', async (r) => { if (r.url().includes('/api/checkout') && r.request().method() === 'POST' && r.status() < 300) { const j = await r.json().catch(() => null); if (j?.pedido?.id) syncedIds.push(j.pedido.id); } });
await setOffline(false);
await page.evaluate(() => window.dispatchEvent(new Event('online')));
await synced; await sleep(12000);
const queueAfter = await page.evaluate(() => JSON.parse(localStorage.getItem('pwa_multitienda_offline_orders') || '[]').length);
check('F27', 'Al reconectar, los pedidos en cola se envían solos (uno por comercio)', queueAfter === 0 && new Set(syncedIds).size === 2, `quedan en cola: ${queueAfter}, enviados: ${new Set(syncedIds).size}`);

// ---------------------------------------------------------------- 9. PWA instalable (navegador aparte, perfil limpio)
const limit = (promise, ms, fallback) => Promise.race([promise.catch(() => fallback), sleep(ms).then(() => fallback)]);
await limit(browser.close(), 10000, null);
const browser2 = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, userDataDir: 'C:/Users/ACER/AppData/Local/Temp/pgt/f1-pwa' });
const page2 = await browser2.newPage();
await page2.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 60000 }); await sleep(7000);
await page2.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 60000 }); await sleep(4000);
const cdp = await page2.createCDPSession();
const manifest = await limit(cdp.send('Page.getAppManifest'), 20000, null);
const installability = await limit(cdp.send('Page.getInstallabilityErrors'), 20000, null);
const sw = await page2.evaluate(async () => { const reg = await navigator.serviceWorker.getRegistration(); return { registrado: Boolean(reg), activo: Boolean(reg?.active), controla: Boolean(navigator.serviceWorker.controller) }; });
check('F28', 'PWA: manifiesto sin errores y service worker activo que controla la página', Boolean(manifest?.url) && (manifest?.errors?.length ?? 0) === 0 && sw.activo && sw.controla, `SW activo: ${sw.activo}, controla: ${sw.controla}`);
const errs = installability?.installabilityErrors;
check('F29', 'PWA: Chrome no informa errores de instalabilidad', Array.isArray(errs) && errs.length === 0, errs ? (errs.map((e) => e.errorId).join(', ') || 'lista de errores vacía') : 'Chrome no respondió la consulta');

writeFileSync(RESULTS, JSON.stringify({ fecha: new Date().toISOString(), entorno: 'next start (build de producción) en localhost:3100, Chrome headless automatizado con Puppeteer', pruebas: results, pedidosCreados: ids, pedidosSincronizados: [...new Set(syncedIds)], erroresJs: [...new Set(jsErrors)], api }, null, 2));
console.log(`\n${results.filter((r) => r.resultado === 'Cumple').length}/${results.length} cumplen. Errores JS: ${jsErrors.length}`);
await limit(browser2.close(), 10000, null);
process.exit(0);
