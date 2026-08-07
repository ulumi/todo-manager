// Pont page → extension.
//
// Une page web n'a AUCUN moyen de parler à une extension sans connaître son
// ID (qui change à chaque installation « unpacked »). Un content script
// contourne complètement ce couplage : il tourne dans la page, écoute un
// simple window.postMessage, et relaie vers le service worker. Côté app,
// aucun identifiant à configurer — et si l'extension n'est pas installée, le
// postMessage de l'app ne fait absolument rien (personne n'écoute).

window.addEventListener('message', e => {
  // Ne jamais accepter un message venant d'une iframe ou d'une autre origine
  if (e.source !== window || e.origin !== window.location.origin) return;
  const d = e.data;
  if (!d || d.__2fukoi !== 'dictation') return;
  try {
    chrome.runtime.sendMessage({ type: d.state === 'start' ? 'dictation-start' : 'dictation-stop' });
  } catch { /* service worker endormi / extension rechargée */ }
});

// Filet de sécurité : fermer/recharger l'onglet 2FŨKOI pendant une écoute ne
// doit pas laisser YouTube muet pour toujours.
window.addEventListener('pagehide', () => {
  try { chrome.runtime.sendMessage({ type: 'dictation-stop' }); } catch {}
});
