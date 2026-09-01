import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

/**
 * Session gate.
 *
 * Sebelumnya file ini langsung `return NextResponse.next()` dengan catatan
 * "SSO temporarily disabled", sehingga /dashboard dan API di bawah matcher
 * terbuka tanpa sesi sama sekali. Jalur SSO lama tidak bisa dihidupkan lagi:
 * `sso.hnsitcenter.id` belum aktif dan JWT_SECRET masih placeholder.
 *
 * Penggantinya memverifikasi sesi Supabase — sumber sesi yang benar-benar
 * dipakai aplikasi ini hari ini.
 *
 * Verifikasi lewat `getUser()`, bukan `getSession()`: getSession hanya membaca
 * cookie apa adanya, jadi cookie palsu ikut lolos. getUser memvalidasikan token
 * ke server Supabase, sehingga hanya sesi asli yang diterima.
 *
 * Middleware ini menutup jalur route Next.js. Dua jalur lain sudah ditutup
 * terpisah: RLS diaktifkan di seluruh tabel (anon tidak bisa membaca lewat
 * REST API Supabase), dan API key lama yang bocor sudah dicabut.
 */

/** Route yang boleh diakses tanpa sesi (punya mekanisme auth sendiri). */
const PUBLIC_API_PREFIXES = [
  '/api/auth',          // login, logout, me, set-password
  '/api/sheet/webhook', // dijaga header x-webhook-secret dari Google Apps Script
];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_API_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p + '/'),
  );
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublicPath(pathname)) return NextResponse.next();

  // Response dibuat lebih dulu supaya Supabase bisa menuliskan cookie hasil
  // refresh token ke dalamnya.
  let response = NextResponse.next({ request: { headers: request.headers } });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Tanpa konfigurasi, tolak — jangan diam-diam membuka pintu seperti kode lama.
  if (!url || !anonKey) {
    console.error('[middleware] NEXT_PUBLIC_SUPABASE_URL/ANON_KEY tidak diset');
    return denyResponse(request, pathname, 'config');
  }

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        response = NextResponse.next({ request: { headers: request.headers } });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return denyResponse(request, pathname, 'no_session');

  // Sesi valid belum tentu akun aktif: 2 akun berstatus "rejected" di profiles.
  const { data: profile } = await supabase
    .from('profiles')
    .select('status')
    .eq('id', user.id)
    .single();

  if (profile?.status !== 'active') {
    return denyResponse(request, pathname, 'inactive');
  }

  // Diteruskan ke route handler supaya tidak perlu query ulang.
  response.headers.set('x-user-id', user.id);
  response.headers.set('x-user-email', user.email ?? '');

  return response;
}

/** API dapat 401 JSON; halaman dialihkan ke /login. */
function denyResponse(request: NextRequest, pathname: string, reason: string) {
  if (pathname.startsWith('/api/')) {
    return NextResponse.json(
      { error: 'Unauthorized', reason },
      { status: 401 },
    );
  }
  const loginUrl = new URL('/login', request.url);
  loginUrl.searchParams.set('redirect', pathname);
  if (reason === 'inactive') loginUrl.searchParams.set('error', 'inactive');
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    // Route data sensitif yang sebelumnya sama sekali tidak dijaga.
    // ('/api/protected' yang lama dihapus — foldernya tidak pernah ada.)
    '/api/sync/:path*',
    '/api/admin/:path*',
    '/api/woo/:path*',
    '/api/media/:path*',
    '/api/gdrive/:path*',
    '/api/sheet/:path*',
  ],
};
