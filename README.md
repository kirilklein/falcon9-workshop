# Falcon 9 Rocket Workshop

A playable Three.js model kit: explore a Falcon 9, take it apart, snap it back together, and launch it.

Play it: [Russian](https://kirilklein.github.io/falcon9-workshop/) · [English](https://kirilklein.github.io/falcon9-workshop/?lang=en) (add `?lang=en`; English texts live in `src/en.js`)

## Run

    python3 serve.py      # then open http://localhost:8000

No build step. To play on a phone or tablet on the same Wi-Fi, open `http://<your-computer's-IP>:8000`.

## Files

- `src/rocket.js` – the named rocket parts and their snap points
- `src/hangar.js` – hangar, workbench, crane, floor markings
- `src/main.js` – camera rig, Explore / Build / Launch logic, touch input, UI
- `src/flight.js` – the launch timeline (a pure function of time, so it can pause, rewind and replay)
- `src/audio.js` – synthesized sounds
- `test/loop.mjs` – end-to-end touch test (needs Playwright + Chrome): `node test/loop.mjs [landscape|tablet]`

Rocket layout follows Figure 2-1 of the SpaceX Falcon User's Guide; proportions are deliberately chunky and the flight is stylized.
