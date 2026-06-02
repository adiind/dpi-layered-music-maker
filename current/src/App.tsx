import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StemMusicEngine } from "./audio/StemMusicEngine";
import { CompositionView } from "./components/CompositionView";
import { LayerColumn } from "./components/LayerColumn";
import { NfcMockPanel } from "./components/NfcMockPanel";
import { TopBar } from "./components/TopBar";
import {
  createRandomSelection,
  DEFAULT_MUTES,
  DEFAULT_SELECTIONS,
  DEFAULT_VOLUMES,
  DEMO_DURATION_LABEL,
  DEMO_DURATION_SECONDS,
  getLayer,
  getLayerOption,
  getNextLayerOptionId,
  LAYER_DEFINITIONS,
  LAYER_ORDER,
  TOTAL_AUDIO_FILES,
} from "./data/layers";
import { KeyboardNfcMockAdapter } from "./input/MockNfcAdapter";
import type {
  ChangeNotice,
  EngineStatus,
  EngineTick,
  LayerInputEvent,
  LayerId,
  LayerLevelState,
  MuteState,
  SelectionState,
  VolumeState,
} from "./types/music";

const createEmptyLayerLevels = () =>
  LAYER_ORDER.reduce((levels, layerId) => ({ ...levels, [layerId]: 0 }), {} as LayerLevelState);

const INITIAL_TICK: EngineTick = {
  progress: 0,
  elapsedSeconds: 0,
  durationSeconds: DEMO_DURATION_SECONDS,
  activeLayers: [],
  layerLevels: createEmptyLayerLevels(),
};

const INITIAL_ENGINE_STATUS: EngineStatus = {
  state: "idle",
  loadedCount: 0,
  totalCount: TOTAL_AUDIO_FILES,
};

const formatTime = (seconds: number) => {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const remainder = safeSeconds % 60;
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
};

const App = () => {
  const engineRef = useRef<StemMusicEngine | null>(null);
  const handleInputRef = useRef<(event: LayerInputEvent) => void>(() => undefined);
  const selectionsRef = useRef<SelectionState>({ ...DEFAULT_SELECTIONS });
  const changeClearRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isAudioStarting, setIsAudioStarting] = useState(false);
  const [espConnected, setEspConnected] = useState(false);
  const [engineStatus, setEngineStatus] = useState<EngineStatus>(INITIAL_ENGINE_STATUS);
  const [selections, setSelections] = useState<SelectionState>({ ...DEFAULT_SELECTIONS });
  const [volumes, setVolumes] = useState<VolumeState>({ ...DEFAULT_VOLUMES });
  const [mutes, setMutes] = useState<MuteState>({ ...DEFAULT_MUTES });
  const [tick, setTick] = useState<EngineTick>(INITIAL_TICK);
  const [lastInputLabel, setLastInputLabel] = useState("No input yet");
  const [changeNotice, setChangeNotice] = useState<ChangeNotice | null>(null);
  const [recentLayerId, setRecentLayerId] = useState<LayerId | null>(null);

  useEffect(() => {
    selectionsRef.current = selections;
  }, [selections]);

  useEffect(() => {
    const engine = new StemMusicEngine();
    engine.setTickListener(setTick);
    engine.setStatusListener(setEngineStatus);
    engine.setCommitListener((nextSelections) => {
      selectionsRef.current = nextSelections;
      setSelections(nextSelections);
    });
    engineRef.current = engine;
    void engine.prepare();

    return () => {
      if (changeClearRef.current) {
        clearTimeout(changeClearRef.current);
      }
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  const resolveNextOption = useCallback(
    (layerId: LayerId) => getNextLayerOptionId(layerId, selectionsRef.current[layerId]),
    [],
  );

  const handleSelect = useCallback((layerId: LayerId, optionId: string) => {
    engineRef.current?.setSelection(layerId, optionId);
    selectionsRef.current = { ...selectionsRef.current, [layerId]: optionId };
    setSelections((current) => ({ ...current, [layerId]: optionId }));
  }, []);

  const handleInputEvent = useCallback(
    (event: LayerInputEvent) => {
      let nextOptionId = event.optionId;

      if (nextOptionId === selectionsRef.current[event.layerId]) {
        nextOptionId = getNextLayerOptionId(event.layerId, selectionsRef.current[event.layerId]);
      }

      const layerName = getLayer(event.layerId)?.name ?? event.layerId;
      const previousOptionName =
        getLayerOption(event.layerId, selectionsRef.current[event.layerId])?.name ?? selectionsRef.current[event.layerId];
      const optionName = getLayerOption(event.layerId, nextOptionId)?.name ?? nextOptionId;
      const sourceName =
        event.source === "hardware" ? "ESP32" : event.source === "keyboard" ? "Key" : "Mock tag";

      setLastInputLabel(`${sourceName}: ${layerName} ${previousOptionName} to ${optionName}`);
      setChangeNotice({
        layerId: event.layerId,
        source: event.source,
        sourceLabel: sourceName,
        layerName,
        previousOptionName,
        nextOptionName: optionName,
        timingLabel: isPlaying ? "switched in sync" : "changed now",
      });
      setRecentLayerId(event.layerId);

      if (changeClearRef.current) {
        clearTimeout(changeClearRef.current);
      }
      changeClearRef.current = setTimeout(() => setRecentLayerId(null), 2200);

      handleSelect(event.layerId, nextOptionId);
    },
    [handleSelect, isPlaying],
  );

  useEffect(() => {
    handleInputRef.current = handleInputEvent;
  }, [handleInputEvent]);

  useEffect(() => {
    const adapter = new KeyboardNfcMockAdapter(resolveNextOption);
    return adapter.connect((event) => handleInputRef.current(event));
  }, [resolveNextOption]);

  const handleMockTap = useCallback(
    (layerId: LayerId) => {
      handleInputEvent({
        layerId,
        optionId: resolveNextOption(layerId),
        source: "card",
      });
    },
    [handleInputEvent, resolveNextOption],
  );

  const handleTogglePlayback = async () => {
    const engine = engineRef.current;
    if (!engine || isAudioStarting) return;

    if (isPlaying) {
      engine.stop();
      setIsPlaying(false);
      return;
    }

    setIsAudioStarting(true);
    try {
      await engine.start();
      setIsPlaying(engine.isRunning);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Audio could not start.";
      setLastInputLabel(message);
      setChangeNotice(null);
    } finally {
      setIsAudioStarting(false);
    }
  };

  const handleRandomize = () => {
    const nextSelections = createRandomSelection();
    engineRef.current?.setSelections(nextSelections);
    selectionsRef.current = nextSelections;
    setSelections(nextSelections);
  };

  const handleToggleMute = (layerId: LayerId) => {
    setMutes((current) => {
      const next = { ...current, [layerId]: !current[layerId] };
      engineRef.current?.setMuted(layerId, next[layerId]);
      return next;
    });
  };

  const handleVolume = (layerId: LayerId, volume: number) => {
    setVolumes((current) => ({ ...current, [layerId]: volume }));
    engineRef.current?.setVolume(layerId, volume);
  };

  const layerColumns = useMemo(
    () =>
      LAYER_DEFINITIONS.map((layer) => (
        <LayerColumn
          key={layer.id}
          layer={layer}
          selectedOptionId={selections[layer.id]}
          muted={mutes[layer.id]}
          volume={volumes[layer.id]}
          active={tick.activeLayers.includes(layer.id)}
          recent={recentLayerId === layer.id}
          level={tick.layerLevels[layer.id]}
          onSelect={handleSelect}
          onToggleMute={handleToggleMute}
          onVolume={handleVolume}
        />
      )),
    [handleSelect, mutes, recentLayerId, selections, tick.activeLayers, tick.layerLevels, volumes],
  );

  return (
    <main className="demo-app">
      <TopBar
        isPlaying={isPlaying}
        isAudioStarting={isAudioStarting}
        engineStatus={engineStatus}
        elapsedLabel={formatTime(tick.elapsedSeconds)}
        espConnected={espConnected}
        onTogglePlayback={handleTogglePlayback}
        onRandomize={handleRandomize}
        onToggleEsp={() => setEspConnected((current) => !current)}
      />

      <div className="demo-workspace">
        <div className="channel-bank">{layerColumns}</div>
        <CompositionView
          selections={selections}
          mutedLayers={mutes}
          activeLayers={tick.activeLayers}
          layerLevels={tick.layerLevels}
          progress={tick.progress}
          elapsedLabel={formatTime(tick.elapsedSeconds)}
          durationLabel={DEMO_DURATION_LABEL}
          changeNotice={changeNotice}
        />
      </div>

      <NfcMockPanel
        onTap={handleMockTap}
        volumes={volumes}
        espConnected={espConnected}
        lastInputLabel={lastInputLabel}
      />
    </main>
  );
};

export default App;
