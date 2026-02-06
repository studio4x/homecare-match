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

const STORAGE_PATH = "academy/courses.json";
const HERO_DIR = "academy/hero";

const CoursesTab = () => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [openDialog, setOpenDialog] = useState<boolean>(false);
  const [isUploading, setIsUploading] = useState<boolean>(false);

  const heroRef = useRef<HTMLInputElement>(null);

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

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex items-center justify-between">
          <CardTitle>Cursos de Capacitação</CardTitle>
          <Button onClick={handleNewCourse} className="gap-2">
            <Plus className="h-4 w-4" /> Novo Curso
          </Button>
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
    </div>
  );
};

export default CoursesTab;