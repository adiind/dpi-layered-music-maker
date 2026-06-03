import type {
  LayerDefinition,
  LayerId,
  LayerMixProfile,
  LayerOption,
  MuteState,
  SelectionState,
  SoundShape,
  VolumeState,
} from "../types/music";

export const BPM = 92;
export const KEY_NAME = "C / Am";
export const LOOP_LENGTH = "4 bars";
export const TOTAL_STEPS = 64;
export const STEPS_PER_BAR = 16;

type ShapeProfile = Pick<LayerOption, "id" | "name" | "shape" | "shapeLabel" | "material" | "color" | "softColor">;

const SHAPES: Record<SoundShape, ShapeProfile> = {
  circle: {
    id: "circle",
    name: "Round",
    shape: "circle",
    shapeLabel: "circle",
    material: "smooth / warm / rounded",
    color: "#d95f4f",
    softColor: "#fce8e3",
  },
  triangle: {
    id: "triangle",
    name: "Edge",
    shape: "triangle",
    shapeLabel: "triangle",
    material: "sharp / bright / percussive",
    color: "#f2a600",
    softColor: "#fef3cf",
  },
  square: {
    id: "square",
    name: "Block",
    shape: "square",
    shapeLabel: "square",
    material: "grounded / stable / blocky",
    color: "#188855",
    softColor: "#dff3e8",
  },
  wave: {
    id: "wave",
    name: "Thread",
    shape: "wave",
    shapeLabel: "wave",
    material: "thin / flowing / airy",
    color: "#2f75d6",
    softColor: "#e4efff",
  },
};

const option = (shape: SoundShape, tone: string): LayerOption => ({
  ...SHAPES[shape],
  tone,
});

export const LAYER_DEFINITIONS: LayerDefinition[] = [
  {
    id: "rhythm",
    name: "Rhythm",
    order: 1,
    accent: "#d95f4f",
    accentSoft: "#fce8e3",
    options: [
      option("circle", "soft kick, brushed backbeat, rounded pulse"),
      option("triangle", "dry rim clicks and crisp syncopation"),
      option("square", "steady block pulse with simple hats"),
      option("wave", "wide taps and airy offbeat texture"),
    ],
  },
  {
    id: "harmony",
    name: "Harmony",
    order: 2,
    accent: "#f2a600",
    accentSoft: "#fef3cf",
    options: [
      option("circle", "slow warm pad holding the chord body"),
      option("triangle", "bright glass points above the progression"),
      option("square", "grounded chord blocks with a soft attack"),
      option("wave", "flowing tape-key arpeggio line"),
    ],
  },
  {
    id: "bass",
    name: "Bass",
    order: 3,
    accent: "#188855",
    accentSoft: "#dff3e8",
    options: [
      option("circle", "deep rounded sub with a soft attack"),
      option("triangle", "mid-forward syncopated bass bite"),
      option("square", "root-heavy anchor with small pickups"),
      option("wave", "plucked moving bass line"),
    ],
  },
  {
    id: "melody",
    name: "Melody",
    order: 4,
    accent: "#2f75d6",
    accentSoft: "#e4efff",
    options: [
      option("circle", "soft vocal-like hum tones"),
      option("triangle", "clear bell answer phrases"),
      option("square", "simple stable analog hook"),
      option("wave", "thin plucked counter-line"),
    ],
  },
];

export const LAYER_ORDER = LAYER_DEFINITIONS.map((layer) => layer.id);

export const DEFAULT_SELECTIONS: SelectionState = {
  rhythm: "circle",
  harmony: "square",
  bass: "square",
  melody: "wave",
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
    circle: { gain: 0.74, filterFrequency: 17000, activity: 1 },
    triangle: { gain: 0.7, filterFrequency: 18000, activity: 1 },
    square: { gain: 0.68, filterFrequency: 17000, activity: 1 },
    wave: { gain: 0.72, filterFrequency: 15000, activity: 1 },
  },
  harmony: {
    circle: { gain: 1.08, filterFrequency: 4200, activity: 0.72 },
    triangle: { gain: 1.04, filterFrequency: 15000, activity: 0.76 },
    square: { gain: 1.2, filterFrequency: 11000, activity: 0.85 },
    wave: { gain: 1.12, filterFrequency: 8500, activity: 0.82 },
  },
  bass: {
    circle: { gain: 0.74, filterFrequency: 260, activity: 0.74 },
    triangle: { gain: 0.62, filterFrequency: 1400, activity: 0.88 },
    square: { gain: 0.78, filterFrequency: 900, activity: 0.82 },
    wave: { gain: 0.68, filterFrequency: 1800, activity: 0.84 },
  },
  melody: {
    circle: { gain: 1.08, filterFrequency: 5500, activity: 0.6 },
    triangle: { gain: 1.12, filterFrequency: 15000, activity: 0.68 },
    square: { gain: 1.16, filterFrequency: 9000, activity: 0.78 },
    wave: { gain: 1.12, filterFrequency: 11000, activity: 0.72 },
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
