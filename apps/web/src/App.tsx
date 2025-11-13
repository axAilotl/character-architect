import { useState, useEffect } from 'react';
import { useCardStore } from './store/card-store';
import { CardEditor } from './components/CardEditor';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';

function App() {
  const [showSidebar, setShowSidebar] = useState(true);
  const currentCard = useCardStore((state) => state.currentCard);

  useEffect(() => {
    // Initialize IndexedDB
    import('./lib/db').then(({ localDB }) => localDB.init());
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      <Header onToggleSidebar={() => setShowSidebar(!showSidebar)} />

      <div className="flex-1 flex overflow-hidden">
        {showSidebar && <Sidebar />}

        <main className="flex-1 overflow-auto">
          {currentCard ? (
            <CardEditor />
          ) : (
            <div className="h-full flex items-center justify-center text-dark-muted">
              <div className="text-center">
                <h2 className="text-2xl font-bold mb-2">No card loaded</h2>
                <p>Create a new card or import an existing one to get started</p>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
