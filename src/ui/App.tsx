import { HashRouter, Route, Routes } from 'react-router-dom';
import { TabBar } from './components/TabBar';
import { UndoProvider } from './components/Undo';
import { useLive } from './hooks';
import { AutoRecordSettings } from './screens/AutoRecordSettings';
import { BudgetSettings } from './screens/BudgetSettings';
import { CandidateDetail } from './screens/CandidateDetail';
import { History } from './screens/History';
import { Home } from './screens/Home';
import { Inbox } from './screens/Inbox';
import { ManageList } from './screens/ManageList';
import { Onboarding } from './screens/Onboarding';
import { Settings } from './screens/Settings';
import { Stats } from './screens/Stats';
import { TxEditor } from './screens/TxEditor';

export default function App() {
  const app = useLive((r) => r.getAppSettings());
  if (!app) return <p className="loading">불러오는 중…</p>;
  if (!app.onboarded) return <Onboarding />;

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
            </Routes>
          </main>
          <TabBar />
        </div>
      </UndoProvider>
    </HashRouter>
  );
}
