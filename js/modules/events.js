// ════════════════════════════════════════════════════════
//  EVENT LISTENERS & HANDLERS
// ════════════════════════════════════════════════════════

export function setupEventListeners(app) {
  // View tabs (la .focus-tab n'a pas de data-view : elle passe par enterFocus)
  document.querySelectorAll('.view-tab[data-view]').forEach(b => {
    b.addEventListener('click', () => {
      // If clicking "Aujourd'hui", reset navDate to today
      if (b.dataset.view === 'day') {
        app.setNavDateAndView(new Date(), 'day');
      } else {
        app.setView(b.dataset.view);
      }
    });
  });

  // Modal interactions
  document.getElementById('cancelModal').addEventListener('click', () => app.cancelModal());
  document.getElementById('cancelDeleteModal').addEventListener('click', () => app.closeDeleteModal());
  document.getElementById('deleteModalOverlay').addEventListener('click', e => {
    if(e.target===e.currentTarget) app.closeDeleteModal();
  });
  document.getElementById('deleteOneBtn').addEventListener('click', () => app.deleteOneOccurrence());
  document.getElementById('deleteFutureBtn').addEventListener('click', () => app.deleteFutureOccurrences());
  document.getElementById('deleteAllBtn').addEventListener('click', () => app.deleteAllOccurrences());
  document.getElementById('saveTask').addEventListener('click', () => app.saveTask());

  // Recurrence options
  document.querySelectorAll('.rec-option').forEach(o => {
    o.addEventListener('click', () => app.selectRecurrence(o.dataset.rec));
  });

  // Priority options
  document.querySelectorAll('.priority-option').forEach(o => {
    o.addEventListener('click', () => app.selectPriority(o.dataset.priority));
  });

  // Quick insert — barre de saisie flottante ouverte par le raccourci 'n'.
  // Entrée et blur font strictement la même chose (créer si non-vide, puis
  // fermer) — cf. commentaire de confirmQuickInsert() dans app.js.
  const quickInsertInput = document.getElementById('quickInsertInput');
  if (quickInsertInput) {
    quickInsertInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); app.confirmQuickInsert(); }
    });
    quickInsertInput.addEventListener('blur', () => app.confirmQuickInsert());
  }

  // Global Escape — close whichever modal is open
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    const visible = id => !document.getElementById(id)?.classList.contains('hidden');
    if (visible('quickInsertOverlay'))   { app.closeQuickInsert();   return; }
    if (visible('modalOverlay'))         { app.closeModal();         return; }
    if (visible('deleteModalOverlay'))   { app.closeDeleteModal();   return; }
    if (visible('reviewModalOverlay'))   { app.closeReviewModal();   return; }
    if (visible('adminModalOverlay'))    { app.closeAdminModal();    return; }
    if (visible('templateModalOverlay')) { app.closeTemplateModal(); return; }
    if (visible('authModalOverlay'))     { app.closeAuthModal();     return; }
    if (visible('upgradePromptOverlay')) { app.upgradeDismiss();     return; }
    if (visible('leavePromptOverlay'))   { app.closeLeavePrompt();   return; }
    if (visible('avatarEditorOverlay'))  { app.closeAvatarEditor();  return; }
    if (visible('guestNameOverlay'))     { app.skipGuestName();      return; }
    if (document.getElementById('debugDrawer')?.classList.contains('open')) { app.toggleDebugPanel(); return; }
    if (document.body.classList.contains('view-focus')) { app.minimizeFocus(); return; }
  });

  // Debug panel — click outside closes it
  document.addEventListener('click', e => {
    const drawer = document.getElementById('debugDrawer');
    if (drawer?.classList.contains('open') && !e.target.closest('#debugPanel')) app.toggleDebugPanel();
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); app.undoAction(); return; }
    if (document.activeElement.tagName==='INPUT' || document.activeElement.tagName==='SELECT' || document.activeElement.tagName==='TEXTAREA' || document.activeElement.isContentEditable) return;
    // Mode focus : raccourcis dédiés, pas de navigation générique
    if (document.body.classList.contains('view-focus')) {
      if (e.key === ' ')          { e.preventDefault(); app.focusPauseResume(); }
      if (e.key === 'Enter')      { e.preventDefault(); app.focusComplete(); }
      if (e.key === 'ArrowRight') { e.preventDefault(); app.focusNext(); }
      if (e.key === 'ArrowLeft')  { e.preventDefault(); app.focusPrev(); }
      if (e.key === 's') app.focusSkip();
      if (e.key === 'd') app.focusTomorrow();
      if (e.key === 'p') app.focusPauseResume();
      return;
    }
    if (!document.getElementById('planMonthScroll')) {
      if (e.key==='ArrowLeft')  app.navigate(-1);
      if (e.key==='ArrowRight') app.navigate(1);
    }
    // Navigation/vues/actions rapides : Alt+lettre, jamais une lettre nue —
    // une lettre seule tapée dans un champ non reconnu comme INPUT (ex. un
    // futur contentEditable non couvert par le garde-fou ci-dessus) ne doit
    // jamais faire sauter de vue en pleine saisie. Ctrl/Cmd écarté : Ctrl/Cmd+N
    // (nouvelle fenêtre) et +W (fermer l'onglet) sont réservés par le
    // navigateur et inutilisables depuis la page.
    if (!e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    // Sur macOS, Option+lettre remplace `e.key` par le caractère spécial de la
    // touche morte (Option+D → « ∂ », Option+N → « ˜ »…) : la lettre attendue
    // n'y est plus. `e.code` ('KeyD') reste, lui, la touche physique quel que
    // soit le modificateur. On accepte les DEUX (union, jamais un remplacement)
    // pour ne rien casser là où `e.key` suffisait déjà.
    const codeLetter = /^Key([A-Za-z])$/.exec(e.code || '')?.[1]?.toLowerCase() || '';
    const hit = l => e.key.toLowerCase() === l || codeLetter === l;
    if (hit('f')) { e.preventDefault(); app.enterFocus(); return; }
    if (hit('d')) { e.preventDefault(); app.setView('day'); }
    if (hit('w')) { e.preventDefault(); app.setView('week'); }
    if (hit('m')) { e.preventDefault(); app.setView('month'); }
    if (hit('y')) { e.preventDefault(); app.setView('year'); }
    if (hit('t')) { e.preventDefault(); app.todayNav(); }
    if (hit('n')) { e.preventDefault(); app.openQuickInsert(); }
    // Bascule Liste ⇄ Agenda de la vue jour (ramène sur la vue jour si on est
    // ailleurs — cf. app.toggleDayLayout).
    if (hit('a')) { e.preventDefault(); app.toggleDayLayout(); }
  });

}
