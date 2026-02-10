"use client";

import { useState, useEffect } from "react";
import Layout from "@/components/layout/Layout";
import { supabase } from "@/integrations/supabase/client";
import { 
  Accordion, 
  AccordionContent, 
  AccordionItem, 
  AccordionTrigger 
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  LifeBuoy, 
  Search, 
  MessageSquare, 
  FileText, 
  Loader2, 
  Plus,
  ArrowRight
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth/AuthProvider";
import { Link, useNavigate } from "react-router-dom";

const Support = () => {
  const { user, session } = useAuth();
  const navigate = useNavigate();
  const [faqs, setFaqs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [isOpeningTicket, setIsOpeningTicket] = useState(false);
  const [ticketData, setTicketData] = useState({ subject: "", description: "" });

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
      const { data, error } = await supabase
        .from("support_tickets")
        .insert({
          user_id: user?.id,
          subject: ticketData.subject,
          description: ticketData.description,
          status: 'open'
        })
        .select()
        .single();

      if (error) throw error;

      toast.success("Chamado aberto com sucesso!");
      navigate(`/dashboard/suporte/${data.id}`);
    } catch (err) {
      toast.error("Erro ao abrir chamado.");
    } finally {
      setIsOpeningTicket(false);
    }
  };

  const filteredFaqs = faqs.filter(f => 
    f.question.toLowerCase().includes(search.toLowerCase()) || 
    f.answer.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 max-w-5xl">
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
              className="pl-12 h-14 text-lg shadow-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="grid gap-8 md:grid-cols-3">
          <div className="md:col-span-2 space-y-8">
            <section>
              <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                <FileText className="text-primary" /> Perguntas Frequentes
              </h2>
              {loading ? (
                <div className="flex justify-center py-12"><Loader2 className="animate-spin text-primary" /></div>
              ) : filteredFaqs.length > 0 ? (
                <Accordion type="single" collapsible className="w-full space-y-4">
                  {filteredFaqs.map((faq) => (
                    <AccordionItem key={faq.id} value={faq.id} className="border rounded-xl px-4 bg-card shadow-sm">
                      <AccordionTrigger className="text-left font-semibold hover:no-underline py-4">
                        {faq.question}
                      </AccordionTrigger>
                      <AccordionContent className="text-muted-foreground pb-4 leading-relaxed">
                        {faq.answer}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              ) : (
                <p className="text-center py-12 text-muted-foreground">Nenhuma resposta encontrada para sua busca.</p>
              )}
            </section>
          </div>

          <div className="space-y-6">
            <Card className="shadow-md border-primary/10">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5 text-primary" />
                  Abrir Chamado
                </CardTitle>
                <CardDescription>Não encontrou o que precisava? Fale conosco.</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleOpenTicket} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Assunto</Label>
                    <Input 
                      required 
                      placeholder="Ex: Problema com pagamento" 
                      value={ticketData.subject}
                      onChange={(e) => setTicketData({...ticketData, subject: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Descrição</Label>
                    <Textarea 
                      required 
                      placeholder="Descreva detalhadamente sua dúvida ou problema..." 
                      rows={4}
                      value={ticketData.description}
                      onChange={(e) => setTicketData({...ticketData, description: e.target.value})}
                    />
                  </div>
                  <Button type="submit" className="w-full gap-2" disabled={isOpeningTicket}>
                    {isOpeningTicket ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                    Enviar Ticket
                  </Button>
                </form>
              </CardContent>
            </Card>

            {session && (
              <Card className="bg-secondary/20 border-none">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-sm font-semibold">Meus Chamados</p>
                      <p className="text-xs text-muted-foreground">Acompanhe seus tickets abertos.</p>
                    </div>
                    <Button variant="ghost" size="icon" asChild>
                      <Link to="/dashboard/suporte"><ArrowRight className="h-4 w-4" /></Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Support;