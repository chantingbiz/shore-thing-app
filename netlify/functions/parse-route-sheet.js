const OPENAI_URL = "https://api.openai.com/v1/responses";

const EXTRACTION_PROMPT = `You are extracting structured rows from a pool-service route sheet photo or PDF.

For each property/stop row on the sheet, output one JSON object with exactly these keys:
- "name": string — property or rental name as shown
- "address": string — full address (number, street, city/area if visible)
- "serviceType": string — copy the cell text from the "Service Type" column for that row only (verbatim). If the column is missing or unreadable, use "".
- "ownerComments": string — copy the cell text from the "Owner Information / Comments" column for that row only (verbatim). If the column is missing or unreadable, use "".

Do NOT output routeType, heat, guest_check, or pool_heat. The app will derive those from serviceType and ownerComments.

Rules for extraction only:
- Map each row to the correct Service Type and Owner Information / Comments cells for that same row (do not mix rows).
- Preserve wording/spelling from those two columns as closely as possible so substring checks work downstream.
- Best effort: extract every distinct property row you can read.
- Return ONLY a valid JSON array. No markdown fences, no commentary before or after.
Example: [{"name":"Example","address":"123 Main St","serviceType":"Pool & Spa Check","ownerComments":"YES POOL HEAT"}]`;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function stripJsonFromAssistantText(s) {
  let t = String(s ?? "").trim();
  const fenced = /^```(?:json)?\s*([\s\S]*?)```$/im.exec(t);
  if (fenced) t = fenced[1].trim();
  const start = t.indexOf("[");
  const end = t.lastIndexOf("]");
  if (start !== -1 && end > start) {
    t = t.slice(start, end + 1);
  }
  return t;
}

function extractOutputText(resp) {
  if (typeof resp.output_text === "string" && resp.output_text.trim()) {
    return resp.output_text;
  }
  const chunks = [];
  for (const item of resp.output ?? []) {
    if (item.type === "message" && Array.isArray(item.content)) {
      for (const part of item.content) {
        if (part.type === "output_text" && part.text) chunks.push(part.text);
      }
    }
  }
  return chunks.join("");
}

export const handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: CORS_HEADERS, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Server missing OPENAI_API_KEY" }),
    };
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return {
      statusCode: 400,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Invalid JSON body" }),
    };
  }

  const imageBase64 = typeof body.imageBase64 === "string" ? body.imageBase64.trim() : "";
  const mimeType =
    typeof body.mimeType === "string" && body.mimeType.trim()
      ? body.mimeType.trim()
      : "image/jpeg";

  if (!imageBase64) {
    return {
      statusCode: 400,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Missing imageBase64" }),
    };
  }

  const dataUrl = mimeType.startsWith("data:")
    ? mimeType
    : `data:${mimeType};base64,${imageBase64}`;

  const payload = {
    model: "gpt-4o-mini",
    max_output_tokens: 8192,
    temperature: 0.1,
    input: [
      {
        type: "message",
        role: "user",
        content: [
          { type: "input_text", text: EXTRACTION_PROMPT },
          { type: "input_image", image_url: dataUrl, detail: "high" },
        ],
      },
    ],
  };

  let openaiRes;
  let openaiRaw;
  try {
    openaiRes = await fetch(OPENAI_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    openaiRaw = await openaiRes.text();
  } catch (err) {
    return {
      statusCode: 500,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      body: JSON.stringify({
        error: "OpenAI request failed",
        detail: err instanceof Error ? err.message : String(err),
      }),
    };
  }

  if (!openaiRes.ok) {
    return {
      statusCode: 500,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      body: JSON.stringify({
        error: "OpenAI API error",
        status: openaiRes.status,
        raw: openaiRaw,
      }),
    };
  }

  let openaiJson;
  try {
    openaiJson = JSON.parse(openaiRaw);
  } catch {
    return {
      statusCode: 500,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      body: JSON.stringify({
        error: "OpenAI returned non-JSON",
        raw: openaiRaw,
      }),
    };
  }

  if (openaiJson.status && openaiJson.status !== "completed") {
    return {
      statusCode: 500,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      body: JSON.stringify({
        error: "OpenAI response not completed",
        status: openaiJson.status,
        incomplete_details: openaiJson.incomplete_details ?? null,
        raw: openaiRaw,
      }),
    };
  }

  if (openaiJson.error) {
    return {
      statusCode: 500,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      body: JSON.stringify({
        error: "OpenAI error object",
        raw: openaiRaw,
      }),
    };
  }

  const assistantText = extractOutputText(openaiJson);
  const trimmed = stripJsonFromAssistantText(assistantText);

  let rows;
  try {
    rows = JSON.parse(trimmed);
  } catch (parseErr) {
    return {
      statusCode: 500,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      body: JSON.stringify({
        error: "Could not parse model output as JSON array",
        detail: parseErr instanceof Error ? parseErr.message : String(parseErr),
        raw: assistantText,
      }),
    };
  }

  if (!Array.isArray(rows)) {
    return {
      statusCode: 500,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      body: JSON.stringify({
        error: "Model output was not a JSON array",
        raw: assistantText,
      }),
    };
  }

  return {
    statusCode: 200,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    body: JSON.stringify(rows),
  };
};
