# DPI Layer Mixer

Public packaging repo for the DPI music layer demo.

## Folders

- `current/` is the final five-channel stem visualizer for the DPI demo.
- `shape-fork/` is the tangible shape/color experiment, where circle, triangle,
  square, and wave objects select generated musical variations.

Both apps are React + TypeScript + Tailwind + Tone.js. The current demo plays
compressed browser-friendly stems from `current/public/audio/dpi/`; no backend
is required.

## Run Current Build

```bash
cd current
npm install
npm run dev -- --host 127.0.0.1 --port 5174
```

Open:

```text
http://127.0.0.1:5174/
```

## Run Shape Fork

```bash
cd shape-fork
npm install
npm run dev
```

Open:

```text
http://127.0.0.1:5175/
```

## Input

The current app uses mock ESP32/NFC controls and keyboard shortcuts `1` through
`5` for the first demo build. The older PN532 Web Serial adapter remains in the
source tree as reference code for future hardware protocol work.

```text
current/src/input/
```
