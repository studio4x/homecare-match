"use client";

import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import Layout from "@/components/layout/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, ShieldCheck, Search, XCircle, Award, Calendar, Clock, User, Info } from "lucide-react";
import { toast } from "sonner";

const ValidateCertificate = () => {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [certificate, setCertificate] = useState<any>(null);
  const [searched, setSearched] = useState(false);

  const handleValidate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;

    setLoading(true);
    setSearched(false);
    setCertificate(null);

    try {
      // Alterado para .ilike para ser insensível a maiúsculas/minúsculas
      const { data, error } = await supabase
        .from("certificates")
        .select(`
          *,
          course:academy_courses(title),
          user:profiles(full_name)
        `)
        .ilike("validation_code", code.trim())
        .maybeSingle();

      if (error) throw error;

      setCertificate(data);
      setSearched(true);
      
      if (!data) {
        toast.error("Código de validação não encontrado.");
      } else {
        toast.success("Selo validado com sucesso!");
      }
    } catch (err) {
      console.error(err);
      toast.error("Erro ao validar código.");
    } finally {
      setLoading(false);
    }
  };

  const formatWorkload = (minutes: number) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h > 0 && m > 0) return `${h}h ${m}min`;
    if (h > 0) return `${h}h`;
    return `${m}min`;
  };

  return (
    <Layout>
      <div className="container mx-auto px-4 py-12 max-w-2xl">
        <div className="text-center mb-10">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <ShieldCheck className="h-10 w-10 text-primary" />
          </div>
          <h1 className="text-3xl font-bold text-foreground">Validação Academy</h1>
          <p className="mt-2 text-muted-foreground">
            Verifique a autenticidade de selos e conquistas internas da plataforma.
          </p>
        </div>

        <Card className="shadow-lg border-primary/10">
          <CardContent className="pt-6">
            <form onSubmit={handleValidate} className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Ex: HCM-XXXX-XXXX"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  className="pl-10 h-12 text-lg font-mono uppercase tracking-wider"
                />
              </div>
              <Button type="submit" size="lg" className="h-12 px-8" disabled={loading}>
                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Validar"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="mt-8 animate-fade-in">
          {certificate ? (
            <Card className="border-success/20 bg-success/5 overflow-hidden">
              <div className="bg-success p-4 text-white flex items-center gap-2">
                <ShieldCheck className="h-5 w-5" />
                <span className="font-bold uppercase tracking-wider text-sm">Conquista Autêntica</span>
              </div>
              <CardContent className="p-6 space-y-6">
                <div className="flex items-start gap-4">
                  <div className="h-12 w-12 rounded-xl bg-white shadow-sm flex items-center justify-center shrink-0">
                    <Award className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1">Conteúdo</p>
                    <h3 className="text-xl font-bold text-foreground leading-tight">{certificate.course.title}</h3>
                  </div>
                </div>

                <div className="grid gap-6 sm:grid-cols-2 pt-4 border-t border-success/10">
                  <div className="flex items-center gap-3">
                    <User className="h-5 w-5 text-primary" />
                    <div>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase">Profissional</p>
                      <p className="font-semibold">{certificate.user.full_name}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Calendar className="h-5 w-5 text-primary" />
                    <div>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase">Concluído em</p>
                      <p className="font-semibold">{new Date(certificate.issued_at).toLocaleDateString('pt-BR')}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Clock className="h-5 w-5 text-primary" />
                    <div>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase">Carga Horária</p>
                      <p className="font-semibold">{formatWorkload(certificate.workload_minutes)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <ShieldCheck className="h-5 w-5 text-primary" />
                    <div>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase">Status</p>
                      <Badge className="bg-success text-white border-none">Válido</Badge>
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-white/50 border rounded-lg flex gap-3 items-start">
                  <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                  <p className="text-[10px] text-muted-foreground leading-tight">
                    Este registro confirma que o profissional completou o conteúdo educativo na plataforma HomeCare Match. Não possui validade como título acadêmico ou técnico oficial.
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : searched ? (
            <Card className="border-destructive/20 bg-destructive/5">
              <CardContent className="p-8 text-center space-y-4">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
                  <XCircle className="h-6 w-6 text-destructive" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-lg font-bold text-destructive">Código não encontrado</h3>
                  <p className="text-sm text-muted-foreground">
                    O código informado não corresponde a nenhuma conquista registrada em nossa plataforma.
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </Layout>
  );
};

export default ValidateCertificate;