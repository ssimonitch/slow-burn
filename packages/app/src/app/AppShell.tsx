import { memo } from "react";

export const AppShell = memo(() => {
  return (
    <main className="grid min-h-screen place-items-center px-6">
      <section className="mx-auto flex max-w-md flex-col items-center gap-6 rounded-2xl bg-slate-900/60 p-8 text-center shadow-lg shadow-slate-950/40">
        <span className="rounded-full border border-slate-700 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-300">
          Slow Burn
        </span>
        <div className="space-y-3">
          <h1 className="text-3xl font-semibold leading-tight text-slate-50 sm:text-4xl">
            HIIT companion scaffolding is ready
          </h1>
          <p className="text-sm text-slate-400 sm:text-base">
            Start wiring the workout engine, pose worker, and voice driver specs
            with confidence—tooling, linting, and formatting are all in place.
          </p>
        </div>
      </section>
    </main>
  );
});

AppShell.displayName = "AppShell";

export default AppShell;
