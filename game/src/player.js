// Vic Marino on foot — third-person movement, sprint, jump, punch, and the
// chase camera that orbits with the mouse. The camera is the player's view of
// the city, so it stays smooth: it lerps behind the heading, never snaps.
import * as THREE from 'three';
import { CFG } from './config.js';
import { clamp } from './random.js';
import { collideCircle } from './city.js';

export function createPlayer(scene) {
  const group = new THREE.Group();
  const jacket = new THREE.MeshLambertMaterial({ color: 0x7a2e2e });
  const jeans = new THREE.MeshLambertMaterial({ color: 0x2b3a55 });
  const skin = new THREE.MeshLambertMaterial({ color: 0xc9976b });
  const hair = new THREE.MeshLambertMaterial({ color: 0x1c1410 });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.85, 0.42), jacket);
  torso.position.y = 1.15; group.add(torso);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.42), skin);
  head.position.y = 1.8; group.add(head);
  const hairM = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.16, 0.46), hair);
  hairM.position.y = 2.02; group.add(hairM);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.75, 0.3), jeans);
  legL.position.set(-0.18, 0.38, 0); group.add(legL);
  const legR = legL.clone(); legR.position.x = 0.18; group.add(legR);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.7, 0.24), jacket);
  armL.position.set(-0.5, 1.15, 0); group.add(armL);
  const armR = armL.clone(); armR.position.x = 0.5; group.add(armR);
  // Pistol in the right hand when armed (hidden otherwise).
  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.14, 0.42), new THREE.MeshLambertMaterial({ color: 0x111111 }));
  gun.position.set(0.5, 0.85, 0.25); gun.visible = false; group.add(gun);
  scene.add(group);
  return {
    mesh: group, legL, legR, armL, armR, gun,
    x: 0, z: 0, y: 0, vy: 0, heading: 0, camYaw: 0, camPitch: 0.32,
    speed: 0, moving: false, walkPhase: 0, punchTimer: 0, grounded: true,
  };
}

export function stepPlayer(p, input, dt, colliders, camYawRef) {
  const m = input.consumeMouse();
  p.camYaw -= m.dx * 0.0042;
  p.camPitch = clamp(p.camPitch + m.dy * 0.003, 0.05, 1.1);
  const ax = input.axis();
  const sprint = input.held('ShiftLeft') || input.held('ShiftRight');
  const top = sprint ? CFG.runSpeed : CFG.walkSpeed;
  // Movement is relative to the camera yaw. Forward is (sin, cos); right is
  // (-cos, sin) — facing south, right is west, as on the screen.
  const sin = Math.sin(p.camYaw), cos = Math.cos(p.camYaw);
  let mx = sin * ax.f - cos * ax.r;
  let mz = cos * ax.f + sin * ax.r;
  const ml = Math.hypot(mx, mz);
  p.moving = ml > 0.01;
  if (p.moving) {
    mx /= ml; mz /= ml;
    const target = Math.atan2(mx, mz);
    let d = target - p.heading;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    p.heading += clamp(d, -dt * 10, dt * 10);
    p.speed += (top - p.speed) * Math.min(1, dt * 10);
  } else {
    p.speed += (0 - p.speed) * Math.min(1, dt * 12);
  }
  let nx = p.x + Math.sin(p.heading) * p.speed * dt;
  let nz = p.z + Math.cos(p.heading) * p.speed * dt;
  const hit = collideCircle(colliders, nx, nz, 0.55);
  if (hit.hit) { nx = hit.x; nz = hit.z; }
  nx = clamp(nx, -CFG.cityHalf - 30, CFG.marinaX + 18);
  nz = clamp(nz, -CFG.cityHalf - 30, CFG.beachZ + 30);
  p.x = nx; p.z = nz;

  // Jump + gravity.
  if (input.wasPressed('Space') && p.grounded) { p.vy = CFG.jumpSpeed; p.grounded = false; }
  if (!p.grounded) {
    p.vy -= CFG.gravity * dt;
    p.y += p.vy * dt;
    if (p.y <= 0) { p.y = 0; p.vy = 0; p.grounded = true; }
  }
  if (p.punchTimer > 0) p.punchTimer -= dt;

  // Walk-cycle swing, faster when sprinting.
  p.walkPhase += dt * p.speed * 1.6;
  const swing = p.moving ? Math.sin(p.walkPhase) * 0.55 : 0;
  p.legL.rotation.x = swing; p.legR.rotation.x = -swing;
  p.armL.rotation.x = -swing * 0.8; p.armR.rotation.x = swing * 0.8;
  if (p.punchTimer > 0) { p.armR.rotation.x = -1.6; }

  p.mesh.position.set(p.x, p.y, p.z);
  p.mesh.rotation.y = p.heading;
  camYawRef.value = p.camYaw;
  return p;
}

// Chase camera: behind and above the player, pulled in when a building is in the way.
export function updateCamera(camera, p, car, dt) {
  const target = car || null;
  let cx, cy, cz, lx, ly, lz;
  if (target) {
    const back = 9.5 + Math.abs(target.speed) * 0.12;
    const hx = Math.sin(target.heading), hz = Math.cos(target.heading);
    cx = target.x - hx * back; cz = target.z - hz * back; cy = 4.2;
    lx = target.x + hx * 6; ly = 1.2; lz = target.z + hz * 6;
  } else {
    const d = 7.5, h = 2.6 + p.camPitch * 3.4;
    cx = p.x - Math.sin(p.camYaw) * d; cz = p.z - Math.cos(p.camYaw) * d; cy = p.y + h;
    lx = p.x; ly = p.y + 1.5; lz = p.z;
  }
  const k = 1 - Math.exp(-dt * 10);
  camera.position.x += (cx - camera.position.x) * k;
  camera.position.y += (cy - camera.position.y) * k;
  camera.position.z += (cz - camera.position.z) * k;
  camera.lookAt(lx, ly, lz);
}
