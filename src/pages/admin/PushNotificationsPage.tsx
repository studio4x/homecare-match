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
  Timer
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
  const [isSavingLayout, setIsSavingLayout] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [subscribers, setSubscribers] = useState<any[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
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

  const fetchHistory = async () => {
    setLoading(true);
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
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("push_subscriptions")
        .select("*, profile:profiles(full_name, email, role)")
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      setSubscribers(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
    fetchSubscribers();
  }, []);

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const { error: extendError } = await supabase.functions.invoke('extend-site-config');
      if (extendError) throw extendError;

      const { error } = await supabase.functions.invoke('setup-push-notifications');
      if (error) throw error;
      
      toast.success("Banco de dados sincronizado!");
      await queryClient.invalidateQueries({ queryKey: ["site-config"] });
      fetchHistory();
      fetchSubscribers();
    } catch (err) {
      console.error(err);
      toast.error("Erro ao sincronizar banco.");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSaveLayout = async () => {
    setIsSavingLayout(true);
    try {
      const { error } = await supabase
        .from("site_config")
        .update({ push_layout_json: layoutData })
        .eq("id", 1);

      if (error) {
        if (error.message.includes("column") || error.code === "42703") {
          toast.error("Coluna de layout não encontrada!", {
            description: "Clique no botão 'Sincronizar Banco' no topo da página para corrigir."
          });
          return;
        }
        throw error;
      }
      
      await queryClient.invalidateQueries({ queryKey: ["site-config"] });
      toast.success("Layout salvo com sucesso!");
    } catch (err: any) {
      console.error(err);
      toast.error("Erro ao salvar layout.");
    } finally {
      setIsSavingLayout(false);
    }
  };

  const handleResetLayout = () => {
    if (confirm("Deseja resetar o layout para as cores padrão do sistema?")) {
      setLayoutData(DEFAULT_LAYOUT);
      toast.info("Cores resetadas. Não esqueça de salvar!");
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const fileExt = file.name.split('.').pop();
    const fileName = `push_${Date.now()}.${fileExt}`;
    const filePath = `push-images/${fileName}`;

    try {
      const { error: uploadError } = await supabase.storage
        .from('uploads')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('uploads')
        .getPublicUrl(filePath);

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
    if (!formData.title || !formData.body) {
      toast.error("Título e mensagem são obrigatórios.");
      return;
    }

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
        const { data: result, error: sendError } = await supabase.functions.invoke('process-push-notifications', {
          body: { notificationId: notification.id, action: 'send_now' }
        });
        if (sendError) throw sendError;
        
        toast.success(`Notificação enviada para ${result.sentCount} dispositivos!`);
      } else {
        toast.success("Notificação agendada com sucesso!");
      }

      setFormData({ title: "", body: "", link: "", image_url: "", target_role: "all", scheduled_for: "" });
      fetchHistory();
    } catch (err: any) {
      console.error(err);
      toast.error("Erro ao processar notificação.");
    } finally {
      setIsSending(false);
    }
  };

  const handleResend = async (oldNotification: any) => {
    setIsSending(true);
    const toastId = toast.loading("Reenviando notificação...");
    try {
      const { data: notification, error: saveError } = await supabase
        .from("push_notifications")
        .insert({
          title: oldNotification.title,
          body: oldNotification.body,
          link: oldNotification.link,
          image_url: oldNotification.image_url,
          target_role: oldNotification.target_role,
          status: 'pending'
        })
        .select()
        .single();

      if (saveError) throw saveError;

      const { data: result, error: sendError } = await supabase.functions.invoke('process-push-notifications', {
        body: { notificationId: notification.id, action: 'send_now' }
      });
      
      if (sendError) throw sendError;
      
      toast.success(`Reenvio concluído para ${result.sentCount} dispositivos!`, { id: toastId });
      fetchHistory();
    } catch (err) {
      toast.error("Erro ao reenviar.", { id: toastId });
    } finally {
      setIsSending(false);
    }
  };

  const handleDeleteSubscriber = async (id: string) => {
    if (!confirm("Remover este dispositivo da lista de envios?")) return;
    try {
      const { error } = await supabase.from("push_subscriptions").delete().eq("id", id);
      if (error) throw error;
      setSubscribers(prev => prev.filter(s => s.id !== id));
      toast.success("Dispositivo removido.");
    } catch (err) {
      toast.error("Erro ao remover.");
    }
  };

  const handleClearHistory = async () => {
    if (!confirm("Tem certeza que deseja apagar TODO o histórico de notificações? Esta ação não pode ser desfeita.")) return;
    
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'sent': return <Badge className="bg-success"><CheckCircle2 className="h-3 w-3 mr-1" /> Enviado</Badge>;
      case 'scheduled': return <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50"><Clock className="h-3 w-3 mr-1" /> Agendado</Badge>;
      case 'failed': return <Badge variant="destructive">Falhou</Badge>;
      default: return <Badge variant="secondary">Pendente</Badge>;
    }
  };

  const getTargetLabel = (role: string) => {
    switch (role) {
      case 'professional': return 'Profissionais';
      case 'company': return 'Empresas';
      case 'family': return 'Famílias';
      default: return 'Todos';
    }
  };

  const lastSent = history.filter(h => h.status === 'sent').slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Notificações Push</h1>
          <p className="text-muted-foreground">Envie mensagens diretas para os dispositivos dos usuários.</p>
        </div>
        <Button variant="outline" size="sm" className="gap-2" onClick={handleSync} disabled={isSyncing}>
          {isSyncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
          Sincronizar Banco
        </Button>
      </div>

      <Tabs defaultValue="new" className="space-y-6">
        <TabsList className="grid w-full max-w-2xl grid-cols-4">
          <TabsTrigger value="new" className="gap-2"><Send className="h-4 w-4" /> Nova Mensagem</TabsTrigger>
          <TabsTrigger value="layout" className="gap-2"><Palette className="h-4 w-4" /> Layout do Card</TabsTrigger>
          <TabsTrigger value="history" className="gap-2"><History className="h-4 w-4" /> Histórico</TabsTrigger>
          <TabsTrigger value="subscribers" className="gap-2"><Users className="h-4 w-4" /> Inscritos ({subscribers.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="new" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Criar Notificação</CardTitle>
              <CardDescription>Preencha os detalhes da mensagem que será enviada.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSend} className="space-y-6">
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>Título da Notificação</Label>
                        <span className={cn(
                          "text-[10px] font-bold",
                          formData.title.length >= TITLE_LIMIT ? "text-destructive" : "text-muted-foreground"
                        )}>
                          {formData.title.length}/{TITLE_LIMIT}
                        </span>
                      </div>
                      <Input 
                        placeholder="Ex: Novas vagas disponíveis!" 
                        value={formData.title}
                        onChange={e => setFormData({...formData, title: e.target.value})}
                        maxLength={TITLE_LIMIT}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>Mensagem (Corpo)</Label>
                        <span className={cn(
                          "text-[10px] font-bold",
                          formData.body.length >= BODY_LIMIT ? "text-destructive" : "text-muted-foreground"
                        )}>
                          {formData.body.length}/{BODY_LIMIT}
                        </span>
                      </div>
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
                      <Label className="flex items-center gap-2"><ImageIcon className="h-4 w-4 text-primary" /> Imagem da Notificação (Opcional)</Label>
                      <div className="flex flex-col gap-3">
                        {formData.image_url ? (
                          <div className="relative aspect-video rounded-lg overflow-hidden border bg-black group">
                            <img src={formData.image_url} className="w-full h-full object-contain" alt="Preview" />
                            <button 
                              type="button"
                              onClick={() => setFormData(prev => ({ ...prev, image_url: "" }))}
                              className="absolute top-2 right-2 p-1 bg-destructive text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ) : (
                          <Button 
                            type="button" 
                            variant="outline" 
                            className="w-full h-24 border-dashed gap-2"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isUploading}
                          >
                            {isUploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImageIcon className="h-5 w-5" />}
                            Selecionar Imagem
                          </Button>
                        )}
                        <input 
                          type="file" 
                          ref={fileInputRef} 
                          className="hidden" 
                          accept="image/*" 
                          onChange={handleImageUpload} 
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="flex items-center gap-2"><Users className="h-4 w-4 text-primary" /> Público Alvo</Label>
                      <Select value={formData.target_role} onValueChange={v => setFormData({...formData, target_role: v})}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todos os Usuários (Logados e Anônimos)</SelectItem>
                          <SelectItem value="professional">Apenas Profissionais</SelectItem>
                          <SelectItem value="company">Apenas Empresas</SelectItem>
                          <SelectItem value="family">Apenas Famílias</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label className="flex items-center gap-2"><Calendar className="h-4 w-4 text-primary" /> Agendar Envio (Opcional)</Label>
                      <Input 
                        type="datetime-local" 
                        value={formData.scheduled_for}
                        onChange={e => setFormData({...formData, scheduled_for: e.target.value})}
                      />
                    </div>

                    <div className="pt-4">
                      <Button type="submit" className="w-full gap-2 h-12" disabled={isSending || isUploading}>
                        {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4" />}
                        {formData.scheduled_for ? "Agendar Notificação" : "Enviar Agora"}
                      </Button>
                    </div>
                  </div>
                </div>
              </form>
            </CardContent>
          </Card>

          {lastSent.length > 0 && (
            <Card className="border-primary/10 bg-primary/5">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <RotateCcw className="h-4 w-4 text-primary" />
                  Reenvio Rápido
                </CardTitle>
                <CardDescription>Envie novamente uma das últimas mensagens disparadas.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3">
                {lastSent.map((h) => (
                  <div key={h.id} className="flex items-center justify-between p-3 bg-card rounded-lg border shadow-sm group">
                    <div className="flex items-center gap-3 min-w-0">
                      {h.image_url ? (
                        <img src={h.image_url} className="h-10 w-10 rounded object-cover border shrink-0" alt="Thumb" />
                      ) : (
                        <div className="h-10 w-10 rounded bg-secondary flex items-center justify-center shrink-0">
                          <Bell className="h-5 w-5 text-muted-foreground" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-bold truncate">{h.title}</p>
                        <p className="text-xs text-muted-foreground truncate">{h.body}</p>
                      </div>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="gap-2 h-8 ml-4 shrink-0 hover:bg-primary hover:text-white transition-colors"
                      onClick={() => handleResend(h)}
                      disabled={isSending}
                    >
                      <Send className="h-3 w-3" /> Reenviar
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
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
                    <Label>Cor de Fundo do Card</Label>
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
                  <div className="space-y-2">
                    <Label>Cor do Texto</Label>
                    <div className="flex gap-2">
                      <Input type="color" className="w-12 h-10 p-1" value={layoutData.bodyColor} onChange={e => setLayoutData({...layoutData, bodyColor: e.target.value})} />
                      <Input value={layoutData.bodyColor} onChange={e => setLayoutData({...layoutData, bodyColor: e.target.value})} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Cor do Ícone</Label>
                    <div className="flex gap-2">
                      <Input type="color" className="w-12 h-10 p-1" value={layoutData.iconColor} onChange={e => setLayoutData({...layoutData, iconColor: e.target.value})} />
                      <Input value={layoutData.iconColor} onChange={e => setLayoutData({...layoutData, iconColor: e.target.value})} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Fundo do Ícone</Label>
                    <div className="flex gap-2">
                      <Input type="color" className="w-12 h-10 p-1" value={layoutData.iconBgColor.substring(0, 7)} onChange={e => setLayoutData({...layoutData, iconBgColor: e.target.value + '1a'})} />
                      <Input value={layoutData.iconBgColor} onChange={e => setLayoutData({...layoutData, iconBgColor: e.target.value})} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Arredondamento (px)</Label>
                    <Input type="number" value={layoutData.borderRadius} onChange={e => setLayoutData({...layoutData, borderRadius: e.target.value})} />
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Fundo do Botão (CTA)</Label>
                    <div className="flex gap-2">
                      <Input type="color" className="w-12 h-10 p-1" value={layoutData.ctaBgColor} onChange={e => setLayoutData({...layoutData, ctaBgColor: e.target.value})} />
                      <Input value={layoutData.ctaBgColor} onChange={e => setLayoutData({...layoutData, ctaBgColor: e.target.value})} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Texto do Botão (CTA)</Label>
                    <div className="flex gap-2">
                      <Input type="color" className="w-12 h-10 p-1" value={layoutData.ctaTextColor} onChange={e => setLayoutData({...layoutData, ctaTextColor: e.target.value})} />
                      <Input value={layoutData.ctaTextColor} onChange={e => setLayoutData({...layoutData, ctaTextColor: e.target.value})} />
                    </div>
                  </div>

                  <div className="space-y-2 col-span-2">
                    <Label>Cor do Container de Fundo (Backdrop)</Label>
                    <div className="flex gap-2">
                      <Input type="color" className="w-12 h-10 p-1" value={layoutData.backdropColor.startsWith('rgba') ? '#000000' : layoutData.backdropColor} onChange={e => setLayoutData({...layoutData, backdropColor: e.target.value})} />
                      <Input value={layoutData.backdropColor} onChange={e => setLayoutData({...layoutData, backdropColor: e.target.value})} />
                    </div>
                    <p className="text-[10px] text-muted-foreground italic">Dica: Use RGBA para transparência, ex: rgba(0,0,0,0.05)</p>
                  </div>

                  <div className="space-y-2">
                    <Label className="flex items-center gap-2"><Timer className="h-3 w-3" /> Tempo de Exibição (seg)</Label>
                    <Input 
                      type="number" 
                      min="5" 
                      max="60" 
                      value={layoutData.duration} 
                      onChange={e => setLayoutData({...layoutData, duration: parseInt(e.target.value) || 15})} 
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Intensidade da Sombra (0 a 1)</Label>
                    <Input type="range" min="0" max="1" step="0.05" value={layoutData.shadowIntensity} onChange={e => setLayoutData({...layoutData, shadowIntensity: e.target.value})} />
                  </div>
                </div>

                <div className="pt-4 flex gap-3">
                  <Button variant="outline" className="flex-1 gap-2" onClick={handleResetLayout}>
                    <RotateCcw className="h-4 w-4" /> Resetar
                  </Button>
                  <Button className="flex-[2] gap-2" onClick={handleSaveLayout} disabled={isSavingLayout}>
                    {isSavingLayout ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Salvar Alterações
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-secondary/10 border-dashed">
              <CardHeader>
                <CardTitle>Preview do Card</CardTitle>
                <CardDescription>Veja como os usuários visualizarão a notificação.</CardDescription>
              </CardHeader>
              <CardContent className="flex items-center justify-center py-12" style={{ backgroundColor: layoutData.backdropColor }}>
                <div 
                  className="w-full max-w-[380px] overflow-hidden border border-slate-100 relative"
                  style={{ 
                    backgroundColor: layoutData.bgColor,
                    borderRadius: `${layoutData.borderRadius}px`,
                    boxShadow: `0 25px 60px rgba(0,0,0,${layoutData.shadowIntensity})`
                  }}
                >
                  <button className="absolute top-4 right-4 z-20 p-1.5 rounded-full bg-black/5 text-slate-400">
                    <X className="h-3.5 w-3.5" />
                  </button>

                  <div className="w-full aspect-video bg-slate-50 flex items-center justify-center overflow-hidden border-b border-slate-100">
                    <ImageIcon className="h-12 w-12 text-slate-200" />
                  </div>
                  
                  <div className="p-6 space-y-4">
                    <div className="flex gap-4">
                      <div 
                        className="h-10 w-10 rounded-full flex items-center justify-center shrink-0"
                        style={{ backgroundColor: layoutData.iconBgColor }}
                      >
                        <Megaphone className="h-5 w-5" style={{ color: layoutData.iconColor }} />
                      </div>
                      <div className="flex-1 space-y-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <ShieldCheck className="h-3 w-3" style={{ color: layoutData.iconColor }} />
                          <span className="text-[9px] font-bold uppercase tracking-widest opacity-80" style={{ color: layoutData.iconColor }}>Administração</span>
                        </div>

                        <h4 className="font-bold leading-tight text-base pr-6" style={{ color: layoutData.titleColor }}>Título da Notificação</h4>
                        <p className="text-sm leading-relaxed" style={{ color: layoutData.bodyColor }}>Esta é uma prévia de como o texto da sua mensagem aparecerá para os usuários.</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 px-3 py-2 bg-secondary/30 rounded-xl border border-border/50">
                      <Info className="h-3 w-3 text-muted-foreground shrink-0" />
                      <p className="text-[9px] text-muted-foreground leading-tight">
                        Esta é uma mensagem enviada pela administração da <strong>HomeCare Match</strong>.
                      </p>
                    </div>
                    
                    <div className="pt-2">
                      <Button 
                        size="sm" 
                        className="h-10 w-full gap-1.5 text-xs font-bold rounded-full shadow-md"
                        style={{ backgroundColor: layoutData.ctaBgColor, color: layoutData.ctaTextColor }}
                      >
                        Ver Detalhes <ExternalLink className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
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
                <CardDescription>Acompanhe o status das notificações enviadas e agendadas.</CardDescription>
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
                <Button variant="ghost" size="icon" onClick={fetchHistory} disabled={loading}>
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
                    <TableHead>Data</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.length > 0 ? history.map((h) => (
                    <TableRow key={h.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          {h.image_url && (
                            <img src={h.image_url} className="h-8 w-8 rounded object-cover border" alt="Thumb" />
                          )}
                          <div>
                            <div className="font-medium text-sm">{h.title}</div>
                            <div className="text-[10px] text-muted-foreground truncate max-w-[200px]">{h.body}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px]">{getTargetLabel(h.target_role)}</Badge>
                      </TableCell>
                      <TableCell>{getStatusBadge(h.status)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {h.sent_at ? format(new Date(h.sent_at), "dd/MM HH:mm") : h.scheduled_for ? format(new Date(h.scheduled_for), "dd/MM HH:mm") : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDeleteSubscriber(h.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  )) : (
                    <TableRow>
                      <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                        Nenhuma notificação registrada.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="subscribers">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Dispositivos Inscritos</CardTitle>
                <CardDescription>Lista de navegadores que autorizaram o recebimento de notificações.</CardDescription>
              </div>
              <Button variant="ghost" size="icon" onClick={fetchSubscribers} disabled={loading}>
                <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
              </Button>
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
                            <Badge variant="outline" className="text-[8px] h-4 uppercase">{s.profile.role}</Badge>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 text-muted-foreground italic text-sm">
                            <User className="h-3 w-3" /> Anônimo / Visitante
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-xs">
                          {s.device_type === 'mobile' ? <Smartphone className="h-3 w-3" /> : <Monitor className="h-3 w-3" />}
                          <span className="capitalize">{s.device_type || 'Desconhecido'}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {format(new Date(s.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-destructive hover:bg-destructive/10"
                          onClick={() => handleDeleteSubscriber(s.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  )) : (
                    <TableRow>
                      <TableCell colSpan={4} className="h-32 text-center text-muted-foreground">
                        Nenhum dispositivo inscrito ainda.
                      </TableCell>
                    </TableRow>
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

export default PushNotificationsPage;