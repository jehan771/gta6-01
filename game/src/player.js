// Vic Marino on foot: third-person movement, running, jumping and punching,
// with a smooth chase camera that settles behind him.
import * as THREE from 'three';
import { WALK } from './config.js';
import { clamp } from './random.js';

export function createPlayer(G) {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: 0x2e6f8e });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.0, 0.4), bodyMat);
  body.position.y = 1.05;
  group.add(body);
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.28, 10, 8),
    new THREE.MeshLambertMaterial({ color: 0xd9a986 }),
  );
  head.position.y = 1.78;
  group.add(head);
  const legs = new THREE.Mesh(
    new THREE.BoxGeometry(0.6, 0.55, 0.35),
    new THREE.MeshLambertMaterial({ color: 0x2c2f36 }),
  );
  legs.position.y = 0.28;
  group.add(legs);
  G.scene.add(group);

  const player = {
    group,
    pos: group.position,
    velY: 0,
    grounded: true,
    yaw: 0,
    health: 100,
    onFoot: true,
    car: null,
    weapon: 'fists',
    ammo: 12,
    camYaw: 0,
    camPitch: 0.32,
    moving: false,
  };
  player.pos.set(G.city.places.spawn.x, 0, G.city.places.spawn.z);
  return player;
}

// Move on foot. `move` is {x, z} in camera space, already normalised.
export function updatePlayer(G, dt, move, jump, running) {
  const p = G.player;
  if (!p.onFoot) return;
  const speed = running ? WALK.run : WALK.speed;
  const yaw = G.camYaw;
  // Camera forward is (sin yaw, cos yaw); screen-right is (-cos yaw, sin yaw).
  const fx = Math.sin(yaw);
  const fz = Math.cos(yaw);
  const rx = -Math.cos(yaw);
  const rz = Math.sin(yaw);
  const vx = (fx * move.z + rx * move.x) * speed;
  const vz = (fz * move.z + rz * move.x) * speed;
  p.moving = move.x !== 0 || move.z !== 0;
  if (p.moving) {
    p.yaw = Math.atan2(vx, vz);
    p.group.rotation.y = p.yaw;
  }
  p.pos.x += vx * dt;
  p.pos.z += vz * dt;
  G.city.collideCircle(p.pos, 0.5);

  if (jump && p.grounded) {
    p.velY = WALK.jump;
    p.grounded = false;
  }
  if (!p.grounded) {
    p.velY -= WALK.gravity * dt;
    p.pos.y += p.velY * dt;
    if (p.pos.y <= 0) {
      p.pos.y = 0;
      p.velY = 0;
      p.grounded = true;
    }
  }
  // Gentle health recovery when out of trouble.
  if (G.time - G.lastDamageAt > 5 && p.health < 100) {
    p.health = Math.min(100, p.health + 2 * dt);
  }
  p.health = clamp(p.health, 0, 100);
}
