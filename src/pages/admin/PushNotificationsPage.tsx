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
  X
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const PushNotificationsPage = () => {
  const [loading, setLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
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
      toast.error("Erro ao carregar histórico.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const { error } = await supabase.functions.invoke('setup-push-notifications');
      if (error) throw error;
      toast.success("Banco de dados sincronizado!");
      fetchHistory();
    } catch (err) {
      toast.error("Erro ao sincronizar.");
    } finally {
      setIsSyncing(false);
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

  const handleResend = async (notif: any) => {
    const toastId = toast.loading("Reenviando...");
    try {
      const { data: result, error } = await supabase.functions.invoke('process-push-notifications', {
        body: { notificationId: notif.id, action: 'send_now' }
      });
      if (error) throw error;
      toast.success("Notificação reenviada!", { id: toastId });
      fetchHistory();
    } catch (err) {
      toast.error("Erro ao reenviar.", { id: toastId });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Deseja excluir este registro?")) return;
    try {
      const { error } = await supabase.from("push_notifications").delete().eq("id", id);
      if (error) throw error;
      setHistory(prev => prev.filter(h => h.id !== id));
      toast.success("Registro removido.");
    } catch (err) {
      toast.error("Erro ao excluir.");
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
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="new" className="gap-2"><Send className="h-4 w-4" /> Nova Mensagem</TabsTrigger>
          <TabsTrigger value="history" className="gap-2"><History className="h-4 w-4" /> Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value="new">
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
                      <Label>Título da Notificação</Label>
                      <Input 
                        placeholder="Ex: Novas vagas disponíveis!" 
                        value={formData.title}
                        onChange={e => setFormData({...formData, title: e.target.value})}
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
                          <SelectItem value="all">Todos os Usuários</SelectItem>
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
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Histórico de Envios</CardTitle>
                <CardDescription>Acompanhe o status das notificações enviadas e agendadas.</CardDescription>
              </div>
              <Button variant="ghost" size="icon" onClick={fetchHistory} disabled={loading}>
                <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
              </Button>
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
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={() => handleResend(h)} title="Reenviar">
                            <RefreshCw className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(h.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
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
      </Tabs>
    </div>
  );
};

export default PushNotificationsPage;