import * as Tone from "tone";
import {
  BPM,
  DEFAULT_MUTES,
  DEFAULT_SELECTIONS,
  DEFAULT_VOLUMES,
  getLayerMixProfile,
  LAYER_ORDER,
  STEPS_PER_BAR,
  TOTAL_STEPS,
} from "../data/layers";
import type {
  EngineTick,
  LayerId,
  MuteState,
  PendingSelectionState,
  SelectionState,
  VolumeState,
} from "../types/music";

const MASTER_LEVEL = 0.86;
const MASTER_RAMP_SECONDS = 0.12;
const LAYER_RAMP_SECONDS = 0.08;
const TRANSPORT_START_DELAY = "+0.05";

type TickListener = (tick: EngineTick) => void;
type CommitListener = (selection: SelectionState) => void;

type PatternEvent = {
  layerId: LayerId;
  instrument:
    | "kick"
    | "snare"
    | "hat"
    | "click"
    | "piano"
    | "keys"
    | "pad"
    | "chime"
    | "bass"
    | "sub"
    | "bassPluck"
    | "driveBass"
    | "lead"
    | "bell"
    | "hum"
    | "pluck";
  note?: string;
  notes?: string[];
  duration: Tone.Unit.Time;
  velocity: number;
};

type InstrumentRack = {
  kick: Tone.MembraneSynth;
  snare: Tone.NoiseSynth;
  hat: Tone.NoiseSynth;
  click: Tone.MembraneSynth;
  piano: Tone.PolySynth;
  keys: Tone.PolySynth;
  pad: Tone.PolySynth;
  chime: Tone.FMSynth;
  bass: Tone.MonoSynth;
  sub: Tone.Synth;
  bassPluck: Tone.PluckSynth;
  driveBass: Tone.MonoSynth;
  lead: Tone.Synth;
  bell: Tone.FMSynth;
  hum: Tone.Synth;
  pluck: Tone.PluckSynth;
};

const PROGRESSION = [
  {
    root: "C2",
    fifth: "G2",
    bassWalk: ["C2", "E2", "G2", "B2"],
    chord: ["C3", "E3", "G3", "B3"],
    wideChord: ["C3", "G3", "B3", "E4"],
    high: ["E5", "G5", "B5", "D6"],
  },
  {
    root: "G1",
    fifth: "D2",
    bassWalk: ["G1", "B1", "D2", "F2"],
    chord: ["G2", "D3", "G3", "B3"],
    wideChord: ["G2", "D3", "B3", "D4"],
    high: ["D5", "G5", "B5", "A5"],
  },
  {
    root: "A1",
    fifth: "E2",
    bassWalk: ["A1", "C2", "E2", "G2"],
    chord: ["A2", "E3", "A3", "C4"],
    wideChord: ["A2", "E3", "C4", "E4"],
    high: ["C5", "E5", "G5", "B5"],
  },
  {
    root: "F1",
    fifth: "C2",
    bassWalk: ["F1", "A1", "C2", "E2"],
    chord: ["F2", "C3", "A3", "C4"],
    wideChord: ["F2", "C3", "A3", "E4"],
    high: ["C5", "E5", "A5", "G5"],
  },
];

const ANALOG_HOOK = [
  ["E5", "G5", "B5", "G5"],
  ["D5", "B4", "G4", "A4"],
  ["C5", "E5", "G5", "E5"],
  ["A4", "C5", "E5", "D5"],
];

const BELL_ANSWER = [
  ["G5", "B5", "D6"],
  ["B5", "A5", "G5"],
  ["E5", "G5", "C6"],
  ["C6", "A5", "G5"],
];

const VOCAL_HUM = ["G4", "D5", "E5", "C5"];

export class ComposedMusicEngine {
  private initialized = false;
  private running = false;
  private scheduleId: number | null = null;
  private step = 0;
  private startRequestId = 0;
  private selections: SelectionState = { ...DEFAULT_SELECTIONS };
  private pendingSelections: PendingSelectionState = {};
  private hasPendingSelections = false;
  private volumes: VolumeState = { ...DEFAULT_VOLUMES };
  private mutes: MuteState = { ...DEFAULT_MUTES };
  private layerChannels: Record<LayerId, Tone.Gain> | null = null;
  private master: Tone.Gain | null = null;
  private compressor: Tone.Compressor | null = null;
  private limiter: Tone.Limiter | null = null;
  private effectNodes: Array<{ dispose: () => unknown }> = [];
  private instruments: InstrumentRack | null = null;
  private tickListener: TickListener | null = null;
  private commitListener: CommitListener | null = null;

  setTickListener(listener: TickListener) {
    this.tickListener = listener;
  }

  setCommitListener(listener: CommitListener) {
    this.commitListener = listener;
  }

  get isRunning() {
    return this.running;
  }

  async start() {
    if (this.running) return;

    const requestId = ++this.startRequestId;
    this.ensureInitialized();
    await Tone.start();

    if (!this.initialized || this.running || requestId !== this.startRequestId) return;

    Tone.Transport.bpm.value = BPM;
    Tone.Transport.stop();
    Tone.Transport.position = 0;
    this.step = 0;
    this.running = true;
    this.rampMasterLevel(MASTER_LEVEL, MASTER_RAMP_SECONDS);
    Tone.Transport.start(TRANSPORT_START_DELAY);
  }

  stop() {
    if (!this.initialized) return;
    this.startRequestId++;
    Tone.Transport.stop();
    Tone.Transport.position = 0;
    this.step = 0;
    this.running = false;
    this.commitPendingSelections();
    this.releaseAllVoices(Tone.now());
    this.rampMasterLevel(0, 0.05);
    this.emitTick({
      step: 0,
      bar: 0,
      beat: 0,
      activeLayers: [],
      isDownbeat: true,
      loopSteps: TOTAL_STEPS,
    });
  }

  dispose() {
    this.startRequestId++;
    this.running = false;

    if (this.initialized) {
      Tone.Transport.stop();
      Tone.Transport.position = 0;
    }

    if (this.scheduleId !== null) {
      Tone.Transport.clear(this.scheduleId);
    }

    if (this.instruments) {
      Object.values(this.instruments).forEach((instrument) => instrument.dispose());
    }
    if (this.layerChannels) {
      Object.values(this.layerChannels).forEach((channel) => channel.dispose());
    }
    this.master?.dispose();
    this.compressor?.dispose();
    this.limiter?.dispose();
    this.effectNodes.forEach((node) => node.dispose());

    this.scheduleId = null;
    this.instruments = null;
    this.layerChannels = null;
    this.master = null;
    this.compressor = null;
    this.limiter = null;
    this.effectNodes = [];
    this.tickListener = null;
    this.commitListener = null;
    this.pendingSelections = {};
    this.hasPendingSelections = false;
    this.step = 0;
    this.initialized = false;
  }

  setSelection(layerId: LayerId, optionId: string) {
    if (this.running) {
      this.pendingSelections[layerId] = optionId;
      this.hasPendingSelections = true;
      return;
    }

    this.selections = { ...this.selections, [layerId]: optionId };
    this.pendingSelections = {};
    this.hasPendingSelections = false;
    this.updateLayerLevel(layerId);
    this.emitCommit(this.selections);
  }

  setSelections(nextSelections: SelectionState) {
    if (this.running) {
      this.pendingSelections = { ...this.pendingSelections, ...nextSelections };
      this.hasPendingSelections = true;
      return;
    }

    this.selections = { ...nextSelections };
    this.pendingSelections = {};
    this.hasPendingSelections = false;
    this.applyAllLayerLevels();
    this.emitCommit(this.selections);
  }

  setVolume(layerId: LayerId, volume: number) {
    this.volumes = { ...this.volumes, [layerId]: volume };
    this.updateLayerLevel(layerId);
  }

  setMuted(layerId: LayerId, muted: boolean) {
    this.mutes = { ...this.mutes, [layerId]: muted };
    this.updateLayerLevel(layerId);
  }

  private ensureInitialized() {
    if (this.initialized) return;

    Tone.Transport.bpm.value = BPM;
    Tone.Transport.PPQ = 192;

    this.limiter = new Tone.Limiter(-1).toDestination();
    this.compressor = new Tone.Compressor({
      threshold: -18,
      ratio: 2.2,
      attack: 0.018,
      release: 0.22,
    }).connect(this.limiter);
    this.master = new Tone.Gain(0).connect(this.compressor);

    const rhythmFilter = new Tone.Filter(6200, "lowpass", -12).connect(this.master);
    const harmonyChorus = new Tone.Chorus(0.45, 6, 0.16).connect(this.master).start();
    const harmonyFilter = new Tone.Filter(5200, "lowpass", -12).connect(harmonyChorus);
    const bassFilter = new Tone.Filter(900, "lowpass", -24).connect(this.master);
    const melodyDelay = new Tone.FeedbackDelay("8n.", 0.18).connect(this.master);
    const melodyFilter = new Tone.Filter(6200, "lowpass", -12).connect(melodyDelay);
    this.effectNodes = [rhythmFilter, harmonyChorus, harmonyFilter, bassFilter, melodyDelay, melodyFilter];

    this.layerChannels = {
      rhythm: new Tone.Gain(this.getLayerLevel("rhythm")).connect(rhythmFilter),
      harmony: new Tone.Gain(this.getLayerLevel("harmony")).connect(harmonyFilter),
      bass: new Tone.Gain(this.getLayerLevel("bass")).connect(bassFilter),
      melody: new Tone.Gain(this.getLayerLevel("melody")).connect(melodyFilter),
    };

    this.instruments = this.createInstruments(this.layerChannels);
    this.scheduleId = Tone.Transport.scheduleRepeat((time) => this.playStep(time), "16n");
    this.initialized = true;
  }

  private createInstruments(channels: Record<LayerId, Tone.Gain>): InstrumentRack {
    const kick = new Tone.MembraneSynth({
      pitchDecay: 0.03,
      octaves: 4.2,
      oscillator: { type: "sine" },
      envelope: { attack: 0.004, decay: 0.28, sustain: 0.01, release: 0.08 },
    }).connect(channels.rhythm);

    const snare = new Tone.NoiseSynth({
      noise: { type: "pink" },
      envelope: { attack: 0.002, decay: 0.1, sustain: 0, release: 0.04 },
    }).connect(channels.rhythm);

    const hat = new Tone.NoiseSynth({
      noise: { type: "white" },
      envelope: { attack: 0.001, decay: 0.024, sustain: 0, release: 0.012 },
    }).connect(channels.rhythm);

    const click = new Tone.MembraneSynth({
      pitchDecay: 0.006,
      octaves: 1.2,
      oscillator: { type: "triangle" },
      envelope: { attack: 0.001, decay: 0.05, sustain: 0, release: 0.02 },
    }).connect(channels.rhythm);

    const piano = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "sine4" },
      envelope: { attack: 0.012, decay: 0.28, sustain: 0.36, release: 1.5 },
    }).connect(channels.harmony);

    const keys = new Tone.PolySynth(Tone.FMSynth, {
      harmonicity: 1.4,
      modulationIndex: 1.8,
      envelope: { attack: 0.01, decay: 0.2, sustain: 0.24, release: 0.8 },
      modulationEnvelope: { attack: 0.006, decay: 0.18, sustain: 0, release: 0.5 },
    }).connect(channels.harmony);

    const pad = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "sine" },
      envelope: { attack: 1.2, decay: 0.4, sustain: 0.76, release: 3.4 },
    }).connect(channels.harmony);

    const chime = new Tone.FMSynth({
      harmonicity: 1.7,
      modulationIndex: 2.8,
      envelope: { attack: 0.004, decay: 0.35, sustain: 0.05, release: 1.3 },
      modulationEnvelope: { attack: 0.002, decay: 0.18, sustain: 0, release: 0.7 },
    }).connect(channels.harmony);

    const bass = new Tone.MonoSynth({
      oscillator: { type: "triangle" },
      filter: { Q: 1.2, type: "lowpass", rolloff: -24 },
      envelope: { attack: 0.018, decay: 0.18, sustain: 0.52, release: 0.22 },
      filterEnvelope: { attack: 0.012, decay: 0.14, sustain: 0.2, release: 0.2, baseFrequency: 70, octaves: 1.9 },
    }).connect(channels.bass);

    const sub = new Tone.Synth({
      oscillator: { type: "sine" },
      envelope: { attack: 0.028, decay: 0.2, sustain: 0.78, release: 0.45 },
    }).connect(channels.bass);

    const bassPluck = new Tone.PluckSynth({
      attackNoise: 0.6,
      dampening: 1400,
      resonance: 0.78,
    }).connect(channels.bass);

    const driveBass = new Tone.MonoSynth({
      oscillator: { type: "sawtooth" },
      filter: { Q: 1.8, type: "lowpass", rolloff: -24 },
      envelope: { attack: 0.006, decay: 0.13, sustain: 0.3, release: 0.18 },
      filterEnvelope: { attack: 0.004, decay: 0.1, sustain: 0.14, release: 0.12, baseFrequency: 90, octaves: 2.2 },
    }).connect(channels.bass);

    const lead = new Tone.Synth({
      oscillator: { type: "triangle8" },
      envelope: { attack: 0.025, decay: 0.14, sustain: 0.42, release: 0.42 },
    }).connect(channels.melody);

    const bell = new Tone.FMSynth({
      harmonicity: 1.9,
      modulationIndex: 3.1,
      envelope: { attack: 0.006, decay: 0.24, sustain: 0.04, release: 1.1 },
      modulationEnvelope: { attack: 0.002, decay: 0.14, sustain: 0, release: 0.6 },
    }).connect(channels.melody);

    const hum = new Tone.Synth({
      oscillator: { type: "sine" },
      envelope: { attack: 0.22, decay: 0.2, sustain: 0.65, release: 1.1 },
    }).connect(channels.melody);

    const pluck = new Tone.PluckSynth({
      attackNoise: 0.48,
      dampening: 3200,
      resonance: 0.68,
    }).connect(channels.melody);

    return { kick, snare, hat, click, piano, keys, pad, chime, bass, sub, bassPluck, driveBass, lead, bell, hum, pluck };
  }

  private playStep(time: number) {
    const currentStep = this.step % TOTAL_STEPS;
    const bar = Math.floor(currentStep / STEPS_PER_BAR);
    const beat = Math.floor((currentStep % STEPS_PER_BAR) / 4);
    const isDownbeat = currentStep % STEPS_PER_BAR === 0;

    if (isDownbeat) {
      this.commitPendingSelections(time);
    }

    const events = this.getPatternEvents(currentStep);
    const activeLayers = [...new Set(events.map((event) => event.layerId))];

    for (const event of events) {
      this.triggerEvent(event, time);
    }

    this.emitTick({ step: currentStep, bar, beat, activeLayers, isDownbeat, loopSteps: TOTAL_STEPS }, time);
    this.step = (currentStep + 1) % TOTAL_STEPS;
  }

  private getPatternEvents(step: number) {
    const events: PatternEvent[] = [];
    for (const layerId of LAYER_ORDER) {
      if (this.mutes[layerId]) continue;
      events.push(...this.getLayerEvents(layerId, this.selections[layerId], step));
    }
    return events;
  }

  private getLayerEvents(layerId: LayerId, optionId: string, step: number): PatternEvent[] {
    const bar = Math.floor(step / STEPS_PER_BAR);
    const localStep = step % STEPS_PER_BAR;
    const chord = PROGRESSION[bar % PROGRESSION.length];

    if (layerId === "rhythm") return this.getRhythmEvents(optionId, localStep);
    if (layerId === "harmony") return this.getHarmonyEvents(optionId, localStep, chord);
    if (layerId === "bass") return this.getBassEvents(optionId, localStep, chord);
    return this.getMelodyEvents(optionId, localStep, bar, chord);
  }

  private getRhythmEvents(optionId: string, step: number): PatternEvent[] {
    const events: PatternEvent[] = [];
    const add = (instrument: PatternEvent["instrument"], velocity: number, note = "C2", duration: Tone.Unit.Time = "16n") =>
      events.push({ layerId: "rhythm", instrument, note, duration, velocity });

    if (optionId === "soft-kit") {
      if ([0, 8].includes(step)) add("kick", step === 0 ? 0.9 : 0.72, "C2", "8n");
      if ([4, 12].includes(step)) add("snare", 0.42, "C2", "16n");
      if (step % 2 === 0) add("hat", step % 4 === 2 ? 0.16 : 0.11);
      if ([7, 15].includes(step)) add("click", 0.18, "G3", "32n");
    } else if (optionId === "broken-snap") {
      if ([0, 6, 10].includes(step)) add("kick", step === 0 ? 0.82 : 0.58, "C2", "8n");
      if ([4, 11].includes(step)) add("snare", 0.5);
      if ([2, 5, 8, 14].includes(step)) add("hat", 0.14);
      if ([3, 9, 13].includes(step)) add("click", 0.22, "A3", "32n");
    } else if (optionId === "pulse-drive") {
      if ([0, 4, 8, 12].includes(step)) add("kick", step === 0 ? 0.82 : 0.66, "C2", "8n");
      if ([4, 12].includes(step)) add("snare", 0.32);
      if ([2, 6, 10, 14].includes(step)) add("hat", 0.22);
    } else {
      if ([0, 10].includes(step)) add("kick", 0.8, "C2", "8n");
      if (step === 8) add("snare", 0.58);
      if ([0, 3, 6, 10, 13].includes(step)) add("click", 0.18, "G3", "32n");
      if ([5, 15].includes(step)) add("hat", 0.1);
    }

    return events;
  }

  private getHarmonyEvents(optionId: string, step: number, chord: (typeof PROGRESSION)[number]): PatternEvent[] {
    if (optionId === "felt-piano") {
      if (step === 0) return [{ layerId: "harmony", instrument: "piano", notes: chord.wideChord, duration: "2n", velocity: 0.62 }];
      if (step === 8) return [{ layerId: "harmony", instrument: "piano", notes: chord.chord, duration: "4n", velocity: 0.38 }];
    }

    if (optionId === "tape-keys" && step % 2 === 0) {
      const note = chord.wideChord[(step / 2) % chord.wideChord.length];
      return [{ layerId: "harmony", instrument: "keys", note, duration: "8n", velocity: step % 8 === 0 ? 0.5 : 0.34 }];
    }

    if (optionId === "warm-pad" && step === 0) {
      return [{ layerId: "harmony", instrument: "pad", notes: chord.wideChord, duration: "1m", velocity: 0.44 }];
    }

    if (optionId === "glass-chimes" && [0, 5, 10, 14].includes(step)) {
      const note = chord.high[[0, 5, 10, 14].indexOf(step) % chord.high.length];
      return [{ layerId: "harmony", instrument: "chime", note, duration: "8n", velocity: step === 0 ? 0.44 : 0.3 }];
    }

    return [];
  }

  private getBassEvents(optionId: string, step: number, chord: (typeof PROGRESSION)[number]): PatternEvent[] {
    if (optionId === "round-root") {
      if (step === 0) return [{ layerId: "bass", instrument: "bass", note: chord.root, duration: "4n.", velocity: 0.86 }];
      if (step === 6) return [{ layerId: "bass", instrument: "bass", note: chord.fifth, duration: "8n", velocity: 0.52 }];
      if (step === 8) return [{ layerId: "bass", instrument: "bass", note: chord.root, duration: "4n", velocity: 0.68 }];
      if (step === 14) return [{ layerId: "bass", instrument: "bass", note: chord.bassWalk[3], duration: "8n", velocity: 0.42 }];
    }

    if (optionId === "soft-sub") {
      if (step === 0) {
        return [
          { layerId: "bass", instrument: "sub", note: chord.root, duration: "2n", velocity: 0.76 },
          { layerId: "bass", instrument: "bass", note: chord.root, duration: "16n", velocity: 0.22 },
        ];
      }
      if (step === 7) return [{ layerId: "bass", instrument: "sub", note: chord.fifth, duration: "8n", velocity: 0.34 }];
      if (step === 8) {
        return [
          { layerId: "bass", instrument: "sub", note: chord.root, duration: "4n", velocity: 0.62 },
          { layerId: "bass", instrument: "bass", note: chord.root, duration: "16n", velocity: 0.18 },
        ];
      }
    }

    if (optionId === "bass-guitar" && [0, 3, 6, 10, 12, 14].includes(step)) {
      const index = [0, 3, 6, 10, 12, 14].indexOf(step);
      const note = [chord.root, chord.fifth, chord.bassWalk[1], chord.bassWalk[2], chord.root, chord.bassWalk[3]][index];
      return [{ layerId: "bass", instrument: "bassPluck", note, duration: "8n", velocity: index === 0 ? 0.68 : 0.46 }];
    }

    if (optionId === "drive-bass" && [0, 2, 7, 8, 11, 14].includes(step)) {
      const index = [0, 2, 7, 8, 11, 14].indexOf(step);
      const note = [chord.root, chord.root, chord.fifth, chord.bassWalk[2], chord.fifth, chord.bassWalk[3]][index];
      return [{ layerId: "bass", instrument: "driveBass", note, duration: "16n", velocity: index === 0 ? 0.58 : 0.4 }];
    }

    return [];
  }

  private getMelodyEvents(optionId: string, step: number, bar: number, chord: (typeof PROGRESSION)[number]): PatternEvent[] {
    if (optionId === "analog-hook" && [0, 3, 6, 10].includes(step)) {
      const index = [0, 3, 6, 10].indexOf(step);
      return [{ layerId: "melody", instrument: "lead", note: ANALOG_HOOK[bar % 4][index], duration: "8n", velocity: index === 0 ? 0.48 : 0.36 }];
    }

    if (optionId === "bell-answer" && [2, 7, 13].includes(step)) {
      const index = [2, 7, 13].indexOf(step);
      return [{ layerId: "melody", instrument: "bell", note: BELL_ANSWER[bar % 4][index], duration: "8n", velocity: 0.32 }];
    }

    if (optionId === "vocal-hum" && step === 0) {
      return [{ layerId: "melody", instrument: "hum", note: VOCAL_HUM[bar % 4], duration: "1m", velocity: 0.34 }];
    }

    if (optionId === "pluck-counter" && [1, 4, 9, 12].includes(step)) {
      const index = [1, 4, 9, 12].indexOf(step);
      const note = [chord.high[0], chord.high[2], chord.high[1], chord.high[3]][index];
      return [{ layerId: "melody", instrument: "pluck", note, duration: "16n", velocity: index === 0 ? 0.42 : 0.28 }];
    }

    return [];
  }

  private triggerEvent(event: PatternEvent, time: Tone.Unit.Time) {
    if (!this.instruments) return;

    const note = event.note ?? "C4";
    switch (event.instrument) {
      case "kick":
      case "click":
        this.instruments[event.instrument].triggerAttackRelease(note, event.duration, time, event.velocity);
        break;
      case "snare":
      case "hat":
        this.instruments[event.instrument].triggerAttackRelease(event.duration, time, event.velocity);
        break;
      case "piano":
      case "keys":
      case "pad":
        this.instruments[event.instrument].triggerAttackRelease(event.notes ?? note, event.duration, time, event.velocity);
        break;
      case "chime":
      case "bass":
      case "sub":
      case "bassPluck":
      case "driveBass":
      case "lead":
      case "bell":
      case "hum":
      case "pluck":
        this.instruments[event.instrument].triggerAttackRelease(note, event.duration, time, event.velocity);
        break;
    }
  }

  private commitPendingSelections(time?: Tone.Unit.Time) {
    if (!this.hasPendingSelections) return;

    this.selections = { ...this.selections, ...this.pendingSelections };
    this.pendingSelections = {};
    this.hasPendingSelections = false;
    this.applyAllLayerLevels(typeof time === "number" ? time : undefined);
    this.emitCommit(this.selections, time);
  }

  private emitCommit(selection: SelectionState, time?: Tone.Unit.Time) {
    if (!this.commitListener) return;

    const committedSelection = { ...selection };
    if (time === undefined) {
      this.commitListener(committedSelection);
      return;
    }

    Tone.Draw.schedule(() => this.commitListener?.(committedSelection), time);
  }

  private applyAllLayerLevels(time?: number) {
    for (const layerId of LAYER_ORDER) {
      this.updateLayerLevel(layerId, time);
    }
  }

  private updateLayerLevel(layerId: LayerId, time = Tone.now()) {
    const channel = this.layerChannels?.[layerId];
    if (!channel) return;

    channel.gain.cancelScheduledValues(time);
    channel.gain.rampTo(this.getLayerLevel(layerId), LAYER_RAMP_SECONDS, time);
  }

  private getLayerLevel(layerId: LayerId) {
    const profile = getLayerMixProfile(layerId, this.selections[layerId]);
    return this.mutes[layerId] ? 0 : this.volumes[layerId] * profile.gain;
  }

  private rampMasterLevel(level: number, rampSeconds: number) {
    if (!this.master) return;

    const now = Tone.now();
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.rampTo(level, rampSeconds, now);
  }

  private releaseAllVoices(time: Tone.Unit.Time) {
    if (!this.instruments) return;

    this.instruments.piano.releaseAll(time);
    this.instruments.keys.releaseAll(time);
    this.instruments.pad.releaseAll(time);
    this.instruments.kick.triggerRelease(time);
    this.instruments.snare.triggerRelease(time);
    this.instruments.hat.triggerRelease(time);
    this.instruments.click.triggerRelease(time);
    this.instruments.chime.triggerRelease(time);
    this.instruments.bass.triggerRelease(time);
    this.instruments.sub.triggerRelease(time);
    this.instruments.bassPluck.triggerRelease(time);
    this.instruments.driveBass.triggerRelease(time);
    this.instruments.lead.triggerRelease(time);
    this.instruments.bell.triggerRelease(time);
    this.instruments.hum.triggerRelease(time);
    this.instruments.pluck.triggerRelease(time);
  }

  private emitTick(tick: EngineTick, time?: Tone.Unit.Time) {
    if (!this.tickListener) return;

    if (time === undefined) {
      this.tickListener(tick);
      return;
    }

    Tone.Draw.schedule(() => this.tickListener?.(tick), time);
  }
}
