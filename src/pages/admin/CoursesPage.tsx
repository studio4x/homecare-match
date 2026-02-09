"use client";

import CoursesTab from "@/components/admin/CoursesTab";

const CoursesPage = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Cursos e Capacitação</h1>
        <p className="text-muted-foreground">Gerencie o conteúdo educativo da plataforma.</p>
      </div>
      <CoursesTab />
    </div>
  );
};
export default CoursesPage;