import { useState, useEffect, useCallback, useRef } from 'react';
import { Editor } from '@tiptap/react';
import type { Range } from '@tiptap/react';
import {
  Type, Heading1, Heading2, Heading3,
  List, ListOrdered, Code, Quote
} from 'lucide-react';

interface SlashMenuItem {
  title: string;
  command: string;
  icon: React.ReactNode;
  action: (editor: Editor, range: Range) => void;
}

const ITEMS: SlashMenuItem[] = [
  {
    title: 'Text',
    command: 'text',
    icon: <Type size={18} />,
    action: (editor, range) => {
      editor.chain().focus().deleteRange(range).setParagraph().run();
    },
  },
  {
    title: 'Heading 1',
    command: 'h1',
    icon: <Heading1 size={18} />,
    action: (editor, range) => {
      editor.chain().focus().deleteRange(range).setHeading({ level: 1 }).run();
    },
  },
  {
    title: 'Heading 2',
    command: 'h2',
    icon: <Heading2 size={18} />,
    action: (editor, range) => {
      editor.chain().focus().deleteRange(range).setHeading({ level: 2 }).run();
    },
  },
  {
    title: 'Heading 3',
    command: 'h3',
    icon: <Heading3 size={18} />,
    action: (editor, range) => {
      editor.chain().focus().deleteRange(range).setHeading({ level: 3 }).run();
    },
  },
  {
    title: 'Bullet List',
    command: 'bullet',
    icon: <List size={18} />,
    action: (editor, range) => {
      editor.chain().focus().deleteRange(range).toggleBulletList().run();
    },
  },
  {
    title: 'Numbered List',
    command: 'numbered',
    icon: <ListOrdered size={18} />,
    action: (editor, range) => {
      editor.chain().focus().deleteRange(range).toggleOrderedList().run();
    },
  },
  {
    title: 'Code Block',
    command: 'code',
    icon: <Code size={18} />,
    action: (editor, range) => {
      editor.chain().focus().deleteRange(range).toggleCodeBlock().run();
    },
  },
  {
    title: 'Quote',
    command: 'quote',
    icon: <Quote size={18} />,
    action: (editor, range) => {
      editor.chain().focus().deleteRange(range).toggleBlockquote().run();
    },
  },
];

interface SlashMenuProps {
  editor: Editor;
  range: Range;
  query: string;
  onClose: () => void;
}

export default function SlashMenu({ editor, range, query, onClose }: SlashMenuProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);

  const filtered = ITEMS.filter(item =>
    item.title.toLowerCase().includes(query.toLowerCase()) ||
    item.command.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const selectItem = useCallback((index: number) => {
    const item = filtered[index];
    if (item) {
      item.action(editor, range);
      onClose();
    }
  }, [filtered, editor, range, onClose]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + filtered.length) % filtered.length);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % filtered.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        selectItem(selectedIndex);
      } else if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [filtered.length, selectedIndex, selectItem, onClose]);

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
      className="bg-card border border-border rounded-xl shadow-2xl overflow-hidden w-56 max-h-64 overflow-y-auto"
    >
      <div className="p-1.5">
        {filtered.map((item, index) => (
          <button
            key={item.command}
            data-selected={index === selectedIndex}
            onClick={() => selectItem(index)}
            className={`flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm transition-colors ${
              index === selectedIndex
                ? 'bg-primary/10 text-primary'
                : 'text-foreground hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <span className="opacity-70">{item.icon}</span>
            <span className="font-medium">{item.title}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export { ITEMS };
export type { SlashMenuItem };
