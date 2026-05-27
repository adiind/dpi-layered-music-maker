import type { LayerDefinition, LayerId } from "../types/music";
import { classNames } from "../utils/classNames";
import { MutedIcon, VolumeIcon } from "./icons";
import { SoundGlyph } from "./SoundGlyph";

interface LayerColumnProps {
  layer: LayerDefinition;
  selectedOptionId: string;
  pendingOptionId?: string;
  muted: boolean;
  volume: number;
  active: boolean;
  recent: boolean;
  onSelect: (layerId: LayerId, optionId: string) => void;
  onToggleMute: (layerId: LayerId) => void;
  onVolume: (layerId: LayerId, volume: number) => void;
}

export const LayerColumn = ({
  layer,
  selectedOptionId,
  pendingOptionId,
  muted,
  volume,
  active,
  recent,
  onSelect,
  onToggleMute,
  onVolume,
}: LayerColumnProps) => {
  const currentOption = layer.options.find((option) => option.id === selectedOptionId);
  const pendingOption = pendingOptionId
    ? layer.options.find((option) => option.id === pendingOptionId)
    : undefined;
  const visibleOption = pendingOption ?? currentOption;

  return (
    <section
      className={classNames(
        "flex min-h-[520px] flex-col rounded-lg border bg-white p-4 transition-colors",
        recent ? "border-[#202124]" : "border-[#e8eaed]",
      )}
      style={{ "--layer-color": layer.accent } as React.CSSProperties}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span
              className="grid h-6 w-6 place-items-center rounded-full text-[12px] font-semibold"
              style={{ backgroundColor: layer.accentSoft, color: layer.accent }}
            >
              {layer.order}
            </span>
            <h2 className="text-[13px] font-semibold uppercase tracking-[0.18em] text-[#202124]">
              {layer.name}
            </h2>
            {recent ? (
              <span className="rounded-full bg-[#f1f3f4] px-2 py-1 text-[10px] font-medium uppercase tracking-[0.12em] text-[#5f6368]">
                changed
              </span>
            ) : null}
          </div>
          <div className="mt-5 flex items-center gap-3">
            {visibleOption ? (
              <SoundGlyph
                shape={visibleOption.shape}
                color={visibleOption.color}
                active={active}
                muted={muted}
                size="lg"
              />
            ) : null}
            <div>
              <p className="text-[18px] font-medium text-[#202124]">{visibleOption?.name}</p>
              <p className="mt-1 min-h-4 text-[12px] text-[#5f6368]">
                {pendingOption ? "Queued next bar" : visibleOption?.material}
              </p>
            </div>
          </div>
        </div>
        <div
          className={classNames(
            "mt-1 h-2.5 w-2.5 rounded-full border transition",
            active && !muted ? "scale-125" : "scale-100",
          )}
          style={{
            backgroundColor: active && !muted ? layer.accent : "#ffffff",
            borderColor: active && !muted ? layer.accent : "#dadce0",
          }}
          aria-label={active && !muted ? `${layer.name} active` : `${layer.name} idle`}
        />
      </div>

      <div className="mt-7 grid grid-cols-2 gap-2">
        {layer.options.map((option) => {
          const selected = option.id === selectedOptionId;
          const pending = option.id === pendingOptionId;

          return (
            <button
              key={option.id}
              type="button"
              onClick={() => onSelect(layer.id, option.id)}
              className={classNames(
                "group flex min-h-28 flex-col justify-between rounded-lg border p-3 text-left transition",
                selected
                  ? "bg-[#fbfcfe] text-[#202124]"
                  : "border-[#e8eaed] bg-white text-[#5f6368] hover:border-[#dadce0] hover:bg-[#fbfcfe]",
              )}
              style={{
                borderColor: selected || pending ? option.color : undefined,
              }}
              aria-label={`${layer.name} ${option.name}: ${option.tone}`}
            >
              <SoundGlyph shape={option.shape} color={option.color} active={selected || pending} muted={muted} />
              <span>
                <span className="block text-[13px] font-medium text-[#202124]">{option.name}</span>
                <span className="mt-0.5 block text-[11px] leading-4 text-[#5f6368]">{option.shapeLabel}</span>
              </span>
              <span className="h-4 text-[11px] font-medium" style={{ color: option.color }}>
                {pending ? "next" : selected ? "on" : ""}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-auto pt-8">
        <div className="mb-3 flex items-center justify-between text-[11px] font-medium uppercase tracking-[0.12em] text-[#5f6368]">
          <span>Volume</span>
          <span>{Math.round(volume * 100)}%</span>
        </div>
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
          className={classNames(
            "mt-6 inline-flex h-10 items-center gap-2 rounded-full border px-3 text-[13px] font-medium transition",
            muted
              ? "border-[#202124] bg-[#202124] text-white"
              : "border-[#dadce0] bg-white text-[#202124] hover:bg-[#f1f3f4]",
          )}
        >
          {muted ? <MutedIcon /> : <VolumeIcon />}
          {muted ? "Muted" : "On"}
        </button>
      </div>
    </section>
  );
};
