/**
 * inkwell bootstrap. Wires the workspace, modals, glossary, activity drawer and
 * global keyboard shortcuts. Owns no business logic.
 */

import './styles/main.css';
import { Workspace } from './workspace';
import { initModalTriggers } from './ui';
import { initGlossary } from './glossary';
import { mountEventDrawer, emit } from './eventlog';

function boot(): void {
  const app = document.getElementById('app');
  if (!app) throw new Error('#app missing');

  initModalTriggers();
  initGlossary();

  const workspace = new Workspace(app);
  workspace.showDropzone();

  // Activity drawer toggle
  const drawer = document.getElementById('event-drawer');
  const toggle = document.getElementById('drawer-toggle');
  let mounted: (() => void) | null = null;
  if (drawer && toggle) {
    toggle.addEventListener('click', () => {
      const open = drawer.hasAttribute('hidden');
      if (open) {
        drawer.removeAttribute('hidden');
        toggle.setAttribute('aria-pressed', 'true');
        document.body.classList.add('drawer-open');
        if (!mounted) mounted = mountEventDrawer(drawer);
      } else {
        drawer.setAttribute('hidden', '');
        toggle.setAttribute('aria-pressed', 'false');
        document.body.classList.remove('drawer-open');
      }
    });
  }

  // Global keyboard shortcuts
  document.addEventListener('keydown', (e) => workspace.handleKey(e));

  // Dev-only automated-test hook. Tree-shaken out of the production build.
  if (import.meta.env.DEV) {
    void (async () => {
      const [{ exportSignedPdf }, { checkmarkImage }, state] = await Promise.all([
        import('./pdf-export'),
        import('./signature'),
        import('./state'),
      ]);
      (window as unknown as Record<string, unknown>).__inkwell = { exportSignedPdf, checkmarkImage, state };
    })();
  }

  emit('system', 'ok', 'inkwell ready — no data leaves this tab');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
