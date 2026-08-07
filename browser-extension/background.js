// Service worker MV3 — coupe le son des autres onglets pendant l'écoute.
//
// Invariant : on ne rétablit QUE les onglets qu'on a nous-mêmes coupés. Un
// onglet déjà muet avant l'écoute (coupé à la main par l'utilisateur) doit
// le rester après — d'où la liste `mutedByUs`, et le filtre `muted: false`
// à la sélection.
//
// Un service worker MV3 est tué dès qu'il est inactif : cette liste ne peut
// pas vivre en variable de module (elle serait perdue entre le mute et le
// démute). chrome.storage.session la garde en mémoire pour la durée de la
// session du navigateur, sans jamais toucher au disque.

const KEY = 'mutedByUs';
const RESTORE_ALARM = 'restore-audio';
// Filet de sécurité : si un « stop » n'arrive jamais (onglet tué, app
// plantée), on rétablit tout seul plutôt que de laisser la musique muette.
const FAILSAFE_MIN = 5;

let _restoreTimer = null;

async function _getMuted() {
  return (await chrome.storage.session.get(KEY))[KEY] || [];
}

async function muteOthers(senderTabId) {
  clearTimeout(_restoreTimer);
  _restoreTimer = null;
  // audible: seuls les onglets qui émettent réellement du son ; muted: false
  // pour ne pas s'attribuer un onglet que l'utilisateur avait déjà coupé.
  const tabs = await chrome.tabs.query({ audible: true, muted: false });
  const ids = [];
  for (const t of tabs) {
    if (t.id === senderTabId || t.id == null) continue;
    try {
      await chrome.tabs.update(t.id, { muted: true });
      ids.push(t.id);
    } catch { /* onglet fermé entre-temps */ }
  }
  if (!ids.length) return;
  const prev = await _getMuted();
  await chrome.storage.session.set({ [KEY]: [...new Set([...prev, ...ids])] });
  chrome.alarms.create(RESTORE_ALARM, { delayInMinutes: FAILSAFE_MIN });
}

async function restore() {
  chrome.alarms.clear(RESTORE_ALARM);
  const ids = await _getMuted();
  for (const id of ids) {
    try { await chrome.tabs.update(id, { muted: false }); } catch { /* onglet fermé */ }
  }
  await chrome.storage.session.set({ [KEY]: [] });
}

chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg?.type === 'dictation-start') {
    muteOthers(sender.tab?.id);
  } else if (msg?.type === 'dictation-stop') {
    // Court délai avant de rétablir : passer d'un champ à l'autre (titre →
    // notes → sous-tâche) enchaîne un stop puis un start immédiat, et
    // rétablir le son entre les deux ferait repartir la musique une demi-
    // seconde à chaque fois.
    clearTimeout(_restoreTimer);
    _restoreTimer = setTimeout(restore, 700);
  }
});

chrome.alarms.onAlarm.addListener(a => { if (a.name === RESTORE_ALARM) restore(); });

// Le navigateur redémarre / l'extension est rechargée : ne jamais laisser
// derrière soi un onglet muet dont plus personne ne se souvient.
chrome.runtime.onStartup.addListener(restore);
chrome.runtime.onInstalled.addListener(restore);
