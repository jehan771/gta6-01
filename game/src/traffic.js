// AI traffic — cars that drive the road grid, pick a new intersection when
// they reach one, and slow down for the car ahead. They are also the cars the
// player steals: any non-police traffic car can be jacked with E.
import { CFG } from './config.js';
import { makeCar, stepCar, removeCar } from './vehicles.js';
import { pick, range } from './random.js';
import { roadCoords } from './city.js';

const TYPES = ['sedan', 'sedan', 'sedan', 'taxi', 'pickup', 'sports', 'van'];

export function createTraffic(scene, rng, colliders) {
  const roads = roadCoords();
  const cars = [];
  function spawnCar(farFrom) {
    const horizontal = rng() < 0.5;
    const road = pick(rng, roads);
    const along = range(rng, -CFG.cityHalf, CFG.cityHalf);
    const x = horizontal ? along : road + (rng() < 0.5 ? -2.2 : 2.2);
    const z = horizontal ? road + (rng() < 0.5 ? -2.2 : 2.2) : along;
    if (farFrom && Math.hypot(x - farFrom.x, z - farFrom.z) < 30) return null;
    const heading = horizontal ? (rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2) : (rng() < 0.5 ? 0 : Math.PI);
    const car = makeCar(scene, rng, pick(rng, TYPES), x, z, heading);
    car.cruise = range(rng, 9, 15);
    car.nextTurn = null;
    car.wait = 0;
    cars.push(car);
    return car;
  }
  for (let i = 0; i < CFG.trafficCars; i++) spawnCar(null);

  function nearestAhead(car) {
    let best = Infinity;
    for (const o of cars) {
      if (o === car || !o.alive) continue;
      const dx = o.x - car.x, dz = o.z - car.z;
      const fwd = dx * Math.sin(car.heading) + dz * Math.cos(car.heading);
      const side = Math.abs(dx * Math.cos(car.heading) - dz * Math.sin(car.heading));
      if (fwd > 0 && fwd < best && side < 2.5) best = fwd;
    }
    return best;
  }

  return {
    cars,
    spawnCar,
    // Drive each car; `playerCar` is excluded from the physics crowd so the
    // player can push through traffic, and stolen cars leave the fleet.
    step(dt, playerCar, playerPos) {
      const roadsArr = roads;
      for (const car of cars) {
        if (!car.alive || car === playerCar) continue;
        // At an intersection (near two roads), sometimes turn.
        const onX = Math.abs(car.x - nearestRoadVal(car.x, roadsArr)) < 1.2;
        const onZ = Math.abs(car.z - nearestRoadVal(car.z, roadsArr)) < 1.2;
        if (car.wait > 0) { car.wait -= dt; }
        else if (onX && onZ && !car.turnedHere) {
          car.turnedHere = true;
          // Sometimes pause at the intersection, like a real driver — and a
          // stopped car is one the player can actually steal.
          if (Math.random() < 0.25) car.wait = range(rng, 1, 3);
          else if (Math.random() < 0.4) {
            car.heading = pickTurn(car.heading);
          }
        } else if (!onX || !onZ) car.turnedHere = false;
        // Keep the car centred in its lane and on its road.
        const ahead = nearestAhead(car);
        const want = ahead < 9 ? 0 : car.cruise;
        const throttle = car.speed < want ? 1 : 0;
        // Steer back toward the lane centre.
        const lane = laneError(car, roadsArr);
        const steer = Math.max(-1, Math.min(1, lane * 0.5));
        stepCar(car, dt, throttle, steer, false, colliders, cars);
        // Respawn far-away cars near the player so the streets stay busy.
        if (playerPos && Math.hypot(car.x - playerPos.x, car.z - playerPos.z) > 220) {
          removeCar(scene, car);
          const c = spawnCar(playerPos);
          if (!c) cars.push(car);
        }
      }
      // Drop dead entries.
      for (let i = cars.length - 1; i >= 0; i--) if (!cars[i].alive) cars.splice(i, 1);
    },
  };
}

function nearestRoadVal(v, roads) {
  let best = roads[0];
  for (const r of roads) if (Math.abs(v - r) < Math.abs(v - best)) best = r;
  return best;
}

// How far the car has drifted sideways off its lane, signed so steering
// toward zero error pulls it back.
function laneError(car, roads) {
  const horizontal = Math.abs(Math.sin(car.heading)) > 0.7;
  if (horizontal) {
    const road = nearestRoadVal(car.z, roads);
    const side = Math.sin(car.heading) > 0 ? 2.2 : -2.2;
    const err = (road + side) - car.z;
    return Math.sin(car.heading) > 0 ? -err : err;
  }
  const road = nearestRoadVal(car.x, roads);
  const side = Math.cos(car.heading) > 0 ? -2.2 : 2.2;
  const err = (road + side) - car.x;
  return Math.cos(car.heading) > 0 ? err : -err;
}

function pickTurn(heading) {
  const turns = [heading + Math.PI / 2, heading - Math.PI / 2];
  return turns[Math.floor(Math.random() * turns.length)];
}
