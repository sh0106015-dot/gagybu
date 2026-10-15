import { HashRouter, Route, Routes } from 'react-router-dom';
import { TabBar } from './components/TabBar';
import { UndoProvider } from './components/Undo';
import { Home } from './screens/Home';
import { History } from './screens/History';
import { TxEditor } from './screens/TxEditor';

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
            </Routes>
          </main>
          <TabBar />
        </div>
      </UndoProvider>
    </HashRouter>
  );
}
