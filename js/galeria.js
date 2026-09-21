/* =========================================================================
   REPLÀ — visor de la galeria (home)
   <dialog> natiu: ESC tanca, el focus torna a la foto que l'ha obert.
   Sense JS, les fotos es veuen igual a la graella (el visor és un extra).
   ========================================================================= */
(function () {
  'use strict';

  var visor = document.querySelector('[data-visor-dialog]');
  if (!visor || typeof visor.showModal !== 'function') return;

  var img = visor.querySelector('img');
  var peu = visor.querySelector('p');
  var origen = null;

  document.querySelectorAll('[data-visor]').forEach(function (boto) {
    boto.addEventListener('click', function () {
      var foto = boto.querySelector('img');
      var titol = boto.closest('figure').querySelector('strong');
      img.src = foto.currentSrc || foto.src;
      img.alt = foto.alt;
      peu.textContent = titol ? titol.textContent : '';
      origen = boto;
      visor.showModal();
    });
  });

  visor.querySelector('[data-visor-tanca]').addEventListener('click', function () { visor.close(); });
  // Clic fora de la foto (al fons del diàleg) també tanca.
  visor.addEventListener('click', function (e) { if (e.target === visor) visor.close(); });
  visor.addEventListener('close', function () { if (origen) origen.focus(); });
})();
