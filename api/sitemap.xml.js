const SITE_URL = (process.env.SITE_URL || "https://www.homecarematch.com.br").replace(/\/+$/, "");
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "https://rkjvtnadqkbwomgzyswr.supabase.co";
const SUPABASE_ANON_KEY =
  process.env.VITE_SUPABASE_ANON_KEY || "sb_publishable_ieATkQhcgldd0uqss9Xwbg_ZWGDdFwU";

const STATIC_ROUTES = [
  { path: "/", changefreq: "daily", priority: "1.0" },
  { path: "/empresas", changefreq: "weekly", priority: "0.9" },
  { path: "/familias", changefreq: "weekly", priority: "0.9" },
  { path: "/buscar", changefreq: "daily", priority: "0.9" },
  { path: "/funcionalidades", changefreq: "weekly", priority: "0.8" },
  { path: "/cursos", changefreq: "daily", priority: "0.8" },
  { path: "/blog", changefreq: "daily", priority: "0.8" },
  { path: "/blog/categorias", changefreq: "weekly", priority: "0.7" },
  { path: "/blog/tags", changefreq: "weekly", priority: "0.7" },
  { path: "/blog/busca", changefreq: "weekly", priority: "0.7" },
  { path: "/suporte", changefreq: "monthly", priority: "0.5" },
  { path: "/politica-de-privacidade", changefreq: "yearly", priority: "0.3" },
  { path: "/politica-de-cookies", changefreq: "yearly", priority: "0.3" },
  { path: "/validar", changefreq: "monthly", priority: "0.4" },
];

const escapeXml = (value) =>
  String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

const asDateOnly = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
};

const requestSupabase = async (path) => {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return [];
  const url = `${SUPABASE_URL}${path}`;
  const response = await fetch(url, {
    method: "GET",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Supabase ${response.status} - ${detail || "falha ao carregar dados do sitemap"}`);
  }
  const payload = await response.json().catch(() => []);
  return Array.isArray(payload) ? payload : [];
};

const buildUrlNode = ({ loc, lastmod, changefreq, priority }) => {
  const nodes = [
    `<loc>${escapeXml(loc)}</loc>`,
    lastmod ? `<lastmod>${escapeXml(lastmod)}</lastmod>` : "",
    changefreq ? `<changefreq>${escapeXml(changefreq)}</changefreq>` : "",
    typeof priority === "string" && priority ? `<priority>${escapeXml(priority)}</priority>` : "",
  ].filter(Boolean);
  return `  <url>\n    ${nodes.join("\n    ")}\n  </url>`;
};

module.exports = async (req, res) => {
  try {
    const [blogRows, courseRows] = await Promise.all([
      requestSupabase(
        "/rest/v1/blog_articles?select=slug,published_at,updated_at,status&status=eq.published&order=published_at.desc.nullslast&limit=2000",
      ).catch(() => []),
      requestSupabase(
        "/rest/v1/academy_courses?select=slug,updated_at,created_at,is_active&is_active=eq.true&order=updated_at.desc.nullslast&limit=2000",
      ).catch(() => []),
    ]);

    const dynamicBlog = blogRows
      .map((row) => {
        const slug = String(row?.slug || "").trim();
        if (!slug) return null;
        return {
          loc: `${SITE_URL}/blog/artigo/${encodeURIComponent(slug)}`,
          lastmod: asDateOnly(row?.updated_at || row?.published_at),
          changefreq: "weekly",
          priority: "0.7",
        };
      })
      .filter(Boolean);

    const dynamicCourses = courseRows
      .map((row) => {
        const slug = String(row?.slug || "").trim();
        if (!slug) return null;
        return {
          loc: `${SITE_URL}/cursos/${encodeURIComponent(slug)}`,
          lastmod: asDateOnly(row?.updated_at || row?.created_at),
          changefreq: "weekly",
          priority: "0.7",
        };
      })
      .filter(Boolean);

    const staticEntries = STATIC_ROUTES.map((item) => ({
      loc: `${SITE_URL}${item.path === "/" ? "" : item.path}`,
      lastmod: "",
      changefreq: item.changefreq,
      priority: item.priority,
    }));

    const allEntries = [...staticEntries, ...dynamicBlog, ...dynamicCourses];
    const deduped = Array.from(new Map(allEntries.map((entry) => [entry.loc, entry])).values());
    const xmlNodes = deduped.map(buildUrlNode).join("\n");

    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${xmlNodes}\n</urlset>\n`;

    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader("Cache-Control", "public, s-maxage=900, stale-while-revalidate=86400");
    res.status(200).send(xml);
  } catch (error) {
    const message = String(error?.message || "Erro ao gerar sitemap.xml");
    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.status(500).send(
      `<?xml version="1.0" encoding="UTF-8"?>\n<error><message>${escapeXml(message)}</message></error>\n`,
    );
  }
};
