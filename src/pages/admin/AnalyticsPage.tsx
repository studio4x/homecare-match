"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as RechartsTooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from "recharts";
import { 
  Loader2, 
  Eye, 
  Users, 
  MessageSquare, 
  AlertCircle, 
  TrendingUp,
  ArrowUpRight,
  Building2,
  Home,
  User
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

const AnalyticsPage = () => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>({
    profileViews: [],
    contactAdditions: [],
    whatsappClicks: [],
    ticketsByUrgency: [],
    ticketsByUserType: []
  });

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      // 1. Visualizações por Perfil (Top 10)
      const { data: viewsData } = await supabase
        .from('profile_views')
        .select('profile:profiles(full_name)')
        .limit(1000);
      
      const viewsMap = new Map();
      viewsData?.forEach((v: any) => {
        const name = v.profile?.full_name || 'Desconhecido';
        viewsMap.set(name, (viewsMap.get(name) || 0) + 1);
      });
      const profileViews = Array.from(viewsMap.entries())
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 10);

      // 2. Adições para Contato (Interações)
      const { data: interactionsData } = await supabase
        .from('interactions')
        .select('professional:profiles!interactions_professional_id_fkey(full_name)')
        .limit(1000);
      
      const intMap = new Map();
      interactionsData?.forEach((i: any) => {
        const name = i.professional?.full_name || 'Desconhecido';
        intMap.set(name, (intMap.get(name) || 0) + 1);
      });
      const contactAdditions = Array.from(intMap.entries())
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 10);

      // 3. Cliques no WhatsApp por Tipo de Usuário
      const { data: clicksData } = await supabase
        .from('whatsapp_clicks')
        .select('clicker_role');
      
      const clicksMap = new Map();
      clicksData?.forEach((c: any) => {
        const role = c.clicker_role === 'company' ? 'Empresa' : c.clicker_role === 'family' ? 'Família' : 'Profissional';
        clicksMap.set(role, (clicksMap.get(role) || 0) + 1);
      });
      const whatsappClicks = Array.from(clicksMap.entries()).map(([name, value]) => ({ name, value }));

      // 4. Tickets por Urgência e Tipo de Usuário
      const { data: ticketsData } = await supabase
        .from('support_tickets')
        .select('priority, user:profiles(role)')
        .neq('status', 'closed');
      
      const urgencyMap = new Map();
      const typeMap = new Map();
      
      ticketsData?.forEach((t: any) => {
        const priority = t.priority === 'urgent' ? 'Urgente' : t.priority === 'high' ? 'Alta' : t.priority === 'medium' ? 'Média' : 'Baixa';
        const role = t.user?.role === 'company' ? 'Empresa' : t.user?.role === 'family' ? 'Família' : 'Profissional';
        
        urgencyMap.set(priority, (urgencyMap.get(priority) || 0) + 1);
        typeMap.set(role, (typeMap.get(role) || 0) + 1);
      });

      setStats({
        profileViews,
        contactAdditions,
        whatsappClicks,
        ticketsByUrgency: Array.from(urgencyMap.entries()).map(([name, value]) => ({ name, value })),
        ticketsByUserType: Array.from(typeMap.entries()).map(([name, value]) => ({ name, value }))
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Métricas e Análises</h1>
        <p className="text-muted-foreground">Acompanhe o engajamento e a saúde da plataforma em tempo real.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Visualizações</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.profileViews.reduce((acc: any, curr: any) => acc + curr.value, 0)}</div>
            <p className="text-xs text-muted-foreground">Nos perfis do Top 10</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Contatos Iniciados</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.contactAdditions.reduce((acc: any, curr: any) => acc + curr.value, 0)}</div>
            <p className="text-xs text-muted-foreground">Adições à lista de contatos</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cliques no WhatsApp</CardTitle>
            <ArrowUpRight className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.whatsappClicks.reduce((acc: any, curr: any) => acc + curr.value, 0)}</div>
            <p className="text-xs text-muted-foreground">Interesse direto confirmado</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tickets Abertos</CardTitle>
            <AlertCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.ticketsByUrgency.reduce((acc: any, curr: any) => acc + curr.value, 0)}</div>
            <p className="text-xs text-muted-foreground">Aguardando atendimento</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="engagement" className="space-y-4">
        <TabsList>
          <TabsTrigger value="engagement">Engajamento de Perfis</TabsTrigger>
          <TabsTrigger value="support">Suporte e Tickets</TabsTrigger>
        </TabsList>

        <TabsContent value="engagement" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Top 10 Perfis Mais Visualizados</CardTitle>
                <CardDescription>Quantidade de vezes que o perfil público foi aberto.</CardDescription>
              </CardHeader>
              <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.profileViews} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" width={120} fontSize={10} />
                    <RechartsTooltip />
                    <Bar dataKey="value" fill="#007BFF" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Profissionais Mais Adicionados</CardTitle>
                <CardDescription>Interesse de recrutadores (Empresas/Famílias).</CardDescription>
              </CardHeader>
              <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.contactAdditions} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" width={120} fontSize={10} />
                    <RechartsTooltip />
                    <Bar dataKey="value" fill="#28A745" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle className="text-base">Cliques no WhatsApp por Tipo de Usuário</CardTitle>
                <CardDescription>Quem mais está entrando em contato direto.</CardDescription>
              </CardHeader>
              <CardContent className="h-[300px] flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={stats.whatsappClicks}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                      label={({ name, percent }) => `\${name} (\${(percent * 100).toFixed(0)}%)`}
                    >
                      {stats.whatsappClicks.map((entry: any, index: number) => (
                        <Cell key={`cell-\${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <RechartsTooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="support" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Tickets por Urgência</CardTitle>
                <CardDescription>Distribuição de chamados abertos.</CardDescription>
              </CardHeader>
              <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={stats.ticketsByUrgency}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      dataKey="value"
                      label={({ name, value }) => `\${name}: \${value}`}
                    >
                      {stats.ticketsByUrgency.map((entry: any, index: number) => (
                        <Cell key={`cell-\${index}`} fill={entry.name === 'Urgente' ? '#ef4444' : entry.name === 'Alta' ? '#f97316' : '#3b82f6'} />
                      ))}
                    </Pie>
                    <RechartsTooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Tickets por Tipo de Usuário</CardTitle>
                <CardDescription>Quem mais solicita suporte.</CardDescription>
              </CardHeader>
              <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.ticketsByUserType}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" fontSize={12} />
                    <YAxis fontSize={12} />
                    <RechartsTooltip />
                    <Bar dataKey="value" fill="#8884d8" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AnalyticsPage;