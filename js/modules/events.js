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

  // Navigation
  document.getElementById('prevBtn').addEventListener('click', () => app.navigate(-1));
  document.getElementById('nextBtn').addEventListener('click', () => app.navigate(1));
  document.getElementById('todayBtn').addEventListener('click', () => app.todayNav());
  document.getElementById('openModalBtn').addEventListener('click', () => app.openModal());

  // Modal interactions
  document.getElementById('cancelModal').addEventListener('click', () => app.closeModal());
  document.getElementById('cancelDeleteModal').addEventListener('click', () => app.closeDeleteModal());
  document.getElementById('deleteModalOverlay').addEventListener('click', e => {
    if(e.target===e.currentTarget) app.closeDeleteModal();
  });
  document.getElementById('deleteOneBtn').addEventListener('click', () => app.deleteOneOccurrence());
  document.getElementById('deleteFutureBtn').addEventListener('click', () => app.deleteFutureOccurrences());
  document.getElementById('deleteAllBtn').addEventListener('click', () => app.deleteAllOccurrences());
  document.getElementById('modalOverlay').addEventListener('click', e => {
    if(e.target===e.currentTarget) app.closeModal();
  });
  document.getElementById('saveTask').addEventListener('click', () => app.saveTask());

  // Recurrence options
  document.querySelectorAll('.rec-option').forEach(o => {
    o.addEventListener('click', () => app.selectRecurrence(o.dataset.rec));
  });

  // Task title keyboard
  document.getElementById('taskTitle').addEventListener('keydown', e => {
    if (e.key==='Enter') app.saveTask();
    if (e.key==='Escape') app.closeModal();
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
    const esc = (s) => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    document.getElementById('modalClouds').innerHTML = app.getCloudsHTML(d);
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', e => {
    if (document.activeElement.tagName==='INPUT' || document.activeElement.tagName==='SELECT' || document.activeElement.tagName==='TEXTAREA') return;
    if (e.key==='ArrowLeft')  app.navigate(-1);
    if (e.key==='ArrowRight') app.navigate(1);
    if (e.key==='d') app.setView('day');
    if (e.key==='w') app.setView('week');
    if (e.key==='m') app.setView('month');
    if (e.key==='y') app.setView('year');
    if (e.key==='t') app.todayNav();
    if (e.key==='n') app.openModal();
  });

  // Import file
  document.getElementById('importFileInput').addEventListener('change', e => app.handleImportFile(e));
}
