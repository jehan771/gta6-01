// The four screenshot scenes behind ?shot=1..4&seed=20261117. Each one
// stages a real moment of the game — the real systems, the real HUD —
// then steps the fixed loop forward for a fixed number of frames with
// scripted input, so the frame is what a short game really looks like
// and the same seed always gives the same frame.
import { STEP } from './config.js';
import { createCar } from './vehicles.js';

const FRAMES = { 1: 150, 2: 40, 3: 70, 4: 90 };

function putPlayerInCar(G, type, x, z, yaw, color, speed) {
  const car = createCar(G, type, x, z, yaw, color);
  car.stolen = true;
  car.speed = speed;
  G.player.car = car;
  G.player.onFoot = false;
  G.player.group.visible = false;
  G.player.pos.copy(car.pos);
  G.player.yaw = yaw;
  G.camYaw = yaw;
  return car;
}

function hideNearbyTraffic(G, radius) {
  for (const car of G.traffic.cars) {
    const d = Math.hypot(car.pos.x - G.player.pos.x, car.pos.z - G.player.pos.z);
    if (d < radius) car.group.visible = false;
  }
}

function placeTrafficAhead(G, road, fromX, specs) {
  // Reuse the first traffic cars as the staged cars ahead of the player.
  let i = 0;
  for (const [dx, type] of specs) {
    const car = G.traffic.cars[i];
    i += 1;
    if (!car) break;
    car.axis = 'x';
    car.dir = 1;
    car.pos.set(fromX + dx, 0, road + (i % 2 === 0 ? -2.5 : 2.5));
    car.yaw = Math.PI / 2;
    car.speed = 11;
    car.group.visible = true;
  }
}

export function stageShot(name, G, step) {
  const frames = FRAMES[name] || 90;
  G.hud.showScreen(null);
  G.mode = 'playing';

  if (name === '1') {
    // Chase on Beach Blvd: red sports car at 20 m/s, three stars, AIR-1
    // overhead, two police cars 13 m back, three cars ahead, Courier live.
    const car = putPlayerInCar(G, 'sports', -40, 110, Math.PI / 2, 0xd8232a, 20);
    G.heat = 65;
    G.lastCrimeAt = G.time;
    G.missionIndex = 1;
    G.missions.startMission();
    // Pre-activate AIR-1 on an orbit that ends ahead-left of the camera,
    // so the helicopter is in the frame at capture time.
    const heli = G.helicopter.heli;
    heli.active = true;
    heli.orbitAngle = 1.1;
    heli.group.visible = true;
    heli.group.position.set(
      G.player.pos.x + Math.sin(1.1) * 30, 22,
      G.player.pos.z + Math.cos(1.1) * 30,
    );
    for (let i = 0; i < 2; i += 1) {
      const cop = createCar(G, 'police', -53 - i * 4, 110 + (i === 0 ? -3 : 3), Math.PI / 2);
      cop.speed = 26;
      G.police.policeCars.push(cop);
    }
    placeTrafficAhead(G, 110, -15, [[20, 'sedan'], [35, 'taxi'], [50, 'pickup']]);
    hideNearbyTraffic(G, 0);
    step(frames, (i) => {
      if (i < 60) G.input.hold('KeyW');
      else G.input.release('KeyW');
    });
    G.input.release('KeyW');
    return;
  }

  if (name === '2') {
    // On foot downtown: Vic on the sidewalk among pedestrians, a taxi
    // parked ahead, shop fronts and palms behind. No car roof in frame.
    G.player.pos.set(-22, 0, 34);
    G.player.yaw = 0;
    G.camYaw = 0;
    G.player.camPitch = 0.55;
    const taxi = G.traffic.cars.find((c) => c.type === 'taxi');
    if (taxi) {
      taxi.pos.set(-19.5, 0, 52);
      taxi.yaw = 0;
      taxi.speed = 0;
      taxi.group.visible = true;
    }
    hideNearbyTraffic(G, 25);
    if (taxi) taxi.group.visible = true;
    // Keep hidden packages out of the foreground of this shot.
    for (const pkg of G.missions.packages) {
      if (Math.hypot(pkg.x - G.player.pos.x, pkg.z - G.player.pos.z) < 15) pkg.mesh.visible = false;
    }
    // Nudge a few pedestrians close to Vic, ahead of him on the sidewalk.
    G.pedestrians.peds.slice(0, 4).forEach((ped, i) => {
      ped.pos.set(-24 + i * 2.5, 0, 38 + i * 3);
      ped.wait = 0;
    });
    step(frames, (i) => {
      if (i < 30) G.input.hold('KeyW');
      else G.input.release('KeyW');
    });
    G.input.release('KeyW');
    return;
  }

  if (name === '3') {
    // Mission at sunset: Vic drives a red sedan toward the marina gate
    // on Heat with one star, a police car in the opposite lane 30 m ahead,
    // the yellow beacon burning ahead, pier and boats in frame.
    G.city.setSunset(true);
    const car = putPlayerInCar(G, 'sedan', 45, 22, Math.PI / 2, 0xd8232a, 15);
    G.missionIndex = 3;
    G.missions.startMission();
    G.heat = 25;
    G.lastCrimeAt = G.time;
    // Oncoming police car in the opposite lane, ~30 m ahead at capture:
    // a static car (not a chasing one) so it holds its distance.
    createCar(G, 'police', 98, 19.5, -Math.PI / 2);
    placeTrafficAhead(G, 22, 95, [[12, 'sedan'], [28, 'van']]);
    step(frames, (i) => {
      if (i < 50) G.input.hold('KeyW');
      else G.input.release('KeyW');
    });
    G.input.release('KeyW');
    // The Heat mission has no waypoint of its own; the staged beacon
    // marks the marina gate ahead for the shot.
    G.missions.beacon.target = { ...G.city.places.marinaGate };
    G.missions.beacon.group.visible = true;
    G.missions.beacon.group.position.set(G.city.places.marinaGate.x, 0, G.city.places.marinaGate.z);
    return;
  }

  // Shot 4: the title screen over the city turning slowly below.
  G.mode = 'title';
  G.hud.showTitle();
  step(frames, null);
}
