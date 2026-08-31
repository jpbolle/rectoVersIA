#!/bin/bash
# Construit le paquet à envoyer au Chrome Web Store.
#
#   ./build-zip.sh
#
# Deux choses que la construction à la main oubliait :
#
#  1. Le champ `key` du manifeste est RETIRÉ du paquet. Il n'existe que pour le
#     développement local : il fige l'identifiant de l'extension chargée « non
#     empaquetée », pour que les deux Macs partagent la même URI de redirection
#     OAuth. Le Store, lui, tient déjà cette clé — la lui renvoyer n'apporte rien.
#
#  2. `assets/icon-source.png` (le 1024×1024 dont dérivent les trois icônes) et
#     les `.DS_Store` sont exclus.
#
# Le manifeste du dossier de travail n'est jamais modifié : la copie se fait
# dans un dossier temporaire, détruit à la sortie.

set -euo pipefail

cd "$(dirname "$0")"
SOURCE="eleve-extension"
SORTIE="navigkid-extension.zip"

[ -d "$SOURCE" ] || { echo "Dossier $SOURCE introuvable"; exit 1; }

TEMP="$(mktemp -d)"
trap 'rm -rf "$TEMP"' EXIT

cp -R "$SOURCE/" "$TEMP/paquet"

python3 - "$TEMP/paquet/manifest.json" <<'PY'
import json, sys, collections
chemin = sys.argv[1]
m = json.load(open(chemin, encoding="utf-8"), object_pairs_hook=collections.OrderedDict)
retire = m.pop("key", None)
json.dump(m, open(chemin, "w", encoding="utf-8"), indent=2, ensure_ascii=False)
open(chemin, "a", encoding="utf-8").write("\n")
print("  version  :", m.get("version"))
print("  champ key:", "retiré du paquet" if retire else "absent (rien à retirer)")
PY

rm -f "$SORTIE"
( cd "$TEMP/paquet" && zip -r -X "$OLDPWD/$SORTIE" . \
    -x ".DS_Store" -x "**/.DS_Store" -x "__MACOSX/*" \
    -x "assets/icon-source.png" > /dev/null )

echo "  fichiers :  $(unzip -l "$SORTIE" | tail -1 | awk '{print $2}')"
echo "  poids    :  $(ls -lah "$SORTIE" | awk '{print $5}')"
echo
echo "Paquet prêt : $(pwd)/$SORTIE"
