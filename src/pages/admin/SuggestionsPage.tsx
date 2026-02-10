"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Trash2, MessageSquare, Calendar, User } from "lucide-react";
import { toast } from "sonner";

const SuggestionsPage = () => {
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSuggestions = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("suggestions")
        .select(`
          id,
          content,
          created_at,
          user:profiles(full_name, email, role)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setSuggestions(data || []);
    } catch (err: any) {
      console.error("[SuggestionsPage] Erro:", err);
      toast.error("Erro ao carregar sugestões. Certifique-se de ter sincronizado o banco.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSuggestions();
  }, []);

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase.from("suggestions").delete().eq("id", id);
      if (error) throw error;
      setSuggestions(prev => prev.filter(s => s.id !== id));
      toast.success("Sugestão removida.");
    } catch (err) {
      toast.error("Erro ao excluir.");
    }
  };

  if (loading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Sugestões de Recursos</h1>
        <p className="text-muted-foreground">Veja o que os usuários estão pedindo para a plataforma.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            Feed de Sugestões ({suggestions.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[200px]">Usuário</TableHead>
                  <TableHead>Sugestão</TableHead>
                  <TableHead className="w-[150px]">Data</TableHead>
                  <TableHead className="w-[80px] text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {suggestions.length > 0 ? suggestions.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>
                      {s.user ? (
                        <div className="space-y-0.5">
                          <p className="text-sm font-medium leading-none">{s.user.full_name}</p>
                          <p className="text-xs text-muted-foreground">{s.user.email}</p>
                          <p className="text-[10px] uppercase font-bold text-primary/70">{s.user.role}</p>
                        </div>
                      ) : (
                        <span className="text-muted-foreground italic text-sm">Anônimo</span>
                      )}
                    </TableCell>
                    <TableCell className="max-w-md">
                      <p className="text-sm whitespace-pre-wrap leading-relaxed">{s.content}</p>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        {new Date(s.created_at).toLocaleDateString('pt-BR')}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="text-destructive hover:bg-destructive/10"
                        onClick={() => handleDelete(s.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                )) : (
                  <TableRow>
                    <TableCell colSpan={4} className="h-32 text-center text-muted-foreground">
                      Nenhuma sugestão recebida ainda.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SuggestionsPage;