import { getLayerOption, LAYER_DEFINITIONS } from "../data/layers";
import type { ChangeNotice, LayerId, LayerLevelState, SelectionState } from "../types/music";

interface CompositionViewProps {
  selections: SelectionState;
  mutedLayers: Record<LayerId, boolean>;
  activeLayers: LayerId[];
  layerLevels: LayerLevelState;
  progress: number;
  elapsedLabel: string;
  durationLabel: string;
  changeNotice: ChangeNotice | null;
}

const VIEWBOX_WIDTH = 1000;
const BAND_TOP = 54;
const BAND_HEIGHT = 92;
const BAND_GAP = 10;
const BAND_STEP = BAND_HEIGHT + BAND_GAP;

const timeMarks = [
  { x: 0, label: "0:00" },
  { x: 312.5, label: "0:30" },
  { x: 625, label: "1:00" },
  { x: 1000, label: "1:36" },
];

const wavePath = (line: number, layerIndex: number, progress: number, level: number) => {
  const top = BAND_TOP + layerIndex * BAND_STEP;
  const center = top + BAND_HEIGHT * 0.54 + line * 2.8;
  const amp = (8 + line * 1.7) * (0.55 + level);
  const points = Array.from({ length: 42 }, (_, index) => {
    const x = (index / 41) * VIEWBOX_WIDTH;
    const y =
      center +
      Math.sin(index * 0.68 + line * 0.5 + progress * Math.PI * 4) * amp +
      Math.sin(index * 0.23 + layerIndex) * amp * 0.38;
    return `${index === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
  });
  return points.join(" ");
};

const melodyPoints = (layerIndex: number, progress: number, level: number) => {
  const top = BAND_TOP + layerIndex * BAND_STEP;
  return Array.from({ length: 22 }, (_, index) => {
    const x = 18 + index * 46;
    const wave = Math.sin(index * 0.88 + progress * Math.PI * 3.5);
    const y = top + 48 + wave * (22 + level * 12) + Math.sin(index * 0.31) * 10;
    return { x, y };
  });
};

const pathFromPoints = (points: Array<{ x: number; y: number }>) =>
  points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(" ");

const formatPercent = (value: number) => `${Math.round(value * 100)}%`;

export const CompositionView = ({
  selections,
  mutedLayers,
  activeLayers,
  layerLevels,
  progress,
  elapsedLabel,
  durationLabel,
  changeNotice,
}: CompositionViewProps) => {
  const progressX = progress * VIEWBOX_WIDTH;

  return (
    <section className="visualizer-panel">
      <div className="visualizer-header">
        <div>
          <h2>Layer Stack</h2>
          <p>{activeLayers.length} active channels</p>
        </div>
        <div className="timeline-clock">
          {elapsedLabel} / {durationLabel}
        </div>
      </div>

      <div className="stack-visualizer">
        <svg
          viewBox="0 0 1000 575"
          preserveAspectRatio="none"
          role="img"
          aria-label="Five synchronized music layers over time"
        >
          <defs>
            <linearGradient id="timelineFade" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0" stopColor="#061923" />
              <stop offset="0.48" stopColor="#0b1423" />
              <stop offset="1" stopColor="#120d22" />
            </linearGradient>
            {LAYER_DEFINITIONS.map((layer) => (
              <linearGradient key={layer.id} id={`${layer.id}-glow`} x1="0" x2="1" y1="0" y2="0">
                <stop offset="0" stopColor={layer.accent} stopOpacity="0.18" />
                <stop offset="0.48" stopColor={layer.accent} stopOpacity="0.86" />
                <stop offset="1" stopColor={layer.accent} stopOpacity="0.2" />
              </linearGradient>
            ))}
          </defs>

          <rect x="0" y="0" width="1000" height="575" rx="8" fill="url(#timelineFade)" />

          {timeMarks.map((mark) => (
            <g key={mark.label}>
              <line x1={mark.x} x2={mark.x} y1="34" y2="555" stroke="#ffffff" strokeOpacity="0.12" />
              <text x={mark.x + 8} y="25" fill="#dce6ee" fontSize="13" fontFamily="Inter, Arial">
                {mark.label}
              </text>
            </g>
          ))}

          {Array.from({ length: 28 }, (_, index) => {
            const x = (index / 27) * VIEWBOX_WIDTH;
            return (
              <line
                key={index}
                x1={x}
                x2={x}
                y1="42"
                y2="558"
                stroke="#ffffff"
                strokeOpacity={index % 4 === 0 ? 0.12 : 0.045}
              />
            );
          })}

          {LAYER_DEFINITIONS.map((layer, layerIndex) => {
            const top = BAND_TOP + layerIndex * BAND_STEP;
            const center = top + BAND_HEIGHT / 2;
            const muted = mutedLayers[layer.id];
            const level = muted ? 0 : layerLevels[layer.id];
            const opacity = muted ? 0.2 : 0.66 + level * 0.34;

            return (
              <g key={layer.id} opacity={opacity}>
                <rect
                  x="0"
                  y={top}
                  width="1000"
                  height={BAND_HEIGHT}
                  fill={layer.accent}
                  fillOpacity={muted ? 0.025 : 0.05 + level * 0.06}
                />
                <line x1="0" x2="1000" y1={top} y2={top} stroke="#ffffff" strokeOpacity="0.13" />

                {layer.visualKind === "wave" ? (
                  <>
                    {Array.from({ length: 15 }, (_, line) => (
                      <path
                        key={line}
                        d={wavePath(line, layerIndex, progress, level)}
                        fill="none"
                        stroke={layer.accent}
                        strokeWidth="1.15"
                        strokeOpacity={0.28 + line * 0.025}
                      />
                    ))}
                    <path
                      d={wavePath(8, layerIndex, progress, level)}
                      fill="none"
                      stroke={layer.accent}
                      strokeWidth="5"
                      strokeOpacity="0.32"
                    />
                  </>
                ) : null}

                {layer.visualKind === "particles" ? (
                  <>
                    <path
                      d={wavePath(4, layerIndex, progress, level)}
                      fill="none"
                      stroke={layer.accent}
                      strokeWidth="14"
                      strokeOpacity="0.12"
                    />
                    <path
                      d={wavePath(4, layerIndex, progress, level)}
                      fill="none"
                      stroke={layer.accent}
                      strokeWidth="2"
                      strokeOpacity="0.72"
                    />
                    {Array.from({ length: 72 }, (_, index) => {
                      const x = (index * 61 + layerIndex * 23) % 1000;
                      const y = top + 18 + ((index * 31) % 58);
                      const nearLine = Math.abs(x - progressX) < 90;
                      return (
                        <circle
                          key={index}
                          cx={x}
                          cy={y}
                          r={nearLine ? 2.1 : 1.25}
                          fill={layer.accent}
                          fillOpacity={(nearLine ? 0.85 : 0.35) * (0.4 + level)}
                        />
                      );
                    })}
                  </>
                ) : null}

                {layer.visualKind === "beats" ? (
                  <>
                    <line x1="0" x2="1000" y1={center} y2={center} stroke={layer.accent} strokeOpacity="0.72" />
                    {Array.from({ length: 28 }, (_, index) => {
                      const x = 22 + index * 35;
                      const hot = (index + layerIndex) % 4 === 0;
                      const height = hot ? 58 : 28 + ((index * 11) % 18);
                      return (
                        <g key={index}>
                          <rect
                            x={x}
                            y={top + BAND_HEIGHT - 18 - (index % 3) * 8}
                            width={hot ? 22 : 16}
                            height={hot ? 16 : 13}
                            fill={layer.accent}
                            fillOpacity={0.46 + level * 0.4}
                          />
                          <line
                            x1={x + 8}
                            x2={x + 8}
                            y1={center - height / 2}
                            y2={center + height / 2}
                            stroke={layer.accent}
                            strokeWidth={hot ? 3 : 1.4}
                            strokeOpacity={hot ? 0.88 : 0.38}
                          />
                        </g>
                      );
                    })}
                  </>
                ) : null}

                {layer.visualKind === "chords" ? (
                  <>
                    {Array.from({ length: 20 }, (_, index) => {
                      const x = 16 + index * 51;
                      const y = top + 22 + ((index * 17) % 44);
                      const width = 58 + ((index * 13) % 62);
                      return (
                        <rect
                          key={index}
                          x={x}
                          y={y}
                          width={width}
                          height="5.5"
                          rx="1.5"
                          fill={layer.accent}
                          fillOpacity={0.48 + level * 0.38}
                        />
                      );
                    })}
                    <path d={wavePath(1, layerIndex, progress, level)} fill="none" stroke={layer.accent} strokeOpacity="0.18" />
                  </>
                ) : null}

                {layer.visualKind === "melody" ? (
                  <>
                    <path
                      d={pathFromPoints(melodyPoints(layerIndex, progress, level))}
                      fill="none"
                      stroke={`url(#${layer.id}-glow)`}
                      strokeWidth="4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    {melodyPoints(layerIndex, progress, level).map((point, index) => (
                      <circle
                        key={index}
                        cx={point.x}
                        cy={point.y}
                        r={index % 3 === 0 ? 5.5 : 2.4}
                        fill={index % 2 === 0 ? "#36a3ff" : "#ff4ecf"}
                        fillOpacity={0.62 + level * 0.34}
                      />
                    ))}
                  </>
                ) : null}

                <text x="18" y={top + 21} fill="#ffffff" fillOpacity="0.68" fontSize="12" fontFamily="Inter, Arial">
                  {layer.order}. {layer.name}
                </text>
                <text x="18" y={top + 39} fill={layer.accent} fontSize="12" fontWeight="700" fontFamily="Inter, Arial">
                  {muted ? "Muted" : formatPercent(layerLevels[layer.id])}
                </text>
              </g>
            );
          })}

          <line x1={progressX} x2={progressX} y1="39" y2="560" stroke="#ffffff" strokeWidth="2.5" />
          <path d={`M ${progressX - 7} 38 L ${progressX + 7} 38 L ${progressX} 50 Z`} fill="#ffffff" />
        </svg>
      </div>

      <div className="stack-footer">
        <div className="change-notice" aria-live="polite">
          {changeNotice ? (
            <>
              <span>{changeNotice.sourceLabel}</span>
              <strong>{changeNotice.layerName}</strong>
              <em>
                {changeNotice.previousOptionName} to {changeNotice.nextOptionName}
              </em>
            </>
          ) : (
            <>
              <span>Input</span>
              <strong>Ready</strong>
              <em>Keys 1-5 cycle options; programmed NFC tags apply exact assignments.</em>
            </>
          )}
        </div>
        <div className="current-stack">
          {LAYER_DEFINITIONS.map((layer) => {
            const option = getLayerOption(layer.id, selections[layer.id]);
            return (
              <div key={layer.id}>
                <span style={{ backgroundColor: mutedLayers[layer.id] ? "#b8c0cc" : layer.accent }} />
                <strong>{layer.name}</strong>
                <em>{mutedLayers[layer.id] ? "Muted" : option?.name}</em>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
