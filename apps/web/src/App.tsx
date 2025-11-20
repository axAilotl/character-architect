import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useParams } from 'react-router-dom';
import { useCardStore } from './store/card-store';
import { CardEditor } from './components/CardEditor';
import { CardGrid } from './components/CardGrid';
import { Header } from './components/Header';

function GridRoute() {
  const navigate = useNavigate();
  return <CardGrid onCardClick={(id) => navigate(`/cards/${id}`)} />;
}

function EditorRoute() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { loadCard, currentCard, setCurrentCard } = useCardStore();

  useEffect(() => {
    if (id) {
      loadCard(id);
    }
    return () => {
      setCurrentCard(null);
    };
  }, [id]);

  if (!id) return <Navigate to="/" />;

  if (!currentCard || currentCard.meta.id !== id) {
    return (
      <div className="h-full flex items-center justify-center text-dark-muted">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
          <p>Loading card...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <Header onBack={() => navigate('/')} />
      <div className="flex-1 overflow-hidden">
        <CardEditor />
      </div>
    </div>
  );
}

function App() {
  useEffect(() => {
    // Initialize IndexedDB
    import('./lib/db').then(({ localDB }) => localDB.init());
  }, []);

  return (
    <BrowserRouter>
      <div className="h-screen flex flex-col bg-dark-bg">
        <Routes>
          <Route path="/" element={<GridRoute />} />
          <Route path="/cards/:id" element={<EditorRoute />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;
