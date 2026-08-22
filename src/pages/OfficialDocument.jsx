import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useCommand } from '../components/GlobalLayout.jsx';

const COPY = {
  en: {
    kicker: 'Archive',
    title: 'Official correspondence',
    lead: 'Draft a formal Thai letter on A4. Focusing a field enters zen mode so only the paper remains present.',
    subject: 'Subject',
    to: 'To',
    body: 'Body',
    docNo: 'Document no.',
    date: 'Date',
    closing: 'Closing',
    sign: 'Signatory',
    zen: 'Zen drafting is active'
  },
  th: {
    kicker: 'คลังเอกสาร',
    title: 'หนังสือราชการ',
    lead: 'ร่างหนังสือราชการบนกระดาษ A4 เมื่อโฟกัสช่องข้อความ ระบบจะเข้าโหมดสงบเพื่อให้เหลือเพียงเอกสาร',
    subject: 'เรื่อง',
    to: 'เรียน',
    body: 'ข้อความ',
    docNo: 'ที่',
    date: 'วันที่',
    closing: 'สรุป',
    sign: 'ผู้ลงนาม',
    zen: 'กำลังร่างในโหมดสงบ'
  }
};

function buddhistDate() {
  const now = new Date();
  const day = now.getDate();
  const month = now.getMonth() + 1;
  const year = now.getFullYear() + 543;
  return `${day}/${month}/${year}`;
}

function ensureSarabun() {
  const id = 'wlr-sarabun-font';
  if (document.getElementById(id)) {
    return;
  }
  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href = 'https://fonts.googleapis.com/css2?family=Sarabun:wght@400;600;700&display=swap';
  document.head.appendChild(link);
}

export default function OfficialDocument() {
  const command = useCommand();
  const { lang, activePersonnel, formatPersonnelName } = command;
  const setZenMode = command.setZenMode;
  const copy = COPY[lang] || COPY.en;
  const paperRef = useRef(null);
  const [localZen, setLocalZen] = useState(false);
  const [subject, setSubject] = useState('');
  const [to, setTo] = useState('');
  const [body, setBody] = useState('');
  const [docNo, setDocNo] = useState('ธด. 1/' + (new Date().getFullYear() + 543));
  const [date, setDate] = useState(buddhistDate());
  const [closing, setClosing] = useState('จึงเรียนมาด้วยเพื่อให้ทราบ และกรุณาแจ้งให้ส่วนราชการในสังกัดทราบ');
  const signName = formatPersonnelName(activePersonnel) || '';

  useEffect(() => {
    ensureSarabun();
    return () => {
      setZenMode?.(false);
    };
  }, [setZenMode]);

  function enterZen() {
    setLocalZen(true);
    setZenMode?.(true);
  }

  function leaveZen() {
    window.setTimeout(() => {
      const active = document.activeElement;
      if (paperRef.current?.contains(active) && (active instanceof HTMLTextAreaElement || active instanceof HTMLInputElement)) {
        return;
      }
      setLocalZen(false);
      setZenMode?.(false);
    }, 0);
  }

  const chromeOpacity = localZen ? 0.1 : 1;
  const paperFont = { fontFamily: '"Sarabun", "TH Sarabun New", "Prompt", serif' };

  return (
    <section className="relative mx-auto max-w-[220mm]">
      <motion.header
        className="mb-6"
        animate={{ opacity: chromeOpacity }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      >
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{copy.kicker}</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">{copy.title}</h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">{copy.lead}</p>
        {localZen ? <p className="mt-2 text-[0.7rem] uppercase tracking-[0.14em] text-slate-400">{copy.zen}</p> : null}
      </motion.header>

      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-[-8%] top-24 -z-10 h-[40rem] rounded-full bg-slate-400/10 blur-3xl dark:bg-slate-700/20"
        animate={{ opacity: chromeOpacity }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      />

      <motion.article
        ref={paperRef}
        className="w-[210mm] max-w-full min-h-[297mm] bg-[#fbf8f1] px-[22mm] py-[18mm] text-slate-900 shadow-2xl"
        style={paperFont}
        animate={{ opacity: 1 }}
      >
        <header className="mb-8 border-b border-slate-300/70 pb-4 text-center">
          <p className="text-sm font-semibold tracking-[0.18em]">WHITE LION REGIMENT</p>
          <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-500">W.L.R Command Personnel</p>
        </header>

        <div className="mb-6 grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1 text-sm font-semibold">
            {copy.docNo}
            <input
              className="min-h-11 border-b border-slate-300 bg-transparent px-0 text-base font-normal outline-none focus:border-slate-700"
              value={docNo}
              onChange={(event) => setDocNo(event.target.value)}
              onFocus={enterZen}
              onBlur={leaveZen}
            />
          </label>
          <label className="grid gap-1 text-sm font-semibold">
            {copy.date}
            <input
              className="min-h-11 border-b border-slate-300 bg-transparent px-0 text-base font-normal outline-none focus:border-slate-700"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              onFocus={enterZen}
              onBlur={leaveZen}
            />
          </label>
        </div>

        <label className="mb-4 grid gap-1 text-sm font-semibold">
          {copy.subject}
          <textarea
            rows={2}
            className="min-h-[4.5rem] w-full resize-y border-b border-slate-300 bg-transparent px-0 text-base font-normal leading-7 outline-none focus:border-slate-700"
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            onFocus={enterZen}
            onBlur={leaveZen}
          />
        </label>

        <label className="mb-4 grid gap-1 text-sm font-semibold">
          {copy.to}
          <textarea
            rows={2}
            className="min-h-[4.5rem] w-full resize-y border-b border-slate-300 bg-transparent px-0 text-base font-normal leading-7 outline-none focus:border-slate-700"
            value={to}
            onChange={(event) => setTo(event.target.value)}
            onFocus={enterZen}
            onBlur={leaveZen}
          />
        </label>

        <label className="mb-6 grid gap-1 text-sm font-semibold">
          {copy.body}
          <textarea
            rows={12}
            className="min-h-[18rem] w-full resize-y bg-transparent px-0 text-base font-normal leading-8 outline-none"
            value={body}
            onChange={(event) => setBody(event.target.value)}
            onFocus={enterZen}
            onBlur={leaveZen}
          />
        </label>

        <label className="mb-10 grid gap-1 text-sm font-semibold">
          {copy.closing}
          <textarea
            rows={3}
            className="min-h-[5.5rem] w-full resize-y bg-transparent px-0 text-base font-normal leading-7 outline-none"
            value={closing}
            onChange={(event) => setClosing(event.target.value)}
            onFocus={enterZen}
            onBlur={leaveZen}
          />
        </label>

        <footer className="ml-auto w-[14rem] text-center text-sm">
          <p className="font-semibold">{copy.sign}</p>
          <p className="mt-10">{signName || '................................'}</p>
          <p className="mt-1 text-slate-500">{activePersonnel?.organization_role || activePersonnel?.military_rank || ''}</p>
        </footer>
      </motion.article>
    </section>
  );
}
