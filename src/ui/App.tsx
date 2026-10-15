import { HashRouter, Route, Routes } from 'react-router-dom';
import { TabBar } from './components/TabBar';
import { UndoProvider } from './components/Undo';
import { Home } from './screens/Home';
import { History } from './screens/History';
import { TxEditor } from './screens/TxEditor';
import { Stats } from './screens/Stats';
import { Inbox } from './screens/Inbox';
import { CandidateDetail } from './screens/CandidateDetail';
import { BudgetSettings } from './screens/BudgetSettings';

export default function App() {
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
              <Route path="/settings/budget" element={<BudgetSettings />} />
            </Routes>
          </main>
          <TabBar />
        </div>
      </UndoProvider>
    </HashRouter>
  );
}
