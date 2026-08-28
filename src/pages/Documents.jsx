import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Download,
  ExternalLink,
  Eye,
  File,
  FileCheck,
  FileText,
  Filter,
  Paperclip,
  PlusCircle,
  Search,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  UploadCloud,
  X,
  XCircle
} from 'lucide-react';
import { useCommand } from '../components/GlobalLayout.jsx';
import { useToast } from '../components/LiquidToast.jsx';
import { isAdmin } from '../lib/access.js';
import { deleteDocument, fetchDocuments, saveDocument } from '../lib/services.js';
import {
  DOCUMENT_TYPES,
  fetchAllDocumentsForVerifier,
  fetchMyDocuments,
  submitVerificationDocument,
  updateDocumentVerificationStatus,
  uploadDocumentFile
} from '../lib/document-verification-service.js';
import { ConfirmDialog, PageHeader, btnDanger, btnGhost, btnPrimary, fieldClass, glassClass, renderMarkdown } from '../lib/ui.jsx';

const ease = [0.22, 1, 0.36, 1];

export default function Documents() {
  const { supabase, t, activePersonnel, lang } = useCommand();
  const toast = useToast();

  // Tab: 'memos' | 'submit_verify' | 'verifier_dashboard'
  const [activeTab, setActiveTab] = useState('submit_verify');

  // Memos State
  const [memoDocs, setMemoDocs] = useState([]);
  const [activeMemoId, setActiveMemoId] = useState(null);
  const [memoMode, setMemoMode] = useState(null);
  const [memoTitle, setMemoTitle] = useState('');
  const [memoMarkdown, setMemoMarkdown] = useState('');
  const [memoConfirmOpen, setMemoConfirmOpen] = useState(false);

  // Verification Submission State
  const [myDocs, setMyDocs] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [docTitle, setDocTitle] = useState('');
  const [docType, setDocType] = useState('identification');
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef(null);

  // Verifier Dashboard State
  const [verifierDocs, setVerifierDocs] = useState([]);
  const [verifierFilter, setVerifierFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [reviewModalDoc, setReviewModalDoc] = useState(null);
  const [reviewNote, setReviewNote] = useState('');
  const [reviewing, setReviewing] = useState(false);

  const admin = isAdmin(activePersonnel);
  const isVerifier = admin || ['Commander', 'Executive', 'Admin', 'Officer', 'Verifier'].includes(activePersonnel?.role);

  // Load Memos
  const loadMemos = useCallback(async () => {
    try {
      const rows = await fetchDocuments(supabase);
      setMemoDocs(rows);
      setActiveMemoId((current) => current || rows[0]?.id || null);
    } catch (err) {
      console.warn('Load memos error:', err);
    }
  }, [supabase]);

  // Load User's Own Documents
  const loadMyDocs = useCallback(async () => {
    if (!activePersonnel?.id) return;
    try {
      const rows = await fetchMyDocuments(supabase, activePersonnel.id);
      setMyDocs(rows);
    } catch (err) {
      toast.alert(err.message);
    }
  }, [supabase, activePersonnel?.id, toast]);

  // Load Verifier Documents
  const loadVerifierDocs = useCallback(async () => {
    if (!isVerifier) return;
    try {
      const rows = await fetchAllDocumentsForVerifier(supabase, {
        status: verifierFilter,
        searchQuery
      });
      setVerifierDocs(rows);
    } catch (err) {
      toast.alert(err.message);
    }
  }, [supabase, isVerifier, verifierFilter, searchQuery, toast]);

  useEffect(() => {
    loadMemos();
    loadMyDocs();
    if (isVerifier) {
      loadVerifierDocs();
    }
  }, [loadMemos, loadMyDocs, loadVerifierDocs, isVerifier]);

  // Handle Document Upload & Submission
  async function handleDocSubmit(event) {
    event.preventDefault();
    if (!docTitle.trim()) {
      toast.alert(lang === 'th' ? 'กรุณากรอกชื่อเอกสาร' : 'Please enter document title');
      return;
    }
    if (!selectedFile) {
      toast.alert(lang === 'th' ? 'กรุณาเลือกไฟล์เอกสาร (PDF หรือรูปภาพ)' : 'Please select a document file');
      return;
    }

    setSubmitting(true);
    try {
      // 1. Upload to Supabase Storage
      const uploadRes = await uploadDocumentFile(supabase, selectedFile, activePersonnel?.id);

      // 2. Insert into documents table
      await submitVerificationDocument(supabase, {
        personnelId: activePersonnel?.id,
        title: docTitle,
        documentType: docType,
        fileUrl: uploadRes.fileUrl,
        fileName: uploadRes.fileName,
        fileSize: uploadRes.fileSize,
        fileType: uploadRes.fileType
      });

      toast.success(lang === 'th' ? 'ส่งเอกสารเพื่อรอการตรวจสอบเรียบร้อยแล้ว' : 'Document submitted for verification successfully');
      setDocTitle('');
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      await loadMyDocs();
      if (isVerifier) await loadVerifierDocs();
    } catch (err) {
      toast.alert(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  // Handle Review Action (Approve / Reject)
  async function handleReviewAction(newStatus) {
    if (!reviewModalDoc) return;
    if (newStatus === 'rejected' && !reviewNote.trim()) {
      toast.alert(lang === 'th' ? 'กรุณาระบุหมายเหตุหรือเหตุผลการปฏิเสธ' : 'Please provide a reviewer note explaining the rejection');
      return;
    }

    setReviewing(true);
    try {
      await updateDocumentVerificationStatus(supabase, {
        documentId: reviewModalDoc.id,
        status: newStatus,
        reviewerNote: reviewNote,
        reviewerPersonnelId: activePersonnel?.id
      });

      toast.success(
        newStatus === 'approved'
          ? (lang === 'th' ? 'อนุมัติเอกสารเรียบร้อยแล้ว' : 'Document approved successfully')
          : (lang === 'th' ? 'ปฏิเสธเอกสารเรียบร้อยแล้ว' : 'Document rejected')
      );

      setReviewModalDoc(null);
      setReviewNote('');
      await loadVerifierDocs();
      await loadMyDocs();
    } catch (err) {
      toast.alert(err.message);
    } finally {
      setReviewing(false);
    }
  }

  // Status Metrics for Verifier
  const metrics = useMemo(() => {
    const total = verifierDocs.length;
    const pending = verifierDocs.filter(d => d.status === 'pending').length;
    const approved = verifierDocs.filter(d => d.status === 'approved').length;
    const rejected = verifierDocs.filter(d => d.status === 'rejected').length;
    return { total, pending, approved, rejected };
  }, [verifierDocs]);

  // Memo Active
  const activeMemo = memoDocs.find((doc) => doc.id === activeMemoId) || memoDocs[0] || null;

  return (
    <motion.section
      className="mx-auto max-w-6xl space-y-6"
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease }}
    >
      <PageHeader
        kicker={lang === 'th' ? 'ระบบเอกสารและศูนย์ตรวจสอบ' : 'Document & Verification Portal'}
        title={lang === 'th' ? 'คลังเอกสาร & ตรวจสอบยืนยัน' : 'Documents & Verification'}
      />

      {/* Modern Tab Navigation */}
      <div className="flex flex-wrap items-center gap-2 border-b border-stone-200/80 pb-3 dark:border-white/10">
        <button
          type="button"
          onClick={() => setActiveTab('submit_verify')}
          className={`flex items-center gap-2 rounded-2xl px-4 py-2 text-xs font-bold transition ${
            activeTab === 'submit_verify'
              ? 'bg-[var(--accent)] text-white shadow-lg shadow-[var(--accent)]/20'
              : 'text-[var(--text-muted)] hover:bg-white/60 dark:hover:bg-white/5'
          }`}
        >
          <UploadCloud className="h-4 w-4" />
          <span>{lang === 'th' ? 'ส่งเอกสาร & ติดตามสถานะ' : 'Submit & Track Verification'}</span>
          {myDocs.length > 0 ? (
            <span className="ml-1 rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-extrabold">{myDocs.length}</span>
          ) : null}
        </button>

        {isVerifier ? (
          <button
            type="button"
            onClick={() => setActiveTab('verifier_dashboard')}
            className={`flex items-center gap-2 rounded-2xl px-4 py-2 text-xs font-bold transition ${
              activeTab === 'verifier_dashboard'
                ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/20'
                : 'text-[var(--text-muted)] hover:bg-white/60 dark:hover:bg-white/5'
            }`}
          >
            <ShieldCheck className="h-4 w-4" />
            <span>{lang === 'th' ? 'ศูนย์ตรวจสอบเอกสาร (Verifier)' : 'Verifier Dashboard'}</span>
            {metrics.pending > 0 ? (
              <span className="ml-1 rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-extrabold text-white animate-pulse">
                {metrics.pending}
              </span>
            ) : null}
          </button>
        ) : null}

        <button
          type="button"
          onClick={() => setActiveTab('memos')}
          className={`flex items-center gap-2 rounded-2xl px-4 py-2 text-xs font-bold transition ${
            activeTab === 'memos'
              ? 'bg-[var(--accent)] text-white shadow-lg shadow-[var(--accent)]/20'
              : 'text-[var(--text-muted)] hover:bg-white/60 dark:hover:bg-white/5'
          }`}
        >
          <FileText className="h-4 w-4" />
          <span>{lang === 'th' ? 'ประกาศคำสั่ง & บันทึกข้อความ' : 'Official Memos & Lore'}</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: SUBMIT & TRACK DOCUMENTS                                          */}
      {/* ========================================================================= */}
      {activeTab === 'submit_verify' && (
        <div className="grid gap-6 lg:grid-cols-[1.1fr_1.3fr]">
          {/* Document Upload Form */}
          <motion.div
            className={`${glassClass} p-6`}
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, ease }}
          >
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)]">
                <UploadCloud className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  {lang === 'th' ? 'ยื่นคำขอตรวจสอบเอกสาร' : 'Submit Document for Verification'}
                </h3>
                <p className="text-xs text-[var(--text-muted)]">
                  {lang === 'th' ? 'รองรับไฟล์ PDF, PNG, JPG ขนาดไม่เกิน 50MB' : 'Supports PDF, PNG, JPG up to 50MB'}
                </p>
              </div>
            </div>

            <form onSubmit={handleDocSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                  {lang === 'th' ? 'ชื่อเอกสาร / หัวข้อคำขอ' : 'Document Title'}
                </label>
                <input
                  type="text"
                  required
                  placeholder={lang === 'th' ? 'เช่น บัตรประจำตัวประชาชน, รายงานภารกิจที่ 4' : 'e.g. Identity Card, Mission Report'}
                  value={docTitle}
                  onChange={(e) => setDocTitle(e.target.value)}
                  className={fieldClass}
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                  {lang === 'th' ? 'ประเภทเอกสาร' : 'Document Type'}
                </label>
                <select
                  value={docType}
                  onChange={(e) => setDocType(e.target.value)}
                  className={fieldClass}
                >
                  {DOCUMENT_TYPES.map((type) => (
                    <option key={type.id} value={type.id}>
                      {lang === 'th' ? type.labelTh : type.labelEn}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                  {lang === 'th' ? 'ไฟล์แนบเอกสาร' : 'Attach File'}
                </label>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="group flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 p-6 text-center transition hover:border-[var(--accent)] dark:border-white/10 dark:hover:border-[var(--accent)]"
                >
                  <Paperclip className="h-8 w-8 text-slate-400 transition group-hover:scale-110 group-hover:text-[var(--accent)]" />
                  {selectedFile ? (
                    <div className="mt-2 text-center">
                      <strong className="block text-xs text-slate-900 dark:text-slate-100">{selectedFile.name}</strong>
                      <small className="text-[11px] text-slate-400">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</small>
                    </div>
                  ) : (
                    <div className="mt-2 text-center">
                      <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                        {lang === 'th' ? 'คลิกเพื่อเลือกไฟล์ หรือลากไฟล์มาวางที่นี่' : 'Click to browse or drag and drop file'}
                      </p>
                      <small className="text-[10px] text-slate-400">PDF, JPG, PNG, WEBP</small>
                    </div>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg,.webp"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files?.[0]) setSelectedFile(e.target.files[0]);
                    }}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className={`${btnPrimary} w-full justify-center py-3 font-bold`}
              >
                <UploadCloud className="h-4 w-4" />
                <span>{submitting ? (lang === 'th' ? 'กำลังอัปโหลด...' : 'Uploading...') : (lang === 'th' ? 'ส่งเอกสารตรวจสอบ' : 'Submit for Verification')}</span>
              </button>
            </form>
          </motion.div>

          {/* User's Document Tracking List */}
          <motion.div
            className="space-y-3"
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, ease }}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold uppercase tracking-wider text-[var(--text-muted)]">
                {lang === 'th' ? 'สถานะเอกสารที่ยื่นไว้' : 'Submitted Document Tracking'}
              </h3>
              <span className="text-xs text-slate-400">{myDocs.length} {lang === 'th' ? 'รายการ' : 'items'}</span>
            </div>

            {myDocs.length === 0 ? (
              <div className={`${glassClass} p-8 text-center`}>
                <File className="mx-auto h-10 w-10 text-slate-300 dark:text-slate-600" />
                <p className="mt-2 text-xs font-semibold text-slate-500">
                  {lang === 'th' ? 'ยังไม่มีเอกสารที่ยื่นตรวจสอบ' : 'No submitted documents yet'}
                </p>
              </div>
            ) : (
              myDocs.map((doc) => (
                <div key={doc.id} className={`${glassClass} p-4 transition hover:border-[var(--accent)]/40`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 dark:bg-white/5">
                        <FileText className="h-5 w-5 text-slate-500" />
                      </div>
                      <div>
                        <strong className="block text-sm font-bold text-slate-900 dark:text-slate-100">{doc.title}</strong>
                        <small className="text-[11px] text-slate-400">
                          {DOCUMENT_TYPES.find(t => t.id === doc.document_type)?.labelTh || doc.document_type} • {new Date(doc.created_at).toLocaleDateString()}
                        </small>
                      </div>
                    </div>

                    {/* Status Badge */}
                    {doc.status === 'pending' && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[11px] font-bold text-amber-500">
                        <Clock className="h-3 w-3" />
                        <span>{lang === 'th' ? 'รอตรวจสอบ' : 'Pending'}</span>
                      </span>
                    )}
                    {doc.status === 'approved' && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-bold text-emerald-500">
                        <CheckCircle2 className="h-3 w-3" />
                        <span>{lang === 'th' ? 'อนุมัติแล้ว' : 'Approved'}</span>
                      </span>
                    )}
                    {doc.status === 'rejected' && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-red-500/30 bg-red-500/10 px-2.5 py-1 text-[11px] font-bold text-red-500">
                        <XCircle className="h-3 w-3" />
                        <span>{lang === 'th' ? 'ไม่ผ่านการอนุมัติ' : 'Rejected'}</span>
                      </span>
                    )}
                  </div>

                  {/* Reviewer Note if available */}
                  {doc.reviewer_note && (
                    <div className="mt-3 rounded-xl border border-slate-200/60 bg-slate-50 p-2.5 text-xs text-slate-600 dark:border-white/5 dark:bg-slate-900/50 dark:text-slate-300">
                      <strong className="block text-[10px] uppercase tracking-wider text-slate-400">
                        {lang === 'th' ? 'หมายเหตุจากฝ่ายตรวจสอบ' : 'Reviewer Note'}:
                      </strong>
                      <p className="mt-0.5">{doc.reviewer_note}</p>
                    </div>
                  )}

                  <div className="mt-3 flex items-center justify-between border-t border-stone-200/60 pt-2.5 dark:border-white/5">
                    <span className="text-[11px] text-slate-400">{doc.file_name}</span>
                    <a
                      href={doc.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--accent)] hover:underline"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      <span>{lang === 'th' ? 'เปิดดูไฟล์' : 'View File'}</span>
                    </a>
                  </div>
                </div>
              ))
            )}
          </motion.div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: VERIFIER DASHBOARD                                                */}
      {/* ========================================================================= */}
      {activeTab === 'verifier_dashboard' && isVerifier && (
        <div className="space-y-6">
          {/* Metrics KPIs */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className={`${glassClass} p-4 text-center`}>
              <small className="text-[11px] uppercase tracking-wider text-slate-400">{lang === 'th' ? 'เอกสารทั้งหมด' : 'Total Submissions'}</small>
              <strong className="block text-2xl font-black text-slate-900 dark:text-slate-100">{metrics.total}</strong>
            </div>
            <div className={`${glassClass} p-4 text-center border-amber-500/30`}>
              <small className="text-[11px] uppercase tracking-wider text-amber-500">{lang === 'th' ? 'รอตรวจสอบ' : 'Pending Review'}</small>
              <strong className="block text-2xl font-black text-amber-500">{metrics.pending}</strong>
            </div>
            <div className={`${glassClass} p-4 text-center border-emerald-500/30`}>
              <small className="text-[11px] uppercase tracking-wider text-emerald-500">{lang === 'th' ? 'อนุมัติแล้ว' : 'Approved'}</small>
              <strong className="block text-2xl font-black text-emerald-500">{metrics.approved}</strong>
            </div>
            <div className={`${glassClass} p-4 text-center border-red-500/30`}>
              <small className="text-[11px] uppercase tracking-wider text-red-500">{lang === 'th' ? 'ปฏิเสธ' : 'Rejected'}</small>
              <strong className="block text-2xl font-black text-red-500">{metrics.rejected}</strong>
            </div>
          </div>

          {/* Search & Status Filters */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 rounded-2xl bg-slate-100 p-1 dark:bg-white/5">
              {['all', 'pending', 'approved', 'rejected'].map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setVerifierFilter(st)}
                  className={`rounded-xl px-3 py-1.5 text-xs font-bold capitalize transition ${
                    verifierFilter === st
                      ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-slate-100'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-100'
                  }`}
                >
                  {st === 'all' ? (lang === 'th' ? 'ทั้งหมด' : 'All') : st}
                </button>
              ))}
            </div>

            <div className="relative min-w-[240px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder={lang === 'th' ? 'ค้นหาชื่อเอกสาร หรือผู้ยื่น...' : 'Search by title or applicant...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`${fieldClass} pl-9 text-xs`}
              />
            </div>
          </div>

          {/* Verifier Table */}
          <div className={`${glassClass} overflow-hidden p-0`}>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-stone-200/80 bg-slate-50/50 text-[11px] uppercase tracking-wider text-slate-400 dark:border-white/5 dark:bg-slate-900/50">
                  <tr>
                    <th className="px-4 py-3">{lang === 'th' ? 'ผู้ยื่นเอกสาร' : 'Applicant'}</th>
                    <th className="px-4 py-3">{lang === 'th' ? 'เอกสาร / ประเภท' : 'Document Title & Type'}</th>
                    <th className="px-4 py-3">{lang === 'th' ? 'วันที่ยื่น' : 'Date Submitted'}</th>
                    <th className="px-4 py-3">{lang === 'th' ? 'สถานะ' : 'Status'}</th>
                    <th className="px-4 py-3 text-right">{lang === 'th' ? 'การจัดการ' : 'Actions'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-200/60 dark:divide-white/5">
                  {verifierDocs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-400">
                        {lang === 'th' ? 'ไม่พบเอกสารในหมวดหมู่นี้' : 'No documents found in this category'}
                      </td>
                    </tr>
                  ) : (
                    verifierDocs.map((doc) => (
                      <tr key={doc.id} className="transition hover:bg-slate-50/50 dark:hover:bg-white/5">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--accent-soft)] text-xs font-bold text-[var(--accent)]">
                              {doc.personnel?.callsign?.[0] || doc.personnel?.first_name?.[0] || 'U'}
                            </div>
                            <div>
                              <strong className="block font-semibold text-slate-900 dark:text-slate-100">
                                {doc.personnel ? `${doc.personnel.first_name} ${doc.personnel.last_name}` : 'Unknown Personnel'}
                              </strong>
                              <small className="text-[10px] text-slate-400">{doc.personnel?.callsign || doc.personnel?.rank || 'Personnel'}</small>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <strong className="block font-medium text-slate-900 dark:text-slate-100">{doc.title}</strong>
                          <span className="text-[11px] text-slate-400">{doc.document_type}</span>
                        </td>
                        <td className="px-4 py-3 text-slate-500">
                          {new Date(doc.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3">
                          {doc.status === 'pending' && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-500">
                              <Clock className="h-3 w-3" /> Pending
                            </span>
                          )}
                          {doc.status === 'approved' && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-500">
                              <CheckCircle2 className="h-3 w-3" /> Approved
                            </span>
                          )}
                          {doc.status === 'rejected' && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-bold text-red-500">
                              <XCircle className="h-3 w-3" /> Rejected
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => {
                              setReviewModalDoc(doc);
                              setReviewNote(doc.reviewer_note || '');
                            }}
                            className="inline-flex items-center gap-1 rounded-xl bg-[var(--accent-soft)] px-3 py-1.5 text-xs font-bold text-[var(--accent)] transition hover:bg-[var(--accent)] hover:text-white"
                          >
                            <FileCheck className="h-3.5 w-3.5" />
                            <span>{lang === 'th' ? 'ตรวจสอบ' : 'Review'}</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Verification Review Modal */}
          <AnimatePresence>
            {reviewModalDoc && (
              <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setReviewModalDoc(null)}
                  className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                />
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 16 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 16 }}
                  className="relative w-full max-w-lg rounded-3xl border border-slate-200/80 bg-white p-6 shadow-2xl backdrop-blur-2xl dark:border-white/10 dark:bg-slate-950"
                >
                  <div className="flex items-center justify-between border-b border-stone-200 pb-3 dark:border-white/10">
                    <div className="flex items-center gap-2">
                      <FileCheck className="h-5 w-5 text-[var(--accent)]" />
                      <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                        {lang === 'th' ? 'ตรวจสอบและอนุมัติเอกสาร' : 'Document Review Panel'}
                      </h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => setReviewModalDoc(null)}
                      className="rounded-xl p-1 text-slate-400 hover:text-slate-600"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>

                  <div className="mt-4 space-y-3 text-xs">
                    <div>
                      <small className="text-[10px] uppercase tracking-wider text-slate-400">Title &amp; Type</small>
                      <p className="font-bold text-slate-900 dark:text-slate-100">{reviewModalDoc.title}</p>
                      <p className="text-slate-500">{reviewModalDoc.document_type}</p>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-white/5 dark:bg-slate-900/50">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-700 dark:text-slate-300">{reviewModalDoc.file_name}</span>
                        <a
                          href={reviewModalDoc.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[var(--accent)] hover:underline"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          <span>{lang === 'th' ? 'เปิดดูไฟล์ฉบับเต็ม' : 'Open Full File'}</span>
                        </a>
                      </div>
                    </div>

                    <div>
                      <label className="mb-1 block font-bold text-slate-700 dark:text-slate-300">
                        {lang === 'th' ? 'หมายเหตุจากผู้ตรวจสอบ (Reviewer Note)' : 'Reviewer Note & Comments'}
                      </label>
                      <textarea
                        rows={3}
                        placeholder={lang === 'th' ? 'ระบุความคิดเห็น ผลการประเมิน หรือเหตุผลหากปฏิเสธ...' : 'Enter feedback or rejection reason...'}
                        value={reviewNote}
                        onChange={(e) => setReviewNote(e.target.value)}
                        className={`${fieldClass} text-xs`}
                      />
                    </div>
                  </div>

                  <div className="mt-6 flex items-center justify-end gap-2 border-t border-stone-200 pt-3 dark:border-white/10">
                    <button
                      type="button"
                      onClick={() => setReviewModalDoc(null)}
                      className={btnGhost}
                    >
                      {lang === 'th' ? 'ยกเลิก' : 'Cancel'}
                    </button>
                    <button
                      type="button"
                      disabled={reviewing}
                      onClick={() => handleReviewAction('rejected')}
                      className="flex items-center gap-1.5 rounded-2xl bg-red-600 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-red-600/20 hover:bg-red-500 disabled:opacity-50"
                    >
                      <XCircle className="h-4 w-4" />
                      <span>{lang === 'th' ? 'ปฏิเสธ (Reject)' : 'Reject'}</span>
                    </button>
                    <button
                      type="button"
                      disabled={reviewing}
                      onClick={() => handleReviewAction('approved')}
                      className="flex items-center gap-1.5 rounded-2xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-emerald-600/20 hover:bg-emerald-500 disabled:opacity-50"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      <span>{lang === 'th' ? 'อนุมัติ (Approve)' : 'Approve'}</span>
                    </button>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: OFFICIAL MEMOS & LORE                                             */}
      {/* ========================================================================= */}
      {activeTab === 'memos' && (
        <div className="grid gap-6 lg:grid-cols-[16rem_minmax(0,1fr)]">
          <motion.nav className={`${glassClass} p-3`} initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4, ease, delay: 0.05 }}>
            {memoDocs.map((doc, index) => (
              <motion.button
                key={doc.id}
                type="button"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.28, ease, delay: 0.04 * index }}
                className={`mb-1 w-full rounded-xl px-3 py-2 text-left text-sm font-semibold transition ${
                  doc.id === (activeMemo?.id || '') ? 'bg-[var(--accent-soft)] text-[var(--accent)]' : 'hover:bg-white/60 dark:hover:bg-white/5'
                }`}
                onClick={() => {
                  setActiveMemoId(doc.id);
                  setMemoMode(null);
                  setMemoConfirmOpen(false);
                }}
              >
                {doc.title}
              </motion.button>
            ))}
          </motion.nav>

          <motion.div className={`${glassClass} p-6`} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4, ease, delay: 0.08 }}>
            {activeMemo ? (
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">{activeMemo.title}</h2>
                <div className="prose prose-sm mt-4 dark:prose-invert">
                  {renderMarkdown(activeMemo.markdown)}
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-400">{lang === 'th' ? 'เลือกเอกสารเพื่อเปิดดู' : 'Select a memo to read'}</p>
            )}
          </motion.div>
        </div>
      )}
    </motion.section>
  );
}
