"use client";

import MarketingTab from "@/components/admin/MarketingTab";

const MarketingPage = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Marketing & Analytics</h1>
        <p className="text-muted-foreground">Configure pixels, gere UTMs e crie links curtos rastreaveis.</p>
      </div>
      <MarketingTab />
    </div>
  );
};
export default MarketingPage;
