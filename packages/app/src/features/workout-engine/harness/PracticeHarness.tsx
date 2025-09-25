import { useCallback, useMemo, useState } from 'react';

import { buttons, typography } from '@/app/theme';
import { useEventBus, useEventSubscription } from '@/services/event-bus';
import type { EngineCommand, EngineEvent, WorkoutEngineMode } from '../core';

const MAX_LOG_ENTRIES = 20;

interface CommandLogEntry {
  readonly command: EngineCommand;
  readonly issuedAt: number;
}

export function PracticeHarness() {
  const bus = useEventBus();
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

  const latestSessionId = useMemo(() => {
    const latestEvent = events.find((event) => event.type === 'WORKOUT_STARTED') as
      | Extract<EngineEvent, { type: 'WORKOUT_STARTED' }>
      | undefined;
    return latestEvent?.sessionId ?? '—';
  }, [events]);

  const modeBadge = useMemo(() => {
    switch (mode) {
      case 'PRACTICE':
        return {
          label: 'Active',
          className: 'bg-emerald-500/20 text-emerald-200',
        };
      case 'PAUSED':
        return {
          label: 'Paused',
          className: 'bg-amber-500/20 text-amber-200',
        };
      case 'COMPLETE':
        return {
          label: 'Complete',
          className: 'bg-sky-500/20 text-sky-200',
        };
      default:
        return {
          label: 'Idle',
          className: 'bg-slate-700/40 text-slate-200',
        };
    }
  }, [mode]);

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
                    goalValue: 10,
                    startedAt: performance.now(),
                  },
                })
              }
            >
              Start Practice Set
            </button>
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
      </section>

      <section className="grid gap-3 md:grid-cols-2">
        <LogPanel title="Recent Commands" entries={commands.map(formatCommand)} />
        <LogPanel title="Engine Events" entries={events.map(formatEvent)} />
      </section>
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

export default PracticeHarness;
