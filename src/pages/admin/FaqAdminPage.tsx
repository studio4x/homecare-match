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
import { Loader2, Plus, Edit2, Trash2, Tag, FolderOpen, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";

const FaqAdminPage = () => {
  const [faqs, setFaqs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Estados para FAQ individual
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedFaq, setSelectedFaq] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  
  // Estados para Categorias
  const [newCategoryMode, setNewCategoryMode] = useState(false);
  const [customCategory, setCustomCategory] = useState("");
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [categoryToRename, setCategoryToRename] = useState("");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [isRenaming, setIsRenaming] = useState(false);

  useEffect(() => {
    fetchFaqs();
  }, []);

  const fetchFaqs = async (silent = false) => {
    if (!silent) setLoading(true);
    else setIsRefreshing(true);
    
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
      setIsRefreshing(false);
    }
  };

  const groupedFaqs = useMemo(() => {
    const groups: Record<string, any[]> = {};
    faqs.forEach(faq => {
      const cat = faq.category || "Geral";
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(faq);
    });
    return groups;
  }, [faqs]);

  const categories = useMemo(() => Object.keys(groupedFaqs).sort(), [groupedFaqs]);

  const handleNewFaq = (category?: string) => {
    setSelectedFaq({ 
      question: "", 
      answer: "", 
      category: category || categories[0] || "geral", 
      position: faqs.length, 
      is_published: true 
    });
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
      fetchFaqs(true);
    } catch (err) {
      toast.error("Erro ao salvar FAQ.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleRenameCategory = async () => {
    if (!newCategoryName.trim() || newCategoryName === categoryToRename) {
      setRenameDialogOpen(false);
      return;
    }

    setIsRenaming(true);
    try {
      const { error, count } = await supabase
        .from("support_faqs")
        .update({ category: newCategoryName.trim() })
        .eq("category", categoryToRename);

      if (error) throw error;

      toast.success(`Categoria renomeada! ${count} perguntas atualizadas.`);
      setRenameDialogOpen(false);
      fetchFaqs(true);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao renomear categoria.");
    } finally {
      setIsRenaming(false);
    }
  };

  const handleDeleteFaq = async (id: string) => {
    if (!confirm("Deseja excluir esta FAQ?")) return;
    try {
      const { error } = await supabase.from("support_faqs").delete().eq("id", id);
      if (error) throw error;
      toast.success("FAQ removida.");
      fetchFaqs(true);
    } catch (err) {
      toast.error("Erro ao excluir.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Base de Conhecimento</h1>
          <p className="text-muted-foreground">Gerencie as perguntas frequentes organizadas por categorias.</p>
        </div>
        <div className="flex items-center gap-3">
          {isRefreshing && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          <Button onClick={() => handleNewFaq()} className="gap-2">
            <Plus className="h-4 w-4" /> Nova FAQ
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="animate-spin text-primary" /></div>
      ) : categories.length > 0 ? (
        <div className="space-y-8">
          {categories.map(category => (
            <Card 
              key={category} 
              id={`category-${category.toLowerCase().replace(/\s+/g, '-')}`}
              className="border-none shadow-sm bg-card/50 scroll-mt-20"
            >
              <CardHeader className="pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-lg flex items-center gap-2 uppercase tracking-wider text-primary">
                    <FolderOpen className="h-5 w-5" />
                    {category}
                    <Badge variant="secondary" className="ml-2 font-mono">{groupedFaqs[category].length}</Badge>
                  </CardTitle>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 text-muted-foreground hover:text-primary"
                    onClick={() => {
                      setCategoryToRename(category);
                      setNewCategoryName(category);
                      setRenameDialogOpen(true);
                    }}
                    title="Renomear Categoria"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="h-8 gap-2 border-primary/20 hover:bg-primary/5 text-primary"
                  onClick={() => handleNewFaq(category)}
                >
                  <Plus className="h-3 w-3" /> Adicionar nesta categoria
                </Button>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border bg-card">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[40px]">Pos.</TableHead>
                        <TableHead>Pergunta</TableHead>
                        <TableHead className="w-[120px]">Status</TableHead>
                        <TableHead className="text-right w-[100px]">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {groupedFaqs[category].map((f) => (
                        <TableRow key={f.id}>
                          <TableCell className="text-xs text-muted-foreground font-mono">{f.position}</TableCell>
                          <TableCell className="font-medium max-w-md truncate">{f.question}</TableCell>
                          <TableCell>
                            <Badge variant={f.is_published ? "default" : "outline"} className={f.is_published ? "bg-success hover:bg-success" : ""}>
                              {f.is_published ? "Publicado" : "Rascunho"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right flex justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEditFaq(f)}><Edit2 className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => handleDeleteFaq(f.id)}><Trash2 className="h-4 w-4" /></Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="p-12 text-center text-muted-foreground">
          <Tag className="h-12 w-12 mx-auto mb-4 opacity-20" />
          <p>Nenhuma FAQ cadastrada ainda.</p>
          <Button variant="outline" className="mt-4" onClick={() => handleNewFaq()}>Criar Primeira Pergunta</Button>
        </Card>
      )}

      {/* Modal de FAQ Individual */}
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

      {/* Modal de Renomear Categoria */}
      <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Renomear Categoria</DialogTitle>
            <DialogDescription>
              Isso atualizará o nome da categoria em todas as perguntas vinculadas a ela.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nome Atual</Label>
              <Input value={categoryToRename} disabled className="bg-muted" />
            </div>
            <div className="space-y-2">
              <Label>Novo Nome</Label>
              <Input 
                value={newCategoryName} 
                onChange={e => setNewCategoryName(e.target.value)} 
                placeholder="Digite o novo nome..."
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRenameDialogOpen(false)}>Cancelar</Button>
            <Button 
              onClick={handleRenameCategory} 
              disabled={isRenaming || !newCategoryName.trim() || newCategoryName === categoryToRename}
            >
              {isRenaming ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Confirmar Alteração
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FaqAdminPage;