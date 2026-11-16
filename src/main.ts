import { Game } from './core/Game';

function bootstrap(): void {
console.log('[Main] Bootstrapping Neo-Fight 3D Arena Fighter...');
  
  try {
    const game = new Game('game-container');
    game.start().catch(err => {
      console.error('[Main] Failed to start game loop:', err);
      // Display visual error on loading screen if startup fails
      const statusEl = document.getElementById('loading-status');
      if (statusEl) {
        statusEl.innerText = 'BOOTSTRAP FAILED: ' + (err.message || err);
        statusEl.style.color = '#ff0055';
      }
    });
  } catch (error: any) {
    console.error('[Main] Critical error during bootstrap:', error);
    const statusEl = document.getElementById('loading-status');
    if (statusEl) {
      statusEl.innerText = 'CRITICAL ERROR: ' + (error.message || error);
      statusEl.style.color = '#ff0055';
    }
  }
}

// Safely execute bootstrap ensuring no DOMContentLoaded race condition
if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}
