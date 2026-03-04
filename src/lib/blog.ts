export interface BlogCategory {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  seo_title?: string | null;
  seo_description?: string | null;
  seo_canonical_url?: string | null;
  seo_robots?: string | null;
  seo_og_title?: string | null;
  seo_og_description?: string | null;
  seo_og_image_url?: string | null;
  schema_json?: Record<string, unknown> | null;
  created_at?: string;
  updated_at?: string;
}

export interface BlogTag {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  seo_title?: string | null;
  seo_description?: string | null;
  seo_canonical_url?: string | null;
  seo_robots?: string | null;
  seo_og_title?: string | null;
  seo_og_description?: string | null;
  seo_og_image_url?: string | null;
  schema_json?: Record<string, unknown> | null;
  created_at?: string;
  updated_at?: string;
}

export interface BlogArticle {
  id: string;
  title: string;
  slug: string;
  excerpt?: string | null;
  cover_image_url?: string | null;
  content_html?: string | null;
  status: "draft" | "published";
  published_at?: string | null;
  author_name?: string | null;
  reading_time_minutes?: number | null;
  featured?: boolean;
  category_id?: string | null;
  category?: BlogCategory | null;
  tags: BlogTag[];
  seo_title?: string | null;
  seo_description?: string | null;
  seo_canonical_url?: string | null;
  seo_robots?: string | null;
  seo_og_title?: string | null;
  seo_og_description?: string | null;
  seo_og_image_url?: string | null;
  focus_keyword?: string | null;
  schema_json?: Record<string, unknown> | null;
  created_at?: string;
  updated_at?: string;
}

export const generateSlug = (text: string) => {
  return (text || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/--+/g, "-")
    .replace(/-+$/, "")
    .trim();
};

export const stripHtml = (html: string) =>
  (html || "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export const estimateReadingTime = (html: string) => {
  const plain = stripHtml(html);
  const words = plain ? plain.split(" ").filter(Boolean).length : 0;
  return Math.max(1, Math.ceil(words / 220));
};

export const getExcerptFromHtml = (html: string, maxLength = 180) => {
  const plain = stripHtml(html);
  if (plain.length <= maxLength) return plain;
  return `${plain.slice(0, maxLength - 1).trim()}...`;
};

export const resolveBlogTags = (record: any): BlogTag[] => {
  const links = Array.isArray(record?.blog_article_tags) ? record.blog_article_tags : [];
  return links
    .map((link: any) => link?.tag || null)
    .filter(Boolean)
    .map((tag: any) => ({
      id: String(tag.id),
      name: tag.name || "",
      slug: tag.slug || "",
      description: tag.description || null,
      seo_title: tag.seo_title || null,
      seo_description: tag.seo_description || null,
      seo_canonical_url: tag.seo_canonical_url || null,
      seo_robots: tag.seo_robots || null,
      seo_og_title: tag.seo_og_title || null,
      seo_og_description: tag.seo_og_description || null,
      seo_og_image_url: tag.seo_og_image_url || null,
      schema_json: tag.schema_json || null,
      created_at: tag.created_at,
      updated_at: tag.updated_at,
    }));
};

export const mapBlogArticleRecord = (record: any): BlogArticle => {
  const category = record?.category
    ? {
        id: String(record.category.id),
        name: record.category.name || "",
        slug: record.category.slug || "",
        description: record.category.description || null,
        seo_title: record.category.seo_title || null,
        seo_description: record.category.seo_description || null,
        seo_canonical_url: record.category.seo_canonical_url || null,
        seo_robots: record.category.seo_robots || null,
        seo_og_title: record.category.seo_og_title || null,
        seo_og_description: record.category.seo_og_description || null,
        seo_og_image_url: record.category.seo_og_image_url || null,
        schema_json: record.category.schema_json || null,
        created_at: record.category.created_at,
        updated_at: record.category.updated_at,
      }
    : null;

  return {
    id: String(record.id),
    title: record.title || "",
    slug: record.slug || "",
    excerpt: record.excerpt || null,
    cover_image_url: record.cover_image_url || null,
    content_html: record.content_html || null,
    status: record.status === "published" ? "published" : "draft",
    published_at: record.published_at || null,
    author_name: record.author_name || "Equipe HomeCare Match",
    reading_time_minutes: record.reading_time_minutes || null,
    featured: !!record.featured,
    category_id: record.category_id || null,
    category,
    tags: resolveBlogTags(record),
    seo_title: record.seo_title || null,
    seo_description: record.seo_description || null,
    seo_canonical_url: record.seo_canonical_url || null,
    seo_robots: record.seo_robots || null,
    seo_og_title: record.seo_og_title || null,
    seo_og_description: record.seo_og_description || null,
    seo_og_image_url: record.seo_og_image_url || null,
    focus_keyword: record.focus_keyword || null,
    schema_json: record.schema_json || null,
    created_at: record.created_at,
    updated_at: record.updated_at,
  };
};

export const articleUrl = (slug: string) => `/blog/artigo/${slug}`;

