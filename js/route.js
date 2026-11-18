// Построение маршрута: склады перед своими точками, вместимость грузовика, ближайшие склады «по пути».
const OSRM = 'https://router.project-osrm.org';

export function hav(a, b) {
  const R = 6371000, r = Math.PI / 180;
  const dLat = (b.lat - a.lat) * r, dLng = (b.lng - a.lng) * r;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

// матрица времени/расстояния между точками (OSRM, при сбое — по прямой)
export async function matrix(pts) {
  const n = pts.length;
  const fallback = () => {
    const d = pts.map(a => pts.map(b => hav(a, b) * 1.35));
    return { dur: d.map(r => r.map(x => x / 9)), dist: d, approx: true }; // ~32 км/ч
  };
  if (n < 2) return { dur: [[0]], dist: [[0]], approx: false };
  try {
    const coords = pts.map(p => p.lng.toFixed(6) + ',' + p.lat.toFixed(6)).join(';');
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 9000);
    const r = await fetch(`${OSRM}/table/v1/driving/${coords}?annotations=duration,distance`, { signal: ctl.signal });
    clearTimeout(t);
    const j = await r.json();
    if (j.code !== 'Ok' || !j.durations) return fallback();
    const ok = j.durations.every(row => row.every(x => x != null));
    if (!ok) return fallback();
    return { dur: j.durations, dist: j.distances, approx: false };
  } catch { return fallback(); }
}

export async function geometry(pts) {
  if (pts.length < 2) return null;
  try {
    const coords = pts.map(p => p.lng.toFixed(6) + ',' + p.lat.toFixed(6)).join(';');
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 9000);
    const r = await fetch(`${OSRM}/route/v1/driving/${coords}?overview=full&geometries=geojson`, { signal: ctl.signal });
    clearTimeout(t);
    const j = await r.json();
    if (j.code !== 'Ok') return null;
    return j.routes[0].geometry.coordinates.map(c => [c[1], c[0]]);
  } catch { return null; }
}

// Подбор складов: жадно по покрытию потребности, при равенстве — ближе к доставщику.
// need: {productId: qty}; stock: [{w,p,q}]; whs: [{id,lat,lng}]
export function chooseWarehouses(need, stock, whs, from, prefer) {
  const left = { ...need }, take = {}; // take[w] = {p: qty}
  const stockMap = {};
  for (const s of stock) (stockMap[s.w] ||= {})[s.p] = s.q;
  const used = new Set();
  for (let guard = 0; guard < 20; guard++) {
    let best = null, bestCov = 0, bestD = 0;
    for (const w of whs) {
      if (used.has(w.id)) continue;
      let cov = 0;
      for (const p in left) if (left[p] > 0) cov += Math.min(left[p], stockMap[w.id]?.[p] || 0) / need[p];
      if (cov <= 1e-9) continue;
      const d = from ? hav(from, w) : 0;
      if (!best || cov > bestCov + 1e-9 || (Math.abs(cov - bestCov) < 1e-9 && d < bestD)) { best = w; bestCov = cov; bestD = d; }
    }
    if (guard === 0 && prefer) {
      const pw = whs.find(x => x.id === prefer);
      if (pw) { let c = 0; for (const p in left) c += Math.min(left[p], stockMap[pw.id]?.[p] || 0); if (c > 0) best = pw; }
    }
    if (!best) break;
    used.add(best.id);
    for (const p in left) {
      const t = Math.min(left[p], stockMap[best.id]?.[p] || 0);
      if (t > 0) { (take[best.id] ||= {})[p] = t; left[p] -= t; }
    }
  }
  const short = Object.entries(left).filter(([, q]) => q > 1e-9).map(([p, q]) => ({ p, q }));
  return { take, short };
}

// stops: [{key, type:'wh'|'shop'|'free', id, lat, lng, load (+ для склада, − для магазина), deps:[keys]}]
// idx 0 в матрице — старт. Возвращает порядок stops и итог.
export function order(stops, M, capacity) {
  const n = stops.length;
  if (!n) return { seq: [], dur: 0 };
  const keyIdx = new Map(stops.map((s, i) => [s.key, i]));
  const deps = stops.map(s => (s.deps || []).map(k => keyIdx.get(k)).filter(i => i != null));
  const cost = (a, b) => M.dur[a][b]; // a,b — индексы матрицы (0 старт, i+1 стоп)
  const valid = seq => {
    const done = new Set(); let load = 0;
    for (const i of seq) {
      for (const d of deps[i]) if (!done.has(d)) return false;
      load += stops[i].load || 0;
      if (capacity > 0 && load > capacity + 1e-9) return false;
      done.add(i);
    }
    return true;
  };
  const total = seq => { let t = 0, prev = 0; for (const i of seq) { t += cost(prev, i + 1); prev = i + 1; } return t; };

  let best = null, bestT = Infinity;
  if (n <= 8) {
    const used = new Array(n).fill(false), seq = [];
    const rec = (prev, t, load) => {
      if (t >= bestT) return;
      if (seq.length === n) { best = seq.slice(); bestT = t; return; }
      for (let i = 0; i < n; i++) {
        if (used[i]) continue;
        let ok = true;
        for (const d of deps[i]) if (!used[d]) { ok = false; break; }
        if (!ok) continue;
        const nl = load + (stops[i].load || 0);
        if (capacity > 0 && nl > capacity + 1e-9) continue;
        used[i] = true; seq.push(i);
        rec(i + 1, t + cost(prev, i + 1), nl);
        seq.pop(); used[i] = false;
      }
    };
    rec(0, 0, 0);
  }
  if (!best) { // ближайший сосед + улучшение 2-opt
    const used = new Set(), seq = []; let prev = 0, load = 0;
    while (seq.length < n) {
      let bi = -1, bc = Infinity;
      for (let i = 0; i < n; i++) {
        if (used.has(i)) continue;
        if (deps[i].some(d => !used.has(d))) continue;
        const nl = load + (stops[i].load || 0);
        if (capacity > 0 && nl > capacity + 1e-9) continue;
        const c = cost(prev, i + 1);
        if (c < bc) { bc = c; bi = i; }
      }
      if (bi < 0) { for (let i = 0; i < n; i++) if (!used.has(i)) { bi = i; break; } }
      used.add(bi); seq.push(bi); load += stops[bi].load || 0; prev = bi + 1;
    }
    best = seq; bestT = total(seq);
    let improved = true, guard = 0;
    while (improved && guard++ < 50) {
      improved = false;
      for (let i = 0; i < n - 1; i++) for (let j = i + 1; j < n; j++) {
        const cand = best.slice(0, i).concat(best.slice(i, j + 1).reverse(), best.slice(j + 1));
        if (!valid(cand)) continue;
        const t = total(cand);
        if (t + 1e-6 < bestT) { best = cand; bestT = t; improved = true; }
      }
    }
  }
  return { seq: best, dur: bestT };
}

// Время/расстояние по готовому порядку
export function legTotals(seq, M) {
  let t = 0, d = 0, prev = 0; const legs = [];
  for (const i of seq) { t += M.dur[prev][i + 1]; d += M.dist[prev][i + 1]; legs.push({ dur: M.dur[prev][i + 1], dist: M.dist[prev][i + 1] }); prev = i + 1; }
  return { dur: t, dist: d, legs };
}
