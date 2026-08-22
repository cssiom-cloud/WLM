import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Download, Printer, RotateCcw } from 'lucide-react';
import { displayRankName, useAuth, useZenMode } from '../components/GlobalLayout.jsx';

const PAPER_WIDTH_CM = 21;
const PAPER_HEIGHT_CM = 29.7;

const DEFAULT_LETTER = {
  department: 'กองบัญชาการกำลังพล ดับเบิลยู.แอล.อาร์',
  office: 'สำนักงานกำลังพลและเอกสารราชการ',
  address: 'อาคารบัญชาการ เขตพระนคร กรุงเทพมหานคร ๑๐๒๐๐',
  documentNumber: 'วลร ๐๔๑๒/๒๕๖๙',
  date: '๒๒ สิงหาคม ๒๕๖๙',
  subject: 'ขอรายงานสถานภาพกำลังพลประจำเดือนสิงหาคม',
  addressee: 'ผู้บัญชาการกำลังพล',
  body: 'ด้วยกองบัญชาการกำลังพล ดับเบิลยู.แอล.อาร์ ได้ดำเนินการตรวจสอบสถานภาพกำลังพลประจำเดือนสิงหาคม พ.ศ. ๒๕๖๙ ตามระเบียบการรายงานกำลังพลของหน่วย ปรากฏว่ากำลังพลที่ได้รับมอบหมายประจำการมีสถานะพร้อมปฏิบัติหน้าที่เป็นส่วนใหญ่ และได้จัดทำสรุปยอดกำลังพล แยกตามสายงานและสถานภาพการปฏิบัติงานเรียบร้อยแล้ว\n\nในการนี้ จึงขอรายงานสถานภาพกำลังพลพร้อมข้อเสนอแนะด้านการหมุนเวียนกำลังและการรักษาความพร้อมของหน่วย เพื่อประกอบการพิจารณาสั่งการของผู้บังคับบัญชาต่อไป\n\nจึงเรียนมาเพื่อโปรดทราบและพิจารณา',
  close: 'ขอแสดงความนับถือ',
  signatoryName: '',
  rank: '',
  position: 'เจ้าหน้าที่เอกสารราชการ กองบัญชาการกำลังพล'
};

function thaiMonths() {
  return [
    'มกราคม',
    'กุมภาพันธ์',
    'มีนาคม',
    'เมษายน',
    'พฤษภาคม',
    'มิถุนายน',
    'กรกฎาคม',
    'สิงหาคม',
    'กันยายน',
    'ตุลาคม',
    'พฤศจิกายน',
    'ธันวาคม'
  ];
}

function toThaiDigits(value) {
  return String(value).replace(/\d/g, (digit) => '๐๑๒๓๔๕๖๗๘๙'[Number(digit)]);
}

function defaultThaiDate() {
  const now = new Date();
  return `${toThaiDigits(now.getDate())} ${thaiMonths()[now.getMonth()]} ${toThaiDigits(now.getFullYear() + 543)}`;
}

function usePaperScale(paperWidthCm = PAPER_WIDTH_CM) {
  const ref = useRef(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const node = ref.current;
    if (!node) {
      return undefined;
    }

    const measure = () => {
      const width = node.clientWidth;
      const paperPx = (paperWidthCm / 2.54) * 96;
      setScale(Math.min(1, width / paperPx));
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [paperWidthCm]);

  return [ref, scale];
}

const fieldClass =
  'w-full rounded-sm border-0 bg-transparent px-0 text-inherit outline-none placeholder:text-neutral-400 focus-visible:ring-2 focus-visible:ring-gold/35 focus-visible:ring-offset-2';

export default function OfficialDocument() {
  const { activePersonnel } = useAuth();
  const { zen, setZen } = useZenMode();
  const reduceMotion = useReducedMotion();
  const [stageRef, scale] = usePaperScale();

  const seeded = useMemo(() => {
    const name = displayRankName(activePersonnel) || 'สิบตรี สมชาย';
    return {
      ...DEFAULT_LETTER,
      date: defaultThaiDate(),
      signatoryName: name,
      rank: activePersonnel?.military_rank || 'สิบตรี',
      position: activePersonnel?.organization_role
        ? `${activePersonnel.organization_role} · กองบัญชาการกำลังพล`
        : DEFAULT_LETTER.position
    };
  }, [activePersonnel]);

  const [letter, setLetter] = useState(seeded);

  useEffect(() => {
    setLetter(seeded);
  }, [seeded]);

  useEffect(() => {
    return () => setZen(false);
  }, [setZen]);

  function updateField(key, value) {
    setLetter((current) => ({ ...current, [key]: value }));
  }

  function handlePaperBlur(event) {
    if (!event.currentTarget.contains(event.relatedTarget)) {
      setZen(false);
    }
  }

  function handleReset() {
    setLetter(seeded);
    setZen(false);
  }

  function handlePrint() {
    window.print();
  }

  function handleExport() {
    const text = [
      letter.department,
      letter.office,
      letter.address,
      '',
      `ที่ ${letter.documentNumber}`,
      letter.date,
      '',
      `เรื่อง ${letter.subject}`,
      `เรียน ${letter.addressee}`,
      '',
      letter.body,
      '',
      letter.close,
      letter.signatoryName,
      letter.rank,
      letter.position
    ].join('\n');

    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `wlr-official-letter-${letter.documentNumber.replace(/\s+/g, '-')}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const fade = reduceMotion ? { duration: 0 } : { duration: 0.4, ease: 'easeInOut' };

  return (
    <section className="mx-auto max-w-5xl">
      <motion.header
        className="print-chrome-hide mb-5 print:hidden"
        animate={{ opacity: zen ? 0.4 : 1 }}
        transition={fade}
      >
        <p className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-gold">Archive</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-navy">Official Documents</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-500">
          Thai formal letter on A4 for command correspondence. Enter the body to quiet the surrounding
          chrome. Print yields the sheet alone.
        </p>
      </motion.header>

      <div className="print-chrome-hide mb-5 flex flex-wrap gap-2 print:hidden">
        <button
          type="button"
          onClick={handlePrint}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-navy px-4 text-sm font-semibold text-ivory transition-colors hover:bg-navy-mid focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
        >
          <Printer className="h-4 w-4" strokeWidth={1.75} />
          Print
        </button>
        <button
          type="button"
          onClick={handleExport}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-navy/10 bg-white px-4 text-sm font-semibold text-navy transition-colors hover:bg-ivory focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
        >
          <Download className="h-4 w-4" strokeWidth={1.75} />
          Export
        </button>
        <button
          type="button"
          onClick={handleReset}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-navy/10 bg-white px-4 text-sm font-semibold text-navy transition-colors hover:bg-ivory focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
        >
          <RotateCcw className="h-4 w-4" strokeWidth={1.75} />
          Reset
        </button>
        <p className="self-center text-xs text-slate-400">
          {zen ? 'Zen mode — chrome dimmed' : 'Focus the letter to enter zen mode'}
        </p>
      </div>

      <div ref={stageRef} className="flex justify-center overflow-x-hidden pb-8">
        <div
          className="a4-stage overflow-hidden"
          style={{
            width: `${PAPER_WIDTH_CM * scale}cm`,
            height: `${PAPER_HEIGHT_CM * scale}cm`
          }}
        >
          {/*
            Thai official letter (หนังสือราชการ) A4:
            paper 21cm × 29.7cm
            margins — top 2.5cm, right 2cm, bottom 2cm, left 2.5cm
          */}
          <article
            lang="th"
            data-print-paper="true"
            className="a4-sheet font-sarabun origin-top-left bg-white text-black shadow-2xl"
            style={{
              width: `${PAPER_WIDTH_CM}cm`,
              minHeight: `${PAPER_HEIGHT_CM}cm`,
              paddingTop: '2.5cm',
              paddingRight: '2cm',
              paddingBottom: '2cm',
              paddingLeft: '2.5cm',
              transform: `scale(${scale})`
            }}
            onFocusCapture={() => setZen(true)}
            onBlurCapture={handlePaperBlur}
          >
            <header className="mb-6 flex items-start gap-4">
              <div
                aria-hidden="true"
                className="grid h-16 w-16 shrink-0 place-items-center rounded-full border border-neutral-400 text-[0.65rem] font-semibold tracking-[0.18em] text-neutral-800"
              >
                WLR
              </div>
              <div className="min-w-0 flex-1">
                <label className="block">
                  <span className="sr-only">หัวกระดาษ</span>
                  <input
                    value={letter.department}
                    onChange={(event) => updateField('department', event.target.value)}
                    className={`${fieldClass} text-[18pt] font-semibold leading-snug`}
                  />
                </label>
                <label className="block">
                  <span className="sr-only">หน่วยงาน</span>
                  <input
                    value={letter.office}
                    onChange={(event) => updateField('office', event.target.value)}
                    className={`${fieldClass} text-[14pt]`}
                  />
                </label>
                <label className="block">
                  <span className="sr-only">ที่อยู่</span>
                  <input
                    value={letter.address}
                    onChange={(event) => updateField('address', event.target.value)}
                    className={`${fieldClass} text-[14pt]`}
                  />
                </label>
              </div>
            </header>

            <div className="mb-5 grid grid-cols-[auto_1fr] items-baseline gap-x-3 gap-y-2 text-[16pt]">
              <span>ที่</span>
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <label className="min-w-[10rem] flex-1">
                  <span className="sr-only">เลขที่หนังสือ</span>
                  <input
                    value={letter.documentNumber}
                    onChange={(event) => updateField('documentNumber', event.target.value)}
                    className={fieldClass}
                  />
                </label>
                <label className="w-[11cm] max-w-full">
                  <span className="sr-only">วันที่</span>
                  <input
                    value={letter.date}
                    onChange={(event) => updateField('date', event.target.value)}
                    className={`${fieldClass} text-right`}
                  />
                </label>
              </div>
              <span>เรื่อง</span>
              <label>
                <span className="sr-only">เรื่อง</span>
                <input
                  value={letter.subject}
                  onChange={(event) => updateField('subject', event.target.value)}
                  className={fieldClass}
                />
              </label>
            </div>

            <label className="mb-5 flex items-baseline gap-3 text-[16pt]">
              <span className="shrink-0">เรียน</span>
              <input
                value={letter.addressee}
                onChange={(event) => updateField('addressee', event.target.value)}
                className={fieldClass}
              />
            </label>

            <label className="block">
              <span className="sr-only">ข้อความ</span>
              <textarea
                value={letter.body}
                onChange={(event) => updateField('body', event.target.value)}
                rows={12}
                className={`${fieldClass} min-h-[8cm] resize-y text-[16pt] leading-[1.8]`}
              />
            </label>

            <footer className="mt-8 ml-auto w-[9.5cm] text-center text-[16pt] leading-relaxed">
              <label className="block">
                <span className="sr-only">คำลงท้าย</span>
                <input
                  value={letter.close}
                  onChange={(event) => updateField('close', event.target.value)}
                  className={`${fieldClass} text-center`}
                />
              </label>
              <div className="my-8 h-12" aria-hidden="true" />
              <label className="flex items-baseline justify-center gap-1">
                <span aria-hidden="true">(</span>
                <span className="sr-only">ลงชื่อ</span>
                <input
                  value={letter.signatoryName}
                  onChange={(event) => updateField('signatoryName', event.target.value)}
                  className={`${fieldClass} text-center`}
                />
                <span aria-hidden="true">)</span>
              </label>
              <label className="block">
                <span className="sr-only">ยศ</span>
                <input
                  value={letter.rank}
                  onChange={(event) => updateField('rank', event.target.value)}
                  className={`${fieldClass} text-center`}
                />
              </label>
              <label className="block">
                <span className="sr-only">ตำแหน่ง</span>
                <input
                  value={letter.position}
                  onChange={(event) => updateField('position', event.target.value)}
                  className={`${fieldClass} text-center`}
                />
              </label>
            </footer>
          </article>
        </div>
      </div>
    </section>
  );
}
