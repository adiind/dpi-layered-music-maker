import { LAYER_DEFINITIONS } from "../data/layers";
import type { LayerInputEvent } from "../types/music";
import type {
  InputConnectionStatus,
  InputListener,
  InputStatusListener,
  LayerInputAdapter,
} from "./InputAdapter";

const DEFAULT_BAUD_RATE = 115200;
const DUPLICATE_UID_WINDOW_MS = 750;

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
  open(options: { baudRate: number }): Promise<void>;
  close(): Promise<void>;
  getInfo?(): SerialPortInfo;
};

type SerialLike = {
  requestPort(options?: WebSerialNfcRequestOptions): Promise<SerialPortLike>;
  getPorts?(): Promise<SerialPortLike[]>;
};

type NavigatorWithSerial = Navigator & {
  serial?: SerialLike;
};

export const parseNfcUidLine = (line: string) => {
  const match = line.match(/^\s*UID:\s*([0-9a-fA-F][0-9a-fA-F:\-\s]*)\s*$/);
  if (!match) return undefined;

  const bytes = match[1].match(/[0-9a-fA-F]{2}/g);
  return bytes?.length ? bytes.map((byte) => byte.toUpperCase()).join(":") : undefined;
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
  private readonly baudRate: number;
  private status: InputConnectionStatus = { state: "idle" };
  private port?: SerialPortLike;
  private reader?: ReadableStreamDefaultReader<Uint8Array>;
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

  getStatus() {
    return this.status;
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
      await this.port?.close();
    } catch {
      // Closing an already-disconnected port is harmless for this adapter.
    }

    this.reader = undefined;
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

  private setStatus(status: InputConnectionStatus) {
    this.status = status;
    for (const listener of this.statusListeners) {
      listener(status);
    }
  }
}

export class HardwareInputAdapter extends WebSerialNfcAdapter {}
