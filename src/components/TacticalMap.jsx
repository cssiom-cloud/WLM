import { useEffect, useRef } from 'react';
import { mountMapEditor, mountMapViewer } from '../../js/tactical-map.js';

export function TacticalMapEditor({ mapUrl = '', drawings = [], onChange, onMapFile }) {
  const rootRef = useRef(null);
  const editorRef = useRef(null);
  const onChangeRef = useRef(onChange);
  const onMapFileRef = useRef(onMapFile);
  onChangeRef.current = onChange;
  onMapFileRef.current = onMapFile;

  useEffect(() => {
    const root = rootRef.current;
    if (!root) {
      return undefined;
    }
    const editor = mountMapEditor(root, {
      mapUrl,
      drawings,
      onChange: (next) => onChangeRef.current?.(next),
      onMapFile: (file, url) => onMapFileRef.current?.(file, url)
    });
    editorRef.current = editor;
    return () => {
      editor.destroy();
      editorRef.current = null;
    };
    // Remount with a React key when the operation changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    editorRef.current?.setMapUrl(mapUrl);
  }, [mapUrl]);

  return <div ref={rootRef} className="tactical-map-host" />;
}

export function TacticalMapViewer({ mapUrl, drawings = [] }) {
  const rootRef = useRef(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) {
      return undefined;
    }
    mountMapViewer(root, { mapUrl, drawings });
    return () => {
      root.innerHTML = '';
    };
  }, [drawings, mapUrl]);

  return <div ref={rootRef} className="tactical-map-host" />;
}
