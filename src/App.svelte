<script>
  import { onMount, onDestroy } from 'svelte'
  import DayView from './views/DayView.svelte'
  import WeekView from './views/WeekView.svelte'
  import MonthView from './views/MonthView.svelte'
  import YearView from './views/YearView.svelte'
  import CategoriesView from './views/CategoriesView.svelte'
  import ProfileView from './views/ProfileView.svelte'

  import {
    view, navDate, todos, lang, T,
    renderTick, syncAndTick, zoomIdx,
    isOffline, currentUser, messages
  } from './stores.js'

  import * as state from '../js/modules/state.js'
  import { DS, parseDS, today, addDays, startOfWeek, esc } from '../js/modules/utils.js'
  import { saveTodos, loadTodos, getAppConfig, exportAllData, exportCalendarOnly, exportConfigOnly, importData, downloadICalFile, getICalBlobURL, generateICalURL, loadFromServer, saveBackupToServer, getFullBackup, initCrossTabSync } from '../js/modules/storage.js'
  import { getTodosForDate, isCompleted, toggleTodo as calToggleTodo, deleteOneOccurrence, deleteFutureOccurrences, addTask, getSuggestions } from '../js/modules/calendar.js'
  import { openModal, closeModal, openEditModal, selectRecurrence, toggleWeekDay, toggleMonthDay, toggleMonthLastDay, selectYearMonth, selectYearDay, saveTaskLogic, cloudsHTML, openDeleteModal, closeDeleteModal, toggleCloudSection, toggleModalRight, selectPriority, toggleNewCatRow, addCategoryInline } from '../js/modules/modal.js'
  import { getPeriodLabel, getCloudsHTML, renderQACloud, setupTodoItemHoverAnimations, renderSidebar, renderWeekSidebar, renderYearSidebar } from '../js/modules/render.js'
  import { setupEventListeners } from '../js/modules/events.js'
  import { celebrate } from '../js/modules/celebrate.js'
  import { VERSION } from '../js/modules/version.js'
  import { openAdminModal, closeAdminModal, showAdminSection, addSuggestedTask, removeSuggestedTask, moveSuggestedTask, clearAllSuggestedTasks, clearAllCalendarData, openTemplateModal, closeTemplateModal, applyTemplate, addTemplate, removeTemplate, addTaskToTemplate, removeTaskFromTemplate, addCategory, removeCategory, getCategories, saveCategories } from '../js/modules/admin.js'
  import { openCategoryView, closeCategoryView, renderCategoryPanel, getCurrentCategoryId, getCategoryTaskOrder, saveCategoryTaskOrder, saveCategoryDescription, setCategoryIcon } from '../js/modules/projectView.js'
  import { snapshot, undo, canUndo } from '../js/modules/undo.js'
  import { setupOfflineIndicator, deleteUserFirestoreDoc, SESSION_ID } from '../js/modules/sync.js'
  import { initPresence, destroyPresence, markAllMessagesRead, sendUserMessage, updatePresenceName } from '../js/modules/presence.js'
  import { openAvatarEditor, closeAvatarEditor, getAvatarHTML, handleAvatarFile, selectAvatarFilter, selectAvatarEmoji, avatarSwitchTab, saveAvatar, cropDragStart, setCropZoom, setEmojiZoom, FILTERS } from '../js/modules/avatarEditor.js'
  import { pushToFirestore, subscribeToFirestore, loadFromFirestore } from '../js/modules/sync.js'
  import { initAuth, onUserChange, isGuest, getCurrentUser, signInGuest, signInWithEmail, registerWithEmail, upgradeGuestToEmail, signOut, updateUserProfile, signInWithGoogle, signInWithFacebook } from '../js/modules/auth.js'

  import { TRANSLATIONS, ZOOM_SIZES } from '../js/modules/config.js'

  // Reactive state
  let currentView = state.view
  let _zoomIdx = parseInt(localStorage.getItem('zoom') ?? '1')
  let _hamburgerOpen = false
  let _quickAddInDayMode = false
  let _clickTimer = null
  let _firestoreUnsub = null

  // Derived from state module (mutable)
  let dayOrder = JSON.parse(localStorage.getItem('dayOrder') || '{}')
  let recurringOrder = JSON.parse(localStorage.getItem('recurringOrder') || '{}')

  // Subscribe to view store
  view.subscribe(v => { currentView = v })

  function rerender() {
    renderTick.update(n => n + 1)
    _updatePeriodLabel()
    _updateViewTabs()
    _updateBodyClasses()
    _animateQuickAddBtn()
  }

  function _updatePeriodLabel() {
    const el = document.getElementById('periodLabel')
    if (!el) return
    const isCategories = state.view === 'categories'
    const isProfile = state.view === 'profile'
    el.textContent = (isCategories || isProfile) ? '' : getPeriodLabel()
  }

  function _updateViewTabs() {
    document.querySelectorAll('.view-tab').forEach(b =>
      b.classList.toggle('active', b.dataset.view === state.view)
    )
  }

  function _updateBodyClasses() {
    document.body.classList.toggle('view-projects', state.view === 'categories')
    document.body.classList.toggle('view-profile', state.view === 'profile')
  }

  // ─── THEME & ZOOM ────────────────────────────────────────
  function initTheme() {
    const saved = localStorage.getItem('theme')
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    const theme = saved || (prefersDark ? 'dark' : 'light')
    document.documentElement.setAttribute('data-theme', theme)
    updateThemeBtn()
  }

  function toggleTheme() {
    const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark'
    document.documentElement.setAttribute('data-theme', next)
    localStorage.setItem('theme', next)
    updateThemeBtn()
  }

  function updateThemeBtn() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark'
    const btn = document.getElementById('themeBtn')
    if (btn) btn.textContent = isDark ? '☀️' : '🌙'
  }

  function applyZoom() {
    document.body.style.zoom = ZOOM_SIZES[_zoomIdx] / 16
    document.querySelectorAll('.size-btn').forEach((b, i) => b.classList.toggle('active', i === _zoomIdx))
    localStorage.setItem('zoom', _zoomIdx)
  }

  function setZoom(idx) {
    _zoomIdx = idx
    applyZoom()
  }

  // ─── LANGUAGE ────────────────────────────────────────────
  function applyLang() {
    state.updateDateLocales()
    document.querySelectorAll('[data-i18n]').forEach(el => {
      if (state.T[el.dataset.i18n]) el.textContent = state.T[el.dataset.i18n]
    })
    const taskTitleEl = document.getElementById('taskTitle')
    if (taskTitleEl) taskTitleEl.placeholder = state.T.taskPlaceholder
    const zoomGroup = document.querySelector('.zoom-group')
    if (zoomGroup) zoomGroup.title = state.T.zoomButtonTitle
    const sel = document.getElementById('langSelect')
    if (sel) sel.value = state.lang
    // Update delete modal texts
    const ids = ['deleteOneTitle','deleteOneDesc','deleteFutureTitle','deleteFutureDesc','deleteAllTitle','deleteAllDesc']
    const keys = ['deleteOneOccurrence','deleteOneDesc','deleteFutureOccurrences','deleteFutureDesc','deleteAllOccurrences','deleteAllDesc']
    ids.forEach((id, i) => {
      const el = document.getElementById(id)
      if (el && state.T[keys[i]]) el.textContent = state.T[keys[i]]
    })
  }

  function setLang(l) {
    state.setLang(l)
    applyLang()
    rerender()
  }

  // ─── NAVIGATION ──────────────────────────────────────────
  async function navigate(delta) {
    const d = new Date(state.navDate)
    if (state.view === 'day') d.setDate(d.getDate() + delta)
    if (state.view === 'week') d.setDate(d.getDate() + delta * 14)
    if (state.view === 'month') d.setMonth(d.getMonth() + delta)
    if (state.view === 'year') d.setFullYear(d.getFullYear() + delta)
    state.setNavDate(d)
    navDate.set(d)
    _pushHistory()
    await _animateViewChange(delta)
  }

  async function navigateMonth(delta) {
    const d = new Date(state.navDate)
    d.setMonth(d.getMonth() + delta)
    state.setNavDate(d)
    navDate.set(d)
    _pushHistory()
    await _animateViewChange(delta)
  }

  function todayNav() {
    const t = today()
    state.setNavDate(t)
    navDate.set(t)
    _pushHistory()
    rerender()
  }

  async function setView(v) {
    state.setView(v)
    view.set(v)
    if (v === 'day') {
      const t = today()
      state.setNavDate(t)
      navDate.set(t)
    }
    localStorage.setItem('view', v)
    _pushHistory()
    await _animateViewChange()
  }

  function _pushHistory() {
    const navStr = state.navDate.toISOString().slice(0, 10)
    history.pushState({ view: state.view, nav: navStr }, '')
  }

  async function _popHistory(e) {
    if (!e.state) return
    const { view: v, nav } = e.state
    const [y, m, d] = nav.split('-').map(Number)
    state.setNavDate(new Date(y, m - 1, d))
    state.setView(v)
    view.set(v)
    navDate.set(state.navDate)
    localStorage.setItem('view', v)
    await _animateViewChange()
  }

  async function _animateViewChange(delta = 0) {
    const main = document.getElementById('mainContent')
    if (!main || typeof gsap === 'undefined') { rerender(); return }

    // Skip animation if a drag is in progress
    if (document.querySelector('.dragging')) { rerender(); return }

    const isNavigation = delta !== 0  // temporal nav (← →)
    const slideX = isNavigation ? (delta > 0 ? 55 : -55) : 0

    // Slide only for day view (no overflow-x clip issues), pure fade for everything else
    const canSlide = isNavigation && state.view === 'day'

    // Phase 1: out
    await gsap.to(main, {
      opacity: 0,
      x: canSlide ? -slideX * 0.35 : 0,
      duration: canSlide ? 0.14 : 0.18,
      ease: 'power3.in',
      overwrite: true
    })

    rerender()
    window.scrollTo(0, 0)

    // Phase 2: in
    gsap.set(main, { x: canSlide ? slideX : 0, opacity: 0 })
    await gsap.to(main, {
      opacity: 1, x: 0,
      duration: canSlide ? 0.32 : 0.52,
      ease: 'expo.out',
      overwrite: true,
      clearProps: 'x'
    })

    setupTodoItemHoverAnimations()
  }

  async function setNavDateAndView(date, v) {
    if (typeof date === 'string') date = parseDS(date)
    state.setNavDate(date)
    state.setView(v)
    navDate.set(date)
    view.set(v)
    localStorage.setItem('view', v)
    _pushHistory()
    await _animateViewChange()
  }

  // ─── TODOS ───────────────────────────────────────────────
  function _refreshCategoryPanel() {
    const catId = getCurrentCategoryId()
    if (catId) renderCategoryPanel(catId)
  }

  function toggleTodo(id, d) {
    const wasCompleted = isCompleted(state.todos.find(x => x.id === id), d)
    snapshot(state.todos)
    calToggleTodo(id, d, state.todos)
    saveTodos(state.todos)
    todos.set(state.todos)
    if (!wasCompleted) celebrate(state.lang)
    rerender()
    _refreshCategoryPanel()
    setTimeout(() => {
      const check = document.querySelector(`[data-id="${id}"] .todo-check`)
      if (check && typeof gsap !== 'undefined') {
        gsap.timeline()
          .to(check, { scale: 1.35, duration: 0.12, ease: 'power2.out' })
          .to(check, { scale: 1, duration: 0.2, ease: 'elastic.out(1.2, 0.5)' })
      }
    }, 0)
  }

  function deleteTodo(id, dateStr) {
    const t = state.todos.find(x => x.id === id)
    if (!t) return
    if (!t.recurrence || t.recurrence === 'none') {
      _animateDeleteAndRefresh(id, () => {
        snapshot(state.todos)
        state.setTodos(state.todos.filter(x => x.id !== id))
        saveTodos(state.todos)
        todos.set(state.todos)
      })
    } else {
      openDeleteModal(id, dateStr, state.todos)
    }
  }

  function _animateDeleteAndRefresh(id, callback) {
    const item = document.querySelector(`[data-id="${id}"]`)
    if (item && typeof gsap !== 'undefined') {
      gsap.to(item, {
        opacity: 0, x: 24, height: 0, marginBottom: 0, paddingTop: 0, paddingBottom: 0,
        duration: 0.25, ease: 'power2.in',
        onComplete: () => { callback(); rerender(); _refreshCategoryPanel() }
      })
    } else {
      callback(); rerender(); _refreshCategoryPanel()
    }
  }

  function doDeleteOneOccurrence() {
    const { id } = state.pendingDelete
    _animateDeleteAndRefresh(id, () => {
      snapshot(state.todos)
      deleteOneOccurrence(id, state.pendingDelete.date, state.todos)
      closeDeleteModal()
      saveTodos(state.todos)
      todos.set(state.todos)
    })
  }

  function doDeleteFutureOccurrences() {
    const { id } = state.pendingDelete
    _animateDeleteAndRefresh(id, () => {
      snapshot(state.todos)
      const newTodos = deleteFutureOccurrences(id, state.pendingDelete.date, state.todos)
      state.setTodos(newTodos)
      closeDeleteModal()
      saveTodos(state.todos)
      todos.set(state.todos)
    })
  }

  function doDeleteAllOccurrences() {
    const { id } = state.pendingDelete
    _animateDeleteAndRefresh(id, () => {
      snapshot(state.todos)
      state.setTodos(state.todos.filter(x => x.id !== id))
      closeDeleteModal()
      saveTodos(state.todos)
      todos.set(state.todos)
    })
  }

  // ─── MODAL ───────────────────────────────────────────────
  function openModalFn(date) { openModal(date, state.todos) }
  function closeModalFn() { closeModal() }
  function openEditModalFn(id, dateStr) { openEditModal(id, dateStr, state.todos) }

  function saveTask() {
    const before = JSON.parse(JSON.stringify(state.todos))
    const hadError = saveTaskLogic(state.todos)
    if (!hadError) {
      if (state.insertAfterId && !state.editingId) {
        const newTask = state.todos[state.todos.length - 1]
        const refIdx = state.todos.findIndex(x => x.id === state.insertAfterId)
        if (refIdx !== -1) {
          state.todos.splice(state.todos.length - 1, 1)
          state.todos.splice(refIdx + 1, 0, newTask)
        }
        state.setInsertAfterId(null)
      }
      snapshot(before)
      saveTodos(state.todos)
      todos.set(state.todos)
      closeModal()
      rerender()
      _refreshCategoryPanel()
    }
  }

  function setTaskDateToday() {
    document.getElementById('taskDate').value = DS(today())
  }

  function setTaskDateTomorrow() {
    const d = today()
    d.setDate(d.getDate() + 1)
    document.getElementById('taskDate').value = DS(d)
  }

  function addTaskAfter(id, ds) {
    const t = state.todos.find(x => x.id === id)
    state.setInsertAfterId(id)
    openModal(parseDS(ds), state.todos)
    if (t?.projectId) {
      setTimeout(() => {
        const sel = document.getElementById('taskCategory')
        if (sel) sel.value = t.projectId
      }, 60)
    }
  }

  function duplicateTodo(id, ds) {
    const t = state.todos.find(x => x.id === id)
    if (!t) return
    snapshot(state.todos)
    const clone = { ...JSON.parse(JSON.stringify(t)), id: Date.now().toString(), completed: false, completedDates: [] }
    const idx = state.todos.findIndex(x => x.id === id)
    state.todos.splice(idx + 1, 0, clone)
    saveTodos(state.todos)
    todos.set(state.todos)
    rerender()
  }

  function clickTodo(e, id, ds) {
    if (e.target.closest('.todo-check, .todo-actions, .todo-drag-handle')) return
    if (e.target.closest('.todo-text')) return
    clearTimeout(_clickTimer)
    _clickTimer = setTimeout(() => {
      _clickTimer = null
      openEditModalFn(id, ds)
    }, 220)
  }

  function openModalWithTitle(title) {
    if (document.getElementById('modalOverlay').classList.contains('hidden')) {
      const d = state.quickAddTarget === 'today' ? today() : state.navDate
      openModal(d, state.todos)
    }
    document.getElementById('taskTitle').value = title
    document.getElementById('taskTitle').select()
  }

  function openModalWithRecurring(id) {
    const t = state.todos.find(x => x.id === id)
    if (!t) return
    if (document.getElementById('modalOverlay').classList.contains('hidden')) {
      const d = state.quickAddTarget === 'today' ? today() : state.navDate
      openModal(d, state.todos)
    }
    document.getElementById('taskTitle').value = t.title
    selectRecurrence(t.recurrence || 'none')
    if (t.recurrence === 'weekly' && t.recDays) {
      state.setSelectedWeekDays([...t.recDays])
      document.querySelectorAll('#weekDayBoxes .day-checkbox').forEach(el => {
        el.classList.toggle('selected', state.selectedWeekDays.includes(+el.dataset.day))
      })
    }
  }

  function getSuggestion(index) { return state._sugg[index] }

  // ─── DRAG & DROP ─────────────────────────────────────────
  function dropReorder(draggedId, group, targetId, before) {
    if (draggedId === targetId) return
    const dateStr = DS(state.navDate)
    if (group === 'punctual') {
      const items = getTodosForDate(state.navDate, state.todos).filter(t => !t.recurrence || t.recurrence === 'none')
      let order = dayOrder[dateStr] ? [...dayOrder[dateStr]] : items.map(t => t.id)
      items.forEach(t => { if (!order.includes(t.id)) order.push(t.id) })
      order = order.filter(id => items.some(t => t.id === id))
      const newOrder = order.filter(id => id !== draggedId)
      const idx = newOrder.indexOf(targetId)
      if (idx < 0) return
      newOrder.splice(before ? idx : idx + 1, 0, draggedId)
      dayOrder[dateStr] = newOrder
      localStorage.setItem('dayOrder', JSON.stringify(dayOrder))
    } else {
      const items = getTodosForDate(state.navDate, state.todos).filter(t => t.recurrence === group)
      if (!recurringOrder[dateStr]) recurringOrder[dateStr] = {}
      let order = recurringOrder[dateStr][group] ? [...recurringOrder[dateStr][group]] : items.map(t => t.id)
      items.forEach(t => { if (!order.includes(t.id)) order.push(t.id) })
      order = order.filter(id => items.some(t => t.id === id))
      const newOrder = order.filter(id => id !== draggedId)
      const idx = newOrder.indexOf(targetId)
      if (idx < 0) return
      newOrder.splice(before ? idx : idx + 1, 0, draggedId)
      recurringOrder[dateStr][group] = newOrder
      Object.keys(recurringOrder)
        .filter(d => d > dateStr && recurringOrder[d][group])
        .forEach(d => {
          const existing = recurringOrder[d][group]
          const sorted = existing.filter(id => newOrder.includes(id))
          sorted.sort((a, b) => newOrder.indexOf(a) - newOrder.indexOf(b))
          let si = 0
          recurringOrder[d][group] = existing.map(id => newOrder.includes(id) ? sorted[si++] : id)
        })
      localStorage.setItem('recurringOrder', JSON.stringify(recurringOrder))
    }
    rerender()
  }

  function moveTodoToDate(todoId, newDateStr) {
    const t = state.todos.find(t => t.id === todoId)
    if (!t || (t.recurrence && t.recurrence !== 'none')) return
    if (t.date === newDateStr) return
    snapshot(state.todos)
    t.date = newDateStr
    saveTodos(state.todos)
    todos.set(state.todos)
    rerender()
  }

  function initWeekDragDrop() {
    const grid = document.querySelector('.week-grid')
    if (!grid) return
    let draggedId = null, draggedDate = null
    grid.addEventListener('dragstart', e => {
      const item = e.target.closest('.week-todo-item[draggable]')
      if (!item) return
      draggedId = item.dataset.id; draggedDate = item.dataset.date
      e.dataTransfer.effectAllowed = 'move'
      e.dataTransfer.setData('text/plain', draggedId)
      requestAnimationFrame(() => item.classList.add('dragging'))
    })
    grid.addEventListener('dragend', e => {
      const item = e.target.closest('.week-todo-item')
      if (item) item.classList.remove('dragging')
      draggedId = null; draggedDate = null
      grid.querySelectorAll('.week-day-todos.drag-over').forEach(el => el.classList.remove('drag-over'))
    })
    grid.addEventListener('dragover', e => {
      e.preventDefault()
      if (!draggedId) return
      const col = e.target.closest('.week-day-todos')
      if (!col) return
      grid.querySelectorAll('.week-day-todos.drag-over').forEach(el => el.classList.remove('drag-over'))
      if (col.dataset.date !== draggedDate) col.classList.add('drag-over')
    })
    grid.addEventListener('drop', e => {
      e.preventDefault()
      const col = e.target.closest('.week-day-todos')
      if (!col || !draggedId) return
      const newDate = col.dataset.date
      col.classList.remove('drag-over')
      if (newDate && newDate !== draggedDate) moveTodoToDate(draggedId, newDate)
    })
  }

  function initMonthDragDrop() {
    const grid = document.querySelector('.month-grid')
    if (!grid) return
    let draggedId = null, draggedDate = null
    grid.addEventListener('dragstart', e => {
      const item = e.target.closest('.month-todo-dot[draggable]')
      if (!item) return
      draggedId = item.dataset.id; draggedDate = item.dataset.date
      e.dataTransfer.effectAllowed = 'move'
      e.dataTransfer.setData('text/plain', draggedId)
      requestAnimationFrame(() => item.classList.add('dragging'))
    })
    grid.addEventListener('dragend', e => {
      const item = e.target.closest('.month-todo-dot')
      if (item) item.classList.remove('dragging')
      draggedId = null; draggedDate = null
      grid.querySelectorAll('.month-cell.drag-over').forEach(el => el.classList.remove('drag-over'))
    })
    grid.addEventListener('dragover', e => {
      e.preventDefault()
      if (!draggedId) return
      const cell = e.target.closest('.month-cell[data-date]')
      if (!cell) return
      grid.querySelectorAll('.month-cell.drag-over').forEach(el => el.classList.remove('drag-over'))
      if (cell.dataset.date !== draggedDate) cell.classList.add('drag-over')
    })
    grid.addEventListener('drop', e => {
      e.preventDefault()
      const cell = e.target.closest('.month-cell[data-date]')
      if (!cell || !draggedId) return
      const newDate = cell.dataset.date
      cell.classList.remove('drag-over')
      if (newDate && newDate !== draggedDate) moveTodoToDate(draggedId, newDate)
    })
  }

  function initDayDragDrop() {
    const container = document.querySelector('.day-columns')
    if (!container) return
    let draggedEl = null, draggedGroup = null, dropTarget = null, dropBefore = false
    const indicator = document.createElement('div')
    indicator.className = 'drop-indicator'
    container.addEventListener('dragstart', e => {
      const item = e.target.closest('.todo-item[draggable]')
      if (!item) return
      draggedEl = item; draggedGroup = item.dataset.group
      e.dataTransfer.effectAllowed = 'move'
      e.dataTransfer.setData('text/plain', item.dataset.id)
      requestAnimationFrame(() => item.classList.add('dragging'))
    })
    container.addEventListener('dragend', () => {
      if (draggedEl) draggedEl.classList.remove('dragging')
      indicator.remove()
      draggedEl = null; draggedGroup = null; dropTarget = null
    })
    container.addEventListener('dragover', e => {
      e.preventDefault()
      if (!draggedEl) return
      const target = e.target.closest('.todo-item[draggable]')
      if (!target || target === draggedEl || target.dataset.group !== draggedGroup) return
      const rect = target.getBoundingClientRect()
      dropBefore = e.clientY < rect.top + rect.height / 2
      dropTarget = target.dataset.id
      if (dropBefore) target.parentNode.insertBefore(indicator, target)
      else target.parentNode.insertBefore(indicator, target.nextSibling)
    })
    container.addEventListener('drop', e => {
      e.preventDefault()
      indicator.remove()
      if (draggedEl && dropTarget) dropReorder(draggedEl.dataset.id, draggedGroup, dropTarget, dropBefore)
    })
  }

  // ─── QUICK EDIT ──────────────────────────────────────────
  function quickEditTitle(element, id, dateStr) {
    const currentText = element.textContent
    const input = document.createElement('input')
    input.type = 'text'; input.className = 'todo-text-input'
    input.value = currentText; input.style.width = element.offsetWidth + 'px'
    element.replaceWith(input); input.focus(); input.select()
    const saveEdit = () => {
      const newTitle = input.value.trim()
      if (newTitle && newTitle !== currentText) {
        const t = state.todos.find(t => t.id === id)
        if (t) { snapshot(state.todos); t.title = newTitle; saveTodos(state.todos); todos.set(state.todos) }
      }
      const span = document.createElement('span')
      span.className = 'todo-text editable'
      span.textContent = newTitle || currentText
      span.ondblclick = () => quickEditTitle(span, id, dateStr)
      input.replaceWith(span)
      rerender()
    }
    input.addEventListener('blur', saveEdit)
    input.addEventListener('keypress', e => {
      if (e.key === 'Enter') saveEdit()
      if (e.key === 'Escape') {
        const span = document.createElement('span')
        span.className = 'todo-text editable'; span.textContent = currentText
        span.ondblclick = () => quickEditTitle(span, id, dateStr)
        input.replaceWith(span)
      }
    })
  }

  // ─── CLEAR DAY ───────────────────────────────────────────
  function clearDay() {
    const dateStr = DS(state.navDate)
    const dayTodos = state.todos.filter(t => (!t.recurrence || t.recurrence === 'none') && t.date === dateStr)
    if (dayTodos.length === 0) return
    if (!confirm(`Supprimer les ${dayTodos.length} tâche(s) de cette journée ?`)) return
    snapshot(state.todos)
    state.setTodos(state.todos.filter(t => !(!t.recurrence || t.recurrence === 'none') || t.date !== dateStr))
    saveTodos(state.todos); todos.set(state.todos)
    rerender()
  }

  // ─── ADMIN ───────────────────────────────────────────────
  function hmOpenAdmin(section) {
    closeHamburger()
    openAdminModal()
    setTimeout(() => showAdminSection(section), 50)
  }

  function openAdminSection(section) {
    openAdminModal()
    setTimeout(() => showAdminSection(section), 50)
  }

  function clearAllCalendarDataFn() {
    clearAllCalendarData()
    rerender()
  }

  function applyTemplateFn(templateId, dateStr) {
    applyTemplate(templateId, dateStr, state.todos)
    saveTodos(state.todos); todos.set(state.todos)
    rerender()
  }

  function openTemplateModalFn(dateStr) { openTemplateModal(dateStr || DS(state.navDate)) }

  // ─── CATEGORIES ──────────────────────────────────────────
  function addCategoryFromView() {
    const name = prompt('Nom de la catégorie :')
    if (!name || !name.trim()) return
    const colors = ['#f59e0b','#3b82f6','#10b981','#ef4444','#8b5cf6','#f97316','#06b6d4','#ec4899']
    const categories = getCategories()
    categories.push({ id: Date.now().toString(), name: name.trim(), color: colors[categories.length % colors.length] })
    saveCategories(categories)
    rerender()
  }

  function removeCategoryFn(id) {
    snapshot(state.todos)
    state.todos.forEach(t => { if (t.projectId === id) delete t.projectId })
    saveTodos(state.todos); todos.set(state.todos)
    removeCategory(id)
    rerender()
  }

  function setCategoryColor(categoryId, color) {
    const categories = getCategories()
    const cat = categories.find(p => p.id === categoryId)
    if (cat) { cat.color = color; saveCategories(categories) }
    renderCategoryPanel(categoryId)
    rerender()
  }

  function saveCategoryName(categoryId, name) {
    if (!name.trim()) return
    const categories = getCategories()
    const cat = categories.find(p => p.id === categoryId)
    if (cat && cat.name !== name.trim()) { cat.name = name.trim(); saveCategories(categories) }
    renderCategoryPanel(categoryId)
    rerender()
  }

  function setCategoriesCols(n) { localStorage.setItem('categoriesCols', n); rerender() }
  function setCategoriesSort(s) { localStorage.setItem('categoriesSort', s); rerender() }

  function deleteCategory(id) {
    if (!confirm('Supprimer cette catégorie ? Les tâches seront dissociées mais conservées.')) return
    closeCategoryView()
    removeCategoryFn(id)
  }

  function reorderCategoryTask(id, categoryId, direction) {
    const tasks = state.todos.filter(t => t.projectId === categoryId)
    let order = getCategoryTaskOrder(categoryId)
    tasks.forEach(t => { if (!order.includes(t.id)) order.push(t.id) })
    order = order.filter(oid => tasks.some(t => t.id === oid))
    const idx = order.indexOf(id)
    if (idx < 0) return
    const newIdx = idx + parseInt(direction)
    if (newIdx < 0 || newIdx >= order.length) return
    ;[order[idx], order[newIdx]] = [order[newIdx], order[idx]]
    saveCategoryTaskOrder(categoryId, order)
    renderCategoryPanel(categoryId)
  }

  function openModalForCategory(categoryId) {
    closeCategoryView({ immediate: true })
    openModal(state.navDate, state.todos)
    setTimeout(() => {
      const sel = document.getElementById('taskCategory')
      if (sel) sel.value = categoryId
    }, 60)
  }

  function unlinkFromCategory(id) {
    snapshot(state.todos)
    const t = state.todos.find(x => x.id === id)
    if (t) { delete t.projectId; saveTodos(state.todos); todos.set(state.todos) }
    _refreshCategoryPanel()
    rerender()
  }

  // ─── UNDO ────────────────────────────────────────────────
  function undoAction() {
    const prev = undo()
    if (!prev) return
    state.setTodos(prev); saveTodos(prev); todos.set(prev)
    rerender()
    _showUndoToast()
  }

  function _showUndoToast() {
    let toast = document.getElementById('undoToast')
    if (!toast) {
      toast = document.createElement('div')
      toast.id = 'undoToast'; toast.className = 'undo-toast'
      document.body.appendChild(toast)
    }
    toast.textContent = '↩ Annulé'
    toast.classList.remove('undo-toast--visible')
    void toast.offsetWidth
    toast.classList.add('undo-toast--visible')
  }

  // ─── DATA EXPORT/IMPORT ──────────────────────────────────
  async function handleImportFile(e) {
    const file = e.target.files[0]
    if (!file) return
    try {
      const data = await importData(file)
      snapshot(state.todos)
      if (data.calendar) state.setTodos(data.calendar)
      if (data.config) {
        if (data.config.theme) localStorage.setItem('theme', data.config.theme)
        if (data.config.zoom) localStorage.setItem('zoom', data.config.zoom)
        if (data.config.lang) localStorage.setItem('lang', data.config.lang)
        initTheme(); applyLang()
        _zoomIdx = parseInt(localStorage.getItem('zoom') ?? '1')
        applyZoom()
      }
      if (data.categories) localStorage.setItem('projects', JSON.stringify(data.categories))
      if (data.templates) localStorage.setItem('dayTemplates', JSON.stringify(data.templates))
      if (data.suggestedTasks) localStorage.setItem('suggestedTasks', JSON.stringify(data.suggestedTasks))
      if (data.taskOrder) localStorage.setItem('projectTaskOrder', JSON.stringify(data.taskOrder))
      saveTodos(state.todos); todos.set(state.todos)
      closeAdminModal(); rerender()
      alert(state.T.importSuccess || 'Données importées avec succès !')
    } catch (err) {
      alert(state.T.importError || 'Failed to import data')
    }
    e.target.value = ''
  }

  // ─── HAMBURGER ───────────────────────────────────────────
  function toggleHamburger() { _hamburgerOpen ? closeHamburger() : openHamburger() }

  function openHamburger() {
    _hamburgerOpen = true
    const btn = document.getElementById('hamburgerBtn')
    const menu = document.getElementById('hamburgerMenu')
    const overlay = document.getElementById('hamburgerOverlay')
    if (btn) btn.classList.add('open')
    if (overlay) overlay.classList.add('open')
    if (menu && typeof gsap !== 'undefined') {
      gsap.to(menu, { x: 0, duration: 0.36, ease: 'expo.out' })
      gsap.fromTo(menu.querySelectorAll('.hm-item'),
        { x: 20, opacity: 0 },
        { x: 0, opacity: 1, duration: 0.28, stagger: 0.06, ease: 'power3.out', delay: 0.1 }
      )
    }
  }

  function closeHamburger() {
    if (!_hamburgerOpen) return
    _hamburgerOpen = false
    const btn = document.getElementById('hamburgerBtn')
    const menu = document.getElementById('hamburgerMenu')
    const overlay = document.getElementById('hamburgerOverlay')
    if (btn) btn.classList.remove('open')
    if (overlay) overlay.classList.remove('open')
    if (menu && typeof gsap !== 'undefined') {
      gsap.to(menu, { x: '100%', duration: 0.28, ease: 'power3.in' })
    }
  }

  // ─── CHAT ────────────────────────────────────────────────
  function openChat() {
    const panel = document.getElementById('chatInboxPanel')
    const overlay = document.getElementById('chatInboxOverlay')
    if (panel) panel.classList.add('open')
    if (overlay) overlay.classList.add('open')
    markAllMessagesRead?.()
    const badge = document.getElementById('chatBadge')
    if (badge) { badge.textContent = '0'; badge.classList.add('hidden') }
  }

  function closeChat() {
    const panel = document.getElementById('chatInboxPanel')
    const overlay = document.getElementById('chatInboxOverlay')
    if (panel) panel.classList.remove('open')
    if (overlay) overlay.classList.remove('open')
  }

  function sendChatMessage() {
    const input = document.getElementById('chatReplyInput')
    if (!input) return
    const text = input.value.trim()
    if (!text) return
    sendUserMessage?.(text)
    input.value = ''
    input.style.height = ''
  }

  function _updateChatWidget(msgs) {
    messages.set(msgs || [])
    const unread = (msgs || []).filter(m => m.role === 'admin' && !m.read).length
    const badge = document.getElementById('chatBadge')
    if (badge) {
      badge.textContent = unread
      badge.classList.toggle('hidden', unread === 0)
    }
    const list = document.getElementById('chatInboxList')
    if (!list) return
    if (!msgs || msgs.length === 0) {
      list.innerHTML = '<p class="chat-empty-msg">Aucun message pour l\'instant.</p>'
      return
    }
    list.innerHTML = msgs.map(m => `
      <div class="chat-msg chat-msg--${m.role}">
        <div class="chat-msg__text">${esc(m.text)}</div>
      </div>
    `).join('')
    list.scrollTop = list.scrollHeight
  }

  // ─── USER / AUTH ─────────────────────────────────────────
  function openUserArea() {
    if (isGuest?.()) {
      const panel = document.getElementById('authModalOverlay')
      if (panel) panel.classList.remove('hidden')
    } else {
      setView('profile')
    }
  }

  function closeAuthModal() {
    const panel = document.getElementById('authModalOverlay')
    if (panel) panel.classList.add('hidden')
  }

  function showAuthLogin() {
    const formPanel = document.getElementById('authPanelForm')
    const userPanel = document.getElementById('authPanelUser')
    if (formPanel) formPanel.classList.remove('hidden')
    if (userPanel) userPanel.classList.add('hidden')
    const title = document.getElementById('authFormTitle')
    if (title) title.textContent = 'Se connecter'
    const submitBtn = document.getElementById('authSubmitBtn')
    if (submitBtn) submitBtn.textContent = 'Se connecter'
  }

  function showAuthRegister() {
    const formPanel = document.getElementById('authPanelForm')
    const userPanel = document.getElementById('authPanelUser')
    if (formPanel) formPanel.classList.remove('hidden')
    if (userPanel) userPanel.classList.add('hidden')
    const title = document.getElementById('authFormTitle')
    if (title) title.textContent = 'Créer un compte'
    const submitBtn = document.getElementById('authSubmitBtn')
    if (submitBtn) submitBtn.textContent = 'Créer mon compte'
  }

  function authToggleMode() {
    const title = document.getElementById('authFormTitle')
    const isLogin = title?.textContent === 'Se connecter'
    if (isLogin) showAuthRegister()
    else showAuthLogin()
  }

  async function authSubmit() {
    const email = document.getElementById('authEmail')?.value?.trim()
    const password = document.getElementById('authPassword')?.value
    const errorEl = document.getElementById('authError')
    const title = document.getElementById('authFormTitle')
    const isRegister = title?.textContent === 'Créer un compte'
    try {
      if (errorEl) errorEl.classList.add('hidden')
      if (isRegister) await registerWithEmail(email, password)
      else await signInWithEmail(email, password)
      closeAuthModal()
      _updateUserBtn()
    } catch (err) {
      if (errorEl) { errorEl.textContent = err.message; errorEl.classList.remove('hidden') }
    }
  }

  async function authGoogleSignIn() {
    try { await signInWithGoogle(); closeAuthModal(); _updateUserBtn() }
    catch (err) { console.error('Google sign in failed:', err) }
  }

  async function authFacebookSignIn() {
    try { await signInWithFacebook(); closeAuthModal(); _updateUserBtn() }
    catch (err) { console.error('Facebook sign in failed:', err) }
  }

  async function authSignOut() {
    await signOut()
    closeAuthModal()
    _updateUserBtn()
  }

  async function authContinueAsGuest() {
    await signInGuest()
    closeAuthModal()
    _updateUserBtn()
  }

  // Upgrade prompt methods
  async function upgradeGoogleSignIn() {
    try { await signInWithGoogle(); closeUpgradePrompt(); _updateUserBtn() }
    catch (err) { console.error('Google sign in failed:', err) }
  }
  async function upgradeFacebookSignIn() {
    try { await signInWithFacebook(); closeUpgradePrompt(); _updateUserBtn() }
    catch (err) { console.error('Facebook sign in failed:', err) }
  }
  function closeUpgradePrompt() {
    const el = document.getElementById('upgradePromptOverlay')
    if (el) el.classList.add('hidden')
  }
  async function upgradeSubmit() {
    const email = document.getElementById('upgradeEmail')?.value?.trim()
    const password = document.getElementById('upgradePassword')?.value
    const errorEl = document.getElementById('upgradeError')
    try {
      if (errorEl) errorEl.classList.add('hidden')
      await upgradeGuestToEmail(email, password)
      closeUpgradePrompt(); _updateUserBtn()
    } catch (err) {
      if (errorEl) { errorEl.textContent = err.message; errorEl.classList.remove('hidden') }
    }
  }
  function upgradeDismiss() { closeUpgradePrompt() }
  function leaveKeepData() {
    const el = document.getElementById('leavePromptOverlay')
    if (el) el.classList.add('hidden')
  }
  function leaveDeleteData() {
    if (!confirm('Effacer toutes tes données ?')) return
    Object.keys(localStorage).filter(k => !k.startsWith('firebase:')).forEach(k => localStorage.removeItem(k))
    location.reload()
  }
  function closeLeavePrompt() {
    const el = document.getElementById('leavePromptOverlay')
    if (el) el.classList.add('hidden')
  }

  // Avatar
  async function saveAvatarFn() {
    await saveAvatar()
    localStorage.setItem('_localWriteTime', Date.now().toString())
    _updateUserBtn()
    try { pushToFirestore(getFullBackup(state.todos)) } catch {}
  }

  // Guest name prompt
  async function _promptGuestName() {
    const overlay = document.getElementById('guestNameOverlay')
    if (overlay) overlay.classList.remove('hidden')
  }

  function openAvatarFromPrompt() {
    const overlay = document.getElementById('guestNameOverlay')
    if (overlay) overlay.classList.add('hidden')
    openAvatarEditor()
  }

  function skipGuestName() {
    localStorage.setItem('guestNameSkipped', '1')
    const overlay = document.getElementById('guestNameOverlay')
    if (overlay) overlay.classList.add('hidden')
  }

  async function saveGuestName() {
    const name = document.getElementById('guestNameInput')?.value?.trim()
    const email = document.getElementById('guestEmailInput')?.value?.trim()
    if (name) {
      await updateUserProfile(name)
      updatePresenceName?.(name)
    }
    if (email) {
      showAuthRegister()
      const authEmailEl = document.getElementById('authEmail')
      if (authEmailEl) authEmailEl.value = email
      localStorage.setItem('guestNameSkipped', '1')
      const overlay = document.getElementById('guestNameOverlay')
      if (overlay) overlay.classList.add('hidden')
      openUserArea()
    } else {
      skipGuestName()
    }
    _updateUserBtn()
  }

  function _animateLogoText(text) {
    const el = document.getElementById('logoText')
    if (!el || el.dataset.text === text) return
    el.dataset.text = text
    el.style.opacity = '1'
    const commaIdx = text.indexOf(', ')
    const brandDelays = [80, 128, 143, 188, 203, 218]
    if (commaIdx > 0) {
      const brand = text.slice(0, commaIdx)
      const username = text.slice(commaIdx + 2).toUpperCase()
      const variant = ['r', 'b', 's'][Math.random() * 3 | 0]
      const nameDelay = 295
      let html = ''
      ;[...brand].forEach((ch, i) =>
        html += `<span class="ninja-char" style="--delay:${brandDelays[i]}ms">${esc(ch)}</span>`
      )
      html += `<span class="ninja-char" style="--delay:248ms">,</span>`
      html += `<span class="ninja-char" style="--delay:250ms">\u00A0</span>`
      ;[...username].forEach(ch =>
        html += `<span class="ninja-username-${variant}" style="--delay:${nameDelay}ms">${esc(ch)}</span>`
      )
      html += `<span class="ninja-char" style="--delay:${nameDelay}ms">?</span>`
      el.innerHTML = html
    } else {
      el.innerHTML = [...text].map((ch, i) =>
        `<span class="ninja-char" style="--delay:${brandDelays[i] ?? i * 30}ms">${esc(ch)}</span>`
      ).join('')
    }
  }

  function _updateUserBtn() {
    const user = getCurrentUser?.()
    currentUser.set(user)
    const btn = document.getElementById('userBtn')
    const logoAvatar = document.getElementById('logoAvatar')
    if (!btn && !logoAvatar) return
    const guest = !!user?.isAnonymous
    const uname = user ? (user.displayName || (!guest ? user.email?.split('@')[0] : '') || '') : ''
    const fullTitle = uname ? `2FŨKOI, ${uname}` : '2FŨKOI'
    document.title = fullTitle
    _animateLogoText(fullTitle)
    if (btn) {
      btn.classList.toggle('authenticated', !!user && !guest)
      btn.title = guest ? 'Invité — cliquer pour créer un compte' : (user?.email || 'Mon compte')
    }
    let avatarData = null
    try { avatarData = JSON.parse(localStorage.getItem('profileAvatar')) } catch {}
    const defaultLogoSVG = `<svg class="logo-mark" width="26" height="26" viewBox="0 0 26 26" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="26" height="26" rx="7" fill="var(--primary)"/><path d="M7 13.5L11 17.5L19 9" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`
    const defaultBtnSVG = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>`
    if (avatarData?.type === 'emoji' && avatarData.value) {
      if (logoAvatar) { logoAvatar.classList.add('logo-avatar--has-avatar'); logoAvatar.innerHTML = `<span class="logo-avatar-emoji">${avatarData.value}</span>` }
      if (btn) { btn.classList.add('user-btn--has-avatar'); btn.innerHTML = `<span class="user-btn-emoji">${avatarData.value}</span>` }
    } else if (avatarData?.type === 'photo' && avatarData.data) {
      const f = FILTERS?.find(f => f.id === avatarData.filter)
      const styleAttr = (f?.css && !f.canvas) ? ` style="filter:${f.css}"` : ''
      if (logoAvatar) { logoAvatar.classList.add('logo-avatar--has-avatar'); logoAvatar.innerHTML = `<img src="${avatarData.data}" class="logo-avatar-photo"${styleAttr}>` }
      if (btn) { btn.classList.add('user-btn--has-avatar'); btn.innerHTML = `<img src="${avatarData.data}" class="user-btn-photo"${styleAttr}>` }
    } else {
      if (logoAvatar) { logoAvatar.classList.remove('logo-avatar--has-avatar'); logoAvatar.innerHTML = defaultLogoSVG }
      if (btn) { btn.classList.remove('user-btn--has-avatar'); btn.innerHTML = defaultBtnSVG }
    }
    if (logoAvatar && !logoAvatar.dataset.animated) {
      logoAvatar.dataset.animated = '1'
      requestAnimationFrame(() => requestAnimationFrame(() => {
        logoAvatar.classList.add('logo-avatar--entering')
      }))
    }
    // Update auth panel user info
    const authUserName = document.getElementById('authUserName')
    const authUserSub = document.getElementById('authUserSub')
    const authAvatar = document.getElementById('authAvatar')
    const authUpgradeSection = document.getElementById('authUpgradeSection')
    const authPanelUser = document.getElementById('authPanelUser')
    const authPanelForm = document.getElementById('authPanelForm')
    if (user) {
      if (authPanelUser) authPanelUser.classList.remove('hidden')
      if (authPanelForm) authPanelForm.classList.add('hidden')
      if (authUserName) authUserName.textContent = user.displayName || user.email?.split('@')[0] || 'Invité'
      if (authUserSub) authUserSub.textContent = user.isAnonymous ? 'Session temporaire' : (user.email || '')
      if (authAvatar) {
        const initials = (user.displayName || user.email || '?').slice(0, 2).toUpperCase()
        authAvatar.innerHTML = getAvatarHTML?.(initials) || '👤'
      }
      if (authUpgradeSection) authUpgradeSection.classList.toggle('hidden', !user.isAnonymous)
    }
  }

  async function saveDisplayName() {
    const input = document.getElementById('profileDisplayName')
    const name = input?.value?.trim()
    if (!name) return
    await updateUserProfile(name)
    updatePresenceName?.(name)
    _updateUserBtn()
    const msg = document.getElementById('profileSaveMsg')
    if (msg) { msg.classList.remove('hidden'); setTimeout(() => msg.classList.add('hidden'), 2000) }
  }

  async function profileDeleteData() {
    if (!confirm('Effacer toutes tes données ? Cette action est irréversible.')) return
    await deleteUserFirestoreDoc?.()
    Object.keys(localStorage).filter(k => !k.startsWith('firebase:')).forEach(k => localStorage.removeItem(k))
    await signOut()
    location.reload()
  }

  // ─── FIREBASE INIT ───────────────────────────────────────
  async function _syncServer() {
    try {
      const backup = await loadFromServer()
      if (!backup) return
      const localHasData = state.todos.length > 0
      if (localHasData) { await saveBackupToServer(getFullBackup(state.todos)); return }
      if (!backup.calendar || backup.calendar.length === 0) return
      state.setTodos(backup.calendar)
      if (backup.categories) localStorage.setItem('projects', JSON.stringify(backup.categories))
      if (backup.templates) localStorage.setItem('dayTemplates', JSON.stringify(backup.templates))
      if (backup.suggestedTasks) localStorage.setItem('suggestedTasks', JSON.stringify(backup.suggestedTasks))
      if (backup.taskOrder) localStorage.setItem('projectTaskOrder', JSON.stringify(backup.taskOrder))
      if (backup.config) {
        if (backup.config.theme) localStorage.setItem('theme', backup.config.theme)
        if (backup.config.zoom) localStorage.setItem('zoom', backup.config.zoom)
        if (backup.config.lang) localStorage.setItem('lang', backup.config.lang)
      }
      localStorage.setItem('todos', JSON.stringify(backup.calendar))
      todos.set(state.todos); rerender()
    } catch {}
  }

  async function _applyBackup(backup, { silent = false } = {}) {
    if (!backup) return
    const localTime = parseInt(localStorage.getItem('_localWriteTime') || '0')
    const remoteTime = backup.updatedAt?.toMillis?.() || 0
    if (remoteTime <= localTime) return
    if (backup.calendar) { state.setTodos(backup.calendar); todos.set(backup.calendar) }
    if (backup.categories) localStorage.setItem('projects', JSON.stringify(backup.categories))
    if (backup.templates) localStorage.setItem('dayTemplates', JSON.stringify(backup.templates))
    if (backup.suggestedTasks) localStorage.setItem('suggestedTasks', JSON.stringify(backup.suggestedTasks))
    if (backup.taskOrder) localStorage.setItem('projectTaskOrder', JSON.stringify(backup.taskOrder))
    saveTodos(state.todos)
    if (!silent) rerender()
  }

  async function _syncFirebase() {
    try {
      const backup = await loadFromFirestore?.()
      if (backup) await _applyBackup(backup, { silent: true })
      rerender()
    } catch {}
  }

  async function _initFirebase() {
    try {
      const user = await initAuth()
      if (!user) {
        const guest = await signInGuest()
        if (guest?.isAnonymous && !guest.displayName && !localStorage.getItem('guestNameSkipped')) {
          await _promptGuestName()
        }
      }
      await _syncFirebase()
      if (_firestoreUnsub) _firestoreUnsub()
      _firestoreUnsub = subscribeToFirestore?.(backup => _applyBackup(backup, { silent: false }))
      onUserChange(user => {
        _updateUserBtn()
        if (user) initPresence?.(user, { onMessagesUpdate: msgs => _updateChatWidget(msgs) })
        else destroyPresence?.()
      })
      _updateUserBtn()
    } catch (err) {
      console.warn('Firebase init failed (expected in dev):', err.message)
    }
  }

  // ─── ANIMATE QUICK ADD BTN ───────────────────────────────
  function _animateQuickAddBtn() {
    const btn = document.getElementById('quickAddBtn')
    if (!btn || typeof gsap === 'undefined') return
    const label = btn.querySelector('.qab-label')
    const tBtn = document.getElementById('templateDayBtn')
    const cBtn = document.getElementById('clearDayBtn')
    const isMobile = window.innerWidth <= 600

    if (state.view === 'day') {
      if (isMobile) {
        if (!_quickAddInDayMode) {
          _quickAddInDayMode = true
          gsap.set(btn, { right: 'auto', left: 16, bottom: -80, xPercent: 0 })
          if (tBtn) gsap.set(tBtn, { left: 'auto', right: 16, bottom: -80, xPercent: 0, opacity: 0 })
          if (cBtn) gsap.set(cBtn, { left: 'auto', right: 82, bottom: -80, xPercent: 0, opacity: 0 })
        }
        gsap.to(btn, { bottom: 16, duration: 0.28, ease: 'expo.out', overwrite: 'auto' })
        if (tBtn) { gsap.to(tBtn, { bottom: 16, opacity: 1, duration: 0.28, delay: 0.06, ease: 'expo.out', overwrite: 'auto' }); setTimeout(() => { if (tBtn) tBtn.style.pointerEvents = 'auto' }, 340) }
        if (cBtn) { gsap.to(cBtn, { bottom: 16, opacity: 1, duration: 0.28, delay: 0.12, ease: 'expo.out', overwrite: 'auto' }); setTimeout(() => { if (cBtn) cBtn.style.pointerEvents = 'auto' }, 400) }
        return
      }
      const main = document.getElementById('mainContent')
      if (!main) return
      const rect = main.getBoundingClientRect()
      const gsapX = gsap.getProperty(main, 'x') || 0
      const tBtnW = tBtn ? tBtn.offsetWidth : 0
      const cBtnW = cBtn ? cBtn.offsetWidth : 0
      const anchorX = rect.left - gsapX + 32 + 110
      const tBtnLeft = anchorX + 110 + 12 + tBtnW / 2
      const cBtnLeft = anchorX + 110 + 12 + tBtnW + 12 + cBtnW / 2
      if (!_quickAddInDayMode) {
        _quickAddInDayMode = true
        gsap.set(btn, { right: 'auto', left: window.innerWidth - 52, xPercent: -50 })
        if (tBtn) gsap.set(tBtn, { xPercent: -50, left: tBtnLeft, opacity: 0 })
        if (cBtn) gsap.set(cBtn, { xPercent: -50, left: cBtnLeft, opacity: 0 })
      }
      gsap.to(btn, { left: anchorX, bottom: 32, duration: 0.32, ease: 'expo.out', overwrite: 'auto' })
      gsap.to(btn, { width: 220, duration: 0.22, delay: 0.1, ease: 'expo.out', overwrite: false })
      if (label) gsap.to(label, { width: 160, opacity: 1, duration: 0.18, delay: 0.22, ease: 'power2.out', overwrite: 'auto' })
      setTimeout(() => btn.classList.add('pill'), 320)
      if (tBtn) { gsap.to(tBtn, { left: tBtnLeft, bottom: 32, opacity: 1, duration: 0.28, delay: 0.2, ease: 'expo.out', overwrite: 'auto' }); setTimeout(() => { if (tBtn) tBtn.style.pointerEvents = 'auto' }, 480) }
      if (cBtn) { gsap.to(cBtn, { left: cBtnLeft, bottom: 32, opacity: 1, duration: 0.28, delay: 0.2, ease: 'expo.out', overwrite: 'auto' }); setTimeout(() => { if (cBtn) cBtn.style.pointerEvents = 'auto' }, 480) }
    } else {
      if (!_quickAddInDayMode) return
      _quickAddInDayMode = false
      btn.classList.remove('pill')
      if (tBtn) { tBtn.style.pointerEvents = 'none'; gsap.to(tBtn, { opacity: 0, duration: 0.15, ease: 'power2.in', overwrite: 'auto' }) }
      if (cBtn) { cBtn.style.pointerEvents = 'none'; gsap.to(cBtn, { opacity: 0, duration: 0.15, ease: 'power2.in', overwrite: 'auto' }) }
      if (isMobile) {
        gsap.set(btn, { clearProps: 'left,bottom,xPercent,right,width' })
        setTimeout(() => {
          if (tBtn) gsap.set(tBtn, { clearProps: 'left,bottom,right,xPercent,width' })
          if (cBtn) gsap.set(cBtn, { clearProps: 'left,bottom,right,xPercent,width' })
        }, 200)
        return
      }
      if (label) gsap.to(label, { width: 0, opacity: 0, duration: 0.12, ease: 'power2.in', overwrite: 'auto' })
      gsap.to(btn, { width: 56, duration: 0.15, delay: 0.08, ease: 'power2.in', overwrite: 'auto' })
      gsap.to(btn, { left: window.innerWidth - 52, bottom: 24, duration: 0.2, delay: 0.1, ease: 'expo.in', overwrite: false, onComplete: () => gsap.set(btn, { clearProps: 'left,bottom,xPercent,right,width' }) })
    }
  }

  function _applyMultilineClasses() {
    document.querySelectorAll('.todo-item').forEach(item => {
      const text = item.querySelector('.todo-text')
      if (!text) return
      const lh = parseFloat(getComputedStyle(text).lineHeight) || 20
      item.classList.toggle('todo-item--multiline', text.scrollHeight > lh * 1.5)
    })
  }

  // ─── KEYBOARD SHORTCUTS ──────────────────────────────────
  function _handleKeyboard(e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return
    if ((e.metaKey || e.ctrlKey) && e.key === 'z') { e.preventDefault(); undoAction() }
    if (e.key === 'Escape') {
      closeModalFn(); closeDeleteModal(); closeAdminModal(); closeHamburger()
      closeCategoryView?.(); closeAuthModal()
    }
    if (e.key === 'n' && !e.metaKey && !e.ctrlKey) { openModalFn() }
    if (e.key === 'ArrowLeft') navigate(-1)
    if (e.key === 'ArrowRight') navigate(1)
    if (e.key === 't') { state.setNavDate(today()); navDate.set(state.navDate); rerender() }
  }

  // ─── MOUNT ────────────────────────────────────────────────
  onMount(() => {
    // Expose window.app for all existing render functions that call window.app.X()
    window.app = {
      // Navigation
      navigate: (delta) => navigate(delta),
      navigateMonth: (delta) => navigateMonth(delta),
      todayNav: () => todayNav(),
      setView: (v) => setView(v),
      setNavDateAndView: (date, v) => setNavDateAndView(date, v),
      parseDS: (s) => parseDS(s),

      // Drag & drop order
      dropReorder: (draggedId, group, targetId, before) => dropReorder(draggedId, group, targetId, before),
      recurringOrder,
      dayOrder,

      // Todos
      toggleTodo: (id, d) => toggleTodo(id, d),
      deleteTodo: (id, dateStr) => deleteTodo(id, dateStr),
      closeDeleteModal: () => closeDeleteModal(),
      deleteOneOccurrence: () => doDeleteOneOccurrence(),
      deleteFutureOccurrences: () => doDeleteFutureOccurrences(),
      deleteAllOccurrences: () => doDeleteAllOccurrences(),
      duplicateTodo: (id, ds) => duplicateTodo(id, ds),
      clickTodo: (e, id, ds) => clickTodo(e, id, ds),
      addTaskAfter: (id, ds) => addTaskAfter(id, ds),
      unlinkFromCategory: (id) => unlinkFromCategory(id),
      quickEditTitle: (el, id, ds) => quickEditTitle(el, id, ds),
      clearDay: () => clearDay(),

      // Modal
      openModal: (date) => openModalFn(date),
      closeModal: () => closeModalFn(),
      openEditModal: (id, dateStr) => openEditModalFn(id, dateStr),
      saveTask: () => saveTask(),
      selectRecurrence: (rec) => selectRecurrence(rec),
      toggleWeekDay: (i) => toggleWeekDay(i),
      toggleMonthDay: (d) => toggleMonthDay(d),
      toggleMonthLastDay: () => toggleMonthLastDay(),
      selectYearMonth: (m) => selectYearMonth(m),
      selectYearDay: (d) => selectYearDay(d),
      setTaskDateToday: () => setTaskDateToday(),
      setTaskDateTomorrow: () => setTaskDateTomorrow(),
      toggleCloudSection: (el) => toggleCloudSection(el),
      toggleModalRight: () => toggleModalRight(),
      selectPriority: (p) => selectPriority(p),
      toggleNewCatRow: () => toggleNewCatRow(),
      addCategoryInline: () => addCategoryInline(),
      openModalWithTitle: (title) => openModalWithTitle(title),
      openModalWithRecurring: (id) => openModalWithRecurring(id),
      getSuggestion: (i) => getSuggestion(i),

      // Template
      openTemplateModal: (dateStr) => openTemplateModalFn(dateStr),
      closeTemplateModal: () => closeTemplateModal(),
      applyTemplate: (id, dateStr) => applyTemplateFn(id, dateStr),
      addTemplate: () => addTemplate(),
      removeTemplate: (id) => removeTemplate(id),
      addTaskToTemplate: (id) => addTaskToTemplate(id),
      removeTaskFromTemplate: (id, idx) => removeTaskFromTemplate(id, idx),

      // Admin
      openAdminModal: () => openAdminModal(),
      closeAdminModal: () => closeAdminModal(),
      showAdminSection: (id) => showAdminSection(id),
      addSuggestedTask: (type) => addSuggestedTask(type),
      removeSuggestedTask: (type, task) => removeSuggestedTask(type, task),
      moveSuggestedTask: (type, idx, dir) => moveSuggestedTask(type, idx, dir),
      clearAllSuggestedTasks: () => clearAllSuggestedTasks(),
      clearAllCalendarData: () => clearAllCalendarDataFn(),
      hmOpenAdmin: (section) => hmOpenAdmin(section),
      openAdminSection: (section) => openAdminSection(section),

      // Categories
      addCategory: () => addCategory(),
      removeCategory: (id) => removeCategoryFn(id),
      getCategories: () => getCategories(),
      openCategoryView: (id) => openCategoryView(id),
      closeCategoryView: () => closeCategoryView(),
      setCategoryColor: (id, color) => setCategoryColor(id, color),
      saveCategoryName: (id, name) => saveCategoryName(id, name),
      saveCategoryDescription: (id, desc) => saveCategoryDescription(id, desc),
      setCategoryIcon: (id, icon) => setCategoryIcon(id, icon),
      setCategoriesCols: (n) => setCategoriesCols(n),
      setCategoriesSort: (s) => setCategoriesSort(s),
      deleteCategory: (id) => deleteCategory(id),
      reorderCategoryTask: (id, catId, dir) => reorderCategoryTask(id, catId, dir),
      openModalForCategory: (catId) => openModalForCategory(catId),
      addCategoryFromView: () => addCategoryFromView(),

      // Theme, zoom, lang
      toggleTheme: () => toggleTheme(),
      setZoom: (idx) => setZoom(idx),
      setLang: (l) => setLang(l),

      // Hamburger
      toggleHamburger: () => toggleHamburger(),
      openHamburger: () => openHamburger(),
      closeHamburger: () => closeHamburger(),

      // Chat
      openChat: () => openChat(),
      closeChat: () => closeChat(),
      sendChatMessage: () => sendChatMessage(),

      // User / Auth
      openUserArea: () => openUserArea(),
      closeAuthModal: () => closeAuthModal(),
      showAuthLogin: () => showAuthLogin(),
      showAuthRegister: () => showAuthRegister(),
      authToggleMode: () => authToggleMode(),
      authSubmit: () => authSubmit(),
      authGoogleSignIn: () => authGoogleSignIn(),
      authFacebookSignIn: () => authFacebookSignIn(),
      authSignOut: () => authSignOut(),
      authContinueAsGuest: () => authContinueAsGuest(),
      upgradeGoogleSignIn: () => upgradeGoogleSignIn(),
      upgradeFacebookSignIn: () => upgradeFacebookSignIn(),
      upgradeSubmit: () => upgradeSubmit(),
      upgradeDismiss: () => upgradeDismiss(),
      leaveKeepData: () => leaveKeepData(),
      leaveDeleteData: () => leaveDeleteData(),
      closeLeavePrompt: () => closeLeavePrompt(),
      openAvatarFromPrompt: () => openAvatarFromPrompt(),
      skipGuestName: () => skipGuestName(),
      saveGuestName: () => saveGuestName(),
      saveDisplayName: () => saveDisplayName(),
      profileDeleteData: () => profileDeleteData(),

      // Avatar
      openAvatarEditor: () => openAvatarEditor(),
      closeAvatarEditor: () => closeAvatarEditor(),
      handleAvatarFile: (input) => handleAvatarFile(input),
      selectAvatarFilter: (id) => selectAvatarFilter(id),
      selectAvatarEmoji: (emoji) => selectAvatarEmoji(emoji),
      avatarSwitchTab: (tab) => avatarSwitchTab(tab),
      saveAvatar: () => saveAvatarFn(),
      cropDragStart: (e) => cropDragStart(e),
      setCropZoom: (val) => setCropZoom(val),
      setEmojiZoom: (val) => setEmojiZoom(val),

      // Data
      exportAllData: () => exportAllData(state.todos),
      exportCalendarOnly: () => exportCalendarOnly(state.todos),
      exportConfigOnly: () => exportConfigOnly(),
      downloadICalFile: () => downloadICalFile(state.todos),
      handleImportFile: (e) => handleImportFile(e),
      undoAction: () => undoAction(),
    }

    // Helper functions for inline handlers that use braces (Svelte template restriction)
    window._chatKeydown = (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); window.app.sendChatMessage() }
    }
    window._chatInput = (el) => {
      el.style.height = 'auto'
      el.style.height = Math.min(el.scrollHeight, 100) + 'px'
    }

    // Initialize app
    state.setTodos(loadTodos())
    todos.set(state.todos)
    applyZoom()
    initTheme()
    applyLang()

    // Restore saved view
    const savedView = localStorage.getItem('view')
    if (savedView && ['day','week','month','year','categories'].includes(savedView)) {
      state.setView(savedView)
      view.set(savedView)
    }

    // Version label
    const vl = document.getElementById('versionLabel')
    if (vl) {
      const branch = typeof __GIT_BRANCH__ !== 'undefined' ? __GIT_BRANCH__ : ''
      vl.textContent = 'v' + VERSION + (branch ? ' [' + branch + ']' : '')
    }

    // Setup event listeners (modal save, keyboard, etc.)
    setupEventListeners(window.app)

    // Animate view tabs
    if (typeof gsap !== 'undefined') {
      const tabs = document.querySelectorAll('.view-tab')
      if (tabs.length > 0) {
        gsap.fromTo(tabs, { opacity: 0, scale: 0.85 }, { opacity: 1, scale: 1, duration: 0.25, stagger: 0.05, ease: 'power3.out' })
      }
    }

    // Resize handler
    let _resizeTimer
    window.addEventListener('resize', () => {
      clearTimeout(_resizeTimer)
      _resizeTimer = setTimeout(() => {
        const sidebar = document.getElementById('calSidebar')
        if (sidebar && state.view === 'day') {
          sidebar.innerHTML = renderSidebar(state.todos)
        }
        _animateQuickAddBtn()
      }, 150)
    })

    // Offline indicator
    setupOfflineIndicator()

    // Cross-tab sync
    initCrossTabSync((key, raw) => {
      switch (key) {
        case 'todos':
          try { state.setTodos(JSON.parse(raw)); todos.set(state.todos); rerender() } catch {}
          break
        case 'theme':
          document.documentElement.setAttribute('data-theme', raw)
          updateThemeBtn()
          break
        case 'zoom':
          _zoomIdx = parseInt(raw, 10)
          applyZoom()
          break
        case 'lang':
          state.setLang(raw); lang.set(state.lang); T.set(state.T)
          applyLang(); rerender()
          break
        case 'projects':
        case 'dayTemplates':
        case 'suggestedTasks':
        case 'projectTaskOrder':
        case 'categoriesCols':
        case 'categoriesSort':
          rerender()
          break
        case 'profileAvatar':
          _updateUserBtn()
          break
      }
    })

    // History
    history.replaceState({ view: state.view, nav: state.navDate.toISOString().slice(0, 10) }, '')
    window.addEventListener('popstate', (e) => _popHistory(e))
    window.addEventListener('keydown', _handleKeyboard)

    // Initial render
    rerender()

    // Firebase (async, non-blocking)
    _syncServer()
    _initFirebase()
  })

  onDestroy(() => {
    if (_firestoreUnsub) _firestoreUnsub()
    window.removeEventListener('keydown', _handleKeyboard)
  })
</script>

<header>
  <div class="header-top">
    <span class="app-title" onclick={() => window.app.openUserArea()} title="Mon compte">
      <span id="logoAvatar" class="logo-avatar">
        <svg class="logo-mark" width="26" height="26" viewBox="0 0 26 26" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="26" height="26" rx="7" fill="var(--primary)"/><path d="M7 13.5L11 17.5L19 9" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </span>
      <span class="logo-text" id="logoText">2FŨKOI</span>
    </span>
    <button class="chat-inbox-btn" id="chatInboxBtn" onclick={() => window.app.openChat()} title="Messages">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
      <span class="chat-inbox-badge hidden" id="chatBadge">0</span>
    </button>
    <div class="nav-group">
      <span class="period-label" id="periodLabel"></span>
    </div>
    <div class="header-sep"></div>
    <div class="view-tabs">
      <button class="view-tab active" data-view="day" data-i18n="viewDay">Today</button>
      <button class="view-tab" data-view="week" data-i18n="viewWeek">Week</button>
      <button class="view-tab" data-view="month" data-i18n="viewMonth">Month</button>
      <button class="view-tab" data-view="year" data-i18n="viewYear">Year</button>
    </div>
    <button class="view-tab categories-tab" data-view="categories" data-i18n="viewProjects">
      <svg width="13" height="13" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" class="cat-icon"><rect x="1" y="1" width="6" height="6" rx="1.5" fill="currentColor"/><rect x="9" y="1" width="6" height="6" rx="1.5" fill="currentColor"/><rect x="1" y="9" width="6" height="6" rx="1.5" fill="currentColor"/><rect x="9" y="9" width="6" height="6" rx="1.5" fill="currentColor"/></svg>
      <span data-i18n="viewProjects">Catégories</span>
    </button>
    <div class="header-sep"></div>
    <div class="header-spacer"></div>
    <div class="zoom-group" title="Text size">
      <button class="size-btn" id="szSmall" onclick={() => window.app.setZoom(0)}>A</button>
      <button class="size-btn active" id="szMed" onclick={() => window.app.setZoom(1)}>A</button>
      <button class="size-btn" id="szLarge" onclick={() => window.app.setZoom(2)}>A</button>
    </div>
    <select id="langSelect" class="lang-select" onchange={() => window.app.setLang(this.value)}>
      <option value="en">EN</option>
      <option value="fr">FR</option>
    </select>
    <button class="nav-btn" id="themeBtn" onclick={() => window.app.toggleTheme()} style="font-size:16px;border:none;">🌙</button>
    <div class="hamburger-wrap">
      <button class="hamburger-btn" id="hamburgerBtn" onclick={() => window.app.toggleHamburger()} aria-label="Menu">
        <span class="hbg-bar"></span>
        <span class="hbg-bar"></span>
        <span class="hbg-bar"></span>
      </button>
    </div>
    <div id="offlineBadge" class="offline-badge" hidden>Hors ligne</div>
    <button class="user-btn" id="userBtn" onclick={() => window.app.openUserArea()} title="Compte">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="8" r="4"/>
        <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
      </svg>
    </button>
  </div>
</header>

<div id="appWrapper">
  <main id="mainContent">
    {#if currentView === 'day'}
      <DayView />
    {:else if currentView === 'week'}
      <WeekView />
    {:else if currentView === 'month'}
      <MonthView />
    {:else if currentView === 'year'}
      <YearView />
    {:else if currentView === 'categories'}
      <CategoriesView />
    {:else if currentView === 'profile'}
      <ProfileView />
    {/if}
  </main>
  <aside id="calSidebar"></aside>
</div>

<!-- Clear Day Float Button (day view only) -->
<button id="clearDayBtn" class="clear-day-float-btn" onclick={() => window.app.clearDay()}>
  <span class="cdb-icon">⊘</span><span class="cdb-label">Vider la journée</span>
</button>

<!-- Template Float Button (day view only) -->
<button id="templateDayBtn" class="template-day-float-btn" onclick={() => window.app.openTemplateModal()}>
  <span class="tdb-icon">☰</span><span class="tdb-label">Insérer un modèle...</span>
</button>

<!-- Quick Add Float Button (bottom right) -->
<button id="quickAddBtn" class="quick-add-float-btn" onclick={() => { window.app.openModal(); }} title="Add task">
  <span class="qab-icon">＋</span>
  <span class="qab-label" data-i18n="addTaskShort">ADD TASK</span>
</button>

<!-- Delete Recurrence Modal -->
<div class="modal-overlay hidden" id="deleteModalOverlay">
  <div class="modal" style="max-width:400px">
    <div class="modal-title" id="deleteModalTitle">Delete recurring task</div>
    <p style="font-size:14px;color:var(--text-muted);margin-bottom:16px;">
      <span id="deleteModalPrompt">How would you like to delete</span> "<strong id="deleteTaskName"></strong>"?
    </p>
    <div style="display:flex;flex-direction:column;gap:8px;">
      <button id="deleteOneBtn" style="text-align:left;padding:14px 16px;border:1.5px solid var(--border);border-radius:10px;background:var(--surface);cursor:pointer;transition:all .15s;" onmouseover={(e) => e.currentTarget.style.borderColor='var(--danger)'} onmouseout={(e) => e.currentTarget.style.borderColor='var(--border)'}>
        <div id="deleteOneTitle" style="font-size:14px;font-weight:600;color:var(--text)">This occurrence only</div>
        <div id="deleteOneDesc" style="font-size:12px;color:var(--text-muted);margin-top:2px">Remove just this date, keep future repeats</div>
      </button>
      <button id="deleteFutureBtn" style="text-align:left;padding:14px 16px;border:1.5px solid var(--border);border-radius:10px;background:var(--surface);cursor:pointer;transition:all .15s;" onmouseover={(e) => e.currentTarget.style.borderColor='var(--danger)'} onmouseout={(e) => e.currentTarget.style.borderColor='var(--border)'}>
        <div id="deleteFutureTitle" style="font-size:14px;font-weight:600;color:var(--text)">This and all future occurrences</div>
        <div id="deleteFutureDesc" style="font-size:12px;color:var(--text-muted);margin-top:2px">Stop repeating from this date onward</div>
      </button>
      <button id="deleteAllBtn" style="text-align:left;padding:14px 16px;border:1.5px solid var(--border);border-radius:10px;background:var(--surface);cursor:pointer;transition:all .15s;" onmouseover={(e) => e.currentTarget.style.borderColor='var(--danger)'} onmouseout={(e) => e.currentTarget.style.borderColor='var(--border)'}>
        <div id="deleteAllTitle" style="font-size:14px;font-weight:600;color:var(--danger)">All occurrences</div>
        <div id="deleteAllDesc" style="font-size:12px;color:var(--text-muted);margin-top:2px">Delete the task entirely</div>
      </button>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" id="cancelDeleteModal">Cancel</button>
    </div>
  </div>
</div>

<!-- Add Task Modal -->
<div class="modal-overlay hidden" id="modalOverlay">
  <div class="modal modal-two-columns">
    <div class="modal-left">
      <div class="modal-title" id="modalTitleEl" data-i18n="newTask">New Task</div>

      <div class="form-group" style="position:relative">
        <label class="form-label" data-i18n="task">Task</label>
        <input class="form-input" id="taskTitle" placeholder="What needs to be done?" maxlength="200" autocomplete="off">
        <div class="title-combobox hidden" id="titleCombobox" role="listbox"></div>
      </div>

      <div class="form-group">
        <label class="form-label">Description</label>
        <textarea class="form-input" id="taskDescription" placeholder="Notes, détails..." rows="2" style="resize:vertical;min-height:62px;font-family:inherit"></textarea>
      </div>

      <div class="form-group">
        <label class="form-label">Priorité</label>
        <div class="priority-options">
          <div class="priority-option active" data-priority="">Aucune</div>
          <div class="priority-option priority-low" data-priority="low">▾ Basse</div>
          <div class="priority-option priority-medium" data-priority="medium">▸ Moy.</div>
          <div class="priority-option priority-high" data-priority="high">▲ Haute</div>
        </div>
      </div>

      <div class="form-group" id="dateGroup">
        <label class="form-label" data-i18n="date">Date</label>
        <div class="date-row">
          <input class="form-input" type="date" id="taskDate" onclick={(e) => e.currentTarget.showPicker()}>
          <button type="button" class="today-btn" data-i18n="today" onclick={() => window.app.setTaskDateToday()}>Aujourd'hui</button>
          <button type="button" class="today-btn" data-i18n="tomorrow" onclick={() => window.app.setTaskDateTomorrow()}>Demain</button>
        </div>
      </div>

      <div class="form-group" id="categoryGroup">
        <label class="form-label">Catégorie</label>
        <div class="category-select-row">
          <select class="form-input" id="taskCategory">
            <option value="">— Aucune catégorie —</option>
          </select>
          <button type="button" class="add-cat-btn" onclick={() => window.app.toggleNewCatRow()} title="Nouvelle catégorie">+</button>
        </div>
        <div id="newCatRow" style="display:none">
          <input class="form-input" id="newCatInput" placeholder="Nom de la catégorie..."
            onkeydown={() => { if(event.key==='Enter')window.app.addCategoryInline();if(event.key==='Escape')window.app.toggleNewCatRow() }}>
        </div>
      </div>

      <div class="form-group">
        <label class="form-label" data-i18n="repeat">Repeat</label>
        <div class="rec-options">
          <div class="rec-option active" data-rec="none" data-i18n="recNone">No repeat</div>
          <div class="rec-option" data-rec="daily" data-i18n="recDaily">Daily</div>
          <div class="rec-option" data-rec="weekly" data-i18n="recWeekly">Weekly</div>
          <div class="rec-option" data-rec="monthly" data-i18n="recMonthly">Monthly</div>
          <div class="rec-option" data-rec="yearly" data-i18n="recYearly">Yearly</div>
        </div>
        <div class="rec-detail" id="recDetail"></div>
      </div>

      <div class="modal-footer">
        <button class="btn btn-ghost" id="cancelModal" data-i18n="cancel">Cancel</button>
        <button class="btn btn-primary" id="saveTask" data-i18n="saveTask">Save Task</button>
      </div>
    </div>

    <button class="modal-col-toggle" id="modalColToggle" onclick={() => window.app.toggleModalRight()} title="Suggestions">
      <svg viewBox="0 0 10 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="2 2 8 8 2 14"/>
      </svg>
    </button>

    <div class="modal-right" id="modalRight">
      <div class="modal-right-inner" id="modalRightInner">
        <div id="modalClouds"></div>
      </div>
    </div>
  </div>
</div>

<!-- Admin Modal -->
<div class="modal-overlay hidden" id="adminModalOverlay">
  <div class="modal">
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
      <div class="modal-title" style="margin: 0;">Administration</div>
      <button onclick={() => window.app.closeAdminModal()} style="width:24px;height:24px;border:none;background:transparent;color:var(--text-muted);cursor:pointer;font-size:16px;padding:0;display:flex;align-items:center;justify-content:center;">✕</button>
    </div>
    <div id="adminClouds"></div>
  </div>
</div>

<!-- Template Picker Modal -->
<div class="modal-overlay hidden" id="templateModalOverlay">
  <div class="modal" style="max-width:460px;">
    <div class="modal-title">Modèle de journée</div>
    <div id="templatePickerList" style="margin-top:16px;"></div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick={() => window.app.closeTemplateModal()}>Annuler</button>
    </div>
  </div>
</div>

<!-- Category View Panel -->
<div id="categoryPanelOverlay" class="category-panel-overlay hidden" onclick={() => window.app.closeCategoryView()}></div>
<div id="categoryPanel" class="category-panel hidden"></div>

<!-- Hamburger Menu -->
<div id="hamburgerOverlay" class="hamburger-overlay hidden" onclick={() => window.app.closeHamburger()}></div>
<div id="hamburgerMenu" class="hamburger-menu">
  <div class="hm-header">
    <span class="hm-title">Menu</span>
    <button class="hm-close-btn" onclick={() => window.app.closeHamburger()} aria-label="Fermer">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
        <line x1="2" y1="2" x2="14" y2="14"/><line x1="14" y1="2" x2="2" y2="14"/>
      </svg>
    </button>
  </div>

  <div class="hm-body">
    <div class="hm-section-label">Vues</div>
    <button class="hm-item" onclick={() => { window.app.closeHamburger(); window.app.setView('day') }}>
      <span class="hm-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="4"/>
          <path d="M12 2v3M12 19v3M2 12h3M19 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/>
        </svg>
      </span>
      <span class="hm-item-label">Quotidienne</span>
    </button>
    <button class="hm-item" onclick={() => { window.app.closeHamburger(); window.app.setView('week') }}>
      <span class="hm-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
          <rect x="2" y="15" width="3" height="6" rx="1"/>
          <rect x="6.5" y="11" width="3" height="10" rx="1"/>
          <rect x="11" y="7" width="3" height="14" rx="1"/>
          <rect x="15.5" y="12" width="3" height="9" rx="1"/>
          <rect x="20" y="15" width="3" height="6" rx="1"/>
        </svg>
      </span>
      <span class="hm-item-label">Hebdomadaire</span>
    </button>
    <button class="hm-item" onclick={() => { window.app.closeHamburger(); window.app.setView('month') }}>
      <span class="hm-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="4" width="18" height="17" rx="2"/>
          <line x1="3" y1="9" x2="21" y2="9"/>
          <line x1="8" y1="2" x2="8" y2="6"/>
          <line x1="16" y1="2" x2="16" y2="6"/>
          <line x1="9" y1="9" x2="9" y2="21"/>
          <line x1="15" y1="9" x2="15" y2="21"/>
          <line x1="3" y1="14" x2="21" y2="14"/>
          <line x1="3" y1="19" x2="21" y2="19"/>
        </svg>
      </span>
      <span class="hm-item-label">Mensuelle</span>
    </button>
    <button class="hm-item" onclick={() => { window.app.closeHamburger(); window.app.setView('year') }}>
      <span class="hm-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="9"/>
          <polyline points="12,7 12,12 16,14"/>
        </svg>
      </span>
      <span class="hm-item-label">Annuelle</span>
    </button>
    <button class="hm-item" onclick={() => { window.app.closeHamburger(); window.app.setView('categories') }}>
      <span class="hm-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"/>
        </svg>
      </span>
      <span class="hm-item-label">Par Catégories</span>
    </button>

    <div class="hm-divider"></div>
    <div class="hm-section-label">Administration</div>
    <button class="hm-item" onclick={() => window.app.hmOpenAdmin('taches')}>
      <span class="hm-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
          <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/>
          <path d="M9 5a2 2 0 012-2h2a2 2 0 012 2v0a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
          <path d="M9 14l2 2 4-4"/>
        </svg>
      </span>
      <span class="hm-item-label">Tâches suggérées</span>
    </button>
    <button class="hm-item" onclick={() => window.app.hmOpenAdmin('modeles')}>
      <span class="hm-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="3" width="18" height="5" rx="1.5"/>
          <rect x="3" y="11" width="7" height="10" rx="1.5"/>
          <rect x="13" y="11" width="8" height="4" rx="1.5"/>
          <rect x="13" y="18" width="8" height="3" rx="1.5"/>
        </svg>
      </span>
      <span class="hm-item-label">Modèles</span>
    </button>
    <button class="hm-item" onclick={() => window.app.hmOpenAdmin('donnees')}>
      <span class="hm-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
          <ellipse cx="12" cy="6" rx="8" ry="2.5"/>
          <path d="M4 6v4c0 1.38 3.58 2.5 8 2.5s8-1.12 8-2.5V6"/>
          <path d="M4 10v4c0 1.38 3.58 2.5 8 2.5s8-1.12 8-2.5v-4"/>
        </svg>
      </span>
      <span class="hm-item-label">Données</span>
    </button>
  </div>
</div>

<div id="versionLabel"></div>

<!-- Auth Modal -->
<div class="modal-overlay hidden" id="authModalOverlay" onclick={(e) => { if(e.target===e.currentTarget) window.app.closeAuthModal() }}>
  <div class="modal auth-modal">

    <!-- Logged-in / Guest panel -->
    <div id="authPanelUser" class="auth-panel hidden">
      <div class="auth-chat-header">
        <div class="auth-chat-avatar" id="authAvatar">👤</div>
        <div class="auth-chat-header-info">
          <div class="auth-chat-name" id="authUserName">Invité</div>
          <div class="auth-chat-sub" id="authUserSub">Session temporaire</div>
        </div>
        <button class="auth-chat-close" onclick={() => window.app.closeAuthModal()}>✕</button>
      </div>
      <div class="auth-chat-bubble" id="authWelcomeBubble"></div>
      <div id="authUpgradeSection" class="auth-upgrade-section hidden">
        <button class="btn btn-social btn-google" onclick={() => window.app.authGoogleSignIn()}>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
          Continuer avec Google
        </button>
        <button class="btn btn-social btn-facebook" onclick={() => window.app.authFacebookSignIn()} style="margin-top:8px">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="#1877F2"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
          Continuer avec Facebook
        </button>
        <div class="auth-divider"><span>ou</span></div>
        <button class="btn btn-ghost" style="width:100%" onclick={() => window.app.showAuthRegister()}>Créer un compte avec email</button>
        <div class="auth-switch">
          <span>Déjà un compte ?</span>
          <button class="btn-link" onclick={() => window.app.showAuthLogin()}>Se connecter</button>
        </div>
      </div>
      <div class="auth-footer-actions">
        <button class="btn btn-ghost" style="width:100%;color:var(--danger)" onclick={() => window.app.authSignOut()}>Se déconnecter</button>
      </div>
    </div>

    <!-- Login / Register panel -->
    <div id="authPanelForm" class="auth-panel">
      <div class="auth-chat-header">
        <div class="auth-chat-avatar" style="font-size:14px">✦</div>
        <div class="auth-chat-name" id="authFormTitle">Se connecter</div>
        <button class="auth-chat-close" onclick={() => window.app.closeAuthModal()}>✕</button>
      </div>
      <div class="auth-chat-bubble" id="authFormBubble">Connecte-toi pour retrouver tes tâches sur tous tes appareils.</div>
      <div class="form-group">
        <label class="form-label">Email</label>
        <input class="form-input" type="email" id="authEmail" placeholder="vous@exemple.com" autocomplete="email">
      </div>
      <div class="form-group">
        <label class="form-label">Mot de passe</label>
        <input class="form-input" type="password" id="authPassword" placeholder="••••••••" autocomplete="current-password">
      </div>
      <div class="auth-error hidden" id="authError"></div>
      <button class="btn btn-primary" style="width:100%;margin-top:8px" id="authSubmitBtn" onclick={() => window.app.authSubmit()}>Se connecter</button>
      <div class="auth-switch">
        <span id="authSwitchText">Pas encore de compte ?</span>
        <button class="btn-link" id="authSwitchBtn" onclick={() => window.app.authToggleMode()}>Créer un compte</button>
      </div>
      <div class="auth-divider"><span>ou</span></div>
      <button class="btn btn-social btn-google" onclick={() => window.app.authGoogleSignIn()}>
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
        Continuer avec Google
      </button>
      <button class="btn btn-social btn-facebook" onclick={() => window.app.authFacebookSignIn()} style="margin-top:8px">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="#1877F2"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
        Continuer avec Facebook
      </button>
      <div class="auth-divider"><span>ou</span></div>
      <button class="btn btn-ghost" style="width:100%" onclick={() => window.app.authContinueAsGuest()}>Continuer sans compte</button>
    </div>

  </div>
</div>

<!-- Upgrade prompt -->
<div class="modal-overlay hidden" id="upgradePromptOverlay">
  <div class="modal auth-modal">
    <div class="modal-title">Sauvegarder vos tâches ?</div>
    <p class="auth-upgrade-msg">Créez un compte gratuit pour accéder à vos tâches depuis n'importe quel appareil.</p>
    <button class="btn btn-social btn-google" onclick={() => window.app.upgradeGoogleSignIn()}>
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
      Continuer avec Google
    </button>
    <button class="btn btn-social btn-facebook" onclick={() => window.app.upgradeFacebookSignIn()} style="margin-top:8px">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="#1877F2"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.47c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
      Continuer avec Facebook
    </button>
    <div class="auth-divider"><span>ou</span></div>
    <div class="form-group">
      <label class="form-label">Email</label>
      <input class="form-input" type="email" id="upgradeEmail" placeholder="vous@exemple.com">
    </div>
    <div class="form-group">
      <label class="form-label">Mot de passe</label>
      <input class="form-input" type="password" id="upgradePassword" placeholder="••••••••" autocomplete="new-password">
    </div>
    <div class="auth-error hidden" id="upgradeError"></div>
    <button class="btn btn-primary" style="width:100%;margin-top:8px" onclick={() => window.app.upgradeSubmit()}>Créer mon compte avec email</button>
    <button class="btn btn-ghost" style="width:100%;margin-top:8px" onclick={() => window.app.upgradeDismiss()}>Non merci, continuer sans compte</button>
  </div>
</div>

<!-- Leave prompt -->
<div class="modal-overlay hidden" id="leavePromptOverlay">
  <div class="modal auth-modal">
    <div class="modal-title">Avant de partir…</div>
    <p class="auth-upgrade-msg">Tes tâches sont sauvegardées pour ta prochaine visite sur cet appareil. Crée un compte pour y accéder partout.</p>
    <button class="btn btn-primary" style="width:100%;margin-bottom:8px" onclick={() => { window.app.showAuthRegister(); window.app.closeLeavePrompt(); }}>Créer un compte</button>
    <button class="btn btn-ghost" style="width:100%;margin-bottom:8px" onclick={() => window.app.leaveKeepData()}>Garder pour la prochaine visite</button>
    <button class="btn btn-ghost" style="width:100%;color:var(--danger)" onclick={() => window.app.leaveDeleteData()}>Effacer mes données</button>
  </div>
</div>

<!-- Chat off-canvas overlay -->
<div class="chat-inbox-overlay" id="chatInboxOverlay" onclick={() => window.app.closeChat()}></div>

<!-- Chat off-canvas panel -->
<div class="chat-inbox-panel" id="chatInboxPanel">
  <div class="chat-inbox-panel__header">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
    <span class="chat-inbox-panel__title">Messages</span>
    <button class="chat-inbox-panel__close" onclick={() => window.app.closeChat()}>✕</button>
  </div>
  <div class="chat-inbox-panel__body" id="chatInboxList">
    <p class="chat-empty-msg">Aucun message pour l'instant.</p>
  </div>
  <div class="chat-inbox-panel__reply">
    <textarea id="chatReplyInput" class="chat-inbox-panel__reply-input" placeholder="Répondre…" rows="1"
      onkeydown={() => window._chatKeydown(event)}
      oninput={() => window._chatInput(this)}></textarea>
    <button class="chat-inbox-panel__reply-send" onclick={() => window.app.sendChatMessage()} title="Envoyer">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
    </button>
  </div>
</div>

<!-- Avatar editor modal -->
<div class="modal-overlay hidden" id="avatarEditorOverlay" onclick={(e) => { if(e.target===e.currentTarget) window.app.closeAvatarEditor() }}>
  <div class="modal avatar-editor-modal">
    <button class="auth-close-btn" onclick={() => window.app.closeAvatarEditor()}>✕</button>
    <div class="modal-title">Modifier l'avatar</div>
    <div id="avatarEditorContent"></div>
  </div>
</div>

<!-- Guest Name Prompt -->
<div class="modal-overlay hidden" id="guestNameOverlay">
  <div class="modal" style="max-width:360px;padding:28px 24px;display:flex;flex-direction:column;gap:14px;">
    <div style="text-align:center;">
      <div style="font-size:24px;margin-bottom:6px;">👋</div>
      <div style="font-weight:600;font-size:15px;margin-bottom:4px;">Bienvenue !</div>
      <div style="font-size:13px;color:var(--text-muted);">Personnalise ton expérience — tout est optionnel.</div>
    </div>

    <button class="btn btn-ghost" style="width:100%;justify-content:center;gap:8px;display:flex;align-items:center;"
      onclick={() => window.app.openAvatarFromPrompt()}>
      🎨 <span>Choisir un avatar ou une photo</span>
    </button>

    <input class="form-input" type="text" id="guestNameInput" placeholder="Ton prénom" maxlength="32" autocomplete="off">

    <div style="display:flex;align-items:center;gap:10px;color:var(--text-muted);font-size:11px;">
      <div style="flex:1;height:1px;background:var(--border)"></div>
      <span>ou crée un compte</span>
      <div style="flex:1;height:1px;background:var(--border)"></div>
    </div>

    <div>
      <input class="form-input" type="email" id="guestEmailInput" placeholder="Email — sync multi-appareils" autocomplete="email">
      <div style="font-size:11px;color:var(--text-muted);margin-top:4px;padding-left:2px;">
        Un compte garde tes tâches sur tous tes appareils.
      </div>
    </div>

    <div style="display:flex;gap:8px;margin-top:2px;">
      <button class="btn btn-ghost" style="flex:1" onclick={() => window.app.skipGuestName()}>Passer</button>
      <button class="btn btn-primary" style="flex:1" onclick={() => window.app.saveGuestName()}>Continuer</button>
    </div>
  </div>
</div>
