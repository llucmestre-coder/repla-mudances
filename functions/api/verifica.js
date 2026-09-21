// POST /api/verifica — comprova el codi i, només si és correcte, calcula la
// forquilla orientativa (PLA.md §«Eina estrella») i retorna el WhatsApp.
// El preu i el número no són mai al codi del navegador abans d'aquest pas.
// Secrets: WHATSAPP, BREVO_API_KEY, BREVO_SENDER. Bindings: CODIS (KV), LEADS (D1).

const MAX_INTENTS = 5;

const KM = [1, 60];
// [mínim fix, mínim per km, màxim fix, màxim per km] — forquilles inventades per a la demo.
const PREU = {
  estudi: [280, 4, 420, 6],
  pis: [550, 6, 850, 9],
  casa: [950, 8, 1500, 12],
  mobles: [90, 1.5, 160, 2.5],
};
const ACCES = { ascensor: 1, 'escales-un': 1.15, 'escales-dos': 1.3 };
const SERVEI = { transport: 1, muntar: 1.35, tot: 1.6 };
const QUAN = { fixa: 1, flexible: 0.92, mirant: 1 };

function json(dades, status = 200) {
  return new Response(JSON.stringify(dades), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

const te = (obj, clau) => Object.prototype.hasOwnProperty.call(obj, clau);

// Separat per poder-ho provar sense servidor.
export function calcula(r) {
  const km = Number(r.km);
  if (!te(PREU, r.tipus) || !Number.isInteger(km) || km < KM[0] || km > KM[1] ||
      !te(ACCES, r.acces) || !te(SERVEI, r.servei) || !te(QUAN, r.quan)) return null;
  const p = PREU[r.tipus];
  const factor = ACCES[r.acces] * SERVEI[r.servei] * QUAN[r.quan];
  const arrodoneix = (x) => Math.round(x / 10) * 10;
  return { km, min: arrodoneix((p[0] + p[1] * km) * factor), max: arrodoneix((p[2] + p[3] * km) * factor) };
}

export async function onRequestPost({ request, env, waitUntil }) {
  let dades;
  try { dades = await request.json(); } catch { return json({ ok: false, error: 'dades' }, 400); }

  const correu = String(dades.correu || '').trim().toLowerCase();
  const codi = String(dades.codi || '');
  const r = dades.respostes || {};
  if (!correu || !/^\d{6}$/.test(codi)) return json({ ok: false, error: 'codi' }, 400);

  const clau = 'codi:' + (await sha256(correu));
  const desat = await env.CODIS.get(clau, 'json');
  if (!desat || desat.caduca < Date.now()) return json({ ok: false, error: 'caducat' }, 400);
  if (desat.intents >= MAX_INTENTS) {
    await env.CODIS.delete(clau);
    return json({ ok: false, error: 'intents' }, 429);
  }

  if ((await sha256(codi + ':' + correu)) !== desat.hash) {
    desat.intents += 1;
    const queda = Math.max(60, Math.ceil((desat.caduca - Date.now()) / 1000));
    await env.CODIS.put(clau, JSON.stringify(desat), { expirationTtl: queda });
    return json({ ok: false, error: 'codi' }, 400);
  }

  const preu = calcula(r);
  if (!preu) return json({ ok: false, error: 'respostes' }, 400);
  const { km, min, max } = preu;

  await env.CODIS.delete(clau); // un codi, un preu

  const idioma = ['ca', 'es', 'en'].includes(dades.idioma) ? dades.idioma : 'ca';

  // Contacte per al seguiment (D1). Si la base de dades falla, l'usuari veu igualment el preu.
  try {
    await env.LEADS.prepare(
      'INSERT INTO leads (correu, idioma, tipus, km, acces, servei, quan, minim, maxim) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(correu, idioma, r.tipus, km, r.acces, r.servei, r.quan, min, max).run();
  } catch (e) {
    console.error('D1 leads:', e && e.message);
  }

  // Avís al negoci per correu, sempre en català (no bloqueja la resposta).
  const t0 = RESUM.ca;
  const eurosCa = (n) => n.toLocaleString('ca-ES', { useGrouping: 'always' }) + ' €';
  const avis = [
    'Nou contacte des de la calculadora de Replà',
    '',
    'Correu: ' + correu,
    'Què es canvia: ' + t0.tipus[r.tipus],
    'Distància: ' + km + ' km',
    'Accessos: ' + t0.acces[r.acces],
    'Servei: ' + t0.servei[r.servei],
    'Quan: ' + t0.quan[r.quan],
    'Preu mostrat: ' + eurosCa(min) + ' – ' + eurosCa(max),
    'Idioma de la web: ' + idioma,
  ].join('\n');
  waitUntil(fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': env.BREVO_API_KEY, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      sender: { name: 'Calculadora Replà', email: env.BREVO_SENDER },
      to: [{ email: env.BREVO_SENDER }],
      replyTo: { email: correu },
      subject: 'Nova mudança: ' + t0.tipus[r.tipus] + ', ' + km + ' km · ' + eurosCa(min) + '–' + eurosCa(max),
      textContent: avis,
    }),
  }).catch(() => {}));

  // Resum per a l'usuari, en l'idioma de la web (demo: text senzill; un negoci real el treballarà més).
  const t = RESUM[idioma];
  const eurosIdioma = (n) => n.toLocaleString(t.locale, { useGrouping: 'always' }) + ' €';
  const rang = eurosIdioma(min) + ' – ' + eurosIdioma(max);
  const files = [
    [t.etTipus, t.tipus[r.tipus]],
    [t.etKm, km + ' km'],
    [t.etAcces, t.acces[r.acces]],
    [t.etServei, t.servei[r.servei]],
    [t.etQuan, t.quan[r.quan]],
  ];
  const missatgeWa = encodeURIComponent(t.wa.replace('{resum}', files.map((f) => f[1]).join(' · ')).replace('{rang}', rang));
  const enllacWa = 'https://wa.me/' + String(env.WHATSAPP || '').replace(/\D/g, '') + '?text=' + missatgeWa;
  const html = `<div style="font-family:Arial,sans-serif;color:#1D2026;max-width:520px;line-height:1.5">
  <p style="font-size:16px">${t.hola}</p>
  <p style="font-size:14px;color:#5B5F66;margin:18px 0 4px">${t.estimacio}</p>
  <p style="font-size:30px;font-weight:700;margin:0 0 6px">${rang}</p>
  <p style="font-size:13px;color:#5B5F66;margin:0 0 18px">${t.nota}</p>
  <table style="border-collapse:collapse;width:100%;font-size:15px">${files.map((f) =>
    `<tr><td style="padding:8px 0;border-bottom:1px solid #E8D9BF;color:#5B5F66">${f[0]}</td><td style="padding:8px 0;border-bottom:1px solid #E8D9BF;text-align:right;font-weight:600">${f[1]}</td></tr>`).join('')}</table>
  <p style="margin:24px 0"><a href="${enllacWa}" style="background:#1F8F4E;color:#fff;text-decoration:none;padding:12px 20px;border-radius:6px;font-weight:700;display:inline-block">${t.botoWa}</a></p>
  <p style="font-size:14px">${t.seguent}</p>
  <p style="font-size:14px;color:#5B5F66">Replà Mudances · 600 000 000</p></div>`;
  waitUntil(fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': env.BREVO_API_KEY, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      sender: { name: 'Replà Mudances', email: env.BREVO_SENDER },
      to: [{ email: correu }],
      subject: t.assumpte + ' · ' + rang,
      textContent: `${t.hola}\n\n${t.estimacio}: ${rang}\n${t.nota}\n\n${files.map((f) => f[0] + ': ' + f[1]).join('\n')}\n\n${t.botoWa}: ${enllacWa}\n\n${t.seguent}\n\nReplà Mudances · 600 000 000`,
      htmlContent: html,
    }),
  }).catch(() => {}));

  return json({ ok: true, min, max, whatsapp: env.WHATSAPP });
}

const RESUM = {
  ca: {
    locale: 'ca-ES',
    assumpte: 'El preu orientatiu de la teva mudança',
    hola: 'Hola, aquest és el resum de la mudança que has calculat a la nostra web.',
    estimacio: 'Preu orientatiu',
    nota: "IVA a part. El preu tancat te'l donem per escrit abans del dia de la mudança.",
    etTipus: 'Què et canvies', etKm: 'Distància', etAcces: 'Accessos', etServei: 'Servei', etQuan: 'Quan',
    tipus: { estudi: 'Estudi o 1 habitació', pis: 'Pis de 2 o 3 habitacions', casa: 'Pis gran o casa', mobles: 'Només uns mobles' },
    acces: { ascensor: 'Ascensor als dos llocs', 'escales-un': 'Escales en un dels dos', 'escales-dos': 'Escales als dos llocs' },
    servei: { transport: 'Només el transport', muntar: 'També embalar i muntar', tot: 'Tot, fins i tot desembalar' },
    quan: { fixa: 'Data fixa', flexible: 'Data flexible', mirant: 'Només miro preus' },
    botoWa: 'Parla amb nosaltres per WhatsApp',
    wa: 'Hola, vull fer una mudança. He fet servir la calculadora de la web: {resum}. Preu orientatiu: {rang}. Em podeu dir un dia?',
    seguent: "Si vols tirar endavant, respon aquest correu o escriu-nos per WhatsApp i et donem el preu tancat.",
  },
  es: {
    locale: 'es-ES',
    assumpte: 'El precio orientativo de tu mudanza',
    hola: 'Hola, este es el resumen de la mudanza que has calculado en nuestra web.',
    estimacio: 'Precio orientativo',
    nota: 'IVA no incluido. El precio cerrado te lo damos por escrito antes del día de la mudanza.',
    etTipus: 'Qué te mudas', etKm: 'Distancia', etAcces: 'Accesos', etServei: 'Servicio', etQuan: 'Cuándo',
    tipus: { estudi: 'Estudio o 1 habitación', pis: 'Piso de 2 o 3 habitaciones', casa: 'Piso grande o casa', mobles: 'Solo unos muebles' },
    acces: { ascensor: 'Ascensor en los dos sitios', 'escales-un': 'Escaleras en uno de los dos', 'escales-dos': 'Escaleras en los dos sitios' },
    servei: { transport: 'Solo el transporte', muntar: 'También embalar y montar', tot: 'Todo, incluso desembalar' },
    quan: { fixa: 'Fecha fija', flexible: 'Fecha flexible', mirant: 'Solo miro precios' },
    botoWa: 'Habla con nosotros por WhatsApp',
    wa: 'Hola, quiero hacer una mudanza. He usado la calculadora de la web: {resum}. Precio orientativo: {rang}. ¿Me decís un día?',
    seguent: 'Si quieres seguir adelante, responde a este correo o escríbenos por WhatsApp y te damos el precio cerrado.',
  },
  en: {
    locale: 'en-GB',
    assumpte: 'The estimated price of your move',
    hola: 'Hi, here is the summary of the move you calculated on our website.',
    estimacio: 'Estimated price',
    nota: 'VAT not included. We give you a fixed price in writing before moving day.',
    etTipus: 'What you are moving', etKm: 'Distance', etAcces: 'Access', etServei: 'Service', etQuan: 'When',
    tipus: { estudi: 'Studio or 1 bedroom', pis: '2 or 3 bedroom flat', casa: 'Large flat or house', mobles: 'Just a few pieces of furniture' },
    acces: { ascensor: 'Lift at both ends', 'escales-un': 'Stairs at one end', 'escales-dos': 'Stairs at both ends' },
    servei: { transport: 'Transport only', muntar: 'Packing and assembly too', tot: 'Everything, unpacking included' },
    quan: { fixa: 'Fixed date', flexible: 'Flexible date', mirant: 'Just checking prices' },
    botoWa: 'Chat with us on WhatsApp',
    wa: "Hi, I'd like to book a move. I used the calculator on your website: {resum}. Estimated price: {rang}. Could you give me a date?",
    seguent: "If you want to go ahead, reply to this email or message us on WhatsApp and we'll give you a fixed price.",
  },
};

export function onRequest() {
  return json({ ok: false, error: 'metode' }, 405);
}
