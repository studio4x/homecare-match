"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { 
  Loader2, 
  Plus, 
  Edit2, 
  Image as ImageIcon, 
  Trash2, 
  Eye, 
  DollarSign, 
  Video, 
  FlaskConical, 
  Zap, 
  RefreshCw,
  CreditCard,
  Save,
  Users,
  X
} from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import RichTextEditor from "@/components/ui/RichTextEditor";
import CourseEnrollmentsDialog from "./CourseEnrollmentsDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import SortableModule from "./SortableModule";

const HERO_DIR = "academy/hero";
const MATERIALS_DIR = "materials";
const PRIVATE_BUCKET = "academy-private";

// Mapeamento de níveis para exibição correta
export const COURSE_LEVEL_LABELS: Record<string, string> = {
  iniciante: "Iniciante",
  basico: "Básico",
  intermediario: "Intermediário",
  avancado: "Avançado",
};

type CourseLevel = "iniciante" | "basico" | "intermediario" | "avancado";

interface Lesson {
  id: string;
  title: string;
  type: "video" | "pdf" | "link" | "text" | "html";
  duration_minutes?: number;
  resource_url?: string;
  content?: string;
  position?: number;
  module_id: string;
  storage_path?: string;
  mime_type?: string;
}

interface Module {
  id: string;
  title: string;
  description?: string;
  position?: number;
  course_slug: string;
  lessons: Lesson[];
}

interface Course {
  slug: string;
  title: string;
  description?: string;
  level?: CourseLevel;
  duration_minutes?: number;
  is_active?: boolean;
  hero_asset_url?: string;
  content_url?: string;
  created_at?: string;
  price?: number;
  video_source?: string;
  video_url?: string;
  video_storage_path?: string;
  video_mime?: string;
  stripe_price_id_test?: string;
  stripe_price_id_live?: string;
}

const generateSlug = (text: string) => {
  return text
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") 
    .replace(/[^\w\s-]/g, "") 
    .replace(/\s+/g, "-") 
    .replace(/--+/g, "-") 
    .replace(/-+$/, "")
    .trim();
};

const CoursesTab = () => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [openDialog, setOpenDialog] = useState<boolean>(false);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [isSyncingStripe, setIsSyncingStripe] = useState<string | null>(null);

  const [openContentDialog, setOpenContentDialog] = useState<boolean>(false);
  const [modules, setModules] = useState<Module[]>([]);
  const [isSavingContent, setIsSavingContent] = useState<boolean>(false);
  const [uploadingLessonId, setUploadingLessonId] = useState<string | null>(null);
  const MAX_FILE_SIZE_MB = 100; 
  const [selectedModuleIdx, setSelectedModuleIdx] = useState<number | null>(null);
  const [selectedLessonIdx, setSelectedLessonIdx] = useState<number | null>(null);
  const [originalModules, setOriginalModules] = useState<Module[]>([]);
  const [isContentDirty, setIsContentDirty] = useState<boolean>(false);
  const [showCloseConfirm, setShowCloseConfirm] = useState<boolean>(false);

  const [courseToDelete, setCourseToDelete] = useState<Course | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<boolean>(false);

  const [enrollmentsDialogOpen, setEnrollmentsDialogOpen] = useState(false);
  const [courseForEnrollments, setCourseForEnrollments] = useState<{slug: string, title: string} | null>(null);

  const heroRef = useRef<HTMLInputElement>(null);
  const materialRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const fetchCourses = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("academy_courses")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      setCourses(data || []);
    } catch (e) {
      console.warn("[CoursesTab] Falha ao carregar cursos:", e);
      setCourses([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCourses();
  }, []);

  useEffect(() => {
    if (selectedCourse && modules.length > 0) {
      const totalMinutes = modules.reduce((acc, mod) => {
        return acc + mod.lessons.reduce((lAcc, lesson) => lAcc + (lesson.duration_minutes || 0), 0);
      }, 0);
      
      if (selectedCourse.duration_minutes !== totalMinutes) {
        setSelectedCourse(prev => prev ? { ...prev, duration_minutes: totalMinutes } : null);
        setIsContentDirty(true);
      }
    }
  }, [modules]);

  const handleSyncStripe = async (mode: 'test' | 'live') => {
    if (!selectedCourse?.price || selectedCourse.price <= 0) {
      toast.error("Defina um preço maior que zero para sincronizar.");
      return;
    }
    if (!selectedCourse.slug || !selectedCourse.title) {
      toast.error("Preencha o título e o slug antes de sincronizar.");
      return;
    }

    setIsSyncingStripe(mode);
    const toastId = toast.loading(`Sincronizando com Stripe (${mode})...`);

    try {
      const { data, error } = await supabase.functions.invoke('sync-stripe-product', {
        body: {
          courseSlug: selectedCourse.slug,
          title: selectedCourse.title,
          price: Number(selectedCourse.price),
          mode
        }
      });

      if (error) {
        let errorMessage = "Erro ao sincronizar.";
        if (error.context?.json) {
          const body = await error.context.json();
          errorMessage = body.error || errorMessage;
        } else if (error.message) {
          errorMessage = error.message;
        }
        throw new Error(errorMessage);
      }

      if (data?.priceId) {
        const field = mode === 'test' ? 'stripe_price_id_test' : 'stripe_price_id_live';
        setSelectedCourse(prev => prev ? { ...prev, [field]: data.priceId } : null);
        toast.success(`ID da Stripe (${mode}) gerado com sucesso!`, { id: toastId });
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Erro ao sincronizar com Stripe.", { id: toastId });
    } finally {
      setIsSyncingStripe(null);
    }
  };

  const handleNewCourse = () => {
    setSelectedCourse({
      slug: "",
      title: "",
      description: "",
      level: "iniciante",
      duration_minutes: 0,
      is_active: true,
      hero_asset_url: "",
      content_url: "",
      price: 0,
      video_source: "url",
      video_url: "",
      video_storage_path: "",
      video_mime: "",
      stripe_price_id_test: "",
      stripe_price_id_live: ""
    });
    setOpenDialog(true);
  };

  const handleEditCourse = (c: Course) => {
    setSelectedCourse({ 
      ...c,
      video_source: c.video_source || "url",
      video_url: c.video_url || "",
      video_storage_path: c.video_storage_path || "",
      video_mime: c.video_mime || "",
      stripe_price_id_test: c.stripe_price_id_test || "",
      stripe_price_id_live: c.stripe_price_id_live || ""
    });
    setOpenDialog(true);
  };

  const handleDeleteCourse = async () => {
    if (!courseToDelete) return;
    setIsSaving(true);
    try {
      const { error } = await supabase.from("academy_courses").delete().eq("slug", courseToDelete.slug);
      if (error) throw error;
      toast.success("Curso removido!");
      setShowDeleteConfirm(false);
      setCourseToDelete(null);
      fetchCourses();
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveCourse = async () => {
    if (!selectedCourse) return;
    setIsSaving(true);
    try {
      await supabase.functions.invoke("extend-site-config");
      
      const { error } = await supabase.from("academy_courses").upsert({
        ...selectedCourse,
        created_at: selectedCourse.created_at || new Date().toISOString(),
      });
      if (error) throw error;
      toast.success("Curso salvo!");
      setOpenDialog(false);
      fetchCourses();
    } finally {
      setIsSaving(false);
    }
  };

  const loadContent = async (course: Course) => {
    try {
      const { data: mods } = await supabase.from("academy_modules").select("*").eq("course_slug", course.slug).order("position", { ascending: true });
      const modulesWithLessons: Module[] = [];
      for (const m of mods || []) {
        const { data: lessons } = await supabase.from("academy_lessons").select("*").eq("module_id", m.id).order("position", { ascending: true });
        modulesWithLessons.push({
          ...m,
          lessons: (lessons || []).map(l => ({ ...l, type: l.type as any }))
        });
      }
      setModules(modulesWithLessons);
      setOriginalModules(modulesWithLessons);
      setIsContentDirty(false);
    } catch (e) {
      console.error(e);
    }
  };

  const handleOpenContent = async (c: Course) => {
    setSelectedCourse(c);
    await loadContent(c);
    setOpenContentDialog(true);
  };

  const addModule = () => {
    if (!selectedCourse) return;
    setModules(prev => [...prev, {
      id: crypto.randomUUID(),
      title: "Novo Módulo",
      description: "",
      position: prev.length + 1,
      course_slug: selectedCourse.slug,
      lessons: []
    }]);
    setIsContentDirty(true);
  };

  const addLesson = (mi: number) => {
    setModules(prev => {
      const next = [...prev];
      const mod = { ...next[mi] };
      mod.lessons = [...mod.lessons, {
        id: crypto.randomUUID(),
        title: "Nova Aula",
        type: "text",
        duration_minutes: 0,
        resource_url: "",
        content: "",
        position: mod.lessons.length + 1,
        module_id: mod.id
      }];
      next[mi] = mod;
      return next;
    });
    setIsContentDirty(true);
  };

  const updateLessonData = (mi: number, li: number, data: Partial<Lesson>) => {
    setModules(prev => {
      const next = [...prev];
      const mod = { ...next[mi] };
      const lessons = [...mod.lessons];
      lessons[li] = { ...lessons[li], ...data };
      mod.lessons = lessons;
      next[mi] = mod;
      return next;
    });
    setIsContentDirty(true);
  };

  const handleSaveContent = async () => {
    if (!selectedCourse) return;
    setIsSavingContent(true);
    try {
      await supabase.functions.invoke('academy-migrate', { body: { action: 'create_tables' } });
      await supabase.from("academy_courses").update({
        duration_minutes: selectedCourse.duration_minutes
      }).eq("slug", selectedCourse.slug);

      for (let mi = 0; mi < modules.length; mi++) {
        const m = modules[mi];
        const { error: modErr } = await supabase.from("academy_modules").upsert({
          id: m.id, 
          course_slug: m.course_slug, 
          title: m.title, 
          description: m.description, 
          position: mi + 1 
        });
        if (modErr) throw modErr;
        
        for (let li = 0; li < m.lessons.length; li++) {
          const l = m.lessons[li];
          const { error: lesErr } = await supabase.from("academy_lessons").upsert({
            id: l.id, 
            module_id: m.id, 
            title: l.title, 
            type: l.type, 
            duration_minutes: l.duration_minutes, 
            resource_url: l.resource_url, 
            content: l.content, 
            position: li + 1 
          });
          if (lesErr) throw lesErr;
        }
      }
      toast.success("Conteúdo salvo!");
      setIsContentDirty(false);
      setOpenContentDialog(false);
      fetchCourses();
    } catch (e: any) {
      toast.error("Erro ao salvar: " + e.message);
    } finally {
      setIsSavingContent(false);
    }
  };

  const handleUploadHero = async (file: File) => {
    if (!selectedCourse?.slug) {
      toast.error("Defina o slug antes de enviar a capa.");
      return;
    }
    setIsUploading(true);
    const ext = file.name.split(".").pop();
    const fileName = `${selectedCourse.slug}_${Date.now()}.${ext}`;
    const path = `${HERO_DIR}/${fileName}`;
    try {
      const { error: uploadError } = await supabase.storage.from("uploads").upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: publicData } = supabase.storage.from("uploads").getPublicUrl(path);
      const publicUrl = publicData.publicUrl;
      setSelectedCourse((prev) => prev ? { ...prev, hero_asset_url: publicUrl } : prev);
      toast.success("Capa enviada!");
    } catch (e) {
      toast.error("Falha ao enviar capa.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleUploadVideo = async (file: File) => {
    if (!selectedCourse?.slug) {
      toast.error("Defina o slug antes de enviar o vídeo.");
      return;
    }
    setIsUploading(true);
    const ext = file.name.split(".").pop();
    const fileName = `${selectedCourse.slug}_video_${Date.now()}.${ext}`;
    const path = `${MATERIALS_DIR}/${selectedCourse.slug}/${fileName}`;
    try {
      const { error: uploadError } = await supabase.storage.from(PRIVATE_BUCKET).upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;
      toast.success("Vídeo carregado!");
      setSelectedCourse((prev) => prev ? {
        ...prev,
        video_source: "storage",
        video_storage_path: path,
        video_mime: file.type,
        video_url: ""
      } : prev);
    } catch {
      toast.error("Erro ao enviar vídeo.");
    } finally {
      setIsUploading(false);
      if (videoRef.current) videoRef.current.value = "";
    }
  };

  const handleUploadMaterial = async (file: File) => {
    if (selectedModuleIdx === null || selectedLessonIdx === null) return;
    const lesson = modules[selectedModuleIdx].lessons[selectedLessonIdx];
    if (!lesson || !selectedCourse) return;

    setUploadingLessonId(lesson.id);

    const maxBytes = MAX_FILE_SIZE_MB * 1024 * 1024;
    if (file.size > maxBytes) {
      toast.error(`Arquivo muito grande (${Math.round(file.size / 1024 / 1024)}MB). Limite: ${MAX_FILE_SIZE_MB}MB.`);
      setUploadingLessonId(null);
      return;
    }

    try {
      const ext = (file.name.split(".").pop() || "").toLowerCase();
      const safeExt = ext || (file.type.startsWith("video/") ? "mp4" : "bin");
      const fileName = `${lesson.id}.${safeExt}`;
      const path = `${MATERIALS_DIR}/${selectedCourse.slug}/${modules[selectedModuleIdx].id}/${fileName}`;

      const { error: uploadError } = await supabase.storage.from(PRIVATE_BUCKET).upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;

      updateLessonData(selectedModuleIdx, selectedLessonIdx, {
        resource_url: path,
        storage_path: path,
        mime_type: file.type
      });

      toast.success("Material enviado!");
    } catch (e) {
      toast.error("Falha ao enviar material.");
    } finally {
      setUploadingLessonId(null);
      setSelectedModuleIdx(null);
      setSelectedLessonIdx(null);
      if (materialRef.current) materialRef.current.value = "";
    }
  };

  const removeModule = async (idx: number) => {
    const mod = modules[idx];
    setModules((prev) => prev.filter((_, i) => i !== idx));
    if (mod?.id) {
      await supabase.from("academy_modules").delete().eq("id", mod.id);
    }
    setIsContentDirty(true);
  };

  const removeLesson = async (mi: number, li: number) => {
    const lesson = modules[mi].lessons[li];
    setModules(prev => {
      const next = [...prev];
      const mod = { ...next[mi] };
      mod.lessons = mod.lessons.filter((_, i) => i !== li);
      next[mi] = mod;
      return next;
    });
    if (lesson?.id) {
      await supabase.from("academy_lessons").delete().eq("id", lesson.id);
    }
    setIsContentDirty(true);
  };

  const attemptCloseContentDialog = () => {
    if (isContentDirty) setShowCloseConfirm(true); else setOpenContentDialog(false);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    if (active.id !== over.id) {
      const activeModuleIdx = modules.findIndex(m => m.id === active.id);
      const overModuleIdx = modules.findIndex(m => m.id === over.id);

      if (activeModuleIdx !== -1 && overModuleIdx !== -1) {
        setModules((items) => arrayMove(items, activeModuleIdx, overModuleIdx));
        setIsContentDirty(true);
        return;
      }

      for (let mi = 0; mi < modules.length; mi++) {
        const activeLessonIdx = modules[mi].lessons.findIndex(l => l.id === active.id);
        const overLessonIdx = modules[mi].lessons.findIndex(l => l.id === over.id);

        if (activeLessonIdx !== -1 && overLessonIdx !== -1) {
          setModules(prev => {
            const next = [...prev];
            const mod = { ...next[mi] };
            mod.lessons = arrayMove(mod.lessons, activeLessonIdx, overLessonIdx);
            next[mi] = mod;
            return next;
          });
          setIsContentDirty(true);
          break;
        }
      }
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Cursos</CardTitle>
          <div className="flex gap-2">
            <Button onClick={handleNewCourse} className="gap-2"><Plus size={16} /> Novo Curso</Button>
            <Button
              variant="outline"
              onClick={async () => {
                toast.info("Sincronizando estrutura...");
                const { error } = await supabase.functions.invoke("setup-reviews-table");
                if (error) toast.error("Erro ao sincronizar."); else toast.success("Banco de dados atualizado!");
              }}
            >
              Sincronizar Banco
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Título</TableHead>
                <TableHead>Nível</TableHead>
                <TableHead>Preço</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {courses.map(c => (
                <TableRow key={c.slug}>
                  <TableCell className="font-medium">{c.title}</TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {c.level ? COURSE_LEVEL_LABELS[c.level] || c.level : "Não definido"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {c.price && c.price > 0 ? (
                      <span className="text-sm font-semibold">R$ {Number(c.price).toFixed(2).replace('.', ',')}</span>
                    ) : (
                      <Badge variant="secondary" className="bg-success/10 text-success border-success/20">Grátis</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right flex justify-end gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="gap-2"
                      onClick={() => {
                        setCourseForEnrollments({ slug: c.slug, title: c.title });
                        setEnrollmentsDialogOpen(true);
                      }}
                    >
                      <Users size={14} /> Alunos
                    </Button>
                    <Button variant="outline" size="sm" asChild className="gap-2">
                      <Link to={`/cursos/${c.slug}`} target="_blank"><Eye size={14} /> Ver</Link>
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleOpenContent(c)}>Conteúdo</Button>
                    <Button variant="ghost" size="sm" onClick={() => handleEditCourse(c)}><Edit2 size={16} /></Button>
                    <Button variant="ghost" size="sm" className="text-destructive" onClick={() => { setCourseToDelete(c); setShowDeleteConfirm(true); }}><Trash2 size={16} /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={openDialog} onOpenChange={setOpenDialog}>
        <DialogContent 
          className="max-w-2xl"
          onPointerDownOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <DialogHeader><DialogTitle>Configurações do Curso</DialogTitle></DialogHeader>
          {selectedCourse && (
            <div className="space-y-4 max-h-[70vh] overflow-y-auto px-1">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Título</Label>
                  <Input
                    value={selectedCourse.title}
                    onChange={e => {
                      const val = e.target.value;
                      const isNew = !selectedCourse.created_at;
                      setSelectedCourse({
                        ...selectedCourse,
                        title: val,
                        slug: isNew ? generateSlug(val) : selectedCourse.slug
                      });
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Slug</Label>
                  <Input value={selectedCourse.slug} disabled={!!selectedCourse.created_at} onChange={e => setSelectedCourse({...selectedCourse, slug: e.target.value})} />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2"><Eye size={14} /> URL da Plataforma Externa (Opcional)</Label>
                <Input
                  placeholder="https://my.coursebox.ai/courses/..."
                  value={selectedCourse.content_url || ""}
                  onChange={e => setSelectedCourse({...selectedCourse, content_url: e.target.value})}
                />
                <p className="text-[10px] text-muted-foreground">Se preenchido, o curso mostrará um botão para acessar esta plataforma diretamente (com opção de visualização interna).</p>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2"><DollarSign size={14} /> Preço (R$)</Label>
                  <div className="relative">
                    <Input type="number" step="0.01" value={selectedCourse.price} onChange={e => setSelectedCourse({...selectedCourse, price: parseFloat(e.target.value) || 0})} />
                    {(!selectedCourse.price || selectedCourse.price === 0) && (
                      <span className="absolute right-3 top-2.5 text-[10px] uppercase font-bold text-success">Grátis</span>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Nível</Label>
                  <Select value={selectedCourse.level} onValueChange={v => setSelectedCourse({...selectedCourse, level: v as any})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="iniciante">Iniciante</SelectItem>
                      <SelectItem value="basico">Básico</SelectItem>
                      <SelectItem value="intermediario">Intermediário</SelectItem>
                      <SelectItem value="avancado">Avançado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {selectedCourse.price && selectedCourse.price > 0 ? (
                <div className="space-y-4 p-4 bg-secondary/20 rounded-lg border">
                  <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-2 font-bold"><CreditCard size={16} /> Integração Stripe</Label>
                    <Badge variant="outline" className="text-[10px]">Automático</Badge>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="flex items-center gap-2 text-amber-600 text-[10px] uppercase font-bold"><FlaskConical className="h-3 w-3" /> ID Teste</Label>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-6 text-[9px] gap-1" 
                          onClick={() => handleSyncStripe('test')}
                          disabled={!!isSyncingStripe}
                        >
                          {isSyncingStripe === 'test' ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                          Gerar na Stripe
                        </Button>
                      </div>
                      <Input placeholder="price_..." value={selectedCourse.stripe_price_id_test || ''} onChange={e => setSelectedCourse({...selectedCourse, stripe_price_id_test: e.target.value})} />
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="flex items-center gap-2 text-success text-[10px] uppercase font-bold"><Zap className="h-3 w-3" /> ID Produção</Label>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-6 text-[9px] gap-1" 
                          onClick={() => handleSyncStripe('live')}
                          disabled={!!isSyncingStripe}
                        >
                          {isSyncingStripe === 'live' ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                          Gerar na Stripe
                        </Button>
                      </div>
                      <Input placeholder="price_..." value={selectedCourse.stripe_price_id_live || ''} onChange={e => setSelectedCourse({...selectedCourse, stripe_price_id_live: e.target.value})} />
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="space-y-2">
                <Label>Duração Total (minutos)</Label>
                <Input 
                  type="number" 
                  value={selectedCourse.duration_minutes} 
                  disabled 
                  className="bg-muted cursor-not-allowed"
                />
              </div>

              <div className="space-y-2">
                <Label>Descrição do Curso</Label>
                <RichTextEditor content={selectedCourse.description || ""} onChange={html => setSelectedCourse({...selectedCourse, description: html})} />
              </div>

              <div className="space-y-4 border rounded-lg p-4 bg-secondary/10">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2"><Video className="h-4 w-4 text-primary" /> Vídeo de Destaque (Hero)</Label>
                </div>
                
                <div className="grid gap-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">Origem do Vídeo</Label>
                    <Select 
                      value={selectedCourse.video_source || "url"} 
                      onValueChange={(v) => setSelectedCourse(prev => prev ? { ...prev, video_source: v } : prev)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a origem" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="url">URL Externa (YouTube/Vimeo/Link Direto)</SelectItem>
                        <SelectItem value="storage">Upload de Arquivo (Privado)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {selectedCourse.video_source === "url" ? (
                    <div className="space-y-2">
                      <Label className="text-[10px] uppercase font-bold text-muted-foreground">URL do Vídeo</Label>
                      <Input 
                        placeholder="https://www.youtube.com/watch?v=..." 
                        value={selectedCourse.video_url || ""} 
                        onChange={(e) => setSelectedCourse(prev => prev ? { ...prev, video_url: e.target.value } : prev)} 
                      />
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Label className="text-[10px] uppercase font-bold text-muted-foreground">Arquivo de Vídeo</Label>
                      <div className="flex items-center gap-2">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => videoRef.current?.click()} 
                          disabled={isUploading}
                          className="w-full gap-2"
                        >
                          {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Video className="h-4 w-4" />}
                          {selectedCourse.video_storage_path ? "Substituir Vídeo" : "Subir Vídeo MP4"}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Capa (imagem 4:3)</Label>
                  <div className="space-y-3">
                    {selectedCourse.hero_asset_url && (
                      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg border bg-muted group">
                        <img 
                          src={selectedCourse.hero_asset_url} 
                          alt="Preview da capa" 
                          className="h-full w-full object-cover"
                        />
                        <button 
                          onClick={() => setSelectedCourse({...selectedCourse, hero_asset_url: ""})}
                          className="absolute top-2 right-2 p-1 bg-destructive text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => heroRef.current?.click()} disabled={isUploading} className="w-full gap-2">
                        {isUploading ? <Loader2 size={16} className="animate-spin" /> : <ImageIcon size={16} />} 
                        {selectedCourse.hero_asset_url ? "Alterar Capa" : "Enviar Capa"}
                      </Button>
                      <input ref={heroRef} type="file" className="hidden" accept="image/*" onChange={(e) => { const file = e.target.files?.[0]; if (file) handleUploadHero(file); }} />
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Status de Visibilidade</Label>
                  <div className="flex items-center justify-between rounded-lg border p-3 h-10">
                    <span className="text-sm">Curso Ativo</span>
                    <Switch checked={!!selectedCourse.is_active} onCheckedChange={(checked) => setSelectedCourse({ ...selectedCourse, is_active: checked })} />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button variant="ghost" onClick={() => setOpenDialog(false)}>Cancelar</Button>
                <Button onClick={handleSaveCourse} disabled={isSaving}>
                  {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                  Salvar Configurações
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={openContentDialog} onOpenChange={attemptCloseContentDialog}>
        <DialogContent className="max-w-4xl h-[90vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="p-6 border-b bg-card">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle>Conteúdo do Curso: {selectedCourse?.title}</DialogTitle>
                <p className="text-xs text-muted-foreground mt-1">Arraste os itens para reordenar.</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={addModule} className="gap-2"><Plus size={14} /> Novo Módulo</Button>
                <Button size="sm" onClick={handleSaveContent} disabled={isSavingContent} className="gap-2">
                  {isSavingContent ? <Loader2 size={14} className="animate-spin" /> : null} Salvar Alterações
                </Button>
              </div>
            </div>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-secondary/5">
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={modules.map(m => m.id)} strategy={verticalListSortingStrategy}>
                {modules.map((m, mi) => (
                  <SortableModule
                    key={m.id}
                    module={m}
                    onUpdateTitle={(t) => {
                      setModules(prev => {
                        const next = [...prev];
                        next[mi] = { ...next[mi], title: t };
                        return next;
                      });
                      setIsContentDirty(true);
                    }}
                    onRemove={() => removeModule(mi)}
                    onAddLesson={() => addLesson(mi)}
                    onUpdateLesson={(li, data) => updateLessonData(mi, li, data)}
                    onRemoveLesson={(li) => removeLesson(mi, li)}
                    onUploadClick={(li) => {
                      setSelectedModuleIdx(mi);
                      setSelectedLessonIdx(li);
                      materialRef.current?.click();
                    }}
                    uploadingLessonId={uploadingLessonId}
                  />
                ))}
              </SortableContext>
            </DndContext>

            {modules.length === 0 && (
              <div className="text-center py-20 border-2 border-dashed rounded-xl">
                <p className="text-muted-foreground">Nenhum módulo criado ainda.</p>
                <Button variant="outline" className="mt-4" onClick={addModule}>Criar Primeiro Módulo</Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {courseForEnrollments && (
        <CourseEnrollmentsDialog
          open={enrollmentsDialogOpen}
          onOpenChange={setEnrollmentsDialogOpen}
          courseSlug={courseForEnrollments.slug}
          courseTitle={courseForEnrollments.title}
        />
      )}

      <input ref={videoRef} type="file" className="hidden" accept="video/*" onChange={(e) => { const file = e.target.files?.[0]; if (file) handleUploadVideo(file); }} />
      <input ref={materialRef} type="file" className="hidden" accept="video/*,application/pdf" onChange={(e) => { const file = e.target.files?.[0]; if (file) handleUploadMaterial(file); }} />

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir curso?</AlertDialogTitle>
            <AlertDialogDescription>Isso apagará permanentemente o curso "{courseToDelete?.title}" e todo o seu conteúdo.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="ghost" onClick={() => setShowDeleteConfirm(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDeleteCourse}>Excluir</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showCloseConfirm} onOpenChange={setShowCloseConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Sair sem salvar?</AlertDialogTitle><AlertDialogDescription>Você tem alterações não salvas.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Continuar Editando</AlertDialogCancel><AlertDialogAction onClick={() => { setModules(originalModules); setIsContentDirty(false); setOpenContentDialog(false); setShowCloseConfirm(false); }}>Descartar</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default CoursesTab;