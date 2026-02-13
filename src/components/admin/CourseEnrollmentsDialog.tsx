"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Loader2, Trash2, Users, Mail, Calendar } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

interface Enrollment {
  id: string;
  user_id: string;
  created_at: string;
  profile: {
    full_name: string;
    email: string;
  } | null;
  progress_pct: number;
}

interface CourseEnrollmentsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courseSlug: string;
  courseTitle: string;
}

const CourseEnrollmentsDialog = ({
  open,
  onOpenChange,
  courseSlug,
  courseTitle,
}: CourseEnrollmentsDialogProps) => {
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRemoving, setIsRemoving] = useState<string | null>(null);

  const fetchEnrollments = async () => {
    if (!courseSlug) return;
    setLoading(true);
    
    // Limpa o slug para evitar problemas com hífens extras no final
    const cleanSlug = courseSlug.trim().replace(/-+$/, "");

    try {
      // 1. Buscar total de aulas do curso
      const { data: mods } = await supabase
        .from("academy_modules")
        .select("id")
        .eq("course_slug", cleanSlug);
      
      const moduleIds = (mods || []).map(m => m.id);
      let totalLessons = 0;
      if (moduleIds.length > 0) {
        const { count } = await supabase
          .from("academy_lessons")
          .select("id", { count: "exact", head: true })
          .in("module_id", moduleIds);
        totalLessons = count || 0;
      }

      // 2. Buscar matrículas (usando ilike para ser mais flexível com o slug)
      const { data: enrData, error: enrError } = await supabase
        .from("academy_enrollments")
        .select("id, user_id, created_at, course_slug")
        .ilike("course_slug", `\${cleanSlug}%`);

      if (enrError) throw enrError;

      if (!enrData || enrData.length === 0) {
        setEnrollments([]);
        setLoading(false);
        return;
      }

      // 3. Buscar perfis dos usuários matriculados
      const userIds = enrData.map(e => e.user_id);
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", userIds);

      const profilesMap = new Map();
      profilesData?.forEach(p => profilesMap.set(p.id, p));

      // 4. Buscar progresso de cada aluno
      const formatted: Enrollment[] = [];
      for (const enr of enrData) {
        const { count: done } = await supabase
          .from("academy_progress")
          .select("id", { count: "exact", head: true })
          .eq("user_id", enr.user_id)
          .eq("course_slug", enr.course_slug)
          .eq("status", "completed");

        const pct = totalLessons > 0 ? Math.round(((done || 0) / totalLessons) * 100) : 0;
        
        formatted.push({
          id: enr.id,
          user_id: enr.user_id,
          created_at: enr.created_at,
          profile: profilesMap.get(enr.user_id) || null,
          progress_pct: pct
        });
      }

      setEnrollments(formatted.sort((a, b) => b.progress_pct - a.progress_pct));
    } catch (err) {
      console.error("[EnrollmentsDialog] Erro:", err);
      toast.error("Erro ao carregar matrículas.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) fetchEnrollments();
  }, [open, courseSlug]);

  const handleRemoveEnrollment = async (enrollmentId: string) => {
    if (!confirm("Tem certeza que deseja remover a matrícula deste aluno?")) return;
    
    setIsRemoving(enrollmentId);
    try {
      const { error } = await supabase
        .from("academy_enrollments")
        .delete()
        .eq("id", enrollmentId);

      if (error) throw error;

      toast.success("Matrícula removida.");
      setEnrollments(prev => prev.filter(e => e.id !== enrollmentId));
    } catch (err) {
      toast.error("Erro ao remover matrícula.");
    } finally {
      setIsRemoving(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-6 border-b bg-card">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
              <DialogTitle>Alunos Matriculados</DialogTitle>
              <DialogDescription className="truncate max-w-md">
                Curso: {courseTitle}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm">Calculando progresso dos alunos...</p>
            </div>
          ) : enrollments.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Aluno</TableHead>
                    <TableHead>Progresso</TableHead>
                    <TableHead>Data Matrícula</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {enrollments.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell>
                        <div className="space-y-0.5">
                          <p className="text-sm font-bold">{e.profile?.full_name || "Usuário Desconhecido"}</p>
                          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                            <Mail className="h-3 w-3" /> {e.profile?.email || "N/A"}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="w-[200px]">
                        <div className="space-y-1.5">
                          <div className="flex justify-between text-[10px] font-medium">
                            <span>{e.progress_pct}% concluído</span>
                            {e.progress_pct === 100 && <Badge className="h-4 bg-success text-[8px] uppercase">Finalizado</Badge>}
                          </div>
                          <Progress value={e.progress_pct} className="h-1.5" />
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          {new Date(e.created_at).toLocaleDateString('pt-BR')}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:bg-destructive/10 h-8 w-8"
                          onClick={() => handleRemoveEnrollment(e.id)}
                          disabled={isRemoving === e.id}
                        >
                          {isRemoving === e.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-20 bg-secondary/10 rounded-xl border border-dashed">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p className="text-muted-foreground">Nenhum aluno matriculado neste curso ainda.</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CourseEnrollmentsDialog;