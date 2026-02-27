"use client";

import { useMemo } from "react";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import { cn } from "@/lib/utils";

interface RichTextEditorProps {
  content: string;
  onChange: (html: string) => void;
  className?: string;
}

const RichTextEditor = ({ content, onChange, className }: RichTextEditorProps) => {
  const modules = useMemo(
    () => ({
      toolbar: [
        [{ header: [1, 2, 3, false] }],
        [{ size: ["small", false, "large", "huge"] }],
        ["bold", "italic", "underline"],
        [{ list: "ordered" }, { list: "bullet" }],
        [{ align: [] }],
        ["link"],
        ["clean"],
      ],
    }),
    [],
  );

  const formats = useMemo(
    () => ["header", "size", "bold", "italic", "underline", "list", "bullet", "align", "link"],
    [],
  );

  return (
    <div className={cn("rounded-md border bg-background", className)}>
      <ReactQuill
        theme="snow"
        value={content || ""}
        onChange={onChange}
        modules={modules}
        formats={formats}
        placeholder="Escreva o conteudo aqui..."
      />

      <style>{`
        .ql-toolbar.ql-snow {
          border: 0;
          border-bottom: 1px solid hsl(var(--border));
          background: hsl(var(--muted) / 0.3);
          border-top-left-radius: 0.375rem;
          border-top-right-radius: 0.375rem;
        }
        .ql-container.ql-snow {
          border: 0;
          border-bottom-left-radius: 0.375rem;
          border-bottom-right-radius: 0.375rem;
          font-size: 0.95rem;
        }
        .ql-editor {
          min-height: 200px;
          color: hsl(var(--foreground));
        }
      `}</style>
    </div>
  );
};

export default RichTextEditor;