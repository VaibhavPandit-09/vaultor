import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Plus, Search, Sun, Moon, LogOut, 
  Trash2, Database, UploadCloud, DownloadCloud, X, Lock, FileText, Paperclip,
  ChevronDown, Upload, ChevronLeft, ChevronRight, AlertTriangle
} from 'lucide-react';
import api from '../lib/api';
import type { Resource, Tag } from '../types';
import { useTheme } from '../lib/ThemeContext';
import BlockEditor from '../components/editor/BlockEditor';
import FilePreview from '../components/FilePreview';
import { markdownToHtml } from '../components/editor/markdownUtils';
import { csvToTableHtml } from '../components/editor/csvUtils';

type TypeFilter = 'all' | 'note' | 'file';

export default function Dashboard() {
  const [resources, setResources] = useState<Resource[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  
  const [activeResourceId, setActiveResourceId] = useState<string | null>(null);
  const [activeResource, setActiveResource] = useState<Resource | null>(null);
  const [backlinks, setBacklinks] = useState<Resource[]>([]);
  
  // Navigation history
  const [navHistory, setNavHistory] = useState<string[]>([]);
  const [navIndex, setNavIndex] = useState(-1);
  const navLockRef = useRef(false); // prevent history push during back/forward

  const [activeTags, setActiveTags] = useState<string[]>([]);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);

  const { theme, toggleTheme } = useTheme();
  
  const [search, setSearch] = useState('');
  const [tagSearch, setTagSearch] = useState('');
  const importInputRef = useRef<HTMLInputElement>(null);
  const fileUploadRef = useRef<HTMLInputElement>(null);
  const mdUploadRef = useRef<HTMLInputElement>(null);
  const csvUploadRef = useRef<HTMLInputElement>(null);

  const [authModal, setAuthModal] = useState<'export' | 'import' | null>(null);
  const [authPassword, setAuthPassword] = useState('');
  const [importFile, setImportFile] = useState<File | null>(null);
  const [authError, setAuthError] = useState('');

  // Delete confirmation modal state
  const [deleteModal, setDeleteModal] = useState<{ id: string; title: string; backlinks: Resource[] } | null>(null);
  const [replaceLinkModal, setReplaceLinkModal] = useState<{ oldId: string; backlinks: Resource[] } | null>(null);
  const [replaceSearch, setReplaceSearch] = useState('');
  const [replaceResults, setReplaceResults] = useState<Resource[]>([]);

  const fetchData = useCallback(async () => {
    try {
      const [resData, tagsData] = await Promise.all([
        api.get('/resources'),
        api.get('/tags')
      ]);
      setResources(resData.data);
      setTags(tagsData.data);
    } catch (e) {
      console.error(e);
    }
  }, []);

  const fetchActiveResource = useCallback(async (id: string) => {
    try {
      const [resData, backlinksData] = await Promise.all([
        api.get(`/resources/${id}`),
        api.get(`/resources/${id}/backlinks`)
      ]);
      setActiveResource(resData.data);
      setBacklinks(backlinksData.data || []);
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Navigation: open resource
  const openResource = useCallback((id: string) => {
    setActiveResourceId(id);
    // Track open
    api.post(`/resources/${id}/open`).catch(() => {});
    // Push to history
    if (!navLockRef.current) {
      setNavHistory(prev => {
        const trimmed = prev.slice(0, navIndex + 1);
        return [...trimmed, id];
      });
      setNavIndex(prev => prev + 1);
    }
    navLockRef.current = false;
  }, [navIndex]);

  const goBack = useCallback(() => {
    if (navIndex > 0) {
      navLockRef.current = true;
      const newIdx = navIndex - 1;
      setNavIndex(newIdx);
      setActiveResourceId(navHistory[newIdx]);
      api.post(`/resources/${navHistory[newIdx]}/open`).catch(() => {});
    }
  }, [navIndex, navHistory]);

  const goForward = useCallback(() => {
    if (navIndex < navHistory.length - 1) {
      navLockRef.current = true;
      const newIdx = navIndex + 1;
      setNavIndex(newIdx);
      setActiveResourceId(navHistory[newIdx]);
      api.post(`/resources/${navHistory[newIdx]}/open`).catch(() => {});
    }
  }, [navIndex, navHistory]);

  useEffect(() => {
    if (activeResourceId) {
      fetchActiveResource(activeResourceId);
    } else {
      setActiveResource(null);
      setBacklinks([]);
    }
  }, [activeResourceId, fetchActiveResource]);

  // Global resource opener for inline links
  useEffect(() => {
    (window as any).__openResource = (resourceId: string, _type: string, _label: string) => {
      openResource(resourceId);
    };
  }, [openResource]);

  const handleCreateNote = async () => {
    try {
      const initialContent = JSON.stringify({ type: 'doc', content: [{ type: 'paragraph' }] });
      const { data } = await api.post('/resources/note', { title: 'Untitled Note', content: initialContent });
      await fetchData();
      openResource(data.id);
    } catch (e) {
      console.error(e);
    }
  };

  const handleUploadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const formData = new FormData();
      formData.append('file', file);
      const { data } = await api.post('/resources/file', formData);
      await fetchData();
      openResource(data.id);
    } catch (err) {
      console.error(err);
    }
    if (fileUploadRef.current) fileUploadRef.current.value = '';
  };

  // Safe delete: check backlinks first
  const handleDeleteResource = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const { data: bl } = await api.get(`/resources/${id}/backlinks`);
      const res = resources.find(r => r.id === id);
      if (bl && bl.length > 0) {
        setDeleteModal({ id, title: res?.title || 'Resource', backlinks: bl });
      } else {
        if (!confirm('Delete this resource?')) return;
        await executeDelete(id);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const executeDelete = async (id: string) => {
    await api.delete(`/resources/${id}`);
    setResources(prev => prev.filter(r => r.id !== id));
    if (activeResourceId === id) {
      setActiveResourceId(null);
      setActiveResource(null);
    }
    setDeleteModal(null);
  };

  const openReplaceLinkModal = (oldId: string, backlinks: Resource[]) => {
    setDeleteModal(null);
    setReplaceLinkModal({ oldId, backlinks });
    setReplaceSearch('');
    setReplaceResults([]);
  };

  useEffect(() => {
    if (!replaceLinkModal || !replaceSearch.trim()) { setReplaceResults([]); return; }
    const timer = setTimeout(async () => {
      try {
        const { data } = await api.get(`/resources/search?q=${encodeURIComponent(replaceSearch)}`);
        setReplaceResults((data || []).filter((r: Resource) => r.id !== replaceLinkModal.oldId));
      } catch (_e) {}
    }, 200);
    return () => clearTimeout(timer);
  }, [replaceSearch, replaceLinkModal]);

  const executeReplaceLinks = async (newId: string) => {
    if (!replaceLinkModal) return;
    try {
      await api.post(`/resources/${replaceLinkModal.oldId}/replace-links`, { newResourceId: newId });
      setReplaceLinkModal(null);
      await fetchData();
      if (activeResourceId === replaceLinkModal.oldId) {
        openResource(newId);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleTitleChange = async (title: string) => {
    if (!activeResource || activeResource.type !== 'note') return;
    setActiveResource({ ...activeResource, title });
    try {
      await api.put(`/resources/${activeResource.id}/note`, { title, content: activeResource.content });
      fetchData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleContentUpdate = async (json: any) => {
    if (!activeResource || activeResource.type !== 'note') return;
    const contentStr = JSON.stringify(json);
    setActiveResource(prev => prev ? { ...prev, content: contentStr } : null);
    try {
      await api.put(`/resources/${activeResource.id}/note`, { title: activeResource.title, content: contentStr });
      fetchData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddTag = async (tagName: string) => {
    if (!activeResource || !tagName.trim()) return;
    try {
      await api.post(`/resources/${activeResource.id}/tags/${encodeURIComponent(tagName.trim())}`);
      fetchActiveResource(activeResource.id);
      fetchData();
    } catch (_e) {}
  };

  const handleRemoveTag = async (tagName: string) => {
    if (!activeResource) return;
    try {
      await api.delete(`/resources/${activeResource.id}/tags/${encodeURIComponent(tagName.trim())}`);
      fetchActiveResource(activeResource.id);
      fetchData();
    } catch (_e) {}
  };

  const handleDeleteTag = async (tagId: string, tagName: string) => {
    if (!confirm(`Delete tag "${tagName}" from all resources?`)) return;
    try {
      await api.delete(`/tags/${tagId}`);
      setActiveTags(prev => prev.filter(t => t !== tagName));
      fetchData();
      if (activeResource) fetchActiveResource(activeResource.id);
    } catch (_e) {}
  };

  const toggleTagFilter = (name: string) => {
    setActiveTags(prev => prev.includes(name) ? prev.filter(t => t !== name) : [...prev, name]);
  };

  const handleRequestMdUpload = useCallback(() => {
    if (mdUploadRef.current) { mdUploadRef.current.value = ''; mdUploadRef.current.click(); }
  }, []);
  const handleRequestCsvUpload = useCallback(() => {
    if (csvUploadRef.current) { csvUploadRef.current.value = ''; csvUploadRef.current.click(); }
  }, []);

  const handleMdFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const html = markdownToHtml(text);
      const editor = (window as any).__vaultor_editor;
      if (editor) editor.chain().focus().insertContent(html).run();
    } catch (err) { console.error('MD upload failed:', err); }
    if (mdUploadRef.current) mdUploadRef.current.value = '';
  }, []);

  const handleCsvFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const html = csvToTableHtml(text);
      const editor = (window as any).__vaultor_editor;
      if (editor) editor.chain().focus().insertContent(html).run();
    } catch (err) { console.error('CSV upload failed:', err); }
    if (csvUploadRef.current) csvUploadRef.current.value = '';
  }, []);

  const triggerExport = () => { setAuthModal('export'); setAuthPassword(''); setAuthError(''); };
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setImportFile(e.target.files[0]);
      setAuthModal('import');
      setAuthPassword('');
      setAuthError('');
    }
    if (importInputRef.current) importInputRef.current.value = '';
  };

  const executeExport = async () => {
    setAuthError('');
    try {
      const response = await api.get('/export', { params: { password: authPassword }, responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url; link.setAttribute('download', 'encrypted-export.bin');
      document.body.appendChild(link); link.click(); link.remove();
      setAuthModal(null);
    } catch (e: any) {
      setAuthError(e.response?.status === 401 ? 'Invalid master password' : 'Export failed');
    }
  };

  const executeImport = async () => {
    if (!importFile) return;
    if (!confirm('Warning: This will overwrite ALL existing data. Continue?')) return;
    setAuthError('');
    const formData = new FormData();
    formData.append('file', importFile); formData.append('password', authPassword);
    try {
      await api.post('/import', formData);
      alert('Import successful! Refreshing...');
      window.location.reload();
    } catch (err: any) {
      setAuthError(err.response?.data?.message || 'Decryption failed');
    }
  };

  const logout = () => { localStorage.removeItem('vaultor_auth_token'); window.location.href = '/auth'; };

  // Filtering
  const filteredResources = resources.filter(r => {
    const matchesSearch = r.title.toLowerCase().includes(search.toLowerCase());
    const matchesType = typeFilter === 'all' || r.type === typeFilter;
    const matchesTags = activeTags.length === 0 || activeTags.every(at => r.tags?.some(t => t.name.toLowerCase() === at.toLowerCase()));
    return matchesSearch && matchesType && matchesTags;
  });

  const noteCount = filteredResources.filter(r => r.type === 'note').length;
  const fileCount = filteredResources.filter(r => r.type === 'file').length;
  const filteredTags = tags.filter(t => t.name.toLowerCase().includes(tagSearch.toLowerCase()));

  const editorContent = activeResource?.type === 'note' && activeResource?.content
    ? (() => { try { return JSON.parse(activeResource.content as string); } catch { return activeResource.content; } })()
    : null;

  const typeLabels: Record<TypeFilter, string> = { all: 'All', note: 'Notes', file: 'Files' };

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      <input type="file" ref={mdUploadRef} className="hidden" accept=".md,.markdown,.txt" onChange={handleMdFileChange} />
      <input type="file" ref={csvUploadRef} className="hidden" accept=".csv,.tsv,.txt" onChange={handleCsvFileChange} />
      <input type="file" ref={fileUploadRef} className="hidden" onChange={handleUploadFile} />

      {/* ─── Auth Modal ─── */}
      {authModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-card w-full max-w-sm p-6 rounded-2xl shadow-2xl border border-border">
            <div className="flex justify-between items-center mb-4">
               <h3 className="text-lg font-bold flex items-center"><Lock size={18} className="mr-2 text-primary" />{authModal === 'export' ? 'Secure Export' : 'Secure Import'}</h3>
               <button onClick={() => setAuthModal(null)} className="text-slate-400 hover:text-foreground"><X size={20} /></button>
            </div>
            <p className="text-sm text-slate-500 mb-4">{authModal === 'export' ? 'Enter your master password to encrypt and export.' : 'Enter your master password to decrypt and restore.'}</p>
            {authError && <div className="mb-4 text-xs font-medium text-red-500 bg-red-500/10 p-2 rounded">{authError}</div>}
            <input type="password" placeholder="Master Password" autoFocus
              className="w-full px-3 py-2 bg-background border border-border rounded-lg outline-none focus:border-primary mb-4 text-sm"
              value={authPassword} onChange={e => setAuthPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && (authModal === 'export' ? executeExport() : executeImport())} />
            <button onClick={authModal === 'export' ? executeExport : executeImport}
              className="w-full py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors">
              {authModal === 'export' ? 'Encrypt & Download' : 'Decrypt & Restore'}
            </button>
          </div>
        </div>
      )}

      {/* ─── Delete Confirmation Modal ─── */}
      {deleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-card w-full max-w-md p-6 rounded-2xl shadow-2xl border border-border">
            <div className="flex items-start gap-3 mb-4">
              <AlertTriangle size={24} className="text-amber-500 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-lg font-bold">Referenced Resource</h3>
                <p className="text-sm text-slate-500 mt-1">
                  <strong>"{deleteModal.title}"</strong> is linked from {deleteModal.backlinks.length} resource{deleteModal.backlinks.length > 1 ? 's' : ''}:
                </p>
              </div>
            </div>
            <div className="max-h-40 overflow-y-auto mb-4 space-y-1">
              {deleteModal.backlinks.map(b => (
                <div key={b.id} className="flex items-center px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 text-sm">
                  {b.type === 'note' ? <FileText size={14} className="mr-2 text-blue-500" /> : <Paperclip size={14} className="mr-2 text-green-500" />}
                  <span className="truncate">{b.title}</span>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={() => openReplaceLinkModal(deleteModal.id, deleteModal.backlinks)}
                className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
                Replace Links
              </button>
              <button onClick={() => executeDelete(deleteModal.id)}
                className="flex-1 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors">
                Delete Anyway
              </button>
              <button onClick={() => setDeleteModal(null)}
                className="flex-1 py-2 border border-border rounded-lg text-sm font-medium hover:bg-card transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Replace Link Modal ─── */}
      {replaceLinkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-card w-full max-w-md p-6 rounded-2xl shadow-2xl border border-border">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">Replace Links</h3>
              <button onClick={() => setReplaceLinkModal(null)} className="text-slate-400 hover:text-foreground"><X size={20} /></button>
            </div>
            <p className="text-sm text-slate-500 mb-3">Select a resource to replace all incoming links, then the original will be deleted.</p>
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              <input type="text" placeholder="Search replacement..." autoFocus
                className="w-full pl-9 pr-3 py-2 bg-background border border-border rounded-lg text-sm outline-none focus:border-primary"
                value={replaceSearch} onChange={e => setReplaceSearch(e.target.value)} />
            </div>
            <div className="max-h-60 overflow-y-auto space-y-1">
              {replaceResults.map(r => (
                <button key={r.id} onClick={() => executeReplaceLinks(r.id)}
                  className="w-full flex items-center px-3 py-2 rounded-lg text-sm text-left hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                  {r.type === 'note' ? <FileText size={14} className="mr-2 text-blue-500" /> : <Paperclip size={14} className="mr-2 text-green-500" />}
                  <span className="truncate">{r.title}</span>
                </button>
              ))}
              {replaceSearch.trim() && replaceResults.length === 0 && <div className="text-center py-4 text-slate-400 text-xs">No matches</div>}
            </div>
          </div>
        </div>
      )}

      {/* ====== SIDEBAR ====== */}
      <div className="w-72 flex-shrink-0 border-r border-border bg-card flex flex-col transition-colors z-10">
        {/* Logo */}
        <div className="px-4 pt-4 pb-2 flex items-center justify-between">
          <h1 className="text-lg font-bold flex items-center tracking-tight text-primary">
            <Database className="mr-2" size={22} /> Vaultor
          </h1>
        </div>

        {/* Search + Type Filter */}
        <div className="px-3 pb-2">
          <div className="flex gap-1.5">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              <input type="text" placeholder="Search..."
                className="w-full pl-8 pr-3 py-1.5 bg-background border border-border rounded-lg text-xs focus:outline-none focus:border-primary transition-colors"
                value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <div className="relative">
              <button onClick={() => setShowTypeDropdown(!showTypeDropdown)}
                className="px-2.5 py-1.5 border border-border rounded-lg text-xs font-medium flex items-center gap-1 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors bg-background whitespace-nowrap">
                {typeLabels[typeFilter]} <ChevronDown size={12} />
              </button>
              {showTypeDropdown && (
                <div className="absolute right-0 mt-1 w-24 bg-card border border-border rounded-lg shadow-xl z-20 py-1">
                  {(['all', 'note', 'file'] as TypeFilter[]).map(t => (
                    <button key={t} onClick={() => { setTypeFilter(t); setShowTypeDropdown(false); }}
                      className={`w-full text-left px-3 py-1.5 text-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors ${typeFilter === t ? 'text-primary font-semibold' : ''}`}>
                      {typeLabels[t]}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="px-3 pb-2 flex gap-1.5">
          <button onClick={handleCreateNote}
            className="flex-1 py-1.5 bg-primary text-white rounded-lg text-xs font-medium hover:bg-primary/90 transition-all active:scale-[0.98] flex items-center justify-center gap-1.5">
            <Plus size={14} /> New Note
          </button>
          <button onClick={() => fileUploadRef.current?.click()}
            className="flex-1 py-1.5 border border-border rounded-lg text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800 transition-all active:scale-[0.98] flex items-center justify-center gap-1.5">
            <Upload size={14} /> Upload
          </button>
        </div>

        {/* Active Filters */}
        {activeTags.length > 0 && (
          <div className="px-3 pb-2 flex flex-wrap gap-1 items-center">
            {activeTags.map(t => (
              <span key={t} className="text-[10px] font-medium bg-primary/10 text-primary px-2 py-0.5 rounded-md flex items-center">
                {t}
                <button onClick={() => toggleTagFilter(t)} className="ml-1 opacity-60 hover:opacity-100"><X size={10} /></button>
              </span>
            ))}
            <button onClick={() => setActiveTags([])} className="text-[10px] text-slate-400 hover:text-red-500 ml-1">Clear</button>
          </div>
        )}

        <div className="border-t border-border" />

        {/* Result Count */}
        <div className="px-4 py-1.5 text-[10px] text-slate-400 font-medium">
          {filteredResources.length} resource{filteredResources.length !== 1 ? 's' : ''}
          {(search || activeTags.length > 0 || typeFilter !== 'all') && (
            <span className="ml-1 opacity-70">
              ({noteCount} note{noteCount !== 1 ? 's' : ''}, {fileCount} file{fileCount !== 1 ? 's' : ''})
            </span>
          )}
        </div>

        {/* Unified Resource List with subtle grouping */}
        <div className="flex-1 overflow-y-auto py-0.5">
          {filteredResources.length === 0 ? (
            <div className="text-center p-8 text-slate-400 text-xs">No resources found</div>
          ) : (
            <>
              {/* Notes group */}
              {filteredResources.filter(r => r.type === 'note').length > 0 && typeFilter !== 'file' && (
                <>
                  <div className="px-4 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400/70">Notes</div>
                  {filteredResources.filter(r => r.type === 'note').map(r => (
                    <SidebarItem key={r.id} resource={r} isActive={activeResourceId === r.id}
                      onClick={() => openResource(r.id)} onDelete={(e) => handleDeleteResource(r.id, e)} />
                  ))}
                </>
              )}
              {/* Files group */}
              {filteredResources.filter(r => r.type === 'file').length > 0 && typeFilter !== 'note' && (
                <>
                  <div className="px-4 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400/70">Files</div>
                  {filteredResources.filter(r => r.type === 'file').map(r => (
                    <SidebarItem key={r.id} resource={r} isActive={activeResourceId === r.id}
                      onClick={() => openResource(r.id)} onDelete={(e) => handleDeleteResource(r.id, e)} />
                  ))}
                </>
              )}
            </>
          )}
        </div>

        <div className="border-t border-border" />

        {/* Tags */}
        <div className="px-3 py-2 max-h-40 flex flex-col">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Tags</span>
          </div>
          {tags.length > 3 && (
            <input type="text" placeholder="Search tags..."
              className="w-full px-2.5 py-1 bg-background border border-border rounded text-[11px] mb-1.5 focus:outline-none focus:border-primary"
              value={tagSearch} onChange={e => setTagSearch(e.target.value)} />
          )}
          <div className="flex flex-wrap gap-1 overflow-y-auto">
            {filteredTags.map(t => (
              <span key={t.id} className={`text-[11px] px-2 py-0.5 rounded-md font-medium transition-colors inline-flex items-center gap-1 ${
                activeTags.includes(t.name) 
                  ? 'bg-primary/15 text-primary border border-primary/30' 
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 border border-transparent'
              }`}>
                <button onClick={() => toggleTagFilter(t.name)} className="cursor-pointer">{t.name}</button>
                <button onClick={() => handleDeleteTag(t.id, t.name)} className="opacity-40 hover:opacity-100 hover:text-red-500 transition-opacity" title="Delete tag">
                  <X size={10} />
                </button>
              </span>
            ))}
            {filteredTags.length === 0 && <span className="text-[10px] text-slate-400">No tags</span>}
          </div>
        </div>
        
        {/* Footer */}
        <div className="p-2 border-t border-border bg-background flex items-center justify-between">
          <div className="flex items-center gap-0.5">
            <button onClick={triggerExport} title="Export Vault"
              className="p-1.5 text-slate-400 hover:text-primary rounded-lg hover:bg-card transition-colors"><DownloadCloud size={16} /></button>
            <button onClick={() => importInputRef.current?.click()} title="Import Vault"
              className="p-1.5 text-slate-400 hover:text-primary rounded-lg hover:bg-card transition-colors"><UploadCloud size={16} /></button>
            <input type="file" ref={importInputRef} onChange={handleFileSelect} className="hidden" accept=".bin,.zip" />
          </div>
          <div className="flex items-center gap-0.5">
            <button onClick={toggleTheme} className="p-1.5 text-slate-400 hover:text-primary rounded-lg hover:bg-card transition-colors">
              {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
            </button>
            <button onClick={logout} className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg hover:bg-card transition-colors" title="Lock Vault"><LogOut size={16} /></button>
          </div>
        </div>
      </div>
      
      {/* ====== MAIN PANEL ====== */}
      <div className="flex-1 flex flex-col w-full relative">
        {/* Navigation Bar */}
        {activeResource && (
          <div className="flex items-center px-4 py-1.5 bg-card border-b border-border gap-1 flex-shrink-0">
            <button onClick={goBack} disabled={navIndex <= 0}
              className={`p-1 rounded transition-colors ${navIndex > 0 ? 'text-slate-500 hover:text-primary hover:bg-slate-100 dark:hover:bg-slate-800' : 'text-slate-300 dark:text-slate-700 cursor-not-allowed'}`}
              title="Back">
              <ChevronLeft size={18} />
            </button>
            <button onClick={goForward} disabled={navIndex >= navHistory.length - 1}
              className={`p-1 rounded transition-colors ${navIndex < navHistory.length - 1 ? 'text-slate-500 hover:text-primary hover:bg-slate-100 dark:hover:bg-slate-800' : 'text-slate-300 dark:text-slate-700 cursor-not-allowed'}`}
              title="Forward">
              <ChevronRight size={18} />
            </button>
          </div>
        )}

        {activeResource ? (
          activeResource.type === 'note' ? (
            <>
              <div className="min-h-16 border-b border-border flex flex-col justify-center px-8 py-3 bg-card flex-shrink-0">
                <input 
                  value={activeResource.title} onChange={e => handleTitleChange(e.target.value)}
                  className="text-2xl font-bold bg-transparent border-none outline-none focus:ring-0 w-full placeholder:text-slate-300" placeholder="Note Title" />
                <div className="flex items-center mt-2 flex-wrap gap-1">
                  {activeResource.tags?.map(t => (
                    <span key={t.id} className="text-[11px] font-medium bg-blue-500/10 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-md flex items-center">
                      {t.name}
                      <button onClick={() => handleRemoveTag(t.name)} className="ml-1.5 opacity-50 hover:opacity-100 text-red-500 text-[10px]">✕</button>
                    </span>
                  ))}
                  <input placeholder="Add tag..."
                    className="text-[11px] bg-transparent border-none outline-none text-slate-400 placeholder:text-slate-500 w-24 ml-1"
                    onKeyDown={(e) => { if (e.key === 'Enter' && e.currentTarget.value.trim()) { handleAddTag(e.currentTarget.value.trim()); e.currentTarget.value = ''; } }} />
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-8 relative">
                <div className="max-w-4xl mx-auto w-full">
                  <BlockEditor key={activeResource.id} content={editorContent} onUpdate={handleContentUpdate}
                    onRequestMdUpload={handleRequestMdUpload} onRequestCsvUpload={handleRequestCsvUpload} />
                  {backlinks.length > 0 && (
                    <div className="mt-12 pt-6 border-t border-border">
                      <h4 className="text-sm font-semibold text-slate-400 mb-3 ml-1 flex items-center"><Search size={14} className="mr-2" /> Linked from</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {backlinks.map(b => (
                          <div key={b.id} onClick={() => openResource(b.id)}
                            className="flex items-center p-3 rounded-xl border border-border bg-card hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors">
                            {b.type === 'note' ? <FileText size={16} className="text-blue-500 mr-3 opacity-80" /> : <Paperclip size={16} className="text-green-500 mr-3 opacity-80" />}
                            <span className="text-sm font-medium truncate">{b.title}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <FilePreview resource={activeResource} onAddTag={handleAddTag} onRemoveTag={handleRemoveTag} />
          )
        ) : (
          <div className="flex-1 flex flex-col justify-center items-center text-slate-400">
            <Database size={64} className="mb-6 opacity-20" />
            <h2 className="text-2xl font-semibold text-slate-500 mb-2">Welcome to Vaultor</h2>
            <p className="text-sm opacity-80 mb-6">Select a resource or create a new one.</p>
            <div className="flex gap-3">
              <button onClick={handleCreateNote} className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-primary/90 transition-colors"><Plus size={16} /> New Note</button>
              <button onClick={() => fileUploadRef.current?.click()} className="px-4 py-2 border border-border rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-card transition-colors"><Upload size={16} /> Upload File</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SidebarItem({ resource, isActive, onClick, onDelete }: { resource: Resource; isActive: boolean; onClick: () => void; onDelete: (e: React.MouseEvent) => void }) {
  return (
    <div onClick={onClick}
      className={`px-3 py-1.5 mx-2 mb-0.5 rounded-lg cursor-pointer transition-all group flex items-center justify-between ${
        isActive ? 'bg-primary/10 border-l-2 border-primary' : 'hover:bg-slate-100 dark:hover:bg-slate-800 border-l-2 border-transparent'
      }`}>
      <div className="flex items-center overflow-hidden pr-2 min-w-0">
        {resource.type === 'note' 
          ? <FileText size={14} className={`mr-2 flex-shrink-0 ${isActive ? 'text-primary' : 'text-slate-400'}`} /> 
          : <Paperclip size={14} className={`mr-2 flex-shrink-0 ${isActive ? 'text-primary' : 'text-slate-400'}`} />}
        <span className={`text-[13px] truncate ${isActive ? 'font-medium text-primary' : ''}`}>{resource.title}</span>
      </div>
      <button onClick={onDelete} className="text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 p-0.5"><Trash2 size={12} /></button>
    </div>
  );
}
