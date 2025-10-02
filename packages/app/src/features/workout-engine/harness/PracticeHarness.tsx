import { useCallback, useMemo, useRef, useState } from 'react';

import { buttons, typography } from '@/app/theme';
import { useEventBus, useEventSubscription } from '@/services/event-bus';
import type { CameraAngle, PoseBackend, PoseWorkerPhaseState } from '@/workers';
import type { EngineCommand, EngineEvent, WorkoutEngineMode } from '../core';

const MAX_LOG_ENTRIES = 20;

interface CommandLogEntry {
  readonly command: EngineCommand;
  readonly issuedAt: number;
}

type PosePipelineStatus = 'idle' | 'starting' | 'running' | 'error';

interface PoseDebugMetrics {
  readonly fps?: number;
  readonly backend?: PoseBackend;
  readonly theta?: number;
  readonly state?: PoseWorkerPhaseState;
  readonly valid?: boolean;
  readonly lastUpdated?: number;
  readonly confidence?: number;
}

export function PracticeHarness() {
  const bus = useEventBus();
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const [mode, setMode] = useState<WorkoutEngineMode>('IDLE');
  const [totalReps, setTotalReps] = useState(0);
  const [lastEventTs, setLastEventTs] = useState<number | undefined>(undefined);
  const [events, setEvents] = useState<EngineEvent[]>([]);
  const [commands, setCommands] = useState<CommandLogEntry[]>([]);
  const [currentSetIndex, setCurrentSetIndex] = useState<number | null>(null);
  const [currentSetReps, setCurrentSetReps] = useState(0);
  const [completedSets, setCompletedSets] = useState(0);
  const [nextSetIndex, setNextSetIndex] = useState(0);
  const [autoStream, setAutoStream] = useState(false);
  const [targetReps, setTargetReps] = useState(30);

  const [poseStatus, setPoseStatus] = useState<PosePipelineStatus>('idle');
  const [poseError, setPoseError] = useState<string | null>(null);
  const [poseLost, setPoseLost] = useState(false);
  const [poseDebugEnabled, setPoseDebugEnabled] = useState(import.meta.env.DEV);
  const [poseMetrics, setPoseMetrics] = useState<PoseDebugMetrics>({});
  const [cameraAngle, setCameraAngle] = useState<CameraAngle>('front');

  // Voice state
  function parseBooleanFlag(value: string | undefined, defaultValue: boolean): boolean {
    if (value == null) return defaultValue;
    const normalized = value.trim().toLowerCase();
    return !(normalized === 'false' || normalized === '0' || normalized === 'off' || normalized === 'no');
  }
  const devTtsEnabled = import.meta.env.DEV && parseBooleanFlag(import.meta.env.VITE_VOICE_DEV_TTS, false);
  const webAudioEnabled = parseBooleanFlag(import.meta.env.VITE_VOICE_WEB_AUDIO, true);
  const voiceDriver = webAudioEnabled ? 'Web Audio' : devTtsEnabled ? 'Dev TTS' : 'Silent';

  const [voicePrimed, setVoicePrimed] = useState(false);
  const [voiceMuted, setVoiceMuted] = useState(false);
  const [voiceVolume, setVoiceVolume] = useState(1);
  const [voiceRate, setVoiceRate] = useState(1);
  const [voiceLast, setVoiceLast] = useState<string | null>(null);
  const [voiceBlocked, setVoiceBlocked] = useState(false);
  const [voiceDecodeProgress, setVoiceDecodeProgress] = useState(0);
  const [voiceBufferCount, setVoiceBufferCount] = useState(0);
  const [voiceP95, setVoiceP95] = useState(0);
  const [voiceCaption, setVoiceCaption] = useState<string | null>(null);

  useEventSubscription('engine:event', (event) => {
    setEvents((prev) => [event, ...prev].slice(0, MAX_LOG_ENTRIES));

    switch (event.type) {
      case 'WORKOUT_STARTED':
        setMode('PRACTICE');
        setTotalReps(0);
        setLastEventTs(event.ts);
        setCurrentSetIndex(null);
        setCurrentSetReps(0);
        setCompletedSets(0);
        setNextSetIndex(0);
        break;
      case 'REP_TICK':
        setTotalReps(event.totalReps);
        setCurrentSetReps(event.repCount);
        setLastEventTs(event.ts);
        break;
      case 'SET_STARTED':
        setMode('PRACTICE');
        setCurrentSetIndex(event.setIndex);
        setCurrentSetReps(0);
        setLastEventTs(event.ts);
        setNextSetIndex(event.setIndex + 1);
        break;
      case 'SET_COMPLETE':
        setCurrentSetIndex(null);
        setCurrentSetReps(0);
        setCompletedSets((count) => count + 1);
        setLastEventTs(event.ts);
        setNextSetIndex(event.setIndex + 1);
        setAutoStream(false);
        break;
      case 'WORKOUT_COMPLETE':
        setMode('COMPLETE');
        setTotalReps(event.totalReps);
        setLastEventTs(event.ts);
        setAutoStream(false);
        break;
      case 'WORKOUT_STOPPED':
        setMode('IDLE');
        setCurrentSetIndex(null);
        setCurrentSetReps(0);
        setLastEventTs(event.ts);
        setAutoStream(false);
        setNextSetIndex(0);
        break;
      default:
        break;
    }
  });

  useEventSubscription('pose:event', (event) => {
    switch (event.type) {
      case 'HEARTBEAT':
        setPoseStatus((status) => (status === 'starting' || status === 'idle' ? 'running' : status));
        setPoseMetrics((prev) => ({
          ...prev,
          fps: event.fps ?? prev.fps,
          backend: event.backend ?? prev.backend,
          lastUpdated: event.ts,
        }));
        break;
      case 'DEBUG_METRICS':
        setPoseMetrics((prev) => ({
          ...prev,
          theta: event.theta ?? prev.theta,
          state: event.state ?? prev.state,
          valid: event.valid ?? prev.valid,
          confidence: event.confidence ?? prev.confidence,
          lastUpdated: event.ts,
        }));
        break;
      case 'POSE_LOST':
        setPoseLost(true);
        break;
      case 'POSE_REGAINED':
        setPoseLost(false);
        break;
      case 'ERROR':
        setPoseStatus('error');
        setPoseError(event.message ?? event.code);
        break;
      default:
        break;
    }
  });

  // Parse voice debug logs to keep simple telemetry for HUD
  useEventSubscription('debug:log', ({ message, source }) => {
    if (source !== 'voice-adapter' || !message.startsWith('voice:')) return;
    const text = message.slice('voice:'.length).trim();
    if (text === 'primed') setVoicePrimed(true);
    if (text === 'blocked') setVoiceBlocked(true);
    if (text === 'muted on') setVoiceMuted(true);
    if (text === 'muted off') setVoiceMuted(false);
    if (text.startsWith('volume')) {
      const v = Number(text.split(' ')[1]);
      if (!Number.isNaN(v)) setVoiceVolume(v);
    }
    if (text.startsWith('rate')) {
      const r = Number(text.split(' ')[1]);
      if (!Number.isNaN(r)) setVoiceRate(r);
    }
    if (text.startsWith('spoke') || text.startsWith('caption')) {
      setVoiceLast(text.split(' ').slice(1).join(' '));
    }
  });

  // Voice telemetry (Web Audio driver)
  useEventSubscription('voice:telemetry', ({ p95, bufferCount, blocked }) => {
    setVoiceP95(p95);
    setVoiceBufferCount(bufferCount);
    setVoiceBlocked(blocked);
  });

  // Voice decode progress (Web Audio driver)
  useEventSubscription('voice:decode_progress', ({ percent }) => {
    setVoiceDecodeProgress(percent);
  });

  // Voice captions (when blocked)
  useEventSubscription('voice:caption', ({ text }) => {
    setVoiceCaption(text);
    // Clear caption after 2 seconds
    setTimeout(() => setVoiceCaption(null), 2000);
  });

  const emitCommand = useCallback(
    (command: EngineCommand) => {
      bus.emit('engine:command', command);
      const issuedAt = performance.now();
      setCommands((prev) => [{ command, issuedAt }, ...prev].slice(0, MAX_LOG_ENTRIES));

      if (command.type === 'RESET') {
        setMode('IDLE');
        setTotalReps(0);
        setLastEventTs(undefined);
        setEvents([]);
        setCurrentSetIndex(null);
        setCurrentSetReps(0);
        setCompletedSets(0);
        setNextSetIndex(0);
        setAutoStream(false);
        bus.emit('pose:command', { type: 'FAKE_STREAM_STOP' });
      }

      if (command.type === 'STOP') {
        setAutoStream(false);
        bus.emit('pose:command', { type: 'FAKE_STREAM_STOP' });
      }
    },
    [bus],
  );

  const startPosePipeline = useCallback(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }
    setPoseStatus('starting');
    setPoseError(null);
    setPoseLost(false);
    setAutoStream(false);
    bus.emit('pose:command', { type: 'FAKE_STREAM_STOP' });
    bus.emit('pose:command', {
      type: 'PIPELINE_START',
      video,
      debug: poseDebugEnabled,
      angle: cameraAngle,
    });
  }, [bus, poseDebugEnabled, cameraAngle]);

  const stopPosePipeline = useCallback(() => {
    bus.emit('pose:command', { type: 'PIPELINE_STOP' });
    setPoseStatus('idle');
    setPoseLost(false);
    setPoseError(null);
    setPoseMetrics({});
  }, [bus]);

  const togglePoseDebug = useCallback(
    (debug: boolean) => {
      setPoseDebugEnabled(debug);
      bus.emit('pose:command', { type: 'PIPELINE_SET_DEBUG', debug });
    },
    [bus],
  );

  const updateCameraAngle = useCallback(
    (angle: CameraAngle) => {
      setCameraAngle(angle);
      if (poseStatus === 'running' || poseStatus === 'starting') {
        bus.emit('pose:command', { type: 'PIPELINE_SET_VIEW', angle });
      }
    },
    [bus, poseStatus],
  );

  const latestSessionId = useMemo(() => {
    const latestEvent = events.find((event) => event.type === 'WORKOUT_STARTED') as
      | Extract<EngineEvent, { type: 'WORKOUT_STARTED' }>
      | undefined;
    return latestEvent?.sessionId ?? '—';
  }, [events]);

  const modeBadge = useMemo(() => {
    switch (mode) {
      case 'PRACTICE':
        return { label: 'Active', className: 'bg-emerald-500/20 text-emerald-200' };
      case 'PAUSED':
        return { label: 'Paused', className: 'bg-amber-500/20 text-amber-200' };
      case 'COMPLETE':
        return { label: 'Complete', className: 'bg-sky-500/20 text-sky-200' };
      default:
        return { label: 'Idle', className: 'bg-slate-700/40 text-slate-200' };
    }
  }, [mode]);

  const poseStatusBadge = useMemo(() => {
    switch (poseStatus) {
      case 'running':
        return {
          label: poseLost ? 'Running (pose lost)' : 'Running',
          className: poseLost ? 'bg-amber-500/20 text-amber-200' : 'bg-emerald-500/20 text-emerald-200',
        };
      case 'starting':
        return { label: 'Starting…', className: 'bg-sky-500/20 text-sky-200' };
      case 'error':
        return { label: 'Error', className: 'bg-rose-500/20 text-rose-200' };
      default:
        return { label: 'Idle', className: 'bg-slate-700/40 text-slate-200' };
    }
  }, [poseStatus, poseLost]);

  const cameraAngleLabel = useMemo(() => {
    switch (cameraAngle) {
      case 'front':
        return 'Front';
      case 'side':
        return 'Side';
      case 'back':
        return 'Back';
      default:
        return cameraAngle;
    }
  }, [cameraAngle]);

  const canStartWorkout = mode === 'IDLE' || mode === 'COMPLETE';
  const hasCurrentSet = currentSetIndex != null;
  const canStartSet = mode === 'PRACTICE' && !hasCurrentSet;
  const canEndSet = mode === 'PRACTICE' && hasCurrentSet;
  const canFakeRep = mode === 'PRACTICE' && hasCurrentSet;
  const canStartAuto = canFakeRep && !autoStream;
  const canStopAuto = autoStream;
  const canPause = mode === 'PRACTICE';
  const canResume = mode === 'PAUSED';
  const canStop = mode !== 'IDLE';

  return (
    <div className="space-y-4">
      <header className="flex flex-col gap-1">
        <h3 className={typography.subheading}>Workout Engine Harness</h3>
        <p className={typography.caption}>Dispatch commands and observe engine events before integrating full UI.</p>
      </header>

      <section className="grid gap-3 md:grid-cols-2">
        <div className="rounded-lg border border-slate-800 bg-slate-950/30 p-4">
          <h4 className={typography.smallHeading}>Session</h4>
          <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
            <div>
              <dt className="text-slate-400">Mode</dt>
              <dd>
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${modeBadge.className}`}
                >
                  {modeBadge.label}
                </span>
              </dd>
            </div>
            <div>
              <dt className="text-slate-400">Session ID</dt>
              <dd className="font-mono text-xs break-all text-slate-200">{latestSessionId}</dd>
            </div>
            <div>
              <dt className="text-slate-400">Total Reps</dt>
              <dd className="font-medium text-slate-100">{totalReps}</dd>
            </div>
            <div>
              <dt className="text-slate-400">Last Event</dt>
              <dd className="font-medium text-slate-100">{lastEventTs ? `${Math.round(lastEventTs)} ms` : '—'}</dd>
            </div>
            <div>
              <dt className="text-slate-400">Current Set</dt>
              <dd className="font-medium text-slate-100">
                {currentSetIndex != null ? `#${currentSetIndex} (${currentSetReps} reps)` : '—'}
              </dd>
            </div>
            <div>
              <dt className="text-slate-400">Completed Sets</dt>
              <dd className="font-medium text-slate-100">{completedSets}</dd>
            </div>
            <div>
              <dt className="text-slate-400">Auto Reps</dt>
              <dd className="font-medium text-slate-100">{autoStream ? 'Running' : 'Stopped'}</dd>
            </div>
          </dl>
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-950/30 p-4">
          <h4 className={typography.smallHeading}>Pose Pipeline</h4>
          <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
            <div>
              <dt className="text-slate-400">Status</dt>
              <dd>
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${poseStatusBadge.className}`}
                >
                  {poseStatusBadge.label}
                </span>
              </dd>
            </div>
            <div>
              <dt className="text-slate-400">Camera Angle</dt>
              <dd className="font-medium text-slate-100">{cameraAngleLabel}</dd>
            </div>
            <div>
              <dt className="text-slate-400">Debug Metrics</dt>
              <dd className="font-medium text-slate-100">{poseDebugEnabled ? 'Enabled' : 'Disabled'}</dd>
            </div>
            <div>
              <dt className="text-slate-400">Backend</dt>
              <dd className="font-medium text-slate-100">{poseMetrics.backend ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-slate-400">FPS</dt>
              <dd className="font-medium text-slate-100">{poseMetrics.fps != null ? poseMetrics.fps : '—'}</dd>
            </div>
          </dl>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              className={buttons.secondary}
              onClick={startPosePipeline}
              disabled={poseStatus === 'starting' || poseStatus === 'running'}
            >
              Start Camera + Pose
            </button>
            <button
              type="button"
              className={buttons.secondary}
              onClick={stopPosePipeline}
              disabled={poseStatus === 'idle'}
            >
              Stop Pose Pipeline
            </button>
            <label className="inline-flex items-center gap-2 text-sm text-slate-200">
              <input
                type="checkbox"
                checked={poseDebugEnabled}
                onChange={(event) => togglePoseDebug(event.target.checked)}
              />
              Debug HUD
            </label>
            <label className="inline-flex items-center gap-2 text-sm text-slate-200">
              <span>Angle</span>
              <select
                className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-100"
                value={cameraAngle}
                onChange={(event) => updateCameraAngle(event.target.value as CameraAngle)}
              >
                <option value="front">Front</option>
                <option value="side">Side</option>
                <option value="back">Back</option>
              </select>
            </label>
          </div>
          {poseError ? <p className="mt-2 text-sm text-rose-300">{poseError}</p> : null}
          <div className="mt-3 overflow-hidden rounded-md border border-slate-800 bg-black">
            <video ref={videoRef} className="aspect-video w-full object-contain" playsInline muted />
          </div>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2">
        <div className="rounded-lg border border-slate-800 bg-slate-950/30 p-4">
          <h4 className={typography.smallHeading}>Controls</h4>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              className={buttons.primary}
              disabled={!canStartWorkout}
              onClick={() =>
                emitCommand({
                  type: 'START_WORKOUT',
                  workoutType: 'practice',
                  startedAt: performance.now(),
                })
              }
            >
              Start Workout
            </button>
            <div className="inline-flex items-center gap-2">
              <button
                type="button"
                className={buttons.secondary}
                disabled={!canStartSet}
                onClick={() =>
                  emitCommand({
                    type: 'START_SET',
                    set: {
                      index: nextSetIndex,
                      exercise: 'squat',
                      targetType: 'reps',
                      goalValue: targetReps,
                      startedAt: performance.now(),
                    },
                  })
                }
              >
                Start Practice Set
              </button>
              <label className="inline-flex items-center gap-2 text-sm text-slate-200">
                <span>Target:</span>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={targetReps}
                  onChange={(e) => setTargetReps(Math.max(1, Math.min(100, Number(e.target.value) || 1)))}
                  className="w-16 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-100"
                />
                <span className="text-xs text-slate-400">reps</span>
              </label>
            </div>
            <button
              type="button"
              className={buttons.secondary}
              disabled={!canEndSet}
              onClick={() =>
                emitCommand({
                  type: 'END_SET',
                  ts: performance.now(),
                })
              }
            >
              End Current Set
            </button>
            <button
              type="button"
              className={buttons.secondary}
              disabled={!canFakeRep}
              onClick={() => bus.emit('pose:command', { type: 'FAKE_REP' })}
            >
              Fake Rep Complete
            </button>
            <button
              type="button"
              className={buttons.secondary}
              disabled={!canStartAuto}
              onClick={() => {
                bus.emit('pose:command', { type: 'FAKE_STREAM_START' });
                setAutoStream(true);
              }}
            >
              Start Auto Reps
            </button>
            <button
              type="button"
              className={buttons.secondary}
              disabled={!canStopAuto}
              onClick={() => {
                bus.emit('pose:command', { type: 'FAKE_STREAM_STOP' });
                setAutoStream(false);
              }}
            >
              Stop Auto Reps
            </button>
            <button
              type="button"
              className={buttons.secondary}
              disabled={!canPause}
              onClick={() =>
                emitCommand({
                  type: 'PAUSE',
                  ts: performance.now(),
                })
              }
            >
              Pause
            </button>
            <button
              type="button"
              className={buttons.secondary}
              disabled={!canResume}
              onClick={() =>
                emitCommand({
                  type: 'RESUME',
                  ts: performance.now(),
                })
              }
            >
              Resume
            </button>
            <button
              type="button"
              className={buttons.danger}
              disabled={!canStop}
              onClick={() =>
                emitCommand({
                  type: 'STOP',
                  ts: performance.now(),
                  reason: 'user',
                })
              }
            >
              Stop
            </button>
            <button type="button" className={buttons.ghost} onClick={() => emitCommand({ type: 'RESET' })}>
              Reset
            </button>
          </div>
        </div>

        <PoseDebugPanel metrics={poseMetrics} poseLost={poseLost} status={poseStatus} />
      </section>

      {import.meta.env.DEV && (
        <section className="grid gap-3 md:grid-cols-2">
          <div className="rounded-lg border border-slate-800 bg-slate-950/30 p-4">
            <h4 className={typography.smallHeading}>Voice</h4>
            <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
              <div>
                <dt className="text-slate-400">Driver</dt>
                <dd className="font-medium text-slate-100">{voiceDriver}</dd>
              </div>
              <div>
                <dt className="text-slate-400">Primed</dt>
                <dd className="font-medium text-slate-100">{voicePrimed ? 'Yes' : 'No'}</dd>
              </div>
              <div>
                <dt className="text-slate-400">Muted</dt>
                <dd className="font-medium text-slate-100">{voiceMuted ? 'Yes' : 'No'}</dd>
              </div>
              <div>
                <dt className="text-slate-400">Blocked</dt>
                <dd className="font-medium text-slate-100">{voiceBlocked ? 'Yes' : 'No'}</dd>
              </div>
              {voiceDriver === 'Web Audio' && (
                <>
                  <div>
                    <dt className="text-slate-400">Decode Progress</dt>
                    <dd className="font-medium text-slate-100">{voiceDecodeProgress}%</dd>
                  </div>
                  <div>
                    <dt className="text-slate-400">Buffers Loaded</dt>
                    <dd className="font-medium text-slate-100">{voiceBufferCount}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-400">Latency (p95)</dt>
                    <dd className={`font-medium ${voiceP95 > 150 ? 'text-rose-300' : 'text-slate-100'}`}>
                      {voiceP95 ? `${Math.round(voiceP95)}ms` : '—'}
                    </dd>
                  </div>
                </>
              )}
              <div className={voiceDriver === 'Web Audio' ? '' : 'col-span-2'}>
                <dt className="text-slate-400">Last spoken</dt>
                <dd className="font-medium text-slate-100">{voiceLast ?? '—'}</dd>
              </div>
            </dl>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                className={buttons.secondary}
                onClick={() => bus.emit('voice:command', { type: 'VOICE_PRIME' })}
              >
                Prime Voice
              </button>
              <label className="inline-flex items-center gap-2 text-sm text-slate-200">
                <input
                  type="checkbox"
                  checked={voiceMuted}
                  onChange={(e) => {
                    setVoiceMuted(e.target.checked);
                    bus.emit('voice:command', { type: 'VOICE_MUTE', mute: e.target.checked });
                  }}
                />
                Mute
              </label>
              <label className="inline-flex items-center gap-2 text-sm text-slate-200">
                <span>Volume</span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.1}
                  value={voiceVolume}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setVoiceVolume(v);
                    bus.emit('voice:command', { type: 'VOICE_SET_VOLUME', volume: v });
                  }}
                />
                <span className="text-xs text-slate-400">{Math.round(voiceVolume * 100)}%</span>
              </label>
              <label className="inline-flex items-center gap-2 text-sm text-slate-200">
                <span>Rate</span>
                <input
                  type="range"
                  min={0.5}
                  max={2}
                  step={0.1}
                  value={voiceRate}
                  onChange={(e) => {
                    const r = Number(e.target.value);
                    setVoiceRate(r);
                    bus.emit('voice:command', { type: 'VOICE_SET_RATE', rate: r });
                  }}
                />
                <span className="text-xs text-slate-400">{voiceRate.toFixed(1)}x</span>
              </label>
              <button
                type="button"
                className={buttons.ghost}
                onClick={() => bus.emit('voice:command', { type: 'VOICE_STOP' })}
              >
                Stop
              </button>
            </div>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-950/30 p-4">
            <h4 className={typography.smallHeading}>Last Spoken Indicator</h4>
            <p className="mt-2 text-sm text-slate-300">
              Mirrors what the dev voice driver says. Helps validate drop‑latest and milestone preemption.
            </p>
            <div className="mt-3 rounded-md border border-slate-800 bg-black p-4 text-center">
              <span className="text-5xl font-extrabold text-slate-100">{voiceLast ?? '—'}</span>
            </div>
          </div>
        </section>
      )}

      <section className="grid gap-3 md:grid-cols-2">
        <LogPanel title="Recent Commands" entries={commands.map(formatCommand)} />
        <LogPanel title="Engine Events" entries={events.map(formatEvent)} />
      </section>

      {/* Caption overlay when voice is blocked */}
      {voiceBlocked && voiceCaption && (
        <div className="fixed right-0 bottom-20 left-0 z-50 flex justify-center">
          <div className="rounded-lg bg-slate-900/90 px-6 py-3 text-2xl font-bold text-white shadow-lg">
            {voiceCaption}
          </div>
        </div>
      )}
    </div>
  );
}

interface LogPanelProps {
  readonly title: string;
  readonly entries: readonly string[];
}

function LogPanel({ title, entries }: LogPanelProps) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/30 p-4">
      <h4 className={typography.smallHeading}>{title}</h4>
      <ul className="mt-3 space-y-2 font-mono text-xs text-slate-300">
        {entries.length === 0 ? (
          <li className="text-slate-500">No entries yet.</li>
        ) : (
          entries.map((entry, index) => <li key={index}>{entry}</li>)
        )}
      </ul>
    </div>
  );
}

function formatCommand(entry: CommandLogEntry): string {
  return `${new Date().toLocaleTimeString()} → ${entry.command.type}`;
}

function formatEvent(event: EngineEvent): string {
  switch (event.type) {
    case 'WORKOUT_STARTED':
      return `${new Date().toLocaleTimeString()} ← WORKOUT_STARTED (${event.sessionId})`;
    case 'SET_STARTED':
      return `${new Date().toLocaleTimeString()} ← SET_STARTED (set ${event.setIndex})`;
    case 'REP_TICK':
      return `${new Date().toLocaleTimeString()} ← REP_TICK (#${event.repCount} / total ${event.totalReps})`;
    case 'SET_COMPLETE':
      return `${new Date().toLocaleTimeString()} ← SET_COMPLETE (set ${event.setIndex})`;
    case 'WORKOUT_COMPLETE':
      return `${new Date().toLocaleTimeString()} ← WORKOUT_COMPLETE (${event.totalReps} reps)`;
    case 'WORKOUT_STOPPED':
      return `${new Date().toLocaleTimeString()} ← WORKOUT_STOPPED (${event.reason})`;
    default:
      return `${new Date().toLocaleTimeString()} ← UNKNOWN_EVENT`;
  }
}

interface PoseDebugPanelProps {
  readonly metrics: PoseDebugMetrics;
  readonly poseLost: boolean;
  readonly status: PosePipelineStatus;
}

function PoseDebugPanel({ metrics, poseLost, status }: PoseDebugPanelProps) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/30 p-4">
      <h4 className={typography.smallHeading}>Pose Debug HUD</h4>
      <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
        <div>
          <dt className="text-slate-400">Pose Lost</dt>
          <dd className="font-medium text-slate-100">{poseLost ? 'Yes' : 'No'}</dd>
        </div>
        <div>
          <dt className="text-slate-400">State</dt>
          <dd className="font-medium text-slate-100">{metrics.state ?? (status === 'running' ? '—' : 'Idle')}</dd>
        </div>
        <div>
          <dt className="text-slate-400">Theta</dt>
          <dd className="font-medium text-slate-100">
            {metrics.theta != null ? `${Math.round(metrics.theta)}°` : '—'}
          </dd>
        </div>
        <div>
          <dt className="text-slate-400">Valid Frame</dt>
          <dd className="font-medium text-slate-100">{metrics.valid != null ? (metrics.valid ? 'Yes' : 'No') : '—'}</dd>
        </div>
        <div>
          <dt className="text-slate-400">Last Update</dt>
          <dd className="font-medium text-slate-100">
            {metrics.lastUpdated ? `${Math.round(metrics.lastUpdated)} ms` : '—'}
          </dd>
        </div>
        <div>
          <dt className="text-slate-400">Confidence</dt>
          <dd className="font-medium text-slate-100">
            {metrics.confidence != null ? `${Math.round(metrics.confidence * 100)}%` : '—'}
          </dd>
        </div>
      </dl>
    </div>
  );
}

export default PracticeHarness;
