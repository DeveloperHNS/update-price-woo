import { NextRequest, NextResponse } from "next/server";
import { serverEnv } from "@/lib/server-env";

function wpAuthHeaderValue(): string {
  const token = Buffer.from(
    `${serverEnv.WP_USERNAME}:${serverEnv.WP_APP_PASSWORD}`,
  ).toString("base64");
  return `Basic ${token}`;
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing file in form-data." }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const uploadUrl = `${serverEnv.WP_URL}/wp-json/wp/v2/media`;

    const response = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        Authorization: wpAuthHeaderValue(),
        "Content-Disposition": `attachment; filename="${file.name}"`,
        "Content-Type": file.type || "application/octet-stream",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/json, */*",
      },
      body: Buffer.from(arrayBuffer),
    });

    const responseText = await response.text();
    let responseData: unknown = {};
    try {
      responseData = responseText ? JSON.parse(responseText) : {};
    } catch {
      responseData = { message: responseText };
    }

    if (!response.ok) {
      const errorMessage =
        typeof responseData === "object" &&
        responseData !== null &&
        "message" in responseData &&
        typeof (responseData as { message?: unknown }).message === "string"
          ? (responseData as { message: string }).message
          : `WordPress Media API Error: ${response.status}`;
      return NextResponse.json({ error: errorMessage }, { status: response.status });
    }

    return NextResponse.json(responseData);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
