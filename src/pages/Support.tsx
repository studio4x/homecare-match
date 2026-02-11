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
import { 
  LifeBuoy, 
  Search, 
  MessageSquare, 
  FileText, 
  Loader2, 
  Plus,
  ArrowRight,
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

            <div className="lg:hidden">
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
                  <Button 
                    variant="default" 
                    className="w-full gap-2 shadow-md" 
                    onClick={() => setIsModalOpen(true)}
                  >
                    <Plus className="h-4 w-4" /> Abrir Chamado
                  </Button>
                  {session && (
                    <Button variant="link" size="sm" className="text-xs text-muted-foreground" asChild>
                      <Link to="/dashboard/suporte">Ver meus chamados</Link>
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
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