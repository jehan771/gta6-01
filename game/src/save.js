// Autosave: one localStorage key holding money, missions done, packages
// found and Vic's position. Saved every 20 seconds while playing, on
// pause, and when the tab hides.
import { SAVE_KEY, AUTOSAVE_SECONDS } from './config.js';

export function createSave(G) {
  function saveGame() {
    try {
      const data = {
        money: G.money,
        missionIndex: G.missionIndex,
        packagesGot: G.packagesGot,
        x: G.player.pos.x,
        z: G.player.pos.z,
      };
      window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    } catch { /* storage can be off; the game still plays */ }
  }

  function loadGame() {
    try {
      const raw = window.localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  function hasSave() {
    return loadGame() !== null;
  }

  function applySave(data) {
    if (!data) return false;
    G.money = data.money || 0;
    G.missionIndex = data.missionIndex || 0;
    G.packagesGot = data.packagesGot || 0;
    if (typeof data.x === 'number' && typeof data.z === 'number') {
      G.player.pos.set(data.x, 0, data.z);
    }
    return true;
  }

  let timer = 0;
  function update(dt) {
    timer += dt;
    if (timer >= AUTOSAVE_SECONDS) {
      timer = 0;
      if (G.mode === 'playing') saveGame();
    }
  }

  return { saveGame, loadGame, hasSave, applySave, update };
}
