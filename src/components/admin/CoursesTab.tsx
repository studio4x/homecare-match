"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Edit2, Image as ImageIcon, Trash2, Eye } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
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
  type: "video" | "pdf" | "link";
  duration_minutes?: number;
  resource_url?: string;
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
}

const HERO_DIR = "academy/hero";
const MATERIALS_DIR = "materials";
const PRIVATE_BUCKET = "academy-private";

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
  const [isUploadingMaterial, setIsUploadingMaterial] = useState<boolean>(false);
  const [selectedModuleIdx, setSelectedModuleIdx] = useState<number | null>(null);
  const [selectedLessonIdx, setSelectedLessonIdx] = useState<number | null>(null);
  const [originalModules, setOriginalModules] = useState<Module[]>([]);
  const [isContentDirty, setIsContentDirty] = useState<boolean>(false);
  const [showCloseConfirm, setShowCloseConfirm] = useState<boolean>(false);

  const heroRef = useRef<HTMLInputElement>(null);
  const materialRef = useRef<HTMLInputElement>(null);

  // Placeholder dinâmico conforme tipo da aula
  const getResourcePlaceholder = (type: Lesson["type"]) => {
    if (type === "video") return "Link do vídeo (externo) ou será preenchido ao enviar arquivo";
    if (type === "pdf") return "Link do PDF (externo) ou será preenchido ao enviar arquivo";
    return "Cole aqui o link externo do recurso";
  };

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
    });
    setOpenDialog(true);
  };

  const handleEditCourse = (c: Course) => {
    setSelectedCourse({ ...c });
    setOpenDialog(true);
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

  const handleSaveCourse = async () => {
    if (!selectedCourse) return;

    if (!selectedCourse.slug || !selectedCourse.title) {
      toast.error("Preencha ao menos slug e título.");
      return;
    }

    setIsSaving(true);
    try {
      const payload: Course = {
        ...selectedCourse,
        created_at: selectedCourse.created_at || new Date().toISOString(),
      };
      const { error } = await supabase.from("academy_courses").upsert(payload);
      if (error) throw error;
      toast.success("Curso salvo!");
      setOpenDialog(false);
      fetchCourses();
    } catch (e) {
      console.error("[CoursesTab] Save error:", e);
      toast.error("Falha ao salvar curso.");
    } finally {
      setIsSaving(false);
    }
  };

  const loadContent = async (course: Course) => {
    try {
      const { data: mods, error: modErr } = await supabase
        .from("academy_modules")
        .select("*")
        .eq("course_slug", course.slug)
        .order("position", { ascending: true });
      if (modErr) throw modErr;

      const modulesWithLessons: Module[] = [];
      for (const m of mods || []) {
        const { data: lessons, error: lessonErr } = await supabase
          .from("academy_lessons")
          .select("*")
          .eq("module_id", m.id)
          .order("position", { ascending: true });
        if (lessonErr) throw lessonErr;
        modulesWithLessons.push({
          id: m.id,
          title: m.title,
          description: m.description || "",
          position: m.position || 1,
          course_slug: m.course_slug,
          lessons: (lessons || []).map((l) => ({
            id: l.id,
            title: l.title,
            type: (l.type as Lesson["type"]) || "link",
            duration_minutes: l.duration_minutes || 0,
            resource_url: l.resource_url || "",
            position: l.position || 1,
            module_id: l.module_id,
            storage_path: l.storage_path || undefined,
            mime_type: l.mime_type || undefined,
          })),
        });
      }
      setModules(modulesWithLessons);
      setOriginalModules(modulesWithLessons);
      setIsContentDirty(false);
    } catch (e) {
      console.error("[CoursesTab] Load content error:", e);
      setModules([]);
      setOriginalModules([]);
      setIsContentDirty(false);
    }
  };

  // Detecta se houve alterações não salvas
  useEffect(() => {
    const current = JSON.stringify(modules);
    const baseline = JSON.stringify(originalModules);
    setIsContentDirty(current !== baseline);
  }, [modules, originalModules]);

  const handleOpenContent = async (c: Course) => {
    setSelectedCourse(c);
    await loadContent(c);
    setOpenContentDialog(true);
  };

  const addModule = () => {
    if (!selectedCourse) return;
    const newModule: Module = {
      id: crypto.randomUUID(),
      title: "Novo Módulo",
      description: "",
      position: (modules.length || 0) + 1,
      course_slug: selectedCourse.slug,
      lessons: [],
    };
    setModules((prev) => [...prev, newModule]);
  };

  const removeModule = async (idx: number) => {
    const mod = modules[idx];
    setModules((prev) => prev.filter((_, i) => i !== idx));
    // Se existir no banco, remover
    if (mod?.id) {
      const { error } = await supabase.from("academy_modules").delete().eq("id", mod.id);
      if (error) {
        console.error("[CoursesTab] Delete module error:", error);
        toast.error("Falha ao remover módulo no banco.");
      }
    }
  };

  const addLesson = (moduleIdx: number) => {
    const mod = modules[moduleIdx];
    if (!mod) return;
    const newLesson: Lesson = {
      id: crypto.randomUUID(),
      title: "Nova Aula",
      type: "link",
      duration_minutes: 0,
      resource_url: "",
      position: (mod.lessons.length || 0) + 1,
      module_id: mod.id,
    };
    const nextLessons = [...mod.lessons, newLesson];
    const nextModules = [...modules];
    nextModules[moduleIdx] = { ...mod, lessons: nextLessons };
    setModules(nextModules);
  };

  const removeLesson = async (moduleIdx: number, lessonIdx: number) => {
    const mod = modules[moduleIdx];
    const lesson = mod?.lessons[lessonIdx];
    if (!mod || !lesson) return;
    const nextLessons = mod.lessons.filter((_, i) => i !== lessonIdx);
    const nextModules = [...modules];
    nextModules[moduleIdx] = { ...mod, lessons: nextLessons };
    setModules(nextModules);
    // Se existir no banco, remover
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

    setIsUploadingMaterial(true);
    const ext = (file.name.split(".").pop() || "").toLowerCase();
    const safeExt = ext || (file.type.startsWith("video/") ? "mp4" : file.type === "application/pdf" ? "pdf" : "bin");
    const fileName = `${lesson.id}.${safeExt}`;
    const path = `${MATERIALS_DIR}/${selectedCourse.slug}/${mod.id}/${fileName}`;

    try {
      const { error: uploadError } = await supabase.storage.from(PRIVATE_BUCKET).upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;

      // Preenche o campo visual com o caminho do arquivo (para ficar claro que foi enviado)
      const updatedLesson = { ...lesson, resource_url: path, storage_path: path, mime_type: file.type };
      const nextLessons = [...mod.lessons];
      nextLessons[selectedLessonIdx] = updatedLesson;
      const nextModules = [...modules];
      nextModules[selectedModuleIdx] = { ...mod, lessons: nextLessons };
      setModules(nextModules);

      toast.success("Material enviado com sucesso!");
    } catch (e) {
      console.error("[CoursesTab] Upload material error:", e);
      toast.error("Falha ao enviar material.");
    } finally {
      setIsUploadingMaterial(false);
      setSelectedModuleIdx(null);
      setSelectedLessonIdx(null);
      if (materialRef.current) materialRef.current.value = "";
    }
  };

  // Tenta fechar: se houver alterações, pede confirmação
  const attemptCloseContentDialog = () => {
    if (isContentDirty) {
      setShowCloseConfirm(true);
    } else {
      setOpenContentDialog(false);
    }
  };

  const handleSaveContent = async () => {
    if (!selectedCourse) return;
    setIsSavingContent(true);
    try {
      // Garante estrutura atualizada
      await supabase.functions.invoke('academy-migrate', {
        body: { action: 'create_tables' }
      });

      // Upsert módulos
      const modPayloads = modules.map((m) => ({
        id: m.id,
        course_slug: m.course_slug,
        title: m.title,
        description: m.description,
        position: m.position ?? 1,
      }));
      if (modPayloads.length > 0) {
        const { error: modErr } = await supabase.from("academy_modules").upsert(modPayloads, { onConflict: "id" });
        if (modErr) throw modErr;
      }

      // Upsert aulas — enviar apenas colunas já existentes e seguras
      const lessonPayloads = modules.flatMap((m) =>
        m.lessons.map((l) => ({
          id: l.id,
          module_id: m.id,
          title: l.title,
          type: l.type,
          duration_minutes: l.duration_minutes ?? 0,
          resource_url: l.resource_url || "",  // usamos o caminho do arquivo aqui
          position: l.position ?? 1,
        }))
      );

      if (lessonPayloads.length > 0) {
        const { error: lessonErr } = await supabase.from("academy_lessons").upsert(lessonPayloads, { onConflict: "id" });
        if (lessonErr) throw lessonErr;
      }

      toast.success("Conteúdo salvo no banco!");
      setOriginalModules(modules);
      setIsContentDirty(false);
      setOpenContentDialog(false);
    } catch (e) {
      console.error("[CoursesTab] Save content error:", e);
      toast.error("Falha ao salvar conteúdo.");
    } finally {
      setIsSavingContent(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex items-center justify-between">
          <CardTitle>Cursos de Capacitação</CardTitle>
          <div className="flex items-center gap-2">
            <Button onClick={handleNewCourse} className="gap-2">
              <Plus className="h-4 w-4" /> Novo Curso
            </Button>
            <Button
              variant="outline"
              onClick={async () => {
                toast.info("Configurando storage seguro...");
                const { error } = await supabase.functions.invoke("academy-storage-setup", { body: { action: "setup" } });
                if (error) {
                  toast.error("Erro ao configurar storage.");
                } else {
                  toast.success("Storage privado configurado!");
                }
              }}
            >
              Configurar Storage Seguro
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando...</div>
          ) : courses.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Título</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead>Nível</TableHead>
                  <TableHead>Duração</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {courses.map((c) => (
                  <TableRow key={c.slug}>
                    <TableCell className="font-medium">{c.title}</TableCell>
                    <TableCell className="text-muted-foreground">{c.slug}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="capitalize">{c.level || "iniciante"}</Badge>
                    </TableCell>
                    <TableCell>{c.duration_minutes ? `${c.duration_minutes} min` : "-"}</TableCell>
                    <TableCell>
                      <Badge className={c.is_active ? "bg-success" : "bg-muted text-muted-foreground"}>{c.is_active ? "Ativo" : "Inativo"}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" className="gap-2" onClick={() => handleOpenContent(c)}>
                          <Edit2 className="h-4 w-4" /> Conteúdo
                        </Button>
                        <Button variant="ghost" size="sm" className="gap-2" onClick={() => handleEditCourse(c)}>
                          <Edit2 className="h-4 w-4" /> Editar
                        </Button>
                        <Button variant="outline" size="sm" asChild>
                          <Link to={`/cursos/${c.slug}`} target="_blank" rel="noreferrer">
                            <Eye className="h-4 w-4 mr-1" /> Visualizar
                          </Link>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-sm text-muted-foreground">Nenhum curso cadastrado ainda.</div>
          )}
        </CardContent>
      </Card>

      <Dialog open={openDialog} onOpenChange={setOpenDialog}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedCourse ? (selectedCourse.created_at ? "Editar Curso" : "Novo Curso") : "Curso"}</DialogTitle>
          </DialogHeader>
          {selectedCourse && (
            <div className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Slug (único)</Label>
                  <Input
                    value={selectedCourse.slug}
                    onChange={(e) => setSelectedCourse({ ...selectedCourse, slug: e.target.value.trim() })}
                    disabled={!!selectedCourse.created_at}
                    placeholder="ex: cuidados-feridas-rapido"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Título</Label>
                  <Input
                    value={selectedCourse.title}
                    onChange={(e) => setSelectedCourse({ ...selectedCourse, title: e.target.value })}
                    placeholder="Ex: Cuidados com Feridas - Rápido"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Descrição</Label>
                <Textarea
                  value={selectedCourse.description || ""}
                  onChange={(e) => setSelectedCourse({ ...selectedCourse, description: e.target.value })}
                  rows={4}
                />
              </div>

              <div className="grid md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Nível</Label>
                  <Select
                    value={selectedCourse.level || "iniciante"}
                    onValueChange={(v) => setSelectedCourse({ ...selectedCourse, level: v as CourseLevel })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="iniciante">Iniciante</SelectItem>
                      <SelectItem value="intermediario">Intermediário</SelectItem>
                      <SelectItem value="avancado">Avançado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Duração (min)</Label>
                  <Input
                    type="number"
                    value={selectedCourse.duration_minutes || 0}
                    onChange={(e) => setSelectedCourse({ ...selectedCourse, duration_minutes: parseInt(e.target.value || "0", 10) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <div className="flex items-center justify-between rounded-lg border p-3">
                    <span>Ativo</span>
                    <Switch
                      checked={!!selectedCourse.is_active}
                      onCheckedChange={(checked) => setSelectedCourse({ ...selectedCourse, is_active: checked })}
                    />
                  </div>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Capa (imagem)</Label>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => heroRef.current?.click()} disabled={isUploading}>
                      {isUploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ImageIcon className="h-4 w-4 mr-2" />}
                      Enviar Capa
                    </Button>
                    <input ref={heroRef} type="file" className="hidden" accept="image/*" onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleUploadHero(file);
                    }} />
                  </div>
                  {selectedCourse.hero_asset_url ? (
                    <div className="mt-2 border rounded-md p-2 bg-secondary/20">
                      <img src={selectedCourse.hero_asset_url} alt="Capa" className="max-h-24 object-contain mx-auto" />
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">Nenhuma imagem enviada.</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Conteúdo principal (URL)</Label>
                  <Input
                    value={selectedCourse.content_url || ""}
                    onChange={(e) => setSelectedCourse({ ...selectedCourse, content_url: e.target.value })}
                    placeholder="Link para vídeo/PDF"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="ghost" onClick={() => setOpenDialog(false)}>Cancelar</Button>
                <Button onClick={handleSaveCourse} disabled={isSaving}>
                  {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Salvar Curso
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={openContentDialog} onOpenChange={(open) => {
        if (!open) {
          attemptCloseContentDialog();
        } else {
          setOpenContentDialog(true);
        }
      }}>
        <DialogContent
          className="sm:max-w-3xl"
          onInteractOutside={(e) => {
            if (isContentDirty) {
              e.preventDefault();
              setShowCloseConfirm(true);
            }
          }}
        >
          <DialogHeader>
            <DialogTitle>Gerenciar Conteúdo: {selectedCourse?.title}</DialogTitle>
          </DialogHeader>
          {selectedCourse && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <Button size="sm" onClick={addModule} className="gap-2">
                  <Plus className="h-4 w-4" /> Adicionar Módulo
                </Button>
                <Button size="sm" variant="outline" onClick={handleSaveContent} disabled={isSavingContent}>
                  {isSavingContent ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Salvar Conteúdo
                </Button>
              </div>

              {modules.length > 0 ? (
                <div className="space-y-4">
                  {modules.map((m, mi) => (
                    <div key={m.id} className="border rounded-lg p-4 space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="grid md:grid-cols-2 gap-3 w-full">
                          <div className="space-y-2">
                            <Label>Título do Módulo</Label>
                            <Input
                              value={m.title}
                              onChange={(e) => {
                                const next = [...modules];
                                next[mi] = { ...m, title: e.target.value };
                                setModules(next);
                              }}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Descrição</Label>
                            <Input
                              value={m.description || ""}
                              onChange={(e) => {
                                const next = [...modules];
                                next[mi] = { ...m, description: e.target.value };
                                setModules(next);
                              }}
                            />
                          </div>
                        </div>
                        <Button variant="ghost" size="sm" className="text-destructive" onClick={() => removeModule(mi)}>
                          <Trash2 className="h-4 w-4" /> Remover
                        </Button>
                      </div>

                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-semibold">Aulas</h4>
                        <Button size="sm" onClick={() => addLesson(mi)} className="gap-2">
                          <Plus className="h-4 w-4" /> Adicionar Aula
                        </Button>
                      </div>

                      {(m.lessons || []).length > 0 ? (
                        <div className="space-y-3">
                          {(m.lessons || []).map((l, li) => (
                            <div key={l.id || li} className="grid md:grid-cols-4 gap-3 p-3 border rounded-md">
                              <div className="space-y-2">
                                <Label>Título</Label>
                                <Input
                                  value={l.title}
                                  onChange={(e) => {
                                    const next = [...modules];
                                    const lessons = [...m.lessons];
                                    lessons[li] = { ...l, title: e.target.value };
                                    next[mi] = { ...m, lessons };
                                    setModules(next);
                                  }}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Tipo</Label>
                                <Select
                                  value={l.type}
                                  onValueChange={(v) => {
                                    const next = [...modules];
                                    const lessons = [...m.lessons];
                                    lessons[li] = { ...l, type: v as Lesson["type"] };
                                    next[mi] = { ...m, lessons };
                                    setModules(next);
                                  }}
                                >
                                  <SelectTrigger><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="video">Vídeo</SelectItem>
                                    <SelectItem value="pdf">PDF</SelectItem>
                                    <SelectItem value="link">Link</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-2">
                                <Label>Recurso (Link/Arquivo)</Label>
                                <Input
                                  value={l.resource_url || ""}
                                  onChange={(e) => {
                                    const next = [...modules];
                                    const lessons = [...m.lessons];
                                    lessons[li] = { ...l, resource_url: e.target.value };
                                    next[mi] = { ...m, lessons };
                                    setModules(next);
                                  }}
                                  placeholder={getResourcePlaceholder(l.type)}
                                />
                                <div className="flex items-center gap-2 pt-1">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      setSelectedModuleIdx(mi);
                                      setSelectedLessonIdx(li);
                                      materialRef.current?.click();
                                    }}
                                    disabled={isUploadingMaterial || l.type === "link"}
                                  >
                                    {isUploadingMaterial ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                                    Enviar Arquivo
                                  </Button>
                                  <input
                                    ref={materialRef}
                                    type="file"
                                    className="hidden"
                                    accept="video/*,application/pdf"
                                    onChange={(e) => {
                                      const file = e.target.files?.[0];
                                      if (file) handleUploadMaterial(file);
                                      if (materialRef.current) materialRef.current.value = "";
                                    }}
                                  />
                                </div>
                              </div>
                              <div className="space-y-2">
                                <Label>Duração (min)</Label>
                                <Input
                                  type="number"
                                  value={l.duration_minutes || 0}
                                  onChange={(e) => {
                                    const next = [...modules];
                                    const lessons = [...m.lessons];
                                    lessons[li] = { ...l, duration_minutes: parseInt(e.target.value || "0", 10) };
                                    next[mi] = { ...m, lessons };
                                    setModules(next);
                                  }}
                                />
                                <div className="flex justify-end">
                                  <Button variant="ghost" size="sm" className="text-destructive" onClick={() => removeLesson(mi, li)}>
                                    Remover Aula
                                  </Button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">Nenhuma aula neste módulo.</p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Nenhum módulo adicionado ainda.</p>
              )}

              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={attemptCloseContentDialog}>Fechar</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirmação de saída sem salvar */}
      <AlertDialog open={showCloseConfirm} onOpenChange={setShowCloseConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sair sem salvar?</AlertDialogTitle>
            <AlertDialogDescription>
              Você tem alterações não salvas. Deseja descartar e fechar a edição?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continuar editando</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setModules(originalModules);
                setIsContentDirty(false);
                setOpenContentDialog(false);
                setShowCloseConfirm(false);
              }}
            >
              Descartar alterações
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default CoursesTab;