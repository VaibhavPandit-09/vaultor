import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Plus, Search, Sun, Moon, LogOut, 
  Trash2, Database, UploadCloud, DownloadCloud, X, Lock, FileText, File, Hash
} from 'lucide-react';

import api from '../lib/api';
import type { Resource, Tag } from '../types';
import { useTheme } from '../lib/ThemeContext';
import BlockEditor from '../components/editor/BlockEditor';
import { markdownToHtml } from '../components/editor/markdownUtils';
import { csvToTableHtml } from '../components/editor/csvUtils';

export default function Dashboard() {
  const [resources, setResources] = useState<Resource[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  
  const [activeResourceId, setActiveResourceId] = useState<string | null>(null);
  const [activeResource, setActiveResource] = useState<Resource | null>(null);
  
  const [activeTagFilter, setActiveTagFilter] = useState<string | null>(null);

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
      const { data } = await api.get(`/resources/${id}`);
      setActiveResource(data);
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (activeResourceId) {
      fetchActiveResource(activeResourceId);
    } else {
      setActiveResource(null);
    }
  }, [activeResourceId, fetchActiveResource]);

  // Handle Opening Resources from Inline Links globally
  useEffect(() => {
    (window as any).__openResource = async (resourceId: string, type: string, label: string) => {
      if (type === 'note') {
        setActiveResourceId(resourceId);
      } else if (type === 'file') {
        api.get(`/resources/${resourceId}/download`, { responseType: 'blob' })
          .then((response) => {
             const url = window.URL.createObjectURL(new Blob([response.data]));
             const link = document.createElement('a');
             link.href = url;
             let filename = label || 'download';
             const disposition = response.headers['content-disposition'];
             if (disposition && disposition.indexOf('attachment') !== -1) {
                 const filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;
                 const matches = filenameRegex.exec(disposition);
                 if (matches != null && matches[1]) {
                     filename = matches[1].replace(/['"]/g, '');
                 }
             }
             link.setAttribute('download', filename);
             document.body.appendChild(link);
             link.click();
             link.remove();
          }).catch(err => {
             console.error("Failed to download file", err);
             alert("Failed to access this resource. It might have been deleted.");
          });
      }
    };
  }, []);

  const handleCreateNote = async () => {
    try {
      const initialContent = JSON.stringify({
        type: 'doc',
        content: [{ type: 'paragraph' }],
      });
      const { data } = await api.post('/resources/note', {
        title: 'Untitled Note',
        content: initialContent,
      });
      await fetchData();
      setActiveResourceId(data.id);
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteResource = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this resource?')) return;
    try {
      await api.delete(`/resources/${id}`);
      setResources(resources.filter(r => r.id !== id));
      if (activeResourceId === id) {
        setActiveResourceId(null);
        setActiveResource(null);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleTitleChange = async (title: string) => {
    if (!activeResource || activeResource.type !== 'note') return;
    setActiveResource({ ...activeResource, title });
    try {
      await api.put(`/resources/${activeResource.id}/note`, {
        title,
        content: activeResource.content,
      });
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
      await api.put(`/resources/${activeResource.id}/note`, {
        title: activeResource.title,
        content: contentStr,
      });
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
    } catch (e) {}
  };

  const handleRemoveTag = async (tagName: string) => {
    if (!activeResource) return;
    try {
      await api.delete(`/resources/${activeResource.id}/tags/${encodeURIComponent(tagName.trim())}`);
      fetchActiveResource(activeResource.id);
      fetchData();
    } catch (e) {}
  };

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

  const filteredResources = resources.filter(r => {
    const matchesSearch = r.title.toLowerCase().includes(search.toLowerCase());
    const matchesTag = activeTagFilter ? r.tags?.some(t => t.name.toLowerCase() === activeTagFilter.toLowerCase()) : true;
    return matchesSearch && matchesTag;
  });

  const recentResources = filteredResources.slice(0, 5);
  const noteResources = filteredResources.filter(r => r.type === 'note');
  const fileResources = filteredResources.filter(r => r.type === 'file');

  const editorContent = activeResource?.type === 'note' && activeResource?.content
    ? (() => {
        try { return JSON.parse(activeResource.content as string); }
        catch { return activeResource.content; }
      })()
    : null;

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      
      <input type="file" ref={mdUploadRef} className="hidden" accept=".md,.markdown,.txt" onChange={handleMdFileChange} />
      <input type="file" ref={csvUploadRef} className="hidden" accept=".csv,.tsv,.txt" onChange={handleCsvFileChange} />

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

      {/* Redesigned Sidebar */}
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
              placeholder="Search resources..." 
              className="w-full pl-9 pr-4 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-primary transition-colors"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-2 space-y-4 pb-4">
          
          {/* Active Tag Notice */}
          {activeTagFilter && (
            <div className="px-3 flex items-center justify-between">
              <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-1 rounded inline-flex items-center">
                #{activeTagFilter}
                <button onClick={() => setActiveTagFilter(null)} className="ml-2 hover:text-red-500"><X size={12}/></button>
              </span>
            </div>
          )}

          {/* Recent */}
          {!activeTagFilter && recentResources.length > 0 && (
            <div>
              <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Recent</div>
              {recentResources.map(r => (
                <ResourceSidebarItem 
                  key={`recent-${r.id}`} 
                  resource={r} 
                  isActive={activeResourceId === r.id} 
                  onClick={() => setActiveResourceId(r.id)} 
                  onDelete={(e) => handleDeleteResource(r.id, e)} 
                />
              ))}
            </div>
          )}

          {/* Notes */}
          {noteResources.length > 0 && (
            <div>
              <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400 mt-2">Notes</div>
              {noteResources.map(r => (
                <ResourceSidebarItem 
                  key={`note-${r.id}`} 
                  resource={r} 
                  isActive={activeResourceId === r.id} 
                  onClick={() => setActiveResourceId(r.id)} 
                  onDelete={(e) => handleDeleteResource(r.id, e)} 
                />
              ))}
            </div>
          )}

          {/* Files */}
          {fileResources.length > 0 && (
            <div>
              <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400 mt-2">Files</div>
              {fileResources.map(r => (
                <ResourceSidebarItem 
                  key={`file-${r.id}`} 
                  resource={r} 
                  isActive={activeResourceId === r.id} 
                  onClick={() => { (window as any).__openResource(r.id, 'file', r.title); }} 
                  onDelete={(e) => handleDeleteResource(r.id, e)} 
                />
              ))}
            </div>
          )}

          {/* Tags */}
          {tags.length > 0 && !activeTagFilter && (
            <div>
              <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400 mt-2">Tags</div>
              <div className="px-2 flex flex-wrap gap-1 mt-1">
                {tags.map(t => (
                  <button 
                    key={t.id} 
                    onClick={() => setActiveTagFilter(t.name)}
                    className="text-xs px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors flex items-center"
                  >
                    <Hash size={12} className="mr-0.5 opacity-50" /> {t.name}
                  </button>
                ))}
              </div>
            </div>
          )}
          
          {filteredResources.length === 0 && (
             <div className="text-center p-8 text-slate-400 text-sm">No resources found</div>
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
        {activeResource && activeResource.type === 'note' ? (
          <>
            <div className="min-h-16 border-b border-border flex flex-col justify-center px-8 py-3 bg-card flex-shrink-0">
               <input 
                 value={activeResource.title}
                 onChange={e => handleTitleChange(e.target.value)}
                 className="text-2xl font-bold bg-transparent border-none outline-none focus:ring-0 w-full placeholder:text-slate-300"
                 placeholder="Note Title"
               />
               
               {/* Tags Editor */}
               <div className="flex items-center mt-2 flex-wrap gap-1">
                 {activeResource.tags?.map(t => (
                   <span key={t.id} className="text-[11px] font-medium bg-secondary/50 text-secondary-foreground px-2 py-0.5 rounded flex items-center">
                     <Hash size={10} className="mr-0.5 opacity-50" /> {t.name}
                     <button onClick={() => handleRemoveTag(t.name)} className="ml-1 opacity-50 hover:opacity-100 text-red-500"><X size={10}/></button>
                   </span>
                 ))}
                 <input 
                   placeholder="Add tag..." 
                   className="text-[11px] bg-transparent border-none outline-none text-slate-400 placeholder:text-slate-500 w-24 ml-1"
                   onKeyDown={(e) => {
                     if (e.key === 'Enter') {
                       handleAddTag(e.currentTarget.value);
                       e.currentTarget.value = '';
                     }
                   }}
                 />
               </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-8 relative">
              <div className="max-w-4xl mx-auto w-full">
                <BlockEditor
                  key={activeResource.id}
                  content={editorContent}
                  onUpdate={handleContentUpdate}
                  onRequestMdUpload={handleRequestMdUpload}
                  onRequestCsvUpload={handleRequestCsvUpload}
                />
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col justify-center items-center text-slate-400">
             <Database size={64} className="mb-6 opacity-20" />
             <h2 className="text-2xl font-semibold text-slate-500 mb-2">Select a note from the sidebar</h2>
             <p className="text-sm opacity-80">Or click '+' to create a new one.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function ResourceSidebarItem({ resource, isActive, onClick, onDelete }: { resource: Resource; isActive: boolean; onClick: () => void; onDelete: (e: React.MouseEvent) => void }) {
  return (
    <div 
       onClick={onClick}
       className={`px-3 py-2 rounded-lg cursor-pointer transition-all mx-2 group border mb-1 flex items-center justify-between ${isActive ? 'bg-primary/10 border-primary/30 shadow-sm' : 'border-transparent hover:bg-slate-100 dark:hover:bg-slate-800'}`}
    >
       <div className="flex items-center overflow-hidden pr-2">
         {resource.type === 'note' ? <FileText size={16} className={`mr-2 flex-shrink-0 ${isActive ? 'text-primary' : 'text-slate-400'}`} /> : <File size={16} className={`mr-2 flex-shrink-0 ${isActive ? 'text-primary' : 'text-slate-400'}`} />}
         <div className="overflow-hidden">
           <h3 className={`font-medium text-sm truncate ${isActive ? 'text-primary' : ''}`}>
             {resource.title}
           </h3>
         </div>
       </div>
       <button onClick={onDelete} className="text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 p-1">
         <Trash2 size={14} />
       </button>
    </div>
  );
}
