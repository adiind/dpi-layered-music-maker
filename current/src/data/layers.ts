import type {
  LayerDefinition,
  LayerId,
  MuteState,
  SelectionState,
  VolumeState,
} from "../types/music";

export const DEMO_DURATION_SECONDS = 96;
export const DEMO_DURATION_LABEL = "01:36";
export const SOURCE_LABEL = "DPI Music stems";
export const AUDIO_PATH = "/audio/dpi";

export const LAYER_DEFINITIONS: LayerDefinition[] = [
  {
    id: "foundation",
    name: "Foundation",
    order: 1,
    accent: "#009da3",
    accentSoft: "rgba(0, 157, 163, 0.15)",
    icon: "bass",
    tone: "low body and harmonic weight",
    visualKind: "wave",
    options: [
      {
        id: "bass-guitar",
        name: "Bass Guitar",
        tone: "clean plucked low line",
        fileName: "1-bass-guitar.mp3",
        url: `${AUDIO_PATH}/1-bass-guitar.mp3`,
        defaultGain: 0.88,
      },
      {
        id: "bass-guitar-b",
        name: "Bass Guitar B",
        tone: "alternate bass movement",
        fileName: "1-bass-guitar-b.mp3",
        url: `${AUDIO_PATH}/1-bass-guitar-b.mp3`,
        defaultGain: 0.84,
      },
      {
        id: "bouncy-synth-chords",
        name: "Bouncy Synth Chords",
        tone: "wide bouncing chord foundation",
        fileName: "1-bouncy-synth-chords.mp3",
        url: `${AUDIO_PATH}/1-bouncy-synth-chords.mp3`,
        defaultGain: 0.74,
      },
    ],
  },
  {
    id: "texture",
    name: "Texture",
    order: 2,
    accent: "#8c4bd8",
    accentSoft: "rgba(140, 75, 216, 0.15)",
    icon: "texture",
    tone: "air, shimmer, and motion",
    visualKind: "particles",
    options: [
      {
        id: "synth-wavey",
        name: "Synth Wavey",
        tone: "moving synth wash",
        fileName: "2-synth-wavey.mp3",
        url: `${AUDIO_PATH}/2-synth-wavey.mp3`,
        defaultGain: 0.74,
      },
      {
        id: "brushed-snare",
        name: "Brushed Snare",
        tone: "soft scraped rhythmic texture",
        fileName: "2-brushed-snare.mp3",
        url: `${AUDIO_PATH}/2-brushed-snare.mp3`,
        defaultGain: 0.7,
      },
      {
        id: "ethereal-echo-thing",
        name: "Ethereal Echo Thing",
        tone: "floating echoed accents",
        fileName: "2-ethereal-echo-thing.mp3",
        url: `${AUDIO_PATH}/2-ethereal-echo-thing.mp3`,
        defaultGain: 0.76,
      },
    ],
  },
  {
    id: "drums",
    name: "Drums",
    order: 3,
    accent: "#ff4f26",
    accentSoft: "rgba(255, 79, 38, 0.15)",
    icon: "drums",
    tone: "beat blocks and transients",
    visualKind: "beats",
    options: [
      {
        id: "drum-simple",
        name: "Drum Simple",
        tone: "steady central pulse",
        fileName: "3-drum-simple.mp3",
        url: `${AUDIO_PATH}/3-drum-simple.mp3`,
        defaultGain: 0.82,
      },
      {
        id: "drum-poom-tss",
        name: "Drum Poom Tss",
        tone: "kick and bright hat answer",
        fileName: "3-drum-poom-tss.mp3",
        url: `${AUDIO_PATH}/3-drum-poom-tss.mp3`,
        defaultGain: 0.8,
      },
      {
        id: "drum-w-duck",
        name: "Drum w Duck",
        tone: "ducking groove movement",
        fileName: "3-drum-w-duck.mp3",
        url: `${AUDIO_PATH}/3-drum-w-duck.mp3`,
        defaultGain: 0.78,
      },
    ],
  },
  {
    id: "keys",
    name: "Keys",
    order: 4,
    accent: "#d9a000",
    accentSoft: "rgba(217, 160, 0, 0.16)",
    icon: "keys",
    tone: "piano blocks and chord color",
    visualKind: "chords",
    options: [
      {
        id: "piano-1",
        name: "Piano 1",
        tone: "primary chord part",
        fileName: "4-piano-1.mp3",
        url: `${AUDIO_PATH}/4-piano-1.mp3`,
        defaultGain: 0.76,
      },
      {
        id: "piano-2",
        name: "Piano 2",
        tone: "alternate piano rhythm",
        fileName: "4-piano-2.mp3",
        url: `${AUDIO_PATH}/4-piano-2.mp3`,
        defaultGain: 0.74,
      },
      {
        id: "piano-3",
        name: "Piano 3",
        tone: "third piano voicing",
        fileName: "4-paino-3.mp3",
        url: `${AUDIO_PATH}/4-paino-3.mp3`,
        defaultGain: 0.72,
      },
    ],
  },
  {
    id: "solo",
    name: "Solo",
    order: 5,
    accent: "#0a7bd8",
    accentSoft: "rgba(10, 123, 216, 0.15)",
    icon: "solo",
    tone: "lead line and melodic spark",
    visualKind: "melody",
    options: [
      {
        id: "guitar-notes",
        name: "Guitar Notes",
        tone: "clean melodic guitar notes",
        fileName: "solo-guitar-notes.mp3",
        url: `${AUDIO_PATH}/solo-guitar-notes.mp3`,
        defaultGain: 0.78,
      },
      {
        id: "distort-guitar",
        name: "Distort Guitar",
        tone: "distorted lead contrast",
        fileName: "solo-distort-guitar.mp3",
        url: `${AUDIO_PATH}/solo-distort-guitar.mp3`,
        defaultGain: 0.7,
      },
      {
        id: "piano-solo",
        name: "Piano Solo",
        tone: "melodic piano solo phrase",
        fileName: "solo-piano-1.mp3",
        url: `${AUDIO_PATH}/solo-piano-1.mp3`,
        defaultGain: 0.76,
      },
    ],
  },
];

export const LAYER_ORDER = LAYER_DEFINITIONS.map((layer) => layer.id);
export const TOTAL_AUDIO_FILES = LAYER_DEFINITIONS.reduce((count, layer) => count + layer.options.length, 0);

export const DEFAULT_SELECTIONS: SelectionState = {
  foundation: "bass-guitar",
  texture: "synth-wavey",
  drums: "drum-simple",
  keys: "piano-1",
  solo: "guitar-notes",
};

export const DEFAULT_VOLUMES: VolumeState = {
  foundation: 0.74,
  texture: 0.64,
  drums: 0.82,
  keys: 0.68,
  solo: 0.72,
};

export const DEFAULT_MUTES: MuteState = {
  foundation: false,
  texture: false,
  drums: false,
  keys: false,
  solo: false,
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

export const getLayerOptionGain = (layerId: LayerId, optionId: string) =>
  getLayerOption(layerId, optionId)?.defaultGain ?? 1;

export const createRandomSelection = (): SelectionState =>
  LAYER_DEFINITIONS.reduce((selection, layer) => {
    const option = layer.options[Math.floor(Math.random() * layer.options.length)];
    return { ...selection, [layer.id]: option.id };
  }, {} as SelectionState);
