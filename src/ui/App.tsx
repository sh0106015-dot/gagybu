import { HashRouter, Route, Routes } from 'react-router-dom';
import { TabBar } from './components/TabBar';
import { UndoProvider } from './components/Undo';
import { Home } from './screens/Home';

export default function App() {
  return (
    <HashRouter>
      <UndoProvider>
        <div className="app">
          <main>
            <Routes>
              <Route path="/" element={<Home />} />
            </Routes>
          </main>
          <TabBar />
        </div>
      </UndoProvider>
    </HashRouter>
  );
}
