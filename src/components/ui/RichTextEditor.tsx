"use client";

import { useMemo, useState } from "react";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface RichTextEditorProps {
  content: string;
  onChange: (html: string) => void;
  className?: string;
  enableHtmlModeToggle?: boolean;
  showHeadingHints?: boolean;
}

const RichTextEditor = ({
  content,
  onChange,
  className,
  enableHtmlModeToggle = false,
  showHeadingHints = false,
}: RichTextEditorProps) => {
  const [htmlMode, setHtmlMode] = useState(false);

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

  const headingStats = useMemo(() => {
    const html = String(content || "");
    return {
      h1: (html.match(/<h1\b/gi) || []).length,
      h2: (html.match(/<h2\b/gi) || []).length,
      h3: (html.match(/<h3\b/gi) || []).length,
    };
  }, [content]);

  return (
    <div className={cn("rounded-md border bg-background", className)}>
      {(enableHtmlModeToggle || showHeadingHints) && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-muted/30 px-3 py-2">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {showHeadingHints && (
              <>
                <span className="font-medium text-foreground">Titulos:</span>
                <span className="rounded border border-border bg-background px-2 py-0.5">H1: {headingStats.h1}</span>
                <span className="rounded border border-border bg-background px-2 py-0.5">H2: {headingStats.h2}</span>
                <span className="rounded border border-border bg-background px-2 py-0.5">H3: {headingStats.h3}</span>
                <span>Use o seletor "Titulo" na barra para definir H1/H2/H3.</span>
              </>
            )}
          </div>
          {enableHtmlModeToggle && (
            <Button type="button" variant="outline" size="sm" onClick={() => setHtmlMode((prev) => !prev)}>
              {htmlMode ? "Voltar para editor visual" : "Visualizar/editar HTML"}
            </Button>
          )}
        </div>
      )}

      {htmlMode ? (
        <div className="p-3">
          <Textarea
            value={content || ""}
            onChange={(e) => onChange(e.target.value)}
            rows={18}
            className="min-h-[340px] font-mono text-xs"
            placeholder="<h1>Titulo principal</h1>"
          />
        </div>
      ) : (
        <ReactQuill
          theme="snow"
          value={content || ""}
          onChange={onChange}
          modules={modules}
          formats={formats}
          placeholder="Escreva o conteudo aqui..."
        />
      )}

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
