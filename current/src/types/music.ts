export type LayerId = "foundation" | "texture" | "drums" | "keys" | "solo";
export type NfcTagId = "tag-1" | "tag-2" | "tag-3" | "tag-4" | "tag-5";

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
  tagId?: NfcTagId;
  uid?: string;
}

export type NfcCardEventKind =
  | "write-ready"
  | "write-success"
  | "write-fail"
  | "read-card"
  | "unsupported";

export interface NfcCardEvent {
  kind: NfcCardEventKind;
  tagId: NfcTagId;
  uid?: string;
  layerId?: LayerId;
  optionId?: string;
  payload?: string;
  message?: string;
}

export type NfcWriteState =
  | "idle"
  | "queued"
  | "ready"
  | "writing"
  | "verified"
  | "failed"
  | "read"
  | "unsupported";

export interface NfcWriteStatus {
  state: NfcWriteState;
  title: string;
  detail: string;
  tagId?: NfcTagId;
  layerId?: LayerId;
  optionId?: string;
  uid?: string;
  payload?: string;
  atLabel: string;
}

export type NfcReaderState =
  | "unknown"
  | "checking"
  | "detected"
  | "missing"
  | "tag-unassigned"
  | "tag-assigned"
  | "tag-unsupported";

export interface NfcReaderStatus {
  tagId: NfcTagId;
  state: NfcReaderState;
  title: string;
  detail: string;
  uid?: string;
  layerId?: LayerId;
  optionId?: string;
  payload?: string;
  atLabel: string;
}

export interface NfcTagAssignment {
  tagId: NfcTagId;
  label: string;
  layerId: LayerId;
  optionId: string;
  uid?: string;
  updatedAt: string;
}

export interface HardwareActivity {
  kind: "idle" | "connect" | "assign" | "test" | "read" | "serial" | "write";
  title: string;
  detail: string;
  tagId?: NfcTagId;
  atLabel: string;
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
