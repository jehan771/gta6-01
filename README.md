# Solmar City

[![make.fun](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/jehan771/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard)
[![reward](https://make.fun/badge/gta6-01/jehan771/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01)

An open-world crime game in the browser, built with three.js and no build
step. You are **Vic Marino**, a getaway driver who owes **$1,500** to a loan
shark. **Rosa Delgado** has seven jobs for him — finish all seven and the
debt is paid. After that, Solmar City stays open for free roam, taxi fares
and hidden packages.

## Features

- A sun-soaked low-poly city on a 6×6 road grid: downtown towers, Palm Row,
  the marina with its pier and boats, Solmar Beach, and a stunt ramp.
- On foot and by car: five stealable car types (sedan, taxi, pickup, sports,
  van), arcade driving with handbrake, traffic and pedestrians who flee
  trouble.
- Wanted level and police: a heat meter, one star per 20 heat, police cars
  that chase and ram, foot police at three stars, and the **AIR-1 police
  helicopter** orbiting overhead with its searchlight at three stars and up.
- Seven story missions: Getaway, Courier, Tail, Heat, The Debt, Last Score,
  Payday — with beacons, timers and payouts totalling $5,150.
- Combat: fists and a pistol with limited ammo, ammo boxes around the city,
  and armed loan-shark crew in the final shootouts.
- **Two-station car radio**: SOL 101.9 and PALMA FM, both fully procedural
  WebAudio sequencers — press R to switch.
- HUD with a live minimap, wanted stars, health, money, debt, mission
  counter, packages, timer, district name, radio and helicopter lines.
- Title, pause, busted and complete screens; autosave every 20 seconds and
  on pause, so you can continue from the title screen.
- All sound is synthesized with WebAudio — no audio files, no network
  requests while playing.

## Controls

| Key | Action |
| --- | --- |
| W A S D | Move on foot / drive |
| Mouse drag | Orbit camera |
| E | Steal nearest car / exit car |
| Space | Jump (on foot) / handbrake (driving) |
| F | Punch |
| 1 / 2 + click | Fists / pistol, click to shoot |
| M | Start the next story job |
| T | Take a taxi fare (in a car, near a waiting passenger) |
| R | Switch radio station |
| Esc / P | Pause |
| Enter | Start from the title screen / continue after busted |

## Run it

```sh
node serve.ts
# open http://localhost:8080
```

The game is plain static files under `game/` — no build step, no network
requests at runtime. three.js r160 is vendored under `game/vendor/`.

## Structure

```
main.ts            hand-in entrypoint (writes /output/dossier.json)
serve.ts           tiny static server for local play
shots.json         the four screenshot scenes
game/index.html    the only page: canvas, HUD and screens
game/src/main.js   boot, loop, state machine, camera, test hooks
game/src/config.js all tuning constants
game/src/random.js seeded RNG (mulberry32)
game/src/city.js   Solmar City: roads, buildings, palms, marina, clouds
game/src/player.js Vic on foot
game/src/vehicles.js car models and arcade driving
game/src/traffic.js AI traffic
game/src/pedestrians.js pedestrians
game/src/police.js wanted meter, police cars, foot police, busted
game/src/helicopter.js AIR-1 police helicopter
game/src/missions.js seven story missions, taxi fares, packages
game/src/combat.js fists, pistol, ammo, armed crew
game/src/hud.js    minimap, stars, screens
game/src/audio.js  procedural sound and the two radio stations
game/src/save.js   autosave in localStorage
game/src/input.js  keyboard and mouse
game/src/shots.js  the four staged screenshot scenes
game/vendor/three.module.min.js  three.js r160 (vendored, unmodified)
```

Everything — the city, the names, the story, the art and the music — is
original. Nothing is taken from any commercial game.

## License

MIT — see [LICENSE](LICENSE).
