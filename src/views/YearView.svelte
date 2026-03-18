<script>
  import { onMount } from 'svelte'
  import { renderYearView, renderYearSidebar } from '../../js/modules/render.js'
  import * as state from '../../js/modules/state.js'
  import { renderTick } from '../stores.js'

  let html = ''

  function rerender() {
    html = renderYearView(state.todos)
    const sidebar = document.getElementById('calSidebar')
    if (sidebar) {
      sidebar.style.display = ''
      sidebar.innerHTML = renderYearSidebar()
    }
  }

  $: $renderTick, rerender()
  onMount(rerender)
</script>

{@html html}
