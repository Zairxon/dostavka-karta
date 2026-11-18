const URL_ = 'https://tzxflegbfqqdbzdnhbnz.supabase.co';
const KEY = 'sb_publishable_frJydxYBSrHlE7CB7LPXZg_Ar_3YVWn';

export const session = {
  get token() { try { return localStorage.getItem('dl_token') || ''; } catch { return ''; } },
  set(t) { try { t ? localStorage.setItem('dl_token', t) : localStorage.removeItem('dl_token'); } catch {} },
};

export async function rpc(fn, args = {}, withToken = true) {
  const body = withToken ? { p_token: session.token, ...args } : args;
  let res;
  try {
    res = await fetch(`${URL_}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers: { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch { const e = new Error('offline'); e.code = 'offline'; throw e; }
  let j = null;
  try { j = await res.json(); } catch {}
  if (!res.ok) {
    const msg = (j && (j.message || j.hint)) || 'error';
    const e = new Error(msg); e.code = String(msg).replace(/^.*?:\s*/, '').trim(); throw e;
  }
  return j;
}
