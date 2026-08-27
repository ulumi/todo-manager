// Dialogues de confirmation / alerte / choix de l'application.
//
// Remplace INTÉGRALEMENT les boîtes natives du navigateur (`confirm()`,
// `alert()`, `prompt()`) : elles ne sont pas stylisables, ignorent le thème
// clair/sombre, affichent le nom de domaine et bloquent le thread. Tout
// passe désormais par un vrai modal de l'app, qui réutilise les classes
// `.modal-overlay` / `.modal` du modal d'édition — donc exactement le même
// fond assombri + `backdrop-filter: blur()`, la même surface, la même
// bordure et le même thème, sans styliser deux fois la même chose.
//
// ⚠ Volontairement SANS AUCUN import : ce module doit rester utilisable
// depuis le filet de secours de bas d'`app.js` (écran de récupération quand
// le constructeur `TodoApp` a lui-même levé), où plus rien de l'app n'est
// garanti debout — ni `state`, ni `window.app`, ni les traductions.
//
// API (toutes asynchrones — les appelants sont donc `async` / `.then()`,
// contrairement aux `confirm()` natifs qui étaient synchrones) :
//   await appConfirm(message, { title, confirmLabel, cancelLabel, danger, detail })
//   await appAlert(message,   { title, okLabel, tone })
//   await appChoice({ title, message, options: [{ value, label, desc, danger }] })
//   await appPrompt(message,  { title, value, placeholder, confirmLabel })
//
// Note : `appPrompt()` n'est PAS le remplaçant par défaut d'une saisie dans
// l'app — la convention y reste l'input inline injecté à l'endroit concerné
// (_inlineInput / _inlineTitlePrompt / _multiBarPrompt). Il n'existe que pour
// les surfaces qui n'ont aucun ancrage DOM où poser un champ.

// Icônes : SVG en trait `currentColor` uniquement — jamais d'emoji
// multicolore (règle de design globale du projet).
const _ICON_PATHS = {
  danger:   '<path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>',
  warning:  '<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13.5"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
  question: '<circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
  info:     '<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="11.5"/><line x1="12" y1="8" x2="12.01" y2="8"/>',
};
// Le triangle d'avertissement sert deux tons : `warning` (orange/primaire,
// « attention, conséquence ») et `error` (rouge, « ça a échoué »).
_ICON_PATHS.error = _ICON_PATHS.warning;

// Tons qui virent au rouge. `danger` (poubelle) et `error` (triangle) ne
// diffèrent que par l'icône — l'un annonce une suppression volontaire,
// l'autre un échec.
const _RED_TONES = new Set(['danger', 'error']);

function _iconSVG(tone) {
  const d = _ICON_PATHS[tone] || _ICON_PATHS.question;
  return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
}

const CLOSE_SVG = '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><line x1="2" y1="2" x2="14" y2="14"/><line x1="14" y1="2" x2="2" y2="14"/></svg>';

// Empilement : un dialogue peut légitimement s'ouvrir par-dessus un autre
// (ex. « perte de champs » puis « split » dans nestTaskAsSubtask). Chaque
// niveau monte d'un cran en z-index, au-dessus des modals (600), de la
// saisie rapide (9500) et du menu contextuel (9999).
const Z_BASE = 10000;
let _depth = 0;

/**
 * Cœur partagé. `buttons` = [{ label, value, variant, desc?, autofocus? }].
 * Dès qu'un bouton porte un `desc`, la liste passe en colonne pleine
 * largeur (même présentation que le modal « Supprimer une récurrence »).
 */
function _openDialog({ title, message, detail, tone = 'question', buttons, dismissValue = false, input = null }) {
  return new Promise(resolve => {
    _depth++;
    const level = _depth;

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay app-dialog-overlay';
    overlay.style.zIndex = String(Z_BASE + level * 10);

    const box = document.createElement('div');
    box.className = 'modal app-dialog' + (_RED_TONES.has(tone) ? ' app-dialog--danger' : '');
    box.setAttribute('role', 'alertdialog');
    box.setAttribute('aria-modal', 'true');

    const head = document.createElement('div');
    head.className = 'app-dialog-head';
    const icon = document.createElement('span');
    icon.className = 'app-dialog-icon';
    icon.innerHTML = _iconSVG(tone);
    const h = document.createElement('div');
    h.className = 'app-dialog-title';
    h.textContent = title;
    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'modal-close-btn app-dialog-close';
    closeBtn.title = 'Fermer';
    closeBtn.setAttribute('aria-label', 'Fermer');
    closeBtn.innerHTML = CLOSE_SVG;
    head.append(icon, h, closeBtn);
    box.appendChild(head);

    if (message) {
      const p = document.createElement('div');
      p.className = 'app-dialog-msg';
      // textContent (jamais innerHTML) : les messages viennent de titres de
      // tâches saisis par l'utilisateur. Les retours à la ligne restent
      // rendus grâce à `white-space: pre-line` côté CSS.
      p.textContent = message;
      box.appendChild(p);
    }
    if (detail) {
      const d = document.createElement('div');
      d.className = 'app-dialog-detail';
      d.textContent = detail;
      box.appendChild(d);
    }

    let field = null;
    if (input) {
      field = document.createElement('input');
      field.type = 'text';
      field.className = 'app-dialog-input';
      field.value = input.value || '';
      if (input.placeholder) field.placeholder = input.placeholder;
      box.appendChild(field);
    }

    const stacked = buttons.some(b => b.desc !== undefined);
    const foot = document.createElement('div');
    foot.className = 'app-dialog-actions' + (stacked ? ' app-dialog-actions--stack' : '');

    let settled = false;
    const close = value => {
      if (settled) return;
      settled = true;
      _depth--;
      document.removeEventListener('keydown', onKey, true);
      overlay.classList.add('closing');
      const gone = () => { overlay.remove(); resolve(value); };
      overlay.addEventListener('animationend', gone, { once: true });
      // Filet : si l'animation ne tire pas (onglet en arrière-plan,
      // `prefers-reduced-motion`), on résout quand même.
      setTimeout(gone, 260);
    };

    let autofocusEl = null;
    buttons.forEach(b => {
      const btn = document.createElement('button');
      btn.type = 'button';
      if (b.desc !== undefined) {
        btn.className = 'app-dialog-opt' + (b.danger ? ' app-dialog-opt--danger' : '');
        const t = document.createElement('span');
        t.className = 'app-dialog-opt-title';
        t.textContent = b.label;
        btn.appendChild(t);
        if (b.desc) {
          const s = document.createElement('span');
          s.className = 'app-dialog-opt-desc';
          s.textContent = b.desc;
          btn.appendChild(s);
        }
      } else {
        btn.className = 'btn btn-' + (b.variant || 'ghost');
        btn.textContent = b.label;
      }
      btn.addEventListener('click', () => close(
        typeof b.value === 'function' ? b.value(field ? field.value : undefined) : b.value));
      foot.appendChild(btn);
      if (b.autofocus) autofocusEl = btn;
    });
    box.appendChild(foot);

    closeBtn.addEventListener('click', () => close(dismissValue));
    overlay.addEventListener('mousedown', e => { if (e.target === overlay) close(dismissValue); });

    // Capture + stopImmediatePropagation : le document porte déjà plusieurs
    // écouteurs `keydown` en phase de bulle (Échap global d'events.js,
    // Entrée-sauve du modal d'édition, raccourcis du mode Focus). Tant qu'un
    // dialogue est ouvert, il est seul à répondre au clavier.
    const onKey = e => {
      if (level !== _depth) return; // un dialogue plus récent est au-dessus
      if (e.key === 'Escape') {
        e.preventDefault(); e.stopImmediatePropagation();
        close(dismissValue);
      } else if (e.key === 'Enter') {
        e.preventDefault(); e.stopImmediatePropagation();
        // Enter valide le bouton focalisé, sinon l'action par défaut.
        const focused = box.contains(document.activeElement) ? document.activeElement : null;
        (focused && focused.tagName === 'BUTTON' ? focused : autofocusEl)?.click();
      } else if (e.key === 'Tab' && document.activeElement !== field) {
        // Piège à focus : le dialogue recouvre tout, tabuler en dehors
        // amènerait sur des contrôles inatteignables.
        const items = [...box.querySelectorAll('button')];
        if (!items.length) return;
        const i = items.indexOf(document.activeElement);
        e.preventDefault();
        const next = e.shiftKey
          ? items[(i <= 0 ? items.length : i) - 1]
          : items[(i + 1) % items.length];
        next.focus();
      }
    };
    document.addEventListener('keydown', onKey, true);

    overlay.appendChild(box);
    document.body.appendChild(overlay);
    if (field) { field.focus(); field.select(); }
    else (autofocusEl || closeBtn).focus();
  });
}

/** Confirmation binaire. Résout `true` si confirmé, `false` sinon. */
export function appConfirm(message, opts = {}) {
  const {
    title = 'Confirmer',
    confirmLabel = 'Confirmer',
    cancelLabel = 'Annuler',
    danger = false,
    detail = '',
    tone = danger ? 'danger' : 'question',
  } = opts;
  return _openDialog({
    title, message, detail, tone,
    dismissValue: false,
    buttons: [
      { label: cancelLabel, value: false, variant: 'ghost' },
      { label: confirmLabel, value: true, variant: danger ? 'danger' : 'primary', autofocus: true },
    ],
  });
}

/** Message d'information — un seul bouton. Résout quand il est refermé. */
export function appAlert(message, opts = {}) {
  const { title = 'Information', okLabel = 'OK', tone = 'info', detail = '' } = opts;
  return _openDialog({
    title, message, detail, tone,
    dismissValue: undefined,
    buttons: [{ label: okLabel, value: undefined, variant: 'primary', autofocus: true }],
  });
}

/**
 * Saisie de texte. Résout la valeur saisie (jamais vide), ou `null` si
 * annulé — même contrat que le `prompt()` natif qu'il remplace.
 */
export function appPrompt(message, opts = {}) {
  const {
    title = 'Saisir',
    value = '',
    placeholder = '',
    confirmLabel = 'Valider',
    cancelLabel = 'Annuler',
    tone = 'question',
  } = opts;
  return _openDialog({
    title, message, tone,
    dismissValue: null,
    input: { value, placeholder },
    buttons: [
      { label: cancelLabel, value: null, variant: 'ghost' },
      { label: confirmLabel, variant: 'primary', autofocus: true,
        value: v => (v || '').trim() || null },
    ],
  });
}

/**
 * Choix parmi N options (chacune avec un descriptif, empilées pleine
 * largeur). Résout la `value` de l'option choisie, ou `null` si annulé.
 */
export function appChoice({ title = 'Choisir', message = '', options = [], cancelLabel = 'Annuler', tone = 'question' }) {
  return _openDialog({
    title, message, tone,
    dismissValue: null,
    buttons: [
      ...options.map((o, i) => ({
        label: o.label, value: o.value, desc: o.desc || '',
        danger: !!o.danger, autofocus: i === 0,
      })),
      { label: cancelLabel, value: null, variant: 'ghost' },
    ],
  });
}
