import type {
  LayerDefinition,
  LayerId,
  LayerMixProfile,
  MuteState,
  SelectionState,
  VolumeState,
} from "../types/music";

export const BPM = 120;
export const KEY_NAME = "C / Am";
export const LOOP_LENGTH = "4 bars";
export const TOTAL_STEPS = 64;
export const STEPS_PER_BAR = 16;

export const LAYER_DEFINITIONS: LayerDefinition[] = [
  {
    id: "rhythm",
    name: "Rhythm",
    order: 1,
    accent: "#ff7b6f",
    accentSoft: "rgba(255, 123, 111, 0.18)",
    options: [
      { id: "soft-kit", name: "Soft Kit", tone: "warm kick, brushed snare, steady hats" },
      { id: "broken-snap", name: "Broken Snap", tone: "syncopated kick and dry rim hits" },
      { id: "pulse-drive", name: "Pulse Drive", tone: "four-on-floor pulse with open hats" },
      { id: "half-time", name: "Half Time", tone: "wide slow backbeat with small clicks" },
    ],
  },
  {
    id: "harmony",
    name: "Harmony",
    order: 2,
    accent: "#ffc65f",
    accentSoft: "rgba(255, 198, 95, 0.18)",
    options: [
      { id: "felt-piano", name: "Felt Piano", tone: "soft voiced chords with real movement" },
      { id: "tape-keys", name: "Tape Keys", tone: "rounded arpeggio through the progression" },
      { id: "warm-pad", name: "Warm Pad", tone: "slow sustained harmony bed" },
      { id: "glass-chimes", name: "Glass Chimes", tone: "delicate high chord tones" },
    ],
  },
  {
    id: "bass",
    name: "Bass",
    order: 3,
    accent: "#7bd9ae",
    accentSoft: "rgba(123, 217, 174, 0.18)",
    options: [
      { id: "round-root", name: "Round Root", tone: "punchier roots with a small pickup" },
      { id: "soft-sub", name: "Soft Sub", tone: "deeper sub with audible attack pulses" },
      { id: "bass-guitar", name: "Bass Guitar", tone: "plucked moving bass line" },
      { id: "drive-bass", name: "Drive Bass", tone: "syncopated mid-forward bass" },
    ],
  },
  {
    id: "melody",
    name: "Melody",
    order: 4,
    accent: "#79b8ff",
    accentSoft: "rgba(121, 184, 255, 0.18)",
    options: [
      { id: "analog-hook", name: "Analog Hook", tone: "simple singable synth motif" },
      { id: "bell-answer", name: "Bell Answer", tone: "clear high answer phrases" },
      { id: "vocal-hum", name: "Vocal Hum", tone: "rounded sustained melodic tones" },
      { id: "pluck-counter", name: "Pluck Counter", tone: "small syncopated counter hook" },
    ],
  },
];

export const LAYER_ORDER = LAYER_DEFINITIONS.map((layer) => layer.id);

export const DEFAULT_SELECTIONS: SelectionState = {
  rhythm: "soft-kit",
  harmony: "felt-piano",
  bass: "round-root",
  melody: "analog-hook",
};

export const DEFAULT_VOLUMES: VolumeState = {
  rhythm: 0.58,
  harmony: 0.88,
  bass: 0.56,
  melody: 0.9,
};

export const DEFAULT_MUTES: MuteState = {
  rhythm: false,
  harmony: false,
  bass: false,
  melody: false,
};

export const getLayer = (layerId: LayerId) =>
  LAYER_DEFINITIONS.find((layer) => layer.id === layerId);

export const getLayerOption = (layerId: LayerId, optionId: string) =>
  getLayer(layerId)?.options.find((option) => option.id === optionId);

export const getNextLayerOptionId = (layerId: LayerId, currentOptionId: string) => {
  const options = getLayer(layerId)?.options ?? [];
  const currentIndex = options.findIndex((option) => option.id === currentOptionId);
  const next = options[(currentIndex + 1) % options.length];
  return next?.id ?? currentOptionId;
};

export const LAYER_OPTION_MIX_PROFILES: Record<LayerId, Record<string, LayerMixProfile>> = {
  rhythm: {
    "soft-kit": { gain: 0.74, filterFrequency: 19000, activity: 1 },
    "broken-snap": { gain: 0.72, filterFrequency: 18000, activity: 1 },
    "pulse-drive": { gain: 0.68, filterFrequency: 19000, activity: 1 },
    "half-time": { gain: 0.72, filterFrequency: 16000, activity: 1 },
  },
  harmony: {
    "felt-piano": { gain: 1.22, filterFrequency: 12000, activity: 0.85 },
    "tape-keys": { gain: 1.14, filterFrequency: 8500, activity: 0.82 },
    "warm-pad": { gain: 1.06, filterFrequency: 4200, activity: 0.72 },
    "glass-chimes": { gain: 1.1, filterFrequency: 15000, activity: 0.76 },
  },
  bass: {
    "round-root": { gain: 0.78, filterFrequency: 900, activity: 0.82 },
    "soft-sub": { gain: 0.74, filterFrequency: 260, activity: 0.74 },
    "bass-guitar": { gain: 0.68, filterFrequency: 1800, activity: 0.84 },
    "drive-bass": { gain: 0.62, filterFrequency: 1400, activity: 0.88 },
  },
  melody: {
    "analog-hook": { gain: 1.18, filterFrequency: 9000, activity: 0.78 },
    "bell-answer": { gain: 1.14, filterFrequency: 15000, activity: 0.68 },
    "vocal-hum": { gain: 1.1, filterFrequency: 5500, activity: 0.6 },
    "pluck-counter": { gain: 1.12, filterFrequency: 11000, activity: 0.72 },
  },
};

export const getLayerMixProfile = (layerId: LayerId, optionId: string) =>
  LAYER_OPTION_MIX_PROFILES[layerId][optionId] ?? {
    gain: 1,
    filterFrequency: 18000,
    activity: 0.7,
  };

export const createRandomSelection = (): SelectionState =>
  LAYER_DEFINITIONS.reduce((selection, layer) => {
    const option = layer.options[Math.floor(Math.random() * layer.options.length)];
    return { ...selection, [layer.id]: option.id };
  }, {} as SelectionState);
