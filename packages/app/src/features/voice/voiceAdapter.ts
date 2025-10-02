import type { EventBus } from '@/services/event-bus/eventBus';
import type { VoiceAdapterCommand } from '@/services/event-bus/types';
import { DevSpeechSynthesisVoiceDriver, type DevVoiceCue, type VoiceDriver } from './devVoiceDriver';

const MILESTONE_REPS = [10, 20] as const;

interface Options {
  readonly enabled?: boolean;
  readonly driver?: VoiceDriver;
  readonly now?: () => number;
}

export function initializeDevVoiceAdapter(bus: EventBus, options: Options = {}) {
  const now = options.now ?? (() => performance.now());
  const enabled = Boolean(options.enabled);
  if (!enabled) {
    return () => undefined;
  }

  const driver: VoiceDriver = options.driver ?? new DevSpeechSynthesisVoiceDriver();

  const log = (message: string) => {
    bus.emit('debug:log', { message: `voice: ${message}`, ts: now(), source: 'voice-adapter' });
  };

  const speak = (cue: DevVoiceCue) => {
    const text = String(cue.value);

    // If driver is blocked, show caption and vibrate for milestones
    if (driver.isBlocked()) {
      bus.emit('voice:caption', { text });

      // Vibrate for milestones
      if (cue.type === 'milestone') {
        if ('vibrate' in navigator) {
          navigator.vibrate([100]);
        }
      }

      log(`caption ${text} (blocked)`);
      return;
    }

    // Drop-latest for numbers is enforced by the driver
    driver.handle(cue);
    log(`spoke ${text}`);
  };

  // Track the current set's goal so we can detect final reps
  let currentSetGoal: number | null = null;

  const onEngineEvent = bus.subscribe('engine:event', (event) => {
    switch (event.type) {
      case 'SET_STARTED':
        currentSetGoal = event.targetType === 'reps' ? event.goalValue : null;
        break;
      case 'SET_COMPLETE':
        currentSetGoal = null;
        break;
      case 'REP_TICK': {
        const n = event.repCount;
        const isFinalRep = currentSetGoal != null && n >= currentSetGoal;
        const isMilestone = MILESTONE_REPS.includes(n as (typeof MILESTONE_REPS)[number]);

        // Final reps and milestones preempt current speech
        if (isFinalRep || isMilestone) {
          if (driver.isSpeaking()) {
            driver.stopAll();
            log(isFinalRep ? 'preempt for final rep' : 'preempt current utterance for milestone');
          }
          speak({ type: isMilestone ? 'milestone' : 'say_number', value: n });
          break;
        }

        // Regular numbers use drop-latest
        if (driver.isSpeaking()) {
          log(`drop_latest ${n} (busy)`);
          break;
        }

        speak({ type: 'say_number', value: n });
        break;
      }
      case 'WORKOUT_STOPPED':
      case 'WORKOUT_COMPLETE':
        currentSetGoal = null;
        driver.stopAll();
        log('stopped on session end');
        break;
      default:
        break;
    }
  });

  const onVoiceCommand = bus.subscribe('voice:command', (command: VoiceAdapterCommand) => {
    switch (command.type) {
      case 'VOICE_PRIME':
        void driver.prime().then(() => {
          log(driver.isPrimed() ? 'primed' : 'prime_pending');
          if (driver.isBlocked()) log('blocked');
        });
        break;
      case 'VOICE_MUTE':
        if (command.mute) {
          driver.mute();
          log('muted on');
        } else {
          driver.unmute();
          log('muted off');
        }
        break;
      case 'VOICE_SET_VOLUME':
        driver.setVolume(command.volume);
        log(`volume ${Math.round(command.volume * 100) / 100}`);
        break;
      case 'VOICE_SET_RATE':
        driver.setRate(command.rate);
        log(`rate ${Math.round(command.rate * 100) / 100}`);
        break;
      case 'VOICE_STOP':
        driver.stopAll();
        log('stopped');
        break;
      default:
        break;
    }
  });

  log('initialized');

  return () => {
    onEngineEvent();
    onVoiceCommand();
    driver.dispose();
    log('disposed');
  };
}

export default initializeDevVoiceAdapter;
