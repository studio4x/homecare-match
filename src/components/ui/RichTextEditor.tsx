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
  RotateCcw,
  Type,
  Code
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface RichTextEditorProps {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
}

const ToolbarButton = ({ 
  onClick, 
  isActive = false, 
  children, 
  title 
}: { 
  onClick: () => void; 
  isActive?: boolean; 
  children: React.ReactNode;
  title: string;
}) => (
  <Button
    type="button"
    variant="ghost"
    size="sm"
    onClick={onClick}
    title={title}
    className={cn(
      "h-8 w-8 p-0 hover:bg-muted",
      isActive && "bg-muted text-primary font-bold shadow-sm"
    )}
  >
    {children}
  </Button>
);

const RichTextEditor = ({ content, onChange, placeholder }: RichTextEditorProps) => {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        bulletList: { keepMarks: true, keepAttributes: false },
        orderedList: { keepMarks: true, keepAttributes: false },
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-primary underline cursor-pointer',
        },
      }),
      Placeholder.configure({
        placeholder: placeholder || "Comece a escrever...",
      }),
    ],
    content: content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: "prose prose-sm max-w-none focus:outline-none min-h-[200px] px-4 py-3 bg-background rounded-b-md border-t-0",
      },
    },
  });

  if (!editor) return null;

  const addLink = () => {
    const url = window.prompt("Insira a URL:");
    if (url) {
      editor.chain().focus().setLink({ href: url }).run();
    }
  };

  return (
    <div className="flex flex-col w-full rounded-md border border-input shadow-sm overflow-hidden border-t-4 border-t-muted">
      {/* Toolbar Estilo WordPress */}
      <div className="flex flex-wrap items-center gap-1 p-1 bg-muted/40 border-b">
        <ToolbarButton 
          title="Negrito"
          onClick={() => editor.chain().focus().toggleBold().run()} 
          isActive={editor.isActive("bold")}
        >
          <Bold size={16} />
        </ToolbarButton>
        
        <ToolbarButton 
          title="Itálico"
          onClick={() => editor.chain().focus().toggleItalic().run()} 
          isActive={editor.isActive("italic")}
        >
          <Italic size={16} />
        </ToolbarButton>

        <ToolbarButton 
          title="Sublinhado"
          onClick={() => editor.chain().focus().toggleUnderline().run()} 
          isActive={editor.isActive("underline")}
        >
          <UnderlineIcon size={16} />
        </ToolbarButton>

        <div className="w-px h-6 bg-border mx-1" />

        <ToolbarButton 
          title="Lista com Marcadores"
          onClick={() => editor.chain().focus().toggleBulletList().run()} 
          isActive={editor.isActive("bulletList")}
        >
          <List size={16} />
        </ToolbarButton>

        <ToolbarButton 
          title="Lista Numerada"
          onClick={() => editor.chain().focus().toggleOrderedList().run()} 
          isActive={editor.isActive("orderedList")}
        >
          <ListOrdered size={16} />
        </ToolbarButton>

        <div className="w-px h-6 bg-border mx-1" />

        <ToolbarButton 
          title="Inserir Link"
          onClick={addLink} 
          isActive={editor.isActive("link")}
        >
          <LinkIcon size={16} />
        </ToolbarButton>

        <ToolbarButton 
          title="Remover Link"
          onClick={() => editor.chain().focus().unsetLink().run()}
        >
          <Unlink size={16} />
        </ToolbarButton>

        <div className="w-px h-6 bg-border mx-1" />

        <ToolbarButton 
          title="Citação"
          onClick={() => editor.chain().focus().toggleBlockquote().run()} 
          isActive={editor.isActive("blockquote")}
        >
          <Type size={16} />
        </ToolbarButton>

        <ToolbarButton 
          title="Limpar Formatação"
          onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
        >
          <RotateCcw size={16} />
        </ToolbarButton>
      </div>

      {/* Área de Edição */}
      <EditorContent editor={editor} />
      
      {/* Barra de Status */}
      <div className="bg-muted/20 px-3 py-1 border-t text-[10px] text-muted-foreground flex justify-between items-center">
        <span>Tiptap Editor (Estilo Clássico)</span>
        <span>{editor.storage.characterCount?.characters?.() || 0} caracteres</span>
      </div>
    </div>
  );
};

export default RichTextEditor;