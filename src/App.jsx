import { BrowserRouter, Navigate, NavLink, Outlet, Route, Routes } from 'react-router-dom';
import { CommandProvider, GlobalLayout, useCommand } from './components/GlobalLayout.jsx';
import { ToastProvider } from './components/LiquidToast.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Directory from './pages/Directory.jsx';
import OrgChart from './pages/OrgChart.jsx';
import Units from './pages/Units.jsx';
import UnitDetail from './pages/UnitDetail.jsx';
import UnitManage from './pages/UnitManage.jsx';
import OperationsBoard from './pages/OperationsBoard.jsx';
import OperationDetail from './pages/OperationDetail.jsx';
import OperationCreate from './pages/OperationCreate.jsx';
import OfficialDocument from './pages/OfficialDocument.jsx';
import Documents from './pages/Documents.jsx';
import Settings from './pages/Settings.jsx';
import Announcements from './pages/Announcements.jsx';
import AnnouncementDetail from './pages/AnnouncementDetail.jsx';
import AnnounceCreate from './pages/AnnounceCreate.jsx';
import Tickets from './pages/Tickets.jsx';
import Admin from './pages/Admin.jsx';
import Accounts from './pages/Accounts.jsx';
import Logs from './pages/Logs.jsx';
import Lore from './pages/Lore.jsx';
import { getJsxBase } from '../js/ui-mode.js';
import { hasLoginSeal } from './lib/access.js';
import { SITE_LOGO } from './lib/brand.js';

function BootScreen() {
  return (
    <div className="grid min-h-[56vh] place-items-center">
      <p className="text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-slate-500">Establishing command channel</p>
    </div>
  );
}

function Guarded({ children, allowGuest = false }) {
  const { bootstrapping, session, authHold } = useCommand();
  const holdLogin = authHold || (allowGuest && hasLoginSeal());

  if (bootstrapping && !holdLogin) {
    return <BootScreen />;
  }

  if (allowGuest && session) {
    if (holdLogin) {
      return children;
    }
    return <Navigate to="/" replace />;
  }

  if (!allowGuest && !session) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

function GuestChrome() {
  const { lang, setLang, t } = useCommand();
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 flex h-[72px] items-center justify-between border-b border-stone-200/70 bg-white/55 px-4 backdrop-blur-xl dark:border-slate-800/80 dark:bg-slate-950/55">
        <NavLink to="/" className="flex items-center gap-3 text-sm font-semibold tracking-[0.14em] text-slate-800 no-underline dark:text-slate-100">
          <img src={SITE_LOGO} alt="" className="h-10 w-10 rounded-xl border border-stone-200/80 bg-white object-contain p-0.5 dark:border-slate-700 dark:bg-slate-900" />
          WHITE LION REGIMENT
        </NavLink>
        <div className="flex items-center gap-2">
          {['th', 'en'].map((code) => (
            <button
              key={code}
              type="button"
              onClick={() => setLang(code)}
              className={`min-h-11 rounded-xl px-3 text-xs font-semibold uppercase ${
                lang === code ? 'bg-[var(--accent)] text-[var(--accent-ink)]' : 'text-slate-500'
              }`}
            >
              {code}
            </button>
          ))}
          <NavLink to="/login" className="rounded-xl px-3 py-2 text-sm font-semibold text-slate-600 no-underline">
            {t('auth.signinTitle')}
          </NavLink>
        </div>
      </header>
      <main className="px-4 py-6 sm:px-6">
        <Outlet />
      </main>
    </div>
  );
}

function TicketsGate() {
  const { bootstrapping, session } = useCommand();
  if (bootstrapping) {
    return <BootScreen />;
  }
  if (!session) {
    return <GuestChrome />;
  }
  return (
    <Guarded>
      <GlobalLayout />
    </Guarded>
  );
}

function AppRoutes() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <Guarded allowGuest>
            <Login />
          </Guarded>
        }
      />
      <Route path="/select" element={<Navigate to="/settings" replace />} />
      <Route path="/tickets" element={<TicketsGate />}>
        <Route index element={<Tickets />} />
      </Route>
      <Route
        element={
          <Guarded>
            <GlobalLayout />
          </Guarded>
        }
      >
        <Route path="/" element={<Dashboard />} />
        <Route path="/directory" element={<Directory />} />
        <Route path="/org" element={<OrgChart />} />
        <Route path="/units" element={<Units />} />
        <Route path="/units/:code" element={<UnitDetail />} />
        <Route path="/units/:code/manage" element={<UnitManage />} />
        <Route path="/operations" element={<OperationsBoard />} />
        <Route path="/operations/create" element={<OperationCreate />} />
        <Route path="/operations/:id" element={<OperationDetail />} />
        <Route path="/operations/:id/edit" element={<OperationCreate />} />
        <Route path="/announcements" element={<Announcements />} />
        <Route path="/announcements/create" element={<AnnounceCreate />} />
        <Route path="/announcements/:id" element={<AnnouncementDetail />} />
        <Route path="/memo" element={<OfficialDocument />} />
        <Route path="/documents" element={<Navigate to="/memo" replace />} />
        <Route path="/library" element={<Documents />} />
        <Route path="/lore" element={<Lore />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/accounts" element={<Accounts />} />
        <Route path="/logs" element={<Logs />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter basename={getJsxBase()}>
      <CommandProvider>
        <ToastProvider>
          <div className="theme-surface min-h-screen antialiased">
            <AppRoutes />
          </div>
        </ToastProvider>
      </CommandProvider>
    </BrowserRouter>
  );
}
