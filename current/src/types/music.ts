export type LayerId = "foundation" | "texture" | "drums" | "keys" | "solo";

export type InputSource = "keyboard" | "card" | "hardware";
export type LayerVisualKind = "wave" | "particles" | "beats" | "chords" | "melody";

export interface LayerOption {
  id: string;
  name: string;
  tone: string;
  fileName: string;
  url: string;
  defaultGain: number;
  visualKind?: LayerVisualKind;
}

export interface LayerDefinition {
  id: LayerId;
  name: string;
  order: number;
  accent: string;
  accentSoft: string;
  icon: string;
  tone: string;
  visualKind: LayerVisualKind;
  options: LayerOption[];
}

export type SelectionState = Record<LayerId, string>;
export type VolumeState = Record<LayerId, number>;
export type MuteState = Record<LayerId, boolean>;
export type PendingSelectionState = Partial<Record<LayerId, string>>;
export type LayerLevelState = Record<LayerId, number>;

export interface EngineStatus {
  state: "idle" | "loading" | "ready" | "error";
  loadedCount: number;
  totalCount: number;
  message?: string;
}

export interface EngineTick {
  progress: number;
  elapsedSeconds: number;
  durationSeconds: number;
  activeLayers: LayerId[];
  layerLevels: LayerLevelState;
}

export interface LayerInputEvent {
  layerId: LayerId;
  optionId: string;
  source: InputSource;
}

export interface ChangeNotice {
  layerId: LayerId;
  source: InputSource;
  sourceLabel: string;
  layerName: string;
  previousOptionName: string;
  nextOptionName: string;
  timingLabel: string;
}
