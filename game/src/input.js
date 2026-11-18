// Keyboard and mouse: held keys, one-shot presses, and drag-to-orbit
// camera. Pointer lock is offered on click but never required.
export function createInput(G) {
  const held = new Set();
  const pressed = new Set();
  let mouseDown = false;
  let lastX = 0;
  let lastY = 0;
  let clickPoint = null;

  window.addEventListener('keydown', (event) => {
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) {
      event.preventDefault();
    }
    if (!event.repeat) pressed.add(event.code);
    held.add(event.code);
  });
  window.addEventListener('keyup', (event) => {
    held.delete(event.code);
  });
  window.addEventListener('blur', () => {
    held.clear();
  });

  const canvas = document.getElementById('game');
  canvas.addEventListener('pointerdown', (event) => {
    mouseDown = true;
    lastX = event.clientX;
    lastY = event.clientY;
    clickPoint = { x: event.clientX, y: event.clientY };
    canvas.requestPointerLock?.();
  });
  window.addEventListener('pointermove', (event) => {
    if (!mouseDown) return;
    const dx = event.clientX - lastX;
    const dy = event.clientY - lastY;
    lastX = event.clientX;
    lastY = event.clientY;
    G.camYaw -= dx * 0.004;
    G.player.camPitch = Math.max(0.05, Math.min(1.1, G.player.camPitch + dy * 0.003));
  });
  window.addEventListener('pointerup', () => {
    mouseDown = false;
  });

  return {
    held,
    wasPressed(code) {
      return pressed.has(code);
    },
    takeClick() {
      const point = clickPoint;
      clickPoint = null;
      return point;
    },
    clearPressed() {
      pressed.clear();
    },
    // Scripted input for the screenshot scenes and tests.
    press(code) {
      pressed.add(code);
      held.add(code);
    },
    release(code) {
      held.delete(code);
    },
    hold(code) {
      held.add(code);
    },
  };
}
