// Keyboard + mouse input. Tracks held keys, edge-triggered presses, and the
// mouse-drag orbit used for the third-person camera. Pointer lock is offered
// on click but the game never depends on it (drag works everywhere, including
// headless screenshots).
export function createInput(canvas) {
  const keys = new Set();
  const pressed = new Set();   // edge-triggered: consumed once per frame
  let mouseDX = 0, mouseDY = 0;
  let dragging = false;
  let lastX = 0, lastY = 0;
  let mouseDown = false;
  let mouseDownPos = { x: 0, y: 0 };
  let clicked = false;
  let clickPos = null;   // client coords of the last click, for aiming
  let mousePos = { x: 0, y: 0 };

  window.addEventListener('keydown', (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab'].includes(e.code)) e.preventDefault();
    if (!e.repeat) pressed.add(e.code);
    keys.add(e.code);
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => { keys.clear(); dragging = false; });

  canvas.addEventListener('mousedown', (e) => {
    mouseDown = true; dragging = true; lastX = e.clientX; lastY = e.clientY;
    mouseDownPos = { x: e.clientX, y: e.clientY };
  });
  window.addEventListener('mouseup', (e) => {
    mouseDown = false; dragging = false;
    if (Math.hypot(e.clientX - mouseDownPos.x, e.clientY - mouseDownPos.y) < 6) {
      clicked = true;
      clickPos = { x: e.clientX, y: e.clientY };
    }
  });
  window.addEventListener('mousemove', (e) => {
    mousePos = { x: e.clientX, y: e.clientY };
    if (!dragging) return;
    mouseDX += e.clientX - lastX;
    mouseDY += e.clientY - lastY;
    lastX = e.clientX; lastY = e.clientY;
  });
  canvas.addEventListener('click', () => {
    if (document.pointerLockElement !== canvas) {
      try { canvas.requestPointerLock(); } catch { /* drag still works */ }
    }
  });
  document.addEventListener('mousemove', (e) => {
    if (document.pointerLockElement === canvas) { mouseDX += e.movementX; mouseDY += e.movementY; }
  });

  return {
    held(c) { return keys.has(c); },
    // WASD + arrows unified
    axis() {
      const f = (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0);
      const r = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0);
      return { f, r };
    },
    wasPressed(c) { return pressed.has(c); },
    consumeMouse() { const d = { dx: mouseDX, dy: mouseDY }; mouseDX = 0; mouseDY = 0; return d; },
    consumeClick() { const c = clicked; clicked = false; return c; },
    // Client coords of the last click (for aiming the pistol), or null.
    consumeClickPos() { const p = clickPos; clickPos = null; return p; },
    mousePos() { return mousePos; },
    mouseIsDown() { return mouseDown; },
    endFrame() { pressed.clear(); },
    // Test hooks: let the play-test driver inject keys without a real keyboard.
    _testDown(c) { if (!keys.has(c)) pressed.add(c); keys.add(c); },
    _testUp(c) { keys.delete(c); },
  };
}
