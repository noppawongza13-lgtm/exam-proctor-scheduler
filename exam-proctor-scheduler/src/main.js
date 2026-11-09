/**
 * Main Application Entry Point
 */
import { AppView } from './ui/app-view.js';

function initApp() {
  const root = document.getElementById('app');
  if (root) {
    new AppView(root);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
