// Save / load — localStorage, one key, plain JSON. Money, missions done,
// packages collected, and where Vic is standing. Nothing else is secret.
export const SAVE_KEY = 'solmar-city.save.v1';

export function saveGame(state) {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(state));
    return true;
  } catch { return false; }
}

export function loadGame() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (typeof s !== 'object' || s === null) return null;
    return s;
  } catch { return null; }
}

export function hasSave() { return loadGame() !== null; }
