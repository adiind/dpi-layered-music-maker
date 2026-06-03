import { LAYER_DEFINITIONS, STEPS_PER_BAR, TOTAL_STEPS } from "../data/layers";
import type { ChangeNotice, LayerId, SelectionState } from "../types/music";
import { SoundGlyph } from "./SoundGlyph";

interface CompositionViewProps {
  selections: SelectionState;
  mutedLayers: Record<LayerId, boolean>;
  activeLayers: LayerId[];
  step: number;
  loopSteps: number;
  changeNotice: ChangeNotice | null;
}

const radiusByIndex = [82, 68, 54, 40];
const circumference = (radius: number) => 2 * Math.PI * radius;

export const CompositionView = ({
  selections,
  mutedLayers,
  activeLayers,
  step,
  loopSteps,
  changeNotice,
}: CompositionViewProps) => {
  const beatStep = step % STEPS_PER_BAR;
  const visualLoopSteps = loopSteps || TOTAL_STEPS;

  return (
    <section className="flex h-full min-h-[520px] flex-col rounded-lg border border-[#e8eaed] bg-white p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-[13px] font-semibold uppercase tracking-[0.18em] text-[#202124]">
            Composition
          </h2>
          <p className="mt-1 text-[12px] text-[#5f6368]">shape stack on a shared grid</p>
        </div>
        <div className="font-mono text-[12px] text-[#5f6368]">
          {String(Math.floor(step / STEPS_PER_BAR) + 1).padStart(2, "0")}:{String(beatStep + 1).padStart(2, "0")}
        </div>
      </div>

      <div
        className="mt-4 min-h-[68px] rounded-lg border border-[#e8eaed] bg-[#fbfcfe] px-3 py-2"
        aria-live="polite"
      >
        {changeNotice ? (
          <div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#5f6368]">
                {changeNotice.sourceLabel}
              </span>
              <span className="text-[11px] text-[#5f6368]">{changeNotice.commitLabel}</span>
            </div>
            <p className="mt-2 text-[13px] text-[#202124]">
              <span className="font-medium">{changeNotice.layerName}</span>
              <span className="text-[#5f6368]">: {changeNotice.previousOptionName} -&gt; </span>
              <span className="font-medium">{changeNotice.nextOptionName}</span>
            </p>
          </div>
        ) : (
          <div>
            <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#5f6368]">
              Last change
            </div>
            <p className="mt-2 text-[13px] text-[#5f6368]">Tap an NFC tag or mock card.</p>
          </div>
        )}
      </div>

      <div className="grid flex-1 place-items-center py-5">
        <div className="relative h-64 w-64">
          <svg className="h-full w-full -rotate-90" viewBox="0 0 200 200" aria-hidden="true">
            <circle cx="100" cy="100" r="92" fill="#ffffff" stroke="#f1f3f4" strokeWidth="1" />
            {LAYER_DEFINITIONS.map((layer, index) => {
              const radius = radiusByIndex[index];
              const length = circumference(radius);
              const muted = mutedLayers[layer.id];
              const active = activeLayers.includes(layer.id);

              return (
                <g key={layer.id}>
                  <circle cx="100" cy="100" r={radius} fill="none" stroke="#edf0f3" strokeWidth="7" />
                  <circle
                    cx="100"
                    cy="100"
                    r={radius}
                    fill="none"
                    stroke={muted ? "#dadce0" : layer.accent}
                    strokeLinecap="round"
                    strokeWidth={active ? 9 : 7}
                    strokeDasharray={`${length * (muted ? 0.12 : 0.72)} ${length}`}
                    strokeDashoffset={-(step / visualLoopSteps) * length - index * 16}
                    opacity={muted ? 0.35 : active ? 1 : 0.58}
                    className="transition-all duration-150"
                  />
                </g>
              );
            })}
            <circle cx="100" cy="100" r="25" fill="#f8fafd" stroke="#dadce0" strokeWidth="1" />
          </svg>
          <div className="absolute inset-0 grid place-items-center">
            <div className="flex flex-col items-center">
              <div className="relative h-24 w-24">
                {LAYER_DEFINITIONS.map((layer, index) => {
                  const option = layer.options.find((item) => item.id === selections[layer.id]);
                  if (!option) return null;

                  return (
                    <div
                      key={layer.id}
                      className="absolute left-1/2 top-1/2"
                      style={{
                        transform: `translate(-50%, -50%) translate(${(index - 1.5) * 12}px, ${(index - 1.5) * -10}px)`,
                        zIndex: index + 1,
                      }}
                    >
                      <SoundGlyph
                        shape={option.shape}
                        color={option.color}
                        active={activeLayers.includes(layer.id)}
                        muted={mutedLayers[layer.id]}
                        size="md"
                      />
                    </div>
                  );
                })}
              </div>
              <div className="mt-1 text-center">
                <div className="text-[18px] font-medium text-[#202124]">{activeLayers.length}</div>
                <div className="text-[10px] uppercase tracking-[0.14em] text-[#5f6368]">active</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-2">
        {LAYER_DEFINITIONS.map((layer) => {
          const option = layer.options.find((item) => item.id === selections[layer.id]);
          const muted = mutedLayers[layer.id];

          return (
            <div
              key={layer.id}
              className="flex h-12 items-center justify-between rounded-lg border border-[#e8eaed] bg-[#fbfcfe] px-3 text-[13px]"
            >
              <div className="flex min-w-0 items-center gap-3">
                {option ? (
                  <SoundGlyph
                    shape={option.shape}
                    color={option.color}
                    active={activeLayers.includes(layer.id)}
                    muted={muted}
                    size="sm"
                  />
                ) : null}
                <span className="font-medium text-[#202124]">{layer.name}</span>
              </div>
              <span className="truncate pl-4 text-[#5f6368]">{muted ? "Muted" : option?.name}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
};
