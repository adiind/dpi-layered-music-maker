import { BPM, KEY_NAME, LOOP_LENGTH } from "../data/layers";
import { PlayIcon, ShuffleIcon, StopIcon } from "./icons";

interface TopBarProps {
  isPlaying: boolean;
  isAudioStarting: boolean;
  onTogglePlayback: () => void;
  onRandomize: () => void;
}

export const TopBar = ({ isPlaying, isAudioStarting, onTogglePlayback, onRandomize }: TopBarProps) => (
  <header className="flex flex-col gap-5 border-b border-[#e8eaed] bg-white/90 px-5 py-4 backdrop-blur md:flex-row md:items-center md:justify-between md:px-8">
    <div className="flex items-center gap-4">
      <div className="grid h-9 w-9 place-items-center rounded-full border border-[#dadce0] bg-white text-[13px] font-semibold tracking-[0.08em]">
        L
      </div>
      <div>
        <h1 className="text-[15px] font-semibold tracking-[0.28em] text-[#202124]">
          LAYR
        </h1>
        <p className="mt-0.5 text-[12px] text-[#5f6368]">Composed from scratch</p>
      </div>
    </div>

    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={onTogglePlayback}
        disabled={isAudioStarting}
        className="inline-flex h-10 items-center gap-2 rounded-full bg-[#202124] px-4 text-[13px] font-medium text-white transition hover:bg-[#3c4043] disabled:cursor-wait disabled:bg-[#5f6368]"
      >
        {isPlaying ? <StopIcon /> : <PlayIcon />}
        {isAudioStarting ? "Loading" : isPlaying ? "Stop" : "Play"}
      </button>
      <button
        type="button"
        onClick={onRandomize}
        className="inline-flex h-10 items-center gap-2 rounded-full border border-[#dadce0] bg-white px-4 text-[13px] font-medium text-[#202124] transition hover:bg-[#f1f3f4]"
      >
        <ShuffleIcon />
        Randomize
      </button>
      <div className="ml-0 flex h-10 items-center divide-x divide-[#e8eaed] rounded-full border border-[#dadce0] bg-white text-[12px] text-[#5f6368] md:ml-2">
        <span className="px-3">{BPM} BPM</span>
        <span className="px-3">{KEY_NAME}</span>
        <span className="px-3">{LOOP_LENGTH}</span>
      </div>
    </div>
  </header>
);
