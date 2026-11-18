// Solmar City: the ground, the 6x6 road grid, low-poly buildings, palms,
// street lamps, the marina pier and boats, the beach and sea, the stunt
// ramp, and twenty drifting clouds. All placement comes from the seeded
// RNG, so one seed always builds the same city.
import * as THREE from 'three';
import { WORLD, PLACES } from './config.js';
import { range, pick } from './random.js';

const BUILDING_COLORS = [0x8f9bb0, 0xb0a08f, 0x7d8aa0, 0xa08f7d, 0x6f7f95, 0xc0b49a, 0x94a08a, 0xb08a7d];
const WINDOW_COLORS = [0xffe9a8, 0xbfe3ff, 0xfff2c8];

function box(w, h, d, color, x = 0, y = 0, z = 0) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshLambertMaterial({ color }),
  );
  mesh.position.set(x, y, z);
  return mesh;
}

function nearestRoad(value) {
  let best = WORLD.roads[0];
  for (const road of WORLD.roads) {
    if (Math.abs(road - value) < Math.abs(best - value)) best = road;
  }
  return best;
}

export function buildCity(G) {
  const rng = G.rng;
  const group = new THREE.Group();
  const colliders = [];
  const scene = G.scene;

  scene.background = new THREE.Color(0x8ec3e8);
  scene.fog = new THREE.Fog(0x9fc8e8, WORLD.fogNear, WORLD.fogFar);

  const hemi = new THREE.HemisphereLight(0xcfe8ff, 0x5a6b52, 0.95);
  const sun = new THREE.DirectionalLight(0xffe7b0, 1.5);
  sun.position.set(120, 180, 60);
  scene.add(hemi);
  scene.add(sun);

  // Ground slab, sand beach south of z=138, sea beyond it, marina water east of x=138.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(700, 700),
    new THREE.MeshLambertMaterial({ color: 0x6f8f5f }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, -0.05, 0);
  group.add(ground);

  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(700, 90),
    new THREE.MeshLambertMaterial({ color: 0xe8d49a }),
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(0, 0.0, 138 + 45);
  group.add(sand);

  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(700, 220),
    new THREE.MeshLambertMaterial({ color: 0x2e7fb8 }),
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(0, -0.15, 138 + 90 + 110);
  group.add(sea);

  const marinaWater = new THREE.Mesh(
    new THREE.PlaneGeometry(220, 700),
    new THREE.MeshLambertMaterial({ color: 0x2e7fb8 }),
  );
  marinaWater.rotation.x = -Math.PI / 2;
  marinaWater.position.set(138 + 110, -0.15, 0);
  group.add(marinaWater);

  // Roads: dark strips on the 6x6 grid, with lighter sidewalks each side.
  for (const road of WORLD.roads) {
    for (const [x, z, w, d] of [
      [road, 0, WORLD.halfRoad * 2, 280],
      [0, road, 280, WORLD.halfRoad * 2],
    ]) {
      const strip = new THREE.Mesh(
        new THREE.PlaneGeometry(w, d),
        new THREE.MeshLambertMaterial({ color: 0x3c4148 }),
      );
      strip.rotation.x = -Math.PI / 2;
      strip.position.set(x, 0.02, z);
      group.add(strip);
    }
    for (const side of [-1, 1]) {
      for (const [x, z, w, d] of [
        [road + side * (WORLD.halfRoad + WORLD.sidewalk / 2), 0, WORLD.sidewalk, 280],
        [0, road + side * (WORLD.halfRoad + WORLD.sidewalk / 2), 280, WORLD.sidewalk],
      ]) {
        const walk = new THREE.Mesh(
          new THREE.PlaneGeometry(w, d),
          new THREE.MeshLambertMaterial({ color: 0x9aa0a3 }),
        );
        walk.rotation.x = -Math.PI / 2;
        walk.position.set(x, 0.03, z);
        group.add(walk);
      }
    }
  }

  // Buildings fill the blocks between roads; taller in downtown.
  const blockCenters = [-88, -44, 0, 44, 88];
  for (const bx of blockCenters) {
    for (const bz of blockCenters) {
      const downtown = Math.abs(bx) < 44 && Math.abs(bz) < 44;
      const count = 1 + Math.floor(rng() * 2);
      for (let i = 0; i < count; i += 1) {
        const w = range(rng, 12, 24);
        const d = range(rng, 12, 24);
        const h = downtown ? range(rng, 22, 58) : range(rng, 8, 26);
        const x = bx + range(rng, -8, 8) + (count > 1 ? (i === 0 ? -9 : 9) : 0);
        const z = bz + range(rng, -8, 8);
        const color = pick(rng, BUILDING_COLORS);
        const building = box(w, h, d, color, x, h / 2, z);
        group.add(building);
        // Lit windows: small emissive planes on the south face.
        const winRows = Math.max(1, Math.floor(h / 6));
        for (let r = 0; r < winRows; r += 1) {
          for (let c = 0; c < Math.floor(w / 5); c += 1) {
            if (rng() < 0.45) continue;
            const win = new THREE.Mesh(
              new THREE.PlaneGeometry(1.6, 2.2),
              new THREE.MeshLambertMaterial({ color: pick(rng, WINDOW_COLORS), emissive: 0x554411 }),
            );
            win.position.set(x - w / 2 + 3 + c * 5, 3 + r * 6, z + d / 2 + 0.06);
            group.add(win);
          }
        }
        colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
      }
    }
  }

  // Palms along the roads and the beach.
  const palms = new THREE.Group();
  for (let i = 0; i < WORLD.palmCount; i += 1) {
    const road = pick(rng, WORLD.roads);
    const along = range(rng, -120, 120);
    const side = rng() < 0.5 ? -1 : 1;
    const x = rng() < 0.5 ? road + side * (WORLD.halfRoad + WORLD.sidewalk + 1.5) : along;
    const z = rng() < 0.5 ? along : road + side * (WORLD.halfRoad + WORLD.sidewalk + 1.5);
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.34, 6, 6),
      new THREE.MeshLambertMaterial({ color: 0x8a6a42 }),
    );
    trunk.position.set(x, 3, z);
    trunk.rotation.z = range(rng, -0.08, 0.08);
    palms.add(trunk);
    const top = new THREE.Mesh(
      new THREE.ConeGeometry(2.6, 3.2, 7),
      new THREE.MeshLambertMaterial({ color: 0x3f8f3a }),
    );
    top.position.set(x, 7.2, z);
    palms.add(top);
  }
  group.add(palms);

  // Street lamps at intersections.
  for (const rx of WORLD.roads) {
    for (const rz of WORLD.roads) {
      if (rng() < 0.4) continue;
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.12, 0.12, 7, 6),
        new THREE.MeshLambertMaterial({ color: 0x2c3138 }),
      );
      pole.position.set(rx + 7, 3.5, rz + 7);
      group.add(pole);
      const lamp = new THREE.Mesh(
        new THREE.SphereGeometry(0.45, 8, 6),
        new THREE.MeshLambertMaterial({ color: 0xffe9a8, emissive: 0x332a08 }),
      );
      lamp.position.set(rx + 7, 7.1, rz + 7);
      group.add(lamp);
    }
  }

  // Marina pier and boats east of x=138.
  const pier = box(60, 0.8, 8, 0x9a7b4f, 168, 0.4, 22);
  group.add(pier);
  for (let i = 0; i < 5; i += 1) {
    const bx = 150 + i * 9;
    const bz = 22 + (i % 2 === 0 ? -9 : 9);
    const hull = box(7, 1.6, 2.6, pick(rng, [0xffffff, 0xd8232a, 0x3a6fd8, 0xf2c230]), bx, 0.6, bz);
    group.add(hull);
    const mast = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.08, 6, 5),
      new THREE.MeshLambertMaterial({ color: 0xdddddd }),
    );
    mast.position.set(bx, 4, bz);
    group.add(mast);
  }

  // Orange stunt ramp near the beach road.
  const ramp = box(10, 1, 6, 0xe8722a, -22, 1.2, 96);
  ramp.rotation.x = -0.35;
  group.add(ramp);

  // Twenty cloud clusters, flat warm-white boxes, 45-70 m up.
  const clouds = new THREE.Group();
  for (let i = 0; i < WORLD.cloudCount; i += 1) {
    const cluster = new THREE.Group();
    const puffs = 2 + Math.floor(rng() * 3);
    for (let p = 0; p < puffs; p += 1) {
      const puff = box(
        range(rng, 10, 22),
        range(rng, 2, 3.5),
        range(rng, 8, 14),
        0xfdf6e8,
        range(rng, -8, 8),
        0,
        range(rng, -5, 5),
      );
      cluster.add(puff);
    }
    cluster.position.set(range(rng, -200, 200), range(rng, 45, 70), range(rng, -200, 200));
    clouds.add(cluster);
  }
  group.add(clouds);

  // Named places; the hideout is snapped to its nearest road so it is reachable.
  const places = {
    spawn: { ...PLACES.spawn },
    hideout: { x: nearestRoad(PLACES.hideout.x), z: nearestRoad(PLACES.hideout.z) },
    marinaGate: { ...PLACES.marinaGate },
    northTower: { ...PLACES.northTower },
    beach: { ...PLACES.beach },
  };

  // Hideout shack: a small hut marking the spot.
  const hut = box(6, 4, 5, 0x7a4a3a, places.hideout.x, 2, places.hideout.z);
  group.add(hut);
  const hutRoof = box(7, 0.6, 6, 0x5a362a, places.hideout.x, 4.3, places.hideout.z);
  group.add(hutRoof);

  // North tower: a tall landmark.
  const tower = box(10, 46, 10, 0x5a6b80, places.northTower.x, 23, places.northTower.z);
  group.add(tower);
  const towerTop = box(12, 2, 12, 0x3a4a60, places.northTower.x, 47, places.northTower.z);
  group.add(towerTop);
  colliders.push({
    minX: places.northTower.x - 5, maxX: places.northTower.x + 5,
    minZ: places.northTower.z - 5, maxZ: places.northTower.z + 5,
  });

  scene.add(group);
  G.cityGroup = group;

  function setSunset(on) {
    if (on) {
      scene.background.set(0xe88a4a);
      scene.fog.color.set(0xe89a5a);
      sun.color.set(0xffb060);
      sun.position.set(-140, 60, 120);
      hemi.intensity = 0.55;
      sun.intensity = 1.1;
    } else {
      scene.background.set(0x8ec3e8);
      scene.fog.color.set(0x9fc8e8);
      sun.color.set(0xffe7b0);
      sun.position.set(120, 180, 60);
      hemi.intensity = 0.95;
      sun.intensity = 1.5;
    }
  }

  // Push a circle (player or car) out of every building it overlaps.
  function collideCircle(pos, radius) {
    let hit = false;
    for (const c of colliders) {
      const cx = Math.max(c.minX, Math.min(pos.x, c.maxX));
      const cz = Math.max(c.minZ, Math.min(pos.z, c.maxZ));
      const dx = pos.x - cx;
      const dz = pos.z - cz;
      const distSq = dx * dx + dz * dz;
      if (distSq < radius * radius) {
        hit = true;
        if (distSq > 0.0001) {
          const dist = Math.sqrt(distSq);
          pos.x = cx + (dx / dist) * radius;
          pos.z = cz + (dz / dist) * radius;
        } else {
          pos.x = c.maxX + radius;
        }
      }
    }
    // City edge: keep everything inside the playable bounds.
    if (pos.x < -WORLD.edge) pos.x = -WORLD.edge;
    if (pos.x > 175) pos.x = 175;
    if (pos.z < -WORLD.edge) pos.z = -WORLD.edge;
    if (pos.z > 175) pos.z = 175;
    return hit;
  }

  return { colliders, places, clouds, setSunset, collideCircle, sun, hemi };
}
