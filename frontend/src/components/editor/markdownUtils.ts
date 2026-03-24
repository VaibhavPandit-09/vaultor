/**  
 * Markdown → Tiptap JSON and Tiptap JSON → Markdown conversion utilities
 */

interface TiptapNode {
  type: string;
  attrs?: Record<string, any>;
  content?: TiptapNode[];
  text?: string;
  marks?: Array<{ type: string; attrs?: Record<string, any> }>;
}

/** Parse a raw markdown string into Tiptap-compatible JSON doc */
export function markdownToTiptap(md: string): TiptapNode {
  const lines = md.split('\n');
  const nodes: TiptapNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Code block
    if (line.startsWith('```')) {
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing ```
      nodes.push({
        type: 'codeBlock',
        content: [{ type: 'text', text: codeLines.join('\n') }],
      });
      continue;
    }

    // Heading
    const headingMatch = line.match(/^(#{1,3})\s+(.*)/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      nodes.push({
        type: 'heading',
        attrs: { level },
        content: parseInline(headingMatch[2]),
      });
      i++;
      continue;
    }

    // Blockquote
    if (line.startsWith('> ')) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].startsWith('> ')) {
        quoteLines.push(lines[i].slice(2));
        i++;
      }
      nodes.push({
        type: 'blockquote',
        content: quoteLines.map(ql => ({
          type: 'paragraph',
          content: parseInline(ql),
        })),
      });
      continue;
    }

    // Bullet list
    if (/^[-*]\s+/.test(line)) {
      const items: TiptapNode[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i])) {
        items.push({
          type: 'listItem',
          content: [{
            type: 'paragraph',
            content: parseInline(lines[i].replace(/^[-*]\s+/, '')),
          }],
        });
        i++;
      }
      nodes.push({ type: 'bulletList', content: items });
      continue;
    }

    // Ordered list
    if (/^\d+\.\s+/.test(line)) {
      const items: TiptapNode[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
        items.push({
          type: 'listItem',
          content: [{
            type: 'paragraph',
            content: parseInline(lines[i].replace(/^\d+\.\s+/, '')),
          }],
        });
        i++;
      }
      nodes.push({ type: 'orderedList', content: items });
      continue;
    }

    // Empty line
    if (line.trim() === '') {
      i++;
      continue;
    }

    // Paragraph
    nodes.push({
      type: 'paragraph',
      content: parseInline(line),
    });
    i++;
  }

  if (nodes.length === 0) {
    nodes.push({ type: 'paragraph' });
  }

  return { type: 'doc', content: nodes };
}

function parseInline(text: string): TiptapNode[] {
  if (!text) return [];

  const result: TiptapNode[] = [];
  // Simple inline parsing for bold, italic, code, strikethrough
  const regex = /(\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`|~~(.+?)~~)/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      result.push({ type: 'text', text: text.slice(lastIndex, match.index) });
    }

    if (match[2]) {
      // Bold + Italic
      result.push({
        type: 'text',
        text: match[2],
        marks: [{ type: 'bold' }, { type: 'italic' }],
      });
    } else if (match[3]) {
      // Bold
      result.push({
        type: 'text',
        text: match[3],
        marks: [{ type: 'bold' }],
      });
    } else if (match[4]) {
      // Italic
      result.push({
        type: 'text',
        text: match[4],
        marks: [{ type: 'italic' }],
      });
    } else if (match[5]) {
      // Code
      result.push({
        type: 'text',
        text: match[5],
        marks: [{ type: 'code' }],
      });
    } else if (match[6]) {
      // Strikethrough
      result.push({
        type: 'text',
        text: match[6],
        marks: [{ type: 'strike' }],
      });
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    result.push({ type: 'text', text: text.slice(lastIndex) });
  }

  return result.length > 0 ? result : [{ type: 'text', text }];
}

/** Convert Tiptap JSON doc back to markdown string */
export function tiptapToMarkdown(doc: TiptapNode): string {
  if (!doc.content) return '';
  return doc.content.map(node => nodeToMarkdown(node)).join('\n\n');
}

function nodeToMarkdown(node: TiptapNode): string {
  switch (node.type) {
    case 'heading': {
      const level = node.attrs?.level || 1;
      const prefix = '#'.repeat(level);
      return `${prefix} ${inlineToMarkdown(node.content)}`;
    }
    case 'paragraph':
      return inlineToMarkdown(node.content);
    case 'bulletList':
      return (node.content || [])
        .map(item => `- ${inlineToMarkdown(item.content?.[0]?.content)}`)
        .join('\n');
    case 'orderedList':
      return (node.content || [])
        .map((item, i) => `${i + 1}. ${inlineToMarkdown(item.content?.[0]?.content)}`)
        .join('\n');
    case 'codeBlock':
      return '```\n' + (node.content?.[0]?.text || '') + '\n```';
    case 'blockquote':
      return (node.content || [])
        .map(p => `> ${inlineToMarkdown(p.content)}`)
        .join('\n');
    default:
      return inlineToMarkdown(node.content);
  }
}

function inlineToMarkdown(content?: TiptapNode[]): string {
  if (!content) return '';
  return content.map(node => {
    let text = node.text || '';
    if (node.marks) {
      for (const mark of node.marks) {
        switch (mark.type) {
          case 'bold': text = `**${text}**`; break;
          case 'italic': text = `*${text}*`; break;
          case 'code': text = `\`${text}\``; break;
          case 'strike': text = `~~${text}~~`; break;
        }
      }
    }
    return text;
  }).join('');
}
