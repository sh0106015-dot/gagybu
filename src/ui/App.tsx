import { useEffect, useState } from 'react';
import { HashRouter, Route, Routes } from 'react-router-dom';
import { TabBar } from './components/TabBar';
import { UndoProvider } from './components/Undo';
import { useLive } from './hooks';
import { AutoRecordSettings } from './screens/AutoRecordSettings';
import { BudgetSettings } from './screens/BudgetSettings';
import { CandidateDetail } from './screens/CandidateDetail';
import { ExportCsv } from './screens/ExportCsv';
import { History } from './screens/History';
import { Home } from './screens/Home';
import { Inbox } from './screens/Inbox';
import { LockScreen } from './screens/LockScreen';
import { LockSettings } from './screens/LockSettings';
import { ManageList } from './screens/ManageList';
import { Onboarding } from './screens/Onboarding';
import { PasteAnalyze } from './screens/PasteAnalyze';
import { Settings } from './screens/Settings';
import { Simulator } from './screens/Simulator';
import { Stats } from './screens/Stats';
import { TxEditor } from './screens/TxEditor';
import { Wipe } from './screens/Wipe';

export default function App() {
  const app = useLive((r) => r.getAppSettings());
  const [unlocked, setUnlocked] = useState(false);

  const theme = app?.theme ?? 'auto';
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'auto') delete root.dataset.theme;
    else root.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden') setUnlocked(false);
    };
    document.addEventListener('visibilitychange', onHide);
    return () => document.removeEventListener('visibilitychange', onHide);
  }, []);

  if (!app) return <p className="loading">불러오는 중…</p>;
  if (!app.onboarded) return <Onboarding />;
  if (app.lockEnabled && !unlocked) return <LockScreen app={app} onUnlock={() => setUnlocked(true)} />;

  return (
    <HashRouter>
      <UndoProvider>
        <div className="app">
          <main>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/history" element={<History />} />
              <Route path="/tx/new" element={<TxEditor />} />
              <Route path="/tx/:id" element={<TxEditor />} />
              <Route path="/stats" element={<Stats />} />
              <Route path="/inbox" element={<Inbox />} />
              <Route path="/inbox/:id" element={<CandidateDetail />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/settings/budget" element={<BudgetSettings />} />
              <Route path="/settings/auto" element={<AutoRecordSettings />} />
              <Route path="/settings/categories" element={<ManageList key="c" target="categories" />} />
              <Route path="/settings/methods" element={<ManageList key="m" target="methods" />} />
              <Route path="/settings/paste" element={<PasteAnalyze />} />
              <Route path="/settings/simulator" element={<Simulator />} />
              <Route path="/settings/lock" element={<LockSettings />} />
              <Route path="/settings/export" element={<ExportCsv />} />
              <Route path="/settings/wipe" element={<Wipe />} />
            </Routes>
          </main>
          <TabBar />
        </div>
      </UndoProvider>
    </HashRouter>
  );
}
