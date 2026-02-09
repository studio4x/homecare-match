"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { 
  Bold, 
  Italic, 
  Underline as UnderlineIcon, 
  List, 
  ListOrdered, 
  Link as LinkIcon, 
  Unlink,
  Heading1,
  Heading2,
  Quote
} from "lucide-react";
import { Button } from "./button";
import { cn } from "@/lib/utils";

interface RichTextEditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
  className?: string;
}

const RichTextEditor = ({ content, onChange, placeholder, className }: RichTextEditorProps) => {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Link.configure({
        openOnClick: false,
      }),
      Placeholder.configure({
        placeholder: placeholder || "Comece a escrever...",
      }),
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  if (!editor) return null;

  const toggleLink = () => {
    const previousUrl = editor.getAttributes("link").href;
    if (previousUrl) {
      editor.chain().focus().unsetLink().run();
      return;
    }
    const url = window.prompt("URL do link:", previousUrl);
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  };

  return (
    <div className={cn("rounded-md border border-input bg-background overflow-hidden", className)}>
      <div className="flex flex-wrap items-center gap-1 border-b bg-muted/50 p-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={cn("h-8 w-8", editor.isActive("bold") && "bg-muted text-primary")}
          type="button"
        >
          <Bold size={16} />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={cn("h-8 w-8", editor.isActive("italic") && "bg-muted text-primary")}
          type="button"
        >
          <Italic size={16} />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          className={cn("h-8 w-8", editor.isActive("underline") && "bg-muted text-primary")}
          type="button"
        >
          <UnderlineIcon size={16} />
        </Button>
        <div className="mx-1 h-4 w-px bg-border" />
        <Button
          variant="ghost"
          size="icon"
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          className={cn("h-8 w-8", editor.isActive("heading", { level: 1 }) && "bg-muted text-primary")}
          type="button"
        >
          <Heading1 size={16} />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={cn("h-8 w-8", editor.isActive("heading", { level: 2 }) && "bg-muted text-primary")}
          type="button"
        >
          <Heading2 size={16} />
        </Button>
        <div className="mx-1 h-4 w-px bg-border" />
        <Button
          variant="ghost"
          size="icon"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={cn("h-8 w-8", editor.isActive("bulletList") && "bg-muted text-primary")}
          type="button"
        >
          <List size={16} />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={cn("h-8 w-8", editor.isActive("orderedList") && "bg-muted text-primary")}
          type="button"
        >
          <ListOrdered size={16} />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          className={cn("h-8 w-8", editor.isActive("blockquote") && "bg-muted text-primary")}
          type="button"
        >
          <Quote size={16} />
        </Button>
        <div className="mx-1 h-4 w-px bg-border" />
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleLink}
          className={cn("h-8 w-8", editor.isActive("link") && "bg-muted text-primary")}
          type="button"
        >
          <LinkIcon size={16} />
        </Button>
      </div>
      <EditorContent editor={editor} className="prose prose-sm max-w-none p-3 focus:outline-none min-h-[150px]" />
    </div>
  );
};

export default RichTextEditor;