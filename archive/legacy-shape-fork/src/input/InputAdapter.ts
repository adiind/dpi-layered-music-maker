import type { LayerId, LayerInputEvent } from "../types/music";

export type InputListener = (event: LayerInputEvent) => void;
export type ResolveNextOption = (layerId: LayerId) => string;
export type InputAdapterCleanup = () => void | Promise<void>;

export type InputConnectionState =
  | "idle"
  | "unsupported"
  | "requesting"
  | "connecting"
  | "connected"
  | "disconnecting"
  | "disconnected"
  | "error";

export interface InputConnectionStatus {
  state: InputConnectionState;
  message?: string;
  portName?: string;
}

export type InputStatusListener = (status: InputConnectionStatus) => void;

export interface LayerInputAdapter {
  connect(listener: InputListener): InputAdapterCleanup;
}
