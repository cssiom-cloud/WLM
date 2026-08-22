import { AnimatePresence, motion } from 'framer-motion';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { CommandProvider, GlobalLayout, useCommand } from './components/GlobalLayout.jsx';
import Login from './pages/Login.jsx';
import CharacterSelect from './pages/CharacterSelect.jsx';
import Dashboard from './pages/Dashboard.jsx';
import OperationsBoard from './pages/OperationsBoard.jsx';
import OfficialDocument from './pages/OfficialDocument.jsx';
import Settings from './pages/Settings.jsx';

const pageMotion = {
  initial: { opacity: 0, y: 18, filter: 'blur(10px)' },
  animate: { opacity: 1, y: 0, filter: 'blur(0px)' },
  exit: { opacity: 0, y: -12, filter: 'blur(8px)' },
  transition: { duration: 0.46, ease: [0.22, 1, 0.36, 1] }
};

const routerBasename = String(import.meta.env.BASE_URL || '/')
  .replace(/\/$/, '')
  .replace(/^\.$/, '');

function PageFrame({ children }) {
  const location = useLocation();
  return (
    <motion.div
      key={location.pathname}
      className="min-h-full"
      initial={pageMotion.initial}
      animate={pageMotion.animate}
      exit={pageMotion.exit}
      transition={pageMotion.transition}
    >
      {children}
    </motion.div>
  );
}

function Guarded({ children, allowGuest = false, requireSelection = false }) {
  const { bootstrapping, session, profiles, activePersonnel } = useCommand();

  if (bootstrapping) {
    return (
      <div className="grid min-h-[56vh] place-items-center">
        <p className="text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-slate-500">
          Establishing command channel
        </p>
      </div>
    );
  }

  if (allowGuest && session && !requireSelection) {
    if (profiles.length > 1 && !activePersonnel) {
      return <Navigate to="/select" replace />;
    }
    return <Navigate to="/" replace />;
  }

  if (!allowGuest && !session) {
    return <Navigate to="/login" replace />;
  }

  if (session && profiles.length > 1 && !activePersonnel && !requireSelection) {
    return <Navigate to="/select" replace />;
  }

  if (requireSelection && !session) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

function AnimatedRoutes() {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route
          path="/login"
          element={
            <PageFrame>
              <Guarded allowGuest>
                <Login />
              </Guarded>
            </PageFrame>
          }
        />
        <Route
          path="/select"
          element={
            <PageFrame>
              <Guarded requireSelection>
                <CharacterSelect />
              </Guarded>
            </PageFrame>
          }
        />
        <Route
          element={
            <Guarded>
              <GlobalLayout />
            </Guarded>
          }
        >
          <Route
            path="/"
            element={
              <PageFrame>
                <Dashboard />
              </PageFrame>
            }
          />
          <Route
            path="/operations"
            element={
              <PageFrame>
                <OperationsBoard />
              </PageFrame>
            }
          />
          <Route
            path="/documents"
            element={
              <PageFrame>
                <OfficialDocument />
              </PageFrame>
            }
          />
          <Route
            path="/settings"
            element={
              <PageFrame>
                <Settings />
              </PageFrame>
            }
          />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AnimatePresence>
  );
}

export default function App() {
  return (
    <BrowserRouter basename={routerBasename || undefined}>
      <CommandProvider>
        <div className="min-h-screen bg-[#f4f1ea] text-slate-900 antialiased dark:bg-[#16181d] dark:text-slate-100">
          <AnimatedRoutes />
        </div>
      </CommandProvider>
    </BrowserRouter>
  );
}
