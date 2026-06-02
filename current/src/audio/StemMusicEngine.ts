import * as Tone from "tone";
import {
  DEFAULT_MUTES,
  DEFAULT_SELECTIONS,
  DEFAULT_VOLUMES,
  DEMO_DURATION_SECONDS,
  getLayerOption,
  getLayerOptionGain,
  LAYER_DEFINITIONS,
  LAYER_ORDER,
  TOTAL_AUDIO_FILES,
} from "../data/layers";
import type {
  EngineStatus,
  EngineTick,
  LayerId,
  LayerLevelState,
  MuteState,
  SelectionState,
  VolumeState,
} from "../types/music";

const MASTER_LEVEL = 0.92;
const MASTER_RAMP_SECONDS = 0.14;
const LAYER_RAMP_SECONDS = 0.08;
const SWITCH_FADE_SECONDS = 0.06;
const START_DELAY_SECONDS = 0.06;

type TickListener = (tick: EngineTick) => void;
type CommitListener = (selection: SelectionState) => void;
type StatusListener = (status: EngineStatus) => void;
type PlayerRack = Record<LayerId, Record<string, Tone.Player>>;

const emptyLayerLevels = () =>
  LAYER_ORDER.reduce((levels, layerId) => ({ ...levels, [layerId]: 0 }), {} as LayerLevelState);

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

export class StemMusicEngine {
  private initialized = false;
  private running = false;
  private players: PlayerRack | null = null;
  private layerChannels: Record<LayerId, Tone.Gain> | null = null;
  private master: Tone.Gain | null = null;
  private compressor: Tone.Compressor | null = null;
  private limiter: Tone.Limiter | null = null;
  private selections: SelectionState = { ...DEFAULT_SELECTIONS };
  private volumes: VolumeState = { ...DEFAULT_VOLUMES };
  private mutes: MuteState = { ...DEFAULT_MUTES };
  private startedAt = 0;
  private animationFrame: number | null = null;
  private loadedKeys = new Set<string>();
  private loadPromise: Promise<void> | null = null;
  private tickListener: TickListener | null = null;
  private commitListener: CommitListener | null = null;
  private statusListener: StatusListener | null = null;
  private status: EngineStatus = {
    state: "idle",
    loadedCount: 0,
    totalCount: TOTAL_AUDIO_FILES,
  };

  setTickListener(listener: TickListener) {
    this.tickListener = listener;
  }

  setCommitListener(listener: CommitListener) {
    this.commitListener = listener;
  }

  setStatusListener(listener: StatusListener) {
    this.statusListener = listener;
    listener(this.status);
  }

  get isRunning() {
    return this.running;
  }

  prepare() {
    this.ensureInitialized();
    return this.loadPromise ?? Promise.resolve();
  }

  async start() {
    if (this.running) return;

    this.ensureInitialized();
    await this.loadPromise;
    await Tone.start();

    if (!this.initialized || this.running) return;

    const startTime = Tone.now() + START_DELAY_SECONDS;
    this.startedAt = startTime;
    this.running = true;
    this.rampMasterLevel(MASTER_LEVEL, MASTER_RAMP_SECONDS);
    this.startSelectedPlayers(startTime, 0);
    this.startAnimationLoop();
  }

  stop() {
    if (!this.initialized) return;

    const now = Tone.now();
    this.stopAnimationLoop();
    this.stopAllPlayers(now);
    this.running = false;
    this.rampMasterLevel(0, 0.05);
    this.emitTick(this.createTick(0));
  }

  dispose() {
    this.stopAnimationLoop();

    if (this.initialized) {
      this.stopAllPlayers(Tone.now());
    }

    if (this.players) {
      for (const layerPlayers of Object.values(this.players)) {
        Object.values(layerPlayers).forEach((player) => player.dispose());
      }
    }

    if (this.layerChannels) {
      Object.values(this.layerChannels).forEach((channel) => channel.dispose());
    }

    this.master?.dispose();
    this.compressor?.dispose();
    this.limiter?.dispose();

    this.players = null;
    this.layerChannels = null;
    this.master = null;
    this.compressor = null;
    this.limiter = null;
    this.tickListener = null;
    this.commitListener = null;
    this.statusListener = null;
    this.loadedKeys.clear();
    this.loadPromise = null;
    this.initialized = false;
    this.running = false;
  }

  setSelection(layerId: LayerId, optionId: string) {
    const previousOptionId = this.selections[layerId];
    if (previousOptionId === optionId) return;

    this.selections = { ...this.selections, [layerId]: optionId };
    this.updateLayerLevel(layerId);

    if (this.running) {
      this.switchLayerPlayer(layerId, previousOptionId, optionId);
    }

    this.emitCommit(this.selections);
  }

  setSelections(nextSelections: SelectionState) {
    const previousSelections = this.selections;
    this.selections = { ...nextSelections };
    this.applyAllLayerLevels();

    if (this.running) {
      for (const layerId of LAYER_ORDER) {
        if (previousSelections[layerId] !== nextSelections[layerId]) {
          this.switchLayerPlayer(layerId, previousSelections[layerId], nextSelections[layerId]);
        }
      }
    }

    this.emitCommit(this.selections);
  }

  setVolume(layerId: LayerId, volume: number) {
    this.volumes = { ...this.volumes, [layerId]: volume };
    this.updateLayerLevel(layerId);
  }

  setMuted(layerId: LayerId, muted: boolean) {
    this.mutes = { ...this.mutes, [layerId]: muted };
    this.updateLayerLevel(layerId);

    if (!this.running) return;

    const player = this.players?.[layerId][this.selections[layerId]];
    const now = Tone.now();
    if (muted) {
      player?.stop(now + SWITCH_FADE_SECONDS);
      return;
    }

    player?.start(now, this.currentOffset());
  }

  private ensureInitialized() {
    if (this.initialized) return;

    this.setStatus({
      state: "loading",
      loadedCount: this.loadedKeys.size,
      totalCount: TOTAL_AUDIO_FILES,
      message: "Loading DPI Music stems",
    });

    this.limiter = new Tone.Limiter(-1).toDestination();
    this.compressor = new Tone.Compressor({
      threshold: -16,
      ratio: 2.4,
      attack: 0.012,
      release: 0.2,
    }).connect(this.limiter);
    this.master = new Tone.Gain(0).connect(this.compressor);

    this.layerChannels = LAYER_ORDER.reduce((channels, layerId) => {
      channels[layerId] = new Tone.Gain(this.getLayerLevel(layerId)).connect(this.master!);
      return channels;
    }, {} as Record<LayerId, Tone.Gain>);

    this.players = LAYER_DEFINITIONS.reduce((rack, layer) => {
      rack[layer.id] = {};

      for (const option of layer.options) {
        const key = `${layer.id}:${option.id}`;
        const player = new Tone.Player({
          url: option.url,
          loop: true,
          loopStart: 0,
          loopEnd: DEMO_DURATION_SECONDS,
          fadeIn: SWITCH_FADE_SECONDS,
          fadeOut: SWITCH_FADE_SECONDS,
          onload: () => this.markLoaded(key),
          onerror: (error) => {
            this.setStatus({
              state: "error",
              loadedCount: this.loadedKeys.size,
              totalCount: TOTAL_AUDIO_FILES,
              message: error.message,
            });
          },
        }).connect(this.layerChannels![layer.id]);

        rack[layer.id][option.id] = player;
      }

      return rack;
    }, {} as PlayerRack);

    this.loadPromise = Tone.loaded()
      .then(() => {
        this.setStatus({
          state: "ready",
          loadedCount: TOTAL_AUDIO_FILES,
          totalCount: TOTAL_AUDIO_FILES,
          message: "Ready",
        });
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : "Audio loading failed.";
        this.setStatus({
          state: "error",
          loadedCount: this.loadedKeys.size,
          totalCount: TOTAL_AUDIO_FILES,
          message,
        });
        throw error;
      });

    this.initialized = true;
  }

  private markLoaded(key: string) {
    this.loadedKeys.add(key);
    if (this.status.state !== "loading") return;

    this.setStatus({
      state: "loading",
      loadedCount: this.loadedKeys.size,
      totalCount: TOTAL_AUDIO_FILES,
      message: "Loading DPI Music stems",
    });
  }

  private startSelectedPlayers(time: number, offset: number) {
    if (!this.players) return;

    for (const layerId of LAYER_ORDER) {
      if (this.mutes[layerId]) continue;
      this.players[layerId][this.selections[layerId]]?.start(time, offset);
    }
  }

  private switchLayerPlayer(layerId: LayerId, previousOptionId: string, nextOptionId: string) {
    if (!this.players || this.mutes[layerId]) return;

    const now = Tone.now();
    const offset = this.currentOffset(now);
    this.players[layerId][previousOptionId]?.stop(now + SWITCH_FADE_SECONDS);
    this.players[layerId][nextOptionId]?.start(now, offset);
  }

  private stopAllPlayers(time: number) {
    if (!this.players) return;

    for (const layerPlayers of Object.values(this.players)) {
      Object.values(layerPlayers).forEach((player) => player.stop(time));
    }
  }

  private currentOffset(now = Tone.now()) {
    if (!this.running) return 0;

    const elapsed = Math.max(0, now - this.startedAt);
    return elapsed % DEMO_DURATION_SECONDS;
  }

  private applyAllLayerLevels() {
    for (const layerId of LAYER_ORDER) {
      this.updateLayerLevel(layerId);
    }
  }

  private updateLayerLevel(layerId: LayerId) {
    const channel = this.layerChannels?.[layerId];
    if (!channel) return;

    const now = Tone.now();
    channel.gain.cancelScheduledValues(now);
    channel.gain.rampTo(this.getLayerLevel(layerId), LAYER_RAMP_SECONDS, now);
  }

  private getLayerLevel(layerId: LayerId) {
    return this.mutes[layerId] ? 0 : this.volumes[layerId] * getLayerOptionGain(layerId, this.selections[layerId]);
  }

  private rampMasterLevel(level: number, rampSeconds: number) {
    if (!this.master) return;

    const now = Tone.now();
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.rampTo(level, rampSeconds, now);
  }

  private startAnimationLoop() {
    this.stopAnimationLoop();

    const render = () => {
      const offset = this.currentOffset();
      this.emitTick(this.createTick(offset));
      this.animationFrame = requestAnimationFrame(render);
    };

    render();
  }

  private stopAnimationLoop() {
    if (this.animationFrame === null) return;

    cancelAnimationFrame(this.animationFrame);
    this.animationFrame = null;
  }

  private createTick(offset: number): EngineTick {
    const progress = clamp01(offset / DEMO_DURATION_SECONDS);
    const activeLayers = LAYER_ORDER.filter((layerId) => !this.mutes[layerId] && this.getLayerLevel(layerId) > 0);

    return {
      progress,
      elapsedSeconds: offset,
      durationSeconds: DEMO_DURATION_SECONDS,
      activeLayers,
      layerLevels: this.createLayerLevels(progress),
    };
  }

  private createLayerLevels(progress: number) {
    return LAYER_ORDER.reduce((levels, layerId, index) => {
      if (this.mutes[layerId]) {
        levels[layerId] = 0;
        return levels;
      }

      const option = getLayerOption(layerId, this.selections[layerId]);
      const phase = progress * Math.PI * 2;
      const pulse = Math.sin(phase * (index + 1.6) + index * 0.7) * 0.5 + 0.5;
      const accent = Math.sin(phase * (index + 3.1)) > 0.75 ? 0.22 : 0;
      levels[layerId] = clamp01((0.32 + pulse * 0.46 + accent) * this.volumes[layerId] * (option?.defaultGain ?? 1));
      return levels;
    }, emptyLayerLevels());
  }

  private emitCommit(selection: SelectionState) {
    this.commitListener?.({ ...selection });
  }

  private emitTick(tick: EngineTick) {
    this.tickListener?.(tick);
  }

  private setStatus(status: EngineStatus) {
    this.status = status;
    this.statusListener?.(status);
  }
}
