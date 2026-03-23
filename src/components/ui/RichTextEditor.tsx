import { useMemo, useState } from "react";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import { Button } from "@/components/ui/button";
import { Code, Eye, EyeOff, Heading1, Heading2, Heading3, List, ListOrdered, Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight, Link as LinkIcon, Palette, Highlighter, Minus, Plus } from "lucide-react";
import { Toggle } from "@/components/ui/toggle";
import { cn } from "@/lib/utils";

interface RichTextEditorProps {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
  enableHtmlModeToggle?: boolean;
  showHeadingHints?: boolean;
}

const modules = {
  toolbar: [
    [{ 'header': [1, 2, 3, 4, 5, 6, false] }],
    ['bold', 'italic', 'underline', 'strike'],
    [{ 'list': 'ordered' }, { 'list': 'bullet' }],
    [{ 'align': [] }],
    ['link', 'image', 'video'],
    ['clean']
  ],
};

const formats = [
  'header',
  'bold', 'italic', 'underline', 'strike',
  'list', 'bullet', 'indent',
  'align',
  'link', 'image', 'video'
];

const RichTextEditor = ({ content, onChange, placeholder, className, enableHtmlModeToggle = false, showHeadingHints = false }: RichTextEditorProps) => {
  const [htmlMode, setHtmlMode] = useState(false);
  const [htmlContent, setHtmlContent] = useState(content);

  // Sync internal state with prop changes
  useMemo(() => {
    setHtmlContent(content);
  }, [content]);

  const handleEditorChange = (value: string) => {
    setHtmlContent(value);
    onChange(value);
  };

  const handleHtmlChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setHtmlContent(e.target.value);
    onChange(e.target.value);
  };

  return (
    <div className={cn("relative", className)}>
      {enableHtmlModeToggle && (
        <div className="flex justify-end mb-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setHtmlMode(!htmlMode)}
            className="gap-2 text-xs h-8"
          >
            {htmlMode ? <Eye className="h-3 w-3" /> : <Code className="h-3 w-3" />}
            {htmlMode ? "Visualizar" : "Editar HTML"}
          </Button>
        </div>
      )}

      {htmlMode ? (
        <textarea
          value={htmlContent}
          onChange={handleHtmlChange}
          className="w-full min-h-[300px] p-3 border rounded-md font-mono text-xs bg-background"
          placeholder="Edite o HTML aqui..."
        />
      ) : (
        <ReactQuill
          theme="snow"
          value={htmlContent}
          onChange={handleEditorChange}
          modules={modules}
          formats={formats}
          placeholder={placeholder}
          className="min-h-[300px]"
        />
      )}

      {showHeadingHints && (
        <div className="mt-2 text-xs text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
          <span>Dica: Use H2 para seções principais, H3 para subseções.</span>
          <span>Não use H1 no conteúdo (o título da página já é H1).</span>
        </div>
      )}
    </div>
  );
};

export default RichTextEditor;