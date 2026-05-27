# LAYR Shapes

Experimental tangible version of the layered music maker. The four musical
layers are selected through shape and color objects instead of descriptive sound
names:

- Circle: smooth, warm, rounded
- Triangle: sharp, bright, percussive
- Square: grounded, stable, blocky
- Wave: thin, flowing, airy

All sound is generated live with Tone.js. The app shares one BPM, key center,
progression, and 64-step loop grid across Rhythm, Harmony, Bass, and Melody.

## Run

```bash
npm install
npm run dev
```

Open:

```text
http://127.0.0.1:5175/
```

## Use

- Press Play to start the composed loop.
- Choose one shape object per layer.
- Use Randomize for a coherent new combination.
- Click NFC cards or press keys `1`, `2`, `3`, `4` to cycle layer objects.
- Connect NFC to use the Web Serial PN532 reader.

## Hardware Input

`src/input/HardwareInputAdapter.ts` parses PN532 `UID:` lines from the current
microcontroller sketch. For this fork, any recognized tag behaves like a
physical randomizer: it chooses one audible layer and moves it to a different
shape object. Replace `mapNfcUidToLayerInputEvent` when each physical object
needs a fixed UID-to-shape mapping.
