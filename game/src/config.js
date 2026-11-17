// Solmar City — tuning constants. One place for every number the game balances on,
// so a tweak here retunes the whole game without touching the systems.
export const CFG = {
  // World layout (metres). Roads run on a grid; blocks sit between them.
  roadSpacing: 44,
  roadHalf: 5,
  roadCount: 6,            // roads at -110, -66, -22, 22, 66, 110 on each axis
  cityHalf: 132,           // playable edge; beach beyond +z, marina beyond +x
  beachZ: 138,             // sand strip starts here
  marinaX: 138,            // docks start here
  sidewalk: 2.5,

  // On-foot movement
  walkSpeed: 6,
  runSpeed: 10,
  jumpSpeed: 8.5,
  gravity: 24,

  // Driving (arcade)
  accel: 22,
  brake: 34,
  reverseAccel: 12,
  maxReverse: 9,
  steerRate: 1.9,
  grip: 6.5,               // how fast velocity aligns with heading
  handbrakeGrip: 1.6,
  drag: 0.35,              // quadratic-ish drag factor
  crashSpeedLoss: 0.45,

  // Car types: top speed (m/s), accel multiplier, steer multiplier, colour set
  cars: {
    sedan:  { top: 30, accel: 1.0, steer: 1.0, len: 4.4, wid: 1.9, colours: [0x3a6ea5, 0x8c2f39, 0x4a4a4a, 0xcfd4d6] },
    taxi:   { top: 28, accel: 0.95, steer: 1.0, len: 4.4, wid: 1.9, colours: [0xf2b705] },
    pickup: { top: 27, accel: 0.9, steer: 0.85, len: 5.0, wid: 2.0, colours: [0x5b7a4a, 0x7a4a2b, 0x37474f] },
    sports: { top: 42, accel: 1.35, steer: 1.2, len: 4.2, wid: 1.9, colours: [0xc62828, 0x1565c0, 0xf9a825, 0xeeeeee] },
    van:    { top: 24, accel: 0.8, steer: 0.8, len: 5.2, wid: 2.1, colours: [0xe8e8e8, 0x607d8b, 0x6d4c41] },
    police: { top: 36, accel: 1.2, steer: 1.15, len: 4.5, wid: 1.95, colours: [0x1b1b1b] },
  },

  // Wanted / police
  heatPerStar: 20,         // 0-19: 0 stars, 20-39: 1 ... 100: 5 stars
  heatDecay: 1.6,          // per second while no crime committed
  heatGrace: 6,            // seconds after a crime before decay starts
  stealHeat: 26,
  hitPedHeat: 30,
  shootHeat: 18,
  killHeat: 45,
  policeRam: 26,           // speed police cars try to match when ramming
  bustedFine: 100,
  bustedHold: 1.6,         // seconds a cop must stay in range to bust you

  // Player
  maxHealth: 100,
  punchDamage: 25,
  punchRange: 2.2,
  pistolDamage: 34,
  pistolAmmo: 12,
  pistolMaxAmmo: 48,
  ammoPickup: 12,

  // Missions
  missions: [
    { id: 1, name: 'Getaway',      pay: 300,  time: 100, brief: 'Rosa: Vic, I need wheels — steal a car and get it to the hideout on Palm Row before the clock runs out. Cops see you jack it, they come running.' },
    { id: 2, name: 'Courier',      pay: 450,  time: 130, brief: 'Rosa: Package at the marina gate. Pick it up, drop it at the north tower. The heat will be on you the whole way — drive like you mean it.' },
    { id: 3, name: 'Tail',         pay: 500,  time: 75,  brief: 'Rosa: A rival runner is moving product through downtown. Tail his blue sedan — stay close, but if he spots you the job is blown.' },
    { id: 4, name: 'Heat',         pay: 600,  time: 160, brief: 'Rosa: Three stars, Vic. Lose them. Lay low, break line of sight, stay clean — when the stars are gone, the money is yours.' },
    { id: 5, name: 'The Debt',     pay: 1000, time: 240, brief: 'Rosa: This is it. The shark\'s crew is waiting at the marina. Get there, deal with them, and your debt is paid. Don\'t miss.' },
  ],
  taxiPayPerMetre: 1.1,
  packagePay: 50,
  packageCount: 10,

  // World population
  trafficCars: 14,
  pedestrians: 26,

  // Presentation
  skyDay: 0x87b5d6,
  skySunset: 0xe8875a,
  fogDay: 0x9fc3d8,
  sunDay: 0xfff2d0,
  sunSunset: 0xff9a4d,
};
