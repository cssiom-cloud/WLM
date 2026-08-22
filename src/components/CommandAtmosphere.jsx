import { useEffect, useRef, useState } from 'react';

const CELL = 52;
const SHARDS = Array.from({ length: 12 }, (_, index) => ({
  id: index,
  left: 4 + ((index * 8.2) % 92),
  size: 36 + ((index * 13) % 48),
  delay: index * 1.15,
  duration: 16 + (index % 6) * 2.4,
  rotate: -18 + (index % 7) * 9
}));

export default function CommandAtmosphere({ theme = 'light', rain = false, glassVisible = true, glassMotion = true }) {
  const gridRef = useRef(null);
  const rainRef = useRef(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });

  useEffect(() => {
    function onMove(event) {
      const x = event.clientX / Math.max(window.innerWidth, 1) - 0.5;
      const y = event.clientY / Math.max(window.innerHeight, 1) - 0.5;
      setTilt({ x, y });
      document.documentElement.style.setProperty('--pointer-x', x.toFixed(4));
      document.documentElement.style.setProperty('--pointer-y', y.toFixed(4));
    }
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => window.removeEventListener('pointermove', onMove);
  }, []);

  useEffect(() => {
    const canvas = gridRef.current;
    if (!canvas) {
      return undefined;
    }
    const ctx = canvas.getContext('2d');
    const mouse = { x: -9999, y: -9999 };
    let frame = 0;
    let width = 0;
    let height = 0;
    let dpr = 1;
    let scrollY = window.scrollY;

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function paint() {
      const rgb = theme === 'dark' ? '165, 180, 252' : '30, 78, 140';
      const offsetY = (scrollY * 0.1) % CELL;
      const offsetX = (scrollY * 0.03) % CELL;
      ctx.clearRect(0, 0, width, height);
      ctx.lineWidth = 1;
      ctx.strokeStyle = `rgba(${rgb}, ${theme === 'dark' ? 0.07 : 0.08})`;
      ctx.beginPath();
      for (let x = -offsetX; x <= width + CELL; x += CELL) {
        ctx.moveTo(x + 0.5, 0);
        ctx.lineTo(x + 0.5, height);
      }
      for (let y = -offsetY; y <= height + CELL; y += CELL) {
        ctx.moveTo(0, y + 0.5);
        ctx.lineTo(width, y + 0.5);
      }
      ctx.stroke();
      const hoverX = Math.floor((mouse.x + offsetX) / CELL) * CELL - offsetX;
      const hoverY = Math.floor((mouse.y + offsetY) / CELL) * CELL - offsetY;
      if (mouse.x >= 0) {
        ctx.fillStyle = `rgba(${rgb}, 0.12)`;
        ctx.fillRect(hoverX, hoverY, CELL, CELL);
      }
      frame = window.requestAnimationFrame(paint);
    }

    function onMove(event) {
      mouse.x = event.clientX;
      mouse.y = event.clientY;
    }

    function onLeave() {
      mouse.x = -9999;
      mouse.y = -9999;
    }

    resize();
    paint();
    window.addEventListener('resize', resize);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerleave', onLeave);
    window.addEventListener('scroll', () => {
      scrollY = window.scrollY;
    }, { passive: true });
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerleave', onLeave);
    };
  }, [theme]);

  useEffect(() => {
    const canvas = rainRef.current;
    if (!canvas || !rain) {
      return undefined;
    }
    const ctx = canvas.getContext('2d');
    let width = 0;
    let height = 0;
    let dpr = 1;
    let frame = 0;
    const drops = Array.from({ length: 140 }, () => ({
      x: Math.random(),
      y: Math.random(),
      len: 10 + Math.random() * 16,
      speed: 0.012 + Math.random() * 0.02,
      thick: 0.7 + Math.random() * 0.8
    }));
    const beads = Array.from({ length: 46 }, () => ({
      x: Math.random(),
      y: Math.random(),
      r: 1.2 + Math.random() * 2.4,
      drift: 0.0004 + Math.random() * 0.0008
    }));

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function paint() {
      ctx.clearRect(0, 0, width, height);
      const stroke = theme === 'dark' ? 'rgba(210, 224, 255, 0.38)' : 'rgba(80, 110, 160, 0.28)';
      const bead = theme === 'dark' ? 'rgba(230, 240, 255, 0.42)' : 'rgba(255, 255, 255, 0.55)';
      ctx.strokeStyle = stroke;
      drops.forEach((drop) => {
        drop.y += drop.speed;
        if (drop.y > 1.08) {
          drop.y = -0.08;
          drop.x = Math.random();
        }
        const x = drop.x * width;
        const y = drop.y * height;
        ctx.lineWidth = drop.thick;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - 1.4, y + drop.len);
        ctx.stroke();
      });
      beads.forEach((item) => {
        item.y += item.drift;
        if (item.y > 1) {
          item.y = 0;
          item.x = Math.random();
        }
        ctx.beginPath();
        ctx.fillStyle = bead;
        ctx.arc(item.x * width, item.y * height, item.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.arc(item.x * width - item.r * 0.35, item.y * height - item.r * 0.35, item.r * 0.35, 0, Math.PI * 2);
        ctx.fill();
      });
      frame = window.requestAnimationFrame(paint);
    }

    resize();
    paint();
    window.addEventListener('resize', resize);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', resize);
    };
  }, [rain, theme]);

  return (
    <div className="fx-aurora" aria-hidden="true">
      <div className="fx-parallax" style={{ transform: `translate3d(${tilt.x * 26}px, ${tilt.y * 16}px, 0)` }}>
        <span className="fx-aurora-orb fx-aurora-a" />
        <span className="fx-aurora-orb fx-aurora-b" />
        <span className="fx-aurora-orb fx-aurora-c" />
      </div>
      {glassVisible ? (
        <div className={`fx-glass-field ${glassMotion ? 'is-falling' : 'is-still'}`}>
          {SHARDS.map((shard) => (
            <span
              key={shard.id}
              className="fx-glass-shard"
              style={{
                left: `${shard.left}%`,
                width: shard.size,
                height: shard.size,
                animationDelay: `${shard.delay}s`,
                animationDuration: `${shard.duration}s`,
                '--glass-rot': `${shard.rotate}deg`
              }}
            />
          ))}
        </div>
      ) : null}
      <div className="fx-retro-grid" />
      <canvas ref={gridRef} className="fx-grid-canvas" />
      {rain ? <canvas ref={rainRef} className="fx-rain-canvas" /> : null}
    </div>
  );
}
