import { DEMO_DURATION_LABEL, SOURCE_LABEL } from "../data/layers";
import type { EngineStatus } from "../types/music";
import { CableIcon, PauseIcon, PlayIcon, ShuffleIcon } from "./icons";

interface TopBarProps {
  isPlaying: boolean;
  isAudioStarting: boolean;
  engineStatus: EngineStatus;
  elapsedLabel: string;
  espConnected: boolean;
  onTogglePlayback: () => void;
  onRandomize: () => void;
  onToggleEsp: () => void;
}

const loadingLabel = (status: EngineStatus) => {
  if (status.state === "ready") return "Ready";
  if (status.state === "error") return status.message ?? "Audio error";
  if (status.state === "loading") return `${status.loadedCount}/${status.totalCount} stems`;
  return SOURCE_LABEL;
};

export const TopBar = ({
  isPlaying,
  isAudioStarting,
  engineStatus,
  elapsedLabel,
  espConnected,
  onTogglePlayback,
  onRandomize,
  onToggleEsp,
}: TopBarProps) => (
  <header className="topbar">
    <div className="brand-lockup">
      <button className="menu-button" type="button" aria-label="Menu">
        <span />
        <span />
        <span />
      </button>
      <div>
        <h1>DPI Layer Mixer</h1>
        <p>{loadingLabel(engineStatus)}</p>
      </div>
    </div>

    <div className="transport">
      <button
        type="button"
        onClick={onTogglePlayback}
        disabled={isAudioStarting || engineStatus.state === "error"}
        className="primary-transport"
      >
        {isPlaying ? <PauseIcon /> : <PlayIcon />}
        {isAudioStarting ? "Loading" : isPlaying ? "Stop" : "Play"}
      </button>
      <button type="button" onClick={onRandomize} className="ghost-button">
        <ShuffleIcon />
        Randomize
      </button>
      <div className="time-readout">
        {elapsedLabel} / {DEMO_DURATION_LABEL}
      </div>
    </div>

    <div className="hardware-actions">
      <button
        type="button"
        onClick={onToggleEsp}
        className={espConnected ? "esp-button connected" : "esp-button"}
      >
        <span className="status-dot" />
        ESP32
        <span>{espConnected ? "Connected" : "Demo"}</span>
      </button>
      <button type="button" onClick={onToggleEsp} className="ghost-button">
        <CableIcon />
        {espConnected ? "Disconnect" : "Connect"}
      </button>
    </div>
  </header>
);
