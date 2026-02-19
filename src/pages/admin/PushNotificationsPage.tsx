"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  Bell, 
  Send, 
  Calendar, 
  History, 
  Loader2, 
  RefreshCw, 
  Trash2, 
  CheckCircle2, 
  Clock,
  Users,
  Database,
  Image as ImageIcon,
  X,
  Smartphone,
  Monitor,
  User,
  RotateCcw,
  Palette,
  Megaphone,
  ShieldCheck,
  Info,
  ExternalLink,
  Save,
  AlertTriangle,
  Timer,
  Play,
  Edit2,
  UserX,
  Copy
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useSiteConfig } from "@/hooks/use-site-config";
import { useQueryClient } from "@tanstack/react-query";

const TITLE_LIMIT = 45;
const BODY_LIMIT = 120;

const DEFAULT_LAYOUT = {
  bgColor: "#ffffff",
  titleColor: "#0f172a",
  bodyColor: "#64748b",
  borderRadius: "32",
  iconBgColor: "#007BFF1a",
  iconColor: "#007BFF",
  shadowIntensity: "0.25",
  ctaBgColor: "#007BFF",
  ctaTextColor: "#ffffff",
  backdropColor: "rgba(0,0,0,0.05)",
  duration: 15
};

const PushNotificationsPage = () => {
  const { data: config, isLoading: isLoadingConfig } = useSiteConfig();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSavingLayout, setIsSavingLayout] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [subscribers, setSubscribers] = useState<any[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [activeTab, setActiveTab] = useState("new");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    title: "",
    body: "",
    link: "",
    image_url: "",
    target_role: "all",
    scheduled_for: ""
  });

  const [layoutData, setLayoutData] = useState(DEFAULT_LAYOUT);

  useEffect(() => {
    if (config?.push_layout_json) {
      setLayoutData({
        ...DEFAULT_LAYOUT,
        ...config.push_layout_json
      });
    }
  }, [config]);

  const fetchHistory = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const { data, error } = await supabase
        .from("push_notifications")
        .select("*")
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      setHistory(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchSubscribers = async () => {
    try {
      const { data, error } = await supabase
        .from("push_subscriptions")
        .select("*, profile:profiles(full_name, email, role)")
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      setSubscribers(data || []);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchHistory();
    fetchSubscribers();

    const channel = supabase
      .channel('push-history-updates')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'push_notifications' },
        (payload) => {
          if (payload.eventType === 'UPDATE') {
            setHistory(prev => prev.map(item => 
              item.id === payload.new.id ? { ...item, ...payload.new } : item
            ));
            if (payload.new.status === 'sent') {
              toast.success(`Notificação "${payload.new.title}" enviada!`);
            }
          } else {
            fetchHistory(true);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      await supabase.functions.invoke('extend-site-config');
      await supabase.functions.invoke('setup-push-notifications');
      toast.success("Banco de dados sincronizado!");
      await queryClient.invalidateQueries({ queryKey: ["site-config"] });
      fetchHistory();
      fetchSubscribers();
    } catch (err) {
      toast.error("Erro ao sincronizar banco.");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleResend = async (notification: any) => {
    if (!confirm(`Deseja reenviar a notificação "${notification.title}" agora?`)) return;
    
    const toastId = toast.loading("Reenviando...");
    try {
      const { error } = await supabase.functions.invoke('process-push-notifications', {
        body: { notificationId: notification.id, action: 'send_now' }
      });
      if (error) throw error;
      toast.success("Notificação reenviada com sucesso!", { id: toastId });
      fetchHistory(true);
    } catch (err) {
      toast.error("Erro ao reenviar.", { id: toastId });
    }
  };

  const handleEdit = (notification: any) => {
    setFormData({
      title: notification.title,
      body: notification.body,
      link: notification.link || "",
      image_url: notification.image_url || "",
      target_role: notification.target_role || "all",
      scheduled_for: "" 
    });
    setActiveTab("new");
    window.scrollTo({ top: 0, behavior: 'smooth' });
    toast.info("Dados carregados no formulário.");
  };

  const handleSaveLayout = async () => {
    setIsSavingLayout(true);
    try {
      const { error } = await supabase
        .from("site_config")
        .update({ push_layout_json: layoutData })
        .eq("id", 1);
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ["site-config"] });
      toast.success("Layout salvo!");
    } catch (err) {
      toast.error("Erro ao salvar layout.");
    } finally {
      setIsSavingLayout(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    const filePath = `push-images/${Date.now()}_${file.name}`;
    try {
      const { error: uploadError } = await supabase.storage.from('uploads').upload(filePath, file);
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('uploads').getPublicUrl(filePath);
      setFormData(prev => ({ ...prev, image_url: publicUrl }));
      toast.success("Imagem carregada!");
    } catch (err) {
      toast.error("Erro ao carregar imagem.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.body) return;
    setIsSending(true);
    try {
      const { data: notification, error: saveError } = await supabase
        .from("push_notifications")
        .insert({
          title: formData.title,
          body: formData.body,
          link: formData.link || null,
          image_url: formData.image_url || null,
          target_role: formData.target_role,
          scheduled_for: formData.scheduled_for || null,
          status: formData.scheduled_for ? 'scheduled' : 'pending'
        })
        .select()
        .single();

      if (saveError) throw saveError;

      if (!formData.scheduled_for) {
        await supabase.functions.invoke('process-push-notifications', {
          body: { notificationId: notification.id, action: 'send_now' }
        });
      }
      setFormData({ title: "", body: "", link: "", image_url: "", target_role: "all", scheduled_for: "" });
      fetchHistory();
      setActiveTab("history");
    } catch (err) {
      toast.error("Erro ao processar notificação.");
    } finally {
      setIsSending(false);
    }
  };

  const handleClearSubscribers = async () => {
    if (!confirm("Tem certeza que deseja remover TODOS os dispositivos inscritos? Isso impedirá o envio de notificações até que os usuários aceitem novamente.")) return;
    
    setLoading(true);
    const toastId = toast.loading("Limpando base de inscritos...");
    try {
      const { error } = await supabase.functions.invoke('process-push-notifications', {
        body: { action: 'clear_all_subscribers' }
      });
      
      if (error) throw error;
      
      setSubscribers([]);
      toast.success("Lista de inscritos limpa definitivamente!", { id: toastId });
      fetchSubscribers();
    } catch (err) {
      console.error(err);
      toast.error("Erro ao limpar inscritos.", { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  const handleClearHistory = async () => {
    if (!confirm("Tem certeza que deseja apagar TODO o histórico de notificações enviadas? Esta ação não pode ser desfeita.")) return;
    
    setLoading(true);
    try {
      const { error } = await supabase
        .from("push_notifications")
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000");
      
      if (error) throw error;
      
      setHistory([]);
      toast.success("Histórico limpo com sucesso!");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao limpar histórico.");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteNotification = async (id: string) => {
    if (!confirm("Excluir este registro do histórico?")) return;
    try {
      const { error } = await supabase.from("push_notifications").delete().eq("id", id);
      if (error) throw error;
      setHistory(prev => prev.filter(h => h.id !== id));
      toast.success("Registro removido.");
    } catch (err) {
      toast.error("Erro ao remover.");
    }
  };

  const handleDeleteSubscriber = async (id: string) => {
    if (!confirm("Remover este dispositivo?")) return;
    try {
      const { error } = await supabase.from("push_subscriptions").delete().eq("id", id);
      if (error) throw error;
      setSubscribers(prev => prev.filter(s => s.id !== id));
      toast.success("Dispositivo removido.");
    } catch (err) {
      toast.error("Erro ao remover.");
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'sent': return <Badge className="bg-success"><CheckCircle2 className="h-3 w-3 mr-1" /> Enviado</Badge>;
      case 'scheduled': return <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50"><Clock className="h-3 w-3 mr-1" /> Agendado</Badge>;
      default: return <Badge variant="secondary">Pendente</Badge>;
    }
  };

  const recentNotifications = history.slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Notificações Push</h1>
          <p className="text-muted-foreground">Envie mensagens diretas para os dispositivos dos usuários.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-2" onClick={handleSync} disabled={isSyncing}>
            {isSyncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
            Sincronizar Banco
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full max-w-2xl grid-cols-4">
          <TabsTrigger value="new" className="gap-2"><Send className="h-4 w-4" /> Nova Mensagem</TabsTrigger>
          <TabsTrigger value="layout" className="gap-2"><Palette className="h-4 w-4" /> Layout do Card</TabsTrigger>
          <TabsTrigger value="history" className="gap-2"><History className="h-4 w-4" /> Histórico</TabsTrigger>
          <TabsTrigger value="subscribers" className="gap-2"><Users className="h-4 w-4" /> Inscritos ({subscribers.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="new" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Criar Notificação</CardTitle>
                <CardDescription>Preencha os detalhes da mensagem que será enviada.</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSend} className="space-y-6">
                  <div className="grid gap-6 md:grid-cols-1">
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>Título da Notificação</Label>
                        <Input 
                          placeholder="Ex: Novas vagas disponíveis!" 
                          value={formData.title}
                          onChange={e => setFormData({...formData, title: e.target.value})}
                          maxLength={TITLE_LIMIT}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Mensagem (Corpo)</Label>
                        <Textarea 
                          placeholder="Descreva o conteúdo da notificação..." 
                          rows={4}
                          value={formData.body}
                          onChange={e => setFormData({...formData, body: e.target.value})}
                          maxLength={BODY_LIMIT}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Link de Destino (Opcional)</Label>
                        <Input 
                          placeholder="Ex: /dashboard/cursos" 
                          value={formData.link}
                          onChange={e => setFormData({...formData, link: e.target.value})}
                        />
                      </div>
                    </div>

                    <div className="space-y-4 p-6 bg-secondary/20 rounded-xl border border-dashed">
                      <div className="space-y-2">
                        <Label className="flex items-center gap-2"><ImageIcon className="h-4 w-4 text-primary" /> Imagem (Opcional)</Label>
                        <div className="flex flex-col gap-3">
                          {formData.image_url ? (
                            <div className="relative aspect-video rounded-lg overflow-hidden border bg-black group">
                              <img src={formData.image_url} className="w-full h-full object-contain" alt="Preview" />
                              <button type="button" onClick={() => setFormData(prev => ({ ...prev, image_url: "" }))} className="absolute top-2 right-2 p-1 bg-destructive text-white rounded-full"><X className="h-4 w-4" /></button>
                            </div>
                          ) : (
                            <Button type="button" variant="outline" className="w-full h-24 border-dashed gap-2" onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
                              {isUploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImageIcon className="h-5 w-5" />} Selecionar Imagem
                            </Button>
                          )}
                          <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label className="flex items-center gap-2"><Users className="h-4 w-4 text-primary" /> Público Alvo</Label>
                        <Select value={formData.target_role} onValueChange={v => setFormData({...formData, target_role: v})}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Todos os Usuários</SelectItem>
                            <SelectItem value="professional">Apenas Profissionais</SelectItem>
                            <SelectItem value="company">Apenas Empresas</SelectItem>
                            <SelectItem value="family">Apenas Famílias</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label className="flex items-center gap-2"><Calendar className="h-4 w-4 text-primary" /> Agendar Envio</Label>
                        <Input type="datetime-local" value={formData.scheduled_for} onChange={e => setFormData({...formData, scheduled_for: e.target.value})} />
                      </div>

                      <Button type="submit" className="w-full gap-2 h-12" disabled={isSending || isUploading}>
                        {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4" />}
                        {formData.scheduled_for ? "Agendar Notificação" : "Enviar Agora"}
                      </Button>
                    </div>
                  </div>
                </form>
              </CardContent>
            </Card>

            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <History className="h-4 w-4 text-primary" />
                    Últimas Enviadas
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {recentNotifications.length > 0 ? (
                    <div className="divide-y">
                      {recentNotifications.map((n) => (
                        <div key={n.id} className="p-4 space-y-2 hover:bg-secondary/20 transition-colors">
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-bold truncate pr-2">{n.title}</p>
                            {getStatusBadge(n.status)}
                          </div>
                          <p className="text-[10px] text-muted-foreground line-clamp-2">{n.body}</p>
                          <div className="flex items-center justify-between pt-1">
                            <span className="text-[9px] text-muted-foreground">
                              {format(new Date(n.created_at), "dd/MM HH:mm")}
                            </span>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleEdit(n)} title="Copiar dados">
                                <Copy className="h-3 w-3" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-6 w-6 text-success" onClick={() => handleResend(n)} title="Reenviar">
                                <RotateCcw className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-8 text-center text-muted-foreground text-xs italic">
                      Nenhuma notificação enviada ainda.
                    </div>
                  )}
                </CardContent>
              </Card>

              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex gap-3">
                <Info className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
                <p className="text-[10px] text-blue-800 leading-relaxed">
                  <strong>Dica:</strong> Notificações com imagens e links de destino têm uma taxa de clique até 40% maior. Use o campo de link para direcionar usuários para novos cursos ou perfis em destaque.
                </p>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="layout" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Personalizar Card</CardTitle>
                <CardDescription>Ajuste as cores e o estilo visual da notificação.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Cor de Fundo</Label>
                    <div className="flex gap-2">
                      <Input type="color" className="w-12 h-10 p-1" value={layoutData.bgColor} onChange={e => setLayoutData({...layoutData, bgColor: e.target.value})} />
                      <Input value={layoutData.bgColor} onChange={e => setLayoutData({...layoutData, bgColor: e.target.value})} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Cor do Título</Label>
                    <div className="flex gap-2">
                      <Input type="color" className="w-12 h-10 p-1" value={layoutData.titleColor} onChange={e => setLayoutData({...layoutData, titleColor: e.target.value})} />
                      <Input value={layoutData.titleColor} onChange={e => setLayoutData({...layoutData, titleColor: e.target.value})} />
                    </div>
                  </div>
                </div>
                <div className="pt-4 flex gap-3">
                  <Button variant="outline" className="flex-1 gap-2" onClick={() => setLayoutData(DEFAULT_LAYOUT)}><RotateCcw className="h-4 w-4" /> Resetar</Button>
                  <Button className="flex-[2] gap-2" onClick={handleSaveLayout} disabled={isSavingLayout}>
                    {isSavingLayout ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Salvar Alterações
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <CardTitle>Histórico de Envios</CardTitle>
                <CardDescription>Acompanhe o status das notificações.</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="text-destructive hover:bg-destructive/10 gap-2"
                  onClick={handleClearHistory}
                  disabled={loading || history.length === 0}
                >
                  <Trash2 className="h-4 w-4" /> Limpar Todo o Histórico
                </Button>
                <Button variant="ghost" size="icon" onClick={() => fetchHistory()} disabled={loading}>
                  <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Notificação</TableHead>
                    <TableHead>Público</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.map((h) => (
                    <TableRow key={h.id}>
                      <TableCell>
                        <div className="font-medium text-sm">{h.title}</div>
                        <div className="text-[10px] text-muted-foreground truncate max-w-[200px]">{h.body}</div>
                      </TableCell>
                      <TableCell><Badge variant="outline" className="text-[10px]">{getTargetLabel(h.target_role)}</Badge></TableCell>
                      <TableCell>{getStatusBadge(h.status)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-primary" 
                            onClick={() => handleEdit(h)}
                            title="Editar/Copiar"
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-success" 
                            onClick={() => handleResend(h)}
                            title="Reenviar Agora"
                          >
                            <RotateCcw className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-destructive" 
                            onClick={() => handleDeleteNotification(h.id)}
                            title="Excluir"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="subscribers">
          <Card>
            <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <CardTitle>Dispositivos Inscritos</CardTitle>
                <CardDescription>Lista de navegadores que autorizaram notificações.</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="text-destructive hover:bg-destructive/10 gap-2"
                  onClick={handleClearSubscribers}
                  disabled={loading || subscribers.length === 0}
                >
                  <UserX className="h-4 w-4" /> Limpar Todos os Inscritos
                </Button>
                <Button variant="ghost" size="icon" onClick={fetchSubscribers} disabled={loading}>
                  <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Usuário</TableHead>
                    <TableHead>Dispositivo</TableHead>
                    <TableHead>Data Inscrição</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {subscribers.length > 0 ? subscribers.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell>
                        {s.profile ? (
                          <div className="space-y-0.5">
                            <p className="text-sm font-bold">{s.profile.full_name}</p>
                            <p className="text-[10px] text-muted-foreground">{s.profile.email}</p>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 text-muted-foreground italic text-sm"><User className="h-3 w-3" /> Anônimo</div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-xs">
                          {s.device_type === 'mobile' ? <Smartphone className="h-3 w-3" /> : <Monitor className="h-3 w-3" />}
                          <span className="capitalize">{s.device_type || 'Desconhecido'}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{format(new Date(s.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDeleteSubscriber(s.id)}><Trash2 className="h-4 w-4" /></Button>
                      </TableCell>
                    </TableRow>
                  )) : (
                    <TableRow><TableCell colSpan={4} className="h-32 text-center text-muted-foreground">Nenhum dispositivo inscrito.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

const getTargetLabel = (role: string) => {
  switch (role) {
    case 'professional': return 'Profissionais';
    case 'company': return 'Empresas';
    case 'family': return 'Famílias';
    default: return 'Todos';
  }
};

export default PushNotificationsPage;