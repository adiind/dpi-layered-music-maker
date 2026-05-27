import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ComposedMusicEngine } from "./audio/ComposedMusicEngine";
import { CompositionView } from "./components/CompositionView";
import { LayerColumn } from "./components/LayerColumn";
import { NfcMockPanel } from "./components/NfcMockPanel";
import { TopBar } from "./components/TopBar";
import {
  createRandomSelection,
  DEFAULT_MUTES,
  DEFAULT_SELECTIONS,
  DEFAULT_VOLUMES,
  TOTAL_STEPS,
  getLayer,
  getLayerOption,
  getNextLayerOptionId,
  LAYER_DEFINITIONS,
} from "./data/layers";
import { HardwareInputAdapter, isWebSerialNfcSupported } from "./input/HardwareInputAdapter";
import type { InputConnectionStatus } from "./input/InputAdapter";
import { KeyboardNfcMockAdapter } from "./input/MockNfcAdapter";
import type {
  ChangeNotice,
  EngineTick,
  LayerInputEvent,
  LayerId,
  MuteState,
  PendingSelectionState,
  SelectionState,
  VolumeState,
} from "./types/music";

const INITIAL_TICK: EngineTick = {
  step: 0,
  bar: 0,
  beat: 0,
  activeLayers: [],
  isDownbeat: true,
  loopSteps: TOTAL_STEPS,
};

const randomIndex = (length: number) => Math.floor(Math.random() * length);

const chooseDifferentOptionId = (layerId: LayerId, currentOptionId: string) => {
  const layer = getLayer(layerId);
  const choices = layer?.options.filter((option) => option.id !== currentOptionId) ?? [];
  return choices[randomIndex(choices.length)]?.id ?? currentOptionId;
};

const App = () => {
  const engineRef = useRef<ComposedMusicEngine | null>(null);
  const hardwareAdapterRef = useRef<HardwareInputAdapter | null>(null);
  const handleInputRef = useRef<(event: LayerInputEvent) => void>(() => undefined);
  const selectionsRef = useRef<SelectionState>({ ...DEFAULT_SELECTIONS });
  const mutesRef = useRef<MuteState>({ ...DEFAULT_MUTES });
  const changeClearRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isAudioStarting, setIsAudioStarting] = useState(false);
  const [selections, setSelections] = useState<SelectionState>({ ...DEFAULT_SELECTIONS });
  const [pendingSelections, setPendingSelections] = useState<PendingSelectionState>({});
  const [volumes, setVolumes] = useState<VolumeState>({ ...DEFAULT_VOLUMES });
  const [mutes, setMutes] = useState<MuteState>({ ...DEFAULT_MUTES });
  const [tick, setTick] = useState<EngineTick>(INITIAL_TICK);
  const [hardwareStatus, setHardwareStatus] = useState<InputConnectionStatus>({ state: "idle" });
  const [hardwareSupported] = useState(() => isWebSerialNfcSupported());
  const [lastInputLabel, setLastInputLabel] = useState("No input yet");
  const [changeNotice, setChangeNotice] = useState<ChangeNotice | null>(null);
  const [recentLayerId, setRecentLayerId] = useState<LayerId | null>(null);

  useEffect(() => {
    selectionsRef.current = selections;
  }, [selections]);

  useEffect(() => {
    mutesRef.current = mutes;
  }, [mutes]);

  useEffect(() => {
    const engine = new ComposedMusicEngine();
    engine.setTickListener(setTick);
    engine.setCommitListener((nextSelections) => {
      selectionsRef.current = nextSelections;
      setSelections(nextSelections);
      setPendingSelections({});
    });
    engineRef.current = engine;

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

  const handleSelect = useCallback(
    (layerId: LayerId, optionId: string) => {
      engineRef.current?.setSelection(layerId, optionId);

      if (isPlaying) {
        setPendingSelections((current) => ({ ...current, [layerId]: optionId }));
        return;
      }

      selectionsRef.current = { ...selectionsRef.current, [layerId]: optionId };
      setSelections((current) => ({ ...current, [layerId]: optionId }));
    },
    [isPlaying],
  );

  const handleInputEvent = useCallback(
    (event: LayerInputEvent) => {
      let nextLayerId = event.layerId;
      let nextOptionId = event.optionId;

      if (event.source === "hardware") {
        const audibleLayers = LAYER_DEFINITIONS.filter((layer) => !mutesRef.current[layer.id]);
        const layers = audibleLayers.length > 0 ? audibleLayers : LAYER_DEFINITIONS;
        const layer = layers[randomIndex(layers.length)];
        nextLayerId = layer.id;
        nextOptionId = chooseDifferentOptionId(layer.id, selectionsRef.current[layer.id]);
      } else if (nextOptionId === selectionsRef.current[nextLayerId]) {
        nextOptionId = getNextLayerOptionId(nextLayerId, selectionsRef.current[nextLayerId]);
      }

      const layerName = getLayer(nextLayerId)?.name ?? nextLayerId;
      const previousOptionName =
        getLayerOption(nextLayerId, selectionsRef.current[nextLayerId])?.name ?? selectionsRef.current[nextLayerId];
      const optionName = getLayerOption(nextLayerId, nextOptionId)?.name ?? nextOptionId;
      const sourceName =
        event.source === "hardware" ? "NFC tag" : event.source === "keyboard" ? "Key" : "Mock card";

      setLastInputLabel(`${sourceName}: ${layerName} ${previousOptionName} -> ${optionName}`);
      setChangeNotice({
        layerId: nextLayerId,
        source: event.source,
        sourceLabel: sourceName,
        layerName,
        previousOptionName,
        nextOptionName: optionName,
        timingLabel: isPlaying ? "queued next bar" : "changed now",
      });
      setRecentLayerId(nextLayerId);

      if (changeClearRef.current) {
        clearTimeout(changeClearRef.current);
      }
      changeClearRef.current = setTimeout(() => setRecentLayerId(null), 2200);

      handleSelect(nextLayerId, nextOptionId);
    },
    [handleSelect, isPlaying],
  );

  useEffect(() => {
    handleInputRef.current = handleInputEvent;
  }, [handleInputEvent]);

  useEffect(() => {
    const adapter = new HardwareInputAdapter();
    hardwareAdapterRef.current = adapter;
    const cleanupInput = adapter.connect((event) => handleInputRef.current(event));
    const cleanupStatus = adapter.onStatusChange(setHardwareStatus);

    return () => {
      cleanupInput();
      cleanupStatus();
      void adapter.disconnect();
      hardwareAdapterRef.current = null;
    };
  }, []);

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

  const handleConnectHardware = useCallback(() => {
    void hardwareAdapterRef.current?.requestAndConnect();
  }, []);

  const handleDisconnectHardware = useCallback(() => {
    void hardwareAdapterRef.current?.disconnect();
  }, []);

  useEffect(() => {
    const adapter = new KeyboardNfcMockAdapter(resolveNextOption);
    return adapter.connect(handleInputEvent);
  }, [handleInputEvent, resolveNextOption]);

  const handleTogglePlayback = async () => {
    const engine = engineRef.current;
    if (!engine || isAudioStarting) return;

    if (isPlaying) {
      engine.stop();
      setIsPlaying(false);
      setPendingSelections({});
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

    if (isPlaying) {
      setPendingSelections(nextSelections);
      return;
    }

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
          pendingOptionId={pendingSelections[layer.id]}
          muted={mutes[layer.id]}
          volume={volumes[layer.id]}
          active={tick.activeLayers.includes(layer.id)}
          recent={recentLayerId === layer.id}
          onSelect={handleSelect}
          onToggleMute={handleToggleMute}
          onVolume={handleVolume}
        />
      )),
    [handleSelect, mutes, pendingSelections, recentLayerId, selections, tick.activeLayers, volumes],
  );

  return (
    <main className="min-h-screen text-[#202124]">
      <TopBar
        isPlaying={isPlaying}
        isAudioStarting={isAudioStarting}
        onTogglePlayback={handleTogglePlayback}
        onRandomize={handleRandomize}
      />

      <div className="mx-auto flex w-full max-w-[1520px] flex-col gap-5 px-4 py-5 md:px-8">
        <div className="grid gap-5 lg:grid-cols-[0.95fr_0.95fr_1.15fr_0.95fr_0.95fr]">
          {layerColumns.slice(0, 2)}
          <CompositionView
            selections={selections}
            mutedLayers={mutes}
            activeLayers={tick.activeLayers}
            step={tick.step}
            loopSteps={tick.loopSteps ?? TOTAL_STEPS}
            changeNotice={changeNotice}
          />
          {layerColumns.slice(2)}
        </div>

        <NfcMockPanel
          onTap={handleMockTap}
          hardwareStatus={hardwareStatus}
          hardwareSupported={hardwareSupported}
          lastInputLabel={lastInputLabel}
          onConnectHardware={handleConnectHardware}
          onDisconnectHardware={handleDisconnectHardware}
        />
      </div>
    </main>
  );
};

export default App;
