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

  // Priority options
  document.querySelectorAll('.priority-option').forEach(o => {
    o.addEventListener('click', () => app.selectPriority(o.dataset.priority));
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

  // Scroll to navigate between periods
  let wheelCooldown = false;
  document.getElementById('appWrapper').addEventListener('wheel', e => {
    const goingDown = e.deltaY > 0;
    const goingUp   = e.deltaY < 0;

    // Year view: scroll inside .year-view first, navigate at limits
    const yearView = document.querySelector('.year-view');
    if (yearView) {
      const atTop    = yearView.scrollTop <= 0;
      const atBottom = yearView.scrollTop + yearView.clientHeight >= yearView.scrollHeight - 1;
      if ((goingDown && !atBottom) || (goingUp && !atTop)) return;
    } else {
      // All other views: let page scroll first, only navigate at scroll limits
      const atTop    = window.scrollY <= 0;
      const atBottom = window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 1;
      if ((goingDown && !atBottom) || (goingUp && !atTop)) return;
    }

    if (wheelCooldown) return;
    e.preventDefault();
    wheelCooldown = true;
    setTimeout(() => { wheelCooldown = false; }, 600);
    app.navigate(e.deltaY > 0 ? 1 : -1);
  }, { passive: false });

  // Keyboard shortcuts
  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); app.undoAction(); return; }
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

}
