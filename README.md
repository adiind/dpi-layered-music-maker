# DPI Layered Music Maker

Public packaging repo for the NFC-driven layered music maker.

## Folders

- `current/` preserves the saved working build from `DPI_2`.
- `shape-fork/` is the tangible shape/color experiment, where circle, triangle,
  square, and wave objects select generated musical variations.

Both apps are React + TypeScript + Tailwind + Tone.js. Audio is generated in the
browser; no backend is required for the current engine.

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

## NFC Input

The Web Serial adapter lives in each app at:

```text
src/input/HardwareInputAdapter.ts
```

The current microcontroller sketch prints PN532 `UID:` lines at `115200` baud.
For now, any scanned tag acts like a randomizer so the physical input path can
be tested before assigning fixed tag meanings. Replace
`mapNfcUidToLayerInputEvent` when real NFC objects should map to exact layers or
options.
