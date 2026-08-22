import { useRef, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { FileText, Home, Map, Megaphone, Settings, Users } from 'lucide-react';

const ICON_SPRING = { mass: 0.14, stiffness: 280, damping: 16 };
const MAGNET_SPRING = { mass: 0.32, stiffness: 340, damping: 24 };
const WAVE_RANGE = 148;
const MAGNET_RANGE = 88;
const MAGNET_PULL = 8;
const MAGNET_HOVER = 0.2;

const DOCK_ITEMS = [
  { id: 'home', to: '/', end: true, icon: Home, labelKey: 'home' },
  { id: 'personnel', to: '/directory', icon: Users, labelKey: 'dashboard' },
  { id: 'operations', to: '/operations', icon: Map, labelKey: 'board' },
  { id: 'announcements', to: '/announcements', icon: Megaphone, labelKey: 'announcements' },
  { id: 'documents', to: '/memo', icon: FileText, labelKey: 'documents' },
  { id: 'settings', to: '/settings', icon: Settings, labelKey: 'settings' }
];

export function DockItem({ mouseX, to, end = false, label, icon: Icon }) {
  const itemRef = useRef(null);
  const navigate = useNavigate();
  const [hovered, setHovered] = useState(false);
  const hoverMagnetX = useMotionValue(0);
  const hoverMagnetY = useMotionValue(0);

  const distance = useTransform(mouseX, (cursorX) => {
    const node = itemRef.current;
    if (!node || !Number.isFinite(cursorX)) {
      return Number.POSITIVE_INFINITY;
    }
    const { left, width } = node.getBoundingClientRect();
    return cursorX - left - width / 2;
  });

  const scaleTarget = useTransform(distance, (value) => {
    if (!Number.isFinite(value)) {
      return 1;
    }
    const abs = Math.abs(value);
    if (abs >= WAVE_RANGE) {
      return 1;
    }
    const t = 1 - abs / WAVE_RANGE;
    const eased = t * t * (3 - 2 * t);
    return 1 + 0.5 * eased;
  });

  const slotTarget = useTransform(scaleTarget, (value) => 48 + 26 * (value - 1));
  const magnetXTarget = useTransform(distance, (value) => {
    if (!Number.isFinite(value) || Math.abs(value) >= MAGNET_RANGE) {
      return 0;
    }
    return (value / MAGNET_RANGE) * MAGNET_PULL;
  });

  const scale = useSpring(scaleTarget, ICON_SPRING);
  const slot = useSpring(slotTarget, ICON_SPRING);
  const waveX = useSpring(magnetXTarget, MAGNET_SPRING);
  const hoverX = useSpring(hoverMagnetX, MAGNET_SPRING);
  const hoverY = useSpring(hoverMagnetY, MAGNET_SPRING);
  const x = useTransform([waveX, hoverX], ([wave, hover]) => wave + hover);

  function handlePointerMove(event) {
    const node = itemRef.current;
    if (!node) {
      return;
    }
    const rect = node.getBoundingClientRect();
    hoverMagnetX.set((event.clientX - (rect.left + rect.width / 2)) * MAGNET_HOVER);
    hoverMagnetY.set((event.clientY - (rect.top + rect.height / 2)) * MAGNET_HOVER);
  }

  function handlePointerLeave() {
    hoverMagnetX.set(0);
    hoverMagnetY.set(0);
    setHovered(false);
  }

  return (
    <motion.li style={{ width: slot }} className="relative flex h-[4.25rem] items-end justify-center">
      <motion.div
        ref={itemRef}
        style={{ scale, x, y: hoverY, transformOrigin: '50% 100%' }}
        className="grid h-12 w-12 place-items-center"
        onPointerEnter={() => setHovered(true)}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
      >
        <NavLink
          to={to}
          end={end}
          aria-label={label}
          title={label}
          onClick={(event) => {
            event.preventDefault();
            navigate(to);
          }}
          className={({ isActive }) =>
            `grid h-12 w-12 place-items-center rounded-2xl border no-underline shadow-sm transition-colors duration-200 ${
              isActive
                ? 'border-transparent bg-[var(--accent)] text-[var(--accent-ink)] shadow-[0_8px_22px_color-mix(in_srgb,var(--accent)_35%,transparent)]'
                : 'border-[color-mix(in_srgb,var(--border)_80%,transparent)] bg-[color-mix(in_srgb,var(--bg-elevated)_72%,transparent)] text-[var(--text-muted)] hover:border-[var(--accent)] hover:text-[var(--text)]'
            }`
          }
        >
          <Icon className="h-[1.35rem] w-[1.35rem]" strokeWidth={1.75} aria-hidden="true" />
        </NavLink>
      </motion.div>

      <motion.span
        aria-hidden="true"
        className="pointer-events-none absolute -top-8 left-1/2 z-10 whitespace-nowrap rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] px-2.5 py-1 text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-[var(--text)] shadow-[0_8px_24px_rgba(15,23,42,0.18)] backdrop-blur-xl"
        initial={false}
        animate={{
          opacity: hovered ? 1 : 0,
          y: hovered ? 0 : 6,
          x: '-50%'
        }}
        transition={{ type: 'spring', stiffness: 400, damping: 28 }}
      >
        {label}
      </motion.span>
    </motion.li>
  );
}

export default function TacticalDock({ copy = {}, zenMode = false }) {
  const mouseX = useMotionValue(Number.POSITIVE_INFINITY);

  return (
    <motion.nav
      aria-label="Command dock"
      className="pointer-events-none fixed inset-x-0 bottom-5 z-40 hidden justify-center lg:flex"
      animate={{ opacity: zenMode ? 0.22 : 1 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
    >
      <div
        className="pointer-events-auto flex items-end rounded-full border border-[var(--border)] bg-[color-mix(in_srgb,var(--bg-elevated)_78%,transparent)] px-2.5 pb-1.5 pt-2 shadow-[0_18px_48px_rgba(15,23,42,0.16),0_0_0_1px_color-mix(in_srgb,var(--border)_80%,transparent)] backdrop-blur-2xl"
        onPointerMove={(event) => {
          mouseX.set(event.clientX);
        }}
        onPointerLeave={() => {
          mouseX.set(Number.POSITIVE_INFINITY);
        }}
      >
        <ul className="m-0 flex list-none items-end gap-0.5 p-0">
          {DOCK_ITEMS.map((item) => (
            <DockItem
              key={item.id}
              mouseX={mouseX}
              to={item.to}
              end={item.end}
              icon={item.icon}
              label={copy[item.labelKey] || copy.home}
            />
          ))}
        </ul>
      </div>
    </motion.nav>
  );
}
