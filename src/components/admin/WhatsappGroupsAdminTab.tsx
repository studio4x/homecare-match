import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, PlusCircle } from "lucide-react";
import { toast } from "sonner";

type JoinApprovalMode = "auto_approve" | "approval_required";

type CreateGroupResult = {
  success?: boolean;
  data?: Record<string, unknown>;
  error?: string;
  status?: number;
  details?: unknown;
};

const WhatsappGroupsAdminTab = () => {
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [joinApprovalMode, setJoinApprovalMode] = useState<JoinApprovalMode>("auto_approve");
  const [phoneNumberIdOverride, setPhoneNumberIdOverride] = useState("");
  const [creating, setCreating] = useState(false);
  const [lastResult, setLastResult] = useState<CreateGroupResult | null>(null);

  const handleCreateGroup = async () => {
    const normalizedSubject = subject.trim();
    const normalizedDescription = description.trim();
    const normalizedPhoneNumberId = phoneNumberIdOverride.trim();

    if (!normalizedSubject) {
      toast.error("Informe o nome do grupo.");
      return;
    }

    if (normalizedSubject.length > 128) {
      toast.error("O nome do grupo deve ter no maximo 128 caracteres.");
      return;
    }

    if (normalizedDescription.length > 2048) {
      toast.error("A descricao deve ter no maximo 2048 caracteres.");
      return;
    }

    setCreating(true);

    try {
      const { data: authSession } = await supabase.auth.getSession();
      const accessToken = authSession?.session?.access_token || "";
      if (!accessToken) {
        throw new Error("Sessao expirada. Faca login novamente.");
      }

      const body: Record<string, unknown> = {
        access_token: accessToken,
        subject: normalizedSubject,
        join_approval_mode: joinApprovalMode,
      };

      if (normalizedDescription) body.description = normalizedDescription;
      if (normalizedPhoneNumberId) body.phone_number_id = normalizedPhoneNumberId;

      const { data, error } = await supabase.functions.invoke("whatsapp-create-group", { body });
      if (error) throw error;

      const result = (data || {}) as CreateGroupResult;
      if (result?.error) {
        throw new Error(result.error);
      }

      setLastResult(result);
      const groupId = String(result?.data?.group_id || result?.data?.id || "").trim();
      if (groupId) {
        toast.success(`Grupo criado com sucesso. ID: ${groupId}`);
      } else {
        toast.success("Grupo criado com sucesso.");
      }
    } catch (createError: any) {
      const message = String(createError?.message || "Falha ao criar grupo no WhatsApp.");
      setLastResult({ success: false, error: message });
      toast.error(message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Criar grupo WhatsApp</CardTitle>
          <CardDescription>
            Cria um novo grupo pela API oficial da Meta. O link de convite inicial e enviado por webhook
            (<code>group_lifecycle_update</code>) apos a criacao.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="wa-group-subject">Nome do grupo</Label>
              <Input
                id="wa-group-subject"
                placeholder="Ex.: Leads HomeCare Match"
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                maxLength={128}
              />
              <p className="text-[11px] text-muted-foreground">Maximo de 128 caracteres.</p>
            </div>

            <div className="space-y-1">
              <Label htmlFor="wa-group-join-mode">Modo de entrada</Label>
              <Select
                value={joinApprovalMode}
                onValueChange={(value: JoinApprovalMode) => setJoinApprovalMode(value)}
              >
                <SelectTrigger id="wa-group-join-mode">
                  <SelectValue placeholder="Selecione o modo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto_approve">Entrada automatica (auto_approve)</SelectItem>
                  <SelectItem value="approval_required">Entrada com aprovacao (approval_required)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="wa-group-description">Descricao (opcional)</Label>
            <Textarea
              id="wa-group-description"
              className="min-h-[110px]"
              placeholder="Descreva objetivo e regras do grupo..."
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              maxLength={2048}
            />
            <p className="text-[11px] text-muted-foreground">Maximo de 2048 caracteres.</p>
          </div>

          <div className="space-y-1">
            <Label htmlFor="wa-group-phone-id">Business phone number ID (opcional)</Label>
            <Input
              id="wa-group-phone-id"
              placeholder="Se vazio, usa WHATSAPP_PHONE_NUMBER_ID do projeto"
              value={phoneNumberIdOverride}
              onChange={(event) => setPhoneNumberIdOverride(event.target.value)}
            />
          </div>

          <div className="flex items-center justify-end">
            <Button onClick={handleCreateGroup} disabled={creating}>
              {creating ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <PlusCircle className="mr-2 h-4 w-4" />
              )}
              Criar grupo
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ultimo resultado</CardTitle>
          <CardDescription>Resposta bruta da ultima chamada de criacao de grupo.</CardDescription>
        </CardHeader>
        <CardContent>
          {lastResult ? (
            <pre className="overflow-x-auto rounded-md border bg-muted/30 p-3 text-xs">
              {JSON.stringify(lastResult, null, 2)}
            </pre>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhuma criacao executada ainda.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default WhatsappGroupsAdminTab;
