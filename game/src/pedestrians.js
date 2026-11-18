// Pedestrians: twenty-six people strolling the sidewalks, waiting at
// corners, and running scared from speeding cars, gunfire or a punch.
import * as THREE from 'three';
import { WORLD } from './config.js';
import { range, pick } from './random.js';

const SHIRT_COLORS = [0xc94f4f, 0x4f7fc9, 0x54a35a, 0xd8c34f, 0x8a5fc9, 0xe0e0e0, 0x333a44];

export function createPedestrians(G) {
  const rng = G.rng;
  const peds = [];
  for (let i = 0; i < WORLD.pedCount; i += 1) {
    const group = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.55, 0.9, 0.32),
      new THREE.MeshLambertMaterial({ color: pick(rng, SHIRT_COLORS) }),
    );
    body.position.y = 0.95;
    group.add(body);
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.24, 8, 6),
      new THREE.MeshLambertMaterial({ color: pick(rng, [0xd9a986, 0x8a5f3c, 0xe8c39a]) }),
    );
    head.position.y = 1.6;
    group.add(head);
    const legs = new THREE.Mesh(
      new THREE.BoxGeometry(0.45, 0.5, 0.28),
      new THREE.MeshLambertMaterial({ color: 0x2c2f36 }),
    );
    legs.position.y = 0.25;
    group.add(legs);
    const road = pick(rng, WORLD.roads);
    const along = range(rng, -120, 120);
    const side = rng() < 0.5 ? -1 : 1;
    const onXRoad = rng() < 0.5;
    const x = onXRoad ? along : road + side * (WORLD.halfRoad + WORLD.sidewalk / 2);
    const z = onXRoad ? road + side * (WORLD.halfRoad + WORLD.sidewalk / 2) : along;
    group.position.set(x, 0, z);
    G.scene.add(group);
    peds.push({
      group,
      pos: group.position,
      yaw: range(rng, 0, Math.PI * 2),
      speed: range(rng, 1.0, 1.8),
      wait: range(rng, 0, 4),
      fleeing: false,
      fleeX: 0,
      fleeZ: 0,
    });
  }

  function update(dt) {
    const playerPos = G.player.pos;
    const playerCar = G.player.car;
    const threatSpeed = playerCar ? Math.abs(playerCar.speed) : 0;
    for (const ped of peds) {
      // Flee a fast car, a gunshot or a punch nearby.
      const dx = ped.pos.x - playerPos.x;
      const dz = ped.pos.z - playerPos.z;
      const dist = Math.hypot(dx, dz);
      const scared = G.lastShotAt > G.time - 1.5
        || (playerCar && threatSpeed > 12 && dist < 12)
        || (G.lastPunchAt > G.time - 1.5 && dist < 6);
      if (scared && dist > 0.01) {
        ped.fleeing = true;
        ped.fleeX = dx / dist;
        ped.fleeZ = dz / dist;
      } else if (ped.fleeing && dist > 25) {
        ped.fleeing = false;
      }
      if (ped.fleeing) {
        ped.pos.x += ped.fleeX * 5 * dt;
        ped.pos.z += ped.fleeZ * 5 * dt;
        ped.yaw = Math.atan2(ped.fleeX, ped.fleeZ);
      } else if (ped.wait > 0) {
        ped.wait -= dt;
      } else {
        ped.pos.x += Math.sin(ped.yaw) * ped.speed * dt;
        ped.pos.z += Math.cos(ped.yaw) * ped.speed * dt;
        if (Math.abs(ped.pos.x) > WORLD.edge || Math.abs(ped.pos.z) > WORLD.edge || rng() < 0.002) {
          ped.yaw = range(rng, 0, Math.PI * 2);
          ped.wait = range(rng, 1, 5);
          ped.pos.x = Math.max(-WORLD.edge, Math.min(WORLD.edge, ped.pos.x));
          ped.pos.z = Math.max(-WORLD.edge, Math.min(WORLD.edge, ped.pos.z));
        }
      }
      ped.group.rotation.y = ped.yaw;
    }
  }

  return { peds, update };
}
