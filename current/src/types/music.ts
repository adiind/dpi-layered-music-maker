export type LayerId = "rhythm" | "harmony" | "bass" | "melody";

export type InputSource = "keyboard" | "card" | "hardware";

export interface LayerOption {
  id: string;
  name: string;
  tone: string;
}

export interface LayerMixProfile {
  gain: number;
  filterFrequency: number;
  activity: number;
}

export interface LayerDefinition {
  id: LayerId;
  name: string;
  order: number;
  accent: string;
  accentSoft: string;
  options: LayerOption[];
}

export type SelectionState = Record<LayerId, string>;
export type VolumeState = Record<LayerId, number>;
export type MuteState = Record<LayerId, boolean>;
export type PendingSelectionState = Partial<Record<LayerId, string>>;

export interface EngineTick {
  step: number;
  bar: number;
  beat: number;
  activeLayers: LayerId[];
  isDownbeat: boolean;
  loopSteps?: number;
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
