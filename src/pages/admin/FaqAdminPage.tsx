"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { Loader2, Plus, Edit2, Trash2, FileText } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";

const FaqAdminPage = () => {
  const [faqs, setFaqs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedFaq, setSelectedFaq] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchFaqs();
  }, []);

  const fetchFaqs = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("support_faqs")
        .select("*")
        .order("position", { ascending: true });
      if (error) throw error;
      setFaqs(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleNewFaq = () => {
    setSelectedFaq({ question: "", answer: "", category: "geral", position: faqs.length, is_published: true });
    setOpenDialog(true);
  };

  const handleEditFaq = (faq: any) => {
    setSelectedFaq({ ...faq });
    setOpenDialog(true);
  };

  const handleSaveFaq = async () => {
    if (!selectedFaq.question || !selectedFaq.answer) return;
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("support_faqs")
        .upsert(selectedFaq);
      if (error) throw error;
      toast.success("FAQ salva!");
      setOpenDialog(false);
      fetchFaqs();
    } catch (err) {
      toast.error("Erro ao salvar FAQ. Certifique-se de sincronizar o suporte nas configurações.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteFaq = async (id: string) => {
    if (!confirm("Deseja excluir esta FAQ?")) return;
    try {
      const { error } = await supabase.from("support_faqs").delete().eq("id", id);
      if (error) throw error;
      toast.success("FAQ removida.");
      fetchFaqs();
    } catch (err) {
      toast.error("Erro ao excluir.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Base de Conhecimento</h1>
          <p className="text-muted-foreground">Gerencie as perguntas frequentes e artigos de ajuda.</p>
        </div>
        <Button onClick={handleNewFaq} className="gap-2">
          <Plus className="h-4 w-4" /> Nova FAQ
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="animate-spin text-primary" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pergunta</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {faqs.map((f) => (
                  <TableRow key={f.id}>
                    <TableCell className="font-medium max-w-md truncate">{f.question}</TableCell>
                    <TableCell className="capitalize">{f.category}</TableCell>
                    <TableCell>{f.is_published ? "Publicado" : "Rascunho"}</TableCell>
                    <TableCell className="text-right flex justify-end gap-2">
                      <Button variant="ghost" size="sm" onClick={() => handleEditFaq(f)}><Edit2 className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="sm" className="text-destructive" onClick={() => handleDeleteFaq(f.id)}><Trash2 className="h-4 w-4" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={openDialog} onOpenChange={setOpenDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedFaq?.id ? "Editar FAQ" : "Nova FAQ"}</DialogTitle>
            <DialogDescription>
              Preencha os campos abaixo para gerenciar o conteúdo da base de conhecimento.
            </DialogDescription>
          </DialogHeader>
          {selectedFaq && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Pergunta</Label>
                <Input value={selectedFaq.question} onChange={e => setSelectedFaq({...selectedFaq, question: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Resposta</Label>
                <Textarea rows={6} value={selectedFaq.answer} onChange={e => setSelectedFaq({...selectedFaq, answer: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Categoria</Label>
                  <Input value={selectedFaq.category} onChange={e => setSelectedFaq({...selectedFaq, category: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label>Posição</Label>
                  <Input type="number" value={selectedFaq.position} onChange={e => setSelectedFaq({...selectedFaq, position: parseInt(e.target.value) || 0})} />
                </div>
              </div>
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <Label>Publicado</Label>
                <Switch checked={selectedFaq.is_published} onCheckedChange={v => setSelectedFaq({...selectedFaq, is_published: v})} />
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setOpenDialog(false)}>Cancelar</Button>
                <Button onClick={handleSaveFaq} disabled={isSaving}>
                  {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null} Salvar
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FaqAdminPage;