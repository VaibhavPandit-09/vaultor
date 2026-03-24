import { useRef, useState, useEffect, useCallback } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { common, createLowlight } from 'lowlight';
import { SlashCommandExtension, slashCommandPluginKey } from './SlashCommandExtension';
import type { SlashCommandState } from './SlashCommandExtension';
import SlashMenu, { getItems } from './SlashMenu';
import { markdownToHtml } from './markdownUtils';

const lowlight = createLowlight(common);

interface BlockEditorProps {
  content: any;
  onUpdate: (json: any) => void;
}

export default function BlockEditor({ content, onUpdate }: BlockEditorProps) {
  const [slashState, setSlashState] = useState<SlashCommandState | null>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const updateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mdInputRef = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: false,
        heading: { levels: [1, 2, 3] },
      }),
      CodeBlockLowlight.configure({ lowlight }),
      Placeholder.configure({
        placeholder: ({ node }) => {
          if (node.type.name === 'heading') {
            return `Heading ${node.attrs.level}`;
          }
          return "Type '/' for commands...";
        },
      }),
      SlashCommandExtension,
    ],
    content: parseInitialContent(content),
    editorProps: {
      attributes: {
        class: 'tiptap outline-none min-h-[50vh]',
      },
      handlePaste: (view, event) => {
        const text = event.clipboardData?.getData('text/plain');
        if (text && looksLikeMarkdown(text)) {
          event.preventDefault();
          const html = markdownToHtml(text);
          view.pasteHTML(html);
          return true;
        }
        return false;
      },
    },
    onUpdate: ({ editor: ed }) => {
      if (updateTimeoutRef.current) clearTimeout(updateTimeoutRef.current);
      updateTimeoutRef.current = setTimeout(() => {
        onUpdate(ed.getJSON());
      }, 300);
    },
  });

  // React to ProseMirror state changes for slash menu
  useEffect(() => {
    if (!editor) return;

    const handleTransaction = () => {
      const state = slashCommandPluginKey.getState(editor.state) as SlashCommandState | undefined;
      if (!state) return;

      if (state.active) {
        // Get filtered list to compute index bounds
        const items = getItems(() => {});
        const filtered = items.filter(item =>
          item.title.toLowerCase().includes(state.query.toLowerCase()) ||
          item.command.toLowerCase().includes(state.query.toLowerCase())
        );

        // Handle navigation signals from the plugin
        if (state.navigateDirection === 'down') {
          setSelectedIndex(prev => (prev + 1) % Math.max(filtered.length, 1));
        } else if (state.navigateDirection === 'up') {
          setSelectedIndex(prev => (prev - 1 + filtered.length) % Math.max(filtered.length, 1));
        }

        // Handle selection execution
        if (state.executeSelection) {
          // We need to execute from the current selectedIndex
          const item = filtered[selectedIndex >= filtered.length ? 0 : selectedIndex];
          if (item && state.range) {
            item.action(editor, state.range);
            closeSlash();
            return;
          }
        }

        setSlashState(state);

        // Position the menu
        const { from } = editor.state.selection;
        const coords = editor.view.coordsAtPos(from);
        const containerRect = editorContainerRef.current?.getBoundingClientRect();
        if (containerRect) {
          setMenuPos({
            top: coords.bottom - containerRect.top + 8,
            left: coords.left - containerRect.left,
          });
        }
      } else {
        if (slashState?.active) {
          setSlashState(null);
          setMenuPos(null);
          setSelectedIndex(0);
        }
      }
    };

    editor.on('transaction', handleTransaction);
    return () => { editor.off('transaction', handleTransaction); };
  }, [editor, slashState, selectedIndex]);

  // Reset selected index when query changes
  useEffect(() => {
    if (slashState?.query !== undefined) {
      setSelectedIndex(0);
    }
  }, [slashState?.query]);

  // Sync content when note changes externally
  useEffect(() => {
    if (editor && content) {
      const parsed = parseInitialContent(content);
      const current = JSON.stringify(editor.getJSON());
      const incoming = JSON.stringify(parsed);
      if (current !== incoming) {
        editor.commands.setContent(parsed);
      }
    }
  }, [content, editor]);

  const closeSlash = useCallback(() => {
    if (editor) {
      const tr = editor.state.tr;
      tr.setMeta(slashCommandPluginKey, {
        active: false,
        query: '',
        range: null,
        selectedIndex: 0,
        filteredCount: 0,
        executeSelection: false,
        navigateDirection: null,
      });
      editor.view.dispatch(tr);
    }
    setSlashState(null);
    setMenuPos(null);
    setSelectedIndex(0);
  }, [editor]);

  const handleUploadMd = useCallback(() => {
    mdInputRef.current?.click();
  }, []);

  const handleMdFileSelected = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0] || !editor) return;
    const file = e.target.files[0];
    const text = await file.text();
    const html = markdownToHtml(text);
    editor.chain().focus().insertContent(html).run();
    if (mdInputRef.current) mdInputRef.current.value = '';
  }, [editor]);

  const handleSlashSelect = useCallback((index: number) => {
    if (!slashState?.range || !editor) return;
    const items = getItems(handleUploadMd);
    const filtered = items.filter(item =>
      item.title.toLowerCase().includes((slashState.query || '').toLowerCase()) ||
      item.command.toLowerCase().includes((slashState.query || '').toLowerCase())
    );
    const item = filtered[index];
    if (item) {
      item.action(editor, slashState.range);
      closeSlash();
    }
  }, [editor, slashState, closeSlash, handleUploadMd]);

  if (!editor) return null;

  return (
    <div ref={editorContainerRef} className="relative w-full">
      <EditorContent editor={editor} />

      {/* Hidden input for .md file upload */}
      <input
        type="file"
        ref={mdInputRef}
        className="hidden"
        accept=".md,.markdown,.txt"
        onChange={handleMdFileSelected}
      />

      {slashState?.active && menuPos && slashState.range && (
        <div
          className="absolute z-50"
          style={{ top: menuPos.top, left: menuPos.left }}
        >
          <SlashMenu
            editor={editor}
            range={slashState.range}
            query={slashState.query}
            selectedIndex={selectedIndex}
            onSelectItem={handleSlashSelect}
            onClose={closeSlash}
            onUploadMd={handleUploadMd}
          />
        </div>
      )}
    </div>
  );
}

function parseInitialContent(content: any): any {
  if (!content) return { type: 'doc', content: [{ type: 'paragraph' }] };

  // Already Tiptap JSON
  if (typeof content === 'object' && content.type === 'doc') {
    return content;
  }

  // JSON string of Tiptap doc
  if (typeof content === 'string') {
    try {
      const parsed = JSON.parse(content);
      if (parsed.type === 'doc') return parsed;
    } catch {
      // Fallback: treat as raw markdown → convert via HTML
    }
    // Legacy raw markdown content
    const html = markdownToHtml(content);
    return html; // Tiptap can accept HTML strings
  }

  return { type: 'doc', content: [{ type: 'paragraph' }] };
}

function looksLikeMarkdown(text: string): boolean {
  const mdPatterns = [
    /^#{1,6}\s/m,
    /^[-*]\s/m,
    /^\d+\.\s/m,
    /^>\s/m,
    /^```/m,
    /\*\*.+\*\*/,
    /\[.+\]\(.+\)/,
  ];
  let hits = 0;
  for (const p of mdPatterns) {
    if (p.test(text)) hits++;
  }
  return hits >= 1;
}
