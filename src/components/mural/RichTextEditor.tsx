import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Color } from '@tiptap/extension-color';
import { TextStyle } from '@tiptap/extension-text-style';
import { Link } from '@tiptap/extension-link';
import { Underline } from '@tiptap/extension-underline';
import { Highlight } from '@tiptap/extension-highlight';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { Image as TiptapImage } from '@tiptap/extension-image';
import { Toggle } from '@/components/ui/toggle';
import { Bold, Italic, Underline as UnderlineIcon, Link as LinkIcon, List, Table as TableIcon } from 'lucide-react';

export const RichTextEditor = ({ content, onChange }: { content: string, onChange: (html: string) => void }) => {
  const editor = useEditor({
    immediatelyRender: false,
    shouldRerenderOnTransaction: false,
    extensions: [
      StarterKit,
      TextStyle,
      Color,
      Link.configure({ 
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-primary underline cursor-pointer',
        },
      }),
      Underline,
      Highlight,
      Table.configure({ resizable: true }),
      TableRow,
      TableCell,
      TableHeader,
      TiptapImage,
    ],
    content,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      if (html !== content) {
        onChange(html);
      }
    },
  });

  if (!editor) return null;

  return (
    <div className="border rounded-md p-2 bg-background">
      <div className="flex flex-wrap gap-1 border-b pb-2 mb-2 sticky top-0 bg-background z-10">
        <Toggle size="sm" pressed={editor.isActive('bold')} onPressedChange={() => editor.chain().focus().toggleBold().run()}>
          <Bold className="h-4 w-4" />
        </Toggle>
        <Toggle size="sm" pressed={editor.isActive('italic')} onPressedChange={() => editor.chain().focus().toggleItalic().run()}>
          <Italic className="h-4 w-4" />
        </Toggle>
        <Toggle size="sm" pressed={editor.isActive('underline')} onPressedChange={() => editor.chain().focus().toggleUnderline().run()}>
          <UnderlineIcon className="h-4 w-4" />
        </Toggle>
        <Toggle size="sm" pressed={editor.isActive('bulletList')} onPressedChange={() => editor.chain().focus().toggleBulletList().run()}>
          <List className="h-4 w-4" />
        </Toggle>
        <Toggle size="sm" pressed={editor.isActive('table')} onPressedChange={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}>
          <TableIcon className="h-4 w-4" />
        </Toggle>
      </div>
      <EditorContent editor={editor} className="min-h-[200px] max-h-[400px] overflow-y-auto p-2 focus:outline-none prose prose-sm dark:prose-invert max-w-none" />
    </div>
  );
};
