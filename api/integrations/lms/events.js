export const config = {
  api: {
    bodyParser: false,
  },
};

const readRawBody = async (req) => {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  if (!supabaseUrl) {
    res.status(500).json({ error: "SUPABASE_URL ausente." });
    return;
  }

  const rawBody = await readRawBody(req);
  const target = `${supabaseUrl.replace(/\/+$/, "")}/functions/v1/lms-events`;

  const response = await fetch(target, {
    method: "POST",
    headers: {
      "Content-Type": req.headers["content-type"] || "application/json",
      "X-HCM-Timestamp": req.headers["x-hcm-timestamp"] || "",
      "X-HCM-Signature": req.headers["x-hcm-signature"] || "",
      "X-Request-Id": req.headers["x-request-id"] || "",
    },
    body: rawBody,
  });

  const text = await response.text();
  res.status(response.status);
  res.setHeader("Content-Type", response.headers.get("content-type") || "application/json");
  res.send(text);
}
