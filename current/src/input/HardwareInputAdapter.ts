import { getLayerOption, LAYER_DEFINITIONS } from "../data/layers";
import { loadNfcAssignments, resolveNfcAssignment } from "../data/nfcAssignments";
import type { LayerId, LayerInputEvent, NfcCardEvent, NfcTagId } from "../types/music";
import type {
  InputConnectionStatus,
  InputListener,
  InputStatusListener,
  LayerInputAdapter,
} from "./InputAdapter";

const DEFAULT_BAUD_RATE = 115200;
const DUPLICATE_UID_WINDOW_MS = 750;
const LAYER_IDS = LAYER_DEFINITIONS.map((layer) => layer.id);
const TAG_IDS: NfcTagId[] = ["tag-1", "tag-2", "tag-3", "tag-4", "tag-5"];

type SerialPortInfo = {
  usbVendorId?: number;
  usbProductId?: number;
};

export type WebSerialNfcRequestOptions = {
  filters?: Array<{
    usbVendorId?: number;
    usbProductId?: number;
  }>;
};

type SerialPortLike = {
  readable: ReadableStream<Uint8Array> | null;
  writable?: WritableStream<Uint8Array> | null;
  open(options: { baudRate: number }): Promise<void>;
  close(): Promise<void>;
  getInfo?(): SerialPortInfo;
};

type SerialLike = {
  requestPort(options?: WebSerialNfcRequestOptions): Promise<SerialPortLike>;
  getPorts?(): Promise<SerialPortLike[]>;
};

type SerialLineListener = (line: string) => void;
type CardEventListener = (event: NfcCardEvent) => void;
type ReaderLedState = "off" | "ok" | "bad";

type NavigatorWithSerial = Navigator & {
  serial?: SerialLike;
};

interface KnownTagRead {
  tagId: NfcTagId;
  uid?: string;
}

export interface LayerVolumeEvent {
  layerId: LayerId;
  volume: number;
}

export interface LayerMuteEvent {
  layerId: LayerId;
  muted: boolean;
}

export interface EncoderTurnEvent {
  layerId: LayerId;
  direction: -1 | 1;
}

export interface EncoderButtonEvent {
  layerId: LayerId;
}

export const parseNfcUidLine = (line: string) => {
  const match = line.match(/^\s*UID:\s*([0-9a-fA-F][0-9a-fA-F:\-\s]*)\s*$/);
  if (!match) return undefined;

  const bytes = match[1].match(/[0-9a-fA-F]{2}/g);
  return bytes?.length ? bytes.map((byte) => byte.toUpperCase()).join(":") : undefined;
};

const isLayerId = (value: string): value is LayerId =>
  LAYER_IDS.includes(value as LayerId);

const isTagId = (value: string): value is NfcTagId =>
  TAG_IDS.includes(value as NfcTagId);

export const parseLayerSelectionLine = (line: string): LayerInputEvent | undefined => {
  const match = line.match(/^\s*LAYER:\s*([a-z0-9-]+)\s*:\s*([a-z0-9-]+)\s*$/i);
  if (!match) return undefined;

  const [, layerValue, optionId] = match;
  const layerId = layerValue.toLowerCase();
  if (!isLayerId(layerId) || !getLayerOption(layerId, optionId)) return undefined;

  return {
    layerId,
    optionId,
    source: "hardware",
  };
};

export const parseLayerVolumeLine = (line: string): LayerVolumeEvent | undefined => {
  const match = line.match(/^\s*VOLUME:\s*([a-z0-9-]+)\s*:\s*(\d{1,3})%?\s*$/i);
  if (!match) return undefined;

  const layerId = match[1].toLowerCase();
  if (!isLayerId(layerId)) return undefined;

  return {
    layerId,
    volume: Math.max(0, Math.min(1, Number(match[2]) / 100)),
  };
};

export const parseLayerMuteLine = (line: string): LayerMuteEvent | undefined => {
  const match = line.match(/^\s*MUTE:\s*([a-z0-9-]+)\s*:\s*(0|1|true|false|on|off|muted|unmuted)\s*$/i);
  if (!match) return undefined;

  const layerId = match[1].toLowerCase();
  if (!isLayerId(layerId)) return undefined;

  const value = match[2].toLowerCase();
  return {
    layerId,
    muted: value === "1" || value === "true" || value === "on" || value === "muted",
  };
};

export const parseEncoderTurnLine = (line: string): EncoderTurnEvent | undefined => {
  const match = line.match(/^\s*(?:ENC|ENCODER):\s*([a-z0-9-]+)\s*:\s*([+-]?1|cw|ccw)\s*$/i);
  if (!match) return undefined;

  const layerId = match[1].toLowerCase();
  if (!isLayerId(layerId)) return undefined;

  const value = match[2].toLowerCase();
  return {
    layerId,
    direction: value === "-1" || value === "ccw" ? -1 : 1,
  };
};

export const parseEncoderButtonLine = (line: string): EncoderButtonEvent | undefined => {
  const match = line.match(/^\s*(?:BUTTON|BTN):\s*([a-z0-9-]+)\s*:\s*PRESS\s*$/i);
  if (!match) return undefined;

  const layerId = match[1].toLowerCase();
  if (!isLayerId(layerId)) return undefined;

  return { layerId };
};

export const parseKnownTagLine = (line: string): KnownTagRead | undefined => {
  const match = line.match(/^\s*TAG:\s*(tag-[1-5])(?:\s*:\s*([0-9a-fA-F:\-\s]+))?\s*$/i);
  if (!match) return undefined;

  const tagId = match[1].toLowerCase();
  if (!isTagId(tagId)) return undefined;

  const bytes = match[2]?.match(/[0-9a-fA-F]{2}/g);
  return {
    tagId,
    uid: bytes?.length ? bytes.map((byte) => byte.toUpperCase()).join(":") : undefined,
  };
};

const normalizeUid = (value?: string) => {
  const bytes = value?.match(/[0-9a-fA-F]{2}/g);
  return bytes?.length ? bytes.map((byte) => byte.toUpperCase()).join(":") : undefined;
};

const buildDpiPayload = (layerId: LayerId, optionId: string) =>
  `dpi://v1/layer/${layerId}/option/${optionId}`;

export const parseDpiPayload = (payload: string) => {
  const match = payload.match(/^dpi:\/\/v1\/layer\/([a-z0-9-]+)\/option\/([a-z0-9-]+)$/i);
  if (!match) return undefined;

  const layerId = match[1].toLowerCase();
  const optionId = match[2];
  if (!isLayerId(layerId) || !getLayerOption(layerId, optionId)) return undefined;

  return { layerId, optionId };
};

export const parseNfcCardEventLine = (line: string): NfcCardEvent | undefined => {
  const writeReady = line.match(/^\s*WRITE_READY:\s*(tag-[1-5])\s*:\s*(.+)\s*$/i);
  if (writeReady) {
    const tagId = writeReady[1].toLowerCase();
    if (!isTagId(tagId)) return undefined;

    const payload = writeReady[2].trim();
    const parsed = parseDpiPayload(payload);
    return {
      kind: "write-ready",
      tagId,
      layerId: parsed?.layerId,
      optionId: parsed?.optionId,
      payload,
    };
  }

  const writeSuccess = line.match(/^\s*WRITE_SUCCESS:\s*(tag-[1-5])\s*:\s*([0-9a-fA-F:\-\s]+)\s*:\s*([a-z0-9-]+)\s*:\s*([a-z0-9-]+)\s*$/i);
  if (writeSuccess) {
    const tagId = writeSuccess[1].toLowerCase();
    const layerId = writeSuccess[3].toLowerCase();
    const optionId = writeSuccess[4];
    if (!isTagId(tagId) || !isLayerId(layerId) || !getLayerOption(layerId, optionId)) return undefined;

    return {
      kind: "write-success",
      tagId,
      uid: normalizeUid(writeSuccess[2]),
      layerId,
      optionId,
      payload: buildDpiPayload(layerId, optionId),
    };
  }

  const writeUnverified = line.match(/^\s*WRITE_UNVERIFIED:\s*(tag-[1-5])\s*:\s*([0-9a-fA-F:\-\s]+)\s*:\s*([a-z0-9-]+)\s*:\s*([a-z0-9-]+)\s*:\s*(.+)\s*$/i);
  if (writeUnverified) {
    const tagId = writeUnverified[1].toLowerCase();
    const layerId = writeUnverified[3].toLowerCase();
    const optionId = writeUnverified[4];
    if (!isTagId(tagId) || !isLayerId(layerId) || !getLayerOption(layerId, optionId)) return undefined;

    return {
      kind: "write-unverified",
      tagId,
      uid: normalizeUid(writeUnverified[2]),
      layerId,
      optionId,
      payload: buildDpiPayload(layerId, optionId),
      message: writeUnverified[5].trim(),
    };
  }

  const writeFail = line.match(/^\s*WRITE_FAIL:\s*(tag-[1-5])\s*:\s*(.+)\s*$/i);
  if (writeFail) {
    const tagId = writeFail[1].toLowerCase();
    if (!isTagId(tagId)) return undefined;

    return {
      kind: "write-fail",
      tagId,
      message: writeFail[2].trim(),
    };
  }

  const readCard = line.match(/^\s*READ_CARD:\s*(tag-[1-5])\s*:\s*([0-9a-fA-F:\-\s]+)\s*:\s*([a-z0-9-]+)\s*:\s*([a-z0-9-]+)\s*:\s*(.+)\s*$/i);
  if (readCard) {
    const tagId = readCard[1].toLowerCase();
    const layerId = readCard[3].toLowerCase();
    const optionId = readCard[4];
    const payload = readCard[5].trim();
    if (!isTagId(tagId) || !isLayerId(layerId) || !getLayerOption(layerId, optionId)) return undefined;

    return {
      kind: "read-card",
      tagId,
      uid: normalizeUid(readCard[2]),
      layerId,
      optionId,
      payload,
    };
  }

  const unsupported = line.match(/^\s*TAG_UNSUPPORTED:\s*(tag-[1-5])\s*:\s*([0-9a-fA-F:\-\s]+)\s*:\s*(.+)\s*$/i);
  if (unsupported) {
    const tagId = unsupported[1].toLowerCase();
    if (!isTagId(tagId)) return undefined;

    return {
      kind: "unsupported",
      tagId,
      uid: normalizeUid(unsupported[2]),
      message: unsupported[3].trim(),
    };
  }

  return undefined;
};

const randomIndex = (length: number) => {
  const crypto = globalThis.crypto;
  if (crypto?.getRandomValues) {
    const [value] = crypto.getRandomValues(new Uint32Array(1));
    return value % length;
  }

  return Math.floor(Math.random() * length);
};

export const mapNfcUidToLayerInputEvent = (uid: string): LayerInputEvent => {
  void uid;

  const layer = LAYER_DEFINITIONS[randomIndex(LAYER_DEFINITIONS.length)];
  const optionIndex = randomIndex(layer.options.length);

  return {
    layerId: layer.id,
    optionId: layer.options[optionIndex].id,
    source: "hardware",
  };
};

export const mapKnownTagToLayerInputEvent = (tagId: NfcTagId, uid?: string): LayerInputEvent | undefined => {
  const assignment = resolveNfcAssignment(loadNfcAssignments(), tagId);
  const normalizedUid = normalizeUid(uid);

  if (assignment.uid && assignment.uid !== normalizedUid) {
    return undefined;
  }

  return {
    layerId: assignment.layerId,
    optionId: assignment.optionId,
    source: "hardware",
    tagId,
    uid: normalizedUid,
  };
};

const getSerial = () =>
  typeof navigator === "undefined" ? undefined : (navigator as NavigatorWithSerial).serial;

export const isWebSerialNfcSupported = () => Boolean(getSerial());

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Unknown hardware input error.";

const getPortName = (port: SerialPortLike) => {
  const info = port.getInfo?.();
  if (!info?.usbVendorId && !info?.usbProductId) return "Serial device";

  const vendor = info.usbVendorId?.toString(16).padStart(4, "0") ?? "????";
  const product = info.usbProductId?.toString(16).padStart(4, "0") ?? "????";
  return `USB ${vendor}:${product}`;
};

export class WebSerialNfcAdapter implements LayerInputAdapter {
  private readonly listeners = new Set<InputListener>();
  private readonly statusListeners = new Set<InputStatusListener>();
  private readonly lineListeners = new Set<SerialLineListener>();
  private readonly cardEventListeners = new Set<CardEventListener>();
  private readonly baudRate: number;
  private status: InputConnectionStatus = { state: "idle" };
  private port?: SerialPortLike;
  private reader?: ReadableStreamDefaultReader<Uint8Array>;
  private writer?: WritableStreamDefaultWriter<Uint8Array>;
  private readLoopPromise?: Promise<void>;
  private textBuffer = "";
  private shouldRead = false;
  private lastUid = "";
  private lastUidAt = 0;

  constructor(options: { baudRate?: number } = {}) {
    this.baudRate = options.baudRate ?? DEFAULT_BAUD_RATE;
  }

  connect(listener: InputListener) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  onStatusChange(listener: InputStatusListener) {
    this.statusListeners.add(listener);
    listener(this.status);
    return () => {
      this.statusListeners.delete(listener);
    };
  }

  onSerialLine(listener: SerialLineListener) {
    this.lineListeners.add(listener);
    return () => {
      this.lineListeners.delete(listener);
    };
  }

  onCardEvent(listener: CardEventListener) {
    this.cardEventListeners.add(listener);
    return () => {
      this.cardEventListeners.delete(listener);
    };
  }

  getStatus() {
    return this.status;
  }

  async writeTag(tagId: NfcTagId, layerId: LayerId, optionId: string) {
    if (!this.port || !this.writer) {
      throw new Error("Connect the ESP32 before writing a card.");
    }

    if (!isTagId(tagId) || !getLayerOption(layerId, optionId)) {
      throw new Error("Choose a valid reader and layer option before writing.");
    }

    const command = `WRITE:${tagId}:${layerId}:${optionId}\n`;
    await this.writer.write(new TextEncoder().encode(command));
    this.emitLine(`> ${command.trim()}`);
  }

  async setLayerVolume(layerId: LayerId, volume: number) {
    if (!this.port || !this.writer || !isLayerId(layerId)) {
      return;
    }

    const percent = Math.max(0, Math.min(100, Math.round(volume * 100)));
    const command = `VOLUME:${layerId}:${percent}\n`;
    await this.writer.write(new TextEncoder().encode(command));
  }

  async setReaderLed(tagId: NfcTagId, state: ReaderLedState) {
    if (!this.port || !this.writer || !isTagId(tagId)) {
      return;
    }

    const command = `LED:${tagId}:${state}\n`;
    await this.writer.write(new TextEncoder().encode(command));
  }

  async setTransportPlaying(playing: boolean) {
    if (!this.port || !this.writer) {
      return;
    }

    const command = `PLAY:${playing ? 1 : 0}\n`;
    await this.writer.write(new TextEncoder().encode(command));
  }

  async requestAndConnect(options?: WebSerialNfcRequestOptions) {
    const serial = getSerial();
    if (!serial) {
      this.setStatus({
        state: "unsupported",
        message: "Web Serial is not available in this browser.",
      });
      return this.status;
    }

    this.setStatus({ state: "requesting", message: "Waiting for serial port selection." });

    try {
      const port = await serial.requestPort(options);
      return await this.openPort(port);
    } catch (error) {
      this.setStatus({
        state: "error",
        message: getErrorMessage(error),
      });
      return this.status;
    }
  }

  async connectToRememberedPort() {
    const serial = getSerial();
    if (!serial?.getPorts) {
      this.setStatus({
        state: "unsupported",
        message: "This browser cannot restore previous serial ports.",
      });
      return this.status;
    }

    const [port] = await serial.getPorts();
    if (!port) {
      this.setStatus({
        state: "disconnected",
        message: "No previously approved serial port was found.",
      });
      return this.status;
    }

    return this.openPort(port);
  }

  async disconnect() {
    if (!this.port && !this.reader) {
      this.setStatus({ state: "disconnected" });
      return;
    }

    this.shouldRead = false;
    this.setStatus({ state: "disconnecting", portName: this.status.portName });

    try {
      await this.reader?.cancel();
    } catch {
      // Reader cancellation can fail if the port was already unplugged.
    }

    await this.readLoopPromise;

    try {
      this.writer?.releaseLock();
    } catch {
      // Releasing a closed writer lock is harmless for this adapter.
    }

    try {
      await this.port?.close();
    } catch {
      // Closing an already-disconnected port is harmless for this adapter.
    }

    this.reader = undefined;
    this.writer = undefined;
    this.port = undefined;
    this.readLoopPromise = undefined;
    this.textBuffer = "";
    this.setStatus({ state: "disconnected" });
  }

  private async openPort(port: SerialPortLike) {
    await this.disconnect();

    const portName = getPortName(port);
    this.setStatus({ state: "connecting", portName });

    try {
      await port.open({ baudRate: this.baudRate });
      this.port = port;
      this.writer = port.writable?.getWriter();
      this.shouldRead = true;
      this.readLoopPromise = this.readLoop(port);
      this.setStatus({ state: "connected", portName });
    } catch (error) {
      this.setStatus({
        state: "error",
        message: getErrorMessage(error),
        portName,
      });
    }

    return this.status;
  }

  private async readLoop(port: SerialPortLike) {
    const decoder = new TextDecoder();

    while (this.shouldRead && port.readable) {
      const reader = port.readable.getReader();
      this.reader = reader;

      try {
        while (this.shouldRead) {
          const { value, done } = await reader.read();
          if (done) break;
          if (value) this.consumeText(decoder.decode(value, { stream: true }));
        }
      } catch (error) {
        if (this.shouldRead) {
          this.setStatus({
            state: "error",
            message: getErrorMessage(error),
            portName: this.status.portName,
          });
        }
      } finally {
        reader.releaseLock();
        if (this.reader === reader) {
          this.reader = undefined;
        }
      }
    }

    if (this.shouldRead && this.port === port) {
      this.shouldRead = false;
      this.port = undefined;
      this.setStatus({
        state: "disconnected",
        message: "Serial stream ended.",
        portName: this.status.portName,
      });
    }
  }

  private consumeText(chunk: string) {
    this.textBuffer += chunk.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

    let lineEnd = this.textBuffer.indexOf("\n");
    while (lineEnd >= 0) {
      const line = this.textBuffer.slice(0, lineEnd);
      this.textBuffer = this.textBuffer.slice(lineEnd + 1);
      this.handleLine(line);
      lineEnd = this.textBuffer.indexOf("\n");
    }
  }

  private handleLine(line: string) {
    const trimmedLine = line.trim();
    if (trimmedLine) {
      this.emitLine(trimmedLine);
    }

    const exactSelection = parseLayerSelectionLine(line);
    if (exactSelection) {
      this.emit(exactSelection);
      return;
    }

    const cardEvent = parseNfcCardEventLine(line);
    if (cardEvent) {
      this.emitCardEvent(cardEvent);
      return;
    }

    const tagRead = parseKnownTagLine(line);
    if (tagRead) {
      return;
    }

    const uid = parseNfcUidLine(line);
    if (!uid) return;

    const now = Date.now();
    if (uid === this.lastUid && now - this.lastUidAt < DUPLICATE_UID_WINDOW_MS) return;

    this.lastUid = uid;
    this.lastUidAt = now;
    this.emit(mapNfcUidToLayerInputEvent(uid));
  }

  private emit(event: LayerInputEvent) {
    for (const listener of this.listeners) {
      listener(event);
    }
  }

  private emitLine(line: string) {
    for (const listener of this.lineListeners) {
      listener(line);
    }
  }

  private emitCardEvent(event: NfcCardEvent) {
    for (const listener of this.cardEventListeners) {
      listener(event);
    }
  }

  private setStatus(status: InputConnectionStatus) {
    this.status = status;
    for (const listener of this.statusListeners) {
      listener(status);
    }
  }
}

export class HardwareInputAdapter extends WebSerialNfcAdapter {}
