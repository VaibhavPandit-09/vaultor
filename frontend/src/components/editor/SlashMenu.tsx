import { useRef, useEffect, useCallback } from 'react';
import { Editor } from '@tiptap/react';
import type { Range } from '@tiptap/react';
import {
  Type, Heading1, Heading2, Heading3,
  List, ListOrdered, Code, Quote, FileUp
} from 'lucide-react';


interface SlashMenuItem {
  title: string;
  command: string;
  description: string;
  icon: React.ReactNode;
  action: (editor: Editor, range: Range) => void;
}

const getItems = (onUploadMd: () => void): SlashMenuItem[] => [
  {
    title: 'Text',
    command: 'text',
    description: 'Plain text block',
    icon: <Type size={18} />,
    action: (editor, range) => {
      editor.chain().focus().deleteRange(range).setParagraph().run();
    },
  },
  {
    title: 'Heading 1',
    command: 'h1',
    description: 'Large section heading',
    icon: <Heading1 size={18} />,
    action: (editor, range) => {
      editor.chain().focus().deleteRange(range).setHeading({ level: 1 }).run();
    },
  },
  {
    title: 'Heading 2',
    command: 'h2',
    description: 'Medium section heading',
    icon: <Heading2 size={18} />,
    action: (editor, range) => {
      editor.chain().focus().deleteRange(range).setHeading({ level: 2 }).run();
    },
  },
  {
    title: 'Heading 3',
    command: 'h3',
    description: 'Small section heading',
    icon: <Heading3 size={18} />,
    action: (editor, range) => {
      editor.chain().focus().deleteRange(range).setHeading({ level: 3 }).run();
    },
  },
  {
    title: 'Bullet List',
    command: 'bullet',
    description: 'Unordered list',
    icon: <List size={18} />,
    action: (editor, range) => {
      editor.chain().focus().deleteRange(range).toggleBulletList().run();
    },
  },
  {
    title: 'Numbered List',
    command: 'numbered',
    description: 'Ordered list',
    icon: <ListOrdered size={18} />,
    action: (editor, range) => {
      editor.chain().focus().deleteRange(range).toggleOrderedList().run();
    },
  },
  {
    title: 'Code Block',
    command: 'code',
    description: 'Syntax-highlighted code',
    icon: <Code size={18} />,
    action: (editor, range) => {
      editor.chain().focus().deleteRange(range).toggleCodeBlock().run();
    },
  },
  {
    title: 'Quote',
    command: 'quote',
    description: 'Blockquote',
    icon: <Quote size={18} />,
    action: (editor, range) => {
      editor.chain().focus().deleteRange(range).toggleBlockquote().run();
    },
  },
  {
    title: 'Upload Markdown',
    command: 'upload',
    description: 'Import a .md file',
    icon: <FileUp size={18} />,
    action: (editor, range) => {
      editor.chain().focus().deleteRange(range).run();
      onUploadMd();
    },
  },
];

interface SlashMenuProps {
  editor: Editor;
  range: Range;
  query: string;
  selectedIndex: number;
  onSelectItem: (index: number) => void;
  onClose: () => void;
  onUploadMd: () => void;
}

export default function SlashMenu({ editor, range, query, selectedIndex, onClose, onUploadMd }: SlashMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  const items = getItems(onUploadMd);

  const filtered = items.filter(item =>
    item.title.toLowerCase().includes(query.toLowerCase()) ||
    item.command.toLowerCase().includes(query.toLowerCase())
  );

  const selectItem = useCallback((index: number) => {
    const item = filtered[index];
    if (item) {
      item.action(editor, range);
      onClose();
    }
  }, [filtered, editor, range, onClose]);

  // Expose selectItem via onSelectItem callback
  useEffect(() => {
    // This is called when the parent detects executeSelection signal
  }, []);

  // Scroll selected into view
  useEffect(() => {
    const selected = menuRef.current?.querySelector('[data-selected="true"]');
    selected?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  if (filtered.length === 0) {
    return (
      <div className="bg-card border border-border rounded-xl shadow-2xl p-3 text-sm text-slate-500">
        No results
      </div>
    );
  }

  return (
    <div
      ref={menuRef}
      className="bg-card border border-border rounded-xl shadow-2xl overflow-hidden w-64 max-h-72 overflow-y-auto"
    >
      <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400 border-b border-border">
        Blocks
      </div>
      <div className="p-1.5">
        {filtered.map((item, index) => (
          <button
            key={item.command}
            data-selected={index === selectedIndex}
            onClick={() => selectItem(index)}
            className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm transition-colors ${
              index === selectedIndex
                ? 'bg-primary/10 text-primary'
                : 'text-foreground hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <span className={`p-1.5 rounded-lg ${index === selectedIndex ? 'bg-primary/20' : 'bg-slate-100 dark:bg-slate-800'}`}>
              {item.icon}
            </span>
            <div className="text-left">
              <div className="font-medium">{item.title}</div>
              <div className="text-[11px] text-slate-400">{item.description}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

export { getItems };
export type { SlashMenuItem };
