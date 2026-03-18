<script>
  import { onMount } from 'svelte'
  import { renderMonthView } from '../../js/modules/render.js'
  import * as state from '../../js/modules/state.js'
  import { renderTick } from '../stores.js'

  let html = ''

  function rerender() {
    html = renderMonthView(state.todos)
    const sidebar = document.getElementById('calSidebar')
    if (sidebar) {
      sidebar.style.display = 'none'
      sidebar.innerHTML = ''
    }
  }

  $: $renderTick, rerender()
  onMount(rerender)
</script>

{@html html}
