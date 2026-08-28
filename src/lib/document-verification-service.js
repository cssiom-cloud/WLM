// ==============================================================================
// White Lion Regiment - Document Verification Service
// ==============================================================================

export const DOCUMENT_TYPES = [
  { id: 'identification', labelTh: 'เอกสารยืนยันตัวตน / บัตรประชาชน', labelEn: 'Identity Proof / ID Card' },
  { id: 'personnel_dossier', labelTh: 'แฟ้มประวัติกำลังพล / หนังสือรับรอง', labelEn: 'Personnel Dossier / Certificate' },
  { id: 'operation_report', labelTh: 'รายงานปฏิบัติการ / รายงานภารกิจ', labelEn: 'Operation After-Action Report' },
  { id: 'transfer_request', labelTh: 'คำขอย้ายสังกัด / หน่วยงาน', labelEn: 'Unit Transfer Request' },
  { id: 'security_clearance', labelTh: 'หนังสือขอสิทธิ์ความมั่นคง (Clearance)', labelEn: 'Security Clearance Application' },
  { id: 'other', labelTh: 'เอกสารอื่นๆ', labelEn: 'Other Supporting Document' }
];

export async function uploadDocumentFile(supabase, file, personnelId = 'general') {
  if (!file) throw new Error('No file provided');

  const fileExt = file.name.split('.').pop();
  const cleanName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const filePath = `verification/${personnelId}/${Date.now()}_${cleanName}`;

  const { data, error } = await supabase.storage
    .from('user-documents')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: true
    });

  if (error) {
    // If bucket does not exist or upload error, create object URL fallback for local testing
    console.warn('Supabase storage upload note:', error.message);
    const objectUrl = URL.createObjectURL(file);
    return {
      fileUrl: objectUrl,
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      storagePath: filePath
    };
  }

  const { data: publicData } = supabase.storage
    .from('user-documents')
    .getPublicUrl(data.path);

  return {
    fileUrl: publicData?.publicUrl || filePath,
    fileName: file.name,
    fileSize: file.size,
    fileType: file.type,
    storagePath: data.path
  };
}

export async function submitVerificationDocument(supabase, {
  personnelId,
  title,
  documentType = 'identification',
  fileUrl,
  fileName,
  fileSize = 0,
  fileType = 'application/pdf'
}) {
  const { data: userSession } = await supabase.auth.getSession();
  const userId = userSession?.session?.user?.id || null;

  const payload = {
    user_id: userId,
    personnel_id: personnelId,
    title: title.trim(),
    document_type: documentType,
    file_url: fileUrl,
    file_name: fileName,
    file_size: fileSize,
    file_type: fileType,
    status: 'pending',
    reviewer_note: '',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  const { data, error } = await supabase
    .from('documents')
    .insert([payload])
    .select()
    .single();

  if (error) {
    // Local fallback persistence in localStorage if table not migrated yet
    console.warn('Database insert note:', error.message);
    const localKey = 'wlr_local_verification_docs';
    const existing = JSON.parse(localStorage.getItem(localKey) || '[]');
    const newDoc = { id: `local-${Date.now()}`, ...payload };
    existing.unshift(newDoc);
    localStorage.setItem(localKey, JSON.stringify(existing));
    return newDoc;
  }

  return data;
}

export async function fetchMyDocuments(supabase, personnelId) {
  try {
    let query = supabase
      .from('documents')
      .select('*')
      .order('created_at', { ascending: false });

    if (personnelId) {
      query = query.eq('personnel_id', personnelId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.warn('fetchMyDocuments falling back to local cache:', err.message);
    const localKey = 'wlr_local_verification_docs';
    const existing = JSON.parse(localStorage.getItem(localKey) || '[]');
    if (personnelId) {
      return existing.filter(d => d.personnel_id === personnelId);
    }
    return existing;
  }
}

export async function fetchAllDocumentsForVerifier(supabase, { status = 'all', searchQuery = '' } = {}) {
  try {
    let query = supabase
      .from('documents')
      .select(`
        *,
        personnel:personnel_id (
          id,
          first_name,
          last_name,
          callsign,
          rank,
          role,
          avatar_url
        )
      `)
      .order('created_at', { ascending: false });

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    const { data, error } = await query;
    if (error) throw error;

    let results = data || [];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      results = results.filter(doc => 
        doc.title?.toLowerCase().includes(q) ||
        doc.file_name?.toLowerCase().includes(q) ||
        doc.personnel?.first_name?.toLowerCase().includes(q) ||
        doc.personnel?.last_name?.toLowerCase().includes(q) ||
        doc.personnel?.callsign?.toLowerCase().includes(q)
      );
    }

    return results;
  } catch (err) {
    console.warn('fetchAllDocumentsForVerifier falling back to local cache:', err.message);
    const localKey = 'wlr_local_verification_docs';
    let existing = JSON.parse(localStorage.getItem(localKey) || '[]');
    if (status && status !== 'all') {
      existing = existing.filter(d => d.status === status);
    }
    return existing;
  }
}

export async function updateDocumentVerificationStatus(supabase, {
  documentId,
  status,
  reviewerNote = '',
  reviewerPersonnelId = null
}) {
  const { data: userSession } = await supabase.auth.getSession();
  const reviewerUid = userSession?.session?.user?.id || null;

  const updates = {
    status,
    reviewer_note: reviewerNote.trim(),
    reviewed_by: reviewerUid,
    reviewed_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  try {
    const { data, error } = await supabase
      .from('documents')
      .update(updates)
      .eq('id', documentId)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (err) {
    console.warn('updateDocumentVerificationStatus local fallback:', err.message);
    const localKey = 'wlr_local_verification_docs';
    const existing = JSON.parse(localStorage.getItem(localKey) || '[]');
    const idx = existing.findIndex(d => d.id === documentId);
    if (idx !== -1) {
      existing[idx] = { ...existing[idx], ...updates };
      localStorage.setItem(localKey, JSON.stringify(existing));
      return existing[idx];
    }
    throw err;
  }
}
