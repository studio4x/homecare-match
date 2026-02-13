"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, Plus, Award, Trash2, Save, Settings2 } from "lucide-react";
import { toast } from "sonner";

const ReferralTiersConfig = () => {
  const [referralTiers, setReferralTiers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const fetchTiers = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke('referral-config', {
          body: { action: 'get' }
        });
        const defaultTiers = [
          { name: "Promotor", threshold: 3, badge_label: "Promotor" },
          { name: "Colaborador", threshold: 5, badge_label: "Colaborador" },
          { name: "Embaixador", threshold: 10, badge_label: "Embaixador" },
          { name: "Referência", threshold: 20, badge_label: "Referência" },
          { name: "Sênior", threshold: 35, badge_label: "Sênior" },
          { name: "Elite", threshold: 50, badge_label: "Elite" },
        ];
        if (!error && data?.tiers && Array.isArray(data.tiers) && data.tiers.length > 0) {
          setReferralTiers(data.tiers);
        } else {
          setReferralTiers(defaultTiers);
        }
      } catch (error) {
        console.error("Error fetching referral tiers:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchTiers();
  }, []);

  const handleSaveTiers = async () => {
    setIsSaving(true);
    try {
      const { error } = await supabase.functions.invoke('referral-config', {
        body: { action: 'set', tiers: referralTiers }
      });
      if (error) throw error;
      toast.success("Configurações de Tiers salvas com sucesso!");
    } catch (error) {
      toast.error("Erro ao salvar tiers.");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin text-primary" /></div>;

  return (
    <Card className="border-none shadow-sm">
      <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5 text-primary" />
            Configurar Tiers de Embaixador
          </CardTitle>
          <CardDescription>Defina as metas e rótulos para os selos de indicação.</CardDescription>
        </div>
        <Button onClick={() => setReferralTiers(prev => [...prev, { name: '', threshold: 1, badge_label: '' }])} className="gap-2">
          <Plus className="h-4 w-4" /> Novo Tier
        </Button>
      </CardHeader>
      <CardContent className="space-y-6">
        {referralTiers.length > 0 ? (
          <div className="grid gap-4">
            {referralTiers.map((t, idx) => (
              <div key={idx} className="grid md:grid-cols-12 gap-4 p-4 border rounded-lg bg-secondary/5 relative group">
                <div className="md:col-span-4 space-y-1.5">
                  <Label className="text-[10px] uppercase font-bold text-muted-foreground">Nome Interno</Label>
                  <Input 
                    placeholder="Ex: Nível 1"
                    value={t.name} 
                    onChange={e => {
                      const v = e.target.value;
                      setReferralTiers(prev => prev.map((x, i) => i === idx ? { ...x, name: v } : x));
                    }} 
                  />
                </div>
                <div className="md:col-span-3 space-y-1.5">
                  <Label className="text-[10px] uppercase font-bold text-muted-foreground">Meta (Indicações)</Label>
                  <Input 
                    type="number" 
                    value={t.threshold} 
                    onChange={e => {
                      const v = parseInt(e.target.value || '0', 10);
                      setReferralTiers(prev => prev.map((x, i) => i === idx ? { ...x, threshold: v } : x));
                    }} 
                  />
                </div>
                <div className="md:col-span-4 space-y-1.5">
                  <Label className="text-[10px] uppercase font-bold text-muted-foreground">Rótulo do Selo (Público)</Label>
                  <Input 
                    placeholder="Ex: Embaixador Bronze"
                    value={t.badge_label} 
                    onChange={e => {
                      const v = e.target.value;
                      setReferralTiers(prev => prev.map((x, i) => i === idx ? { ...x, badge_label: v } : x));
                    }} 
                  />
                </div>
                <div className="md:col-span-1 flex items-end justify-end">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="text-destructive hover:bg-destructive/10"
                    onClick={() => setReferralTiers(prev => prev.filter((_, i) => i !== idx))}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-10 border-2 border-dashed rounded-xl">
            <Award className="h-10 w-10 mx-auto mb-2 text-muted-foreground opacity-20" />
            <p className="text-sm text-muted-foreground">Nenhum tier configurado.</p>
          </div>
        )}

        <div className="flex justify-end gap-3 pt-4">
          <Button onClick={handleSaveTiers} disabled={isSaving} className="gap-2">
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Salvar Configurações
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default ReferralTiersConfig;