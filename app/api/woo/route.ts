import { NextRequest, NextResponse } from "next/server";
import { serverEnv } from "@/lib/server-env";

const ALLOWED_METHODS = new Set(["GET", "POST", "PUT", "PATCH", "DELETE"]);
const ALLOWED_ENDPOINT_PATTERNS = [
  /^products$/,
  /^products\/categories$/,
  /^products\/categories\/\d+$/,
  /^products\/attributes$/,
  /^products\/attributes\/\d+\/terms$/,
  /^products\/\d+$/,
  /^products\/\d+\/variations$/,
  /^products\/\d+\/variations\/\d+$/,
  /^products\/\d+\/variations\/batch$/,
];

function isAllowedWooEndpoint(endpoint: string): boolean {
  return ALLOWED_ENDPOINT_PATTERNS.some((pattern) => pattern.test(endpoint));
}


export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { endpoint, method = "GET", data, params } = body as {
      endpoint?: string;
      method?: string;
      data?: unknown;
      params?: Record<string, string | number | boolean>;
    };

    if (!endpoint) {
      return NextResponse.json(
        { error: "Missing required endpoint" },
        { status: 400 },
      );
    }
    const normalizedMethod = String(method || "GET").toUpperCase();
    const allowed = isAllowedWooEndpoint(endpoint);
    if (!allowed) {
      return NextResponse.json(
        { error: "Endpoint is not allowed." },
        { status: 400 },
      );
    }
    if (!ALLOWED_METHODS.has(normalizedMethod)) {
      return NextResponse.json({ error: "Method is not allowed." }, { status: 400 });
    }

    const apiUrl = new URL(`${serverEnv.WOO_URL}/wp-json/wc/v3/${endpoint}`);

    // Pass WooCommerce credentials as query params (bypasses CDN/WAF that strips Authorization headers)
    apiUrl.searchParams.set("consumer_key", serverEnv.WOO_CONSUMER_KEY);
    apiUrl.searchParams.set("consumer_secret", serverEnv.WOO_CONSUMER_SECRET);

    // Add any extra query parameters
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        apiUrl.searchParams.set(k, String(v));
      }
    }

    const opts: RequestInit = {
      method: normalizedMethod,
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
    };

    if (data && (normalizedMethod === "POST" || normalizedMethod === "PUT" || normalizedMethod === "PATCH")) {
      opts.body = JSON.stringify(data);
    }

    const response = await fetch(apiUrl.toString(), opts);

    // WooCommerce sometimes returns empty bodies for 204 No Content
    const responseText = await response.text();

    // Detect CDN/WAF challenge page (HTML instead of JSON)
    const isHtmlResponse = responseText.trimStart().startsWith("<!DOCTYPE") || responseText.trimStart().startsWith("<html");
    if (isHtmlResponse) {
      return NextResponse.json(
        { error: `WooCommerce diblokir CDN/WAF (status ${response.status}). Whitelist IP server ini di panel hosting WooCommerce.` },
        { status: 502 },
      );
    }

    let responseData;
    try {
      responseData = responseText ? JSON.parse(responseText) : {};
    } catch {
      responseData = { message: responseText };
    }

    if (!response.ok) {
      return NextResponse.json(
        {
          error:
            responseData.message || `WooCommerce API Error: ${response.status}`,
        },
        { status: response.status },
      );
    }

    return NextResponse.json(responseData);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json(
      { error: message },
      { status: 500 },
    );
  }
}
