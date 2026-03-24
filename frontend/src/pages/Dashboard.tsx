import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Plus, Search, Sun, Moon, LogOut, 
  Trash2, Database, UploadCloud, DownloadCloud, X, Lock
} from 'lucide-react';
import { format } from 'date-fns';
import api from '../lib/api';
import type { Note } from '../types';
import { useTheme } from '../lib/ThemeContext';
import FileAttachments from '../components/FileAttachments';
import BlockEditor from '../components/editor/BlockEditor';
import { markdownToHtml } from '../components/editor/markdownUtils';
import { csvToTableHtml } from '../components/editor/csvUtils';

export default function Dashboard() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [activeNote, setActiveNote] = useState<Note | null>(null);
  const { theme, toggleTheme } = useTheme();
  
  const [search, setSearch] = useState('');
  const importInputRef = useRef<HTMLInputElement>(null);
  const mdUploadRef = useRef<HTMLInputElement>(null);
  const csvUploadRef = useRef<HTMLInputElement>(null);

  // Security Modals
  const [authModal, setAuthModal] = useState<'export' | 'import' | null>(null);
  const [authPassword, setAuthPassword] = useState('');
  const [importFile, setImportFile] = useState<File | null>(null);
  const [authError, setAuthError] = useState('');

  const fetchNotes = useCallback(async () => {
    try {
      const { data } = await api.get('/notes');
      setNotes(data);
    } catch (e) {
      console.error(e);
    }
  }, []);

  const fetchNote = useCallback(async (id: string) => {
    try {
      const { data } = await api.get(`/notes/${id}`);
      setActiveNote(data);
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  useEffect(() => {
    if (activeNoteId) {
      fetchNote(activeNoteId);
    } else {
      setActiveNote(null);
    }
  }, [activeNoteId, fetchNote]);

  const handleCreateNote = async () => {
    try {
      const initialContent = JSON.stringify({
        type: 'doc',
        content: [{ type: 'paragraph' }],
      });
      const { data } = await api.post('/notes', {
        title: 'Untitled Note',
        content: initialContent,
      });
      await fetchNotes();
      setActiveNoteId(data.id);
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteNote = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this note?')) return;
    try {
      await api.delete(`/notes/${id}`);
      setNotes(notes.filter(n => n.id !== id));
      if (activeNoteId === id) {
        setActiveNoteId(null);
        setActiveNote(null);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleTitleChange = async (title: string) => {
    if (!activeNote) return;
    setActiveNote({ ...activeNote, title });
    try {
      await api.put(`/notes/${activeNote.id}`, {
        title,
        content: activeNote.content,
      });
      fetchNotes();
    } catch (e) {
      console.error(e);
    }
  };

  const handleContentUpdate = async (json: any) => {
    if (!activeNote) return;
    const contentStr = JSON.stringify(json);
    setActiveNote(prev => prev ? { ...prev, content: contentStr } : null);
    try {
      await api.put(`/notes/${activeNote.id}`, {
        title: activeNote.title,
        content: contentStr,
      });
      fetchNotes();
    } catch (e) {
      console.error(e);
    }
  };

  // === File Upload Handlers (owned by Dashboard, not BlockEditor) ===

  const handleRequestMdUpload = useCallback(() => {
    if (mdUploadRef.current) {
      mdUploadRef.current.value = '';
      mdUploadRef.current.click();
    }
  }, []);

  const handleRequestCsvUpload = useCallback(() => {
    if (csvUploadRef.current) {
      csvUploadRef.current.value = '';
      csvUploadRef.current.click();
    }
  }, []);

  const handleMdFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const html = markdownToHtml(text);
      const editor = (window as any).__vaultor_editor;
      if (editor) {
        editor.chain().focus().insertContent(html).run();
      }
    } catch (err) {
      console.error('MD upload failed:', err);
    }
    // Reset so same file can be picked again
    if (mdUploadRef.current) mdUploadRef.current.value = '';
  }, []);

  const handleCsvFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const html = csvToTableHtml(text);
      const editor = (window as any).__vaultor_editor;
      if (editor) {
        editor.chain().focus().insertContent(html).run();
      }
    } catch (err) {
      console.error('CSV upload failed:', err);
    }
    if (csvUploadRef.current) csvUploadRef.current.value = '';
  }, []);

  // === Export / Import ===

  const triggerExport = () => {
    setAuthModal('export');
    setAuthPassword('');
    setAuthError('');
  };

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
      const response = await api.get('/export', { 
         params: { password: authPassword },
         responseType: 'blob' 
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'encrypted-export.bin');
      document.body.appendChild(link);
      link.click();
      link.remove();
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
    formData.append('file', importFile);
    formData.append('password', authPassword);
    
    try {
      await api.post('/import', formData);
      alert('Import successful! Refreshing...');
      window.location.reload();
    } catch (err: any) {
      setAuthError(err.response?.data?.message || 'Decryption failed: wrong password or corrupted file');
    }
  };

  const logout = () => {
    localStorage.removeItem('vaultor_auth_token');
    window.location.href = '/auth';
  };

  const filteredNotes = notes.filter(n =>
    n.title.toLowerCase().includes(search.toLowerCase()) ||
    n.preview?.toLowerCase().includes(search.toLowerCase())
  );

  const editorContent = activeNote?.content
    ? (() => {
        try { return JSON.parse(activeNote.content as string); }
        catch { return activeNote.content; }
      })()
    : null;

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      
      {/* Hidden file inputs at Dashboard level — always in DOM */}
      <input type="file" ref={mdUploadRef} className="hidden" accept=".md,.markdown,.txt" onChange={handleMdFileChange} />
      <input type="file" ref={csvUploadRef} className="hidden" accept=".csv,.tsv,.txt" onChange={handleCsvFileChange} />

      {/* Auth Modal */}
      {authModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-card w-full max-w-sm p-6 rounded-2xl shadow-2xl border border-border">
            <div className="flex justify-between items-center mb-4">
               <h3 className="text-lg font-bold flex items-center">
                 <Lock size={18} className="mr-2 text-primary" />
                 {authModal === 'export' ? 'Secure Export' : 'Secure Import'}
               </h3>
               <button onClick={() => setAuthModal(null)} className="text-slate-400 hover:text-foreground">
                 <X size={20} />
               </button>
            </div>
            <p className="text-sm text-slate-500 mb-4">
              {authModal === 'export' 
                ? 'Enter your master password to securely encrypt and export your Vault.' 
                : 'Enter your master password to decrypt and restore this archive. This will overwrite current data!'}
            </p>
            {authError && <div className="mb-4 text-xs font-medium text-red-500 bg-red-500/10 p-2 rounded">{authError}</div>}
            <input 
              type="password"
              placeholder="Master Password"
              autoFocus
              className="w-full px-3 py-2 bg-background border border-border rounded-lg outline-none focus:border-primary mb-4 text-sm"
              value={authPassword}
              onChange={e => setAuthPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && (authModal === 'export' ? executeExport() : executeImport())}
            />
            <button 
              onClick={authModal === 'export' ? executeExport : executeImport}
              className="w-full py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
            >
              {authModal === 'export' ? 'Encrypt & Download' : 'Decrypt & Restore'}
            </button>
          </div>
        </div>
      )}

      {/* Sidebar */}
      <div className="w-80 flex-shrink-0 border-r border-border bg-card flex flex-col transition-colors z-10">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h1 className="text-xl font-bold flex items-center tracking-tight text-primary">
            <Database className="mr-2" size={24} /> Vaultor
          </h1>
          <button onClick={handleCreateNote} className="p-2 bg-primary text-white rounded-xl hover:bg-primary/90 transition-all active:scale-95 shadow-md">
            <Plus size={20} />
          </button>
        </div>
        
        <div className="p-4 py-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={16} />
            <input 
              type="text" 
              placeholder="Search notes..." 
              className="w-full pl-9 pr-4 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-primary transition-colors"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {filteredNotes.map(n => (
            <div 
               key={n.id}
               onClick={() => setActiveNoteId(n.id)}
               className={`p-3 rounded-xl cursor-pointer transition-all group border ${activeNoteId === n.id ? 'bg-primary/10 border-primary/30 shadow-sm' : 'border-transparent hover:bg-slate-100 dark:hover:bg-slate-800'}`}
            >
               <div className="flex justify-between items-start mb-1">
                 <h3 className={`font-semibold truncate pr-4 ${activeNoteId === n.id ? 'text-primary' : ''}`}>
                   {n.title}
                 </h3>
                 <button onClick={(e) => handleDeleteNote(n.id, e)} className="text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                   <Trash2 size={16} />
                 </button>
               </div>
               <p className="text-xs text-slate-500 truncate">{n.preview || 'No content'}</p>
               {n.updatedAt && (
                  <p className="text-[10px] text-slate-400 mt-2 font-medium">
                    {format(new Date(n.updatedAt), 'MMM dd, yyyy • h:mm a')}
                  </p>
               )}
            </div>
          ))}
          {filteredNotes.length === 0 && (
             <div className="text-center p-8 text-slate-400 text-sm">No notes found</div>
          )}
        </div>
        
        {/* Settings Footer */}
        <div className="p-3 border-t border-border bg-background flex flex-col space-y-2">
           <div className="flex justify-between">
              <button 
                 onClick={triggerExport}
                 className="flex-1 mr-1 flex items-center justify-center p-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-card rounded-lg border border-border transition-colors">
                <DownloadCloud size={14} className="mr-1" /> Export
              </button>
              <button 
                 onClick={() => importInputRef.current?.click()}
                 className="flex-1 ml-1 flex items-center justify-center p-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-card rounded-lg border border-border transition-colors">
                <UploadCloud size={14} className="mr-1" /> Import
              </button>
              <input type="file" ref={importInputRef} onChange={handleFileSelect} className="hidden" accept=".bin,.zip" />
           </div>
           
           <div className="flex justify-between pt-1">
             <button onClick={toggleTheme} className="p-2 text-slate-500 hover:text-primary rounded-lg hover:bg-card transition-colors">
               {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
             </button>
             <button onClick={logout} className="p-2 text-slate-500 hover:text-red-500 rounded-lg hover:bg-card transition-colors flex items-center text-xs font-medium">
               <LogOut size={16} className="mr-1" /> Lock
             </button>
           </div>
        </div>
      </div>
      
      {/* Main Content */}
      <div className="flex-1 flex flex-col w-full relative">
        {activeNote ? (
          <>
            <div className="h-16 border-b border-border flex items-center px-8 bg-card flex-shrink-0">
               <input 
                 value={activeNote.title}
                 onChange={e => handleTitleChange(e.target.value)}
                 className="text-2xl font-bold bg-transparent border-none outline-none focus:ring-0 w-full placeholder:text-slate-300"
                 placeholder="Note Title"
               />
            </div>
            
            <div className="flex-1 overflow-y-auto p-8 relative">
              <div className="max-w-4xl mx-auto w-full">
                <BlockEditor
                  key={activeNote.id}
                  content={editorContent}
                  onUpdate={handleContentUpdate}
                  onRequestMdUpload={handleRequestMdUpload}
                  onRequestCsvUpload={handleRequestCsvUpload}
                />
                
                <FileAttachments 
                   noteId={activeNote.id} 
                   files={activeNote.files || []} 
                   onFilesChanged={() => fetchNote(activeNote.id)} 
                />
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col justify-center items-center text-slate-400">
             <Database size={64} className="mb-6 opacity-20" />
             <h2 className="text-2xl font-semibold text-slate-500 mb-2">Select or create a note</h2>
             <p className="text-sm opacity-80">Your knowledge base is securely unlocked.</p>
          </div>
        )}
      </div>
    </div>
  );
}
