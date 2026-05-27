# DPI Layered Music Maker

A clean React + TypeScript web instrument for mixing four composed musical
layers: Rhythm, Harmony, Bass, and Melody.

The current app does not use the Audacity project as audio, stems, or a timing
map. The Audacity file is only a reference for the broad palette: drums, piano,
bass, and synth. Playback is generated live in Tone.js on a shared 120 BPM,
4-bar grid so every option combination stays aligned and musical.

## Run

```bash
npm install
npm run dev
```

Open the local URL printed by Vite. In this session the dev server was running at:

```text
http://127.0.0.1:5174/
```

## Use

- Select one sound option in each of the four layer columns.
- Press Play to start the shared 120 BPM loop.
- Use Randomize for a coherent new combination.
- Mute or adjust volume per layer.
- Click NFC cards or press keys `1`, `2`, `3`, `4` to cycle layer sound options.
- Use Connect NFC to attach a Web Serial hardware reader.

## Architecture

```text
src/audio/ComposedMusicEngine.ts  Tone.js instruments, transport, patterns, mix
src/data/layers.ts                Layer definitions, defaults, BPM/key/loop
src/input/MockNfcAdapter.ts       Keyboard mock adapter
src/input/HardwareInputAdapter.ts Web Serial PN532 adapter
src/components/*                  Minimal instrument UI
```

All input paths emit the same event shape:

```ts
{ layerId, optionId, source }
```

That keeps the UI and audio engine independent from the physical input transport.

## NFC Hardware Input

The hardware path is implemented in `src/input/HardwareInputAdapter.ts`.

The existing XIAO ESP32-C6 + PN532 Arduino sketch prints tag data at `115200` baud:

```text
NFC tag recognized
  UID: AA:BB:CC
```

The Web Serial adapter parses `UID:` lines. For now, each recognized NFC touch
acts like a physical randomizer: the UI chooses an unmuted layer and moves it to a
different sound option, then shows the exact before/after change in the Composition
panel and NFC input status. Later, replace `mapNfcUidToLayerInputEvent` with a
fixed UID-to-layer or UID-to-option mapping if each physical object should always
represent a specific musical layer.

## Notes

- Audio is entirely client-side. No backend is needed for the current engine.
- Option changes while playing are queued and committed on the next bar.
- Every layer shares the same BPM, key center, chord progression, and 64-step
  loop grid.
