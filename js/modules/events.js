// ════════════════════════════════════════════════════════
//  EVENT LISTENERS & HANDLERS
// ════════════════════════════════════════════════════════

export function setupEventListeners(app) {
  // View tabs
  document.querySelectorAll('.view-tab').forEach(b => {
    b.addEventListener('click', () => {
      app.setView(b.dataset.view);
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
  // Backdrop click does NOT close the add modal — only the X button does.
  document.getElementById('saveTask').addEventListener('click', () => app.saveTask());

  // Recurrence options
  document.querySelectorAll('.rec-option').forEach(o => {
    o.addEventListener('click', () => app.selectRecurrence(o.dataset.rec));
  });

  // Priority options
  document.querySelectorAll('.priority-option').forEach(o => {
    o.addEventListener('click', () => app.selectPriority(o.dataset.priority));
  });

  // Task title keyboard
  document.getElementById('taskTitle').addEventListener('keydown', e => {
    if (e.key==='Enter') app.saveTask();
  });

  // Quick add
  const quickAddInput = document.getElementById('quickAddInput');
  if (quickAddInput) {
    quickAddInput.addEventListener('keydown', e => {
      if (e.key==='Enter') app.quickAdd();
    });
  }
  const quickAddSubmit = document.getElementById('quickAddSubmit');
  if (quickAddSubmit) {
    quickAddSubmit.addEventListener('click', () => app.quickAdd());
  }

  // Quick add target toggle
  const qaToday = document.getElementById('qaToday');
  const qaNav = document.getElementById('qaNav');
  if (qaToday) qaToday.addEventListener('click', () => app.setQuickAddTarget('today'));
  if (qaNav) qaNav.addEventListener('click', () => app.setQuickAddTarget('nav'));

  // Task date change (for modal clouds)
  document.getElementById('taskDate').addEventListener('change', e => {
    const d = e.target.value ? app.parseDS(e.target.value) : app.getNavDate();
    document.getElementById('modalClouds').innerHTML = app.getCloudsHTML(d);
  });


  // Global Escape — close whichever modal is open
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    const visible = id => !document.getElementById(id)?.classList.contains('hidden');
    if (visible('modalOverlay'))         { app.closeModal();         return; }
    if (visible('deleteModalOverlay'))   { app.closeDeleteModal();   return; }
    if (visible('adminModalOverlay'))    { app.closeAdminModal();    return; }
    if (visible('templateModalOverlay')) { app.closeTemplateModal(); return; }
    if (visible('authModalOverlay'))     { app.closeAuthModal();     return; }
    if (visible('upgradePromptOverlay')) { app.upgradeDismiss();     return; }
    if (visible('leavePromptOverlay'))   { app.closeLeavePrompt();   return; }
    if (visible('avatarEditorOverlay'))  { app.closeAvatarEditor();  return; }
    if (visible('guestNameOverlay'))     { app.skipGuestName();      return; }
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); app.undoAction(); return; }
    if (document.activeElement.tagName==='INPUT' || document.activeElement.tagName==='SELECT' || document.activeElement.tagName==='TEXTAREA') return;
    if (!document.getElementById('planMonthScroll')) {
      if (e.key==='ArrowLeft')  app.navigate(-1);
      if (e.key==='ArrowRight') app.navigate(1);
    }
    if (e.key==='d') app.setView('day');
    if (e.key==='w') app.setView('week');
    if (e.key==='m') app.setView('month');
    if (e.key==='y') app.setView('year');
    if (e.key==='t') app.todayNav();
    if (e.key==='n') app.openModal();
  });

}
