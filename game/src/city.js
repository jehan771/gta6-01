// Solmar City — builds the whole 3D city from a seed: ground, road grid, blocks
// of low-poly buildings, beach, marina, palms, lamps and stunt ramps.
// Exports the colliders (building AABBs) and the named places missions use.
import * as THREE from 'three';
import { CFG } from './config.js';
import { makeRng, pick, range } from './random.js';

export function roadCoords() {
  const out = [];
  const half = (CFG.roadCount - 1) / 2;
  for (let i = 0; i < CFG.roadCount; i++) out.push((i - half) * CFG.roadSpacing);
  return out;
}
export function nearestRoad(v) {
  let best = roadCoords()[0];
  for (const r of roadCoords()) if (Math.abs(v - r) < Math.abs(v - best)) best = r;
  return best;
}

// A window texture drawn once on a canvas, reused by many buildings.
function facadeTexture(rng, base, litRatio) {
  const c = document.createElement('canvas'); c.width = 128; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = base; g.fillRect(0, 0, 128, 256);
  const cols = 4, rows = 10;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const lit = rng() < litRatio;
      g.fillStyle = lit ? '#ffd98a' : (rng() < 0.5 ? '#2c3e50' : '#1d2b38');
      g.fillRect(8 + x * 30, 10 + y * 24, 20, 14);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function roadTexture() {
  const c = document.createElement('canvas'); c.width = 128; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#33363b'; g.fillRect(0, 0, 128, 128);
  g.fillStyle = '#f5c542'; g.fillRect(62, 0, 4, 128);          // centre line
  g.fillStyle = '#e8e8e8';
  for (let y = 0; y < 128; y += 32) { g.fillRect(6, y, 3, 16); g.fillRect(119, y, 3, 16); }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function buildCity(scene, seed) {
  const rng = makeRng(seed);
  const group = new THREE.Group();
  scene.add(group);
  const colliders = [];   // {minX,maxX,minZ,maxZ}
  const roads = roadCoords();
  const R = CFG.roadHalf + CFG.sidewalk;

  // --- ground: one big slab, then beach sand and marina water on top ---
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(560, 560),
    new THREE.MeshLambertMaterial({ color: 0x6f7f5e }),
  );
  ground.rotation.x = -Math.PI / 2; ground.position.y = -0.05; group.add(ground);

  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(560, 60),
    new THREE.MeshLambertMaterial({ color: 0xe6cf9e }),
  );
  sand.rotation.x = -Math.PI / 2; sand.position.set(0, 0.01, CFG.beachZ + 30); group.add(sand);

  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(120, 560),
    new THREE.MeshLambertMaterial({ color: 0x2e6f8e }),
  );
  water.rotation.x = -Math.PI / 2; water.position.set(CFG.marinaX + 60, 0.02, 0); group.add(water);
  const water2 = new THREE.Mesh(
    new THREE.PlaneGeometry(560, 60),
    new THREE.MeshLambertMaterial({ color: 0x2e6f8e }),
  );
  water2.rotation.x = -Math.PI / 2; water2.position.set(0, 0.02, CFG.beachZ + 90); group.add(water2);

  // --- roads: dark strips with lane markings, both directions ---
  const rTex = roadTexture();
  const roadMat = new THREE.MeshLambertMaterial({ map: rTex });
  const roadLen = CFG.cityHalf * 2 + 24;
  for (const r of roads) {
    const mk = (w, l, x, z, ry) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, l), roadMat.clone());
      m.material.map = rTex.clone(); m.material.map.needsUpdate = true;
      m.material.map.repeat.set(w / 10, l / 10);
      m.rotation.x = -Math.PI / 2; m.rotation.z = ry;
      m.position.set(x, 0.03, z); group.add(m);
    };
    mk(CFG.roadHalf * 2, roadLen, r, 0, 0);                 // north-south
    mk(CFG.roadHalf * 2, roadLen, 0, r, Math.PI / 2);       // east-west
  }
  // Sidewalk strips along every road
  const walkMat = new THREE.MeshLambertMaterial({ color: 0x9a9a92 });
  for (const r of roads) {
    for (const s of [-1, 1]) {
      const a = new THREE.Mesh(new THREE.PlaneGeometry(CFG.sidewalk, roadLen), walkMat);
      a.rotation.x = -Math.PI / 2; a.position.set(r + s * (CFG.roadHalf + CFG.sidewalk / 2), 0.04, 0); group.add(a);
      const b = new THREE.Mesh(new THREE.PlaneGeometry(roadLen, CFG.sidewalk), walkMat);
      b.rotation.x = -Math.PI / 2; b.position.set(0, 0.04, r + s * (CFG.roadHalf + CFG.sidewalk / 2)); group.add(b);
    }
  }

  // --- buildings: one or two boxes per block, downtown taller ---
  const palette = ['#c9b18c', '#a8b6c4', '#d8c1a3', '#b7a6a0', '#8fa3b0', '#c4a484', '#e0d5c1'];
  const facades = palette.map((p) => facadeTexture(rng, p, 0.35));
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const roofMat = new THREE.MeshLambertMaterial({ color: 0x5a5a55 });
  for (let ix = 0; ix < roads.length - 1; ix++) {
    for (let iz = 0; iz < roads.length - 1; iz++) {
      const cx = (roads[ix] + roads[ix + 1]) / 2;
      const cz = (roads[iz] + roads[iz + 1]) / 2;
      const downtown = Math.abs(cx) < 50 && Math.abs(cz) < 50;
      const count = downtown ? (rng() < 0.5 ? 2 : 1) : 1;
      for (let k = 0; k < count; k++) {
        const w = range(rng, 12, 20), d = range(rng, 12, 20);
        const h = downtown ? range(rng, 22, 58) : range(rng, 8, 22);
        const ox = count === 2 ? (k === 0 ? -8 : 8) : 0;
        const oz = count === 2 ? (k === 0 ? 6 : -6) : 0;
        const mat = new THREE.MeshLambertMaterial({ map: pick(rng, facades) });
        const b = new THREE.Mesh(boxGeo, mat);
        b.scale.set(w, h, d);
        b.position.set(cx + ox, h / 2, cz + oz);
        group.add(b);
        const roof = new THREE.Mesh(boxGeo, roofMat);
        roof.scale.set(w + 0.4, 0.5, d + 0.4); roof.position.set(cx + ox, h + 0.25, cz + oz);
        group.add(roof);
        colliders.push({ minX: cx + ox - w / 2, maxX: cx + ox + w / 2, minZ: cz + oz - d / 2, maxZ: cz + oz + d / 2 });
      }
    }
  }

  // --- palms along the beach boulevard + scattered in blocks ---
  const trunkGeo = new THREE.CylinderGeometry(0.22, 0.35, 5, 6);
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x8a6b48 });
  const leafGeo = new THREE.ConeGeometry(2.2, 2.6, 6);
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x3f8f4f });
  const palms = new THREE.InstancedMesh(trunkGeo, trunkMat, 90);
  const leaves = new THREE.InstancedMesh(leafGeo, leafMat, 90);
  const dummy = new THREE.Object3D();
  let pi = 0;
  const palmSpots = [];
  for (let x = -130; x <= 130; x += 14) palmSpots.push([x, CFG.beachZ - 6]);
  for (let i = 0; i < 40; i++) {
    const bx = pick(rng, roads.slice(0, -1)) + 22;
    const bz = pick(rng, roads.slice(0, -1)) + 22;
    palmSpots.push([bx + range(rng, -8, 8), bz + range(rng, -8, 8)]);
  }
  for (const [x, z] of palmSpots) {
    if (pi >= 90) break;
    dummy.position.set(x, 2.5, z); dummy.rotation.set(0, rng() * 6.28, 0); dummy.updateMatrix();
    palms.setMatrixAt(pi, dummy.matrix);
    dummy.position.set(x, 5.6, z); dummy.updateMatrix();
    leaves.setMatrixAt(pi, dummy.matrix);
    pi++;
  }
  palms.count = pi; leaves.count = pi;
  group.add(palms); group.add(leaves);

  // --- street lamps along roads ---
  const lampGeo = new THREE.CylinderGeometry(0.09, 0.09, 6, 5);
  const lampMat = new THREE.MeshLambertMaterial({ color: 0x2f3336 });
  const lampBulb = new THREE.SphereGeometry(0.35, 8, 6);
  const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
  const lamps = new THREE.InstancedMesh(lampGeo, lampMat, 120);
  const bulbs = new THREE.InstancedMesh(lampBulb, bulbMat, 120);
  let li = 0;
  for (const r of roads) {
    for (let v = -120; v <= 120; v += 44) {
      if (li >= 120) break;
      dummy.position.set(r + CFG.roadHalf + CFG.sidewalk + 0.4, 3, v); dummy.rotation.set(0, 0, 0); dummy.updateMatrix();
      lamps.setMatrixAt(li, dummy.matrix);
      dummy.position.set(r + CFG.roadHalf + CFG.sidewalk + 0.4, 6.1, v); dummy.updateMatrix();
      bulbs.setMatrixAt(li, dummy.matrix);
      li++;
    }
  }
  lamps.count = li; bulbs.count = li;
  group.add(lamps); group.add(bulbs);

  // --- marina docks + boats ---
  const dockMat = new THREE.MeshLambertMaterial({ color: 0x7a5c3e });
  for (let z = -90; z <= 90; z += 30) {
    const dock = new THREE.Mesh(new THREE.BoxGeometry(18, 0.6, 4), dockMat);
    dock.position.set(CFG.marinaX + 9, 0.3, z); group.add(dock);
    const boat = new THREE.Group();
    const hull = new THREE.Mesh(new THREE.BoxGeometry(7, 1.2, 2.6), new THREE.MeshLambertMaterial({ color: pick(rng, [0xffffff, 0x3366aa, 0xcc3333]) }));
    hull.position.y = 0.6; boat.add(hull);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(3, 1.2, 2), new THREE.MeshLambertMaterial({ color: 0xeeeeee }));
    cabin.position.set(-0.5, 1.7, 0); boat.add(cabin);
    boat.position.set(CFG.marinaX + 20, 0, z + 6); boat.rotation.y = rng() * 0.4 - 0.2;
    group.add(boat);
  }

  // --- stunt ramps: wedges on straight roads ---
  const rampMat = new THREE.MeshLambertMaterial({ color: 0xd86f2a });
  const ramps = [
    { x: 22, z: -66, dir: 0 }, { x: -66, z: 22, dir: Math.PI / 2 }, { x: 66, z: 110, dir: Math.PI },
  ];
  const rampMeshes = [];
  for (const r of ramps) {
    const wedge = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.4, 3.2, 3, 1), rampMat);
    wedge.rotation.y = r.dir; wedge.scale.set(1, 1, 1);
    wedge.position.set(r.x, 0.9, r.z);
    wedge.rotation.z = Math.PI / 2; // lay the wedge as a ramp lip
    group.add(wedge);
    rampMeshes.push({ x: r.x, z: r.z, r: 3 });
  }

  // Named places missions and spawns use.
  const places = {
    hideout: { x: -88, z: -88, label: 'Hideout — Palm Row' },
    marinaGate: { x: 128, z: 22, label: 'Marina Gate' },
    northTower: { x: 22, z: -110, label: 'North Tower' },
    downtown: { x: 0, z: 0, label: 'Downtown' },
    beach: { x: 0, z: 150, label: 'Solmar Beach' },
    marina: { x: 150, z: 22, label: 'Marina' },
    spawn: { x: -22, z: 44, label: 'Vic\'s apartment' },
  };

  return { group, colliders, places, ramps: rampMeshes, roads };
}

// Move a point out of any building it sits inside, keeping it as close to
// the original as possible: first snap one axis to the nearest road, then
// the other, then both (a road intersection is always clear).
export function clearSpot(colliders, x, z) {
  const inside = (px, pz) => colliders.some((c) =>
    px > c.minX - 2.5 && px < c.maxX + 2.5 && pz > c.minZ - 2.5 && pz < c.maxZ + 2.5);
  if (!inside(x, z)) return { x, z };
  const rx = nearestRoad(x), rz = nearestRoad(z);
  if (!inside(rx, z)) return { x: rx, z };
  if (!inside(x, rz)) return { x, z: rz };
  return { x: rx, z: rz };
}

// Circle (x,z,r) vs building AABBs: push the circle out. Returns the
// corrected position plus the push vector (nx, nz) — the direction out of
// the building — so callers can slide along the wall instead of grinding.
export function collideCircle(colliders, x, z, r) {
  let hit = false;
  for (const c of colliders) {
    const nx = Math.max(c.minX, Math.min(x, c.maxX));
    const nz = Math.max(c.minZ, Math.min(z, c.maxZ));
    const dx = x - nx, dz = z - nz;
    const d2 = dx * dx + dz * dz;
    if (d2 < r * r) {
      hit = true;
      if (d2 > 1e-6) {
        const d = Math.sqrt(d2);
        const push = (r - d) / d;
        const ox = x + dx * push, oz = z + dz * push;
        return { hit: true, x: ox, z: oz, nx: ox - x, nz: oz - z };
      }
      // Centre inside the box: shove out along the smallest axis.
      const l = x - c.minX, rr = c.maxX - x, t = z - c.minZ, b = c.maxZ - z;
      const m = Math.min(l, rr, t, b);
      if (m === l) return { hit: true, x: c.minX - r, z, nx: c.minX - r - x, nz: 0 };
      if (m === rr) return { hit: true, x: c.maxX + r, z, nx: c.maxX + r - x, nz: 0 };
      if (m === t) return { hit: true, x, z: c.minZ - r, nx: 0, nz: c.minZ - r - z };
      return { hit: true, x, z: c.maxZ + r, nx: 0, nz: c.maxZ + r - z };
    }
  }
  return { hit, x, z, nx: 0, nz: 0 };
}
