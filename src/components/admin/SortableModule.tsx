"use client";

import React from 'react';
import { useSortable, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Trash2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import SortableLesson from './SortableLesson';

interface Lesson {
  id: string;
  title: string;
  type: "video" | "pdf" | "link" | "text";
  duration_minutes?: number;
  resource_url?: string;
  content?: string;
}

interface Module {
  id: string;
  title: string;
  description?: string;
  lessons: Lesson[];
}

interface SortableModuleProps {
  module: Module;
  onUpdateTitle: (title: string) => void;
  onRemove: () => void;
  onAddLesson: () => void;
  onUpdateLesson: (li: number, data: Partial<Lesson>) => void;
  onRemoveLesson: (li: number) => void;
  onUploadClick: (li: number) => void;
  uploadingLessonId: string | null;
  estimateTextDuration: (html: string) => number;
}

const SortableModule = ({
  module,
  onUpdateTitle,
  onRemove,
  onAddLesson,
  onUpdateLesson,
  onRemoveLesson,
  onUploadClick,
  uploadingLessonId,
  estimateTextDuration
}: SortableModuleProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: module.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 40 : 'auto',
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="border rounded-lg p-4 space-y-4 bg-muted/20 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1">
          <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing p-1 hover:bg-secondary rounded text-muted-foreground">
            <GripVertical size={20} />
          </div>
          <Input 
            className="max-w-xs font-semibold bg-background" 
            value={module.title} 
            onChange={e => onUpdateTitle(e.target.value)} 
          />
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={onAddLesson}>
            <Plus size={14} className="mr-1" /> Aula
          </Button>
          <Button variant="ghost" size="sm" className="text-destructive" onClick={onRemove}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="space-y-3 pl-4 border-l-2 border-primary/10">
        <SortableContext items={module.lessons.map(l => l.id)} strategy={verticalListSortingStrategy}>
          {module.lessons.map((l, li) => (
            <SortableLesson
              key={l.id}
              lesson={l}
              onUpdate={(data) => onUpdateLesson(li, data)}
              onRemove={() => onRemoveLesson(li)}
              onUploadClick={() => onUploadClick(li)}
              isUploading={uploadingLessonId === l.id}
              estimateTextDuration={estimateTextDuration}
            />
          ))}
        </SortableContext>

        <div className="pt-2 flex justify-center">
          <Button 
            variant="outline" 
            size="sm" 
            className="w-full max-w-xs gap-2 border-dashed bg-background/50" 
            onClick={onAddLesson}
          >
            <Plus size={14} /> Adicionar Aula
          </Button>
        </div>
      </div>
    </div>
  );
};

export default SortableModule;