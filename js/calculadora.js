/* =========================================================================
   REPLÀ — calculadora de mudança (PLA.md §«Eina estrella»)
   Base: assets/eina-estrella de la skill web-demo (la de Cota Cero).
   - Una pregunta per pantalla; en tocar una opció avança sola.
   - El preu NO és al client: el retorna /api/verifica després de validar
     el codi que /api/codi envia al correu.
   - La furgoneta de la dreta s'omple amb les respostes (element signatura).
   - Textos escrits des del JS: sempre I18N.t amb la frase catalana dins.
   ========================================================================= */
(function () {
  'use strict';

  if (!window.I18N) window.I18N = { t: function (s) { return s; } };
  var arrel = document.getElementById('calc');
  if (!arrel) return;

  /* El número de WhatsApp NO és aquí (repo públic): arriba a la resposta de
     /api/verifica, un cop validat el codi. La clau del captcha sí: és pública. */
  var TURNSTILE_SITEKEY = '0x4AAAAAAE-tVGQ6rUlaGCnb';

  var PREGUNTES = ['tipus', 'km', 'acces', 'servei', 'quan'];
  var PASSOS = PREGUNTES.concat(['correu', 'codi', 'resultat']);
  var DESAT = 'repla-calculadora';
  var redueix = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var idioma = function () { return document.documentElement.lang || 'ca'; };

  var $ = function (sel, dins) { return (dins || arrel).querySelector(sel); };
  var $$ = function (sel, dins) { return Array.prototype.slice.call((dins || arrel).querySelectorAll(sel)); };

  var estat = llegeix() || { pas: 0, respostes: {}, correu: '', resultat: null };

  /* Només es recupera on s'havia quedat si es recarrega la pàgina. Arribant-hi
     des de qualsevol botó o enllaç, la calculadora comença de zero. */
  function llegeix() {
    var nav = performance.getEntriesByType && performance.getEntriesByType('navigation')[0];
    if (!nav || nav.type !== 'reload') {
      try { sessionStorage.removeItem(DESAT); } catch (e) { /* res */ }
      return null;
    }
    try { return JSON.parse(sessionStorage.getItem(DESAT)); } catch (e) { return null; }
  }
  function desa() {
    try { sessionStorage.setItem(DESAT, JSON.stringify(estat)); } catch (e) { /* sense emmagatzematge: continua igual */ }
  }

  /* Tipus preseleccionat des de la home: pressupost.html?tipus=pis */
  var tipusUrl = new URLSearchParams(location.search).get('tipus');
  if (tipusUrl && /^(estudi|pis|casa|mobles)$/.test(tipusUrl) && !estat.respostes.tipus) {
    estat.respostes.tipus = { valor: tipusUrl };
    estat.pas = 1;
  }

  /* ── La furgoneta ──────────────────────────────────────────────────── */
  var carrega = document.querySelector('[data-furgo-carrega]');
  var textKm = document.querySelector('[data-furgo-km]');
  var peuFurgo = document.querySelector('[data-furgo-peu]');
  var SVGNS = 'http://www.w3.org/2000/svg';
  // Forats de la caixa de càrrega: 4 columnes × 3 files, de baix a dalt.
  var FORATS = [];
  for (var fila = 0; fila < 3; fila++) {
    for (var col = 0; col < 4; col++) FORATS.push([22 + col * 66, 126 - fila * 48]);
  }
  function caixesTipus(t) {
    if (t === 'estudi') return [I18N.t('Roba'), I18N.t('Cuina'), I18N.t('Llibres')];
    if (t === 'pis') return [I18N.t('Roba'), I18N.t('Cuina'), I18N.t('Llibres'), I18N.t('Menjador'), I18N.t('Bany'), I18N.t('Llençols')];
    if (t === 'casa') return [I18N.t('Roba'), I18N.t('Cuina'), I18N.t('Llibres'), I18N.t('Menjador'), I18N.t('Bany'), I18N.t('Llençols'), I18N.t('Joguines'), I18N.t('Traster')];
    if (t === 'mobles') return [I18N.t('Sofà'), I18N.t('Armari')];
    return [];
  }
  function caixesServei(s) {
    if (s === 'muntar') return [I18N.t('Eines')];
    if (s === 'tot') return [I18N.t('Eines'), I18N.t('Paper')];
    return [];
  }
  var dibuixades = [];
  function pintaFurgo() {
    var r = estat.respostes;
    var noms = caixesTipus(r.tipus && r.tipus.valor)
      .concat(r.acces && r.acces.valor !== 'ascensor' ? [I18N.t('Mantes')] : [])
      .concat(caixesServei(r.servei && r.servei.valor));
    noms = noms.slice(0, FORATS.length);
    var clau = noms.join('|');
    if (clau !== dibuixades.join('|')) {
      while (carrega.firstChild) carrega.removeChild(carrega.firstChild);
      noms.forEach(function (nom, i) {
        var g = document.createElementNS(SVGNS, 'g');
        g.setAttribute('transform', 'translate(' + FORATS[i][0] + ' ' + FORATS[i][1] + ')');
        var dins = document.createElementNS(SVGNS, 'g');
        // Només cauen les caixes noves; les que ja hi eren no es mouen.
        if (!redueix && dibuixades[i] !== nom) {
          dins.setAttribute('class', 'caixa-cau');
          dins.style.animationDelay = (Math.max(0, i - dibuixades.length) * 70) + 'ms';
        }
        var rect = document.createElementNS(SVGNS, 'rect');
        rect.setAttribute('class', 'caixa');
        rect.setAttribute('width', '60'); rect.setAttribute('height', '44'); rect.setAttribute('rx', '2');
        var cinta = document.createElementNS(SVGNS, 'path');
        cinta.setAttribute('class', 'caixa-cinta');
        cinta.setAttribute('d', 'M30 0v12');
        var text = document.createElementNS(SVGNS, 'text');
        text.setAttribute('class', 'caixa-nom');
        text.setAttribute('x', '30'); text.setAttribute('y', '31'); text.setAttribute('text-anchor', 'middle');
        text.textContent = nom;
        // Etiquetes llargues (sobretot traduïdes): lletra més petita perquè no surtin de la caixa.
        if (nom.length > 8) text.setAttribute('class', 'caixa-nom caixa-nom-llarg');
        dins.appendChild(rect); dins.appendChild(cinta); dins.appendChild(text);
        g.appendChild(dins);
        carrega.appendChild(g);
      });
      dibuixades = noms;
    }
    textKm.textContent = r.km ? r.km.valor + ' km' : '— km';
    if (!noms.length) peuFurgo.textContent = I18N.t('La furgoneta és buida. Respon i s\'anirà omplint.');
    else if (estat.resultat) peuFurgo.textContent = I18N.t('Carregada i a punt per sortir.');
    else peuFurgo.textContent = I18N.t('Caixes a la furgoneta:') + ' ' + noms.length;
  }

  /* ── Pintar un pas ─────────────────────────────────────────────────── */
  function pantalla(nom) { return $('.calc-pas[data-pas="' + nom + '"]'); }

  function mostra(index, enrere) {
    index = Math.max(0, Math.min(index, PASSOS.length - 1));
    // Sense resultat verificat no es pot anar al pas del resultat.
    if (PASSOS[index] === 'resultat' && !estat.resultat) index = PASSOS.indexOf('correu');
    // Sense totes les respostes no es pot passar de les preguntes.
    for (var i = 0; i < PREGUNTES.length && i < index; i++) {
      if (!estat.respostes[PREGUNTES[i]]) { index = i; break; }
    }
    estat.pas = index;
    desa();

    var nom = PASSOS[index];
    $$('.calc-pas').forEach(function (s) { s.hidden = s.getAttribute('data-pas') !== nom; });
    var actual = pantalla(nom);
    actual.classList.remove('entra', 'entra-enrere');
    if (!redueix) { void actual.offsetWidth; actual.classList.add(enrere ? 'entra-enrere' : 'entra'); }

    if (nom === 'km') preparaSlider();
    marcaEscollides(actual);

    var fetes = Math.min(index, PREGUNTES.length);
    $('.calc-progres i').style.transform = 'scaleX(' + (fetes / PREGUNTES.length) + ')';
    $('.calc-progres').setAttribute('aria-valuenow', String(fetes));
    $('[data-calc-num]').textContent = String(Math.min(index + 1, PREGUNTES.length));
    $('.calc-comptador').hidden = index >= PREGUNTES.length;
    $('[data-calc-enrere]').hidden = index === 0 || nom === 'resultat';
    // Al resultat, el resum ja surt sota el preu: fora la capçalera i els xips.
    $('.calc-cap').hidden = nom === 'resultat';
    $('[data-calc-resum]').hidden = nom === 'resultat';

    pintaResum();
    pintaFurgo();
    if (nom === 'correu') preparaCaptcha();
    if (nom === 'codi') { $('[data-calc-correu]').textContent = estat.correu; $('.calc-codi input').focus(); }
    if (nom === 'resultat') pintaResultat();

    var titol = actual.querySelector('[tabindex="-1"]');
    if (titol && nom !== 'codi') titol.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: redueix ? 'auto' : 'smooth' });
  }

  function etiqueta(pregunta) {
    var r = estat.respostes[pregunta];
    if (!r) return '';
    if (pregunta === 'km') return r.valor + ' km';
    var op = pantalla(pregunta).querySelector('.calc-op[data-valor="' + r.valor + '"] .calc-op-nom');
    return op ? op.textContent.trim() : r.valor;
  }

  function marcaEscollides(seccio) {
    var r = estat.respostes[seccio.getAttribute('data-pas')];
    $$('.calc-op', seccio).forEach(function (b) {
      b.setAttribute('aria-pressed', r && b.getAttribute('data-valor') === r.valor ? 'true' : 'false');
    });
  }

  function pintaResum() {
    var llista = $('[data-calc-resum]');
    llista.innerHTML = '';
    PREGUNTES.forEach(function (p, i) {
      if (!estat.respostes[p] || i >= estat.pas) return;
      var li = document.createElement('li');
      var b = document.createElement('button');
      b.type = 'button';
      b.textContent = etiqueta(p);
      b.setAttribute('aria-label', I18N.t('Canvia aquesta resposta') + ': ' + etiqueta(p));
      b.addEventListener('click', function () { mostra(i, true); });
      li.appendChild(b);
      llista.appendChild(li);
    });
  }

  /* ── Respondre: un clic i avança ───────────────────────────────────── */
  PREGUNTES.forEach(function (pregunta, i) {
    if (pregunta === 'km') return;
    pantalla(pregunta).addEventListener('click', function (e) {
      var b = e.target.closest('.calc-op');
      if (!b) return;
      estat.respostes[pregunta] = { valor: b.getAttribute('data-valor') };
      estat.resultat = null;
      marcaEscollides(pantalla(pregunta));
      pintaFurgo();
      setTimeout(function () { mostra(i + 1); }, redueix ? 0 : 260);
    });
  });

  /* ── Quilòmetres: slider. No avança sol en deixar-lo anar: «Continua» o Enter. */
  var ESCALA = { min: 1, max: 60, pas: 1, inici: 8 };
  var slider = $('#calc-km');
  function pintaKm() {
    var v = Number(slider.value);
    $('[data-calc-km-num]').textContent = String(v);
    slider.setAttribute('aria-valuetext', v + ' km');
    slider.style.setProperty('--pct', ((v - ESCALA.min) / (ESCALA.max - ESCALA.min) * 100) + '%');
    textKm.textContent = v + ' km';
  }
  function preparaSlider() {
    var desat = estat.respostes.km ? Number(estat.respostes.km.valor) : NaN;
    slider.value = String(desat >= ESCALA.min && desat <= ESCALA.max ? desat : ESCALA.inici);
    pintaKm();
  }
  function confirmaKm() {
    estat.respostes.km = { valor: String(slider.value) };
    estat.resultat = null;
    mostra(PREGUNTES.indexOf('km') + 1);
  }
  slider.addEventListener('input', pintaKm);
  slider.addEventListener('keydown', function (e) { if (e.key === 'Enter') confirmaKm(); });
  $('[data-calc-continua]').addEventListener('click', confirmaKm);

  /* Teclat: 1–4 trien opció a les preguntes. */
  document.addEventListener('keydown', function (e) {
    if (e.target.closest('input, textarea, select')) return;
    var nom = PASSOS[estat.pas];
    if (PREGUNTES.indexOf(nom) < 0 || !/^[1-4]$/.test(e.key)) return;
    var b = $$('.calc-op', pantalla(nom))[Number(e.key) - 1];
    if (b) b.click();
  });

  $('[data-calc-enrere]').addEventListener('click', function () { mostra(estat.pas - 1, true); });

  /* ── Correu + captcha ──────────────────────────────────────────────── */
  var widget = null;
  function preparaCaptcha() {
    if (widget !== null) return;
    var render = function () {
      if (!window.turnstile || widget !== null) return;
      widget = window.turnstile.render('#calc-turnstile', {
        sitekey: TURNSTILE_SITEKEY,
        language: idioma(),
        appearance: 'interaction-only'
      });
    };
    if (window.turnstile) return render();
    window.replaTurnstile = render;
    var s = document.createElement('script');
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=replaTurnstile';
    s.async = true;
    document.head.appendChild(s);
  }

  function error(seccio, text) {
    $('[data-calc-error]', pantalla(seccio)).textContent = text || '';
  }

  function envia(url, dades) {
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(dades)
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) { j.status = r.status; j.ok = r.ok && j.ok !== false; return j; });
    });
  }

  function respostesPerEnviar() {
    var out = {};
    PREGUNTES.forEach(function (p) { out[p] = estat.respostes[p].valor; });
    return out;
  }

  var formCorreu = $('[data-calc-form-correu]');
  formCorreu.addEventListener('submit', function (e) {
    e.preventDefault();
    var camp = formCorreu.elements.email;
    var correu = camp.value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(correu)) {
      camp.setAttribute('aria-invalid', 'true');
      camp.focus();
      return error('correu', I18N.t('Escriu un correu vàlid, per exemple nom@gmail.com.'));
    }
    camp.setAttribute('aria-invalid', 'false');
    var token = window.turnstile && widget !== null ? window.turnstile.getResponse(widget) : '';
    if (!token) return error('correu', I18N.t('Espera un moment que acabi la comprovació de seguretat i torna-hi.'));

    var boto = formCorreu.querySelector('button[type="submit"]');
    var text = boto.textContent;
    boto.disabled = true;
    boto.textContent = I18N.t('Enviant…');
    error('correu', '');
    envia('/api/codi', { correu: correu, token: token, idioma: idioma() })
      .then(function (j) {
        if (j.ok) {
          estat.correu = correu;
          mostra(PASSOS.indexOf('codi'));
          compteEnrere();
        } else if (j.status === 429) {
          error('correu', I18N.t('Has demanat massa codis. Espera uns minuts i torna-hi.'));
        } else if (j.error === 'captcha') {
          error('correu', I18N.t('No hem pogut confirmar que no ets un robot. Torna-hi.'));
        } else {
          error('correu', I18N.t('No hem pogut enviar el codi. Torna-hi d\'aquí a uns minuts.'));
        }
      })
      .catch(function () { error('correu', I18N.t('No hem pogut enviar el codi. Torna-hi d\'aquí a uns minuts.')); })
      .finally(function () {
        boto.disabled = false;
        boto.textContent = text;
        if (window.turnstile && widget !== null) window.turnstile.reset(widget);
      });
  });

  /* ── Codi de 6 xifres ─────────────────────────────────────────────── */
  var caselles = $$('.calc-codi input');
  function codi() { return caselles.map(function (c) { return c.value; }).join(''); }
  function omple(xifres) {
    xifres = xifres.replace(/\D/g, '').slice(0, 6);
    caselles.forEach(function (c, i) { c.value = xifres[i] || ''; });
    var seguent = caselles[Math.min(xifres.length, 5)];
    if (seguent) seguent.focus();
    if (xifres.length === 6) verifica();
  }
  caselles.forEach(function (c, i) {
    c.addEventListener('input', function () {
      if (c.value.length > 1) return omple(c.value);  // enganxat o autocompletat del mòbil
      c.value = c.value.replace(/\D/g, '');
      if (c.value && caselles[i + 1]) caselles[i + 1].focus();
      if (codi().length === 6) verifica();
    });
    c.addEventListener('keydown', function (e) {
      if (e.key === 'Backspace' && !c.value && caselles[i - 1]) caselles[i - 1].focus();
    });
    c.addEventListener('paste', function (e) {
      e.preventDefault();
      omple((e.clipboardData || window.clipboardData).getData('text'));
    });
  });

  var verificant = false;
  function verifica() {
    if (verificant) return;
    verificant = true;
    error('codi', '');
    envia('/api/verifica', { correu: estat.correu, codi: codi(), respostes: respostesPerEnviar(), idioma: idioma() })
      .then(function (j) {
        if (j.ok && typeof j.min === 'number' && typeof j.max === 'number') {
          estat.resultat = { min: j.min, max: j.max, wa: String(j.whatsapp || '').replace(/\D/g, '') };
          mostra(PASSOS.indexOf('resultat'));
        } else {
          omple('');
          if (j.error === 'caducat') error('codi', I18N.t('El codi ha caducat. Demana\'n un de nou.'));
          else if (j.status === 429) error('codi', I18N.t('Massa intents. Demana un codi nou.'));
          else error('codi', I18N.t('El codi no és correcte. Revisa\'l i torna a escriure\'l.'));
        }
      })
      .catch(function () { error('codi', I18N.t('No hem pogut comprovar el codi. Torna-hi.')); })
      .finally(function () { verificant = false; });
  }

  var reenvia = $('[data-calc-reenvia]');
  var rellotge = null;
  function compteEnrere() {
    var s = 30;
    reenvia.disabled = true;
    clearInterval(rellotge);
    rellotge = setInterval(function () {
      s--;
      if (s <= 0) { clearInterval(rellotge); reenvia.disabled = false; }
    }, 1000);
  }
  reenvia.addEventListener('click', function () { mostra(PASSOS.indexOf('correu'), true); });
  $('[data-calc-canvia-correu]').addEventListener('click', function () { mostra(PASSOS.indexOf('correu'), true); });

  /* ── Resultat i WhatsApp ───────────────────────────────────────────── */
  function euros(n) {
    return n.toLocaleString((window.I18N && window.I18N.bcp) || 'ca-ES', { maximumFractionDigits: 0, useGrouping: 'always' }) + ' €';
  }

  function pintaResultat() {
    var r = estat.resultat;
    var rang = euros(r.min) + ' – ' + euros(r.max);
    $('[data-calc-preu]').textContent = rang;

    var llista = $('[data-calc-resultat-resum]');
    llista.innerHTML = '';
    var resum = PREGUNTES.map(function (p) { return etiqueta(p); });
    resum.forEach(function (t) {
      var li = document.createElement('li');
      li.textContent = t;
      llista.appendChild(li);
    });

    var missatge = I18N.t('Hola, vull fer una mudança. He fet servir la calculadora de la web: {resum}. Preu orientatiu: {rang}. Em podeu dir un dia?')
      .replace('{resum}', resum.join(' · '))
      .replace('{rang}', rang);
    var wa = $('[data-calc-wa]');
    wa.hidden = !r.wa;
    wa.href = 'https://wa.me/' + r.wa + '?text=' + encodeURIComponent(missatge);
  }

  $('[data-calc-reinicia]').addEventListener('click', function () {
    estat = { pas: 0, respostes: {}, correu: estat.correu, resultat: null };
    mostra(0, true);
  });

  // Si l'idioma canvia sense recarregar, es tornen a escriure els textos del JS.
  document.addEventListener('idioma-canviat', function () { dibuixades = []; pintaFurgo(); pintaResum(); if (estat.resultat && PASSOS[estat.pas] === 'resultat') pintaResultat(); });

  mostra(estat.pas);
})();
