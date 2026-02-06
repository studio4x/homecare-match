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
import { Loader2, Plus, Edit2, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";

type CourseLevel = "iniciante" | "intermediario" | "avancado";

interface Lesson {
  id: string;
  title: string;
  type: "video" | "pdf" | "link";
  duration_minutes?: number;
  resource_url?: string;
  position?: number;
}

interface Module {
  id: string;
  title: string;
  description?: string;
  position?: number;
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
  modules?: Module[];
}

const STORAGE_PATH = "academy/courses.json";
const HERO_DIR = "academy/hero";
const MATERIALS_DIR = "academy/materials";

const CoursesTab = () => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [openDialog, setOpenDialog] = useState<boolean>(false);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [openContentDialog, setOpenContentDialog] = useState<boolean>(false);
  const [selectedModuleIdx, setSelectedModuleIdx] = useState<number | null>(null);
  const [selectedLessonIdx, setSelectedLessonIdx] = useState<number | null>(null);
  const [isUploadingMaterial, setIsUploadingMaterial] = useState<boolean>(false);

  const heroRef = useRef<HTMLInputElement>(null);
  const materialRef = useRef<HTMLInputElement>(null);

  const fetchCourses = async () => {
    setIsLoading(true);
    try {
      const { data: file, error } = await supabase.storage.from("uploads").download(STORAGE_PATH);
      if (error || !file) {
        setCourses([]);
        return;
      }
      const text = await file.text();
      const parsed = JSON.parse(text);
      setCourses(Array.isArray(parsed) ? parsed : []);
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
      modules: [],
    });
    setOpenDialog(true);
  };

  const handleEditCourse = (c: Course) => {
    setSelectedCourse({ ...c, modules: c.modules || [] });
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

  const saveCoursesJSON = async (list: Course[]) => {
    const blob = new Blob([JSON.stringify(list, null, 2)], { type: "application/json" });
    const { error } = await supabase.storage.from("uploads").upload(STORAGE_PATH, blob, { upsert: true });
    if (error) throw error;
  };

  const handleSaveCourse = async () => {
    if (!selectedCourse) return;

    if (!selectedCourse.slug || !selectedCourse.title) {
      toast.error("Preencha ao menos slug e título.");
      return;
    }

    setIsSaving(true);
    try {
      const updated: Course = {
        ...selectedCourse,
        created_at: selectedCourse.created_at || new Date().toISOString(),
      };
      const existingIndex = courses.findIndex((c) => c.slug === updated.slug);
      let nextList = [...courses];
      if (existingIndex >= 0) {
        nextList[existingIndex] = updated;
      } else {
        nextList.push(updated);
      }
      await saveCoursesJSON(nextList);
      setCourses(nextList);
      setOpenDialog(false);
      toast.success("Curso salvo!");
    } catch (e) {
      console.error("[CoursesTab] Save error:", e);
      toast.error("Falha ao salvar curso.");
    } finally {
      setIsSaving(false);
    }
  };

  // Add content management helpers
  const ensureIds = () => {
    if (!selectedCourse) return;
    const withIds = {
      ...selectedCourse,
      modules: (selectedCourse.modules || []).map((m, mi) => ({
        id: m.id || crypto.randomUUID(),
        position: m.position ?? mi + 1,
        title: m.title,
        description: m.description,
        lessons: (m.lessons || []).map((l, li) => ({
          id: l.id || crypto.randomUUID(),
          position: l.position ?? li + 1,
          title: l.title,
          type: l.type || "link",
          duration_minutes: l.duration_minutes,
          resource_url: l.resource_url
        }))
      }))
    };
    setSelectedCourse(withIds);
  };

  const handleOpenContent = (c: Course) => {
    setSelectedCourse({ ...c, modules: c.modules || [] });
    setOpenContentDialog(true);
  };

  const addModule = () => {
    if (!selectedCourse) return;
    const nextModules = [...(selectedCourse.modules || []), { id: crypto.randomUUID(), title: "Novo Módulo", description: "", position: (selectedCourse.modules?.length || 0) + 1, lessons: [] }];
    setSelectedCourse({ ...selectedCourse, modules: nextModules });
  };

  const removeModule = (idx: number) => {
    if (!selectedCourse) return;
    const nextModules = (selectedCourse.modules || []).filter((_, i) => i !== idx);
    setSelectedCourse({ ...selectedCourse, modules: nextModules });
  };

  const addLesson = (moduleIdx: number) => {
    if (!selectedCourse) return;
    const mods = [...(selectedCourse.modules || [])];
    const mod = mods[moduleIdx];
    if (!mod) return;
    const newLesson: Lesson = { id: crypto.randomUUID(), title: "Nova Aula", type: "link", position: (mod.lessons?.length || 0) + 1 };
    const nextLessons: Lesson[] = [...(mod.lessons || []), newLesson];
    mods[moduleIdx] = { ...mod, lessons: nextLessons };
    setSelectedCourse({ ...selectedCourse, modules: mods });
  };

  const removeLesson = (moduleIdx: number, lessonIdx: number) => {
    if (!selectedCourse) return;
    const mods = [...(selectedCourse.modules || [])];
    const mod = mods[moduleIdx];
    if (!mod) return;
    const nextLessons = (mod.lessons || []).filter((_, i) => i !== lessonIdx);
    mods[moduleIdx] = { ...mod, lessons: nextLessons };
    setSelectedCourse({ ...selectedCourse, modules: mods });
  };

  const handleUploadMaterial = async (file: File) => {
    if (selectedModuleIdx === null || selectedLessonIdx === null || !selectedCourse) return;
    const moduleIdx = selectedModuleIdx;
    const lessonIdx = selectedLessonIdx;
    const mods = [...(selectedCourse.modules || [])];
    const mod = mods[moduleIdx];
    const lesson = mod?.lessons?.[lessonIdx];
    if (!mod || !lesson) return;

    setIsUploadingMaterial(true);
    const ext = file.name.split(".").pop();
    const fileName = `${lesson.id}_${Date.now()}.${ext}`;
    const path = `${MATERIALS_DIR}/${selectedCourse.slug}/${mod.id}/${fileName}`;

    try {
      const { error: uploadError } = await supabase.storage.from("uploads").upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: publicData } = supabase.storage.from("uploads").getPublicUrl(path);
      const publicUrl = publicData.publicUrl;

      // Update lesson resource URL
      const updatedLesson = { ...lesson, resource_url: publicUrl };
      const nextLessons = [...(mod.lessons || [])];
      nextLessons[lessonIdx] = updatedLesson;
      mods[moduleIdx] = { ...mod, lessons: nextLessons };
      setSelectedCourse({ ...selectedCourse, modules: mods });

      toast.success("Material enviado com sucesso!");
    } catch (e) {
      console.error("[CoursesTab] Upload material error:", e);
      toast.error("Falha ao enviar material.");
    } finally {
      setIsUploadingMaterial(false);
      setSelectedModuleIdx(null);
      setSelectedLessonIdx(null);
    }
  };

  const handleSaveContent = async () => {
    if (!selectedCourse) return;
    setIsSaving(true);
    try {
      ensureIds();
      const existingIndex = courses.findIndex((c) => c.slug === selectedCourse.slug);
      const nextList = [...courses];
      if (existingIndex >= 0) {
        nextList[existingIndex] = selectedCourse;
      } else {
        nextList.push(selectedCourse);
      }
      await saveCoursesJSON(nextList);
      setCourses(nextList);
      setOpenContentDialog(false);
      toast.success("Conteúdo do curso salvo!");
    } catch (e) {
      console.error("[CoursesTab] Save content error:", e);
      toast.error("Falha ao salvar conteúdo.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleMigrateToDB = async () => {
    toast.info("Iniciando migração...");
    // Cria tabelas com RLS
    const createRes = await supabase.functions.invoke('academy-migrate', {
      body: { action: 'create_tables' }
    });
    if (createRes.error) {
      toast.error("Erro ao criar tabelas.");
      return;
    }
    // Migra cursos do Storage para o banco
    const migrateRes = await supabase.functions.invoke('academy-migrate', {
      body: { action: 'migrate_from_storage' }
    });
    if (migrateRes.error) {
      toast.error("Erro ao migrar dados.");
      return;
    }
    toast.success("Migração concluída com sucesso!");
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
            <Button variant="outline" onClick={handleMigrateToDB}>
              Migrar para Banco (RLS)
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
                      <Button variant="ghost" size="sm" className="gap-2" onClick={() => handleEditCourse(c)}>
                        <Edit2 className="h-4 w-4" /> Editar
                      </Button>
                      <Button variant="ghost" size="sm" className="gap-2" onClick={() => handleOpenContent(c)}>
                        <Edit2 className="h-4 w-4" /> Gerenciar Conteúdo
                      </Button>
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

      <Dialog open={openContentDialog} onOpenChange={setOpenContentDialog}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Gerenciar Conteúdo: {selectedCourse?.title}</DialogTitle>
          </DialogHeader>
          {selectedCourse && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <Button size="sm" onClick={addModule} className="gap-2">
                  <Plus className="h-4 w-4" /> Adicionar Módulo
                </Button>
                <Button size="sm" variant="outline" onClick={handleSaveContent} disabled={isSaving}>
                  {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Salvar Conteúdo
                </Button>
              </div>

              {(selectedCourse.modules || []).length > 0 ? (
                <div className="space-y-4">
                  {(selectedCourse.modules || []).map((m, mi) => (
                    <div key={m.id || mi} className="border rounded-lg p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="grid md:grid-cols-2 gap-3 w-full">
                          <div className="space-y-2">
                            <Label>Título do Módulo</Label>
                            <Input
                              value={m.title}
                              onChange={(e) => {
                                const mods = [...(selectedCourse.modules || [])];
                                mods[mi] = { ...m, title: e.target.value };
                                setSelectedCourse({ ...selectedCourse, modules: mods });
                              }}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Descrição</Label>
                            <Input
                              value={m.description || ""}
                              onChange={(e) => {
                                const mods = [...(selectedCourse.modules || [])];
                                mods[mi] = { ...m, description: e.target.value };
                                setSelectedCourse({ ...selectedCourse, modules: mods });
                              }}
                            />
                          </div>
                        </div>
                        <Button variant="ghost" size="sm" className="text-destructive" onClick={() => removeModule(mi)}>
                          Remover
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
                                    const mods = [...(selectedCourse.modules || [])];
                                    const lessons = [...(m.lessons || [])];
                                    lessons[li] = { ...l, title: e.target.value };
                                    mods[mi] = { ...m, lessons };
                                    setSelectedCourse({ ...selectedCourse, modules: mods });
                                  }}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Tipo</Label>
                                <Select
                                  value={l.type}
                                  onValueChange={(v) => {
                                    const mods = [...(selectedCourse.modules || [])];
                                    const lessons = [...(m.lessons || [])];
                                    lessons[li] = { ...l, type: v as Lesson["type"] };
                                    mods[mi] = { ...m, lessons };
                                    setSelectedCourse({ ...selectedCourse, modules: mods });
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
                                <Label>URL do Recurso</Label>
                                <Input
                                  value={l.resource_url || ""}
                                  onChange={(e) => {
                                    const mods = [...(selectedCourse.modules || [])];
                                    const lessons = [...(m.lessons || [])];
                                    lessons[li] = { ...l, resource_url: e.target.value };
                                    mods[mi] = { ...m, lessons };
                                    setSelectedCourse({ ...selectedCourse, modules: mods });
                                  }}
                                  placeholder="Link do vídeo/PDF"
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
                                    disabled={isUploadingMaterial}
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
                                    const mods = [...(selectedCourse.modules || [])];
                                    const lessons = [...(m.lessons || [])];
                                    lessons[li] = { ...l, duration_minutes: parseInt(e.target.value || "0", 10) };
                                    mods[mi] = { ...m, lessons };
                                    setSelectedCourse({ ...selectedCourse, modules: mods });
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
                <Button variant="ghost" onClick={() => setOpenContentDialog(false)}>Fechar</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CoursesTab;