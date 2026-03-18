<script>
  import { onMount } from 'svelte'
  import { renderTick } from '../stores.js'
  import * as state from '../../js/modules/state.js'
  import { getCategories } from '../../js/modules/admin.js'
  import { getCurrentUser, isGuest } from '../../js/modules/auth.js'
  import { getAvatarHTML } from '../../js/modules/avatarEditor.js'
  import { esc } from '../../js/modules/utils.js'

  let html = ''

  function renderProfileView() {
    const user     = getCurrentUser?.()
    const name     = user?.displayName || user?.email?.split('@')[0] || ''
    const initials = (user?.displayName || user?.email || '?').slice(0, 2).toUpperCase()
    const cats     = getCategories?.().length || 0
    const total    = state.todos.length
    const recur    = state.todos.filter(t => t.recurrence && t.recurrence !== 'none').length
    const done     = state.todos.filter(t => t.completed).length
    let avatarHtml = ''
    try { avatarHtml = getAvatarHTML?.(initials) || '' } catch {}

    return `
      <div class="profile-view">
        <div class="profile-hero">
          <div class="profile-avatar" onclick="window.app.openAvatarEditor()" title="Modifier l'avatar">
            ${avatarHtml}
            <span class="profile-avatar-hint">✏️</span>
          </div>
          <button class="profile-avatar-edit-btn" onclick="window.app.openAvatarEditor()">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            <span class="profile-avatar-edit-label">Modifier l'avatar</span>
          </button>
          <h1 class="profile-hero-name">${esc(name)}</h1>
          <p class="profile-hero-email">${esc(user?.email || '')}</p>
        </div>

        <div class="profile-body">
          <div class="profile-section">
            <h3 class="profile-section-title">Nom d'affichage</h3>
            <div class="profile-name-row">
              <input class="form-input" type="text" id="profileDisplayName"
                value="${esc(user?.displayName || '')}" placeholder="Ton prénom">
              <button class="btn btn-primary" onclick="window.app.saveDisplayName()">Sauvegarder</button>
            </div>
            <p class="profile-save-msg hidden" id="profileSaveMsg">✓ Sauvegardé</p>
          </div>

          <div class="profile-section">
            <h3 class="profile-section-title">Statistiques</h3>
            <div class="profile-stats">
              <div class="profile-stat"><span class="profile-stat-num">${total}</span><span class="profile-stat-label">tâches</span></div>
              <div class="profile-stat"><span class="profile-stat-num">${done}</span><span class="profile-stat-label">complétées</span></div>
              <div class="profile-stat"><span class="profile-stat-num">${recur}</span><span class="profile-stat-label">récurrentes</span></div>
              <div class="profile-stat"><span class="profile-stat-num">${cats}</span><span class="profile-stat-label">catégories</span></div>
            </div>
          </div>

          <div class="profile-section">
            <h3 class="profile-section-title">Réglages</h3>
            <div class="profile-rows">
              <button class="profile-row" onclick="window.app.openAdminSection('taches')">
                <span>📋 Tâches suggérées</span><span class="profile-row-arrow">›</span>
              </button>
              <button class="profile-row" onclick="window.app.openAdminSection('modeles')">
                <span>🗂 Modèles de journée</span><span class="profile-row-arrow">›</span>
              </button>
            </div>
          </div>

          <div class="profile-section">
            <h3 class="profile-section-title">Données</h3>
            <div class="profile-rows">
              <button class="profile-row" onclick="window.app.exportAllData()">
                <span>📤 Exporter mes données</span><span class="profile-row-arrow">›</span>
              </button>
              <button class="profile-row profile-row--danger" onclick="window.app.profileDeleteData()">
                <span>🗑 Effacer mes données</span><span class="profile-row-arrow">›</span>
              </button>
            </div>
          </div>

          <div class="profile-section">
            <button class="btn btn-ghost profile-signout-btn" onclick="window.app.authSignOut()">Se déconnecter</button>
          </div>
        </div>
      </div>
    `
  }

  function rerender() {
    html = renderProfileView()
    const sidebar = document.getElementById('calSidebar')
    if (sidebar) { sidebar.style.display = 'none'; sidebar.innerHTML = '' }
  }

  $: $renderTick, rerender()
  onMount(rerender)
</script>

{@html html}
