// Missions — the 5-story chain from Rosa, plus side work: taxi fares and
// hidden packages. Each mission is a small state machine with an objective
// marker (a 3D beacon + minimap blip), a timer, and a payout. Completing one
// unlocks the next; failing one lets you retry from the phone (key M).
import * as THREE from 'three';
import { CFG } from './config.js';
import { clearSpot } from './city.js';

export function createMissions(scene, places, rng, colliders) {
  // Mission points must be reachable: nudge any that landed inside a
  // building onto the nearest road.
  if (colliders) {
    const h = clearSpot(colliders, places.hideout.x, places.hideout.z);
    places.hideout.x = h.x; places.hideout.z = h.z;
  }
  // Waypoint beacon: a tall glowing pillar + a floating diamond.
  const beacon = new THREE.Group();
  const pillar = new THREE.Mesh(
    new THREE.CylinderGeometry(1.6, 1.6, 60, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffd54d, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false }),
  );
  pillar.position.y = 30; beacon.add(pillar);
  const diamond = new THREE.Mesh(new THREE.OctahedronGeometry(1.4), new THREE.MeshBasicMaterial({ color: 0xffd54d }));
  diamond.position.y = 8; beacon.add(diamond);
  const ring = new THREE.Mesh(new THREE.RingGeometry(2.2, 3, 24), new THREE.MeshBasicMaterial({ color: 0xffd54d, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.12; beacon.add(ring);
  beacon.visible = false;
  scene.add(beacon);

  // Hidden packages (collectibles).
  const packages = [];
  const pkgGeo = new THREE.BoxGeometry(0.8, 0.5, 0.8);
  const pkgMat = new THREE.MeshBasicMaterial({ color: 0x7cf29b });
  const spots = [
    [-88, 66], [88, -66], [-22, 110], [110, -88], [0, -132], [-132, 0],
    [66, 22], [-66, -22], [132, 88], [22, 132],
  ];
  for (const [sx, sz] of spots) {
    const s = colliders ? clearSpot(colliders, sx, sz) : { x: sx, z: sz };
    const m = new THREE.Mesh(pkgGeo, pkgMat);
    m.position.set(s.x, 0.6, s.z);
    scene.add(m);
    packages.push({ mesh: m, x: s.x, z: s.z, taken: false });
  }

  const state = {
    index: 0,                 // next story mission (0..4); 5 = story done
    active: null,             // {def, stage, timer, ...} while running
    taxi: null,               // active taxi fare
    collected: 0,
    taxiDone: 0,
  };

  function setWaypoint(x, z) {
    beacon.position.set(x, 0, z);
    beacon.visible = true;
  }
  function clearWaypoint() { beacon.visible = false; }

  function startMission(i, hooks) {
    const def = CFG.missions[i];
    const m = { def, stage: 0, timer: def.time, tailTime: 0, spotted: 0, target: null };
    state.active = m;
    hooks.onBrief(def.brief);
    if (i === 0) setWaypoint(places.hideout.x, places.hideout.z);
    if (i === 1) setWaypoint(places.marinaGate.x, places.marinaGate.z);
    if (i === 2) {
      m.target = hooks.spawnTailTarget();
      setWaypoint(m.target.x, m.target.z);
    }
    if (i === 3) hooks.police.setHeat(61); // three stars, right away
    if (i === 4) setWaypoint(places.marinaGate.x, places.marinaGate.z);
    return m;
  }

  function completeMission(hooks) {
    const m = state.active;
    state.active = null;
    clearWaypoint();
    state.index += 1;
    hooks.onPaid(m.def.pay, m.def.name);
    if (state.index < CFG.missions.length) {
      hooks.onBrief(`Rosa: Nice work, Vic. Next job is ready — press M when you're ready. ($${m.def.pay} banked)`);
    } else {
      hooks.onBrief('Rosa: The debt is PAID, Vic. Solmar City is yours now. Free roam — taxi fares and packages are still out there.');
    }
  }

  function failMission(reason, hooks) {
    state.active = null;
    clearWaypoint();
    hooks.onFail(reason);
  }

  // Drive the active mission. Returns nothing; talks to the game through hooks.
  function step(dt, ctx, hooks) {
    // Beacon spin.
    if (beacon.visible) { diamond.rotation.y += dt * 2; diamond.position.y = 8 + Math.sin(performance.now() / 300) * 0.5; }
    // Packages.
    for (const pk of packages) {
      if (pk.taken) continue;
      pk.mesh.rotation.y += dt;
      if (Math.hypot(pk.x - ctx.px, pk.z - ctx.pz) < 2) {
        pk.taken = true; pk.mesh.visible = false;
        state.collected += 1;
        hooks.onPackage(CFG.packagePay, state.collected);
      }
    }
    // Taxi fare: passenger rides along, pays on arrival.
    if (state.taxi) {
      const t = state.taxi;
      setWaypoint(t.dest.x, t.dest.z);
      if (Math.hypot(t.dest.x - ctx.px, t.dest.z - ctx.pz) < 6) {
        const pay = Math.round(t.fare);
        state.taxi = null; state.taxiDone += 1;
        clearWaypoint();
        hooks.onPaid(pay, 'Taxi fare');
      } else if (!ctx.inCar) {
        // Walked away from the cab: fare cancelled.
        state.taxi = null; clearWaypoint();
        hooks.onBrief('Passenger: Forget it, I\'ll walk.');
      }
    }
    const m = state.active;
    if (!m) return;
    m.timer -= dt;
    if (m.timer <= 0) { failMission(`Out of time on "${m.def.name}".`, hooks); return; }

    const px = ctx.px, pz = ctx.pz;
    switch (m.def.id) {
      case 1: { // Getaway: be in a car and reach the hideout.
        if (ctx.inCar && Math.hypot(places.hideout.x - px, places.hideout.z - pz) < 7) completeMission(hooks);
        break;
      }
      case 2: { // Courier: pickup, then deliver.
        if (m.stage === 0) {
          if (Math.hypot(places.marinaGate.x - px, places.marinaGate.z - pz) < 6) {
            m.stage = 1; setWaypoint(places.northTower.x, places.northTower.z);
            hooks.onBrief('Rosa: Package secured. North Tower, now — and don\'t stop for anyone.');
          }
        } else if (Math.hypot(places.northTower.x - px, places.northTower.z - pz) < 7) {
          completeMission(hooks);
        }
        break;
      }
      case 3: { // Tail: stay 8–35 m behind the target for 45 s.
        const t = m.target;
        if (!t || !t.alive) { failMission('You lost the target.', hooks); return; }
        setWaypoint(t.x, t.z);
        const d = Math.hypot(t.x - px, t.z - pz);
        if (d < 6) m.spotted += dt; else m.spotted = Math.max(0, m.spotted - dt * 2);
        if (m.spotted > 3) { failMission('Spotted! The runner made you and vanished.', hooks); return; }
        if (d > 45) { m.tailTime = Math.max(0, m.tailTime - dt * 2); }
        else if (d > 8) m.tailTime += dt;
        if (m.tailTime >= 45) completeMission(hooks);
        break;
      }
      case 4: { // Heat: lose the wanted level.
        if (hooks.police.wanted === 0) completeMission(hooks);
        break;
      }
      case 5: { // The Debt: reach the marina gate, then drop the gunmen.
        if (m.stage === 0) {
          if (Math.hypot(places.marinaGate.x - px, places.marinaGate.z - pz) < 10) {
            m.stage = 1;
            hooks.spawnGunmen([[150, 10], [146, 34], [158, 26]]);
            // The finale is Vic vs the crew — the cops back off and let the
            // marina fight play out, so the mission is winnable.
            hooks.police.clear();
            hooks.onBrief('Rosa: There they are — three of them. Take them down, Vic.');
            clearWaypoint();
          }
        } else if (hooks.enemiesLeft() === 0) {
          completeMission(hooks);
        }
        break;
      }
    }
  }

  return {
    state, packages,
    waypoint() { return beacon.visible ? { x: beacon.position.x, z: beacon.position.z } : null; },
    startMission, completeMission, failMission, step,
    startTaxi(pickup, dest) {
      const fare = Math.round(Math.hypot(dest.x - pickup.x, dest.z - pickup.z) * CFG.taxiPayPerMetre) + 20;
      state.taxi = { pickup, dest, fare };
      return state.taxi;
    },
    objectiveText() {
      const m = state.active;
      if (m) {
        const d = m.def;
        const t = Math.max(0, Math.ceil(m.timer));
        if (d.id === 1) return `M${d.id} ${d.name}: steal a car, reach the Hideout — ${t}s`;
        if (d.id === 2) return `M${d.id} ${d.name}: ${m.stage === 0 ? 'pick up the package at the Marina Gate' : 'deliver to the North Tower'} — ${t}s`;
        if (d.id === 3) return `M${d.id} ${d.name}: tail the blue sedan ${Math.max(0, Math.ceil(45 - m.tailTime))}s left — don't get spotted`;
        if (d.id === 4) return `M${d.id} ${d.name}: lose the wanted level — ${t}s`;
        if (d.id === 5) return `M${d.id} ${d.name}: ${m.stage === 0 ? 'reach the Marina' : 'take down the crew'} — ${t}s`;
      }
      if (state.taxi) return `Taxi fare: drive the passenger to the marker ($${state.taxi.fare})`;
      if (state.index >= CFG.missions.length) return 'Story complete — free roam. Taxi fares and packages pay.';
      return `Press M to start Mission ${state.index + 1}: ${CFG.missions[state.index].name} ($${CFG.missions[state.index].pay})`;
    },
  };
}
