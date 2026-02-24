"use client";

import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Loader2,
  Save,
  User,
  HeartPulse,
  Footprints,
  Brain,
  Syringe,
  MessageSquare,
  Eye,
  EyeOff,
  Calendar,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";

const mobilityLevelOptions = [
  "Acamado",
  "Cadeira de Rodas",
  "Anda com Auxílio",
  "Totalmente Móvel",
];

const cognitiveStateOptions = [
  "Alerta e Orientado",
  "Comprometimento Leve",
  "Demência",
  "Confusão/Agitação",
];

const specialEquipmentOptions = [
  "Oxigênio",
  "Sonda de Alimentação",
  "Cateter",
  "Ventilador",
  "Ostomia",
];

const communicationSkillsOptions = [
  "Verbal",
  "Não-Verbal",
  "Com Dificuldade",
  "Prancha de Comunicação",
];

const formSchema = z.object({
  id: z.string().optional(), // For editing existing patients
  patient_name: z.string().optional(), // Changed to optional
  patient_age: z.preprocess(
    (val) => (val === "" ? undefined : Number(val)),
    z.number().min(0, "Idade deve ser um número positivo").optional()
  ),
  patient_medical_conditions: z.string().optional(),
  patient_mobility_level: z.array(z.string()).default([]),
  patient_cognitive_state: z.array(z.string()).default([]),
  patient_special_equipment: z.array(z.string()).default([]),
  patient_communication_skills: z.array(z.string()).default([]),
  is_visible: z.boolean().default(true),
});

type PatientFormData = z.infer<typeof formSchema>;

interface CompanyPatientFormProps {
  initialData?: any; // Existing patient data for editing
  onSuccess: () => void;
  onCancel: () => void;
}

const CompanyPatientForm = ({ initialData, onSuccess, onCancel }: CompanyPatientFormProps) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  const form = useForm<PatientFormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      id: initialData?.id || undefined,
      patient_name: initialData?.patient_name || "",
      patient_age: initialData?.patient_age || undefined,
      patient_medical_conditions: initialData?.patient_medical_conditions || "",
      patient_mobility_level: initialData?.patient_mobility_level || [],
      patient_cognitive_state: initialData?.patient_cognitive_state || [],
      patient_special_equipment: initialData?.patient_special_equipment || [],
      patient_communication_skills: initialData?.patient_communication_skills || [],
      is_visible: initialData?.is_visible ?? true,
    },
  });

  const onSubmit = async (data: PatientFormData) => {
    if (!user) {
      toast.error("Você precisa estar logado para gerenciar pacientes.");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        company_id: user.id,
        patient_name: data.patient_name || null, // Ensure null if empty
        patient_age: data.patient_age || null,
        patient_medical_conditions: data.patient_medical_conditions || null,
        patient_mobility_level: data.patient_mobility_level,
        patient_cognitive_state: data.patient_cognitive_state,
        patient_special_equipment: data.patient_special_equipment,
        patient_communication_skills: data.patient_communication_skills,
        is_visible: data.is_visible,
      };

      if (data.id) {
        // Update existing patient
        const { error } = await supabase
          .from("company_patients")
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq("id", data.id);
        if (error) throw error;
        toast.success("Paciente atualizado com sucesso!");
      } else {
        // Add new patient
        const { error } = await supabase
          .from("company_patients")
          .insert(payload);
        if (error) throw error;
        toast.success("Paciente adicionado com sucesso!");
      }
      onSuccess();
    } catch (error: any) {
      console.error("[CompanyPatientForm] Erro ao salvar paciente:", error);
      toast.error("Erro ao salvar paciente. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="patient_name"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="flex items-center gap-2">
                <User className="h-4 w-4 text-primary" /> ID/Código do Paciente* (opcional)
              </FormLabel>
              <FormControl>
                <Input placeholder="Ex: Paciente-001, Maria Silva" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="patient_age"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-primary" /> Idade
              </FormLabel>
              <FormControl>
                <Input type="number" placeholder="Ex: 75" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="patient_medical_conditions"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="flex items-center gap-2">
                <HeartPulse className="h-4 w-4 text-primary" /> Condições Médicas / Histórico
              </FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Ex: AVC com sequelas motoras, Alzheimer em estágio inicial, Diabetes tipo 2."
                  rows={3}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="patient_mobility_level"
          render={() => (
            <FormItem>
              <FormLabel className="flex items-center gap-2">
                <Footprints className="h-4 w-4 text-primary" /> Nível de Mobilidade
              </FormLabel>
              <div className="grid grid-cols-2 gap-2">
                {mobilityLevelOptions.map((option) => (
                  <FormField
                    key={option}
                    control={form.control}
                    name="patient_mobility_level"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value?.includes(option)}
                            onCheckedChange={(checked) => {
                              return checked
                                ? field.onChange([...field.value, option])
                                : field.onChange(
                                    field.value?.filter((value) => value !== option)
                                  );
                            }}
                          />
                        </FormControl>
                        <FormLabel className="font-normal">{option}</FormLabel>
                      </FormItem>
                    )}
                  />
                ))}
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="patient_cognitive_state"
          render={() => (
            <FormItem>
              <FormLabel className="flex items-center gap-2">
                <Brain className="h-4 w-4 text-primary" /> Estado Cognitivo
              </FormLabel>
              <div className="grid grid-cols-2 gap-2">
                {cognitiveStateOptions.map((option) => (
                  <FormField
                    key={option}
                    control={form.control}
                    name="patient_cognitive_state"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value?.includes(option)}
                            onCheckedChange={(checked) => {
                              return checked
                                ? field.onChange([...field.value, option])
                                : field.onChange(
                                    field.value?.filter((value) => value !== option)
                                  );
                            }}
                          />
                        </FormControl>
                        <FormLabel className="font-normal">{option}</FormLabel>
                      </FormItem>
                    )}
                  />
                ))}
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="patient_special_equipment"
          render={() => (
            <FormItem>
              <FormLabel className="flex items-center gap-2">
                <Syringe className="h-4 w-4 text-primary" /> Equipamentos Especiais
              </FormLabel>
              <div className="grid grid-cols-2 gap-2">
                {specialEquipmentOptions.map((option) => (
                  <FormField
                    key={option}
                    control={form.control}
                    name="patient_special_equipment"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value?.includes(option)}
                            onCheckedChange={(checked) => {
                              return checked
                                ? field.onChange([...field.value, option])
                                : field.onChange(
                                    field.value?.filter((value) => value !== option)
                                  );
                            }}
                          />
                        </FormControl>
                        <FormLabel className="font-normal">{option}</FormLabel>
                      </FormItem>
                    )}
                  />
                ))}
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="patient_communication_skills"
          render={() => (
            <FormItem>
              <FormLabel className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-primary" /> Habilidades de Comunicação
              </FormLabel>
              <div className="grid grid-cols-2 gap-2">
                {communicationSkillsOptions.map((option) => (
                  <FormField
                    key={option}
                    control={form.control}
                    name="patient_communication_skills"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value?.includes(option)}
                            onCheckedChange={(checked) => {
                              return checked
                                ? field.onChange([...field.value, option])
                                : field.onChange(
                                    field.value?.filter((value) => value !== option)
                                  );
                            }}
                          />
                        </FormControl>
                        <FormLabel className="font-normal">{option}</FormLabel>
                      </FormItem>
                    )}
                  />
                ))}
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="is_visible"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5">
                <FormLabel className="text-base">Visível para Profissionais</FormLabel>
                <p className="text-xs text-muted-foreground">
                  Se ativado, este paciente aparecerá no perfil público da sua empresa.
                </p>
              </div>
              <FormControl>
                <Switch checked={field.value} onCheckedChange={field.onChange} />
              </FormControl>
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            Salvar Paciente
          </Button>
        </div>
      </form>
    </Form>
  );
};

export default CompanyPatientForm;