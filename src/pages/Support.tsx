"use client";

import { useState, useEffect, useMemo } from "react";
import Layout from "@/components/layout/Layout";
import { supabase } from "@/integrations/supabase/client";
import { 
  Accordion, 
  AccordionContent, 
  AccordionItem, 
  AccordionTrigger 
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  LifeBuoy, 
  Search, 
  MessageSquare, 
  Loader2, 
  Plus,
  ChevronRight,
  HelpCircle
} from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import SupportTicketModal from "@/components/SupportTicketModal";

const Support = () => {
  const { session } = useAuth();
  const [faqs, setFaqs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

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

  const categories = useMemo(() => {
    const set = new Set(faqs.map(f => f.category || "Geral"));
    return Array.from(set).sort();
  }, [faqs]);

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
          <div className="lg:col-span-3 space-y-4">
            {/* Desktop Sidebar Categories */}
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

            {/* Mobile Category Selector */}
            <div className="lg:hidden space-y-2">
              <Label className="text-sm font-semibold text-muted-foreground px-1">
                Selecione a categoria que deseja visualizar:
              </Label>
              <select 
                value={activeCategory || ""} 
                onChange={(e) => { setActiveCategory(e.target.value); setSearch(""); }}
                className="w-full h-12 rounded-xl border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              >
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="lg:col-span-9 space-y-8">
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

            {/* Bottom CTA - Visible on all screens, but essential for mobile flow */}
            <div className="mt-12 pt-8 border-t border-dashed">
              <Card className="bg-primary/5 border-primary/10 overflow-hidden relative">
                <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
                <CardContent className="pt-8 pb-8 px-6 sm:px-10">
                  <div className="flex flex-col md:flex-row items-center justify-between gap-8 text-center md:text-left">
                    <div className="flex flex-col md:flex-row items-center gap-6">
                      <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0 rotate-3">
                        <MessageSquare className="h-8 w-8 text-primary" />
                      </div>
                      <div className="space-y-2">
                        <h3 className="text-xl font-bold">Não encontrou o que precisava?</h3>
                        <p className="text-muted-foreground max-w-md">
                          Se sua dúvida persiste, abra um chamado direto com nosso suporte técnico. Respondemos em até 24h úteis.
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col gap-3 w-full md:w-auto">
                      <Button 
                        variant="default" 
                        size="lg"
                        className="gap-2 shadow-lg h-14 px-8 text-lg" 
                        onClick={() => setIsModalOpen(true)}
                      >
                        <Plus className="h-5 w-5" /> Abrir um Chamado
                      </Button>
                      {session && (
                        <Link to="/dashboard/suporte" className="text-sm text-primary font-medium hover:underline">
                          Ver histórico de chamados
                        </Link>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>

      <SupportTicketModal 
        open={isModalOpen} 
        onOpenChange={setIsModalOpen} 
        initialStep="form"
      />
    </Layout>
  );
};

export default Support;