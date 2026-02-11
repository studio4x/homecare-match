"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import Layout from "@/components/layout/Layout";
import { supabase } from "@/integrations/supabase/client";
import { 
  Accordion, 
  AccordionContent, 
  AccordionItem, 
  AccordionTrigger 
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  LifeBuoy, 
  Search, 
  MessageSquare, 
  FileText, 
  Loader2, 
  Plus,
  ArrowRight,
  Paperclip,
  X,
  ChevronRight,
  HelpCircle,
  Send
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth/AuthProvider";
import { Link, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

const Support = () => {
  const { user, session } = useAuth();
  const navigate = useNavigate();
  const [faqs, setFaqs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [isOpeningTicket, setIsOpeningTicket] = useState(false);
  const [ticketData, setTicketData] = useState({ subject: "", description: "", priority: "medium" });
  const [attachment, setAttachment] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchFaqs();
  }, []);

  const fetchFaqs = async () => {
    try {
      const { data, error } = await supabase
        .from("support_faqs")
        .select("*")
        .eq("is_published", true)
        .order("position", { ascending: true });
      if (error) throw error;
      setFaqs(data || []);
      
      // Define a primeira categoria como ativa por padrão
      if (data && data.length > 0) {
        const firstCat = data[0].category || "Geral";
        setActiveCategory(firstCat);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) {
      toast.info("Faça login para abrir um chamado.");
      navigate("/login");
      return;
    }

    setIsOpeningTicket(true);
    try {
      let attachmentUrl = null;
      let attachmentName = null;

      if (attachment) {
        const fileExt = attachment.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const filePath = `support/${user?.id}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('uploads')
          .upload(filePath, attachment);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('uploads')
          .getPublicUrl(filePath);
        
        attachmentUrl = publicUrl;
        attachmentName = attachment.name;
      }

      const { data, error } = await supabase
        .from("support_tickets")
        .insert({
          user_id: user?.id,
          subject: ticketData.subject,
          description: ticketData.description,
          priority: ticketData.priority,
          status: 'open',
          attachment_url: attachmentUrl,
          attachment_name: attachmentName
        })
        .select()
        .single();

      if (error) throw error;

      supabase.functions.invoke('notify-support', {
        body: { type: 'new_ticket', ticketId: data.id, senderId: user?.id }
      }).catch(err => console.warn("Falha ao notificar admin:", err));

      toast.success("Chamado aberto com sucesso!");
      navigate(`/dashboard/suporte/${data.id}`);
    } catch (err) {
      toast.error("Erro ao abrir chamado.");
    } finally {
      setIsOpeningTicket(false);
    }
  };

  // Categorias únicas
  const categories = useMemo(() => {
    const set = new Set(faqs.map(f => f.category || "Geral"));
    return Array.from(set).sort();
  }, [faqs]);

  // Filtra FAQs baseado na busca OU na categoria ativa
  const filteredFaqs = useMemo(() => {
    if (search.trim()) {
      return faqs.filter(f => 
        f.question.toLowerCase().includes(search.toLowerCase()) || 
        f.answer.toLowerCase().includes(search.toLowerCase())
      );
    }
    return faqs.filter(f => (f.category || "Geral") === activeCategory);
  }, [faqs, search, activeCategory]);

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="text-center mb-12">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <LifeBuoy className="h-10 w-10 text-primary" />
          </div>
          <h1 className="text-4xl font-bold text-foreground">Como podemos ajudar?</h1>
          <p className="mt-4 text-muted-foreground text-lg">
            Encontre respostas rápidas ou entre em contato com nossa equipe.
          </p>
          
          <div className="mt-8 max-w-2xl mx-auto relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground h-5 w-5" />
            <Input 
              placeholder="Pesquise por dúvidas, termos ou problemas..." 
              className="pl-12 h-14 text-lg shadow-sm border-primary/20 focus:border-primary"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-12">
          {/* Navegação Lateral de Categorias (Desktop) */}
          <div className="lg:col-span-3 space-y-4">
            <div className="hidden lg:block space-y-1">
              <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4 px-3">Categorias</h3>
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => { setActiveCategory(cat); setSearch(""); }}
                  className={cn(
                    "w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all",
                    activeCategory === cat && !search
                      ? "bg-primary text-primary-foreground shadow-md translate-x-1"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                  )}
                >
                  <span className="truncate">{cat}</span>
                  <ChevronRight className={cn("h-4 w-4 opacity-50", activeCategory === cat && !search ? "opacity-100" : "")} />
                </button>
              ))}
            </div>

            {/* Seletor Mobile */}
            <div className="lg:hidden">
              <Select value={activeCategory || ""} onValueChange={(v) => { setActiveCategory(v); setSearch(""); }}>
                <SelectTrigger className="h-12">
                  <SelectValue placeholder="Selecione uma categoria" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map(cat => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Card className="bg-primary/5 border-primary/10 mt-6">
              <CardContent className="pt-6">
                <div className="flex flex-col items-center text-center space-y-3">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <MessageSquare className="h-5 w-5 text-primary" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-bold">Ainda com dúvidas?</p>
                    <p className="text-xs text-muted-foreground">Nossa equipe está pronta para te ouvir.</p>
                  </div>
                  <Button variant="link" className="text-primary p-0 h-auto" asChild>
                    <a href="#ticket-form">Abrir um chamado <ArrowRight className="ml-1 h-3 w-3" /></a>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Conteúdo Principal (FAQs) */}
          <div className="lg:col-span-6 space-y-8">
            <section className="animate-fade-in">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold flex items-center gap-2">
                  {search ? (
                    <><Search className="h-6 w-6 text-primary" /> Resultados da busca</>
                  ) : (
                    <><HelpCircle className="h-6 w-6 text-primary" /> {activeCategory}</>
                  )}
                </h2>
                {search && (
                  <Badge variant="secondary">{filteredFaqs.length} encontrados</Badge>
                )}
              </div>
              
              {loading ? (
                <div className="flex justify-center py-12"><Loader2 className="animate-spin text-primary" /></div>
              ) : filteredFaqs.length > 0 ? (
                <Accordion type="single" collapsible className="w-full space-y-4">
                  {filteredFaqs.map((faq) => (
                    <AccordionItem 
                      key={faq.id} 
                      value={faq.id} 
                      className="border rounded-2xl px-6 bg-card shadow-sm hover:shadow-md transition-all border-primary/5"
                    >
                      <AccordionTrigger className="text-left font-bold hover:no-underline py-5 text-foreground/90 leading-tight">
                        {faq.question}
                      </AccordionTrigger>
                      <AccordionContent className="text-muted-foreground pb-6 leading-relaxed text-base">
                        <div className="prose prose-slate max-w-none">
                          {faq.answer}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              ) : (
                <div className="text-center py-20 bg-secondary/20 rounded-3xl border border-dashed">
                  <Search className="h-12 w-12 mx-auto mb-4 opacity-20" />
                  <p className="text-muted-foreground">Nenhuma resposta encontrada para sua busca.</p>
                  <Button variant="link" onClick={() => setSearch("")}>Limpar filtros</Button>
                </div>
              )}
            </section>
          </div>

          {/* Sidebar Direita (Formulário) */}
          <div className="lg:col-span-3 space-y-6">
            <Card id="ticket-form" className="shadow-xl border-primary/10 sticky top-24">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Plus className="h-5 w-5 text-primary" />
                  Novo Chamado
                </CardTitle>
                <CardDescription>Fale diretamente com nosso suporte.</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleOpenTicket} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs uppercase font-bold text-muted-foreground">Assunto</Label>
                    <Input 
                      required 
                      placeholder="Ex: Problema com acesso" 
                      className="h-10"
                      value={ticketData.subject}
                      onChange={(e) => setTicketData({...ticketData, subject: e.target.value})}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs uppercase font-bold text-muted-foreground">Prioridade</Label>
                    <Select 
                      value={ticketData.priority} 
                      onValueChange={(v) => setTicketData({...ticketData, priority: v})}
                    >
                      <SelectTrigger className="h-10">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Baixa</SelectItem>
                        <SelectItem value="medium">Média</SelectItem>
                        <SelectItem value="high">Alta</SelectItem>
                        <SelectItem value="urgent">Urgente</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs uppercase font-bold text-muted-foreground">Descrição</Label>
                    <Textarea 
                      required 
                      placeholder="Como podemos ajudar?" 
                      rows={4}
                      className="resize-none"
                      value={ticketData.description}
                      onChange={(e) => setTicketData({...ticketData, description: e.target.value})}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs uppercase font-bold text-muted-foreground">Anexo</Label>
                      {attachment && (
                        <button type="button" onClick={() => setAttachment(null)} className="text-[10px] text-destructive hover:underline flex items-center gap-1">
                          <X className="h-2 w-2" /> Remover
                        </button>
                      )}
                    </div>
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="sm" 
                      className="w-full gap-2 border-dashed h-10"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Paperclip className="h-4 w-4" />
                      {attachment ? attachment.name : "Anexar arquivo"}
                    </Button>
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      className="hidden" 
                      onChange={(e) => setAttachment(e.target.files?.[0] || null)}
                    />
                  </div>

                  <Button type="submit" className="w-full h-11 gap-2 shadow-lg" disabled={isOpeningTicket}>
                    {isOpeningTicket ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    Enviar Ticket
                  </Button>
                </form>
              </CardContent>
              {session && (
                <CardFooter className="border-t bg-secondary/10 py-3">
                  <Button variant="ghost" size="sm" className="w-full text-xs gap-2" asChild>
                    <Link to="/dashboard/suporte">
                      <FileText className="h-3 w-3" /> Ver meus chamados
                    </Link>
                  </Button>
                </CardFooter>
              )}
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Support;