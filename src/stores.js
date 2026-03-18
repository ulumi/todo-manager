import { writable } from 'svelte/store'
import * as state from '../js/modules/state.js'

state.initializeState()

export const todos = writable(state.todos)
export const view = writable(state.view)
export const navDate = writable(state.navDate)
export const lang = writable(state.lang)
export const T = writable(state.T)

// Modal visibility
export const modalOpen = writable(false)
export const deleteModalOpen = writable(false)
export const authModalOpen = writable(false)
export const hamburgerOpen = writable(false)
export const chatOpen = writable(false)
export const adminModalOpen = writable(false)
export const templateModalOpen = writable(false)
export const avatarEditorOpen = writable(false)
export const categoryPanelOpen = writable(false)

// Editing state
export const editingId = writable(null)
export const pendingDelete = writable(null)
export const selectedRecurrence = writable('none')
export const selectedWeekDays = writable([])
export const selectedMonthDays = writable([])
export const selectedMonthLastDay = writable(false)
export const selectedYearMonth = writable(0)
export const selectedYearDay = writable(1)
export const selectedPriority = writable('')
export const insertAfterId = writable(null)

// Misc
export const zoomIdx = writable(parseInt(localStorage.getItem('zoom') ?? '1'))
export const isOffline = writable(!navigator.onLine)
export const currentUser = writable(null)
export const messages = writable([])

// Re-render trigger
export const renderTick = writable(0)

// Helper: sync state.js and trigger re-render
export function syncAndTick(updates = {}) {
  if (updates.todos !== undefined) { state.setTodos(updates.todos); todos.set(updates.todos) }
  if (updates.view !== undefined) { state.setView(updates.view); view.set(updates.view) }
  if (updates.navDate !== undefined) { state.setNavDate(updates.navDate); navDate.set(updates.navDate) }
  if (updates.lang !== undefined) { state.setLang(updates.lang); lang.set(updates.lang); T.set(state.T) }
  renderTick.update(n => n + 1)
}
