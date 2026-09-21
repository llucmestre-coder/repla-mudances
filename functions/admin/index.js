// GET /admin — llista dels contactes de la calculadora (protegida per _middleware.js).

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const euros = (n) => (Number(n) || 0).toLocaleString('ca-ES', { useGrouping: 'always' }) + ' €';

export async function onRequestGet({ env }) {
  const { results } = await env.LEADS.prepare(
    'SELECT id, creat, correu, idioma, tipus, km, acces, servei, quan, minim, maxim, estat FROM leads ORDER BY id DESC LIMIT 500'
  ).all();

  const files = results.map((l) => `<tr>
    <td>${esc(l.creat)}</td><td><a href="mailto:${esc(l.correu)}">${esc(l.correu)}</a></td>
    <td>${esc(l.tipus)}</td><td>${esc(l.km)} km</td><td>${esc(l.acces)}</td><td>${esc(l.servei)}</td>
    <td>${esc(l.quan)}</td><td>${euros(l.minim)} – ${euros(l.maxim)}</td><td>${esc(l.idioma)}</td></tr>`).join('');

  const html = `<!DOCTYPE html><html lang="ca"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex, nofollow">
<title>Contactes · Replà</title>
<style>
  body{margin:0;padding:1.5rem;font:15px/1.45 system-ui,sans-serif;background:#F7F7F4;color:#1D2026}
  h1{font-size:1.4rem;margin:0 0 .25rem} p{margin:0 0 1rem;color:#5B5F66}
  a{color:#8A5A00} .taula{overflow-x:auto;background:#fff;border-radius:6px}
  table{border-collapse:collapse;width:100%;min-width:900px} th,td{padding:.55rem .7rem;text-align:left;border-bottom:1px solid #E8D9BF;white-space:nowrap}
  th{font-weight:600;background:#E8D9BF}
</style></head><body>
<h1>Contactes de la calculadora</h1>
<p>${results.length} registres (com a màxim 500 en pantalla) · <a href="/admin/leads.csv">Baixa el CSV</a></p>
<div class="taula"><table><thead><tr><th>Data (UTC)</th><th>Correu</th><th>Què es canvia</th><th>Distància</th><th>Accessos</th><th>Servei</th><th>Quan</th><th>Preu mostrat</th><th>Idioma</th></tr></thead>
<tbody>${files || '<tr><td colspan="9">Encara no hi ha cap contacte.</td></tr>'}</tbody></table></div>
</body></html>`;

  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}
