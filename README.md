# DPI Layered Music Maker

Final demo repository for the DPI five-layer music visualizer and ESP32 hardware controller.

The active project lives in [`current/`](current/). It is a browser-based performance interface for five synced music layers, each with three stem options, plus an NFC Studio for assigning physical NFC cards to exact layer options.

## What This Demo Does

- Plays 15 browser-ready DPI Music stems as one synced 96-second composition.
- Visualizes five layers: Foundation, Texture, Drums, Keys, and Solo.
- Lets the performer control layer option, mute, and volume from the browser.
- Connects to an ESP32 over Web Serial for five PN532 NFC readers, five KY-040 rotary encoders, and a 25-LED NeoPixel strip.
- Uses NFC cards as physical layer gates: the correct card on the correct reader opens that layer.
- Uses encoder rotation for layer volume and encoder button presses for mute.
- Maps the physical LED strip to the installed reverse direction so the colors match the UI order.

## Repository Layout

```text
current/                    Active final demo app and ESP32 firmware
current/src/                React + TypeScript visualizer source
current/public/audio/dpi/   Compressed 96-second MP3 demo stems
current/DPI_2.ino           ESP32 firmware for NFC readers, encoders, LEDs
current/docs/               Hardware wiring and bring-up notes
archive/                    Old experiments kept for reference, not active demo code
```

## Run The Demo

```bash
cd current
npm install
npm run dev -- --host 127.0.0.1 --port 5173
```

Open:

```text
http://127.0.0.1:5173/
```

Use the `Mix` tab for performance and the `NFC Studio` tab for card assignment/write/testing.

## Build And Check

```bash
cd current
npm run build
npm run lint
```

Compile the ESP32 firmware from the `current/` folder:

```bash
arduino-cli compile --fqbn esp32:esp32:esp32 DPI_2.ino
```

Flash when the ESP32 appears as a USB serial port:

```bash
arduino-cli upload -p /dev/cu.usbserial-0001 --fqbn esp32:esp32:esp32 DPI_2.ino
```

If upload cannot connect, disconnect the browser from ESP32 first. If flashing still fails, unplug the NeoPixel DIN wire from GPIO12, flash, then reconnect it.

## Hardware Summary

The final demo target is:

- ESP32-WROOM-32 38-pin board on screw-terminal breakout
- 5x PN532 NFC readers in SPI mode
- 5x KY-040 rotary encoders
- 25 LED WS2812B / NeoPixel strip on GPIO12

Full wiring is in [`current/docs/hardware-wiring.md`](current/docs/hardware-wiring.md).

## Archive

[`archive/legacy-shape-fork/`](archive/legacy-shape-fork/) contains the older shape/color generated-music experiment. It is preserved as reference only. It is not part of the current DPI final demo path.
