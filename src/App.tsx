import { ThemeProvider } from '@/features/theme/ThemeProvider';
import { Home } from '@/pages/Home';

function App() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="ui-theme">
      <Home />
    </ThemeProvider>
  );
}

export default App;
