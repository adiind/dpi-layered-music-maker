import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StemMusicEngine } from "./audio/StemMusicEngine";
import { CompositionView } from "./components/CompositionView";
import { LayerColumn } from "./components/LayerColumn";
import { NfcMockPanel } from "./components/NfcMockPanel";
import { NfcStudio } from "./components/NfcStudio";
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
import {
  NFC_TAG_IDS,
  loadNfcAssignments,
  resetNfcAssignments,
  resolveNfcAssignment,
  updateNfcAssignment,
} from "./data/nfcAssignments";
import { HardwareInputAdapter, isWebSerialNfcSupported } from "./input/HardwareInputAdapter";
import type { InputConnectionStatus } from "./input/InputAdapter";
import { KeyboardNfcMockAdapter } from "./input/MockNfcAdapter";
import type {
  ChangeNotice,
  EngineStatus,
  EngineTick,
  HardwareActivity,
  LayerInputEvent,
  LayerId,
  LayerLevelState,
  MuteState,
  NfcReaderStatus,
  NfcWriteStatus,
  NfcTagAssignment,
  NfcTagId,
  SelectionState,
  VolumeState,
} from "./types/music";

type AppTab = "mix" | "nfc";

interface InputEventOptions {
  cycleIfSame?: boolean;
  sourceLabel?: string;
}

const formatNow = () =>
  new Date().toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });

const getReaderNumber = (tagId: NfcTagId) => Number(tagId.replace("tag-", ""));
const getReaderLabel = (tagId: NfcTagId) => `Reader ${getReaderNumber(tagId)}`;

const isNfcTagId = (value: string): value is NfcTagId =>
  NFC_TAG_IDS.includes(value as NfcTagId);

const createEmptyLayerLevels = () =>
  LAYER_ORDER.reduce((levels, layerId) => ({ ...levels, [layerId]: 0 }), {} as LayerLevelState);

const createInitialReaderStatuses = (): Record<NfcTagId, NfcReaderStatus> =>
  NFC_TAG_IDS.reduce(
    (statuses, tagId) => ({
      ...statuses,
      [tagId]: {
        tagId,
        state: "unknown",
        title: `${getReaderLabel(tagId)} waiting`,
        detail: "Connect ESP32 to check this reader.",
        atLabel: "Waiting",
      },
    }),
    {} as Record<NfcTagId, NfcReaderStatus>,
  );

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

const INITIAL_HARDWARE_STATUS: InputConnectionStatus = {
  state: isWebSerialNfcSupported() ? "disconnected" : "unsupported",
};

const INITIAL_HARDWARE_ACTIVITY: HardwareActivity = {
  kind: "idle",
  title: "No hardware read yet",
  detail: "Connect ESP32 or use Test Reader Slot.",
  atLabel: "Waiting",
};

const INITIAL_NFC_WRITE_STATUS: NfcWriteStatus = {
  state: "idle",
  title: "No card write yet",
  detail: "Choose a reader slot and option, then write an NTAG card.",
  atLabel: "Waiting",
};

const formatTime = (seconds: number) => {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const remainder = safeSeconds % 60;
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
};

const App = () => {
  const engineRef = useRef<StemMusicEngine | null>(null);
  const hardwareAdapterRef = useRef<HardwareInputAdapter | null>(null);
  const handleInputRef = useRef<(event: LayerInputEvent, options?: InputEventOptions) => void>(() => undefined);
  const selectionsRef = useRef<SelectionState>({ ...DEFAULT_SELECTIONS });
  const nfcAssignmentsRef = useRef<NfcTagAssignment[]>([]);
  const pendingReaderTagRef = useRef<NfcTagId | null>(null);
  const changeClearRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isAudioStarting, setIsAudioStarting] = useState(false);
  const [hardwareStatus, setHardwareStatus] = useState<InputConnectionStatus>(INITIAL_HARDWARE_STATUS);
  const [engineStatus, setEngineStatus] = useState<EngineStatus>(INITIAL_ENGINE_STATUS);
  const [selections, setSelections] = useState<SelectionState>({ ...DEFAULT_SELECTIONS });
  const [volumes, setVolumes] = useState<VolumeState>({ ...DEFAULT_VOLUMES });
  const [mutes, setMutes] = useState<MuteState>({ ...DEFAULT_MUTES });
  const [tick, setTick] = useState<EngineTick>(INITIAL_TICK);
  const [lastInputLabel, setLastInputLabel] = useState("No input yet");
  const [changeNotice, setChangeNotice] = useState<ChangeNotice | null>(null);
  const [recentLayerId, setRecentLayerId] = useState<LayerId | null>(null);
  const [activeTab, setActiveTab] = useState<AppTab>("mix");
  const [nfcAssignments, setNfcAssignments] = useState<NfcTagAssignment[]>(() => loadNfcAssignments());
  const [selectedTagId, setSelectedTagId] = useState<NfcTagId>("tag-1");
  const [hardwareActivity, setHardwareActivity] = useState<HardwareActivity>(INITIAL_HARDWARE_ACTIVITY);
  const [hardwareLines, setHardwareLines] = useState<string[]>([]);
  const [nfcWriteStatus, setNfcWriteStatus] = useState<NfcWriteStatus>(INITIAL_NFC_WRITE_STATUS);
  const [readerStatuses, setReaderStatuses] = useState<Record<NfcTagId, NfcReaderStatus>>(() => createInitialReaderStatuses());
  const espConnected = hardwareStatus.state === "connected";

  useEffect(() => {
    selectionsRef.current = selections;
  }, [selections]);

  useEffect(() => {
    nfcAssignmentsRef.current = nfcAssignments;
  }, [nfcAssignments]);

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
    (event: LayerInputEvent, options: InputEventOptions = {}) => {
      const shouldCycleIfSame = options.cycleIfSame ?? true;
      let nextOptionId = event.optionId;

      if (shouldCycleIfSame && nextOptionId === selectionsRef.current[event.layerId]) {
        nextOptionId = getNextLayerOptionId(event.layerId, selectionsRef.current[event.layerId]);
      }

      const layerName = getLayer(event.layerId)?.name ?? event.layerId;
      const previousOptionName =
        getLayerOption(event.layerId, selectionsRef.current[event.layerId])?.name ?? selectionsRef.current[event.layerId];
      const optionName = getLayerOption(event.layerId, nextOptionId)?.name ?? nextOptionId;
      const defaultSourceName =
        event.source === "hardware" ? "ESP32" : event.source === "keyboard" ? "Key" : "Mock tag";
      const sourceName = options.sourceLabel ?? defaultSourceName;
      const inputLabel =
        previousOptionName === optionName
          ? `${sourceName}: ${layerName} stayed on ${optionName}`
          : `${sourceName}: ${layerName} ${previousOptionName} to ${optionName}`;

      setLastInputLabel(inputLabel);
      setChangeNotice({
        layerId: event.layerId,
        source: event.source,
        sourceLabel: sourceName,
        layerName,
        previousOptionName,
        nextOptionName: optionName,
        timingLabel: previousOptionName === optionName ? "assignment previewed" : isPlaying ? "switched in sync" : "changed now",
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
    const adapter = new HardwareInputAdapter();
    hardwareAdapterRef.current = adapter;

    const updateReaderStatus = (tagId: NfcTagId, status: Omit<NfcReaderStatus, "tagId">) => {
      setReaderStatuses((current) => ({
        ...current,
        [tagId]: {
          tagId,
          ...status,
        },
      }));
    };

    const disconnectInput = adapter.connect((event) => {
      if (event.tagId) {
        const layer = getLayer(event.layerId);
        const option = getLayerOption(event.layerId, event.optionId);

        setSelectedTagId(event.tagId);
        setHardwareActivity({
          kind: "read",
          title: `${getReaderLabel(event.tagId)} read`,
          detail: `${layer?.name ?? event.layerId} / ${option?.name ?? event.optionId}${event.uid ? ` - ${event.uid}` : ""}`,
          tagId: event.tagId,
          atLabel: formatNow(),
        });
      } else if (event.source === "hardware") {
        const layer = getLayer(event.layerId);
        const option = getLayerOption(event.layerId, event.optionId);

        setHardwareActivity({
          kind: "read",
          title: "ESP32 input read",
          detail: `${layer?.name ?? event.layerId} / ${option?.name ?? event.optionId}`,
          atLabel: formatNow(),
        });
      }

      handleInputRef.current(event, {
        cycleIfSame: !event.tagId,
        sourceLabel: event.tagId ? `${getReaderLabel(event.tagId)} card` : undefined,
      });
    });
    const disconnectStatus = adapter.onStatusChange((status) => {
      setHardwareStatus(status);

      if (status.state === "connected") {
        pendingReaderTagRef.current = null;
        setReaderStatuses(createInitialReaderStatuses());
        setLastInputLabel(`ESP32 connected: ${status.portName ?? "serial port"}`);
        setHardwareActivity({
          kind: "connect",
          title: "ESP32 connected",
          detail: status.portName ?? "Serial port connected.",
          atLabel: formatNow(),
        });
      }

      if (status.state === "unsupported" || status.state === "error") {
        setLastInputLabel(status.message ?? "ESP32 serial input is not available.");
        setHardwareActivity({
          kind: "connect",
          title: status.state === "unsupported" ? "Web Serial unavailable" : "ESP32 connection error",
          detail: status.message ?? "ESP32 serial input is not available.",
          atLabel: formatNow(),
        });
      }
    });
    const disconnectLines = adapter.onSerialLine((line) => {
      setHardwareLines((current) => [line, ...current].slice(0, 8));

      const nowLabel = formatNow();
      const readerStartMatch = line.match(/^PN532\s+(tag-[1-5])\s+(.+?):\s+trying/i);
      const tagReadMatch = line.match(/^TAG:\s*(tag-[1-5])\s*:?\s*([0-9a-fA-F:\-\s]*)/i);

      if (readerStartMatch) {
        const tagId = readerStartMatch[1].toLowerCase();
        if (isNfcTagId(tagId)) {
          pendingReaderTagRef.current = tagId;
          updateReaderStatus(tagId, {
            state: "checking",
            title: `${getReaderLabel(tagId)} initializing`,
            detail: line,
            atLabel: nowLabel,
          });
        }
      } else if (/no response/i.test(line)) {
        const tagId = pendingReaderTagRef.current;
        if (tagId) {
          updateReaderStatus(tagId, {
            state: "missing",
            title: `${getReaderLabel(tagId)} no response`,
            detail: line,
            atLabel: nowLabel,
          });
        }
        setHardwareActivity({
          kind: "serial",
          title: "Reader not responding",
          detail: line,
          tagId: tagId ?? undefined,
          atLabel: nowLabel,
        });
      } else if (/found PN5/i.test(line)) {
        const tagId = pendingReaderTagRef.current;
        if (tagId) {
          updateReaderStatus(tagId, {
            state: "detected",
            title: `${getReaderLabel(tagId)} detected`,
            detail: line,
            atLabel: nowLabel,
          });
        }
        setHardwareActivity({
          kind: "serial",
          title: "Reader detected",
          detail: line,
          tagId: tagId ?? undefined,
          atLabel: nowLabel,
        });
      } else if (tagReadMatch) {
        const tagId = tagReadMatch[1].toLowerCase();
        const uid = tagReadMatch[2]?.match(/[0-9a-fA-F]{2}/g)?.map((byte) => byte.toUpperCase()).join(":");
        if (isNfcTagId(tagId)) {
          updateReaderStatus(tagId, {
            state: "tag-unassigned",
            title: `${getReaderLabel(tagId)} unassigned tag`,
            detail: uid ? `UID ${uid} - no DPI payload yet` : "Raw NFC tag detected without a DPI payload.",
            uid,
            atLabel: nowLabel,
          });
        }
      } else if (/DPI ESP32 layer controller/i.test(line)) {
        pendingReaderTagRef.current = null;
        setReaderStatuses(createInitialReaderStatuses());
        setHardwareActivity({
          kind: "serial",
          title: "Firmware booted",
          detail: line,
          atLabel: nowLabel,
        });
      }
    });
    const disconnectCardEvents = adapter.onCardEvent((event) => {
      const layer = event.layerId ? getLayer(event.layerId) : undefined;
      const option = event.layerId && event.optionId ? getLayerOption(event.layerId, event.optionId) : undefined;
      const readerLabel = getReaderLabel(event.tagId);
      const detail =
        layer && option
          ? `${layer.name} / ${option.name}${event.uid ? ` - ${event.uid}` : ""}`
          : event.message ?? "Card event received.";

      if (event.kind === "write-ready") {
        setNfcWriteStatus({
          state: "ready",
          title: `${readerLabel} ready to write`,
          detail: event.payload ?? "Tap the selected NTAG card now.",
          tagId: event.tagId,
          layerId: event.layerId,
          optionId: event.optionId,
          payload: event.payload,
          atLabel: formatNow(),
        });
        setHardwareActivity({
          kind: "write",
          title: "Ready to write card",
          detail: event.payload ?? "Hold the card on the reader.",
          tagId: event.tagId,
          atLabel: formatNow(),
        });
        return;
      }

      if (event.kind === "write-success") {
        updateReaderStatus(event.tagId, {
          state: "tag-assigned",
          title: `${readerLabel} wrote card`,
          detail,
          uid: event.uid,
          layerId: event.layerId,
          optionId: event.optionId,
          payload: event.payload,
          atLabel: formatNow(),
        });
        setNfcWriteStatus({
          state: "verified",
          title: `${readerLabel} written and verified`,
          detail,
          tagId: event.tagId,
          layerId: event.layerId,
          optionId: event.optionId,
          uid: event.uid,
          payload: event.payload,
          atLabel: formatNow(),
        });
        setHardwareActivity({
          kind: "write",
          title: "Card write verified",
          detail,
          tagId: event.tagId,
          atLabel: formatNow(),
        });
        return;
      }

      if (event.kind === "read-card") {
        setSelectedTagId(event.tagId);
        updateReaderStatus(event.tagId, {
          state: "tag-assigned",
          title: `${readerLabel} DPI card`,
          detail,
          uid: event.uid,
          layerId: event.layerId,
          optionId: event.optionId,
          payload: event.payload,
          atLabel: formatNow(),
        });
        setNfcWriteStatus({
          state: "read",
          title: `${readerLabel} card memory read`,
          detail,
          tagId: event.tagId,
          layerId: event.layerId,
          optionId: event.optionId,
          uid: event.uid,
          payload: event.payload,
          atLabel: formatNow(),
        });
        setHardwareActivity({
          kind: "read",
          title: "Card memory applied",
          detail,
          tagId: event.tagId,
          atLabel: formatNow(),
        });
        return;
      }

      const failed = event.kind === "unsupported" ? "unsupported" : "failed";
      updateReaderStatus(event.tagId, {
        state: event.kind === "unsupported" ? "tag-unsupported" : "detected",
        title: event.kind === "unsupported" ? `${readerLabel} unsupported tag` : `${readerLabel} detected`,
        detail: event.message ?? "Card event received.",
        uid: event.uid,
        atLabel: formatNow(),
      });
      setNfcWriteStatus({
        state: failed,
        title: event.kind === "unsupported" ? `${readerLabel} tag unsupported` : `${readerLabel} write failed`,
        detail: event.message ?? "The ESP32 could not write this tag.",
        tagId: event.tagId,
        uid: event.uid,
        atLabel: formatNow(),
      });
      setHardwareActivity({
        kind: "write",
        title: event.kind === "unsupported" ? "Unsupported NFC tag" : "Card write failed",
        detail: event.message ?? "The ESP32 could not write this tag.",
        tagId: event.tagId,
        atLabel: formatNow(),
      });
    });

    return () => {
      disconnectInput();
      disconnectStatus();
      disconnectLines();
      disconnectCardEvents();
      void adapter.disconnect();
      hardwareAdapterRef.current = null;
    };
  }, []);

  useEffect(() => {
    const adapter = new KeyboardNfcMockAdapter(resolveNextOption);
    return adapter.connect((event) => handleInputRef.current(event));
  }, [resolveNextOption]);

  const handleProgrammedTagTap = useCallback(
    (tagId: NfcTagId) => {
      const assignment = resolveNfcAssignment(nfcAssignments, tagId);
      const layer = getLayer(assignment.layerId);
      const option = getLayerOption(assignment.layerId, assignment.optionId);

      setSelectedTagId(tagId);
      setHardwareActivity({
        kind: "test",
        title: `Tested ${getReaderLabel(tagId)}`,
        detail: `${layer?.name ?? assignment.layerId} / ${option?.name ?? assignment.optionId}`,
        tagId,
        atLabel: formatNow(),
      });

      handleInputEvent({
        layerId: assignment.layerId,
        optionId: assignment.optionId,
        source: "card",
        tagId,
      }, {
        cycleIfSame: false,
        sourceLabel: getReaderLabel(tagId),
      });
    },
    [handleInputEvent, nfcAssignments],
  );

  const handleAssignNfcTag = useCallback((tagId: NfcTagId, layerId: LayerId, optionId: string) => {
    const layer = getLayer(layerId);
    const option = getLayerOption(layerId, optionId);

    setNfcAssignments((current) => updateNfcAssignment(current, tagId, layerId, optionId));
    setHardwareActivity({
      kind: "assign",
      title: `Assigned ${getReaderLabel(tagId)}`,
      detail: `${layer?.name ?? layerId} / ${option?.name ?? optionId}`,
      tagId,
      atLabel: formatNow(),
    });
  }, []);

  const handleWriteNfcTag = useCallback(async (tagId: NfcTagId) => {
    const adapter = hardwareAdapterRef.current;
    const assignment = resolveNfcAssignment(nfcAssignments, tagId);
    const layer = getLayer(assignment.layerId);
    const option = getLayerOption(assignment.layerId, assignment.optionId);
    const detail = `${layer?.name ?? assignment.layerId} / ${option?.name ?? assignment.optionId}`;

    setSelectedTagId(tagId);

    if (!adapter || hardwareStatus.state !== "connected") {
      setNfcWriteStatus({
        state: "failed",
        title: "Connect ESP32 first",
        detail: "Card writing needs the browser serial connection to the ESP32.",
        tagId,
        layerId: assignment.layerId,
        optionId: assignment.optionId,
        atLabel: formatNow(),
      });
      return;
    }

    setNfcWriteStatus({
      state: "queued",
      title: `Writing ${getReaderLabel(tagId)}`,
      detail: `${detail}. Hold the NTAG card on the selected reader.`,
      tagId,
      layerId: assignment.layerId,
      optionId: assignment.optionId,
      payload: `dpi://v1/layer/${assignment.layerId}/option/${assignment.optionId}`,
      atLabel: formatNow(),
    });
    setHardwareActivity({
      kind: "write",
      title: `Write command sent to ${getReaderLabel(tagId)}`,
      detail,
      tagId,
      atLabel: formatNow(),
    });

    try {
      await adapter.writeTag(tagId, assignment.layerId, assignment.optionId);
    } catch (error) {
      const message = error instanceof Error ? error.message : "The write command could not be sent.";
      setNfcWriteStatus({
        state: "failed",
        title: "Write command failed",
        detail: message,
        tagId,
        layerId: assignment.layerId,
        optionId: assignment.optionId,
        atLabel: formatNow(),
      });
      setHardwareActivity({
        kind: "write",
        title: "Write command failed",
        detail: message,
        tagId,
        atLabel: formatNow(),
      });
    }
  }, [hardwareStatus.state, nfcAssignments]);

  const handleResetNfcTags = useCallback(() => {
    setNfcAssignments(resetNfcAssignments());
    setSelectedTagId("tag-1");
    setHardwareActivity({
      kind: "assign",
      title: "Assignments reset",
      detail: "Reader slots returned to the default five-layer setup.",
      tagId: "tag-1",
      atLabel: formatNow(),
    });
  }, []);

  const handleToggleHardware = useCallback(async () => {
    const adapter = hardwareAdapterRef.current;
    if (!adapter) return;

    if (hardwareStatus.state === "connected" || hardwareStatus.state === "connecting" || hardwareStatus.state === "requesting") {
      await adapter.disconnect();
      setLastInputLabel("ESP32 disconnected");
      setHardwareActivity({
        kind: "connect",
        title: "ESP32 disconnected",
        detail: "Hardware reads are paused.",
        atLabel: formatNow(),
      });
      return;
    }

    if (!isWebSerialNfcSupported()) {
      setLastInputLabel("Web Serial is not available in this browser.");
      setHardwareStatus({ state: "unsupported", message: "Web Serial is not available in this browser." });
      return;
    }

    const status = await adapter.requestAndConnect();
    if (status.message) {
      setLastInputLabel(status.message);
    }
  }, [hardwareStatus.state]);

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
        onToggleEsp={handleToggleHardware}
      />

      <nav className="app-tabs" aria-label="Demo views">
        <button
          type="button"
          onClick={() => setActiveTab("mix")}
          className={activeTab === "mix" ? "active" : ""}
          aria-pressed={activeTab === "mix"}
        >
          Mix
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("nfc")}
          className={activeTab === "nfc" ? "active" : ""}
          aria-pressed={activeTab === "nfc"}
        >
          NFC Studio
        </button>
      </nav>

      {activeTab === "mix" ? (
        <>
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
            assignments={nfcAssignments}
            onTap={handleProgrammedTagTap}
            volumes={volumes}
            espConnected={espConnected}
            lastInputLabel={lastInputLabel}
          />
        </>
      ) : (
        <NfcStudio
          assignments={nfcAssignments}
          selectedTagId={selectedTagId}
          onSelectTag={setSelectedTagId}
          onAssign={handleAssignNfcTag}
          onTestTag={handleProgrammedTagTap}
          onReset={handleResetNfcTags}
          hardwareConnected={espConnected}
          hardwareState={hardwareStatus.state}
          hardwareMessage={hardwareStatus.message}
          hardwareActivity={hardwareActivity}
          hardwareLines={hardwareLines}
          writeStatus={nfcWriteStatus}
          readerStatuses={readerStatuses}
          onWriteTag={handleWriteNfcTag}
          onToggleHardware={handleToggleHardware}
        />
      )}
    </main>
  );
};

export default App;
