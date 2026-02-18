import { NextRequest, NextResponse } from 'next/server';

const PUBLIC_PATHS = ['/login'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionCookie = request.cookies.get('__session')?.value;

  // API routes gerent leur propre auth
  if (pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  // Pages publiques : autoriser l'acces, rediriger si deja connecte
  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
    if (sessionCookie) {
      return NextResponse.redirect(new URL('/', request.url));
    }
    return NextResponse.next();
  }

  // Pages protegees : exiger un cookie de session
  if (!sessionCookie) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|logo-cnd.png|.*\\.(?:jpg|jpeg|png|gif|svg|webp|ico)).*)'],
};
