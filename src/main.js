import App from './App.svelte'
import '../css/styles.scss'
import { mount } from 'svelte'

const app = mount(App, { target: document.getElementById('app') })
export default app
