import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Plus,
  Search,
  Sun,
  Moon,
  LogOut,
  Trash2,
  Database,
  UploadCloud,
  DownloadCloud,
  X,
  FileText,
  Paperclip,
  ChevronDown,
  Upload,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Loader2,
  Command,
  Keyboard,
} from 'lucide-react';
import api from '../lib/api';
import type { Resource, Tag } from '../types';
import { useTheme } from '../lib/ThemeContext';
import BlockEditor from '../components/editor/BlockEditor';
import FilePreview from '../components/FilePreview';
import { markdownToHtml } from '../components/editor/markdownUtils';
import { csvToTableHtml } from '../components/editor/csvUtils';
import AppModal from '../components/modals/AppModal';
import GlobalSearchModal from '../components/modals/GlobalSearchModal';
import ShortcutsModal from '../components/modals/ShortcutsModal';
import { isMac } from '../lib/shortcuts';
import {
  clearSelectedTags,
  navigateBack,
  navigateForward,
  openResource as openResourceAction,
  removeResourceFromState,
  removeSelectedTag,
  setCurrentResourceId,
  setSearchQuery,
  setTypeFilter,
  toggleSelectedTag,
} from '../state/store';
import { useAppDispatch, useAppSelector } from '../state/hooks';

type TypeFilter = 'all' | 'note' | 'file';

interface DeleteModalState {
  id: string;
  title: string;
  backlinks: Resource[];
}

export default function Dashboard() {
  const dispatch = useAppDispatch();
  const currentResourceId = useAppSelector((state) => state.vault.currentResourceId);
  const navigation = useAppSelector((state) => state.vault.navigation);
  const filters = useAppSelector((state) => state.vault.filters);

  const [resources, setResources] = useState<Resource[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [activeResource, setActiveResource] = useState<Resource | null>(null);
  const [backlinks, setBacklinks] = useState<Resource[]>([]);
  const [activeResourceLoading, setActiveResourceLoading] = useState(false);
  const [sidebarLoading, setSidebarLoading] = useState(false);

  const [showTypeDropdown, setShowTypeDropdown] = useState(false);
  const [tagSearch, setTagSearch] = useState('');
  const [globalSearchOpen, setGlobalSearchOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  const [authModal, setAuthModal] = useState<'export' | 'import' | null>(null);
  const [authPassword, setAuthPassword] = useState('');
  const [importFile, setImportFile] = useState<File | null>(null);
  const [authError, setAuthError] = useState('');
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [importSuccessOpen, setImportSuccessOpen] = useState(false);

  const [createNotePending, setCreateNotePending] = useState(false);
  const [uploadPending, setUploadPending] = useState(false);
  const [deletePending, setDeletePending] = useState(false);
  const [replacePending, setReplacePending] = useState(false);
  const [tagDeletePending, setTagDeletePending] = useState(false);

  const [deleteModal, setDeleteModal] = useState<DeleteModalState | null>(null);
  const [replaceLinkModal, setReplaceLinkModal] = useState<{ oldId: string; title: string; backlinks: Resource[] } | null>(null);
  const [replaceSearch, setReplaceSearch] = useState('');
  const [replaceResults, setReplaceResults] = useState<Resource[]>([]);
  const [replaceLoading, setReplaceLoading] = useState(false);
  const [tagDeleteModal, setTagDeleteModal] = useState<{ id: string; name: string } | null>(null);

  const importInputRef = useRef<HTMLInputElement>(null);
  const fileUploadRef = useRef<HTMLInputElement>(null);
  const mdUploadRef = useRef<HTMLInputElement>(null);
  const csvUploadRef = useRef<HTMLInputElement>(null);

  const { theme, toggleTheme } = useTheme();

  const fetchData = useCallback(async () => {
    setSidebarLoading(true);
    try {
      const [resData, tagsData] = await Promise.all([api.get('/resources'), api.get('/tags')]);
      setResources(resData.data || []);
      setTags(tagsData.data || []);
    } catch (error) {
      console.error(error);
    } finally {
      setSidebarLoading(false);
    }
  }, []);

  const fetchActiveResource = useCallback(async (id: string) => {
    setActiveResourceLoading(true);
    try {
      const [resData, backlinksData] = await Promise.all([
        api.get(`/resources/${id}`),
        api.get(`/resources/${id}/backlinks`),
      ]);
      setActiveResource(resData.data);
      setBacklinks(backlinksData.data || []);
    } catch (error) {
      console.error(error);
      setActiveResource(null);
      setBacklinks([]);
    } finally {
      setActiveResourceLoading(false);
    }
  }, []);

  const markOpened = useCallback((id: string) => {
    api.post(`/resources/${id}/open`).catch(() => {});
  }, []);

  const openResourceById = useCallback((id: string) => {
    dispatch(openResourceAction(id));
    markOpened(id);
  }, [dispatch, markOpened]);

  const handleBackNavigation = useCallback(() => {
    if (navigation.currentIndex <= 0) return;
    const previousId = navigation.history[navigation.currentIndex - 1];
    dispatch(navigateBack());
    if (previousId) markOpened(previousId);
  }, [dispatch, markOpened, navigation.currentIndex, navigation.history]);

  const handleForwardNavigation = useCallback(() => {
    if (navigation.currentIndex >= navigation.history.length - 1) return;
    const nextId = navigation.history[navigation.currentIndex + 1];
    dispatch(navigateForward());
    if (nextId) markOpened(nextId);
  }, [dispatch, markOpened, navigation.currentIndex, navigation.history]);

  const handleCreateNote = useCallback(async () => {
    if (createNotePending) return;
    setCreateNotePending(true);
    try {
      const { data } = await api.post('/resources', {
        type: 'note',
        title: 'Untitled Note',
        content: { type: 'doc', content: [] },
      });
      await fetchData();
      openResourceById(data.id);
    } catch (error) {
      console.error(error);
    } finally {
      setCreateNotePending(false);
    }
  }, [createNotePending, fetchData, openResourceById]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (currentResourceId) {
      fetchActiveResource(currentResourceId);
      return;
    }
    setActiveResource(null);
    setBacklinks([]);
  }, [currentResourceId, fetchActiveResource]);

  useEffect(() => {
    (window as any).__openResource = (resourceId: string) => {
      openResourceById(resourceId);
    };

    return () => {
      (window as any).__openResource = undefined;
    };
  }, [openResourceById]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isEditable = Boolean(
        target?.closest('[contenteditable="true"]') ||
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.tagName === 'SELECT'
      );
      const modKey = isMac ? event.metaKey : event.ctrlKey;

      if (modKey && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setGlobalSearchOpen(true);
        return;
      }

      if (modKey && event.key.toLowerCase() === 'n') {
        event.preventDefault();
        handleCreateNote();
        return;
      }

      if (modKey && event.key.toLowerCase() === 'u') {
        event.preventDefault();
        if (!uploadPending) fileUploadRef.current?.click();
        return;
      }

      if ((modKey && event.key === '/') || (!isEditable && event.key === '?')) {
        event.preventDefault();
        setShortcutsOpen(true);
        return;
      }

      if (isMac && event.metaKey && event.key === '[') {
        event.preventDefault();
        handleBackNavigation();
        return;
      }

      if (isMac && event.metaKey && event.key === ']') {
        event.preventDefault();
        handleForwardNavigation();
        return;
      }

      if (!isMac && event.altKey && event.key === 'ArrowLeft') {
        event.preventDefault();
        handleBackNavigation();
        return;
      }

      if (!isMac && event.altKey && event.key === 'ArrowRight') {
        event.preventDefault();
        handleForwardNavigation();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleBackNavigation, handleCreateNote, handleForwardNavigation, uploadPending]);

  useEffect(() => {
    if (!replaceLinkModal || !replaceSearch.trim()) {
      setReplaceResults([]);
      setReplaceLoading(false);
      return;
    }

    let active = true;
    const timer = window.setTimeout(async () => {
      setReplaceLoading(true);
      try {
        const { data } = await api.get(`/resources/search?q=${encodeURIComponent(replaceSearch)}`);
        if (!active) return;
        setReplaceResults((data || []).filter((resource: Resource) => resource.id !== replaceLinkModal.oldId));
      } catch (error) {
        console.error(error);
        if (active) setReplaceResults([]);
      } finally {
        if (active) setReplaceLoading(false);
      }
    }, 200);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [replaceLinkModal, replaceSearch]);

  const handleUploadFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || uploadPending) return;

    setUploadPending(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const { data } = await api.post('/resources/file', formData);
      await fetchData();
      openResourceById(data.id);
    } catch (error) {
      console.error(error);
    } finally {
      setUploadPending(false);
      if (fileUploadRef.current) fileUploadRef.current.value = '';
    }
  };

  const handleDeleteResource = async (id: string, event: React.MouseEvent) => {
    event.stopPropagation();
    try {
      const { data: linkedFrom } = await api.get(`/resources/${id}/backlinks`);
      const resource = resources.find((item) => item.id === id);
      setDeleteModal({
        id,
        title: resource?.title || 'Resource',
        backlinks: linkedFrom || [],
      });
    } catch (error) {
      console.error(error);
    }
  };

  const executeDelete = async (id: string) => {
    setDeletePending(true);
    try {
      await api.delete(`/resources/${id}`);
      setResources((prev) => prev.filter((resource) => resource.id !== id));
      dispatch(removeResourceFromState(id));
      if (currentResourceId === id) {
        dispatch(setCurrentResourceId(null));
      }
      setDeleteModal(null);
    } catch (error) {
      console.error(error);
    } finally {
      setDeletePending(false);
    }
  };

  const executeReplaceLinks = async (newId: string) => {
    if (!replaceLinkModal) return;
    setReplacePending(true);
    try {
      await api.post(`/resources/${replaceLinkModal.oldId}/replace-links`, { newResourceId: newId });
      setReplaceLinkModal(null);
      setDeleteModal(null);
      setReplaceSearch('');
      setReplaceResults([]);
      await fetchData();
      if (currentResourceId === replaceLinkModal.oldId) {
        openResourceById(newId);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setReplacePending(false);
    }
  };

  const handleTitleChange = async (title: string) => {
    if (!activeResource || activeResource.type !== 'note') return;
    setActiveResource({ ...activeResource, title });
    try {
      await api.put(`/resources/${activeResource.id}/note`, { title, content: activeResource.content });
      fetchData();
    } catch (error) {
      console.error(error);
    }
  };

  const handleContentUpdate = async (json: any) => {
    if (!activeResource || activeResource.type !== 'note') return;
    const contentStr = JSON.stringify(json);
    setActiveResource((prev) => (prev ? { ...prev, content: contentStr } : null));
    try {
      await api.put(`/resources/${activeResource.id}/note`, { title: activeResource.title, content: contentStr });
      fetchData();
    } catch (error) {
      console.error(error);
    }
  };

  const handleAddTag = async (tagName: string) => {
    if (!activeResource || !tagName.trim()) return;
    try {
      await api.post(`/resources/${activeResource.id}/tags/${encodeURIComponent(tagName.trim())}`);
      fetchActiveResource(activeResource.id);
      fetchData();
    } catch (error) {
      console.error(error);
    }
  };

  const handleRemoveTag = async (tagName: string) => {
    if (!activeResource) return;
    try {
      await api.delete(`/resources/${activeResource.id}/tags/${encodeURIComponent(tagName.trim())}`);
      fetchActiveResource(activeResource.id);
      fetchData();
    } catch (error) {
      console.error(error);
    }
  };

  const executeDeleteTag = async () => {
    if (!tagDeleteModal) return;
    setTagDeletePending(true);
    try {
      await api.delete(`/tags/${tagDeleteModal.id}`);
      dispatch(removeSelectedTag(tagDeleteModal.name));
      await fetchData();
      if (activeResource) await fetchActiveResource(activeResource.id);
      setTagDeleteModal(null);
    } catch (error) {
      console.error(error);
    } finally {
      setTagDeletePending(false);
    }
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

  const handleMdFileChange = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const html = markdownToHtml(text);
      const editor = (window as any).__vaultor_editor;
      if (editor) editor.chain().focus().insertContent(html).run();
    } catch (error) {
      console.error('MD upload failed:', error);
    }
    if (mdUploadRef.current) mdUploadRef.current.value = '';
  }, []);

  const handleCsvFileChange = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const html = csvToTableHtml(text);
      const editor = (window as any).__vaultor_editor;
      if (editor) editor.chain().focus().insertContent(html).run();
    } catch (error) {
      console.error('CSV upload failed:', error);
    }
    if (csvUploadRef.current) csvUploadRef.current.value = '';
  }, []);

  const triggerExport = () => {
    setAuthModal('export');
    setAuthPassword('');
    setAuthError('');
  };

  const handleImportFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      setImportFile(event.target.files[0]);
      setAuthModal('import');
      setAuthPassword('');
      setAuthError('');
    }
    if (importInputRef.current) importInputRef.current.value = '';
  };

  const executeExport = async () => {
    setAuthSubmitting(true);
    setAuthError('');
    try {
      const response = await api.get('/export', { params: { password: authPassword }, responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'encrypted-export.bin');
      document.body.appendChild(link);
      link.click();
      link.remove();
      setAuthModal(null);
    } catch (error: any) {
      setAuthError(error.response?.status === 401 ? 'Invalid master password' : 'Export failed');
    } finally {
      setAuthSubmitting(false);
    }
  };

  const executeImport = async () => {
    if (!importFile) return;
    setAuthSubmitting(true);
    setAuthError('');
    const formData = new FormData();
    formData.append('file', importFile);
    formData.append('password', authPassword);
    try {
      await api.post('/import', formData);
      setAuthModal(null);
      setImportSuccessOpen(true);
      window.setTimeout(() => window.location.reload(), 1200);
    } catch (error: any) {
      setAuthError(error.response?.data?.message || 'Decryption failed');
    } finally {
      setAuthSubmitting(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('vaultor_auth_token');
    window.location.href = '/auth';
  };

  const filteredResources = useMemo(() => {
    return resources.filter((resource) => {
      const matchesSearch = resource.title.toLowerCase().includes(filters.searchQuery.toLowerCase());
      const matchesType = filters.typeFilter === 'all' || resource.type === filters.typeFilter;
      const matchesTags = filters.selectedTags.length === 0 || filters.selectedTags.every((tagName) => resource.tags?.some((tag) => tag.name.toLowerCase() === tagName.toLowerCase()));
      return matchesSearch && matchesType && matchesTags;
    });
  }, [filters.searchQuery, filters.selectedTags, filters.typeFilter, resources]);

  const noteCount = filteredResources.filter((resource) => resource.type === 'note').length;
  const fileCount = filteredResources.filter((resource) => resource.type === 'file').length;
  const filteredTags = tags.filter((tag) => tag.name.toLowerCase().includes(tagSearch.toLowerCase()));

  const editorContent = activeResource?.type === 'note' && activeResource?.content
    ? (() => {
        try {
          return JSON.parse(activeResource.content as string);
        } catch {
          return activeResource.content;
        }
      })()
    : null;

  const typeLabels: Record<TypeFilter, string> = { all: 'All', note: 'Notes', file: 'Files' };
  const canGoBack = navigation.currentIndex > 0;
  const canGoForward = navigation.currentIndex < navigation.history.length - 1;

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      <input type="file" ref={mdUploadRef} className="hidden" accept=".md,.markdown,.txt" onChange={handleMdFileChange} />
      <input type="file" ref={csvUploadRef} className="hidden" accept=".csv,.tsv,.txt" onChange={handleCsvFileChange} />
      <input type="file" ref={fileUploadRef} className="hidden" onChange={handleUploadFile} />
      <input type="file" ref={importInputRef} onChange={handleImportFileSelect} className="hidden" accept=".bin,.zip" />

      <GlobalSearchModal
        open={globalSearchOpen}
        onClose={() => setGlobalSearchOpen(false)}
        onSelect={(resourceId) => {
          openResourceById(resourceId);
          setGlobalSearchOpen(false);
        }}
      />
      <ShortcutsModal open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />

      <AppModal
        open={Boolean(authModal)}
        onClose={() => {
          if (!authSubmitting) setAuthModal(null);
        }}
        title={authModal === 'export' ? 'Secure Export' : 'Secure Import'}
        description={authModal === 'export'
          ? 'Enter your master password to encrypt and download your vault.'
          : 'Import will overwrite all existing local data with the selected backup.'}
        footer={
          <>
            <button
              onClick={() => setAuthModal(null)}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-background"
              disabled={authSubmitting}
            >
              Cancel
            </button>
            <button
              onClick={authModal === 'export' ? executeExport : executeImport}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={authSubmitting || !authPassword || (authModal === 'import' && !importFile)}
            >
              {authSubmitting ? 'Working...' : authModal === 'export' ? 'Encrypt & Download' : 'Decrypt & Restore'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          {authModal === 'import' && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
              {importFile ? `Selected backup: ${importFile.name}` : 'Choose a backup file from the footer import button first.'}
            </div>
          )}
          {authError && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-300">
              {authError}
            </div>
          )}
          <input
            type="password"
            autoFocus
            value={authPassword}
            onChange={(event) => setAuthPassword(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                if (authModal === 'export') executeExport();
                if (authModal === 'import') executeImport();
              }
            }}
            placeholder="Master Password"
            className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none transition-colors focus:border-primary"
          />
        </div>
      </AppModal>

      <AppModal
        open={importSuccessOpen}
        onClose={() => setImportSuccessOpen(false)}
        title="Vault Restored"
        description="Your backup was imported successfully. Vaultor is refreshing now."
        footer={
          <button
            onClick={() => window.location.reload()}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Refresh Now
          </button>
        }
      >
        <p className="text-sm text-slate-500">A short restart keeps the restored vault consistent before you continue working.</p>
      </AppModal>

      <AppModal
        open={Boolean(deleteModal)}
        onClose={() => {
          if (!deletePending) setDeleteModal(null);
        }}
        title={deleteModal?.backlinks.length ? 'Referenced Resource' : 'Delete Resource'}
        description={deleteModal?.backlinks.length
          ? `This resource is referenced by ${deleteModal.backlinks.length} resource${deleteModal.backlinks.length === 1 ? '' : 's'}.`
          : 'This resource will be deleted permanently.'}
        footer={
          <>
            <button
              onClick={() => setDeleteModal(null)}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-background"
              disabled={deletePending}
            >
              Cancel
            </button>
            {Boolean(deleteModal?.backlinks.length) && (
              <button
                onClick={() => deleteModal && setReplaceLinkModal({ oldId: deleteModal.id, title: deleteModal.title, backlinks: deleteModal.backlinks })}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
                disabled={deletePending}
              >
                Replace Links
              </button>
            )}
            <button
              onClick={() => deleteModal && executeDelete(deleteModal.id)}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={deletePending}
            >
              {deletePending ? 'Deleting...' : 'Delete Anyway'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
            <AlertTriangle size={18} className="mt-0.5 flex-shrink-0" />
            <div>
              <div className="font-medium">{deleteModal?.title}</div>
              <div className="mt-1 text-xs opacity-80">Delete is permanent, so Vaultor pauses here before removing the resource.</div>
            </div>
          </div>
          {Boolean(deleteModal?.backlinks.length) && (
            <div className="max-h-44 space-y-2 overflow-y-auto">
              {deleteModal?.backlinks.map((resource) => (
                <div key={resource.id} className="flex items-center gap-3 rounded-xl bg-background px-3 py-2 text-sm">
                  {resource.type === 'note' ? <FileText size={14} className="text-blue-500" /> : <Paperclip size={14} className="text-green-500" />}
                  <span className="truncate">{resource.title}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </AppModal>

      <AppModal
        open={Boolean(replaceLinkModal)}
        onClose={() => {
          if (!replacePending) setReplaceLinkModal(null);
        }}
        title="Replace Links"
        description="Choose a resource to receive all incoming links before the original is deleted."
        footer={
          <button
            onClick={() => setReplaceLinkModal(null)}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-background"
            disabled={replacePending}
          >
            Cancel
          </button>
        }
      >
        <div className="space-y-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <input
              autoFocus
              value={replaceSearch}
              onChange={(event) => setReplaceSearch(event.target.value)}
              placeholder="Search replacement resource..."
              className="w-full rounded-xl border border-border bg-background py-3 pl-9 pr-4 text-sm outline-none transition-colors focus:border-primary"
            />
          </div>
          <div className="max-h-64 space-y-1 overflow-y-auto">
            {replaceResults.map((resource) => (
              <button
                key={resource.id}
                onClick={() => executeReplaceLinks(resource.id)}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors hover:bg-background disabled:cursor-not-allowed disabled:opacity-60"
                disabled={replacePending}
              >
                {resource.type === 'note' ? <FileText size={14} className="text-blue-500" /> : <Paperclip size={14} className="text-green-500" />}
                <span className="truncate text-sm font-medium">{resource.title}</span>
              </button>
            ))}
            {!replaceLoading && replaceSearch.trim() && replaceResults.length === 0 && (
              <div className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-slate-500">No matches found.</div>
            )}
            {replaceLoading && <div className="px-1 text-sm text-slate-400">Searching replacements...</div>}
          </div>
        </div>
      </AppModal>

      <AppModal
        open={Boolean(tagDeleteModal)}
        onClose={() => {
          if (!tagDeletePending) setTagDeleteModal(null);
        }}
        title="Delete Tag"
        description="Delete this tag from all resources in Vaultor?"
        footer={
          <>
            <button
              onClick={() => setTagDeleteModal(null)}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-background"
              disabled={tagDeletePending}
            >
              Cancel
            </button>
            <button
              onClick={executeDeleteTag}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-60"
              disabled={tagDeletePending}
            >
              {tagDeletePending ? 'Deleting...' : 'Delete Tag'}
            </button>
          </>
        }
      >
        <p className="text-sm text-slate-500">
          {tagDeleteModal?.name ? `"${tagDeleteModal.name}" will be removed everywhere it appears.` : ''}
        </p>
      </AppModal>

      <div className="z-10 flex w-72 flex-shrink-0 flex-col border-r border-border bg-card transition-colors">
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <h1 className="flex items-center text-lg font-bold tracking-tight text-primary">
            <Database className="mr-2" size={22} /> Vaultor
          </h1>
          <button
            onClick={() => setGlobalSearchOpen(true)}
            className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-2 py-1 text-[11px] font-medium text-slate-500 transition-colors hover:border-primary hover:text-primary"
            title={isMac ? 'Search (Cmd+K)' : 'Search (Ctrl+K)'}
          >
            <Search size={12} />
            <span>{isMac ? 'Cmd' : 'Ctrl'}+K</span>
          </button>
        </div>

        <div className="px-3 pb-2">
          <div className="flex gap-1.5">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              <input
                type="text"
                placeholder="Search..."
                className="w-full rounded-lg border border-border bg-background py-1.5 pl-8 pr-3 text-xs transition-colors focus:border-primary focus:outline-none"
                value={filters.searchQuery}
                onChange={(event) => dispatch(setSearchQuery(event.target.value))}
              />
            </div>
            <div className="relative">
              <button
                onClick={() => setShowTypeDropdown((prev) => !prev)}
                className="flex items-center gap-1 whitespace-nowrap rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                {typeLabels[filters.typeFilter]} <ChevronDown size={12} />
              </button>
              {showTypeDropdown && (
                <div className="absolute right-0 z-20 mt-1 w-24 rounded-lg border border-border bg-card py-1 shadow-xl">
                  {(['all', 'note', 'file'] as TypeFilter[]).map((type) => (
                    <button
                      key={type}
                      onClick={() => {
                        dispatch(setTypeFilter(type));
                        setShowTypeDropdown(false);
                      }}
                      className={`w-full px-3 py-1.5 text-left text-xs transition-colors hover:bg-slate-100 dark:hover:bg-slate-800 ${filters.typeFilter === type ? 'font-semibold text-primary' : ''}`}
                    >
                      {typeLabels[type]}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex gap-1.5 px-3 pb-2">
          <button
            onClick={handleCreateNote}
            disabled={createNotePending}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary py-1.5 text-xs font-medium text-white transition-all hover:bg-primary/90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {createNotePending ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            New Note
          </button>
          <button
            onClick={() => fileUploadRef.current?.click()}
            disabled={uploadPending}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border py-1.5 text-xs font-medium transition-all hover:bg-slate-100 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 dark:hover:bg-slate-800"
          >
            {uploadPending ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
            Upload
          </button>
        </div>

        {filters.selectedTags.length > 0 && (
          <div className="flex flex-wrap items-center gap-1 px-3 pb-2">
            {filters.selectedTags.map((tagName) => (
              <span key={tagName} className="flex items-center rounded-md bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                {tagName}
                <button onClick={() => dispatch(removeSelectedTag(tagName))} className="ml-1 opacity-60 hover:opacity-100"><X size={10} /></button>
              </span>
            ))}
            <button onClick={() => dispatch(clearSelectedTags())} className="ml-1 text-[10px] text-slate-400 hover:text-red-500">Clear</button>
          </div>
        )}

        <div className="border-t border-border" />

        <div className="px-4 py-1.5 text-[10px] font-medium text-slate-400">
          {filteredResources.length} resource{filteredResources.length === 1 ? '' : 's'}
          {(filters.searchQuery || filters.selectedTags.length > 0 || filters.typeFilter !== 'all') && (
            <span className="ml-1 opacity-70">({noteCount} note{noteCount === 1 ? '' : 's'}, {fileCount} file{fileCount === 1 ? '' : 's'})</span>
          )}
        </div>

        <div className="flex-1 overflow-y-auto py-0.5">
          {sidebarLoading ? (
            <div className="space-y-2 px-3 py-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="h-9 animate-pulse rounded-xl bg-background" />
              ))}
            </div>
          ) : filteredResources.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400">No resources found</div>
          ) : (
            <>
              {filteredResources.filter((resource) => resource.type === 'note').length > 0 && filters.typeFilter !== 'file' && (
                <>
                  <div className="px-4 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400/70">Notes</div>
                  {filteredResources.filter((resource) => resource.type === 'note').map((resource) => (
                    <SidebarItem
                      key={resource.id}
                      resource={resource}
                      isActive={currentResourceId === resource.id}
                      onClick={() => openResourceById(resource.id)}
                      onDelete={(event) => handleDeleteResource(resource.id, event)}
                    />
                  ))}
                </>
              )}
              {filteredResources.filter((resource) => resource.type === 'file').length > 0 && filters.typeFilter !== 'note' && (
                <>
                  <div className="px-4 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400/70">Files</div>
                  {filteredResources.filter((resource) => resource.type === 'file').map((resource) => (
                    <SidebarItem
                      key={resource.id}
                      resource={resource}
                      isActive={currentResourceId === resource.id}
                      onClick={() => openResourceById(resource.id)}
                      onDelete={(event) => handleDeleteResource(resource.id, event)}
                    />
                  ))}
                </>
              )}
            </>
          )}
        </div>

        <div className="border-t border-border" />

        <div className="flex max-h-40 flex-col px-3 py-2">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Tags</span>
          </div>
          {tags.length > 3 && (
            <input
              type="text"
              placeholder="Search tags..."
              className="mb-1.5 w-full rounded border border-border bg-background px-2.5 py-1 text-[11px] focus:border-primary focus:outline-none"
              value={tagSearch}
              onChange={(event) => setTagSearch(event.target.value)}
            />
          )}
          <div className="flex flex-wrap gap-1 overflow-y-auto">
            {filteredTags.map((tag) => (
              <span
                key={tag.id}
                className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium transition-colors ${
                  filters.selectedTags.includes(tag.name)
                    ? 'border-primary/30 bg-primary/15 text-primary'
                    : 'border-transparent bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                }`}
              >
                <button onClick={() => dispatch(toggleSelectedTag(tag.name))} className="cursor-pointer">{tag.name}</button>
                <button
                  onClick={() => setTagDeleteModal({ id: tag.id, name: tag.name })}
                  className="opacity-40 transition-opacity hover:text-red-500 hover:opacity-100"
                  title="Delete tag"
                >
                  <X size={10} />
                </button>
              </span>
            ))}
            {filteredTags.length === 0 && <span className="text-[10px] text-slate-400">No tags</span>}
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-border bg-background p-2">
          <div className="flex items-center gap-0.5">
            <button onClick={triggerExport} title="Export Vault" className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-card hover:text-primary"><DownloadCloud size={16} /></button>
            <button onClick={() => importInputRef.current?.click()} title="Import Vault" className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-card hover:text-primary"><UploadCloud size={16} /></button>
            <button onClick={() => setShortcutsOpen(true)} title="Keyboard Shortcuts" className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-card hover:text-primary"><Keyboard size={16} /></button>
          </div>
          <div className="flex items-center gap-0.5">
            <button onClick={toggleTheme} className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-card hover:text-primary">
              {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
            </button>
            <button onClick={logout} className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-card hover:text-red-500" title="Lock Vault"><LogOut size={16} /></button>
          </div>
        </div>
      </div>

      <div className="relative flex w-full flex-1 flex-col">
        <div className="flex items-center justify-between border-b border-border bg-card px-4 py-2">
          <div className="flex items-center gap-1">
            <button
              onClick={handleBackNavigation}
              disabled={!canGoBack}
              className={`rounded-lg p-1.5 transition-colors ${canGoBack ? 'text-slate-500 hover:bg-slate-100 hover:text-primary dark:hover:bg-slate-800' : 'cursor-not-allowed text-slate-300 dark:text-slate-700'}`}
              title={isMac ? 'Back (Cmd+[)' : 'Back (Alt+Left)'}
            >
              <ChevronLeft size={18} />
            </button>
            <button
              onClick={handleForwardNavigation}
              disabled={!canGoForward}
              className={`rounded-lg p-1.5 transition-colors ${canGoForward ? 'text-slate-500 hover:bg-slate-100 hover:text-primary dark:hover:bg-slate-800' : 'cursor-not-allowed text-slate-300 dark:text-slate-700'}`}
              title={isMac ? 'Forward (Cmd+])' : 'Forward (Alt+Right)'}
            >
              <ChevronRight size={18} />
            </button>
          </div>
          <div className="min-w-0 flex-1 px-4">
            <div className="truncate text-sm font-medium text-slate-500">{activeResource?.title || 'No resource selected'}</div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setGlobalSearchOpen(true)} className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-slate-500 transition-colors hover:border-primary hover:text-primary">
              <Search size={14} /> Search
            </button>
            <button onClick={() => setShortcutsOpen(true)} className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-slate-500 transition-colors hover:border-primary hover:text-primary">
              <Command size={14} /> Help
            </button>
          </div>
        </div>

        {activeResourceLoading ? (
          <div className="flex-1 p-8">
            <div className="mx-auto max-w-4xl space-y-4">
              <div className="h-10 w-1/2 animate-pulse rounded-xl bg-card" />
              <div className="h-24 animate-pulse rounded-2xl bg-card" />
              <div className="h-24 animate-pulse rounded-2xl bg-card" />
              <div className="h-24 animate-pulse rounded-2xl bg-card" />
            </div>
          </div>
        ) : activeResource ? (
          activeResource.type === 'note' ? (
            <>
              <div className="flex min-h-16 flex-shrink-0 flex-col justify-center border-b border-border bg-card px-8 py-3">
                <input
                  value={activeResource.title}
                  onChange={(event) => handleTitleChange(event.target.value)}
                  className="w-full border-none bg-transparent text-2xl font-bold outline-none placeholder:text-slate-300 focus:ring-0"
                  placeholder="Note Title"
                />
                <div className="mt-2 flex flex-wrap items-center gap-1">
                  {activeResource.tags?.map((tag) => (
                    <span key={tag.id} className="flex items-center rounded-md bg-blue-500/10 px-2 py-0.5 text-[11px] font-medium text-blue-600 dark:text-blue-400">
                      {tag.name}
                      <button onClick={() => handleRemoveTag(tag.name)} className="ml-1.5 text-[10px] text-red-500 opacity-50 hover:opacity-100">✕</button>
                    </span>
                  ))}
                  <input
                    placeholder="Add tag..."
                    className="ml-1 w-24 border-none bg-transparent text-[11px] text-slate-400 outline-none placeholder:text-slate-500"
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && event.currentTarget.value.trim()) {
                        handleAddTag(event.currentTarget.value.trim());
                        event.currentTarget.value = '';
                      }
                    }}
                  />
                </div>
              </div>
              <div className="relative flex-1 overflow-y-auto p-8">
                <div className="mx-auto w-full max-w-4xl">
                  <BlockEditor
                    key={activeResource.id}
                    content={editorContent}
                    onUpdate={handleContentUpdate}
                    onRequestMdUpload={handleRequestMdUpload}
                    onRequestCsvUpload={handleRequestCsvUpload}
                  />
                  {backlinks.length > 0 && (
                    <div className="mt-12 border-t border-border pt-6">
                      <h4 className="ml-1 mb-3 flex items-center text-sm font-semibold text-slate-400"><Search size={14} className="mr-2" /> Linked from</h4>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {backlinks.map((resource) => (
                          <div
                            key={resource.id}
                            onClick={() => openResourceById(resource.id)}
                            className="flex cursor-pointer items-center rounded-xl border border-border bg-card p-3 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50"
                          >
                            {resource.type === 'note' ? <FileText size={16} className="mr-3 opacity-80 text-blue-500" /> : <Paperclip size={16} className="mr-3 opacity-80 text-green-500" />}
                            <span className="truncate text-sm font-medium">{resource.title}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 overflow-y-auto">
              <FilePreview resource={activeResource} onAddTag={handleAddTag} onRemoveTag={handleRemoveTag} />
            </div>
          )
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center text-slate-400">
            <Database size={64} className="mb-6 opacity-20" />
            <h2 className="mb-2 text-2xl font-semibold text-slate-500">Welcome to Vaultor</h2>
            <p className="mb-6 text-sm opacity-80">Select a resource or create a new one.</p>
            <div className="flex gap-3">
              <button onClick={handleCreateNote} className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary/90"><Plus size={16} /> New Note</button>
              <button onClick={() => fileUploadRef.current?.click()} className="flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-card"><Upload size={16} /> Upload File</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SidebarItem({ resource, isActive, onClick, onDelete }: { resource: Resource; isActive: boolean; onClick: () => void; onDelete: (event: React.MouseEvent) => void }) {
  return (
    <div
      onClick={onClick}
      className={`group mx-2 mb-0.5 flex cursor-pointer items-center justify-between rounded-lg border-l-2 px-3 py-1.5 transition-all ${
        isActive ? 'border-primary bg-primary/10' : 'border-transparent hover:bg-slate-100 dark:hover:bg-slate-800'
      }`}
    >
      <div className="flex min-w-0 items-center overflow-hidden pr-2">
        {resource.type === 'note'
          ? <FileText size={14} className={`mr-2 flex-shrink-0 ${isActive ? 'text-primary' : 'text-slate-400'}`} />
          : <Paperclip size={14} className={`mr-2 flex-shrink-0 ${isActive ? 'text-primary' : 'text-slate-400'}`} />}
        <span className={`truncate text-[13px] ${isActive ? 'font-medium text-primary' : ''}`}>{resource.title}</span>
      </div>
      <button onClick={onDelete} className="flex-shrink-0 p-0.5 text-slate-400 opacity-0 transition-opacity hover:text-red-500 group-hover:opacity-100"><Trash2 size={12} /></button>
    </div>
  );
}
