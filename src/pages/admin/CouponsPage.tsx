"use client";

import CouponsTab from "@/components/admin/CouponsTab";

const CouponsPage = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Cupons Promocionais</h1>
        <p className="text-muted-foreground">Crie e gerencie códigos de desconto para atrair novos profissionais.</p>
      </div>
      <CouponsTab />
    </div>
  );
};

export default CouponsPage;