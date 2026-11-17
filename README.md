# Solmar City — an open-world crime game

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/jehan771/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/jehan771/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

**Solmar City** is a 3D open-world crime game for the make.fun **gta6-01 "Make GTA 6"**
bounty. Vic Marino, a getaway driver, owes a loan shark $1,500 — Rosa Delgado's five
story jobs pay it off, if the Solmar PD doesn't catch him first.

## What you can do

- **Explore Solmar City** — downtown towers, a beach boulevard, a marina with boats,
  suburbs and a highway ring, all low-poly three.js with a warm afternoon sun.
- **On foot** — run, sprint, jump, punch. **Driving** — walk up to any traffic car,
  press E to steal it (sedan, taxi, pickup, sports car, van — each handles differently),
  arcade handling with handbrake and stunt ramps.
- **Traffic & pedestrians** — AI cars drive the road grid, pedestrians stroll the
  sidewalks and flee when things get loud.
- **Wanted level (1–5 stars)** — stealing, hitting pedestrians and shooting raise the
  heat; police cars chase and ram, foot cops chase on foot. Get boxed in and you're busted.
- **5 story missions** — Getaway, Courier, Tail, Heat, The Debt — plus taxi fares and
  10 hidden packages to collect. Mission markers show on the minimap and as a beacon.
- **Combat** — fists and a pistol (limited ammo, green ammo boxes around town).
- **HUD** — live minimap, wanted stars, health, money, mission objective, timer, speed.
- **Save** — progress (money, missions, packages, position) autosaves to localStorage.

## Controls

| Key | Action |
| --- | --- |
| W A S D | Move / drive |
| Mouse drag | Look around |
| E | Steal car / exit car |
| Space | Jump (on foot) / handbrake (driving) |
| F | Punch |
| 2 then click | Draw pistol / shoot |
| M | Start the next story mission |
| T | Pick up a taxi fare (in a car, near the waiting passenger) |
| Esc / P | Pause |

## Play

Serve it locally with `node serve.ts`, then open http://localhost:8080. No build step,
no network at runtime — three.js is vendored under `game/vendor/`.

## Structure

One clear job per file under `game/src/`: `city.js` builds Solmar City, `player.js`
on-foot movement and camera, `vehicles.js` car physics and stealing, `traffic.js` AI
cars, `pedestrians.js` sidewalk walkers, `police.js` wanted level and chases,
`missions.js` the story chain and side jobs, `combat.js` fists and pistol, `hud.js`
minimap and menus, `audio.js` procedural WebAudio sound, `save.js` localStorage,
`input.js` keyboard and mouse, `shots.js` the four screenshot scenes, `config.js`
all tuning numbers, `random.js` the seeded RNG.
