import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const getSecret = () => new TextEncoder().encode(process.env.JWT_SECRET!);

export async function middleware(request: NextRequest) {
  const token = request.cookies.get('sso_token')?.value;

  if (!token) {
    const redirectUrl = request.nextUrl.href;
    return NextResponse.redirect(
      `https://sso.hnsitcenter.id/login?redirectUrl=${encodeURIComponent(redirectUrl)}`
    );
  }

  try {
    const { payload } = await jwtVerify(token, getSecret());

    // Inject user data into request headers
    const headers = new Headers(request.headers);
    headers.set('x-user-id', payload.id as string);
    headers.set('x-user-email', payload.email as string);
    headers.set('x-user-role', payload.globalRole as string);
    headers.set('x-user-dept', payload.departmentId as string ?? '');

    return NextResponse.next({ request: { headers } });
  } catch {
    const response = NextResponse.redirect(
      `https://sso.hnsitcenter.id/login?error=session_expired`
    );
    response.cookies.delete('sso_token');
    return response;
  }
}

export const config = {
  matcher: ['/dashboard/:path*', '/api/protected/:path*'],
};
