import React from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Power, PowerOff } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import RichTextEditor from "@/components/ui/RichTextEditor";
import { Edit2, Search, UserPlus, Mail } from "lucide-react";

export const OnboardingAdmin = () => {
  const queryClient = useQueryClient();
  const [selectedTemplate, setSelectedTemplate] = React.useState<any>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = React.useState(false);
  const [editForm, setEditForm] = React.useState({
    name: "",
    subject: "",
    preview_text: "",
    html_content: "",
    text_content: "",
    cta_label: "",
    cta_url: ""
  });
  const [searchTerm, setSearchTerm] = React.useState("");
  const [isAddingUser, setIsAddingUser] = React.useState(false);
  const [searchResults, setSearchResults] = React.useState<any[]>([]);
  const [isSearching, setIsSearching] = React.useState(false);

  // Queries
  const { data: globalSettings, isLoading: isLoadingSettings } = useQuery({
    queryKey: ["onboarding_settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("onboarding_system_settings")
        .select("*")
        .eq("setting_key", "is_system_active")
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const isSystemActive = (globalSettings?.setting_value as any)?.enabled === true;

  const toggleSystemMutation = useMutation({
    mutationFn: async (newValue: boolean) => {
      const { error } = await supabase
        .from("onboarding_system_settings")
        .upsert({
          setting_key: "is_system_active",
          setting_value: { enabled: newValue },
          updated_at: new Date().toISOString()
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["onboarding_settings"] });
      toast.success("Status do sistema atualizado com sucesso.");
    },
    onError: (err: any) => {
      toast.error("Erro ao atualizar status do sistema: " + err.message);
    }
  });
  const { data: flows, isLoading: isLoadingFlows } = useQuery({
    queryKey: ["admin_flows"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("onboarding_email_flows")
        .select(`
          *,
          onboarding_email_steps (
            id, template_id, step_order, wait_after_previous_hours, send_type, condition_type, is_active,
            email_templates (name, subject)
          )
        `)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: templates, isLoading: isLoadingTemplates } = useQuery({
    queryKey: ["admin_templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_templates")
        .select("*")
        .order("name", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const { data: instances, isLoading: isLoadingInstances } = useQuery({
    queryKey: ["admin_instances"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_onboarding_flows")
        .select(`*, onboarding_email_flows (name)`)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;

      if (!data || data.length === 0) return [];

      const userIds = [...new Set(data.map((r: any) => r.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", userIds);

      const profileMap = Object.fromEntries((profiles || []).map((p: any) => [p.id, p]));
      return data.map((r: any) => ({ ...r, profiles: profileMap[r.user_id] || null }));
    },
  });

  const { data: logs, isLoading: isLoadingLogs } = useQuery({
    queryKey: ["admin_logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_onboarding_step_runs")
        .select(`*, email_templates (name)`)
        .order("processed_at", { ascending: false })
        .limit(100);
      if (error) throw error;

      if (!data || data.length === 0) return [];

      const userIds = [...new Set(data.map((r: any) => r.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", userIds);

      const profileMap = Object.fromEntries((profiles || []).map((p: any) => [p.id, p]));
      return data.map((r: any) => ({ ...r, profiles: profileMap[r.user_id] || null }));
    },
  });

  const updateTemplateMutation = useMutation({
    mutationFn: async (vars: any) => {
      const { id, ...updateData } = vars;
      const { error } = await supabase
        .from("email_templates")
        .update(updateData)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin_templates"] });
      queryClient.invalidateQueries({ queryKey: ["admin_flows"] });
      setIsEditDialogOpen(false);
      toast.success("Template atualizado com sucesso.");
    },
    onError: (err: any) => {
      toast.error("Erro ao atualizar template: " + err.message);
    }
  });

  const sendTestMutation = useMutation({
    mutationFn: async (templateId: string) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Sessão não encontrada.");

      const { data, error } = await supabase.functions.invoke("send-onboarding-email-test", {
        body: { 
          templateId, 
          testEmail: session.user.email,
          access_token: session.access_token 
        }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success(data.message || "E-mail de teste enviado!");
    },
    onError: (err: any) => {
      toast.error("Erro ao enviar teste: " + (err.message || "Erro desconhecido"));
    }
  });

  const handleEditClick = (template: any) => {
    setSelectedTemplate(template);
    setEditForm({
      name: template.name || "",
      subject: template.subject || "",
      preview_text: template.preview_text || "",
      html_content: template.html_content || "",
      text_content: template.text_content || "",
      cta_label: template.cta_label || "",
      cta_url: template.cta_url || ""
    });
    setIsEditDialogOpen(true);
  };

  const handleSaveTemplate = () => {
    if (!selectedTemplate) return;
    updateTemplateMutation.mutate({
      id: selectedTemplate.id,
      ...editForm,
      updated_at: new Date().toISOString()
    });
  };

  const handleSearchProfessionals = async () => {
    if (!searchTerm.trim()) return;
    setIsSearching(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email, avatar_url")
        .eq("role", "professional")
        .or(`full_name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`)
        .limit(5);
      
      if (error) throw error;
      setSearchResults(data || []);
    } catch (err: any) {
      toast.error("Erro ao buscar profissionais: " + err.message);
    } finally {
      setIsSearching(false);
    }
  };

  const startFlowMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { data, error } = await supabase.rpc("start_user_onboarding_flow", {
        p_user_id: userId
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin_instances"] });
      toast.success("Profissional adicionado ao fluxo com sucesso!");
      setSearchTerm("");
      setSearchResults([]);
    },
    onError: (err: any) => {
      toast.error(err.message || "Erro ao adicionar profissional.");
    }
  });

  const handleAddUserToFlow = (userId: string) => {
    startFlowMutation.mutate(userId);
  };

  return (
    <div className="space-y-6 animate-fade-in p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center border-b border-gray-200 pb-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Automação de E-mails</h1>
          <p className="text-gray-500 mt-1">Gestão de onboarding e comunicações automatizadas (Fase 1).</p>
        </div>

        <div className={`flex items-center gap-4 border p-4 rounded-lg shadow-sm transition-all duration-300 ${isSystemActive ? 'bg-green-50/50 border-green-100' : 'bg-red-50/50 border-red-100'}`}>
          <div className="flex flex-col items-end mr-2 text-right">
            <Label htmlFor="master-switch" className={`font-bold text-sm ${isSystemActive ? 'text-green-700' : 'text-red-700'}`}>
              SISTEMA {isSystemActive ? 'ATIVO' : 'DESATIVADO'}
            </Label>
            <span className="text-[10px] text-muted-foreground max-w-[150px] leading-tight">
              {isSystemActive ? 'Disparos automáticos habilitados.' : 'Todos os envios estão bloqueados globalmente.'}
            </span>
          </div>
          {isLoadingSettings || toggleSystemMutation.isPending ? (
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mr-2" />
          ) : (
             <Switch 
              id="master-switch" 
              checked={isSystemActive} 
              disabled={isLoadingSettings || toggleSystemMutation.isPending}
              onCheckedChange={(val) => toggleSystemMutation.mutate(val)}
              className={isSystemActive ? "data-[state=checked]:bg-green-600" : "data-[state=unchecked]:bg-red-200"}
            />
          )}
          {isSystemActive ? <Power className="h-5 w-5 text-green-600" /> : <PowerOff className="h-5 w-5 text-red-400" />}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Fluxos Ativos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">
              {isLoadingFlows ? "..." : flows?.filter(f => f.is_active).length || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Templates Cadastrados</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">
              {isLoadingTemplates ? "..." : templates?.filter(t => t.is_active).length || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Instâncias Pendentes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">
              {isLoadingInstances ? "..." : instances?.filter(i => i.status === "active").length || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="flows" className="w-full">
        <TabsList className="grid w-full grid-cols-4 max-w-3xl">
          <TabsTrigger value="flows">Fluxos e Passos</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="instances">Usuários no Fluxo</TabsTrigger>
          <TabsTrigger value="logs">Logs de Envio</TabsTrigger>
        </TabsList>

        <TabsContent value="flows" className="mt-6 space-y-6">
          {isLoadingFlows ? (
            <p>Carregando fluxos...</p>
          ) : flows?.map((flow) => (
            <Card key={flow.id} className="overflow-hidden">
              <CardHeader className="bg-gray-50 border-b">
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle className="text-xl">{flow.name}</CardTitle>
                    <CardDescription>Público alvo: {flow.audience_type}</CardDescription>
                  </div>
                  <Badge variant={flow.is_active ? "default" : "secondary"}>
                    {flow.is_active ? "Ativo" : "Inativo"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16 text-center">Ordem</TableHead>
                      <TableHead>Template</TableHead>
                      <TableHead>Espera (h)</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Condição</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {flow.onboarding_email_steps
                      ?.sort((a: any, b: any) => a.step_order - b.step_order)
                      .map((step: any) => (
                      <TableRow key={step.id}>
                        <TableCell className="text-center font-bold bg-muted/20">
                          {step.step_order}
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{step.email_templates?.name || "Template Desconhecido"}</div>
                          <div className="text-xs text-muted-foreground truncate max-w-xs">{step.email_templates?.subject}</div>
                        </TableCell>
                        <TableCell>{step.wait_after_previous_hours}h</TableCell>
                        <TableCell>
                          <Badge variant="outline">{step.send_type}</Badge>
                        </TableCell>
                        <TableCell>
                          {step.condition_type ? (
                            <span className="text-sm font-mono text-muted-foreground">{step.condition_type}</span>
                          ) : (
                            <span className="text-sm text-muted-foreground">-</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                    {!flow.onboarding_email_steps?.length && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-4">Nenhum passo cadastrado neste fluxo.</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="templates" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Templates de E-mail</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[600px] rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Assunto</TableHead>
                      <TableHead>Slug</TableHead>
                      <TableHead>Público</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-24 text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoadingTemplates ? (
                      <TableRow><TableCell colSpan={6}>Carregando...</TableCell></TableRow>
                    ) : templates?.filter(t => t.is_active).map((tpl) => (
                      <TableRow key={tpl.id}>
                        <TableCell className="font-medium">{tpl.name}</TableCell>
                        <TableCell className="truncate max-w-xs">{tpl.subject}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">{tpl.slug}</TableCell>
                        <TableCell>{tpl.audience_type}</TableCell>
                        <TableCell>
                          <Badge variant={tpl.is_active ? "default" : "secondary"}>
                            {tpl.is_active ? "Ativo" : "Inativo"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right flex justify-end gap-1">
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => sendTestMutation.mutate(tpl.id)}
                            disabled={sendTestMutation.isPending && sendTestMutation.variables === tpl.id}
                            title="Enviar E-mail de Teste"
                            className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                          >
                            {sendTestMutation.isPending && sendTestMutation.variables === tpl.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <Mail className="h-4 w-4" />
                            )}
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => handleEditClick(tpl)}
                            title="Editar Template"
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="instances" className="mt-6">
          <Card>
            <CardHeader>
                <CardTitle>Instâncias Ativas</CardTitle>
                <CardDescription>Acompanhe o progresso dos usuários nos fluxos de onboarding.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="mb-6 p-4 border rounded-lg bg-gray-50/50">
                  <div className="flex items-center gap-3 mb-4">
                    <UserPlus className="h-5 w-5 text-primary" />
                    <h3 className="font-semibold text-sm">Adicionar Profissional ao Fluxo Manualmente</h3>
                  </div>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input 
                        placeholder="Buscar por nome ou e-mail..." 
                        className="pl-9"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSearchProfessionals()}
                      />
                    </div>
                    <Button 
                      variant="secondary" 
                      onClick={handleSearchProfessionals}
                      disabled={isSearching}
                    >
                      {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : "Buscar"}
                    </Button>
                  </div>

                  {searchResults.length > 0 && (
                    <div className="mt-4 space-y-2">
                       <p className="text-[10px] font-bold text-muted-foreground uppercase px-1">Resultados</p>
                       {searchResults.map(p => (
                         <div key={p.id} className="flex items-center justify-between p-2 bg-white border rounded-md shadow-sm">
                           <div className="flex items-center gap-3">
                             <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden">
                               {p.avatar_url ? <img src={p.avatar_url} alt="" className="h-full w-full object-cover" /> : <span className="text-xs font-bold text-primary">{p.full_name?.charAt(0)}</span>}
                             </div>
                             <div>
                               <p className="text-sm font-medium">{p.full_name}</p>
                               <p className="text-[10px] text-muted-foreground">{p.email}</p>
                             </div>
                           </div>
                           <Button 
                            size="sm" 
                            variant="outline" 
                            className="h-8 gap-2"
                            onClick={() => handleAddUserToFlow(p.id)}
                            disabled={startFlowMutation.isPending && startFlowMutation.variables === p.id}
                           >
                             {startFlowMutation.isPending && startFlowMutation.variables === p.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <UserPlus className="h-3 w-3" />}
                             Adicionar
                           </Button>
                         </div>
                       ))}
                    </div>
                  )}
                </div>

                <ScrollArea className="h-[500px] rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Usuário</TableHead>
                      <TableHead>Fluxo</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Passo Atual</TableHead>
                      <TableHead>Próxima Execução</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoadingInstances ? (
                      <TableRow><TableCell colSpan={5}>Carregando...</TableCell></TableRow>
                    ) : instances?.map((inst) => (
                      <TableRow key={inst.id}>
                        <TableCell>
                           {/* @ts-ignore */}
                          <div className="font-medium">{inst.profiles?.full_name || 'Usuário Sem Nome'}</div>
                           {/* @ts-ignore */}
                          <div className="text-sm text-muted-foreground">{inst.profiles?.email}</div>
                        </TableCell>
                        <TableCell>
                           {/* @ts-ignore */}
                          {inst.onboarding_email_flows?.name}
                        </TableCell>
                        <TableCell>
                          <Badge variant={inst.status === 'completed' ? 'secondary' : inst.status === 'active' ? 'default' : 'destructive'}>
                            {inst.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">{inst.current_step_order}</TableCell>
                        <TableCell>
                          {inst.next_run_at ? new Date(inst.next_run_at).toLocaleString('pt-BR') : '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Histórico de Processamento (Logs)</CardTitle>
              <CardDescription>Mostrando os 100 processamentos mais recentes.</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[600px] rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data/Hora</TableHead>
                      <TableHead>Usuário</TableHead>
                      <TableHead>Template / Passo</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Erro / Referência</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoadingLogs ? (
                      <TableRow><TableCell colSpan={5}>Carregando...</TableCell></TableRow>
                    ) : logs?.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="whitespace-nowrap">
                          {log.processed_at ? new Date(log.processed_at).toLocaleString('pt-BR') : '-'}
                        </TableCell>
                        <TableCell>
                           {/* @ts-ignore */}
                          <div className="font-medium">{log.profiles?.full_name}</div>
                           {/* @ts-ignore */}
                          <div className="text-xs text-muted-foreground">{log.profiles?.email}</div>
                        </TableCell>
                        <TableCell>
                          {/* @ts-ignore */}
                          <div>Passo {log.step_order}: {log.email_templates?.name}</div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={
                            log.status === 'sent' ? 'default' :
                            log.status === 'skipped' ? 'outline' : 'destructive'
                          }>
                            {log.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm text-muted-foreground truncate max-w-xs" title={log.error_message || log.provider_message_id}>
                            {log.error_message || log.provider_message_id || '-'}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Template: {selectedTemplate?.slug}</DialogTitle>
          </DialogHeader>
          
          <div className="grid gap-6 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome do Template</Label>
                <Input 
                  id="name" 
                  value={editForm.name} 
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="subject">Assunto do E-mail</Label>
                <Input 
                  id="subject" 
                  value={editForm.subject} 
                  onChange={(e) => setEditForm({ ...editForm, subject: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="preview">Preview Text (Snippet)</Label>
              <Input 
                id="preview" 
                value={editForm.preview_text} 
                onChange={(e) => setEditForm({ ...editForm, preview_text: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Conteúdo HTML (Corpo do E-mail)</Label>
              <RichTextEditor 
                content={editForm.html_content} 
                onChange={(html) => setEditForm({ ...editForm, html_content: html })}
                enableHtmlModeToggle
                className="border rounded-md"
              />
              <p className="text-[10px] text-muted-foreground">
                Dica: Use <code>{"{{first_name}}"}</code>, <code>{"{{profile_completion}}"}</code>, etc. como variáveis dinâmicas.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="text_content">Conteúdo em Texto (Backup / Sem HTML)</Label>
              <Textarea 
                id="text_content" 
                value={editForm.text_content} 
                onChange={(e) => setEditForm({ ...editForm, text_content: e.target.value })}
                rows={5}
                className="font-mono text-sm"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t pt-4 mt-2">
              <div className="space-y-2">
                <Label htmlFor="cta_label">Rótulo do Botão (CTA)</Label>
                <Input 
                  id="cta_label" 
                  value={editForm.cta_label} 
                  onChange={(e) => setEditForm({ ...editForm, cta_label: e.target.value })}
                  placeholder="Ex: Acessar minha conta"
                />
                <p className="text-[10px] text-muted-foreground">Texto que aparecerá no botão.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="cta_url">Link/Caminho do CTA</Label>
                <Input 
                  id="cta_url" 
                  value={editForm.cta_url} 
                  onChange={(e) => setEditForm({ ...editForm, cta_url: e.target.value })}
                  placeholder="Ex: /dashboard ou https://..."
                />
                <p className="text-[10px] text-muted-foreground">URL ou caminho interno para o botão.</p>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>Cancelar</Button>
            <Button 
              onClick={handleSaveTemplate} 
              disabled={updateTemplateMutation.isPending}
            >
              {updateTemplateMutation.isPending ? "Salvando..." : "Salvar Alterações"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default OnboardingAdmin;
