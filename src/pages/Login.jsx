import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../components/GlobalLayout.jsx';
import VaultLogin from '../components/VaultLogin.jsx';

const orbEase = [0.42, 0, 0.58, 1];

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();

  function handleLoginSuccess() {
    login();
    navigate('/select', { replace: true });
  }

  return (
    <main className="relative isolate min-h-screen overflow-hidden bg-navy">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(18,38,58,0.9),transparent_58%)]" />
        <motion.div
          className="absolute -left-24 top-[-12%] h-[30rem] w-[30rem] rounded-full bg-gold/[0.14] blur-[140px]"
          animate={{ x: [0, 36, -18, 0], y: [0, 22, 10, 0], opacity: [0.16, 0.26, 0.14, 0.16] }}
          transition={{ duration: 22, repeat: Infinity, ease: orbEase }}
        />
        <motion.div
          className="absolute -right-20 bottom-[-14%] h-[28rem] w-[28rem] rounded-full bg-[#1a4452]/50 blur-[130px]"
          animate={{ x: [0, -28, 14, 0], y: [0, -16, 8, 0], opacity: [0.18, 0.3, 0.16, 0.18] }}
          transition={{ duration: 26, repeat: Infinity, ease: orbEase }}
        />
        <motion.div
          className="absolute left-1/2 top-[18%] h-[22rem] w-[22rem] -translate-x-1/2 rounded-full border border-gold/[0.08] bg-gold/[0.03] blur-2xl"
          animate={{ opacity: [0.1, 0.2, 0.08, 0.1], scale: [1, 1.06, 0.98, 1] }}
          transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>

      <div className="relative z-10 mx-auto grid min-h-screen w-full max-w-md place-items-center px-6 py-16">
        <div className="w-full">
          <header className="mb-8 text-center">
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-gold">Official portal</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ivory">W.L.R Command Personnel</h1>
            <p className="mt-2 text-sm text-ivory/55">Sealed access for authorized command staff.</p>
          </header>
          <VaultLogin onLoginSuccess={handleLoginSuccess} />
        </div>
      </div>
    </main>
  );
}
