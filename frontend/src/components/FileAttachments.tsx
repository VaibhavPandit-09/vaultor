import React, { useRef } from 'react';
import { Paperclip, Download, Trash2 } from 'lucide-react';
import api from '../lib/api';
import type { AttachedFile } from '../types';

interface Props {
  noteId: string;
  files: AttachedFile[];
  onFilesChanged: () => void;
}

export default function FileAttachments({ noteId, files, onFilesChanged }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    
    const file = e.target.files[0];
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      // 1. Upload to files
      const uploadRes = await api.post('/files', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      // 2. Attach to note
      await api.post(`/notes/${noteId}/files/${uploadRes.data.id}`);
      onFilesChanged();
    } catch (err) {
      console.error('File upload failed', err);
      alert('Failed to upload file');
    }
    
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDelete = async (fileId: string) => {
    if (!confirm('Are you sure you want to remove this file?')) return;
    try {
      // Detach file and then delete file globally
      await api.delete(`/notes/${noteId}/files/${fileId}`);
      await api.delete(`/files/${fileId}`);
      onFilesChanged();
    } catch (err) {
      console.error('Failed to delete file', err);
    }
  };

  const handleDownload = (fileId: string) => {
    // Generate a secure download window that respects auth headers... wait.
    // Standard a href won't pass Authorization header in some setups unless we use a token cookie, 
    // but we can fetch blob with Axios and prompt download.
    api.get(`/files/${fileId}/download`, { responseType: 'blob' })
      .then((response) => {
         const url = window.URL.createObjectURL(new Blob([response.data]));
         const link = document.createElement('a');
         link.href = url;
         
         const disposition = response.headers['content-disposition'];
         let filename = 'downloaded_file';
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
      });
  };

  return (
    <div className="mt-8 border-t border-border pt-6">
      <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4 flex items-center">
        <Paperclip size={16} className="mr-2" />
        Attachments ({files.length})
      </h3>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mb-4">
        {files.map(f => (
          <div key={f.id} className="flex items-center justify-between p-3 bg-background border border-border rounded-xl shadow-sm hover:shadow transition-all group">
            <span className="text-sm truncate mr-2" title={f.name}>{f.name}</span>
            <div className="flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
               <button onClick={() => handleDownload(f.id)} className="p-1.5 bg-primary/10 text-primary rounded-lg hover:bg-primary hover:text-white transition-colors" title="Download">
                 <Download size={14} />
               </button>
               <button onClick={() => handleDelete(f.id)} className="p-1.5 bg-red-500/10 text-red-500 rounded-lg hover:bg-red-500 hover:text-white transition-colors" title="Delete">
                 <Trash2 size={14} />
               </button>
            </div>
          </div>
        ))}
      </div>
      
      <button 
        onClick={() => fileInputRef.current?.click()}
        className="px-4 py-2 border border-dashed border-primary text-primary hover:bg-primary/5 rounded-xl font-medium text-sm transition-colors flex items-center justify-center cursor-pointer"
      >
        <Paperclip size={16} className="mr-2" />
        Add File
      </button>
      <input 
        type="file" 
        className="hidden" 
        ref={fileInputRef} 
        onChange={handleUpload} 
      />
    </div>
  );
}
