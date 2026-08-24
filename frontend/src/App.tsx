import { AppStoreProvider } from "./lib/store";
import { AppShell } from "./components/shell/AppShell";

function App() {
  return (
    <AppStoreProvider>
      <AppShell />
    </AppStoreProvider>
  );
}

export default App;

