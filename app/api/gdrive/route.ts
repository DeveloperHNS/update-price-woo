import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";

export async function POST(req: NextRequest) {
  try {
    const { rows, filename } = (await req.json()) as {
      rows: Record<string, string>[];
      filename?: string;
    };

    if (!rows || rows.length === 0) {
      return NextResponse.json({ error: "Tidak ada data untuk diekspor." }, { status: 400 });
    }

    // ── Check required env vars ──────────────────────────────────────────────
    const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

    if (!serviceAccountJson || !folderId) {
      return NextResponse.json(
        {
          error:
            "GOOGLE_SERVICE_ACCOUNT_JSON atau GOOGLE_DRIVE_FOLDER_ID belum dikonfigurasi di .env.local",
        },
        { status: 503 }
      );
    }

    // ── Auth with Service Account ────────────────────────────────────────────
    const credentials = JSON.parse(serviceAccountJson);
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/drive.file"],
    });

    const drive = google.drive({ version: "v3", auth });

    // ── Build CSV ────────────────────────────────────────────────────────────
    const headers = Object.keys(rows[0]);
    const escape = (v: string) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const csvLines = [
      headers.map(escape).join(","),
      ...rows.map(row => headers.map(h => escape(row[h])).join(",")),
    ];
    const csvContent = csvLines.join("\n");

    // ── Upload to Google Drive ───────────────────────────────────────────────
    const exportFilename =
      filename || `activity_logs_${new Date().toISOString().slice(0, 10)}.csv`;

    const { data } = await drive.files.create({
      requestBody: {
        name: exportFilename,
        mimeType: "text/csv",
        parents: [folderId],
      },
      media: {
        mimeType: "text/csv",
        body: csvContent,
      },
      fields: "id, name, webViewLink",
    });

    return NextResponse.json({
      success: true,
      fileId: data.id,
      fileName: data.name,
      viewLink: data.webViewLink,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
