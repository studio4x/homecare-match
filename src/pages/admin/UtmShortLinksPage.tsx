"use client";

import UtmShortLinksCard from "@/components/admin/UtmShortLinksCard";

const UtmShortLinksPage = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">UTM + Links Curtos</h1>
        <p className="text-muted-foreground">
          Crie, edite, duplique e acompanhe links curtos rastreaveis por campanha.
        </p>
      </div>
      <UtmShortLinksCard />
    </div>
  );
};

export default UtmShortLinksPage;
