import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { EventBusProvider, useEventSubscription } from '@/services/event-bus';
import { WorkoutEngineRuntimeBridge } from '../runtime';

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
});
