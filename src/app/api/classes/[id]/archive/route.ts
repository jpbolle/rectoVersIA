import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { verifyAuth } from '@/lib/api-auth';
import { decrypt } from '@/lib/crypto';
import { buildZip, type ZipEntry } from '@/lib/zip';
import { LEVEL_PERCENTAGES, LEVEL_LABELS } from '@/types/grille';

// GET — archive ZIP d'une classe avant suppression : pour chaque activité de
// la classe, les travaux des élèves (HTML nommé, avec l'évaluation) + un CSV
// des points par critère de la grille, + un CSV récapitulatif global.
// Tout est déchiffré côté serveur ; l'archive part chez le prof uniquement.

interface RouteParams {
  params: Promise<{ id: string }>;
}

// Nom de fichier sûr (accents conservés, caractères interdits retirés)
function safeName(name: string): string {
  return (name || 'sans-nom')
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
}

function csvCell(value: string | number): string {
  const s = String(value);
  return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const auth = await verifyAuth(request);
  if (!auth) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }
  if (auth.role !== 'prof') {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
  }

  try {
    const { id } = await params;
    const classeDoc = await adminDb.collection('classes').doc(id).get();
    if (!classeDoc.exists) {
      return NextResponse.json({ success: false, message: 'Classe non trouvée' }, { status: 404 });
    }
    const classe = classeDoc.data()!;
    if (classe.profId !== auth.uid) {
      return NextResponse.json({ success: false, message: 'Non autorisé' }, { status: 403 });
    }
    const classeNom: string = classe.nom || id;

    // Devoirs du prof ciblant cette classe (filtre en code, pas d'index composite)
    const devoirsSnap = await adminDb
      .collection('devoirs')
      .where('profId', '==', auth.uid)
      .get();
    const devoirs = devoirsSnap.docs
      .map((d) => ({ id: d.id, ...d.data() } as { id: string; intitule?: string; grille?: string; typeTravail?: string; classes?: string[]; dateRemise?: { toDate?: () => Date } | string }))
      .filter((d) => Array.isArray(d.classes) && d.classes.includes(classeNom));

    const entries: ZipEntry[] = [];
    const recapRows: string[] = ['Élève;Activité;Total (%)'];

    for (const devoir of devoirs) {
      const devoirDir = safeName(devoir.intitule || devoir.id);

      // Grille (par id, repli sur le nom)
      let grilleCriteria: { id: string; name: string; weight: number }[] = [];
      if (devoir.grille) {
        let gDoc = await adminDb.collection('grilles').doc(devoir.grille).get();
        if (!gDoc.exists) {
          const byName = await adminDb
            .collection('grilles').where('name', '==', devoir.grille).limit(1).get();
          if (!byName.empty) gDoc = byName.docs[0];
        }
        if (gDoc.exists) {
          grilleCriteria = ((gDoc.data()!.criteria || []) as { id: string; name: string; weight: number; order?: number }[])
            .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
            .map((c) => ({ id: c.id, name: c.name, weight: c.weight }));
        }
      }

      // Travaux de ce devoir + leurs corrections
      const travauxSnap = await adminDb
        .collection('travaux').where('devoirId', '==', devoir.id).get();

      const csvRows: string[] = [
        ['Élève', ...grilleCriteria.map((c) => `${c.name} (%)`), 'Total (%)', 'Statut'].join(';'),
      ];

      for (const tDoc of travauxSnap.docs) {
        const t = tDoc.data();
        const eleveNom = decrypt(t.studentName) || 'Élève inconnu';
        const corrDoc = await adminDb.collection('corrections').doc(`CORR-${tDoc.id}`).get();
        const corr = corrDoc.exists ? corrDoc.data()! : null;
        const evaluation: Record<string, number> = corr?.evaluation || {};

        const statut = t.nonRendu === 'nonJustifie'
          ? 'Non fait — 0'
          : t.nonRendu === 'justifie'
            ? 'Non rendu justifié'
            : t.status === 'submitted' ? 'Remis' : 'Brouillon';
        const total = t.nonRendu === 'nonJustifie'
          ? 0
          : corr?.score !== undefined && corr.score > 0 ? corr.score : '';

        csvRows.push([
          csvCell(eleveNom),
          ...grilleCriteria.map((c) =>
            evaluation[c.id] !== undefined
              ? String(LEVEL_PERCENTAGES[evaluation[c.id] as keyof typeof LEVEL_PERCENTAGES] ?? '')
              : ''
          ),
          String(total),
          statut,
        ].join(';'));

        recapRows.push([csvCell(eleveNom), csvCell(devoir.intitule || devoir.id), String(total)].join(';'));

        // Production de l'élève en HTML (type écrire : le contenu est du HTML Tiptap)
        if ((devoir.typeTravail || 'ecrire') === 'ecrire' && t.content) {
          const evalRows = grilleCriteria
            .filter((c) => evaluation[c.id] !== undefined)
            .map((c) => {
              const level = evaluation[c.id];
              const pct = LEVEL_PERCENTAGES[level as keyof typeof LEVEL_PERCENTAGES] ?? 0;
              return `<tr><td>${escapeHtml(c.name)}</td><td>${escapeHtml(LEVEL_LABELS[level] || String(level))}</td><td>${pct}%</td></tr>`;
            })
            .join('');
          const html = `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8">
<title>${escapeHtml(eleveNom)} — ${escapeHtml(devoir.intitule || '')}</title>
<style>
body{font-family:Georgia,serif;max-width:800px;margin:40px auto;padding:0 20px;color:#3d3832}
header{border-bottom:2px solid #2d6a5a;margin-bottom:24px;padding-bottom:12px}
h1{font-size:22px;color:#2d6a5a;margin:0 0 4px}
.meta{font-size:14px;color:#777}
table{border-collapse:collapse;margin:16px 0;font-size:14px}
td,th{border:1px solid #ccc;padding:6px 10px;text-align:left}
.comment{background:#faf6f0;border-left:3px solid #d4944c;padding:10px 14px;margin:16px 0}
</style></head><body>
<header><h1>${escapeHtml(devoir.intitule || '')}</h1>
<div class="meta">Élève : ${escapeHtml(eleveNom)} · Classe : ${escapeHtml(classeNom)} · Statut : ${escapeHtml(statut)}${total !== '' ? ` · Total : ${total}%` : ''}</div></header>
${evalRows ? `<h2>Évaluation</h2><table><tr><th>Critère</th><th>Niveau</th><th>%</th></tr>${evalRows}</table>` : ''}
${corr?.commentaireGeneral ? `<div class="comment"><strong>Commentaire du professeur :</strong><br>${escapeHtml(corr.commentaireGeneral)}</div>` : ''}
<h2>Production de l'élève</h2>
${t.content}
</body></html>`;
          entries.push({ path: `${devoirDir}/${safeName(eleveNom)}.html`, content: html });
        }
      }

      // CSV de l'activité (BOM pour Excel)
      entries.push({ path: `${devoirDir}/notes.csv`, content: '﻿' + csvRows.join('\n') });
    }

    entries.push({ path: 'recapitulatif.csv', content: '﻿' + recapRows.join('\n') });

    const zip = buildZip(entries);
    return new NextResponse(new Uint8Array(zip), {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="archive-${safeName(classeNom)}.zip"`,
      },
    });
  } catch (error) {
    console.error('Erreur GET /api/classes/[id]/archive:', error);
    return NextResponse.json({ success: false, message: 'Erreur serveur' }, { status: 500 });
  }
}
