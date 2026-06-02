# DPI Layer Mixer

A React + TypeScript demo instrument for showing how five music channels layer
into one composition. The UI is built as a live visualizer for an audience:
each channel has three stem options, its own volume control, and a distinct
visual language inside the shared timeline.

The playable demo audio comes from the local `DPI Music/` WAV stems. The source
files are preserved untouched, and browser-friendly 96-second MP3 demo cuts live
under:

```text
public/audio/dpi/
```

## Run

```bash
npm install
npm run dev
```

Open the local URL printed by Vite.

## Use

- Press Play to load and start the synced five-channel stem stack.
- Select one option in each channel: Foundation, Texture, Drums, Keys, and Solo.
- Use Randomize for a new five-layer combination.
- Mute or adjust volume per channel.
- Click mock NFC tags or press keys `1`, `2`, `3`, `4`, `5` to cycle layer options.
- Use the ESP32 controls as demo-status UI for now; live five-encoder hardware parsing is intentionally out of this first build.

## Channel Map

```text
Foundation  Bass Guitar, Bass Guitar B, Bouncy Synth Chords
Texture     Synth Wavey, Brushed Snare, Ethereal Echo Thing
Drums       Drum Simple, Drum Poom Tss, Drum w Duck
Keys        Piano 1, Piano 2, Piano 3
Solo        Guitar Notes, Distort Guitar, Piano Solo
```

## Architecture

```text
src/audio/StemMusicEngine.ts  Tone.js sample players, loading, sync, progress
src/data/layers.ts            Five-channel stem metadata and defaults
src/input/MockNfcAdapter.ts   Keyboard mock adapter for keys 1-5
src/components/*              Visualizer, channel strips, transport, mock hardware UI
public/audio/dpi/*            Compressed 96-second MP3 demo stems
```

All input paths keep the same event shape:

```ts
{ layerId, optionId, source }
```

That keeps the UI and audio engine independent from the physical input transport.
