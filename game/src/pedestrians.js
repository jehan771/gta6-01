// Pedestrians — sidewalk walkers who stroll the blocks, wait at corners, and
// flee from chaos (a speeding car, a gunshot, a punch). A fleeing crowd is
// what makes a rampage feel like one, and it feeds the wanted system.
import * as THREE from 'three';
import { CFG } from './config.js';
import { pick, range } from './random.js';
import { roadCoords, nearestRoad } from './city.js';

const SHIRTS = [0xd94f4f, 0x4f7ad9, 0x4fd97a, 0xd9c24f, 0x9b4fd9, 0xe8e8e8, 0x333333, 0xe08a4f];

export function createPedestrians(scene, rng) {
  const roads = roadCoords();
  const group = new THREE.Group();
  scene.add(group);
  const peds = [];

  function makeMesh(shirt) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.8, 0.35), new THREE.MeshLambertMaterial({ color: shirt }));
    body.position.y = 1.05; g.add(body);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.36, 0.36), new THREE.MeshLambertMaterial({ color: pick(rng, [0xc9976b, 0x8a5a3b, 0xe8b98a, 0x6b4a2f]) }));
    head.position.y = 1.65; g.add(head);
    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.65, 0.22), new THREE.MeshLambertMaterial({ color: 0x2b3a55 }));
    legL.position.set(-0.14, 0.33, 0); g.add(legL);
    const legR = legL.clone(); legR.position.x = 0.14; g.add(legR);
    g.userData = { legL, legR };
    group.add(g);
    return g;
  }

  function randomSidewalkSpot() {
    const road = pick(rng, roads);
    const along = range(rng, -CFG.cityHalf, CFG.cityHalf);
    const side = rng() < 0.5 ? -1 : 1;
    if (rng() < 0.5) return { x: along, z: road + side * (CFG.roadHalf + CFG.sidewalk / 2 + 0.3) };
    return { x: road + side * (CFG.roadHalf + CFG.sidewalk / 2 + 0.3), z: along };
  }

  function spawn(x, z) {
    const s = x === undefined ? randomSidewalkSpot() : { x, z };
    const mesh = makeMesh(pick(rng, SHIRTS));
    mesh.position.set(s.x, 0, s.z);
    const p = {
      mesh, x: s.x, z: s.z, heading: range(rng, 0, Math.PI * 2),
      speed: range(rng, 1.1, 1.9), phase: range(rng, 0, 6),
      flee: 0, fleeX: 0, fleeZ: 0, wait: range(rng, 0, 4), alive: true,
      taxi: false, // waiting for a cab (taxi side job)
    };
    peds.push(p);
    return p;
  }
  for (let i = 0; i < CFG.pedestrians; i++) spawn();

  // One pedestrian waits at a corner with a taxi flag; the taxi job uses them.
  const taxiPed = spawn(-20, 20);
  taxiPed.taxi = true;

  return {
    peds,
    spawn,
    // `danger` = {x,z,radius} from gunshots / speeding cars; peds inside flee.
    step(dt, danger) {
      for (const p of peds) {
        if (!p.alive) continue;
        if (danger) {
          const d2 = (p.x - danger.x) ** 2 + (p.z - danger.z) ** 2;
          if (d2 < danger.radius * danger.radius && p.flee <= 0) {
            p.flee = range(Math.random, 2, 4);
            const away = Math.atan2(p.x - danger.x, p.z - danger.z);
            p.fleeX = Math.sin(away); p.fleeZ = Math.cos(away);
          }
        }
        if (p.flee > 0) {
          p.flee -= dt;
          p.x += p.fleeX * 5.2 * dt; p.z += p.fleeZ * 5.2 * dt;
          p.heading = Math.atan2(p.fleeX, p.fleeZ);
        } else if (p.wait > 0) {
          p.wait -= dt;
        } else {
          // Stroll along the sidewalk: keep to the nearest road's edge.
          const rx = nearestRoad(p.x), rz = nearestRoad(p.z);
          const alongX = Math.abs(p.z - rz) > Math.abs(p.x - rx);
          if (alongX) {
            p.z += Math.sin(p.heading) * 0 * dt; // heading is along x
            p.x += Math.cos(p.heading) * p.speed * dt;
            // Keep the z on the sidewalk band.
            p.z += (rz + (CFG.roadHalf + CFG.sidewalk / 2) * Math.sign(p.z - rz || 1) - p.z) * dt * 2;
            if (Math.abs(p.x) > CFG.cityHalf) { p.heading = Math.PI - p.heading; p.x = Math.max(-CFG.cityHalf, Math.min(CFG.cityHalf, p.x)); }
          } else {
            p.z += Math.cos(p.heading) * p.speed * dt;
            p.x += (rx + (CFG.roadHalf + CFG.sidewalk / 2) * Math.sign(p.x - rx || 1) - p.x) * dt * 2;
            if (Math.abs(p.z) > CFG.cityHalf) { p.heading = Math.PI - p.heading; p.z = Math.max(-CFG.cityHalf, Math.min(CFG.cityHalf, p.z)); }
          }
          p.heading += (Math.random() - 0.5) * dt * 0.4;
          if (Math.random() < dt * 0.02) p.wait = range(Math.random, 1, 5);
        }
        p.x = Math.max(-CFG.cityHalf - 10, Math.min(CFG.marinaX, p.x));
        p.z = Math.max(-CFG.cityHalf - 10, Math.min(CFG.beachZ + 20, p.z));
        p.phase += dt * (p.flee > 0 ? 11 : 5);
        const swing = Math.sin(p.phase) * 0.45;
        p.mesh.userData.legL.rotation.x = swing;
        p.mesh.userData.legR.rotation.x = -swing;
        p.mesh.position.set(p.x, 0, p.z);
        p.mesh.rotation.y = p.heading;
      }
    },
    // A car hitting a pedestrian: they are knocked down and stay down briefly.
    hitByCar(px, pz, radius) {
      let hitAny = false;
      for (const p of peds) {
        if (!p.alive) continue;
        const d2 = (p.x - px) ** 2 + (p.z - pz) ** 2;
        if (d2 < radius * radius) {
          p.alive = false;
          p.mesh.visible = false;
          hitAny = true;
          // They get back up after a while, further away.
          setTimeout(() => {
            const s = randomSidewalkSpot();
            p.x = s.x; p.z = s.z; p.alive = true; p.mesh.visible = true;
            p.mesh.position.set(s.x, 0, s.z);
          }, 20000);
        }
      }
      return hitAny;
    },
  };
}
