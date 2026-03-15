import { NextResponse } from 'next/server';

// Auth is handled client-side via Firebase Auth tokens.
// No server-side session cookie check needed.
export function middleware() {
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:jpg|jpeg|png|gif|svg|webp|ico)).*)'],
};
