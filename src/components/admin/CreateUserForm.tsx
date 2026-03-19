"use client";

import React, { useState, useRef, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import {
  Loader2,
  Eye,
  EyeOff,
  Save,
  Camera,
  User,
  Building2,
  Home,
  Mail,
  ShieldCheck,
  Bell,
  PlayCircle,
  FileCheck,
  RefreshCw,
  ExternalLink
} from "lucide-react";
import { toast } from "sonner";
import { translateAuthError } from "@/lib/error-utils";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const MAX_AVATAR_SIZE_MB = 2;

const formSchema = z.object({
  email: z.string().email("E-mail inválido").min(1, "E-mail é obrigatório"),
  password: z.string().min(6, "A senha deve ter pelo menos 6 caracteres"),
  fullName: z.string().min(3, "Nome completo é obrigatório"),
  role: z.enum(["professional", "company", "family", "affiliate"], { required_error: "Selecione o tipo de conta" }),
  
  phone: z.string().optional(),
  avatar_url: z.string().optional(),
  
  // Company-specific fields
  company_name: z.string().optional(),
  cnpj: z.string().optional(),
  ans_registration: z.string().optional(),

  // Admin-controlled flags
  is_verified: z.boolean().default(false),
  verification_sent: z.boolean().default(false),
  has_seen_onboarding: z.boolean().default(false),
  notifications_enabled: z.boolean().default(true),
});

type FormData = z.infer<typeof formSchema>;

interface CreateUserFormProps {
  onUserCreated?: () => void;
}

const CreateUserForm = ({ onUserCreated }: CreateUserFormProps) => {
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isUploading, setIsUploading] = useState<string | null>(null); // 'avatar'

  const avatarRef = useRef<HTMLInputElement>(null);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      password: "",
      fullName: "",
      role: "professional",
      phone: "",
      avatar_url: "",
      company_name: "",
      cnpj: "",
      ans_registration: "",
      is_verified: false,
      verification_sent: false,
      has_seen_onboarding: false,
      notifications_enabled: true,
    },
  });

  const currentRole = form.watch("role");
  const isProfessional = currentRole === 'professional';
  const isCompany = currentRole === 'company';
  const isFamily = currentRole === 'family';
  const currentAvatarUrl = form.watch("avatar_url");

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const numbers = e.target.value.replace(/\D/g, '').slice(0, 11);
    let formatted = numbers;
    if (numbers.length > 2) formatted = `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
    if (numbers.length > 7) formatted = `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7)}`;
    form.setValue("phone", formatted);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>, type: 'avatar') => {
    const file = event.target.files?.[0];
    if (!file) return;

    const maxSize = MAX_AVATAR_SIZE_MB;
    if (file.size > maxSize * 1024 * 1024) {
      toast.error(`O arquivo é muito grande. Limite máximo: ${maxSize}MB.`);
      return;
    }

    setIsUploading(type);
    
    const fileExt = file.name.split('.').pop();
    const bucket = 'avatars';
    const filePath = `admin-uploads/${Date.now()}_${file.name}`; // Unique path for admin uploads
    
    try {
      const { error: uploadError } = await supabase.storage.from(bucket).upload(filePath, file);
      if (uploadError) throw uploadError;
      
      const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(filePath);
      form.setValue("avatar_url", publicUrl);
      
      toast.success("Arquivo carregado!");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao enviar arquivo.");
    } finally {
      setIsUploading(null);
      if (event.target) event.target.value = ""; // Clear file input
    }
  };

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    try {
      const { error } = await supabase.functions.invoke('admin-create-user', {
        body: {
          email: data.email,
          password: data.password,
          fullName: data.fullName,
          role: data.role,
          phone: data.phone,
          avatar_url: data.avatar_url,
          company_name: data.company_name,
          cnpj: data.cnpj,
          ans_registration: data.ans_registration,
          is_verified: data.is_verified,
          verification_sent: data.verification_sent,
          has_seen_onboarding: data.has_seen_onboarding,
          notifications_enabled: data.notifications_enabled
        }
      });

      if (error) throw error;
      toast.success("Usuário e perfil criados com sucesso!");
      form.reset();
      if (onUserCreated) onUserCreated();
    } catch (error: any) {
      console.error("[CreateUserForm] Erro:", error);
      toast.error(translateAuthError(error.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              Dados de Acesso
            </CardTitle>
            <CardDescription>Informações para login e tipo de conta.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>E-mail *</FormLabel>
                  <FormControl><Input type="email" placeholder="email@exemplo.com" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Senha *</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input type={showPassword ? "text" : "password"} {...field} />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo de Conta *</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o tipo de conta" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="professional">Profissional</SelectItem>
                      <SelectItem value="company">Empresa</SelectItem>
                      <SelectItem value="family">Família</SelectItem>
                      <SelectItem value="affiliate">Afiliado</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              Informações Básicas do Perfil
            </CardTitle>
            <CardDescription>Dados essenciais para identificação na plataforma.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center gap-4">
              <div className="relative">
                <Avatar className="h-24 w-24 ring-4 ring-border">
                  <AvatarImage src={currentAvatarUrl || ""} />
                  <AvatarFallback className="text-2xl">
                    {form.watch("fullName")?.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase() || "??"}
                  </AvatarFallback>
                </Avatar>
                <Button size="icon" variant="secondary" className="absolute -bottom-1 -right-1 rounded-full shadow-md" onClick={() => avatarRef.current?.click()} disabled={isUploading === 'avatar'}>
                  {isUploading === 'avatar' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                </Button>
                <input type="file" ref={avatarRef} className="hidden" accept="image/*" onChange={e => handleFileUpload(e, 'avatar')} />
              </div>
              <div className="space-y-1">
                <h4 className="font-medium">Foto de Perfil</h4>
                <p className="text-xs text-muted-foreground">Recomendado: Quadrada, máx. {MAX_AVATAR_SIZE_MB}MB.</p>
              </div>
            </div>

            <FormField
              control={form.control}
              name="fullName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome Completo / Razão Social *</FormLabel>
                  <FormControl><Input placeholder="Nome ou Razão Social" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>WhatsApp</FormLabel>
                  <FormControl><Input placeholder="(11) 99999-9999" {...field} onChange={handlePhoneChange} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {isCompany && (
              <>
                <FormField
                  control={form.control}
                  name="company_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome da Empresa</FormLabel>
                      <FormControl><Input placeholder="Nome Fantasia da Empresa" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="cnpj"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>CNPJ</FormLabel>
                      <FormControl><Input placeholder="XX.XXX.XXX/XXXX-XX" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="ans_registration"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Registro ANS</FormLabel>
                      <FormControl><Input placeholder="Registro na ANS (se aplicável)" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              Configurações Administrativas
            </CardTitle>
            <CardDescription>Controles de acesso e visibilidade do perfil.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="is_verified"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Perfil Verificado</FormLabel>
                    <p className="text-xs text-muted-foreground">Concede o selo de verificado ao usuário.</p>
                  </div>
                  <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="verification_sent"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Solicitação de Verificação Enviada</FormLabel>
                    <p className="text-xs text-muted-foreground">Indica que o usuário enviou documentos para análise.</p>
                  </div>
                  <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="has_seen_onboarding"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Já viu o Tutorial de Boas-vindas</FormLabel>
                    <p className="text-xs text-muted-foreground">Define se o tutorial será exibido no próximo login.</p>
                  </div>
                  <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="notifications_enabled"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Notificações Ativadas</FormLabel>
                    <p className="text-xs text-muted-foreground">Permite que o usuário receba notificações do sistema.</p>
                  </div>
                  <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <Button type="submit" className="w-full gap-2" disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Criar Usuário e Perfil
        </Button>
      </form>
    </Form>
  );
};

export default CreateUserForm;
