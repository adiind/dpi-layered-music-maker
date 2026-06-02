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

- Use the Mix tab for the performance visualizer and channel controls.
- Use the NFC Studio tab to assign reader slots and write NTAG cards to exact layer options.
- Press Play to load and start the synced five-channel stem stack.
- Select one option in each channel: Foundation, Texture, Drums, Keys, and Solo.
- Use Randomize for a new five-layer combination.
- Mute or adjust volume per channel.
- Click programmed mock NFC tags to apply saved assignments, or press keys `1`, `2`, `3`, `4`, `5` to cycle layer options.
- Use the ESP32 Connect control to attach the hardware serial controller when the board is plugged in.
- In NFC Studio, choose a reader slot and option, connect ESP32, then use Write NTAG Card. Written cards store payloads like `dpi://v1/layer/drums/option/drum-w-duck`.

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
src/data/nfcAssignments.ts    Persistent app-level NFC tag assignments
src/input/MockNfcAdapter.ts   Keyboard mock adapter for keys 1-5
src/input/HardwareInputAdapter.ts Web Serial parser/writer for ESP32 layer/tag/card events
src/components/*              Visualizer, channel strips, transport, mock hardware UI
public/audio/dpi/*            Compressed 96-second MP3 demo stems
DPI_2.ino                     ESP32 firmware for 5 encoders + 5 PN532 readers
docs/hardware-wiring.md       Wiring diagram and pin map
```

All input paths keep the same event shape:

```ts
{ layerId, optionId, source }
```

That keeps the UI and audio engine independent from the physical input transport.
