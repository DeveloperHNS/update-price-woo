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
    const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
    const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
    const sheetId = "1jtaY6UdSeYNZYe1YM8sM6FQhHQD4sg22JjZtv1sE2H4"; // Hardcoded from user

    if (!clientEmail || !privateKey) {
      return NextResponse.json(
        { error: "Kredensial Google (EMAIL/PRIVATE_KEY) belum lengkap di .env.local" },
        { status: 503 }
      );
    }

    // ── Auth with Service Account ────────────────────────────────────────────
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: clientEmail,
        private_key: privateKey,
      },
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    const sheets = google.sheets({ version: "v4", auth });

    // ── Build Values 2D Array ────────────────────────────────────────────────
    // Reverse rows so chronological order is maintained (oldest first if logs were descending)
    // Wait, the client sends them from newest to oldest. Let's keep the order the client sent.
    const values = rows.map(row => [
      row.Waktu,
      row.User,
      row.Aksi,
      row.Produk,
      row.ProductID,
      row.Field,
      row.NilaiLama,
      row.NilaiBaru
    ]);

    // ── Append to Google Sheets ───────────────────────────────────────────────
    const response = await sheets.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range: "A1", // Appends to the end of the sheet automatically
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values,
      },
    });

    return NextResponse.json({
      success: true,
      updatedCells: response.data.updates?.updatedCells,
      fileName: "Google Sheets",
      viewLink: `https://docs.google.com/spreadsheets/d/${sheetId}/edit`,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
