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
import { Loader2, Plus, Edit2, Image as ImageIcon, Trash2, Eye, DollarSign } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import RichTextEditor from "@/components/ui/RichTextEditor";
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

type CourseLevel = "iniciante" | "intermediario" | "avancado";

interface Lesson {
  id: string;
  title: string;
  type: "video" | "pdf" | "link" | "text";
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
}

const HERO_DIR = "academy/hero";
const MATERIALS_DIR = "materials";
const PRIVATE_BUCKET = "academy-private";

const generateSlug = (text: string) => {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") 
    .replace(/[^\w\s-]/g, "") 
    .replace(/\s+/g, "-") 
    .replace(/--+/g, "-") 
    .trim();
};

const estimateTextDuration = (html: string) => {
  if (!html) return 0;
  const text = html.replace(/<[^>]*>?/gm, ' ');
  const words = text.trim().split(/\s+/).filter(w => w.length > 0).length;
  return Math.ceil(words / 200) || 1;
};

const CoursesTab = () => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [openDialog, setOpenDialog] = useState<boolean>(false);
  const [isUploading, setIsUploading] = useState<boolean>(false);

  const [openContentDialog, setOpenContentDialog] = useState<boolean>(false);
  const [modules, setModules] = useState<Module[]>([]);
  const [isSavingContent, setIsSavingContent] = useState<boolean>(false);
  const [uploadingLessonId, setUploadingLessonId] = useState<string | null>(null);
  const MAX_FILE_SIZE_MB = 50; 
  const [selectedModuleIdx, setSelectedModuleIdx] = useState<number | null>(null);
  const [selectedLessonIdx, setSelectedLessonIdx] = useState<number | null>(null);
  const [originalModules, setOriginalModules] = useState<Module[]>([]);
  const [isContentDirty, setIsContentDirty] = useState<boolean>(false);
  const [showCloseConfirm, setShowCloseConfirm] = useState<boolean>(false);

  const [courseToDelete, setCourseToDelete] = useState<Course | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<boolean>(false);

  const heroRef = useRef<HTMLInputElement>(null);
  const materialRef = useRef<HTMLInputElement>(null);

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
    });
    setOpenDialog(true);
  };

  const handleEditCourse = (c: Course) => {
    setSelectedCourse({ ...c });
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
      // Garante que o banco está sincronizado antes de salvar
      await supabase.functions.invoke("academy-migrate", { body: { action: "create_tables" } });

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
  };

  const addLesson = (mi: number) => {
    const next = [...modules];
    next[mi].lessons.push({
      id: crypto.randomUUID(),
      title: "Nova Aula",
      type: "video",
      duration_minutes: 0,
      resource_url: "",
      content: "",
      position: next[mi].lessons.length + 1,
      module_id: next[mi].id
    });
    setModules(next);
  };

  const handleSaveContent = async () => {
    setIsSavingContent(true);
    try {
      await supabase.functions.invoke('academy-migrate', { body: { action: 'create_tables' } });

      for (const m of modules) {
        const { error: modErr } = await supabase.from("academy_modules").upsert({
          id: m.id, course_slug: m.course_slug, title: m.title, description: m.description, position: m.position
        });
        if (modErr) throw modErr;

        for (const l of m.lessons) {
          const { error: lesErr } = await supabase.from("academy_lessons").upsert({
            id: l.id, module_id: m.id, title: l.title, type: l.type, 
            duration_minutes: l.duration_minutes, resource_url: l.resource_url, 
            content: l.content, position: l.position
          });
          if (lesErr) throw lesErr;
        }
      }
      toast.success("Conteúdo salvo!");
      setOpenContentDialog(false);
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
      toast.success("Capa enviada com sucesso!");
    } catch (e) {
      console.error("[CoursesTab] Upload hero error:", e);
      toast.error("Falha ao enviar a imagem de capa.");
    } finally {
      setIsUploading(false);
    }
  };

  const removeModule = async (idx: number) => {
    const mod = modules[idx];
    setModules((prev) => prev.filter((_, i) => i !== idx));
    if (mod?.id) {
      const { error } = await supabase.from("academy_modules").delete().eq("id", mod.id);
      if (error) {
        console.error("[CoursesTab] Delete module error:", error);
        toast.error("Falha ao remover módulo no banco.");
      }
    }
  };

  const removeLesson = async (moduleIdx: number, lessonIdx: number) => {
    const mod = modules[moduleIdx];
    const lesson = mod?.lessons[lessonIdx];
    if (!mod || !lesson) return;
    const nextLessons = mod.lessons.filter((_, i) => i !== lessonIdx);
    const nextModules = [...modules];
    nextModules[moduleIdx] = { ...mod, lessons: nextLessons };
    setModules(nextModules);
    if (lesson?.id) {
      const { error } = await supabase.from("academy_lessons").delete().eq("id", lesson.id);
      if (error) {
        console.error("[CoursesTab] Delete lesson error:", error);
        toast.error("Falha ao remover aula no banco.");
      }
    }
  };

  const handleUploadMaterial = async (file: File) => {
    if (selectedModuleIdx === null || selectedLessonIdx === null) return;
    const mod = modules[selectedModuleIdx];
    const lesson = mod?.lessons[selectedLessonIdx];
    if (!mod || !lesson || !selectedCourse) return;

    setUploadingLessonId(lesson.id);

    const maxBytes = MAX_FILE_SIZE_MB * 1024 * 1024;
    if (file.size > maxBytes) {
      toast.error(`Arquivo muito grande (${Math.round(file.size / 1024 / 1024)}MB). Limite: ${MAX_FILE_SIZE_MB}MB.`);
      setUploadingLessonId(null);
      return;
    }

    const ext = (file.name.split(".").pop() || "").toLowerCase();
    const safeExt = ext || (file.type.startsWith("video/") ? "mp4" : file.type === "application/pdf" ? "pdf" : "bin");
    const fileName = `${lesson.id}.${safeExt}`;
    const path = `${MATERIALS_DIR}/${selectedCourse.slug}/${mod.id}/${fileName}`;

    try {
      const { error: uploadError } = await supabase.storage.from(PRIVATE_BUCKET).upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;

      const updatedLesson = { ...lesson, resource_url: path, storage_path: path, mime_type: file.type };

      const nextLessons = [...mod.lessons];
      nextLessons[selectedLessonIdx] = updatedLesson;
      const nextModules = [...modules];
      nextModules[selectedModuleIdx] = { ...mod, lessons: nextLessons };
      setModules(nextModules);
      toast.success("Material enviado!");
    } catch (e) {
      console.error("[CoursesTab] Upload material error:", e);
      toast.error("Falha ao enviar material.");
    } finally {
      setUploadingLessonId(null);
      setSelectedModuleIdx(null);
      setSelectedLessonIdx(null);
      if (materialRef.current) materialRef.current.value = "";
    }
  };

  const attemptCloseContentDialog = () => {
    if (isContentDirty) {
      setShowCloseConfirm(true);
    } else {
      setOpenContentDialog(false);
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
                const { error } = await supabase.functions.invoke("academy-migrate", { body: { action: "create_tables" } });
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
                  <TableCell><Badge variant="outline" className="capitalize">{c.level}</Badge></TableCell>
                  <TableCell>
                    {c.price && c.price > 0 ? (
                      <span className="text-sm font-semibold">R$ {Number(c.price).toFixed(2).replace('.', ',')}</span>
                    ) : (
                      <Badge variant="secondary" className="bg-success/10 text-success border-success/20">Grátis</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right flex justify-end gap-2">
                    <Button variant="outline" size="sm" asChild className="gap-2">
                      <Link to={`/cursos/${c.slug}`} target="_blank">
                        <Eye size={14} /> Ver
                      </Link>
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

      {/* Dialog: Editar Curso */}
      <Dialog open={openDialog} onOpenChange={setOpenDialog}>
        <DialogContent className="max-w-2xl">
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
                  <Input 
                    value={selectedCourse.slug} 
                    disabled={!!selectedCourse.created_at} 
                    onChange={e => setSelectedCourse({...selectedCourse, slug: e.target.value})} 
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2"><DollarSign size={14} /> Preço (R$)</Label>
                  <div className="relative">
                    <Input 
                      type="number" 
                      step="0.01"
                      placeholder="0.00"
                      value={selectedCourse.price} 
                      onChange={e => setSelectedCourse({...selectedCourse, price: parseFloat(e.target.value) || 0})} 
                    />
                    {(!selectedCourse.price || selectedCourse.price === 0) && (
                      <span className="absolute right-3 top-2.5 text-[10px] uppercase font-bold text-success">Grátis</span>
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground italic">Deixe 0 para tornar o curso gratuito.</p>
                </div>
                <div className="space-y-2">
                  <Label>Nível</Label>
                  <Select value={selectedCourse.level} onValueChange={v => setSelectedCourse({...selectedCourse, level: v as any})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="iniciante">Iniciante</SelectItem>
                      <SelectItem value="intermediario">Intermediário</SelectItem>
                      <SelectItem value="avancado">Avançado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Descrição do Curso</Label>
                <RichTextEditor 
                  content={selectedCourse.description || ""} 
                  onChange={html => setSelectedCourse({...selectedCourse, description: html})} 
                  placeholder="Explique sobre o que é este curso..."
                />
              </div>
              
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Capa (imagem)</Label>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => heroRef.current?.click()} disabled={isUploading}>{isUploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ImageIcon className="h-4 w-4 mr-2" />} Enviar Capa</Button>
                    <input ref={heroRef} type="file" className="hidden" accept="image/*" onChange={(e) => { const file = e.target.files?.[0]; if (file) handleUploadHero(file); }} />
                  </div>
                  {selectedCourse.hero_asset_url && <div className="mt-2 border rounded-md p-2 bg-secondary/20"><img src={selectedCourse.hero_asset_url} alt="Capa" className="max-h-24 object-contain mx-auto" /></div>}
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <div className="flex items-center justify-between rounded-lg border p-3"><span>Ativo</span><Switch checked={!!selectedCourse.is_active} onCheckedChange={(checked) => setSelectedCourse({ ...selectedCourse, is_active: checked })} /></div>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setOpenDialog(false)}>Cancelar</Button>
                <Button onClick={handleSaveCourse} disabled={isSaving}>Salvar</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog: Gerenciar Conteúdo */}
      <Dialog open={openContentDialog} onOpenChange={setOpenContentDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader><DialogTitle>Conteúdo: {selectedCourse?.title}</DialogTitle></DialogHeader>
          <div className="flex-1 overflow-y-auto p-1 space-y-6">
            <Button size="sm" onClick={addModule} className="gap-2"><Plus size={16} /> Novo Módulo</Button>
            {modules.map((m, mi) => (
              <div key={m.id} className="border rounded-lg p-4 space-y-4 bg-muted/20">
                <div className="flex items-center justify-between gap-3">
                  <Input className="max-w-xs font-semibold" value={m.title} onChange={e => { const next = [...modules]; next[mi].title = e.target.value; setModules(next); }} />
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => addLesson(mi)}><Plus size={14} className="mr-1" /> Aula</Button>
                    <Button variant="ghost" size="sm" className="text-destructive" onClick={() => removeModule(mi)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>
                <div className="space-y-3">
                  {m.lessons.map((l, li) => (
                    <div key={l.id} className="border bg-card rounded-md p-3 space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                        <div className="md:col-span-2">
                          <Label className="text-xs">Título da Aula</Label>
                          <Input value={l.title} onChange={e => { const next = [...modules]; next[mi].lessons[li].title = e.target.value; setModules(next); }} />
                        </div>
                        <div>
                          <Label className="text-xs">Tipo</Label>
                          <Select value={l.type} onValueChange={v => { const next = [...modules]; next[mi].lessons[li].type = v as any; setModules(next); }}>
                            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="video">Vídeo</SelectItem>
                              <SelectItem value="pdf">PDF</SelectItem>
                              <SelectItem value="text">Texto Rico</SelectItem>
                              <SelectItem value="link">Link Externo</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-xs">Minutos</Label>
                          <Input type="number" value={l.duration_minutes} onChange={e => { const next = [...modules]; next[mi].lessons[li].duration_minutes = parseInt(e.target.value) || 0; setModules(next); }} />
                        </div>
                      </div>

                      {l.type === 'text' ? (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label className="text-xs">Conteúdo da Aula</Label>
                            <span className="text-[10px] text-muted-foreground italic">Duração estimada automaticamente</span>
                          </div>
                          <RichTextEditor 
                            content={l.content || ""} 
                            onChange={html => { 
                              const next = [...modules]; 
                              next[mi].lessons[li].content = html; 
                              next[mi].lessons[li].duration_minutes = estimateTextDuration(html);
                              setModules(next); 
                            }} 
                          />
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <Label className="text-xs">URL / Caminho</Label>
                          <Input value={l.resource_url} onChange={e => { const next = [...modules]; next[mi].lessons[li].resource_url = e.target.value; setModules(next); }} placeholder="Link ou caminho do arquivo" />
                        </div>
                      )}
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" className="h-7" onClick={() => { setSelectedModuleIdx(mi); setSelectedLessonIdx(li); materialRef.current?.click(); }} disabled={(uploadingLessonId === l.id) || l.type === "link" || l.type === "text"}>
                          {uploadingLessonId === l.id ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null} Enviar Arquivo
                        </Button>
                        <Button variant="ghost" size="sm" className="text-destructive h-7" onClick={() => removeLesson(mi, li)}>Remover Aula</Button>
                      </div>
                    </div>
                  ))}
                  <div className="flex justify-center pt-2">
                    <Button size="sm" variant="ghost" className="w-full border-dashed border-2 text-muted-foreground hover:text-primary hover:border-primary" onClick={() => addLesson(mi)}>
                      <Plus size={14} className="mr-1" /> Adicionar Aula ao Módulo
                    </Button>
                  </div>
                </div>
              </div>
            ))}
            <div className="pb-10">
              <Button variant="outline" className="w-full border-dashed border-2 h-14 text-muted-foreground hover:text-primary hover:border-primary" onClick={addModule}>
                <Plus size={18} className="mr-2" /> Novo Módulo
              </Button>
            </div>
          </div>
          <div className="p-4 border-t flex justify-end gap-2">
            <Button variant="ghost" onClick={attemptCloseContentDialog}>Fechar</Button>
            <Button onClick={handleSaveContent} disabled={isSavingContent}>
              {isSavingContent && <Loader2 size={16} className="mr-2 animate-spin" />}
              Salvar Tudo
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <input ref={materialRef} type="file" className="hidden" accept="video/*,application/pdf" onChange={(e) => { const file = e.target.files?.[0]; if (file) handleUploadMaterial(file); }} />

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir curso?</AlertDialogTitle>
            <AlertDialogDescription>Isso apagará permanentemente o curso "{courseToDelete?.title}" e todo o seu conteúdo.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive" onClick={handleDeleteCourse}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showCloseConfirm} onOpenChange={setShowCloseConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Sair sem salvar?</AlertDialogTitle><AlertDialogDescription>Você tem alterações não salvas.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Continuar Editando</AlertDialogCancel><AlertDialogAction onClick={() => { setModules(originalModules); setIsContentDirty(false); setOpenContentDialog(false); }}>Descartar</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default CoursesTab;