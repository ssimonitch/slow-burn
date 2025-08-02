import { useEffect } from 'react';

import { ThemeProvider } from '@/features/theme/ThemeProvider';
import { Home } from '@/pages/Home';
import { useAuthInit } from '@/stores';

function App() {
  // Initialize auth store on app mount
  const { initialized: authInitialized, cleanup } = useAuthInit();

  // Cleanup auth listeners on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  // Show loading state while auth is initializing
  if (!authInitialized) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <ThemeProvider defaultTheme="dark" storageKey="ui-theme">
      <Home />
    </ThemeProvider>
  );
}

export default App;
