import { useRef, useState, useEffect, useCallback } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { common, createLowlight } from 'lowlight';
import { SlashCommandExtension, slashCommandPluginKey } from './SlashCommandExtension';
import type { SlashCommandState } from './SlashCommandExtension';
import SlashMenu from './SlashMenu';
import { markdownToTiptap } from './markdownUtils';

const lowlight = createLowlight(common);

interface BlockEditorProps {
  content: any; // JSON or string
  onUpdate: (json: any) => void;
}

export default function BlockEditor({ content, onUpdate }: BlockEditorProps) {
  const [slashState, setSlashState] = useState<SlashCommandState | null>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const updateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
        class: 'outline-none min-h-[50vh] prose prose-slate dark:prose-invert max-w-none prose-headings:font-bold prose-h1:text-3xl prose-h2:text-2xl prose-h3:text-xl prose-p:leading-relaxed prose-code:bg-slate-100 dark:prose-code:bg-slate-800 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-pre:bg-slate-900 dark:prose-pre:bg-slate-950 prose-pre:text-slate-100 prose-blockquote:border-l-primary prose-blockquote:border-l-4 prose-blockquote:pl-4 prose-blockquote:italic prose-blockquote:text-slate-600 dark:prose-blockquote:text-slate-400',
      },
      handlePaste: (view, event) => {
        const text = event.clipboardData?.getData('text/plain');
        if (text && looksLikeMarkdown(text)) {
          event.preventDefault();
          const tiptapDoc = markdownToTiptap(text);
          if (tiptapDoc.content) {
            const { state } = view;
            const { from, to } = state.selection;
            const nodes = tiptapDoc.content.map(node =>
              state.schema.nodeFromJSON(node)
            );
            let tr = state.tr.deleteRange(from, to);
            nodes.reverse().forEach(node => {
              tr = tr.replaceSelectionWith(node);
            });
            view.dispatch(tr);
          }
          return true;
        }
        return false;
      },
    },
    onUpdate: ({ editor }) => {
      if (updateTimeoutRef.current) clearTimeout(updateTimeoutRef.current);
      updateTimeoutRef.current = setTimeout(() => {
        onUpdate(editor.getJSON());
      }, 300);
    },
    onTransaction: ({ editor: ed }) => {
      const state = slashCommandPluginKey.getState(ed.state) as SlashCommandState | undefined;
      if (state?.active) {
        setSlashState(state);
        // Position menu near cursor
        const { from } = ed.state.selection;
        const coords = ed.view.coordsAtPos(from);
        const containerRect = editorContainerRef.current?.getBoundingClientRect();
        if (containerRect) {
          setMenuPos({
            top: coords.bottom - containerRect.top + 8,
            left: coords.left - containerRect.left,
          });
        }
      } else {
        setSlashState(null);
        setMenuPos(null);
      }
    },
  });

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
      });
      editor.view.dispatch(tr);
    }
    setSlashState(null);
    setMenuPos(null);
  }, [editor]);

  if (!editor) return null;

  return (
    <div ref={editorContainerRef} className="relative w-full">
      <EditorContent editor={editor} />

      {slashState?.active && menuPos && slashState.range && (
        <div
          className="absolute z-50"
          style={{ top: menuPos.top, left: menuPos.left }}
        >
          <SlashMenu
            editor={editor}
            range={slashState.range}
            query={slashState.query}
            onClose={closeSlash}
          />
        </div>
      )}
    </div>
  );
}

function parseInitialContent(content: any): any {
  if (!content) return { type: 'doc', content: [{ type: 'paragraph' }] };

  // Already TipTap JSON
  if (typeof content === 'object' && content.type === 'doc') {
    return content;
  }

  // JSON string of TipTap doc
  if (typeof content === 'string') {
    try {
      const parsed = JSON.parse(content);
      if (parsed.type === 'doc') return parsed;
    } catch {
      // Fallback: treat as raw markdown
    }
    // Legacy raw markdown content
    return markdownToTiptap(content);
  }

  return { type: 'doc', content: [{ type: 'paragraph' }] };
}

function looksLikeMarkdown(text: string): boolean {
  const mdPatterns = [
    /^#{1,6}\s/m,    // headings
    /^[-*]\s/m,      // bullets
    /^\d+\.\s/m,     // numbered list
    /^>\s/m,         // blockquote
    /^```/m,         // code fence
    /\*\*.+\*\*/,    // bold
    /\*.+\*/,        // italic
  ];
  let hits = 0;
  for (const p of mdPatterns) {
    if (p.test(text)) hits++;
  }
  return hits >= 1;
}
