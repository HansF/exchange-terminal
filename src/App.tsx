import { useState, useEffect } from 'react';
import Home from './pages/Home';
import ExchangeTerminal from './pages/ExchangeTerminal';
import Fortune from './pages/Fortune';
import StencilCam from './pages/StencilCam';
import Todo from './pages/Todo';
import ThresholdStencil from './pages/ThresholdStencil';

const TOOL_PAGES = ['exchange', 'fortune', 'stencilcam', 'todo', 'threshold'] as const;

export type ToolPage = typeof TOOL_PAGES[number];
type Page = 'home' | ToolPage;

function pageFromHash(): Page {
  const hash = window.location.hash.slice(1);
  return TOOL_PAGES.includes(hash as ToolPage) ? hash as ToolPage : 'home';
}

export default function App() {
  const [page, setPage] = useState<Page>(() => pageFromHash());

  useEffect(() => {
    const handleHashChange = () => setPage(pageFromHash());
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  useEffect(() => {
    const nextHash = page === 'home' ? '' : `#${page}`;
    if (window.location.hash === nextHash) return;

    if (page === 'home') {
      window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
      return;
    }

    window.location.hash = page;
  }, [page]);

  if (page === 'exchange') return <ExchangeTerminal onBack={() => setPage('home')} />;
  if (page === 'fortune') return <Fortune onBack={() => setPage('home')} />;
  if (page === 'stencilcam') return <StencilCam onBack={() => setPage('home')} />;
  if (page === 'todo') return <Todo onBack={() => setPage('home')} />;
  if (page === 'threshold') return <ThresholdStencil onBack={() => setPage('home')} />;
  return <Home onNavigate={(p) => setPage(p)} />;
}
