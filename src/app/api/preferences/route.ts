import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { verifyAuth } from '@/lib/api-auth';
import { DEFAULT_PREFERENCES } from '@/types/preferences';
import type { EditorPreferences } from '@/types/preferences';

export async function GET(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) {
    return NextResponse.json({ error: 'Non autorise' }, { status: 401 });
  }

  try {
    const docRef = adminDb.collection('users').doc(auth.uid);
    const docSnap = await docRef.get();

    if (!docSnap.exists || !docSnap.data()?.preferences) {
      return NextResponse.json({ success: true, data: DEFAULT_PREFERENCES, preferencesSet: false });
    }

    const docData = docSnap.data()!;
    const prefs = docData.preferences;
    const preferencesSet = docData.preferencesSet === true;
    return NextResponse.json({
      success: true,
      preferencesSet,
      data: {
        font: typeof prefs.font === 'string' ? prefs.font : DEFAULT_PREFERENCES.font,
        fontSize: typeof prefs.fontSize === 'string' ? prefs.fontSize : DEFAULT_PREFERENCES.fontSize,
        lineHeight: typeof prefs.lineHeight === 'number' ? prefs.lineHeight : DEFAULT_PREFERENCES.lineHeight,
        theme: typeof prefs.theme === 'string' ? prefs.theme : DEFAULT_PREFERENCES.theme,
      },
    });
  } catch (error) {
    console.error('Erreur GET /api/preferences:', error);
    return NextResponse.json(
      { success: false, message: 'Erreur serveur' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) {
    return NextResponse.json({ error: 'Non autorise' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const prefs: EditorPreferences = {
      font: typeof body.font === 'string' ? body.font : DEFAULT_PREFERENCES.font,
      fontSize: typeof body.fontSize === 'string' ? body.fontSize : DEFAULT_PREFERENCES.fontSize,
      lineHeight: typeof body.lineHeight === 'number' ? body.lineHeight : DEFAULT_PREFERENCES.lineHeight,
      theme: typeof body.theme === 'string' ? body.theme : DEFAULT_PREFERENCES.theme,
    };

    await adminDb.collection('users').doc(auth.uid).set(
      { preferences: prefs, preferencesSet: true },
      { merge: true }
    );

    return NextResponse.json({ success: true, data: prefs, preferencesSet: true });
  } catch (error) {
    console.error('Erreur PUT /api/preferences:', error);
    return NextResponse.json(
      { success: false, message: 'Erreur serveur' },
      { status: 500 }
    );
  }
}
