import { useEffect, useState, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useParams } from 'react-router-dom';
import { useCardStore } from './store/card-store';
import { Header } from './components/shared/Header';
import { ThemeProvider } from './components/shared/ThemeProvider';
import { ErrorBoundary, PageErrorBoundary } from './components/ui/ErrorBoundary';
import { localDB } from './lib/db';
import { processPendingWebImport } from './lib/web-import-handler';

// Lazy-load heavy components for better initial load time
const CardEditor = lazy(() => import('./features/editor/CardEditor').then(m => ({ default: m.CardEditor })));
const CardGrid = lazy(() => import('./features/dashboard/CardGrid').then(m => ({ default: m.CardGrid })));

// Loading spinner for lazy components
function RouteLoader() {
  return (
    <div className="h-full flex items-center justify-center text-dark-muted">
      <div className="flex flex-col items-center gap-4">
        <div className="w-8 h-8 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
        <p>Loading...</p>
      </div>
    </div>
  );
}

function GridRoute() {
  const navigate = useNavigate();
  return (
    <Suspense fallback={<RouteLoader />}>
      <CardGrid onCardClick={(id) => navigate(`/cards/${id}`)} />
    </Suspense>
  );
}

function ImportPendingRoute() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [message, setMessage] = useState('Processing import...');
  const [cardId, setCardId] = useState<string | null>(null);

  useEffect(() => {
    const processImport = async () => {
      try {
        const result = await processPendingWebImport();
        if (result.success && result.cardId) {
          setStatus('success');
          setMessage(`Successfully imported "${result.name || 'character'}"!`);
          setCardId(result.cardId);
          // Auto-navigate after short delay
          setTimeout(() => navigate(`/cards/${result.cardId}`), 1500);
        } else {
          setStatus('error');
          setMessage(result.error || 'No pending import found');
        }
      } catch (err) {
        setStatus('error');
        setMessage(err instanceof Error ? err.message : 'Import failed');
      }
    };

    processImport();
  }, [navigate]);

  return (
    <div className="h-full flex items-center justify-center">
      <div className="text-center p-8 max-w-md">
        {status === 'processing' && (
          <>
            <div className="w-12 h-12 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mx-auto mb-4" />
            <p className="text-lg">{message}</p>
          </>
        )}
        {status === 'success' && (
          <>
            <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-lg text-green-400 mb-4">{message}</p>
            <button
              onClick={() => cardId && navigate(`/cards/${cardId}`)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
            >
              Open Card
            </button>
          </>
        )}
        {status === 'error' && (
          <>
            <div className="w-12 h-12 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <p className="text-lg text-red-400 mb-4">{message}</p>
            <button
              onClick={() => navigate('/')}
              className="px-4 py-2 bg-slate-600 hover:bg-slate-700 rounded-lg transition-colors"
            >
              Go to Dashboard
            </button>
          </>
        )}
      </div>
    </div>
  );
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
      <div className="flex-1 overflow-hidden editor-content-area">
        <Suspense fallback={<RouteLoader />}>
          <CardEditor />
        </Suspense>
      </div>
    </div>
  );
}

function App() {
  useEffect(() => {
    // Initialize IndexedDB
    localDB.init();
  }, []);

  return (
    <ErrorBoundary>
      <ThemeProvider>
        <BrowserRouter>
          <div className="h-screen flex flex-col theme-bg">
            <Routes>
              <Route
                path="/"
                element={
                  <PageErrorBoundary>
                    <GridRoute />
                  </PageErrorBoundary>
                }
              />
              <Route
                path="/cards/:id"
                element={
                  <PageErrorBoundary>
                    <EditorRoute />
                  </PageErrorBoundary>
                }
              />
              <Route
                path="/import-pending"
                element={
                  <PageErrorBoundary>
                    <ImportPendingRoute />
                  </PageErrorBoundary>
                }
              />
              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </div>
        </BrowserRouter>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
