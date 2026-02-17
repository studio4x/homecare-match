"use client";

import VideosTab from "@/components/admin/VideosTab";

const VideosPage = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Vídeos das Landing Pages</h1>
        <p className="text-muted-foreground">Gerencie os vídeos de apresentação exibidos para cada tipo de usuário.</p>
      </div>
      <VideosTab />
    </div>
  );
};

export default VideosPage;