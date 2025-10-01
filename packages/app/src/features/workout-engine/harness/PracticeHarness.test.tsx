import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, afterEach, describe, expect, it } from 'vitest';

import { EventBusProvider, useEventBus, useEventSubscription } from '@/services/event-bus';
import type { EventBus } from '@/services/event-bus/eventBus';
import { WorkoutEngineRuntimeBridge } from '../runtime';
import { VoiceRuntimeBridge } from '@/features/voice';
import { installSpeechSynthesisPolyfill, restoreSpeechSynthesis } from '@/test/speechSynthesisPolyfill';

import { PracticeHarness } from './PracticeHarness';

function CommandSpy({ onCommand }: { onCommand: (type: string) => void }) {
  useEventSubscription('engine:command', (command) => {
    onCommand(command.type);
  });
  return null;
}

function PoseSpy({ onPose }: { onPose: (type: string) => void }) {
  useEventSubscription('pose:command', (command) => {
    onPose(command.type);
  });
  return null;
}

describe('PracticeHarness', () => {
  it('emits commands and pose events when buttons are clicked', async () => {
    const user = userEvent.setup();
    const commands: string[] = [];
    const poseCommands: string[] = [];

    render(
      <EventBusProvider>
        <WorkoutEngineRuntimeBridge />
        <CommandSpy onCommand={(type) => commands.push(type)} />
        <PoseSpy onPose={(type) => poseCommands.push(type)} />
        <PracticeHarness />
      </EventBusProvider>,
    );

    await user.click(screen.getByRole('button', { name: /start workout/i }));
    const startSetButton = screen.getByRole('button', {
      name: /start practice set/i,
    });
    await waitFor(() => expect(startSetButton).not.toBeDisabled());
    await user.click(startSetButton);
    await user.click(screen.getByRole('button', { name: /fake rep complete/i }));
    const startAutoButton = screen.getByRole('button', {
      name: /start auto reps/i,
    });
    await waitFor(() => expect(startAutoButton).not.toBeDisabled());
    await user.click(startAutoButton);

    const stopAutoButton = screen.getByRole('button', {
      name: /stop auto reps/i,
    });
    await waitFor(() => expect(stopAutoButton).not.toBeDisabled());
    await user.click(stopAutoButton);

    const endSetButton = screen.getByRole('button', {
      name: /end current set/i,
    });
    await waitFor(() => expect(endSetButton).not.toBeDisabled());
    await user.click(endSetButton);

    expect(commands).toEqual(['START_WORKOUT', 'START_SET', 'END_SET']);
    expect(poseCommands).toEqual(['FAKE_REP', 'FAKE_STREAM_START', 'FAKE_STREAM_STOP']);
  });

  describe('Voice integration', () => {
    beforeEach(() => {
      installSpeechSynthesisPolyfill({ autoComplete: true });
    });

    afterEach(() => {
      restoreSpeechSynthesis();
    });

    it('allows priming voice via UI button', async () => {
      const user = userEvent.setup();

      render(
        <EventBusProvider>
          <WorkoutEngineRuntimeBridge />
          <VoiceRuntimeBridge />
          <PracticeHarness />
        </EventBusProvider>,
      );

      // Initially not primed
      const primedText = screen.getByText(/primed/i);
      expect(primedText.parentElement?.textContent).toMatch(/no/i);

      // Click prime button
      await user.click(screen.getByRole('button', { name: /prime voice/i }));

      // Wait for primed status to update
      await waitFor(
        () => {
          const primedStatus = screen.getByText(/primed/i);
          expect(primedStatus.parentElement?.textContent).toMatch(/yes/i);
        },
        { timeout: 1500 },
      );
    });

    it('updates Last Spoken indicator from voice debug logs', async () => {
      // Helper to capture bus for emitting debug logs
      let captureBus: EventBus | null = null;
      function BusCapture() {
        captureBus = useEventBus();
        return null;
      }

      render(
        <EventBusProvider>
          <WorkoutEngineRuntimeBridge />
          <VoiceRuntimeBridge />
          <BusCapture />
          <PracticeHarness />
        </EventBusProvider>,
      );

      // Emit a debug log representing a spoken number
      act(() => {
        captureBus!.emit('debug:log', { message: 'voice: spoke 7', ts: 0, source: 'voice-adapter' });
      });

      // Last Spoken Indicator should update
      // Find the "Last Spoken Indicator" heading and check its parent container
      const heading = screen.getByRole('heading', { name: /last spoken indicator/i });
      const panel = heading.parentElement as HTMLElement;

      await waitFor(() => {
        const indicator = panel.querySelector('span');
        expect(indicator?.textContent).toBe('7');
      });
    });

    it('updates Last Spoken indicator after speaking multiple numbers', async () => {
      let captureBus: EventBus | null = null;
      function BusCapture() {
        captureBus = useEventBus();
        return null;
      }

      render(
        <EventBusProvider>
          <WorkoutEngineRuntimeBridge />
          <VoiceRuntimeBridge />
          <BusCapture />
          <PracticeHarness />
        </EventBusProvider>,
      );

      const heading = screen.getByRole('heading', { name: /last spoken indicator/i });
      const panel = heading.parentElement as HTMLElement;

      // Emit multiple voice debug logs
      act(() => {
        captureBus!.emit('debug:log', { message: 'voice: spoke 1', ts: 0, source: 'voice-adapter' });
      });
      await waitFor(() => {
        expect(panel.querySelector('span')?.textContent).toBe('1');
      });

      act(() => {
        captureBus!.emit('debug:log', { message: 'voice: spoke 5', ts: 1, source: 'voice-adapter' });
      });
      await waitFor(() => {
        expect(panel.querySelector('span')?.textContent).toBe('5');
      });

      act(() => {
        captureBus!.emit('debug:log', { message: 'voice: spoke 10', ts: 2, source: 'voice-adapter' });
      });
      await waitFor(() => {
        expect(panel.querySelector('span')?.textContent).toBe('10');
      });
    });
  });
});
