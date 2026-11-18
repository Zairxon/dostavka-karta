// Карта на Leaflet (плитки OpenStreetMap), булавки и слои.
const L = window.L;
export const REGIONS = { khorezm: [41.55, 60.63], kk: [42.46, 59.61] }; // Ургенч, Нукус
export const getRegion = () => { try { return localStorage.getItem('dl_region') || 'khorezm'; } catch { return 'khorezm'; } };
export const setRegion = r => { try { localStorage.setItem('dl_region', r); } catch {} };

export function makeMap(el) {
  const map = L.map(el, { zoomControl: false, attributionControl: true }).setView(REGIONS[getRegion()] || REGIONS.khorezm, 9);
  const scheme = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' });
  const sat = L.layerGroup([
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, attribution: 'Imagery © Esri' }),
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19 }),
  ]);
  const isSat = () => { try { return localStorage.getItem('dl_sat') === '1'; } catch { return false; } };
  let on = isSat(); (on ? sat : scheme).addTo(map);
  L.control.zoom({ position: 'topright' }).addTo(map);
  const Ctl = L.Control.extend({ options: { position: 'topright' }, onAdd() {
    const b = L.DomUtil.create('button', 'layer-btn'); b.type = 'button'; b.title = 'Layers';
    const paint = () => { b.innerHTML = on ? '🗺' : '🛰'; };
    paint(); L.DomEvent.disableClickPropagation(b);
    b.onclick = () => { map.removeLayer(on ? sat : scheme); on = !on; map.addLayer(on ? sat : scheme); try { localStorage.setItem('dl_sat', on ? '1' : '0'); } catch {} paint(); };
    return b;
  } });
  new Ctl().addTo(map);
  const g = { points: L.layerGroup().addTo(map), couriers: L.layerGroup().addTo(map), route: L.layerGroup().addTo(map), temp: L.layerGroup().addTo(map) };
  return { map, g };
}

const SVG_SHOP = '<svg viewBox="0 0 24 24" width="17" height="17"><path fill="currentColor" d="M4 4h16l1.2 5.2A3 3 0 0118.5 13v7H5.5v-7A3 3 0 012.8 9.2L4 4zm3 9.5V18h4v-4.5H7zm6 0V18h4v-4.5h-4z"/></svg>';
const SVG_WH = '<svg viewBox="0 0 24 24" width="17" height="17"><path fill="currentColor" d="M12 3l10 5.5V21h-4.5v-9h-11v9H2V8.5L12 3zM8.5 14h7v2h-7v-2zm0 3.2h7v2h-7v-2z"/></svg>';
const ico = (cls, txt) => L.divIcon({ className: 'pin-wrap', html: `<div class="pin ${cls}"><span>${txt}</span></div>`, iconSize: [38, 46], iconAnchor: [19, 44] });
export const shopIcon = () => ico('shop', SVG_SHOP);
export const whIcon = () => ico('wh', SVG_WH);
export const numIcon = (n, kind) => ico((kind || 'shop') + ' num', n);
const arrow = (cls, h) => (h == null ? '' : `<b class="${cls}" style="transform:rotate(${Math.round(h)}deg)"></b>`);
export const courierIcon = (ini, stale, role, heading) => L.divIcon({ className: 'pin-wrap', html: `<div class="cour ${role === 'agent' ? 'agent' : ''} ${stale ? 'stale' : ''}">${arrow('arr', heading)}${ini}</div>`, iconSize: [38, 38], iconAnchor: [19, 19] });
export function updateCourierIcon(mk, stale, heading) {
  const el = mk.getElement && mk.getElement(); const c = el && el.querySelector('.cour'); if (!c) return;
  c.classList.toggle('stale', !!stale);
  let ar = c.querySelector('.arr');
  if (heading == null) { if (ar) ar.remove(); return; }
  if (!ar) { ar = document.createElement('b'); ar.className = 'arr'; c.prepend(ar); }
  ar.style.transform = `rotate(${Math.round(heading)}deg)`;
}
export function animateTo(mk, to, ms = 1800) {
  const from = mk.getLatLng(), t0 = performance.now();
  if (mk._raf) cancelAnimationFrame(mk._raf);
  const step = now => { const k = Math.min(1, (now - t0) / ms); mk.setLatLng([from.lat + (to[0] - from.lat) * k, from.lng + (to[1] - from.lng) * k]); if (k < 1) mk._raf = requestAnimationFrame(step); };
  mk._raf = requestAnimationFrame(step);
}
export const meIcon = heading => L.divIcon({ className: 'pin-wrap', html: `<div class="me">${arrow('arrow', heading)}</div>`, iconSize: [20, 20], iconAnchor: [10, 10] });

export function fitTo(m, latlngs) {
  if (!latlngs.length) return;
  if (latlngs.length === 1) { m.map.setView(latlngs[0], 13); return; }
  m.map.fitBounds(L.latLngBounds(latlngs), { padding: [40, 40], maxZoom: 15 });
}
export const marker = (ll, icon) => L.marker(ll, { icon });
export const polyline = (pts, opt) => L.polyline(pts, opt);
