import './app.css';

import { mount } from 'svelte';

import App from './App.svelte';

const root = document.getElementById('app');

if (root === null) {
  throw new Error('Desktop application root element was not found');
}

const app = mount(App, { target: root });

export default app;
