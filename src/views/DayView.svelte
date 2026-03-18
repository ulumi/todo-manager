<script>
  import { onMount } from 'svelte'
  import { renderDayView, renderSidebar } from '../../js/modules/render.js'
  import * as state from '../../js/modules/state.js'
  import { renderTick } from '../stores.js'

  let html = ''
  let sidebarEl = null

  function rerender() {
    html = renderDayView(state.todos)
    // Update sidebar
    const sidebar = document.getElementById('calSidebar')
    if (sidebar) {
      sidebar.style.display = ''
      sidebar.innerHTML = renderSidebar(state.todos)
    }
  }

  $: $renderTick, rerender()
  onMount(rerender)
</script>

{@html html}
