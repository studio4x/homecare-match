"use client";

import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Trash2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import RichTextEditor from '@/components/ui/RichTextEditor';

interface Lesson {
  id: string;
  title: string;
  type: "video" | "pdf" | "link" | "text";
  duration_minutes?: number;
  resource_url?: string;
  content?: string;
}

interface SortableLessonProps {
  lesson: Lesson;
  onUpdate: (data: Partial<Lesson>) => void;
  onRemove: () => void;
  onUploadClick: () => void;
  isUploading: boolean;
}

const SortableLesson = ({ 
  lesson, 
  onUpdate, 
  onRemove, 
  onUploadClick, 
  isUploading
}: SortableLessonProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: lesson.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 'auto',
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="border bg-card rounded-md p-3 space-y-3 shadow-sm relative group">
      <div className="flex items-center gap-2">
        <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing p-1 hover:bg-secondary rounded text-muted-foreground">
          <GripVertical size={16} />
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 flex-1">
          <div className="md:col-span-2">
            <Label className="text-[10px] uppercase font-bold text-muted-foreground">Título da Aula</Label>
            <Input 
              value={lesson.title} 
              onChange={e => onUpdate({ title: e.target.value })} 
              className="h-8 text-sm"
            />
          </div>
          <div>
            <Label className="text-[10px] uppercase font-bold text-muted-foreground">Tipo</Label>
            <Select value={lesson.type} onValueChange={v => onUpdate({ type: v as any })}>
              <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="video">Vídeo</SelectItem>
                <SelectItem value="pdf">PDF</SelectItem>
                <SelectItem value="text">Texto Rico</SelectItem>
                <SelectItem value="link">Link Externo</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[10px] uppercase font-bold text-muted-foreground">Minutos</Label>
            <Input 
              type="number" 
              value={lesson.duration_minutes} 
              onChange={e => onUpdate({ duration_minutes: parseInt(e.target.value) || 0 })} 
              className="h-8 text-sm"
            />
          </div>
        </div>
      </div>

      {lesson.type === 'text' ? (
        <div className="space-y-2 pl-7">
          <div className="flex items-center justify-between">
            <Label className="text-[10px] uppercase font-bold text-muted-foreground">Conteúdo da Aula</Label>
          </div>
          <RichTextEditor 
            content={lesson.content || ""} 
            onChange={html => { 
              onUpdate({ content: html });
            }} 
          />
        </div>
      ) : (
        <div className="space-y-2 pl-7">
          <Label className="text-[10px] uppercase font-bold text-muted-foreground">URL / Caminho</Label>
          <Input 
            value={lesson.resource_url} 
            onChange={e => onUpdate({ resource_url: e.target.value })} 
            placeholder="Link ou caminho do arquivo" 
            className="h-8 text-sm"
          />
        </div>
      )}

      <div className="flex justify-end gap-2 pl-7">
        <Button 
          variant="outline" 
          size="sm" 
          className="h-7 text-[10px]" 
          onClick={onUploadClick} 
          disabled={isUploading || lesson.type === "link" || lesson.type === "text"}
        >
          {isUploading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null} 
          Enviar Arquivo
        </Button>
        <Button 
          variant="ghost" 
          size="sm" 
          className="text-destructive h-7 text-[10px]" 
          onClick={onRemove}
        >
          <Trash2 className="h-3 w-3 mr-1" /> Remover Aula
        </Button>
      </div>
    </div>
  );
};

export default SortableLesson;