/* =========================================================================
   REPLÀ MUDANCES — comportament
   - Sense JS o amb prefers-reduced-motion, tot el contingut es veu igual.
   - Textos escrits des del JS: sempre I18N.t amb la frase catalana literal,
     perquè el verificador i l'extractor d'idiomes els trobin.
   ========================================================================= */
(function () {
  'use strict';

  if (!window.I18N) window.I18N = { t: function (s) { return s; } };
  var redueix = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ── Menú mòbil ─────────────────────────────────────────────────────── */
  var obre = document.querySelector('.nav-obre');
  var nav = document.getElementById('nav');
  if (obre && nav) {
    var tanca = function () {
      obre.setAttribute('aria-expanded', 'false');
      nav.classList.remove('obert');
    };
    obre.addEventListener('click', function () {
      var obert = obre.getAttribute('aria-expanded') === 'true';
      obre.setAttribute('aria-expanded', String(!obert));
      nav.classList.toggle('obert', !obert);
    });
    nav.addEventListener('click', function (e) { if (e.target.closest('a')) tanca(); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && obre.getAttribute('aria-expanded') === 'true') { tanca(); obre.focus(); }
    });
  }

  /* ── Aparicions d'un sol tret i la furgoneta del dia ─────────────────
     Un sol IntersectionObserver; cada element es marca un cop i es deixa. */
  var aparicions = document.querySelectorAll('.aparicio, [data-dia]');
  if (!redueix && 'IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entrades) {
      entrades.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add(e.target.hasAttribute('data-dia') ? 'en-marxa' : 'vista');
        io.unobserve(e.target);
      });
    }, { rootMargin: '0px 0px -25% 0px' });
    aparicions.forEach(function (el) { io.observe(el); });
  } else {
    aparicions.forEach(function (el) { el.classList.add('vista', 'en-marxa'); });
  }

  /* ── Formulari de contacte (Formspree, enviament real) ──────────────── */
  var form = document.getElementById('form-contacte');
  if (form) {
    var estat = form.querySelector('.form-estat');
    var boto = form.querySelector('button[type="submit"]');
    var textBoto = boto ? boto.textContent : '';
    var mostra = function (tipus, missatge) {
      estat.hidden = false;
      estat.setAttribute('data-tipus', tipus);
      estat.textContent = missatge;
      estat.focus();
    };
    var marca = function (camp, error) {
      var caixa = camp.closest('.camp');
      var msg = caixa && caixa.querySelector('.camp-error');
      camp.setAttribute('aria-invalid', error ? 'true' : 'false');
      if (msg) msg.textContent = error || '';
    };

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var nom = form.elements['nom'];
      var correu = form.elements['email'];
      var missatge = form.elements['missatge'];
      var errors = 0;
      marca(nom, nom.value.trim() ? '' : I18N.t('Escriu el teu nom.'));
      if (!nom.value.trim()) errors++;
      var correuOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correu.value.trim());
      marca(correu, correuOk ? '' : I18N.t('Escriu un correu vàlid.'));
      if (!correuOk) errors++;
      marca(missatge, missatge.value.trim() ? '' : I18N.t('Explica\'ns què et cal.'));
      if (!missatge.value.trim()) errors++;
      if (errors) {
        var primer = form.querySelector('[aria-invalid="true"]');
        if (primer) primer.focus();
        return;
      }

      boto.disabled = true;
      boto.textContent = I18N.t('Enviant…');
      fetch(form.action, {
        method: 'POST',
        body: new FormData(form),
        headers: { Accept: 'application/json' }
      }).then(function (r) {
        if (!r.ok) throw new Error(String(r.status));
        form.reset();
        mostra('ok', I18N.t('Rebut. Et contestem avui mateix o demà al matí.'));
      }).catch(function () {
        mostra('error', I18N.t('No s\'ha pogut enviar. Truca\'ns al 600 000 000 i t\'atenem directament.'));
      }).finally(function () {
        boto.disabled = false;
        boto.textContent = textBoto;
      });
    });
  }
})();
