import { rpc, session } from './api.js';
import { t, setLang, getLang, LANGS, errText } from './i18n.js';
import { $, esc, cap, toast, confirmDlg, infoDlg, formDlg, pickDlg, sheet, selectHtml, bindSelects, bindPhone, fmtPhone, phoneOk } from './ui.js';
import * as M from './map.js';
import * as R from './route.js';

export const VERSION = '1.5.2';
const root = document.getElementById('app');
const S = { me: null, d: null, tab: null, view: null, pos: null, busy: false };
let P = {}, PR = {}, U = {};
const num = n => { n = Number(n); return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100); };
const UNIT = { 'шт': 'unit_pcs', 'блок': 'unit_block', 'коробка': 'unit_box' };
const unitL = u => t(UNIT[u] || 'unit_pcs');
const prodL = id => PR[id] ? PR[id].name : '—';
const min = s => Math.max(1, Math.round(s / 60));
const initials = n => (n || '?').split(/\s+/).map(x => x[0]).join('').slice(0, 2).toUpperCase();
const telLink = p => p ? `<a href="tel:${esc(p.replace(/\s/g, ''))}">${esc(p)}</a>` : '';
const navPref = () => { try { return localStorage.getItem('dl_nav') || 'yandex'; } catch { return 'yandex'; } };
const navLabel = () => t(navPref() === 'google' ? 'open_google' : 'open_yandex');
const navUrl = p => navPref() === 'google'
  ? `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}&travelmode=driving`
  : `https://yandex.com/maps/?rtext=~${p.lat},${p.lng}&rtt=auto`;
// весь маршрут одной ссылкой: начало — текущее место, затем остановки по порядку
const navAllUrl = (pts, from) => navPref() === 'google'
  ? `https://www.google.com/maps/dir/?api=1${from ? `&origin=${from.lat},${from.lng}` : ''}&destination=${pts[pts.length - 1].lat},${pts[pts.length - 1].lng}${pts.length > 1 ? '&waypoints=' + pts.slice(0, -1).map(p => p.lat + ',' + p.lng).join('|') : ''}&travelmode=driving`
  : `https://yandex.com/maps/?rtext=${from ? from.lat + ',' + from.lng : ''}~${pts.map(p => p.lat + ',' + p.lng).join('~')}&rtt=auto`;
const geoMsg = c => t(c === 1 ? 'gps_denied' : c === 3 ? 'gps_timeout' : c === 2 ? 'gps_unavailable' : 'gps_off');
const itemsText = o => o.items.map(i => `${esc(prodL(i.p))} — ${num(i.q)} ${esc(unitL(PR[i.p]?.unit))}`).join('<br>');
const overlayOpen = () => !!document.querySelector('.ov');

async function call(fn, args, okMsg) {
  try { const r = await rpc(fn, args); if (okMsg) toast(okMsg); return r; }
  catch (e) {
    if (e.code === 'auth') { await doLogout(true); return undefined; }
    toast(errText(e), 'err'); throw e;
  }
}
const safe = async (fn, args, okMsg) => { try { return { ok: true, v: await call(fn, args, okMsg) }; } catch { return { ok: false }; } };

// ================= вход / выход =================
function loginView() {
  S.cleanup && S.cleanup(); S.cleanup = null; S.view = null;
  root.innerHTML = `<div class="login"><div class="login-card">
    <div class="logo">${logoSvg()}</div><h1>${esc(t('app_name'))}</h1>
    <label class="fl"><span>${esc(t('login'))}</span><input id="lg" autocomplete="username" autocapitalize="none"></label>
    <label class="fl"><span>${esc(t('password'))}</span><input id="pw" type="password" autocomplete="current-password"></label>
    <small class="err" id="lerr"></small>
    <button class="btn wide" id="lgo">${esc(t('sign_in'))}</button>
    <div class="lang-row">${selectHtml('lng', LANGS, getLang())}</div>
    <div class="ver">${esc(t('version'))} ${VERSION}</div></div></div>`;
  bindSelects(root, (id, v) => { setLang(v); loginView(); });
  const go = async () => {
    const l = $('#lg').value.trim(), p = $('#pw').value;
    if (!l || !p) { $('#lerr').textContent = t('fill_required'); return; }
    $('#lgo').disabled = true;
    try {
      const r = await rpc('dl_login', { p_login: l, p_pass: p }, false);
      session.set(r.token); await boot();
    } catch (e) { $('#lerr').textContent = errText(e); $('#lgo').disabled = false; }
  };
  $('#lgo').onclick = go; $('#pw').onkeydown = e => { if (e.key === 'Enter') go(); };
}
function logoSvg() {
  return `<svg viewBox="0 0 64 64" width="64" height="64"><rect width="64" height="64" rx="16" fill="#0f766e"/><path d="M32 12c-7 0-12 5-12 12 0 9 12 22 12 22s12-13 12-22c0-7-5-12-12-12zm0 17a5 5 0 110-10 5 5 0 010 10z" fill="#fff"/><path d="M14 52h36" stroke="#f59e0b" stroke-width="4" stroke-linecap="round"/></svg>`;
}
async function doLogout(silent) {
  if (!silent) { try { await rpc('dl_logout', {}); } catch {} }
  try { localStorage.removeItem('dl_admin_token'); } catch {}
  session.set(''); S.me = null; S.d = null; stopGeo(); clearInterval(S.poll);
  loginView();
}

// ================= загрузка данных =================
function index(d) {
  P = Object.fromEntries(d.points.map(p => [p.id, p]));
  PR = Object.fromEntries(d.products.map(p => [p.id, p]));
  U = Object.fromEntries(d.users.map(u => [u.id, u]));
}
// ----- уведомления о заказах -----
let seen = null;
function beep() {
  try {
    const c = new (window.AudioContext || window.webkitAudioContext)(); const o = c.createOscillator(), g = c.createGain();
    o.connect(g); g.connect(c.destination); o.type = 'sine'; o.frequency.value = 880; g.gain.setValueAtTime(.18, c.currentTime);
    g.gain.exponentialRampToValueAtTime(.001, c.currentTime + .5); o.start(); o.stop(c.currentTime + .5);
    setTimeout(() => c.close(), 700);
  } catch {}
}
function notify(msg) {
  toast(msg); beep();
  try { if ('Notification' in window && Notification.permission === 'granted') new Notification(t('app_name'), { body: msg, icon: 'icon.svg' }); } catch {}
  try { navigator.vibrate && navigator.vibrate(200); } catch {}
}
function detect(d) {
  const next = new Map(d.orders.map(o => [o.id, o]));
  if (seen) {
    const role = d.me.role;
    for (const o of d.orders) {
      const old = seen.get(o.id), shop = (d.points.find(p => p.id === o.shop_id) || {}).name || '';
      const vars = { n: o.no, shop };
      if (!old) {
        if (role === 'admin' && o.agent_id !== d.me.id) notify(t('notif_new_order', vars));
        else if (role === 'courier') notify(t('notif_assigned', vars));
        continue;
      }
      if (role === 'courier' && old.status !== o.status && o.status === 'cancelled') notify(t('notif_cancelled', vars));
      if (role === 'agent' && old.status !== o.status) {
        if (o.status === 'delivered') notify(t('notif_delivered', vars));
        if (o.status === 'cancelled') notify(t('notif_cancelled', vars));
      }
      if (role === 'admin' && old.status !== o.status && o.status === 'delivered') notify(t('notif_delivered', vars));
    }
    if (role === 'courier') for (const [id, o] of seen) if (!next.has(id) && o.status === 'assigned') notify(t('notif_unassigned', { n: o.no }));
  }
  seen = next;
}
function badge() {
  const b = root.querySelector('[data-tab="orders"] .bd'); if (!b) return;
  const n = S.me.role === 'admin' ? S.d.orders.filter(o => o.status === 'new').length : 0;
  b.textContent = n; b.hidden = !n;
}
async function refresh() {
  if (!session.token) return;
  try {
    const d = await rpc('dl_snapshot', {});
    detect(d); S.d = d; S.me = d.me; index(d); badge();
    if (S.view && S.view.update) S.view.update();
  } catch (e) { if (e.code === 'auth') await doLogout(true); }
}
async function boot() {
  if (!session.token) { loginView(); return; }
  try {
    const d = await rpc('dl_snapshot', {});
    seen = null; detect(d); S.d = d; S.me = d.me; index(d);
  } catch (e) { if (e.code === 'auth' || e.code === 'bad_login') { session.set(''); loginView(); } else { root.innerHTML = `<div class="login"><div class="login-card"><p>${esc(errText(e))}</p><button class="btn" onclick="location.reload()">${esc(t('update_btn'))}</button></div></div>`; } return; }
  S.tab = tabsFor()[0].k;
  shell();
  clearInterval(S.poll); S.poll = setInterval(() => { if (!document.hidden) refresh(); }, S.me.role === 'admin' ? 6000 : 9000);
  startGeo();
}
const tabsFor = () => ({
  admin: [{ k: 'map', i: '◎', l: 'tab_map' }, { k: 'orders', i: '▤', l: 'tab_orders' }, { k: 'stock', i: '▣', l: 'tab_stock' }, { k: 'people', i: '☺', l: 'tab_people' }, { k: 'more', i: '≡', l: 'tab_more' }],
  agent: [{ k: 'orders', i: '▤', l: 'tab_orders' }, { k: 'map', i: '◎', l: 'tab_points' }, { k: 'more', i: '≡', l: 'tab_more' }],
  courier: [{ k: 'route', i: '➤', l: 'tab_route' }, { k: 'map', i: '◎', l: 'tab_points' }, { k: 'more', i: '≡', l: 'tab_more' }],
}[S.me.role]);

function shell() {
  root.innerHTML = `<header class="top"><div class="ttl">${esc(t('app_name'))}</div><div class="who"><b>${esc(S.me.name || S.me.login)}</b><span>${esc(t('role_' + S.me.role))}</span></div></header>
    ${impersonating() ? `<div class="upd as"><span>${esc(t('as_user'))}: <b>${esc(S.me.name || S.me.login)}</b> (${esc(t('role_' + S.me.role))})</span><button class="btn sm" id="backadm">${esc(t('back_admin'))}</button></div>` : ''}
    <div id="upd" class="upd" hidden><span>${esc(t('update_avail'))}</span><button class="btn sm" id="updb">${esc(t('update_btn'))}</button></div>
    <main id="main"></main>
    <nav class="tabs">${tabsFor().map(x => `<button data-tab="${x.k}"><i>${x.i}</i><span>${esc(t(x.l))}</span><em class="bd" hidden></em></button>`).join('')}</nav>`;
  root.querySelector('.tabs').onclick = e => { const b = e.target.closest('[data-tab]'); if (b) go(b.dataset.tab); };
  $('#updb').onclick = applyUpdate;
  const ba = $('#backadm'); if (ba) ba.onclick = backToAdmin;
  go(S.tab); badge();
  checkUpdate();
}
function go(tab) {
  S.tab = tab;
  root.querySelectorAll('.tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === (tab === 'report' ? 'more' : tab)));
  S.cleanup && S.cleanup(); S.cleanup = null; S.view = null; root.classList.remove('fs');
  const main = $('#main'); main.innerHTML = ''; main.scrollTop = 0;
  const v = { map: mapView, orders: ordersView, stock: stockView, people: peopleView, more: moreView, route: routeView, report: reportView }[tab];
  S.view = v(main) || null;
}

// ================= вход под сотрудником (админ) =================
async function switchTo(uid) {
  const r = await safe('dl_impersonate', { p_user: uid }); if (!r.ok) return;
  try { if (!localStorage.getItem('dl_admin_token')) localStorage.setItem('dl_admin_token', session.token); } catch {}
  await reenter(r.v.token);
}
async function backToAdmin() {
  let at = ''; try { at = localStorage.getItem('dl_admin_token') || ''; localStorage.removeItem('dl_admin_token'); } catch {}
  if (!at) return;
  try { await rpc('dl_logout', {}); } catch {}
  await reenter(at);
}
async function reenter(token) {
  stopGeo(); clearInterval(S.poll); S.cleanup && S.cleanup(); S.cleanup = null; S.view = null; seen = null;
  session.set(token); await boot();
}

// ================= обновление приложения =================
async function checkUpdate() {
  try {
    const r = await fetch('version.json?t=' + Date.now(), { cache: 'no-store' });
    const j = await r.json();
    if (j.version && j.version !== VERSION) { const u = $('#upd'); if (u) u.hidden = false; }
  } catch {}
}
setInterval(checkUpdate, 5 * 60 * 1000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) { checkUpdate(); refresh(); } });
async function applyUpdate() {
  const b = $('#updb'); if (b) { b.disabled = true; b.textContent = '…'; }
  try {
    // сбросить кэш браузера для файлов приложения, затем перезагрузить
    const files = ['./', 'index.html', 'style.css', 'js/app.js', 'js/api.js', 'js/i18n.js', 'js/ui.js', 'js/map.js', 'js/route.js', 'sw.js', 'version.json'];
    await Promise.all(files.map(f => fetch(f, { cache: 'reload' }).catch(() => {})));
    const regs = await navigator.serviceWorker.getRegistrations(); for (const r of regs) await r.unregister();
    const ks = await caches.keys(); for (const k of ks) await caches.delete(k);
  } catch {}
  location.reload();
}

// ================= геолокация доставщика =================
let geoId = null, lastSent = null, lastSentAt = 0;
const impersonating = () => { try { return !!localStorage.getItem('dl_admin_token'); } catch { return false; } };
function startGeo() {
  if (!navigator.geolocation) { S.geoErr = 2; return; }
  if (geoId != null) return;
  const sendable = () => (S.me.role === 'courier' || S.me.role === 'agent') && !impersonating();
  const ok = p => {
    S.geoErr = 0; S.pos = { lat: p.coords.latitude, lng: p.coords.longitude, heading: Number.isFinite(p.coords.heading) ? p.coords.heading : null, speed: Number.isFinite(p.coords.speed) ? p.coords.speed : null };
    if (S.follow && S.map) S.map.panTo([S.pos.lat, S.pos.lng], { animate: true });
    S.view && S.view.onPos && S.view.onPos();
    if (!sendable()) return;
    const now = Date.now();
    if (!lastSent || (now - lastSentAt > 15000 && R.hav(lastSent, S.pos) > 15) || now - lastSentAt > 90000) {
      lastSent = S.pos; lastSentAt = now;
      rpc('dl_location', { p_lat: S.pos.lat, p_lng: S.pos.lng, p_heading: S.pos.heading, p_speed: S.pos.speed }).catch(() => {});
    }
  };
  const watch = hi => {
    geoId = navigator.geolocation.watchPosition(ok, e => {
      S.geoErr = e.code; S.view && S.view.onPos && S.view.onPos();
      if (e.code === 3 && hi) { navigator.geolocation.clearWatch(geoId); watch(false); } // не поймали точно — берём приблизительно
    }, { enableHighAccuracy: hi, maximumAge: 15000, timeout: hi ? 15000 : 30000 });
  };
  watch(true);
}
function stopGeo() { if (geoId != null) navigator.geolocation.clearWatch(geoId); geoId = null; lastSent = null; }

// ================= карта точек =================
function mapView(main) {
  const role = S.me.role;
  main.innerHTML = `<div class="mapbox"><div id="map"></div>
    <div class="mapbar">${role === 'admin' ? `<button class="btn sm" data-add="shop">＋ ${esc(t('shop'))}</button><button class="btn sm alt" data-add="warehouse">＋ ${esc(t('warehouse'))}</button>` : role === 'agent' ? `<button class="btn sm" data-add="shop">＋ ${esc(t('shop'))}</button>` : `<button class="btn sm" data-add="shop">＋ ${esc(t('shop'))}</button>`}
    <button class="btn sm ghost" id="locme">◉</button><button class="btn sm ghost" id="srch">🔍</button><button class="btn sm ghost" id="regb">⌖</button><button class="btn sm ghost" id="fsb">⛶</button></div>
    <div class="banner" id="banner" hidden><span>${esc(t('pick_on_map'))}</span><button class="btn sm ghost" id="pickx">${esc(t('pick_cancel'))}</button></div>
    <div class="legend"><i class="d shop"></i>${esc(t('legend_shop'))} <i class="d wh"></i>${esc(t('legend_wh'))}${role === 'admin' ? ` <i class="d cour"></i>${esc(t('legend_courier'))} <i class="d agt"></i>${esc(t('role_agent'))}` : ''}</div></div>`;
  const m = M.makeMap($('#map', main)); let fitted = false, picking = null;
  S.cleanup = () => m.map.remove();
  const draw = () => {
    m.g.points.clearLayers();
    const ll = [];
    for (const p of S.d.points) {
      const mk = M.marker([p.lat, p.lng], p.kind === 'warehouse' ? M.whIcon() : M.shopIcon()).addTo(m.g.points);
      mk.bindTooltip(esc(p.name), { direction: 'top', offset: [0, -34] });
      mk.on('click', () => { if (!picking) pointSheet(p.id); });
      ll.push([p.lat, p.lng]);
    }
    if (role === 'admin') for (const c of S.d.locations) ll.push([c.lat, c.lng]);
    drawMe();
    if (!fitted && ll.length) { fitted = true; M.fitTo(m, ll); }
  };
  const drawMe = () => { m.g.route.clearLayers(); if (S.pos) M.marker([S.pos.lat, S.pos.lng], M.meIcon(S.pos.heading)).addTo(m.g.route); };
  draw();
  bindFs($('#fsb', main), m);
  // ----- живое положение сотрудников (админ): плавное движение, слежение, путь -----
  const live = new Map(); let follow = null, trail = null, liveTimer = null;
  const chip = document.createElement('div'); chip.className = 'fchip'; chip.hidden = true; $('.mapbox', main).appendChild(chip);
  const setChip = (html, onClose) => { chip.hidden = !html; if (!html) return; chip.innerHTML = `<span>${html}</span><button class="btn sm ghost" id="fx">✕</button>`; chip.querySelector('#fx').onclick = onClose; };
  const setFollow = id => {
    follow = id;
    if (!id) { setChip('', null); return; }
    const u = U[id], e = live.get(id);
    setChip(`${esc(t('following'))}: <b>${esc(u?.name || u?.login || '')}</b>`, () => setFollow(null));
    if (e) m.map.setView(e.ll, Math.max(m.map.getZoom(), 15));
  };
  const showTrack = async id => {
    const r = await safe('dl_track_get', { p_user: id, p_hours: 12 }); if (!r.ok) return;
    if (trail) { m.map.removeLayer(trail); trail = null; }
    if (!r.v.length) return toast(t('no_track'), 'err');
    trail = M.polyline(r.v.map(x => [x[0], x[1]]), { color: '#2563eb', weight: 5, opacity: .85 }).addTo(m.map);
    m.map.fitBounds(trail.getBounds(), { padding: [50, 50], maxZoom: 16 });
    const u = U[id];
    setChip(`${esc(t('trail_on'))}: <b>${esc(u?.name || u?.login || '')}</b>`, () => { if (trail) m.map.removeLayer(trail); trail = null; setChip('', null); });
  };
  const applyLive = list => {
    const ids = new Set();
    for (const c of list) {
      const u = U[c.id]; if (!u) continue; ids.add(c.id);
      const stale = (Date.now() - new Date(c.ts).getTime()) / 60000 > 10;
      let e = live.get(c.id);
      if (!e) {
        const mk = M.marker([c.lat, c.lng], M.courierIcon(esc(initials(u.name || u.login)), stale, u.role, c.heading)).addTo(m.g.couriers);
        mk.on('click', () => courierSheet(e.c, u, { follow: setFollow, track: showTrack }));
        mk.bindTooltip(esc(u.name || u.login), { direction: 'top', offset: [0, -16] });
        e = { mk, ll: [c.lat, c.lng], c }; live.set(c.id, e);
      } else { e.c = c; e.ll = [c.lat, c.lng]; M.animateTo(e.mk, e.ll); M.updateCourierIcon(e.mk, stale, c.heading); }
      if (follow === c.id) m.map.panTo(e.ll, { animate: true, duration: 1.2 });
    }
    for (const [id, e] of live) if (!ids.has(id)) { m.g.couriers.removeLayer(e.mk); live.delete(id); }
  };
  if (role === 'admin') {
    applyLive(S.d.locations);
    liveTimer = setInterval(async () => { if (document.hidden) return; try { applyLive(await rpc('dl_live', {})); } catch {} }, 3000);
  }
  S.cleanup = () => { clearInterval(liveTimer); m.map.remove(); };
  main.querySelectorAll('[data-add]').forEach(b => b.onclick = () => startPick(b.dataset.add));
  $('#locme', main).onclick = () => {
    if (S.pos) { m.map.setView([S.pos.lat, S.pos.lng], 15); return; }
    if (!navigator.geolocation) return toast(geoMsg(2), 'err');
    navigator.geolocation.getCurrentPosition(p => { S.pos = { lat: p.coords.latitude, lng: p.coords.longitude }; S.geoErr = 0; drawMe(); m.map.setView([S.pos.lat, S.pos.lng], 15); startGeo(); }, e => { S.geoErr = e.code; toast(geoMsg(e.code), 'err'); }, { enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 });
  };
  $('#srch', main).onclick = async () => {
    const id = await searchPoints(S.d.points);
    if (id) { const p = P[id]; m.map.setView([p.lat, p.lng], 15); pointSheet(id); }
  };
  $('#regb', main).onclick = async () => {
    const r = await pickDlg(t('go_region'), regionOpts());
    if (r) { M.setRegion(r); m.map.setView(M.REGIONS[r], 10); }
  };
  const stopPick = () => { picking = null; $('#banner', main).hidden = true; m.g.temp.clearLayers(); m.map.off('click', onTap); $('#map', main).classList.remove('pick'); };
  const onTap = async e => {
    const kind = picking; stopPick();
    const tmp = M.marker(e.latlng, kind === 'warehouse' ? M.whIcon() : M.shopIcon()).addTo(m.g.temp);
    const v = await formDlg(t(kind === 'warehouse' ? 'add_wh' : 'add_shop'), [
      { k: 'name', label: t('point_name'), req: true },
      { k: 'address', label: t('address') },
      { k: 'phone', label: t('phone'), type: 'phone' }]);
    m.g.temp.clearLayers(); void tmp;
    if (!v) return;
    const r = await safe('dl_point_save', { p_id: null, p_kind: kind, p_name: v.name, p_address: v.address, p_phone: v.phone, p_lat: e.latlng.lat, p_lng: e.latlng.lng }, t('saved'));
    if (r.ok) { await refresh(); }
  };
  function startPick(kind) { picking = kind; $('#banner', main).hidden = false; $('#map', main).classList.add('pick'); m.map.on('click', onTap); }
  $('#pickx', main).onclick = stopPick;
  if (S.autoPick) { const k = S.autoPick; S.autoPick = null; startPick(k); }
  return { update() { draw(); }, onPos() { drawMe(); } };
}

function bindFs(btn, m) {
  if (!btn) return;
  const paint = () => { btn.textContent = root.classList.contains('fs') ? '✕' : '⛶'; };
  btn.onclick = () => { root.classList.toggle('fs'); paint(); setTimeout(() => m.map.invalidateSize(), 120); setTimeout(() => m.map.invalidateSize(), 400); };
  paint();
}
const regionOpts = () => [{ v: 'khorezm', l: t('region_khorezm') }, { v: 'kk', l: t('region_kk') }];

// Поиск точки по названию/адресу: окно с полем и списком результатов
function searchPoints(points) {
  return new Promise(res => {
    const ov = sheet(`<h3>${esc(t('search'))}</h3><input id="sq" placeholder="${esc(t('search_ph'))}" autocomplete="off"><div class="opts" id="sres" style="margin-top:10px"></div>`);
    const list = () => {
      const q = $('#sq', ov).value.trim().toLowerCase();
      const r = points.filter(p => !q || (p.name + ' ' + p.address).toLowerCase().includes(q)).slice(0, 40);
      $('#sres', ov).innerHTML = r.length ? r.map(p => `<button class="opt" data-v="${p.id}">${esc(p.name)}<small>${esc(t(p.kind === 'warehouse' ? 'warehouse' : 'shop'))}${p.address ? ' · ' + esc(p.address) : ''}</small></button>`).join('') : `<p class="mut">${esc(t('search_none'))}</p>`;
    };
    list(); $('#sq', ov).addEventListener('input', list); setTimeout(() => $('#sq', ov).focus(), 250);
    let done = false;
    ov.addEventListener('click', e => { const b = e.target.closest('.opt'); if (b && !done) { done = true; ov.querySelector('[data-x]') ; ov.classList.remove('in'); setTimeout(() => ov.remove(), 200); res(b.dataset.v); } });
    new MutationObserver((_, ob) => { if (!document.body.contains(ov)) { ob.disconnect(); if (!done) { done = true; res(null); } } }).observe(document.body, { childList: true });
  });
}

function courierSheet(c, u, acts) {
  const age = Math.round((Date.now() - new Date(c.ts).getTime()) / 60000);
  const mine = S.d.orders.filter(o => o.courier_id === u.id && ['assigned', 'picked'].includes(o.status));
  sheet(`<h3>${esc(u.name || u.login)}</h3><p class="mut">${esc(t('role_' + u.role))} · ${age < 1 ? esc(t('just_now')) : esc(t('ago_min', { m: age }))}</p>
    <p>${telLink(u.phone)}${c.speed > 0.8 ? ` · ${Math.round(c.speed * 3.6)} ${esc(t('kmh'))}` : ''}</p>
    ${mine.length ? mine.map(o => `<div class="mini">${esc(t('order_no'))}${o.no} · ${esc(P[o.shop_id]?.name || '')} <span class="chip s-${o.status}">${esc(t('status_' + o.status))}</span></div>`).join('') : `<p class="mut">${esc(t('nothing'))}</p>`}
    <div class="acts">${acts ? `<button class="btn sm" data-a="follow">${esc(t('follow_btn'))}</button><button class="btn sm alt" data-a="track">${esc(t('track_btn'))}</button>` : ''}</div>
    <div class="row end"><button class="btn ghost" data-x>${esc(t('ok'))}</button></div>`, (o, close) => {
    o.addEventListener('click', e => { const b = e.target.closest('[data-a]'); if (b && acts) { close(); acts[b.dataset.a](u.id); } });
  });
}

function pointSheet(id) {
  const p = P[id]; if (!p) return;
  const role = S.me.role, isWh = p.kind === 'warehouse';
  const stock = isWh ? S.d.stock.filter(s => s.w === id) : [];
  const canEdit = role === 'admin' || (p.created_by === S.me.id && !isWh);
  sheet(`<h3>${esc(p.name)} <span class="chip ${isWh ? 'wh' : 'shop'}">${esc(t(isWh ? 'warehouse' : 'shop'))}</span></h3>
    ${p.address ? `<p>${esc(p.address)}</p>` : ''}${p.phone ? `<p>${telLink(p.phone)}</p>` : ''}
    ${isWh ? `<div class="mini-list">${stock.length ? stock.map(s => `<div class="mini"><span>${esc(prodL(s.p))}</span><b>${num(s.q)} ${esc(unitL(PR[s.p]?.unit))}</b></div>`).join('') : `<p class="mut">${esc(t('nothing'))}</p>`}</div>` : ''}
    <div class="acts">
      <a class="btn sm alt" target="_blank" rel="noopener" href="${navUrl(p)}">${esc(navLabel())}</a>
      ${role === 'courier' ? `<button class="btn sm" data-a="mark">${esc(t('mark_point'))}</button>` : ''}
      ${role === 'admin' ? `<button class="btn sm" data-a="send">${esc(t('mark_for'))}</button>` : ''}
      ${!isWh && role !== 'courier' ? `<button class="btn sm" data-a="order">${esc(t('new_order'))}</button>` : ''}
      ${canEdit ? `<button class="btn sm ghost" data-a="edit">${esc(t('edit'))}</button>` : ''}
      ${role === 'admin' ? `<button class="btn sm danger" data-a="del">${esc(t('delete'))}</button>` : ''}
    </div><div class="row end"><button class="btn ghost" data-x>${esc(t('ok'))}</button></div>`, (o, close) => {
    o.addEventListener('click', async e => {
      const a = e.target.closest('[data-a]'); if (!a) return;
      const act = a.dataset.a; close();
      if (act === 'mark') { const r = await safe('dl_mark_add', { p_point: id, p_courier: null }, t('marked')); if (r.ok) refresh(); }
      if (act === 'send') {
        const cs = S.d.users.filter(u => u.role === 'courier' && u.active !== false);
        const cid = await pickDlg(t('courier'), cs.map(u => ({ v: u.id, l: u.name || u.login })));
        if (cid) { const r = await safe('dl_mark_add', { p_point: id, p_courier: cid }, t('marked')); if (r.ok) refresh(); }
      }
      if (act === 'order') newOrderSheet(id);
      if (act === 'edit') {
        const v = await formDlg(t('edit_point'), [{ k: 'name', label: t('point_name'), value: p.name, req: true }, { k: 'address', label: t('address'), value: p.address }, { k: 'phone', label: t('phone'), type: 'phone', value: p.phone }]);
        if (v) { const r = await safe('dl_point_save', { p_id: id, p_kind: p.kind, p_name: v.name, p_address: v.address, p_phone: v.phone, p_lat: p.lat, p_lng: p.lng }, t('saved')); if (r.ok) refresh(); }
      }
      if (act === 'del' && await confirmDlg(t('confirm_delete'), p.name, t('delete'), true)) { const r = await safe('dl_point_delete', { p_id: id }, t('saved')); if (r.ok) refresh(); }
    });
  });
}

// ================= заказы =================
function ordersView(main) {
  let seg = 'active', q = '';
  const match = o => !q || (`${o.no} ${P[o.shop_id]?.name || ''} ${P[o.shop_id]?.address || ''} ${U[o.courier_id]?.name || ''} ${U[o.agent_id]?.name || ''}`).toLowerCase().includes(q);
  const cardsHtml = () => {
    const all = S.d.orders.filter(match);
    const list = all.filter(o => seg === 'active' ? ['new', 'assigned', 'picked'].includes(o.status) : ['delivered', 'cancelled'].includes(o.status));
    return list.length ? list.map(orderCard).join('') : `<p class="empty">${esc(t(q ? 'search_none' : 'nothing'))}</p>`;
  };
  const bindCards = () => main.querySelectorAll('[data-o]').forEach(c => c.onclick = () => orderSheet(c.dataset.o));
  const draw = () => {
    const all = S.d.orders;
    const act = all.filter(o => ['new', 'assigned', 'picked'].includes(o.status));
    main.innerHTML = `<div class="page"><div class="bar"><div class="seg"><button data-s="active" class="${seg === 'active' ? 'on' : ''}">${esc(t('active'))} (${act.length})</button><button data-s="done" class="${seg === 'done' ? 'on' : ''}">${esc(t('done_recent'))}</button></div>
      ${S.me.role !== 'courier' ? `<button class="btn" id="newo">＋ ${esc(t('new_order'))}</button>` : ''}</div>
      <input id="oq" class="search" placeholder="🔍 ${esc(t('search_ph'))}" value="${esc(q)}" autocomplete="off">
      <div class="cards" id="ocards">${cardsHtml()}</div></div>`;
    main.querySelectorAll('[data-s]').forEach(b => b.onclick = () => { seg = b.dataset.s; draw(); });
    const nb = $('#newo', main); if (nb) nb.onclick = () => newOrderSheet();
    $('#oq', main).oninput = e => { q = e.target.value.trim().toLowerCase(); $('#ocards', main).innerHTML = cardsHtml(); bindCards(); };
    bindCards();
  };
  draw();
  return { update() { if (overlayOpen()) return; if (document.activeElement === $('#oq', main)) { $('#ocards', main).innerHTML = cardsHtml(); bindCards(); } else draw(); } };
}
function orderCard(o) {
  const sh = P[o.shop_id];
  return `<div class="card click" data-o="${o.id}"><div class="ch"><b>${esc(t('order_no'))}${o.no} · ${esc(sh ? sh.name : '—')}</b><span class="chip s-${o.status}">${esc(t('status_' + o.status))}</span></div>
    <div class="mut sm">${itemsText(o)}</div>
    <div class="mut sm">${esc(t('courier'))}: ${esc(o.courier_id ? (U[o.courier_id]?.name || U[o.courier_id]?.login || '—') : t('unassigned'))}${o.agent_id && U[o.agent_id] ? ` · ${esc(t('agent'))}: ${esc(U[o.agent_id].name || U[o.agent_id].login)}` : ''}</div></div>`;
}
function orderSheet(id) {
  const o = S.d.orders.find(x => x.id === id); if (!o) return;
  const role = S.me.role, sh = P[o.shop_id];
  const live = ['new', 'assigned'].includes(o.status);
  sheet(`<h3>${esc(t('order_no'))}${o.no} <span class="chip s-${o.status}">${esc(t('status_' + o.status))}</span></h3>
    <p><b>${esc(sh ? sh.name : '—')}</b>${sh && sh.address ? `<br><span class="mut">${esc(sh.address)}</span>` : ''}</p>
    <div class="mini-list">${o.items.map(i => `<div class="mini"><span>${esc(prodL(i.p))}</span><b>${num(i.picked)}/${num(i.q)} ${esc(unitL(PR[i.p]?.unit))}</b></div>`).join('')}</div>
    ${o.note ? `<p class="mut">${esc(o.note)}</p>` : ''}
    <p class="mut sm">${esc(t('courier'))}: ${esc(o.courier_id ? (U[o.courier_id]?.name || '—') : t('unassigned'))}</p>
    <div class="acts">
      ${role === 'admin' && live ? `<button class="btn sm" data-a="assign">${esc(t('assign'))}</button>` : ''}
      ${role === 'admin' && o.status === 'assigned' ? `<button class="btn sm ghost" data-a="unassign">${esc(t('unassign'))}</button>` : ''}
      ${((role === 'admin' && ['new', 'assigned', 'picked'].includes(o.status)) || (role === 'agent' && o.status === 'new')) ? `<button class="btn sm danger" data-a="cancel">${esc(t('cancel_order'))}</button>` : ''}
    </div><div class="row end"><button class="btn ghost" data-x>${esc(t('ok'))}</button></div>`, (ov, close) => {
    ov.addEventListener('click', async e => {
      const a = e.target.closest('[data-a]'); if (!a) return; const act = a.dataset.a; close();
      if (act === 'assign') {
        const cs = S.d.users.filter(u => u.role === 'courier' && u.active !== false);
        const cid = await pickDlg(t('courier'), cs.map(u => ({ v: u.id, l: u.name || u.login, sub: u.capacity > 0 ? `${t('capacity')}: ${num(u.capacity)}` : '' })));
        if (cid) { const r = await safe('dl_order_assign', { p_order: id, p_courier: cid }, t('saved')); if (r.ok) refresh(); }
      }
      if (act === 'unassign') { const r = await safe('dl_order_assign', { p_order: id, p_courier: null }, t('saved')); if (r.ok) refresh(); }
      if (act === 'cancel' && await confirmDlg(t('cancel_order'), `${t('order_no')}${o.no}`, t('cancel_order'), true)) { const r = await safe('dl_order_cancel', { p_order: id }, t('saved')); if (r.ok) refresh(); }
    });
  });
}
function newOrderSheet(preShop) {
  const shops = S.d.points.filter(p => p.kind === 'shop');
  if (!S.d.products.length) return infoDlg(t('new_order'), t('no_products'));
  if (!shops.length) return infoDlg(t('new_order'), t('nothing'));
  const prodOpts = S.d.products.map(p => ({ v: p.id, l: `${p.name} (${unitL(p.unit)})` }));
  let n = 0;
  const rowHtml = () => { n++; return `<div class="irow" data-r="${n}">${selectHtml('p' + n, prodOpts, prodOpts[0].v)}<input class="q" id="q${n}" inputmode="decimal" placeholder="${esc(t('qty'))}"><button class="x" data-del>×</button></div>`; };
  sheet(`<h3>${esc(t('new_order'))}</h3>
    <label class="fl"><span>${esc(t('choose_shop'))}</span>${selectHtml('shop', shops.map(s => ({ v: s.id, l: s.name })), preShop || shops[0].id)}</label>
    <div class="fl"><span>${esc(t('items'))}</span><div id="irows">${rowHtml()}</div><button class="btn sm ghost" id="addi">＋ ${esc(t('add_item'))}</button></div>
    <label class="fl"><span>${esc(t('note'))}</span><textarea id="note" rows="2"></textarea></label>
    <small class="err" id="oerr"></small>
    <div class="row end"><button class="btn ghost" data-x>${esc(t('cancel'))}</button><button class="btn" id="osave">${esc(t('save'))}</button></div>`, (o, close) => {
    bindSelects(o);
    $('#addi', o).onclick = () => { $('#irows', o).insertAdjacentHTML('beforeend', rowHtml()); bindSelects(o); };
    o.addEventListener('click', e => { const d = e.target.closest('[data-del]'); if (d && o.querySelectorAll('.irow').length > 1) d.closest('.irow').remove(); });
    $('#osave', o).onclick = async () => {
      const items = [...o.querySelectorAll('.irow')].map(r => ({ p: r.querySelector('.sel').dataset.value, q: parseFloat(r.querySelector('.q').value.replace(',', '.')) })).filter(i => i.q > 0);
      if (!items.length) { $('#oerr', o).textContent = t('need_items'); return; }
      const merged = {}; items.forEach(i => merged[i.p] = (merged[i.p] || 0) + i.q);
      const r = await safe('dl_order_create', { p_shop: $('#shop', o).dataset.value, p_items: Object.entries(merged).map(([p, q]) => ({ p, q })), p_note: $('#note', o).value.trim() }, t('order_created'));
      if (r.ok) { close(); refresh(); }
    };
  });
}

// ================= склад (админ) =================
function stockView(main) {
  let seg = 'stock', wh = null;
  const draw = () => {
    const whs = S.d.points.filter(p => p.kind === 'warehouse');
    if (!wh || !P[wh]) wh = whs[0]?.id || null;
    let body = '';
    if (seg === 'stock') {
      if (!whs.length) body = `<p class="empty">${esc(t('no_wh'))}</p><button class="btn wide" id="addwh">＋ ${esc(t('add_wh'))}</button>`;
      else {
        const rows = S.d.products.map(p => { const s = S.d.stock.find(x => x.w === wh && x.p === p.id); return { p, q: s ? s.q : 0 }; });
        body = `<div class="fl" style="margin-top:0">${selectHtml('whsel', whs.map(w => ({ v: w.id, l: w.name })), wh)}</div>
          <div class="cards">${rows.length ? rows.map(r => `<div class="card"><div class="ch"><b>${esc(r.p.name)}</b><span class="qty">${num(r.q)} ${esc(unitL(r.p.unit))}</span></div>
            <div class="acts"><button class="btn sm" data-in="${r.p.id}">＋ ${esc(t('receive'))}</button><button class="btn sm ghost" data-out="${r.p.id}">− ${esc(t('writeoff'))}</button></div></div>`).join('') : `<p class="empty">${esc(t('no_products'))}</p>`}</div>
          <button class="btn ghost wide" id="hist">${esc(t('moves'))}</button><button class="btn alt wide" id="addwh">＋ ${esc(t('add_wh'))}</button>`;
      }
    } else {
      body = `<div class="cards">${S.d.products.length ? S.d.products.map(p => `<div class="card click" data-prod="${p.id}"><div class="ch"><b>${esc(p.name)}</b><span class="mut">${esc(unitL(p.unit))}</span></div><div class="mut sm">${esc(t('cap_per_unit'))}: ${num(p.cap)}</div></div>`).join('') : `<p class="empty">${esc(t('nothing'))}</p>`}</div>
        <button class="btn wide" id="addp">＋ ${esc(t('add_product'))}</button>`;
    }
    main.innerHTML = `<div class="page"><div class="bar"><div class="seg"><button data-s="stock" class="${seg === 'stock' ? 'on' : ''}">${esc(t('stock'))}</button><button data-s="prods" class="${seg === 'prods' ? 'on' : ''}">${esc(t('products'))}</button></div></div>${body}</div>`;
    bindSelects(main, (id, v) => { wh = v; draw(); });
    main.querySelectorAll('[data-s]').forEach(b => b.onclick = () => { seg = b.dataset.s; draw(); });
    main.querySelectorAll('[data-in]').forEach(b => b.onclick = () => moveStock(b.dataset.in, 1));
    main.querySelectorAll('[data-out]').forEach(b => b.onclick = () => moveStock(b.dataset.out, -1));
    const h = $('#hist', main); if (h) h.onclick = () => history();
    const aw = $('#addwh', main); if (aw) aw.onclick = () => { S.autoPick = 'warehouse'; go('map'); };
    const ap = $('#addp', main); if (ap) ap.onclick = () => editProduct(null);
    main.querySelectorAll('[data-prod]').forEach(c => c.onclick = () => editProduct(c.dataset.prod));
  };
  async function moveStock(pid, sign) {
    const v = await formDlg(`${prodL(pid)} — ${t(sign > 0 ? 'receive' : 'writeoff')}`, [{ k: 'q', label: t('qty') + ', ' + unitL(PR[pid].unit), type: 'num', req: true }, { k: 'reason', label: t('reason') }]);
    if (!v) return;
    const r = await safe('dl_stock_move', { p_warehouse: wh, p_product: pid, p_delta: sign * v.q, p_reason: v.reason }, t('saved'));
    if (r.ok) refresh();
  }
  async function history() {
    const r = await safe('dl_moves_list', { p_warehouse: wh }); if (!r.ok) return;
    sheet(`<h3>${esc(t('moves'))} — ${esc(P[wh]?.name || '')}</h3><div class="mini-list">${r.v.length ? r.v.map(m => `<div class="mini"><span>${esc(prodL(m.p))}<small class="mut"> ${esc(new Date(m.ts).toLocaleString())}${m.user ? ' · ' + esc(m.user) : ''}${m.reason === 'order' ? ' · ' + esc(t('order_move')) : m.reason ? ' · ' + esc(m.reason) : ''}</small></span><b class="${m.delta > 0 ? 'pos' : 'neg'}">${m.delta > 0 ? '+' : ''}${num(m.delta)}</b></div>`).join('') : `<p class="mut">${esc(t('no_moves'))}</p>`}</div>
      <div class="row end"><button class="btn ghost" data-x>${esc(t('ok'))}</button></div>`);
  }
  async function editProduct(id) {
    const p = id ? PR[id] : null;
    const v = await formDlg(t(p ? 'products' : 'add_product'), [
      { k: 'name', label: t('product_name'), value: p?.name, req: true },
      { k: 'unit', label: t('unit'), type: 'select', value: p?.unit || 'шт', options: [{ v: 'шт', l: t('unit_pcs') }, { v: 'блок', l: t('unit_block') }, { v: 'коробка', l: t('unit_box') }] },
      { k: 'cap', label: t('cap_per_unit'), type: 'num', value: p ? num(p.cap) : '1', req: true }],
    t('save'));
    if (!v) return;
    const r = await safe('dl_product_save', { p_id: id, p_name: v.name, p_unit: v.unit, p_cap: v.cap }, t('saved')); if (r.ok) refresh();
  }
  draw();
  return { update() { if (!overlayOpen()) draw(); } };
}

// ================= люди (админ) =================
function peopleView(main) {
  const draw = () => {
    main.innerHTML = `<div class="page"><div class="bar"><button class="btn" id="addu">＋ ${esc(t('add_user'))}</button></div><div class="cards">${S.d.users.map(u => `<div class="card click" data-u="${u.id}"><div class="ch"><b>${esc(u.name || u.login)}</b><span class="chip r-${u.role}">${esc(t('role_' + u.role))}</span></div>
      <div class="mut sm">${esc(u.login)}${u.phone ? ' · ' + esc(u.phone) : ''}${u.role === 'courier' && u.capacity > 0 ? ' · ' + esc(t('capacity')) + ': ' + num(u.capacity) : ''}${u.active ? '' : ' · ✕'}</div></div>`).join('')}</div></div>`;
    $('#addu', main).onclick = () => edit(null);
    main.querySelectorAll('[data-u]').forEach(c => c.onclick = () => edit(c.dataset.u));
  };
  async function edit(id) {
    const u = id ? U[id] : null;
    const v = await formDlg(t(u ? 'edit_user' : 'add_user'), [
      { k: 'role', label: t('user_role'), type: 'select', value: u?.role || 'courier', options: ['courier', 'agent', 'admin'].map(r => ({ v: r, l: t('role_' + r) })) },
      { k: 'name', label: t('full_name'), value: u?.name, req: true },
      { k: 'login', label: t('login'), value: u?.login, req: true },
      { k: 'pass', label: u ? t('new_pass_opt') : t('password'), type: 'text', req: !u },
      { k: 'phone', label: t('phone'), type: 'phone', value: u?.phone },
      { k: 'capacity', label: t('capacity'), type: 'num', value: u ? num(u.capacity) : '' },
      { k: 'active', label: t('is_active'), type: 'select', value: u ? String(u.active) : 'true', options: [{ v: 'true', l: t('yes') }, { v: 'false', l: t('no') }] }]);
    if (!v) return;
    const r = await safe('dl_user_save', { p_id: id, p_login: v.login, p_pass: v.pass, p_role: v.role, p_name: v.name, p_phone: v.phone, p_capacity: v.role === 'courier' ? (v.capacity > 0 ? v.capacity : 0) : 0, p_active: v.active === 'true' }, t('saved'));
    if (r.ok) refresh();
  }
  draw();
  return { update() { if (!overlayOpen()) draw(); } };
}

// ================= ещё =================
function moreView(main) {
  main.innerHTML = `<div class="page"><div class="card"><b>${esc(S.me.name || S.me.login)}</b><div class="mut sm">${esc(t('role_' + S.me.role))} · ${esc(S.me.login)}</div></div>
    ${S.me.role === 'admin' ? `<button class="btn alt wide" id="rep" style="margin:0 0 10px">${esc(t('report'))}</button><button class="btn ghost wide" id="swt" style="margin:0 0 10px">${esc(t('switch_user'))}</button>` : ''}
    <div class="card"><label class="fl" style="margin-top:0"><span>${esc(t('language'))}</span>${selectHtml('lng', LANGS, getLang())}</label>
    <label class="fl"><span>${esc(t('nav_app'))}</span>${selectHtml('nav', [{ v: 'yandex', l: 'Яндекс Карты' }, { v: 'google', l: 'Google Maps' }], navPref())}</label>
    <label class="fl"><span>${esc(t('region'))}</span>${selectHtml('reg', regionOpts(), M.getRegion())}</label>
    <button class="btn ghost wide" id="ntf">${esc(t('notif_enable'))}</button><small class="mut">${esc(t('notif_hint'))}</small>
    <button class="btn ghost wide" id="chp">${esc(t('change_pass'))}</button></div>
    <div class="card"><div class="ch"><span>${esc(t('version'))}</span><b>${VERSION}</b></div></div>
    <button class="btn danger wide" id="out">${esc(t('sign_out'))}</button></div>`;
  bindSelects(main, (id, v) => { if (id === 'reg') { M.setRegion(v); toast(t('saved')); return; } if (id === 'nav') { try { localStorage.setItem('dl_nav', v); } catch {} toast(t('saved')); return; } setLang(v); shell(); go('more'); });
  const rp = $('#rep', main); if (rp) rp.onclick = () => go('report');
  const sw = $('#swt', main); if (sw) sw.onclick = async () => {
    const us = S.d.users.filter(u => u.active !== false && u.id !== S.me.id);
    const id = await pickDlg(t('switch_user'), us.map(u => ({ v: u.id, l: u.name || u.login, sub: t('role_' + u.role) })));
    if (id) switchTo(id);
  };
  $('#ntf', main).onclick = async () => {
    if (!('Notification' in window)) return toast(t('notif_denied'), 'err');
    const r = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
    toast(t(r === 'granted' ? 'notif_enabled' : 'notif_denied'), r === 'granted' ? 'ok' : 'err');
    if (r === 'granted') { beep(); }
  };
  $('#chp', main).onclick = async () => {
    const v = await formDlg(t('change_pass'), [{ k: 'o', label: t('old_pass'), type: 'pass', req: true }, { k: 'n', label: t('new_pass'), type: 'pass', req: true }]);
    if (v) await safe('dl_change_pass', { p_old: v.o, p_new: v.n }, t('pass_changed'));
  };
  $('#out', main).onclick = () => doLogout();
}

// ================= отчёты (админ) =================
function reportView(main) {
  let days = 1, data = null, my = 0;
  const load = async () => {
    const id = ++my; const r = await safe('dl_report', { p_days: days });
    if (id !== my || !r.ok) return; data = r.v; draw();
  };
  const sumStock = () => {
    const by = {};
    for (const s of S.d.stock) (by[s.w] ||= []).push(s);
    return S.d.points.filter(p => p.kind === 'warehouse').map(w => `<div class="mini"><span>${esc(w.name)}</span><b>${(by[w.id] || []).map(s => `${esc(prodL(s.p))}: ${num(s.q)}`).join(', ') || '—'}</b></div>`).join('');
  };
  const draw = () => {
    const d = data;
    main.innerHTML = `<div class="page"><div class="bar"><button class="btn sm ghost" id="back">← ${esc(t('tab_more'))}</button><div class="seg">${[[1, 'p_today'], [7, 'p_7'], [30, 'p_30']].map(([n, k]) => `<button data-d="${n}" class="${days === n ? 'on' : ''}">${esc(t(k))}</button>`).join('')}</div></div>
      ${d ? `<div class="kpis"><div class="kpi"><b>${d.created}</b><span>${esc(t('r_created'))}</span></div><div class="kpi ok"><b>${d.delivered}</b><span>${esc(t('r_delivered'))}</span></div><div class="kpi"><b>${d.cancelled}</b><span>${esc(t('r_cancelled'))}</span></div><div class="kpi warn"><b>${d.open}</b><span>${esc(t('r_open'))}</span></div></div>
      <div class="card"><h3>${esc(t('r_couriers'))}</h3>${d.couriers.length ? d.couriers.map(c => `<div class="mini"><span>${esc(c.name)}</span><b>${c.delivered} ${esc(t('r_orders_n'))} · ${num(c.units)}</b></div>`).join('') : `<p class="mut">${esc(t('nothing'))}</p>`}</div>
      <div class="card"><h3>${esc(t('r_agents'))}</h3>${d.agents.length ? d.agents.map(c => `<div class="mini"><span>${esc(c.name)}</span><b>${c.orders} / ${c.delivered}</b></div>`).join('') : `<p class="mut">${esc(t('nothing'))}</p>`}</div>
      <div class="card"><h3>${esc(t('r_products'))}</h3>${d.products.length ? d.products.map(x => `<div class="mini"><span>${esc(prodL(x.p))}</span><b>${num(x.q)} ${esc(unitL(PR[x.p]?.unit))}</b></div>`).join('') : `<p class="mut">${esc(t('nothing'))}</p>`}</div>
      <div class="card"><h3>${esc(t('r_shops'))}</h3>${d.shops.length ? d.shops.map(x => `<div class="mini"><span>${esc(P[x.id]?.name || '—')}</span><b>${x.n}</b></div>`).join('') : `<p class="mut">${esc(t('nothing'))}</p>`}</div>
      <div class="card"><h3>${esc(t('r_stock_total'))}</h3>${sumStock() || `<p class="mut">${esc(t('nothing'))}</p>`}</div>` : `<p class="empty">${esc(t('loading'))}</p>`}</div>`;
    $('#back', main).onclick = () => go('more');
    main.querySelectorAll('[data-d]').forEach(b => b.onclick = () => { days = +b.dataset.d; data = null; draw(); load(); });
  };
  draw(); load();
  return { update() { /* данные отчёта не мигают при опросе */ } };
}

// ================= маршрут доставщика =================
function routeView(main) {
  main.innerHTML = `<div class="routebox"><div class="mapbox rmap"><div id="map"></div>
    <div class="mapbar"><button class="btn sm" id="rb">⟳ ${esc(t('build_route'))}</button><button class="btn sm ghost" id="locme">◉</button><button class="btn sm ghost" id="fol">➤</button><button class="btn sm ghost" id="fsb">⛶</button><button class="btn sm ghost" id="lst">☰</button></div>
    <div class="legend"><i class="d wh"></i>${esc(t('route_to_wh'))} <i class="d shop"></i>${esc(t('route_to_shop'))} <i class="d free"></i>${esc(t('route_to_pt'))}</div></div>
    <div class="rlist" id="rlist"><p class="empty">${esc(t('loading'))}</p></div></div>`;
  const m = M.makeMap($('#map', main)); S.map = m.map; S.cleanup = () => { S.follow = false; S.map = null; m.map.remove(); };
  bindFs($('#fsb', main), m);
  root.classList.remove('nolist');
  $('#lst', main).onclick = () => { root.classList.toggle('nolist'); setTimeout(() => m.map.invalidateSize(), 120); };
  const fol =$('#fol', main); S.follow = false;
  fol.onclick = () => { S.follow = false; if (S.pos) m.map.setView([S.pos.lat, S.pos.lng], Math.max(m.map.getZoom(), 16)); else toast(geoMsg(S.geoErr), 'err'); };
  let plan = null, sig = '', token = 0, fitted = false;
  const signature = () => {
    const d = S.d, me = S.me.id;
    return JSON.stringify([d.orders.filter(o => o.courier_id === me && ['assigned', 'picked'].includes(o.status)).map(o => [o.id, o.status, o.items.map(i => i.picked)]), d.marks.filter(x => x.courier_id === me && !x.done).map(x => x.id), d.stock.map(s => [s.w, s.p, s.q]), d.points.length]);
  };
  async function build() {
    const my = ++token, d = S.d, me = S.me, cp = id => PR[id]?.cap ?? 1;
    const mine = d.orders.filter(o => o.courier_id === me.id && ['assigned', 'picked'].includes(o.status));
    const marks = d.marks.filter(x => x.courier_id === me.id && !x.done);
    const need = {}; let base = 0; const shopMap = {};
    for (const o of mine) {
      const sm = shopMap[o.shop_id] ||= { orders: [], total: 0, needP: new Set() };
      sm.orders.push(o);
      for (const i of o.items) {
        sm.total += i.q * cp(i.p); base += i.picked * cp(i.p);
        const rest = i.q - i.picked;
        if (rest > 1e-9) { need[i.p] = (need[i.p] || 0) + rest; sm.needP.add(i.p); }
      }
    }
    const markPts = marks.map(x => ({ mark: x, p: P[x.point_id] })).filter(x => x.p);
    if (!Object.keys(shopMap).length && !markPts.length) { plan = { empty: true }; paint(); return; }
    const whs = d.points.filter(p => p.kind === 'warehouse');
    const withStock = new Set(d.stock.filter(s => need[s.p] > 0).map(s => s.w));
    const cands = whs.filter(w => withStock.has(w.id));
    const start = S.pos ? { ...S.pos } : null;
    const shopIds = Object.keys(shopMap);
    // точки матрицы: старт, магазины, свободные, склады-кандидаты
    const pts = []; const idx = {};
    const add = (k, p) => { idx[k] = pts.length; pts.push({ lat: p.lat, lng: p.lng }); };
    const allLL = [...shopIds.map(i => P[i]), ...markPts.map(x => x.p), ...cands].filter(Boolean);
    const cen = start || { lat: allLL.reduce((a, b) => a + b.lat, 0) / allLL.length, lng: allLL.reduce((a, b) => a + b.lng, 0) / allLL.length };
    add('start', cen);
    shopIds.forEach(i => P[i] && add('s:' + i, P[i]));
    markPts.forEach(x => add('m:' + x.mark.id, x.p));
    cands.forEach(w => add('w:' + w.id, w));
    const Mx = await R.matrix(pts);
    if (my !== token) return;
    const sub = ids => ({ dur: ids.map(a => ids.map(b => Mx.dur[a][b])), dist: ids.map(a => ids.map(b => Mx.dist[a][b])) });
    const variants = []; const seen = new Set();
    const prefs = [undefined, ...cands.map(w => w.id)];
    for (const pf of prefs) {
      const ch = Object.keys(need).length ? R.chooseWarehouses(need, d.stock, cands, start || cen, pf) : { take: {}, short: [] };
      const key = Object.keys(ch.take).sort().join(',');
      if (seen.has(key)) continue; seen.add(key);
      const stops = [];
      for (const w of Object.keys(ch.take)) {
        const load = Object.entries(ch.take[w]).reduce((a, [p, q]) => a + q * cp(p), 0);
        stops.push({ key: 'w:' + w, type: 'wh', id: w, mi: idx['w:' + w], load, take: ch.take[w] });
      }
      for (const sid of shopIds) {
        if (!P[sid]) continue;
        const deps = Object.keys(ch.take).filter(w => [...shopMap[sid].needP].some(p => ch.take[w][p] > 0)).map(w => 'w:' + w);
        stops.push({ key: 's:' + sid, type: 'shop', id: sid, mi: idx['s:' + sid], load: -shopMap[sid].total, deps, orders: shopMap[sid].orders });
      }
      for (const x of markPts) stops.push({ key: 'm:' + x.mark.id, type: 'free', id: x.p.id, mark: x.mark, mi: idx['m:' + x.mark.id], load: 0 });
      const ids = [0, ...stops.map(s => s.mi)];
      const SM = sub(ids);
      const capLeft = me.capacity > 0 ? me.capacity - base : 0;
      const od = R.order(stops, SM, capLeft);
      variants.push({ stops, seq: od.seq, dur: od.dur, short: ch.short, SM, ch });
    }
    variants.sort((a, b) => (a.short.length - b.short.length) || (a.dur - b.dur));
    const v = variants[0];
    const ordered = v.seq.map(i => v.stops[i]);
    const tot = R.legTotals(v.seq, v.SM);
    ordered.forEach((s, i) => { s.leg = tot.legs[i]; });
    // склады по пути
    const hints = [];
    const chosen = new Set(Object.keys(v.ch.take));
    for (const w of cands) {
      if (chosen.has(w.id)) continue;
      const route = [0, ...ordered.map(s => s.mi)]; let best = Infinity;
      for (let k = 0; k < route.length; k++) {
        const a = route[k], b = route[k + 1], wi = idx['w:' + w.id];
        const extra = b == null ? Mx.dur[a][wi] : Mx.dur[a][wi] + Mx.dur[wi][b] - Mx.dur[a][b];
        if (extra < best) best = extra;
      }
      if (best < 600) hints.push({ w, extra: best });
    }
    const geo = await R.geometryLegs([cen, ...ordered.map(s => ({ lat: P[s.id].lat, lng: P[s.id].lng }))]);
    if (my !== token) return;
    plan = { ordered, tot, hints, short: v.short, approx: Mx.approx, noGps: !start, geo, cen, base };
    paint();
  }
  function drawMeR() { m.g.points.clearLayers(); if (S.pos) M.marker([S.pos.lat, S.pos.lng], M.meIcon(S.pos.heading)).addTo(m.g.points); }
  const stopName = s => P[s.id]?.name || '—';
  const legColor = s => s.type === 'wh' ? '#f59e0b' : s.type === 'shop' ? '#0d9488' : '#6366f1';
  function paint() {
    const el = $('#rlist', main); if (!el) return;
    m.g.route.clearLayers(); m.g.points.clearLayers();
    if (!plan || plan.empty) { el.innerHTML = `<p class="empty">${esc(t('no_stops'))}</p>`; drawMeR(); if (S.pos && !fitted) { m.map.setView([S.pos.lat, S.pos.lng], 12); fitted = true; } return; }
    const ll = [];
    plan.ordered.forEach((s, i) => {
      const col = legColor(s);
      const prev = i === 0 ? [plan.cen.lat, plan.cen.lng] : [P[plan.ordered[i - 1].id].lat, P[plan.ordered[i - 1].id].lng];
      const pts = plan.geo && plan.geo[i] && plan.geo[i].length ? plan.geo[i] : null;
      if (pts) { M.polyline(pts, { color: '#fff', weight: 9, opacity: .95 }).addTo(m.g.route); M.polyline(pts, { color: col, weight: 5, opacity: 1 }).addTo(m.g.route); }
      else M.polyline([prev, [P[s.id].lat, P[s.id].lng]], { color: col, weight: 4, dashArray: '6 8' }).addTo(m.g.route);
    });
    drawMeR(); if (S.pos) ll.push([S.pos.lat, S.pos.lng]);
    plan.ordered.forEach((s, i) => { const p = P[s.id]; M.marker([p.lat, p.lng], M.numIcon(i + 1, s.type === 'wh' ? 'wh' : 'shop')).addTo(m.g.route); ll.push([p.lat, p.lng]); });
    for (const h of plan.hints) { M.marker([h.w.lat, h.w.lng], M.whIcon()).addTo(m.g.route).bindTooltip(esc(h.w.name)); }
    if (!fitted) { fitted = true; M.fitTo(m, ll); }
    const T = plan.tot;
    el.innerHTML = `<div class="sum"><b>${esc(t('total'))}: ${min(T.dur)} ${esc(t('min'))} · ${(T.dist / 1000).toFixed(1)} ${esc(t('km'))}</b>${S.me.capacity > 0 ? `<span>${esc(t('load'))}: ${num(plan.base)}/${num(S.me.capacity)}</span>` : ''}</div>
      <a class="btn wide alt" style="margin:0 0 8px" target="_blank" rel="noopener" href="${navAllUrl(plan.ordered.map(s => P[s.id]), S.pos)}">${esc(t('route_all'))}</a>
      ${plan.approx ? `<p class="warn">${esc(t('approx'))}</p>` : ''}${plan.noGps ? `<p class="warn">${esc(geoMsg(S.geoErr))}</p>` : ''}
      ${plan.short.length ? `<p class="warn">${esc(t('shortage'))}: ${plan.short.map(x => `${esc(prodL(x.p))} ${num(x.q)}`).join(', ')}</p>` : ''}
      ${plan.hints.map(h => `<div class="hint"><div><b>${esc(h.w.name)}</b><br><span class="mut sm">${esc(t('on_the_way'))}: ${esc(t('on_the_way_hint', { m: min(h.extra) }))}</span></div><button class="btn sm alt" data-pw="${h.w.id}">${esc(t('btn_picked'))}</button></div>`).join('')}
      ${plan.ordered.map((s, i) => stopCard(s, i)).join('')}`;
    el.querySelectorAll('[data-pw]').forEach(b => b.onclick = () => doPickup(b.dataset.pw));
    el.querySelectorAll('[data-go]').forEach(b => b.onclick = () => { const p = P[b.dataset.go]; m.map.setView([p.lat, p.lng], 15); });
    el.querySelectorAll('[data-done]').forEach(b => b.onclick = async () => {
      const k = b.dataset.done, s = plan.ordered.find(x => x.key === k);
      if (s.type === 'wh') return doPickup(s.id);
      if (s.type === 'shop') {
        let ok = true;
        for (const o of s.orders) { if (o.status === 'picked') { const r = await safe('dl_deliver', { p_order: o.id }); if (!r.ok) ok = false; } else { toast(t('not_picked'), 'err'); ok = false; } }
        if (ok) toast(t('delivered_ok')); await afterAction(); return;
      }
      const r = await safe('dl_mark_done', { p_mark: s.mark.id, p_done: true }, t('delivered_ok')); if (r.ok) await afterAction();
    });
    el.querySelectorAll('[data-rm]').forEach(b => b.onclick = async () => { const r = await safe('dl_mark_delete', { p_mark: b.dataset.rm }); if (r.ok) await afterAction(); });
  }
  function stopCard(s, i) {
    const p = P[s.id]; const T = s.leg;
    let what = '', label = '', canGo = true;
    if (s.type === 'wh') { label = t('stop_pickup'); what = Object.entries(s.take).map(([pid, q]) => `${esc(prodL(pid))} — ${num(q)} ${esc(unitL(PR[pid]?.unit))}`).join('<br>'); }
    else if (s.type === 'shop') { label = t('stop_deliver'); what = s.orders.map(o => `<b>${esc(t('order_no'))}${o.no}</b><br>${itemsText(o)}`).join('<br>'); canGo = s.orders.every(o => o.status === 'picked'); }
    else { label = t('stop_visit'); }
    return `<div class="stop ${s.type}"><div class="num ${s.type === 'wh' ? 'wh' : ''}">${i + 1}</div><div class="sb">
      <div class="ch"><b>${esc(stopName(s))}</b><span class="mut sm">${min(T.dur)} ${esc(t('min'))} · ${(T.dist / 1000).toFixed(1)} ${esc(t('km'))}</span></div>
      <div class="mut sm">${esc(label)}${p.address ? ' · ' + esc(p.address) : ''}</div>${what ? `<div class="what">${what}</div>` : ''}
      <div class="acts"><button class="btn sm ${canGo ? '' : 'ghost'}" data-done="${s.key}">${esc(s.type === 'wh' ? t('btn_picked') : s.type === 'shop' ? t('btn_delivered') : t('btn_visited'))}</button>
      <a class="btn sm alt" target="_blank" rel="noopener" href="${navUrl(p)}">${esc(navLabel())}</a>
      <button class="btn sm ghost" data-go="${p.id}">${esc(t('show_on_map'))}</button>${s.type === 'free' ? `<button class="btn sm ghost" data-rm="${s.mark.id}">${esc(t('btn_remove'))}</button>` : ''}${p.phone ? `<a class="btn sm ghost" href="tel:${esc(p.phone.replace(/\s/g, ''))}">☎</a>` : ''}</div></div></div>`;
  }
  async function doPickup(wid) {
    const r = await safe('dl_pickup', { p_warehouse: wid });
    if (r.ok) toast(r.v && r.v.length ? t('picked_ok') : t('nothing_to_pick'), r.v && r.v.length ? 'ok' : 'err');
    await afterAction();
  }
  async function afterAction() { await refresh(); sig = signature(); await build(); }
  $('#rb', main).onclick = () => { fitted = false; $('#rlist', main).innerHTML = `<p class="empty">${esc(t('rebuilding'))}</p>`; build(); };
  $('#locme', main).onclick = () => { if (S.pos) m.map.setView([S.pos.lat, S.pos.lng], 15); else { startGeo(); toast(geoMsg(S.geoErr), 'err'); } };
  sig = signature(); build();
  let firstFix = false;
  return {
    update() { const s = signature(); if (s !== sig && !overlayOpen()) { sig = s; build(); } },
    onPos() { if (!firstFix && S.pos) { firstFix = true; build(); } else drawMeR(); },
  };
}

// ================= запуск =================
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
boot();
