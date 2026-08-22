import { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useCommand } from './GlobalLayout.jsx';
import { useToast } from './LiquidToast.jsx';

export default function DossierHandoffBridge({ roster = [], onOpen }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const { t } = useCommand();
  const toast = useToast();
  const noticed = useRef(false);
  const opened = useRef(false);

  useEffect(() => {
    const dossierId = searchParams.get('dossier');
    if (!dossierId || opened.current || !roster.length) {
      return;
    }
    const row = roster.find((item) => item.id === dossierId);
    if (!row) {
      return;
    }
    opened.current = true;
    onOpen?.(row);
  }, [onOpen, roster, searchParams]);

  useEffect(() => {
    if (noticed.current) {
      return;
    }
    const exported = searchParams.get('exported');
    const exportError = searchParams.get('exportError');
    if (!exported && !exportError) {
      return;
    }
    noticed.current = true;
    if (exportError) {
      toast.alert(t('dir.exportFailed'));
    } else {
      toast.success(t('dir.exported'));
    }
    const next = new URLSearchParams(searchParams);
    next.delete('exported');
    next.delete('exportError');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams, t, toast]);

  return null;
}
