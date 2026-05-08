import { useState, useEffect } from 'react';
import Home from './pages/Home';
import ExchangeTerminal from './pages/ExchangeTerminal';
import Fortune from './pages/Fortune';
import StencilCam from './pages/StencilCam';
import Todo from './pages/Todo';

type Page = 'home' | 'exchange' | 'fortune' | 'stencilcam' | 'todo';

export default function App() {
  const [page, setPage] = useState<Page>(() =>
    window.location.hash === '#todo' ? 'todo' : 'home'
  );

  useEffect(() => {
    window.location.hash = page === 'home' ? '' : page;
  }, [page]);

  if (page === 'exchange') return <ExchangeTerminal onBack={() => setPage('home')} />;
  if (page === 'fortune') return <Fortune onBack={() => setPage('home')} />;
  if (page === 'stencilcam') return <StencilCam onBack={() => setPage('home')} />;
  if (page === 'todo') return <Todo onBack={() => setPage('home')} />;
  return <Home onNavigate={(p) => setPage(p)} />;
}
