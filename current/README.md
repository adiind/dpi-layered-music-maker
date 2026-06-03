# DPI Final Demo Visualizer

This is the active DPI final demo: a five-channel music-layer visualizer with real DPI Music stems, NFC card assignment, ESP32 serial control, five rotary encoders, five PN532 readers, and a 25-LED NeoPixel strip.

The interface is meant to be watched by people while the physical system is performed. The browser shows what each musical layer is doing, which card/reader is active, how loud each layer is, and how the hardware state maps into the mix.

## Layer Map

| Layer | Color | Options |
| --- | --- | --- |
| 1. Foundation | Light blue | Bass Guitar, Bass Guitar B, Bouncy Synth Chords |
| 2. Texture | Red | Synth Wavey, Brushed Snare, Ethereal Echo Thing |
| 3. Drums | Yellow | Drum Simple, Drum Poom Tss, Drum w Duck |
| 4. Keys | Dark blue | Piano 1, Piano 2, Piano 3 |
| 5. Solo | Orange | Guitar Notes, Distort Guitar, Piano Solo |

Audio is served from `public/audio/dpi/` as compressed 96-second MP3 demo stems. The original WAV/Audacity source files are preserved in `DPI Music/` and are not required to run the app.

## Run Locally

```bash
npm install
npm run dev -- --host 127.0.0.1 --port 5173
```

Open:

```text
http://127.0.0.1:5173/
```

## Browser UI

- `Mix` is the performance visualizer.
- `NFC Studio` assigns each physical reader/card slot to one exact layer option.
- `Play` starts the synced stem engine.
- `Randomize` chooses one option per layer.
- Layer controls adjust option, mute, and volume.
- Keyboard keys `1` through `5` cycle the corresponding layer option for demo input.
- `ESP32 Connect` opens Web Serial and listens to the physical controller.

## Hardware Behavior

The ESP32 firmware in `DPI_2.ino` handles:

- PN532 NFC polling for five readers.
- NFC card payload reads/writes using `dpi://v1/layer/<layer>/option/<option>`.
- KY-040 rotary encoder volume using GPIO interrupts.
- KY-040 button mute when `SW` is wired.
- NeoPixel layer indicators on GPIO12 / P12.

`SW` is optional for rotation. A KY-040 only needs `+`, `GND`, `CLK`, and `DT` to control volume.
This saved firmware snapshot prioritizes the stable NFC reader setup that was confirmed on the physical rig.

## Hardware Bring-Up

1. Flash `DPI_2.ino`.
2. Confirm the NeoPixel strip flashes all five layer colors at boot.
3. Open the app and connect ESP32.
4. Confirm PN532 readers report `found PN5...`.
5. Rotate the Foundation encoder on GPIO32/GPIO33 and confirm `ENC:foundation` plus `VOLUME:foundation`.
6. Place/write NFC cards from NFC Studio.
7. Confirm the correct card on the correct reader opens the intended layer and lights the matching LED group.

Detailed wiring is in [`docs/hardware-wiring.md`](docs/hardware-wiring.md).

## Development

```bash
npm run build
npm run lint
arduino-cli compile --fqbn esp32:esp32:esp32 DPI_2.ino
```

## Source Structure

```text
src/audio/StemMusicEngine.ts        Tone.js synced stem players
src/data/layers.ts                  Layer names, colors, options, audio metadata
src/data/nfcAssignments.ts          NFC assignment persistence
src/input/HardwareInputAdapter.ts   Web Serial protocol parser/writer
src/components/                     Mix visualizer, NFC Studio, controls
public/audio/dpi/                   Demo MP3 stems
DPI_2.ino                           ESP32 firmware
docs/hardware-wiring.md             Wiring map and bring-up checklist
```

## Notes

- The physical LED strip is mapped in reverse order because the installed strip direction is opposite the UI order.
- The app does not need a backend.
- Web Serial requires a Chromium-based browser.
- If flashing fails, disconnect the app from ESP32 and retry. If boot/flashing is still flaky, unplug NeoPixel DIN from GPIO12/P12 during upload, or add a 10k pulldown from P12 to GND.
- If NTAG215 recognition is flaky, use a stronger shared 3.3V supply for the PN532 boards, common ground, short SPI wiring, antenna spacing, and a 470uF capacitor on the reader power rail.
