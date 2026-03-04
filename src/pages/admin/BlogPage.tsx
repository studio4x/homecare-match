"use client";

import BlogTab from "@/components/admin/BlogTab";

const BlogPage = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Blog</h1>
        <p className="text-muted-foreground">
          Gerencie artigos, categorias e tags com SEO completo, schema e suporte de IA.
        </p>
      </div>
      <BlogTab />
    </div>
  );
};

export default BlogPage;
