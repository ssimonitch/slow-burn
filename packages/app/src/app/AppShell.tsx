import { memo, useEffect, useMemo, useState } from 'react';

import { buttons, surfaces, typography } from '@/app/theme';
import { useEventBus } from '@/services/event-bus';

import type { AppScreenKey } from './screens';
import { HomeScreen, PracticeScreen, WorkoutScreen } from './screens';
import type { ScreenProps } from './screens';

const screenMap: Record<AppScreenKey, React.ComponentType<ScreenProps>> = {
  home: HomeScreen,
  practice: PracticeScreen,
  workout: WorkoutScreen,
};

export const AppShell = memo(() => {
  const [screen, setScreen] = useState<AppScreenKey>('home');
  const [eventLog, setEventLog] = useState<string[]>([]);
  const eventBus = useEventBus();

  const timeFormatter = useMemo(() => new Intl.DateTimeFormat(undefined, { timeStyle: 'medium' }), []);

  useEffect(() => {
    const unsubscribeFns = [
      eventBus.subscribe('engine:command', (command) => {
        setEventLog((log) => [`${timeFormatter.format(new Date())} • CMD ${command.type}`, ...log.slice(0, 4)]);
      }),
      eventBus.subscribe('engine:event', (event) => {
        setEventLog((log) => [`${timeFormatter.format(new Date())} ← EVT ${event.type}`, ...log.slice(0, 4)]);
      }),
      eventBus.subscribe('debug:log', ({ message }) => {
        setEventLog((log) => [`${timeFormatter.format(new Date())} • ${message}`, ...log.slice(0, 4)]);
      }),
    ];

    return () => {
      unsubscribeFns.forEach((unsubscribe) => unsubscribe());
    };
  }, [eventBus, timeFormatter]);

  const ActiveScreen = screenMap[screen];

  return (
    <main className="grid min-h-screen place-items-center px-6">
      <section className={surfaces.panel}>
        <span className={typography.chip}>Slow Burn</span>
        <ActiveScreen onNavigate={setScreen} />
        <aside className="mt-6 w-full rounded-xl border border-slate-800 bg-slate-950/40 p-4 text-left">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Event bus</h3>
            <button type="button" className={buttons.subtle} onClick={() => setEventLog([])}>
              Clear
            </button>
          </div>
          <ul className="mt-3 space-y-2 text-left">
            {eventLog.length === 0 ? (
              <li className="text-xs text-slate-600">Events will appear here as the workout engine fires.</li>
            ) : (
              eventLog.map((entry, index) => (
                <li key={index} className="text-xs text-slate-400">
                  {entry}
                </li>
              ))
            )}
          </ul>
        </aside>
      </section>
    </main>
  );
});

AppShell.displayName = 'AppShell';

export default AppShell;
