import type { CSSProperties } from "react";
import { getLayer, getLayerOption, LAYER_DEFINITIONS } from "../data/layers";
import type { LayerId, MuteState, NfcTagAssignment, NfcTagId, VolumeState } from "../types/music";
import { TagIcon } from "./icons";

interface NfcMockPanelProps {
  assignments: NfcTagAssignment[];
  onTap: (tagId: NfcTagId) => void;
  volumes: VolumeState;
  mutes: MuteState;
  nfcPresence: Record<LayerId, boolean>;
  activeLayerIds: LayerId[];
  buttonPressCounts: Record<LayerId, number>;
  espConnected: boolean;
  lastInputLabel: string;
  onToggleLayer: (layerId: LayerId) => void;
}

export const NfcMockPanel = ({
  assignments,
  onTap,
  volumes,
  mutes,
  nfcPresence,
  activeLayerIds,
  buttonPressCounts,
  espConnected,
  lastInputLabel,
  onToggleLayer,
}: NfcMockPanelProps) => (
  <section className="hardware-panel">
    <div className="hardware-status-block">
      <span>ESP32 Status</span>
      <strong className={espConnected ? "connected" : ""}>{espConnected ? "Connected" : "Demo ready"}</strong>
      <em>{espConnected ? "Port: demo serial" : "Connect state is mocked for this build."}</em>
    </div>

    <div className="encoder-bank">
      <span>Encoders</span>
      <div>
        {LAYER_DEFINITIONS.map((layer) => (
          <div key={layer.id} className="encoder-readout">
            <div
              style={
                {
                  "--layer-color": layer.accent,
                  "--ring-value": volumes[layer.id],
                } as CSSProperties
              }
            >
              <span />
            </div>
            <strong>{layer.order}</strong>
            <em>{Math.round(volumes[layer.id] * 100)}%</em>
          </div>
        ))}
      </div>
    </div>

    <div className="button-bank">
      <span>Buttons</span>
      <div>
        {LAYER_DEFINITIONS.map((layer) => {
          const active = activeLayerIds.includes(layer.id);
          const muted = mutes[layer.id];
          const waiting = !nfcPresence[layer.id];
          const label = muted ? "Paused" : waiting ? "Waiting" : active ? "Playing" : "Ready";

          return (
            <button
              key={layer.id}
              type="button"
              onClick={() => onToggleLayer(layer.id)}
              className={muted ? "paused" : active ? "playing" : waiting ? "waiting" : ""}
              style={{ "--layer-color": layer.accent } as CSSProperties}
              aria-label={`${layer.name} hardware button ${label}`}
            >
              <i key={buttonPressCounts[layer.id]} aria-hidden="true" />
              <strong>{layer.order}</strong>
              <em>{label}</em>
            </button>
          );
        })}
      </div>
    </div>

    <div className="tag-bank">
      <span>NFC Tags</span>
      <div>
        {assignments.map((assignment) => {
          const layer = getLayer(assignment.layerId);
          const option = getLayerOption(assignment.layerId, assignment.optionId);

          return (
            <button
              key={assignment.tagId}
              type="button"
              onClick={() => onTap(assignment.tagId)}
              style={{ "--layer-color": layer?.accent ?? "#111827" } as CSSProperties}
              aria-label={`Mock NFC tag ${assignment.label}: ${layer?.name ?? assignment.layerId} ${option?.name ?? assignment.optionId}`}
            >
              <TagIcon />
              <strong>{assignment.label}</strong>
              <em>{option?.name ?? assignment.optionId}</em>
            </button>
          );
        })}
      </div>
    </div>

    <div className="input-signal">
      <span>Input Signal</span>
      <strong>{lastInputLabel}</strong>
      <div aria-hidden="true">
        {Array.from({ length: 30 }, (_, index) => (
          <i key={index} className={index < 20 ? "on" : index < 24 ? "peak" : ""} />
        ))}
      </div>
    </div>
  </section>
);
