"use client";

import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Plus, Edit2, Trash2, Tag } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";

const FaqAdminPage = () => {
  const [faqs, setFaqs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedFaq, setSelectedFaq] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [newCategoryMode, setNewCategoryMode] = useState(false);
  const [customCategory, setCustomCategory] = useState("");

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

  // Extrai categorias únicas existentes
  const categories = useMemo(() => {
    const set = new Set(faqs.map(f => f.category).filter(Boolean));
    return Array.from(set).sort();
  }, [faqs]);

  const handleNewFaq = () => {
    setSelectedFaq({ question: "", answer: "", category: categories[0] || "geral", position: faqs.length, is_published: true });
    setNewCategoryMode(false);
    setCustomCategory("");
    setOpenDialog(true);
  };

  const handleEditFaq = (faq: any) => {
    setSelectedFaq({ ...faq });
    setNewCategoryMode(false);
    setCustomCategory("");
    setOpenDialog(true);
  };

  const handleSaveFaq = async () => {
    if (!selectedFaq.question || !selectedFaq.answer) return;
    
    const finalCategory = newCategoryMode ? customCategory.trim() : selectedFaq.category;
    if (!finalCategory) {
      toast.error("A categoria é obrigatória.");
      return;
    }

    setIsSaving(true);
    try {
      const payload = { ...selectedFaq, category: finalCategory };
      const { error } = await supabase
        .from("support_faqs")
        .upsert(payload);
      if (error) throw error;
      toast.success("FAQ salva!");
      setOpenDialog(false);
      fetchFaqs();
    } catch (err) {
      toast.error("Erro ao salvar FAQ.");
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
                    <TableCell>
                      <Badge variant="secondary" className="capitalize font-normal">
                        {f.category}
                      </Badge>
                    </TableCell>
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
              Organize sua central de ajuda por categorias para facilitar a busca dos usuários.
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
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Tag className="h-3 w-3" /> Categoria
                  </Label>
                  {newCategoryMode ? (
                    <div className="flex gap-2">
                      <Input 
                        placeholder="Nome da nova categoria" 
                        value={customCategory} 
                        onChange={e => setCustomCategory(e.target.value)}
                        autoFocus
                      />
                      <Button variant="ghost" size="sm" onClick={() => setNewCategoryMode(false)}>Cancelar</Button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <Select 
                        value={selectedFaq.category} 
                        onValueChange={v => setSelectedFaq({...selectedFaq, category: v})}
                      >
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="Selecione uma categoria" />
                        </SelectTrigger>
                        <SelectContent>
                          {categories.map(cat => (
                            <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                          ))}
                          {categories.length === 0 && <SelectItem value="geral">Geral</SelectItem>}
                        </SelectContent>
                      </Select>
                      <Button variant="outline" size="sm" onClick={() => setNewCategoryMode(true)}>Nova</Button>
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Posição na Lista</Label>
                  <Input type="number" value={selectedFaq.position} onChange={e => setSelectedFaq({...selectedFaq, position: parseInt(e.target.value) || 0})} />
                </div>
              </div>

              <div className="flex items-center justify-between p-4 border rounded-lg bg-secondary/10">
                <div className="space-y-0.5">
                  <Label>Visibilidade</Label>
                  <p className="text-[10px] text-muted-foreground">Define se a pergunta aparece na página pública.</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium">{selectedFaq.is_published ? "Publicado" : "Rascunho"}</span>
                  <Switch checked={selectedFaq.is_published} onCheckedChange={v => setSelectedFaq({...selectedFaq, is_published: v})} />
                </div>
              </div>

              <DialogFooter>
                <Button variant="ghost" onClick={() => setOpenDialog(false)}>Cancelar</Button>
                <Button onClick={handleSaveFaq} disabled={isSaving}>
                  {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null} Salvar FAQ
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