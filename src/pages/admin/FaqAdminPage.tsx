"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Plus, Edit2, Trash2, Tag, FolderOpen, Pencil, BookOpenText } from "lucide-react";
import { toast } from "sonner";

const csvToArray = (value: string) =>
  String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const arrayToCsv = (value: unknown) => (Array.isArray(value) ? value.filter(Boolean).join(", ") : "");

const FaqAdminPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState("faqs");
  const [faqs, setFaqs] = useState<any[]>([]);
  const [guides, setGuides] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [openFaqDialog, setOpenFaqDialog] = useState(false);
  const [selectedFaq, setSelectedFaq] = useState<any>(null);
  const [isSavingFaq, setIsSavingFaq] = useState(false);
  const [pendingSuggestionId, setPendingSuggestionId] = useState<string | null>(null);

  const [newCategoryMode, setNewCategoryMode] = useState(false);
  const [customCategory, setCustomCategory] = useState("");
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [categoryToRename, setCategoryToRename] = useState("");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [isRenaming, setIsRenaming] = useState(false);

  const [openGuideDialog, setOpenGuideDialog] = useState(false);
  const [selectedGuide, setSelectedGuide] = useState<any>(null);
  const [guideAudienceInput, setGuideAudienceInput] = useState("");
  const [guideVariantsInput, setGuideVariantsInput] = useState("");
  const [isSavingGuide, setIsSavingGuide] = useState(false);

  const defaultFaqCategory = useMemo(() => {
    const categorySet = new Set<string>();
    for (const faq of faqs) {
      const category = String(faq?.category || "").trim();
      if (category) categorySet.add(category);
    }
    const sortedCategories = Array.from(categorySet).sort();
    return sortedCategories[0] || "geral";
  }, [faqs]);

  useEffect(() => {
    fetchKnowledgeBase();
  }, []);

  useEffect(() => {
    const questionFromQuery = String(searchParams.get("createFromQuestion") || "").trim();
    if (!questionFromQuery) return;

    const suggestionIdFromQuery = String(searchParams.get("sourceSuggestionId") || "").trim();
    setActiveTab("faqs");
    setSelectedFaq({
      question: questionFromQuery,
      answer: "",
      category: defaultFaqCategory,
      position: faqs.length,
      is_published: true,
    });
    setPendingSuggestionId(suggestionIdFromQuery || null);
    setNewCategoryMode(false);
    setCustomCategory("");
    setOpenFaqDialog(true);

    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("createFromQuestion");
    nextParams.delete("sourceSuggestionId");
    setSearchParams(nextParams, { replace: true });
  }, [searchParams, setSearchParams, defaultFaqCategory, faqs.length]);

  const fetchKnowledgeBase = async (silent = false) => {
    if (!silent) setLoading(true);
    else setIsRefreshing(true);

    try {
      const [faqRes, guidesRes] = await Promise.all([
        supabase.from("support_faqs").select("*").order("position", { ascending: true }),
        supabase.from("support_guides").select("*").order("position", { ascending: true }),
      ]);

      if (faqRes.error) throw faqRes.error;
      setFaqs(faqRes.data || []);

      if (guidesRes.error) {
        if (String(guidesRes.error.code || "") === "42P01") {
          setGuides([]);
          toast.error("Tabela support_guides nao encontrada. Execute a sincronizacao da Central de Suporte.");
        } else {
          throw guidesRes.error;
        }
      } else {
        setGuides(guidesRes.data || []);
      }
    } catch (error) {
      console.error(error);
      toast.error("Erro ao carregar base de conhecimento.");
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  const groupedFaqs = useMemo(() => {
    const groups: Record<string, any[]> = {};
    for (const faq of faqs) {
      const category = faq.category || "Geral";
      if (!groups[category]) groups[category] = [];
      groups[category].push(faq);
    }
    return groups;
  }, [faqs]);

  const categories = useMemo(() => Object.keys(groupedFaqs).sort(), [groupedFaqs]);

  const handleNewFaq = (category?: string) => {
    setSelectedFaq({
      question: "",
      answer: "",
      category: category || categories[0] || "geral",
      position: faqs.length,
      is_published: true,
    });
    setPendingSuggestionId(null);
    setNewCategoryMode(false);
    setCustomCategory("");
    setOpenFaqDialog(true);
  };

  const handleEditFaq = (faq: any) => {
    setSelectedFaq({ ...faq });
    setPendingSuggestionId(null);
    setNewCategoryMode(false);
    setCustomCategory("");
    setOpenFaqDialog(true);
  };

  const closeFaqDialog = () => {
    setOpenFaqDialog(false);
    setSelectedFaq(null);
    setPendingSuggestionId(null);
    setNewCategoryMode(false);
    setCustomCategory("");
  };

  const handleSaveFaq = async () => {
    if (!selectedFaq?.question || !selectedFaq?.answer) {
      toast.error("Pergunta e resposta sao obrigatorias.");
      return;
    }

    const finalCategory = newCategoryMode ? customCategory.trim() : selectedFaq.category;
    if (!finalCategory) {
      toast.error("Categoria obrigatoria.");
      return;
    }

    setIsSavingFaq(true);
    try {
      const payload = { ...selectedFaq, category: finalCategory };
      const { error } = await supabase.from("support_faqs").upsert(payload);
      if (error) throw error;

      if (pendingSuggestionId) {
        const { error: suggestionError } = await supabase
          .from("chatbot_unanswered_questions")
          .update({ status: "implemented" })
          .eq("id", pendingSuggestionId);

        if (suggestionError) {
          console.error(suggestionError);
          toast.success("FAQ salva!");
        } else {
          toast.success("FAQ salva e sugestao marcada como implementada.");
        }
      } else {
        toast.success("FAQ salva!");
      }

      closeFaqDialog();
      fetchKnowledgeBase(true);
    } catch (error) {
      console.error(error);
      toast.error("Erro ao salvar FAQ.");
    } finally {
      setIsSavingFaq(false);
    }
  };

  const handleDeleteFaq = async (id: string) => {
    if (!confirm("Deseja excluir esta FAQ?")) return;
    try {
      const { error } = await supabase.from("support_faqs").delete().eq("id", id);
      if (error) throw error;
      toast.success("FAQ removida.");
      fetchKnowledgeBase(true);
    } catch (error) {
      console.error(error);
      toast.error("Erro ao excluir FAQ.");
    }
  };

  const handleRenameCategory = async () => {
    if (!newCategoryName.trim() || newCategoryName === categoryToRename) {
      setRenameDialogOpen(false);
      return;
    }

    setIsRenaming(true);
    try {
      const { error } = await supabase
        .from("support_faqs")
        .update({ category: newCategoryName.trim() })
        .eq("category", categoryToRename);
      if (error) throw error;

      toast.success("Categoria renomeada.");
      setRenameDialogOpen(false);
      fetchKnowledgeBase(true);
    } catch (error) {
      console.error(error);
      toast.error("Erro ao renomear categoria.");
    } finally {
      setIsRenaming(false);
    }
  };

  const handleNewGuide = () => {
    setSelectedGuide({
      title: "",
      module: "geral",
      audience: [],
      question_variants: [],
      content: "",
      position: guides.length,
      is_published: true,
    });
    setGuideAudienceInput("");
    setGuideVariantsInput("");
    setOpenGuideDialog(true);
  };

  const handleEditGuide = (guide: any) => {
    setSelectedGuide({ ...guide });
    setGuideAudienceInput(arrayToCsv(guide.audience));
    setGuideVariantsInput(arrayToCsv(guide.question_variants));
    setOpenGuideDialog(true);
  };

  const handleSaveGuide = async () => {
    if (!selectedGuide?.title || !selectedGuide?.content) {
      toast.error("Titulo e conteudo do guia sao obrigatorios.");
      return;
    }

    setIsSavingGuide(true);
    try {
      const payload = {
        ...selectedGuide,
        audience: csvToArray(guideAudienceInput),
        question_variants: csvToArray(guideVariantsInput),
        module: String(selectedGuide.module || "geral").trim() || "geral",
      };
      const { error } = await supabase.from("support_guides").upsert(payload);
      if (error) throw error;

      toast.success("Guia salvo!");
      setOpenGuideDialog(false);
      fetchKnowledgeBase(true);
    } catch (error) {
      console.error(error);
      const message =
        String((error as any)?.code || "") === "42P01"
          ? "Tabela support_guides nao encontrada. Execute a sincronizacao da Central de Suporte."
          : "Erro ao salvar guia.";
      toast.error(message);
    } finally {
      setIsSavingGuide(false);
    }
  };

  const handleDeleteGuide = async (id: string) => {
    if (!confirm("Deseja excluir este guia de uso?")) return;
    try {
      const { error } = await supabase.from("support_guides").delete().eq("id", id);
      if (error) throw error;
      toast.success("Guia removido.");
      fetchKnowledgeBase(true);
    } catch (error) {
      console.error(error);
      const message =
        String((error as any)?.code || "") === "42P01"
          ? "Tabela support_guides nao encontrada. Execute a sincronizacao da Central de Suporte."
          : "Erro ao excluir guia.";
      toast.error(message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Base de Conhecimento</h1>
          <p className="text-muted-foreground">Gerencie FAQs e guias de uso consumidos pelo chatbot.</p>
        </div>
        <div className="flex items-center gap-3">
          {isRefreshing && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          {activeTab === "faqs" ? (
            <Button onClick={() => handleNewFaq()} className="gap-2">
              <Plus className="h-4 w-4" /> Nova FAQ
            </Button>
          ) : (
            <Button onClick={handleNewGuide} className="gap-2">
              <Plus className="h-4 w-4" /> Novo Guia
            </Button>
          )}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="faqs">FAQs</TabsTrigger>
          <TabsTrigger value="guides">Guias de Uso</TabsTrigger>
        </TabsList>

        <TabsContent value="faqs" className="space-y-8">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : categories.length > 0 ? (
            categories.map((category) => (
              <Card
                key={category}
                id={`category-${category.toLowerCase().replace(/\s+/g, "-")}`}
                className="border-none bg-card/50 shadow-sm"
              >
                <CardHeader className="flex flex-col justify-between gap-4 pb-3 sm:flex-row sm:items-center">
                  <div className="flex items-center gap-2">
                    <CardTitle className="flex items-center gap-2 text-lg uppercase tracking-wider text-primary">
                      <FolderOpen className="h-5 w-5" />
                      {category}
                      <Badge variant="secondary" className="ml-2 font-mono">
                        {groupedFaqs[category].length}
                      </Badge>
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
                    className="h-8 gap-2 border-primary/20 text-primary hover:bg-primary/5"
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
                          <TableHead className="w-[100px] text-right">Acoes</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {groupedFaqs[category].map((faq) => (
                          <TableRow key={faq.id}>
                            <TableCell className="font-mono text-xs text-muted-foreground">{faq.position}</TableCell>
                            <TableCell className="max-w-md truncate font-medium">{faq.question}</TableCell>
                            <TableCell>
                              <Badge
                                variant={faq.is_published ? "default" : "outline"}
                                className={faq.is_published ? "bg-success hover:bg-success" : ""}
                              >
                                {faq.is_published ? "Publicado" : "Rascunho"}
                              </Badge>
                            </TableCell>
                            <TableCell className="flex justify-end gap-1 text-right">
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEditFaq(faq)}>
                                <Edit2 className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:bg-destructive/10"
                                onClick={() => handleDeleteFaq(faq.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <Card className="p-12 text-center text-muted-foreground">
              <Tag className="mx-auto mb-4 h-12 w-12 opacity-20" />
              <p>Nenhuma FAQ cadastrada ainda.</p>
              <Button variant="outline" className="mt-4" onClick={() => handleNewFaq()}>
                Criar Primeira Pergunta
              </Button>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="guides">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <Card className="border-none bg-card/50 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg text-primary">
                  <BookOpenText className="h-5 w-5" />
                  Guias de Uso
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border bg-card">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[40px]">Pos.</TableHead>
                        <TableHead>Titulo</TableHead>
                        <TableHead>Modulo</TableHead>
                        <TableHead>Audiencia</TableHead>
                        <TableHead className="w-[120px]">Status</TableHead>
                        <TableHead className="w-[100px] text-right">Acoes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {guides.length > 0 ? (
                        guides.map((guide) => (
                          <TableRow key={guide.id}>
                            <TableCell className="font-mono text-xs text-muted-foreground">{guide.position}</TableCell>
                            <TableCell className="max-w-xs truncate font-medium">{guide.title}</TableCell>
                            <TableCell className="text-xs uppercase text-muted-foreground">{guide.module || "geral"}</TableCell>
                            <TableCell className="max-w-xs truncate text-xs">{arrayToCsv(guide.audience) || "-"}</TableCell>
                            <TableCell>
                              <Badge
                                variant={guide.is_published ? "default" : "outline"}
                                className={guide.is_published ? "bg-success hover:bg-success" : ""}
                              >
                                {guide.is_published ? "Publicado" : "Rascunho"}
                              </Badge>
                            </TableCell>
                            <TableCell className="flex justify-end gap-1 text-right">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => handleEditGuide(guide)}
                              >
                                <Edit2 className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:bg-destructive/10"
                                onClick={() => handleDeleteGuide(guide.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                            Nenhum guia de uso cadastrado.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      <Dialog
        open={openFaqDialog}
        onOpenChange={(open) => {
          if (!open) closeFaqDialog();
          else setOpenFaqDialog(true);
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedFaq?.id ? "Editar FAQ" : "Nova FAQ"}</DialogTitle>
            <DialogDescription>Organize perguntas frequentes para busca rapida dos usuarios.</DialogDescription>
          </DialogHeader>

          {selectedFaq && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Pergunta</Label>
                <Input
                  value={selectedFaq.question}
                  onChange={(e) => setSelectedFaq({ ...selectedFaq, question: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Resposta</Label>
                <Textarea
                  rows={6}
                  value={selectedFaq.answer}
                  onChange={(e) => setSelectedFaq({ ...selectedFaq, answer: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Tag className="h-3 w-3" /> Categoria
                  </Label>
                  {newCategoryMode ? (
                    <div className="flex gap-2">
                      <Input
                        placeholder="Nome da nova categoria"
                        value={customCategory}
                        onChange={(e) => setCustomCategory(e.target.value)}
                        autoFocus
                      />
                      <Button variant="ghost" size="sm" onClick={() => setNewCategoryMode(false)}>
                        Cancelar
                      </Button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <Select
                        value={selectedFaq.category}
                        onValueChange={(value) => setSelectedFaq({ ...selectedFaq, category: value })}
                      >
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="Selecione uma categoria" />
                        </SelectTrigger>
                        <SelectContent>
                          {categories.map((cat) => (
                            <SelectItem key={cat} value={cat}>
                              {cat}
                            </SelectItem>
                          ))}
                          {categories.length === 0 && <SelectItem value="geral">Geral</SelectItem>}
                        </SelectContent>
                      </Select>
                      <Button variant="outline" size="sm" onClick={() => setNewCategoryMode(true)}>
                        Nova
                      </Button>
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Posicao na Lista</Label>
                  <Input
                    type="number"
                    value={selectedFaq.position}
                    onChange={(e) => setSelectedFaq({ ...selectedFaq, position: parseInt(e.target.value || "0", 10) || 0 })}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between rounded-lg border bg-secondary/10 p-4">
                <div className="space-y-0.5">
                  <Label>Visibilidade</Label>
                  <p className="text-[10px] text-muted-foreground">Define se a pergunta aparece na area publica.</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium">{selectedFaq.is_published ? "Publicado" : "Rascunho"}</span>
                  <Switch
                    checked={selectedFaq.is_published}
                    onCheckedChange={(checked) => setSelectedFaq({ ...selectedFaq, is_published: checked })}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button variant="ghost" onClick={closeFaqDialog}>
                  Cancelar
                </Button>
                <Button onClick={handleSaveFaq} disabled={isSavingFaq}>
                  {isSavingFaq ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Salvar FAQ
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Renomear Categoria</DialogTitle>
            <DialogDescription>
              Isso atualiza o nome da categoria em todas as perguntas vinculadas.
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
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="Digite o novo nome..."
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRenameDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleRenameCategory}
              disabled={isRenaming || !newCategoryName.trim() || newCategoryName === categoryToRename}
            >
              {isRenaming ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Confirmar Alteracao
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={openGuideDialog} onOpenChange={setOpenGuideDialog}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{selectedGuide?.id ? "Editar Guia de Uso" : "Novo Guia de Uso"}</DialogTitle>
            <DialogDescription>Guias alimentam as respostas do chatbot sobre como usar funcionalidades.</DialogDescription>
          </DialogHeader>

          {selectedGuide && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2 md:col-span-2">
                  <Label>Titulo</Label>
                  <Input
                    value={selectedGuide.title}
                    onChange={(e) => setSelectedGuide({ ...selectedGuide, title: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Modulo</Label>
                  <Input
                    placeholder="ex: suporte, dashboard, busca"
                    value={selectedGuide.module || ""}
                    onChange={(e) => setSelectedGuide({ ...selectedGuide, module: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Posicao</Label>
                  <Input
                    type="number"
                    value={selectedGuide.position}
                    onChange={(e) =>
                      setSelectedGuide({ ...selectedGuide, position: parseInt(e.target.value || "0", 10) || 0 })
                    }
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Audiencia (separado por virgula)</Label>
                  <Input
                    placeholder="professional, company, family"
                    value={guideAudienceInput}
                    onChange={(e) => setGuideAudienceInput(e.target.value)}
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Variacoes de Pergunta (separado por virgula)</Label>
                  <Input
                    placeholder="como abrir chamado, como criar ticket"
                    value={guideVariantsInput}
                    onChange={(e) => setGuideVariantsInput(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Conteudo do Guia</Label>
                <Textarea
                  rows={8}
                  value={selectedGuide.content}
                  onChange={(e) => setSelectedGuide({ ...selectedGuide, content: e.target.value })}
                />
              </div>

              <div className="flex items-center justify-between rounded-lg border bg-secondary/10 p-4">
                <div className="space-y-0.5">
                  <Label>Visibilidade</Label>
                  <p className="text-[10px] text-muted-foreground">Quando desativado, o chatbot nao usa este guia.</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium">{selectedGuide.is_published ? "Publicado" : "Rascunho"}</span>
                  <Switch
                    checked={selectedGuide.is_published}
                    onCheckedChange={(checked) => setSelectedGuide({ ...selectedGuide, is_published: checked })}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button variant="ghost" onClick={() => setOpenGuideDialog(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleSaveGuide} disabled={isSavingGuide}>
                  {isSavingGuide ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Salvar Guia
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
