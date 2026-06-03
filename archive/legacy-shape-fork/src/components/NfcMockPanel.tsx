import { LAYER_DEFINITIONS } from "../data/layers";
import { layerKeyHint } from "../input/MockNfcAdapter";
import type { InputConnectionStatus } from "../input/InputAdapter";
import type { LayerId } from "../types/music";
import { SoundGlyph } from "./SoundGlyph";

interface NfcMockPanelProps {
  onTap: (layerId: LayerId) => void;
  hardwareStatus: InputConnectionStatus;
  hardwareSupported: boolean;
  lastInputLabel: string;
  onConnectHardware: () => void;
  onDisconnectHardware: () => void;
}

const statusLabel = (status: InputConnectionStatus, supported: boolean) => {
  if (!supported) return "Web Serial unavailable";
  if (status.state === "connected") return status.portName ?? "Connected";
  if (status.state === "requesting") return "Choose serial port";
  if (status.state === "connecting") return "Connecting";
  if (status.state === "disconnecting") return "Disconnecting";
  if (status.state === "error") return status.message ?? "Connection error";
  return "Click Connect NFC first";
};

export const NfcMockPanel = ({
  onTap,
  hardwareStatus,
  hardwareSupported,
  lastInputLabel,
  onConnectHardware,
  onDisconnectHardware,
}: NfcMockPanelProps) => {
  const status = hardwareStatus ?? { state: "idle" };

  return (
    <section className="rounded-lg border border-[#e8eaed] bg-white p-4">
    <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div>
        <h2 className="text-[13px] font-semibold uppercase tracking-[0.18em] text-[#202124]">
          NFC input
        </h2>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-[#f1f3f4] px-3 py-2 font-mono text-[12px] text-[#5f6368]">
          keys 1 2 3 4
        </span>
        <span className="rounded-full bg-[#f1f3f4] px-3 py-2 text-[12px] text-[#5f6368]">
          {statusLabel(status, hardwareSupported)}
        </span>
        <span className="rounded-full bg-[#f1f3f4] px-3 py-2 text-[12px] text-[#5f6368]">
          {lastInputLabel}
        </span>
        {status.state === "connected" ? (
          <button
            type="button"
            onClick={onDisconnectHardware}
            className="h-9 rounded-full border border-[#dadce0] bg-white px-3 text-[12px] font-medium text-[#202124] transition hover:bg-[#f1f3f4]"
          >
            Disconnect
          </button>
        ) : (
          <button
            type="button"
            onClick={onConnectHardware}
            disabled={!hardwareSupported || status.state === "requesting" || status.state === "connecting"}
            className="h-9 rounded-full bg-[#202124] px-3 text-[12px] font-medium text-white transition hover:bg-[#3c4043] disabled:cursor-not-allowed disabled:bg-[#dadce0] disabled:text-[#5f6368]"
          >
            Connect NFC
          </button>
        )}
      </div>
    </div>
    <div className="grid gap-3 md:grid-cols-4">
      {LAYER_DEFINITIONS.map((layer) => (
        <button
          key={layer.id}
          type="button"
          onClick={() => onTap(layer.id)}
          className="group flex h-24 items-center justify-between rounded-lg border border-[#dadce0] bg-[#fbfcfe] px-4 text-left transition hover:bg-white hover:shadow-[0_1px_2px_rgba(60,64,67,0.18)]"
        >
          <div>
            <div className="text-[12px] font-semibold uppercase tracking-[0.16em]" style={{ color: layer.accent }}>
              {layer.name}
            </div>
            <div className="mt-2 font-mono text-[12px] text-[#5f6368]">Key {layerKeyHint(layer.id)}</div>
          </div>
          <div className="grid grid-cols-2 gap-1.5 rounded-lg border border-[#e8eaed] bg-white p-2 transition group-hover:border-[#dadce0]">
            {layer.options.map((option) => (
              <SoundGlyph key={option.id} shape={option.shape} color={option.color} size="sm" />
            ))}
          </div>
        </button>
      ))}
    </div>
  </section>
  );
};
