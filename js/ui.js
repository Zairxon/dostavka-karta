// Свои диалоги, выпадающие списки, тосты, маска телефона — всё в теме приложения.
import { t } from './i18n.js';

export const $ = (s, r = document) => r.querySelector(s);
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const cap = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;

export function toast(msg, kind = 'ok') {
  let box = $('#toasts');
  if (!box) { box = document.createElement('div'); box.id = 'toasts'; document.body.appendChild(box); }
  const el = document.createElement('div');
  el.className = 'toast ' + kind; el.textContent = msg; box.appendChild(el);
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 300); }, 3200);
}

function overlay(html, cls = '') {
  const o = document.createElement('div');
  o.className = 'ov ' + cls; o.innerHTML = `<div class="dlg">${html}</div>`;
  document.body.appendChild(o);
  requestAnimationFrame(() => o.classList.add('in'));
  return o;
}
const close = o => { o.classList.remove('in'); setTimeout(() => o.remove(), 200); };

export function confirmDlg(title, text, okLabel, danger = false) {
  return new Promise(res => {
    const o = overlay(`<h3>${esc(title)}</h3><p>${esc(text || '')}</p>
      <div class="row end"><button class="btn ghost" data-r="0">${esc(t('cancel'))}</button><button class="btn ${danger ? 'danger' : ''}" data-r="1">${esc(okLabel || t('ok'))}</button></div>`);
    o.addEventListener('click', e => {
      const b = e.target.closest('[data-r]');
      if (b) { close(o); res(b.dataset.r === '1'); } else if (e.target === o) { close(o); res(false); }
    });
  });
}
export function infoDlg(title, text) {
  return new Promise(res => {
    const o = overlay(`<h3>${esc(title)}</h3><p>${esc(text || '')}</p><div class="row end"><button class="btn" data-r="1">${esc(t('ok'))}</button></div>`);
    o.addEventListener('click', e => { if (e.target.closest('[data-r]') || e.target === o) { close(o); res(); } });
  });
}

// Универсальная форма в окне. fields: [{k,label,type:'text|num|phone|pass|select|area',value,options:[{v,l}],req}]
export function formDlg(title, fields, okLabel, extra = '') {
  return new Promise(res => {
    const body = fields.map(f => {
      const id = 'f_' + f.k;
      if (f.type === 'select') return `<label class="fl"><span>${esc(f.label)}</span>${selectHtml(id, f.options, f.value)}</label>`;
      if (f.type === 'area') return `<label class="fl"><span>${esc(f.label)}</span><textarea id="${id}" rows="2">${esc(f.value ?? '')}</textarea></label>`;
      const type = f.type === 'num' ? 'text" inputmode="decimal' : f.type === 'pass' ? 'password' : f.type === 'phone' ? 'tel" inputmode="tel' : 'text';
      if (f.type === 'pass') return `<label class="fl"><span>${esc(f.label)}</span>${pwBox(`<input id="${id}" type="password" value="${esc(f.value ?? '')}" autocomplete="off">`)}</label>`;
      return `<label class="fl"><span>${esc(f.label)}</span><input id="${id}" type="${type}" value="${esc(f.value ?? '')}" autocomplete="off">${f.type === 'phone' ? `<small class="err" id="${id}_e"></small>` : ''}</label>`;
    }).join('');
    const o = overlay(`<h3>${esc(title)}</h3>${extra}<div class="form">${body}</div><small class="err" id="f_err"></small>
      <div class="row end"><button class="btn ghost" data-r="0">${esc(t('cancel'))}</button><button class="btn" data-r="1">${esc(okLabel || t('save'))}</button></div>`, 'form');
    bindSelects(o);
    for (const f of fields) if (f.type === 'phone') bindPhone(o.querySelector('#f_' + f.k), o.querySelector('#f_' + f.k + '_e'));
    const collect = () => {
      const out = {};
      for (const f of fields) {
        const el = o.querySelector('#f_' + f.k);
        out[f.k] = f.type === 'select' ? el.dataset.value : f.type === 'num' ? parseFloat(String(el.value).replace(',', '.')) : el.value.trim();
      }
      return out;
    };
    o.addEventListener('click', e => {
      const b = e.target.closest('[data-r]');
      if (!b) { if (e.target === o) { close(o); res(null); } return; }
      if (b.dataset.r === '0') { close(o); res(null); return; }
      const v = collect(); let bad = '';
      for (const f of fields) {
        if (f.req && (v[f.k] === '' || v[f.k] == null || (f.type === 'num' && !(v[f.k] > 0)))) { bad = t('fill_required'); break; }
        if (f.type === 'phone' && v[f.k] && !phoneOk(v[f.k])) { bad = t('bad_phone'); break; }
      }
      if (bad) { o.querySelector('#f_err').textContent = bad; return; }
      close(o); res(v);
    });
  });
}

// ===== свой выпадающий список =====
let selSeq = 0;
export function selectHtml(id, options, value) {
  const cur = options.find(o => String(o.v) === String(value)) || options[0];
  return `<div class="sel" id="${id}" data-value="${esc(cur ? cur.v : '')}" data-opts='${esc(JSON.stringify(options))}'>
    <button type="button" class="sel-b"><span>${esc(cur ? cur.l : '—')}</span><i></i></button></div>`;
}
export function bindSelects(root, onChange) {
  root.querySelectorAll('.sel').forEach(el => {
    if (el._b) return; el._b = 1;
    el.querySelector('.sel-b').addEventListener('click', e => {
      e.preventDefault(); e.stopPropagation();
      const opts = JSON.parse(el.dataset.opts);
      const o = overlay(`<div class="opts">${opts.map(x => `<button class="opt ${String(x.v) === el.dataset.value ? 'on' : ''}" data-v="${esc(x.v)}">${esc(x.l)}</button>`).join('')}</div>`, 'sheet');
      o.addEventListener('click', ev => {
        const b = ev.target.closest('.opt');
        if (b) {
          el.dataset.value = b.dataset.v;
          el.querySelector('.sel-b span').textContent = opts.find(x => String(x.v) === b.dataset.v).l;
          close(o); if (onChange) onChange(el.id, b.dataset.v);
        } else if (ev.target === o) close(o);
      });
    });
  });
}

// ===== телефон Узбекистана: +998 99 999 99 99 =====
export function fmtPhone(raw) {
  let d = String(raw || '').replace(/\D/g, '');
  if (d.startsWith('998')) d = d.slice(3);
  d = d.slice(0, 9);
  let s = '+998 ' + d.slice(0, 2);
  if (d.length > 2) s += ' ' + d.slice(2, 5);
  if (d.length > 5) s += ' ' + d.slice(5, 7);
  if (d.length > 7) s += ' ' + d.slice(7, 9);
  return d.length ? s : '+998 ';
}
export const phoneDigits = s => { let d = String(s || '').replace(/\D/g, ''); if (d.startsWith('998')) d = d.slice(3); return d; };
export const phoneOk = s => { const d = phoneDigits(s); return d.length === 0 || d.length === 9; };
export function bindPhone(inp, errEl) {
  if (!inp) return;
  const apply = () => {
    const raw = inp.value; // вставка с лишним 998: убираем
    inp.value = fmtPhone(raw);
    const d = phoneDigits(inp.value);
    if (errEl) errEl.textContent = (d.length && d.length !== 9) ? t('bad_phone') : '';
  };
  inp.addEventListener('input', apply);
  inp.addEventListener('focus', () => { if (!inp.value) inp.value = '+998 '; });
  inp.addEventListener('blur', () => { if (phoneDigits(inp.value).length === 0) { inp.value = ''; if (errEl) errEl.textContent = ''; } });
  if (inp.value) apply();
}

// Выбор одного из списка в окне-шторке
export function pickDlg(title, options) {
  return new Promise(res => {
    const o = overlay(`<h3>${esc(title)}</h3><div class="opts">${options.length ? options.map(x => `<button class="opt" data-v="${esc(x.v)}">${esc(x.l)}${x.sub ? `<small>${esc(x.sub)}</small>` : ''}</button>`).join('') : `<p class="mut">${esc(t('nothing'))}</p>`}</div>`, 'sheet');
    o.addEventListener('click', e => {
      const b = e.target.closest('.opt');
      if (b) { close(o); res(b.dataset.v); } else if (e.target === o) { close(o); res(null); }
    });
  });
}

export function sheet(html, onBind) {
  const o = overlay(html, 'sheet big');
  o.addEventListener('click', e => { if (e.target === o || e.target.closest('[data-x]')) close(o); });
  if (onBind) onBind(o, () => close(o));
  return o;
}

// Поле пароля с «глазком»: нажатие показывает/скрывает пароль
export const pwBox = inner => `<span class="pwbox">${inner}<button type="button" class="eye" tabindex="-1" aria-label="👁"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/><path class="slash" d="M3 3l18 18"/></svg></button></span>`;
document.addEventListener('click', e => {
  const b = e.target.closest('.eye'); if (!b) return;
  e.preventDefault();
  const inp = b.parentElement.querySelector('input'); if (!inp) return;
  const show = inp.type === 'password';
  inp.type = show ? 'text' : 'password';
  b.classList.toggle('on', show);
});
