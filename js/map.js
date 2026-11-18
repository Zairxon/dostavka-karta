// Карта на Leaflet (плитки OpenStreetMap), булавки и слои.
const L = window.L;
export const REGIONS = { khorezm: [41.55, 60.63], kk: [42.46, 59.61] }; // Ургенч, Нукус
export const getRegion = () => { try { return localStorage.getItem('dl_region') || 'khorezm'; } catch { return 'khorezm'; } };
export const setRegion = r => { try { localStorage.setItem('dl_region', r); } catch {} };

export function makeMap(el) {
  const map = L.map(el, { zoomControl: false, attributionControl: true }).setView(REGIONS[getRegion()] || REGIONS.khorezm, 9);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(map);
  L.control.zoom({ position: 'topright' }).addTo(map);
  const g = { points: L.layerGroup().addTo(map), couriers: L.layerGroup().addTo(map), route: L.layerGroup().addTo(map), temp: L.layerGroup().addTo(map) };
  return { map, g };
}

const ico = (cls, txt) => L.divIcon({ className: 'pin-wrap', html: `<div class="pin ${cls}"><span>${txt}</span></div>`, iconSize: [34, 42], iconAnchor: [17, 40] });
export const shopIcon = () => ico('shop', '●');
export const whIcon = () => ico('wh', '▣');
export const numIcon = (n, kind) => ico((kind || 'shop') + ' num', n);
export const courierIcon = (ini, stale) => L.divIcon({ className: 'pin-wrap', html: `<div class="cour ${stale ? 'stale' : ''}">${ini}</div>`, iconSize: [38, 38], iconAnchor: [19, 19] });
export const meIcon = () => L.divIcon({ className: 'pin-wrap', html: '<div class="me"></div>', iconSize: [20, 20], iconAnchor: [10, 10] });

export function fitTo(m, latlngs) {
  if (!latlngs.length) return;
  if (latlngs.length === 1) { m.map.setView(latlngs[0], 13); return; }
  m.map.fitBounds(L.latLngBounds(latlngs), { padding: [40, 40], maxZoom: 15 });
}
export const marker = (ll, icon) => L.marker(ll, { icon });
export const polyline = (pts, opt) => L.polyline(pts, opt);
