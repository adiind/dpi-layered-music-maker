import type { LayerDefinition, LayerId } from "../types/music";
import { classNames } from "../utils/classNames";
import { MutedIcon, VolumeIcon } from "./icons";

interface LayerColumnProps {
  layer: LayerDefinition;
  selectedOptionId: string;
  muted: boolean;
  volume: number;
  active: boolean;
  nfcPresent: boolean;
  recent: boolean;
  level: number;
  onSelect: (layerId: LayerId, optionId: string) => void;
  onToggleMute: (layerId: LayerId) => void;
  onVolume: (layerId: LayerId, volume: number) => void;
}

const ChannelGlyph = ({ layer }: { layer: LayerDefinition }) => {
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeWidth: 1.8,
  };

  if (layer.icon === "drums") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path {...common} d="M6 10h12v7c0 1.7-2.7 3-6 3s-6-1.3-6-3v-7Z" />
        <path {...common} d="M6 10c0 1.7 2.7 3 6 3s6-1.3 6-3-2.7-3-6-3-6 1.3-6 3Z" />
        <path {...common} d="m17 5 3-2M7 5 4 3" />
      </svg>
    );
  }

  if (layer.icon === "keys") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path {...common} d="M4 6h16v12H4V6Z" />
        <path {...common} d="M8 6v12M12 6v12M16 6v12M6 6v7M10 6v7M14 6v7M18 6v7" />
      </svg>
    );
  }

  if (layer.icon === "texture") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path {...common} d="M4 8c2.2-2.2 4.4-2.2 6.6 0s4.4 2.2 6.6 0" />
        <path {...common} d="M4 12c2.2-2.2 4.4-2.2 6.6 0s4.4 2.2 6.6 0" />
        <path {...common} d="M4 16c2.2-2.2 4.4-2.2 6.6 0s4.4 2.2 6.6 0" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path {...common} d="M7 17 17 7M8 16l6 2 3-3-2-6-6-2-3 3 2 6Z" />
      <path {...common} d="m15 9 3-3M9 15l-3 3" />
    </svg>
  );
};

export const LayerColumn = ({
  layer,
  selectedOptionId,
  muted,
  volume,
  active,
  nfcPresent,
  recent,
  level,
  onSelect,
  onToggleMute,
  onVolume,
}: LayerColumnProps) => {
  const currentOption = layer.options.find((option) => option.id === selectedOptionId);
  const ringValue = muted ? 0 : Math.max(0.03, volume);
  const statusLabel = muted ? "Paused" : active ? "Playing" : nfcPresent ? "Ready" : "Needs NFC";

  return (
    <section
      className={classNames("channel-strip", recent && "recent")}
      style={
        {
          "--layer-color": layer.accent,
          "--layer-soft": layer.accentSoft,
          "--level": level,
          "--ring-value": ringValue,
        } as React.CSSProperties
      }
    >
      <div className="channel-index">{layer.order}</div>

      <div className="meter-stack" aria-hidden="true">
        {Array.from({ length: 12 }, (_, index) => (
          <span
            key={index}
            className={index / 12 <= level && !muted ? "lit" : ""}
          />
        ))}
      </div>

      <div className="channel-knob">
        <div className="knob-face">
          <span />
        </div>
        <div className="volume-value">{muted ? "paused" : `${Math.round(volume * 100)}%`}</div>
      </div>

      <div className="channel-main">
        <div className="channel-heading">
          <div className="channel-glyph" style={{ color: layer.accent }}>
            <ChannelGlyph layer={layer} />
          </div>
          <div>
            <h2>{layer.name}</h2>
            <p>{currentOption?.name}</p>
          </div>
          <span className={classNames("active-pill", active && !muted && "on", !muted && !nfcPresent && "waiting")}>
            {statusLabel}
          </span>
        </div>

        <div className="mini-wave" aria-hidden="true">
          {Array.from({ length: 26 }, (_, index) => (
            <span
              key={index}
              style={{
                height: `${20 + ((index * layer.order * 7) % 26)}px`,
                opacity: muted ? 0.18 : 0.35 + level * 0.55,
              }}
            />
          ))}
        </div>

        <div className="option-buttons" aria-label={`${layer.name} options`}>
          {layer.options.map((option, index) => {
            const selected = option.id === selectedOptionId;

            return (
              <button
                key={option.id}
                type="button"
                onClick={() => onSelect(layer.id, option.id)}
                className={selected ? "selected" : ""}
                aria-label={`${layer.name}: ${option.name}`}
              >
                <span>{index + 1}</span>
                <strong>{option.name}</strong>
              </button>
            );
          })}
        </div>
      </div>

      <div className="channel-actions">
        <input
          className="range-control"
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={volume}
          onChange={(event) => onVolume(layer.id, Number(event.target.value))}
          style={
            {
              "--layer-color": layer.accent,
              "--range-value": volume,
            } as React.CSSProperties
          }
          aria-label={`${layer.name} volume`}
        />
        <button
          type="button"
          onClick={() => onToggleMute(layer.id)}
          className={classNames("mute-button", muted && "muted")}
        >
          {muted ? <MutedIcon /> : <VolumeIcon />}
          {muted ? "Paused" : "On"}
        </button>
      </div>
    </section>
  );
};
