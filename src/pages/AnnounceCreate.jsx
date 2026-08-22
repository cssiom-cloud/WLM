import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useCommand } from '../components/GlobalLayout.jsx';
import { useToast } from '../components/LiquidToast.jsx';
import { isAdmin } from '../lib/access.js';
import { createAnnouncement, fetchAnnouncementBoard, updateAnnouncement } from '../lib/services.js';
import { PageHeader, btnGhost, btnPrimary, fieldClass, FileUploadButton, glassClass, CommandCheck } from '../lib/ui.jsx';
import ImageCropper from '../components/ImageCropper.jsx';

export default function AnnounceCreate() {
  const { supabase, t, activePersonnel } = useCommand();
  const toast = useToast();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const editId = params.get('id');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [capacity, setCapacity] = useState(1);
  const [imageFile, setImageFile] = useState(null);
  const [preview, setPreview] = useState('');
  const [cropFile, setCropFile] = useState(null);
  const [honorEnabled, setHonorEnabled] = useState(false);
  const [honorTitle, setHonorTitle] = useState('');

  const load = useCallback(async () => {
    if (!editId) {
      return;
    }
    const board = await fetchAnnouncementBoard(supabase, activePersonnel?.id);
    const found = board.find((row) => row.id === editId);
    if (!found) {
      return;
    }
    setTitle(found.title || '');
    setContent(found.content || '');
    setCapacity(found.max_capacity || 1);
    setPreview(found.image_url || '');
    setHonorEnabled(Boolean(found.award_honor_enabled));
    setHonorTitle(found.honor_rank_title || '');
  }, [activePersonnel, editId, supabase]);

  useEffect(() => {
    load().catch((error) => toast.alert(error.message));
  }, [load, toast]);

  if (!isAdmin(activePersonnel)) {
    return <p className="text-sm text-slate-500">{t('create.lead') || t('create.title')}</p>;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!title.trim() || !content.trim() || Number(capacity) < 1) {
      toast.alert(t('create.invalid'));
      return;
    }
    if (honorEnabled && !honorTitle.trim()) {
      toast.alert(t('create.honorRequired'));
      return;
    }
    try {
      const payload = {
        title: title.trim(),
        content: content.trim(),
        maxCapacity: Number(capacity),
        createdBy: activePersonnel.id,
        imageFile,
        awardHonorEnabled: honorEnabled,
        honorRankTitle: honorTitle
      };
      if (editId) {
        await updateAnnouncement(supabase, editId, payload);
        toast.success(t('ann.updated'));
      } else {
        await createAnnouncement(supabase, payload);
        toast.success(t('create.published'));
      }
      navigate('/announcements');
    } catch (error) {
      toast.alert(error.message);
    }
  }

  return (
    <section className="mx-auto max-w-3xl">
      <PageHeader
        kicker={t('create.kicker')}
        title={editId ? t('create.editing') : t('create.title')}
        actions={
          <Link to="/announcements" className={`${btnGhost} no-underline`}>
            {t('create.back')}
          </Link>
        }
      />
      <form className={`${glassClass} grid gap-4 p-6`} onSubmit={handleSubmit} onReset={() => {
        setTitle('');
        setContent('');
        setCapacity(1);
        setImageFile(null);
        setPreview('');
        setHonorEnabled(false);
        setHonorTitle('');
      }}>
        <label className="grid gap-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
          {t('create.titleLabel')}
          <input className={fieldClass} required maxLength={120} value={title} onChange={(event) => setTitle(event.target.value)} />
        </label>
        <label className="grid gap-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
          {t('create.contentLabel')}
          <textarea className={`${fieldClass} min-h-36 py-3`} rows={7} required value={content} onChange={(event) => setContent(event.target.value)} />
        </label>
        <label className="grid gap-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
          {t('create.capacityLabel')}
          <input className={fieldClass} type="number" min={1} max={500} required value={capacity} onChange={(event) => setCapacity(event.target.value)} />
        </label>
        <FileUploadButton
          label={t('create.imageLabel')}
          hint={imageFile?.name || t('upload.choose')}
          fileName={imageFile?.name || ''}
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (file) {
              setCropFile(file);
            }
          }}
        />
        {preview ? <img src={preview} alt="" className="max-h-56 w-full rounded-2xl object-cover" /> : null}
        {editId && preview && !imageFile ? <p className="text-sm text-slate-500">{t('create.keepImage')}</p> : null}
        <CommandCheck checked={honorEnabled} onChange={setHonorEnabled}>
          {t('create.honorToggle')}
        </CommandCheck>
        <label className="grid gap-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
          {t('create.honorTitleLabel')}
          <input className={fieldClass} maxLength={80} disabled={!honorEnabled} value={honorTitle} onChange={(event) => setHonorTitle(event.target.value)} />
        </label>
        <p className="text-sm text-slate-500">{t('create.honorHint')}</p>
        <div className="flex gap-2">
          <button type="submit" className={btnPrimary}>
            {editId ? t('create.update') : t('create.publish')}
          </button>
          <button type="reset" className={btnGhost}>
            {t('create.clear')}
          </button>
        </div>
      </form>
      {cropFile ? (
        <ImageCropper
          file={cropFile}
          aspectId="16:9"
          title={t('img.crop')}
          confirmLabel={t('common.save')}
          cancelLabel={t('common.cancel')}
          onCancel={() => setCropFile(null)}
          onConfirm={(file) => {
            setImageFile(file);
            setPreview(URL.createObjectURL(file));
            setCropFile(null);
          }}
        />
      ) : null}
    </section>
  );
}
