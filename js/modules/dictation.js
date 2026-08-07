// ─── Dictée vocale (Web Speech API) ───────────────────────────────────────
//
// Reconnaissance vocale NATIVE du navigateur (`SpeechRecognition` /
// `webkitSpeechRecognition`) — aucune dépendance externe, aucune permission
// système : c'est le navigateur qui demande le micro. Remplace l'idée d'un
// pont vers Wispr Flow, impossible depuis une page web (un KeyboardEvent
// fabriqué en JS est « untrusted » et ne sort jamais de l'onglet, donc aucun
// raccourci global macOS ne peut être déclenché depuis ici).
//
// Une SEULE session vivante à la fois dans toute l'app (variables de module
// ci-dessous) : ouvrir le micro d'un champ arrête proprement celui d'un autre
// en committant au passage le texte intermédiaire en cours.
//
// Champs couverts (via attachMic) : titre + notes de la tâche (modal normal
// ET mode guidé) et tous les inputs de sous-tâche (vue jour, modal, Focus).

import * as state from './state.js';

const SR = window.SpeechRecognition || window.webkitSpeechRecognition;

const AUTO_KEY = 'dictationAuto';
const LANGS = { fr: 'fr-FR', en: 'en-US', es: 'es-ES' };

// Chrome coupe la reconnaissance de lui-même après quelques secondes de
// silence : sans relance, le micro serait inutilisable dès qu'on réfléchit
// deux secondes. MAIS chaque (re)démarrage fait jouer à Chrome son bip de
// reconnaissance vocale — son joué par le NAVIGATEUR, qu'aucune API ne
// permet de couper (l'interface SpeechRecognition n'expose rien de tel).
// La seule variable sous notre contrôle est donc le NOMBRE de relances :
//  - session qui n'a jamais rien entendu → aucune relance (micro armé à
//    l'ouverture du modal pendant qu'on tape : ça ne biperait que dans le vide) ;
//  - session qui a déjà transcrit → on relance, mais sur une fenêtre courte.
const IDLE_STOP_MS  = 12000; // silence après la dernière transcription
const TIGHT_RUN_MS  = 500;   // un run plus court que ça sans résultat = boucle
const MAX_TIGHT_RUNS = 3;    // garde-fou anti-boucle serrée (micro indisponible)

const MIC_SVG = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>';

let _rec = null;        // instance SpeechRecognition active
let _target = null;     // <input>/<textarea> en cours de dictée
let _btn = null;        // bouton micro associé
let _base = '';         // texte committé (valeur initiale + résultats finaux)
let _interim = '';      // hypothèse en cours, réécrite à chaque résultat
let _applying = false;  // garde : distingue nos propres écritures d'une frappe
let _stopping = false;  // arrêt explicite → onend ne relance pas
let _lastActivity = 0;
let _tightRuns = 0;

export function isDictationSupported() { return !!SR; }

// Défaut ON : c'est la demande d'origine — que l'écoute démarre toute seule
// à l'ouverture de « Nouvelle tâche ». Désactivable dans les Réglages, et
// coupé automatiquement si le micro est refusé (cf. onerror).
export function isAutoDictate() { return !!SR && localStorage.getItem(AUTO_KEY) !== 'false'; }
export function setAutoDictate(on) { localStorage.setItem(AUTO_KEY, on ? 'true' : 'false'); }

export function isDictating(el) { return !!_rec && (!el || _target === el); }

function _append(base, chunk) {
  chunk = (chunk || '').trim();
  if (!chunk) return base;
  if (!base) return chunk.charAt(0).toUpperCase() + chunk.slice(1);
  return /\s$/.test(base) ? base + chunk : base + ' ' + chunk;
}

// Écrit base + interim dans le champ. Passe par un vrai event `input` pour
// que tout ce qui écoute déjà ce champ suive (autosave du brouillon,
// combobox de titre, révélation des champs contextuels…).
function _apply() {
  if (!_target) return;
  let v = _base;
  if (_interim) v = /\s$/.test(v) || !v ? v + _interim : v + ' ' + _interim;
  const max = _target.maxLength;
  // .value assigné en JS ignore maxlength (qui ne borne que la saisie
  // clavier) — le titre est en maxlength=200, on tronque donc nous-mêmes.
  if (max > 0 && v.length > max) v = v.slice(0, max);
  _applying = true;
  _target.value = v;
  _target.dispatchEvent(new Event('input', { bubbles: true }));
  _applying = false;
  try { _target.selectionStart = _target.selectionEnd = v.length; } catch {}
  if (_target.tagName === 'TEXTAREA') _target.scrollTop = _target.scrollHeight;
}

// L'utilisateur tape pendant que le micro écoute : sa frappe fait foi, on
// repart de ce qu'il voit à l'écran. Sans ça, le prochain résultat final
// réécrirait _base (capturé au démarrage) par-dessus ce qu'il vient d'écrire.
function _onUserInput(e) {
  if (_applying || e.target !== _target) return;
  _base = _target.value;
  _interim = '';
}

// Signale l'écoute à l'extension navigateur optionnelle (browser-extension/),
// qui coupe le son des autres onglets pendant la dictée. Une page web ne peut
// PAS agir sur un autre onglet (ni sur une autre app) : c'est une frontière
// du bac à sable, seule une extension a l'API `chrome.tabs`. On se contente
// donc de crier dans le vide — si l'extension n'est pas installée, ce
// postMessage n'a strictement aucun effet et aucun coût.
function _notifyExtension(stateName) {
  try { window.postMessage({ __2fukoi: 'dictation', state: stateName }, window.location.origin); } catch {}
}

function _cleanup() {
  _notifyExtension('stop');
  if (_btn) _btn.classList.remove('listening');
  if (_target) {
    _target.classList.remove('dictating');
    _target.removeEventListener('input', _onUserInput);
  }
  _rec = null; _target = null; _btn = null; _base = ''; _interim = '';
}

export function stopDictation() {
  if (!_rec) return;
  _stopping = true;
  // Ne jamais perdre l'hypothèse en cours : la committer avant de couper.
  if (_interim) { _base = _append(_base, _interim); _interim = ''; _apply(); }
  const rec = _rec;
  _cleanup();
  try { rec.stop(); } catch {}
}

// Un render() complet régénère le DOM sans passer par input.remove() : le
// champ dicté peut donc disparaître avec une reconnaissance encore vivante,
// qui continuerait d'écrire dans un nœud détaché (micro resté chaud, sans
// aucun retour visuel). Appelé en tête de render().
export function stopIfDetached() {
  if (_rec && _target && !_target.isConnected) stopDictation();
}

export function startDictation(el) {
  if (!SR || !el) return false;
  if (_rec && _target === el) { stopDictation(); return false; }
  stopDictation();

  let rec;
  try { rec = new SR(); } catch { return false; }
  rec.lang = LANGS[state.lang] || LANGS.en;
  rec.continuous = true;
  rec.interimResults = true;

  _rec = rec;
  _target = el;
  _btn = el._dictateBtn || null;
  _base = el.value || '';
  _interim = '';
  _stopping = false;
  _lastActivity = Date.now();
  _tightRuns = 0;

  let runStart = 0, runGotResult = false, sessionGotResult = false;

  rec.onstart = () => { runStart = Date.now(); runGotResult = false; };

  rec.onresult = e => {
    if (_rec !== rec) return;
    runGotResult = true;
    sessionGotResult = true;
    _lastActivity = Date.now();
    let interim = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i];
      if (r.isFinal) _base = _append(_base, r[0].transcript);
      else interim += r[0].transcript;
    }
    _interim = interim.trim();
    _apply();
  };

  rec.onerror = e => {
    if (_rec !== rec) return;
    if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
      // Micro refusé : couper la dictée automatique, sinon chaque ouverture
      // de « Nouvelle tâche » relancerait une demande vouée à échouer.
      _stopping = true;
      setAutoDictate(false);
      window.app?._showToast('Micro refusé — dictée automatique désactivée (Réglages pour la réactiver)');
    } else if (e.error === 'audio-capture') {
      _stopping = true;
      window.app?._showToast('Aucun micro détecté');
    }
    // 'no-speech' / 'aborted' : onend décide de relancer ou non.
  };

  rec.onend = () => {
    if (_rec !== rec) return; // une autre session a déjà pris la main
    const tight = !runGotResult && Date.now() - runStart < TIGHT_RUN_MS;
    _tightRuns = tight ? _tightRuns + 1 : 0;
    // sessionGotResult : ne jamais relancer une session restée muette — c'est
    // le cas « micro armé automatiquement, mais l'utilisateur tape », où
    // chaque relance ne ferait qu'ajouter un bip de Chrome sans rien capter.
    const worthRestarting = sessionGotResult && Date.now() - _lastActivity < IDLE_STOP_MS;
    if (!_stopping && el.isConnected && _tightRuns < MAX_TIGHT_RUNS && worthRestarting) {
      try { rec.start(); return; } catch {}
    }
    if (_interim) { _base = _append(_base, _interim); _interim = ''; _apply(); }
    _cleanup();
  };

  try { rec.start(); } catch { _cleanup(); return false; }
  el.addEventListener('input', _onUserInput);
  el.classList.add('dictating');
  if (_btn) _btn.classList.add('listening');
  _notifyExtension('start');
  return true;
}

// Pose un bouton micro sur un champ.
//   wrap: false → le bouton est inséré comme frère juste après le champ ;
//     l'appelant garantit un ancêtre positionné (.fl-group est déjà en
//     position:relative). Obligatoire pour #taskTitle/#taskDescription, dont
//     le label flottant dépend du sélecteur `.fl-input:focus ~ .fl-label` —
//     envelopper le champ casserait cette fratrie.
//   wrap: true → champ + bouton enveloppés dans .dictate-field (relative).
//     Pour les champs créés à la volée qui n'ont aucun conteneur à eux.
//   compact: true → bouton réduit, pour les lignes de sous-tâche (trop
//     basses pour la taille standard).
export function attachMic(el, { wrap = false, compact = false } = {}) {
  if (!SR || !el || el._dictateBtn) return null;

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = compact ? 'dictate-btn dictate-btn--sm' : 'dictate-btn';
  btn.title = 'Dicter (voix)';
  btn.setAttribute('aria-label', 'Dicter');
  // Hors du parcours Tab : le modal a une navigation clavier très écrite
  // (Entrée sauve depuis n'importe quel champ, Alt+Tab → durée estimée), un
  // arrêt supplémentaire entre le titre et les notes la casserait.
  btn.tabIndex = -1;
  btn.innerHTML = MIC_SVG;
  // Le micro ne doit JAMAIS voler le focus du champ : les inputs de
  // sous-tâche valident sur blur, un simple clic sur le bouton fermerait
  // donc la saisie en cours avant même d'avoir commencé à dicter.
  btn.addEventListener('mousedown', e => e.preventDefault());
  btn.addEventListener('click', e => {
    e.preventDefault();
    e.stopPropagation();
    if (isDictating(el)) stopDictation();
    else { el.focus(); startDictation(el); }
  });

  el._dictateBtn = btn;
  el.classList.add('has-dictate');

  if (wrap) {
    const w = document.createElement('span');
    w.className = 'dictate-field';
    el.replaceWith(w);
    w.appendChild(el);
    w.appendChild(btn);
    // Les appelants créent ces inputs puis les retirent eux-mêmes
    // (input.remove() dans addSubtaskInline / focusAddSubtask /
    // addModalSubtaskInline, sur les chemins confirmer ET Échap) — rediriger
    // ce remove() vers le wrapper, sinon micro et wrapper resteraient
    // orphelins dans la liste après chaque saisie.
    const origRemove = el.remove.bind(el);
    el.remove = () => { if (isDictating(el)) stopDictation(); origRemove(); w.remove(); };
  } else {
    el.insertAdjacentElement('afterend', btn);
  }
  return btn;
}

// Les champs équipés lisent tous leur `.value` dans LEUR propre handler
// (Entrée valide la sous-tâche, blur la sauve, Échap annule). Il faut donc
// committer l'hypothèse en cours AVANT eux, sinon le dernier bout de phrase
// dicté serait lu trop tôt et perdu. Un listener au niveau `document` en
// phase de CAPTURE est la seule façon fiable de passer en premier :
// enregistrer un listener supplémentaire sur le champ lui-même ne suffirait
// pas (au niveau de la cible, l'ordre est celui de l'enregistrement, et
// attachMic() est toujours appelé APRÈS les handlers du champ).
if (SR) {
  document.addEventListener('keydown', e => {
    if (_rec && e.target === _target && (e.key === 'Enter' || e.key === 'Escape')) stopDictation();
  }, true);
  // La dictée suit le champ actif : quitter le champ arrête l'écoute (et
  // committe au passage). Le bouton micro, lui, ne provoque jamais de blur
  // (mousedown preventDefault dans attachMic).
  document.addEventListener('blur', e => {
    if (_rec && e.target === _target) stopDictation();
  }, true);
}

// Démarre la dictée sur un champ SI le réglage automatique est actif.
// Utilisé aux points d'entrée « on vient d'ouvrir un champ vierge pour
// écrire une tâche » — jamais à l'édition d'un contenu existant.
export function autoStartDictation(el) {
  if (!el || !isAutoDictate()) return false;
  return startDictation(el);
}
