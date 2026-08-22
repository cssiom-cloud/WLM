import { AnimatePresence, motion } from 'framer-motion';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider, GlobalLayout, useAuth } from './components/GlobalLayout.jsx';
import Login from './pages/Login.jsx';
import CharacterSelect from './pages/CharacterSelect.jsx';
import Dashboard from './pages/Dashboard.jsx';
import OperationsBoard from './pages/OperationsBoard.jsx';
import OfficialDocument from './pages/OfficialDocument.jsx';
import Settings from './pages/Settings.jsx';

const pageTransition = {
  duration: 0.4,
  ease: 'easeInOut'
};

const pageMotion = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: pageTransition
};

const STANDALONE_PATHS = new Set(['/login', '/select', '/characters']);

function routeShellKey(pathname, locationKey) {
  return STANDALONE_PATHS.has(pathname) ? locationKey : 'command-shell';
}

function BootScreen() {
  return (
    <div className="grid min-h-screen place-items-center bg-ivory">
      <p className="text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-slate-500">Loading</p>
    </div>
  );
}

function GuestOnly({ children }) {
  const { bootstrapping, isAuthenticated, activePersonnel } = useAuth();

  if (bootstrapping) {
    return <BootScreen />;
  }

  if (isAuthenticated && !activePersonnel) {
    return <Navigate to="/select" replace />;
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

function RequireSession({ children }) {
  const { bootstrapping, isAuthenticated } = useAuth();

  if (bootstrapping) {
    return <BootScreen />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

function RequireAuth({ children }) {
  const { bootstrapping, isAuthenticated, activePersonnel } = useAuth();

  if (bootstrapping) {
    return <BootScreen />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!activePersonnel) {
    return <Navigate to="/select" replace />;
  }

  return children;
}

function RootRedirect() {
  const { bootstrapping, isAuthenticated, activePersonnel } = useAuth();

  if (bootstrapping) {
    return <BootScreen />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!activePersonnel) {
    return <Navigate to="/select" replace />;
  }

  return <Navigate to="/dashboard" replace />;
}

function AnimatedRoutes() {
  const location = useLocation();
  const standalone = STANDALONE_PATHS.has(location.pathname);

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={routeShellKey(location.pathname, location.key)}
        className="min-h-screen"
        initial={standalone ? pageMotion.initial : { opacity: 0 }}
        animate={standalone ? pageMotion.animate : { opacity: 1 }}
        exit={standalone ? pageMotion.exit : { opacity: 0 }}
        transition={pageTransition}
      >
        <Routes location={location}>
          <Route
            path="/login"
            element={
              <GuestOnly>
                <Login />
              </GuestOnly>
            }
          />
          <Route
            path="/select"
            element={
              <RequireSession>
                <CharacterSelect />
              </RequireSession>
            }
          />
          <Route
            path="/characters"
            element={
              <RequireSession>
                <CharacterSelect />
              </RequireSession>
            }
          />
          <Route path="/" element={<RootRedirect />} />
          <Route
            element={
              <RequireAuth>
                <GlobalLayout />
              </RequireAuth>
            }
          >
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/operations" element={<OperationsBoard />} />
            <Route path="/documents" element={<OfficialDocument />} />
            <Route path="/settings" element={<Settings />} />
          </Route>
          <Route path="*" element={<RootRedirect />} />
        </Routes>
      </motion.div>
    </AnimatePresence>
  );
}

export default function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '')}>
      <AuthProvider>
        <div className="min-h-screen bg-ivory font-sans text-slate-800 antialiased">
          <AnimatedRoutes />
        </div>
      </AuthProvider>
    </BrowserRouter>
  );
}
