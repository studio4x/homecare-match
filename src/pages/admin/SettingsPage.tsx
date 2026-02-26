"use client";

import SiteConfigTab from "@/components/admin/SiteConfigTab";

const SettingsPage = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Configurações Gerais</h1>
        <p className="text-muted-foreground">Personalize a aparência e contatos do site.</p>
      </div>
      <SiteConfigTab />
    </div>
  );
};
export default SettingsPage;
