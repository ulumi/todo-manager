<script>
  import { onMount } from 'svelte'
  import { renderCategoriesView } from '../../js/modules/render.js'
  import * as state from '../../js/modules/state.js'
  import { renderTick } from '../stores.js'

  let html = ''

  function rerender() {
    html = renderCategoriesView(state.todos)
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
