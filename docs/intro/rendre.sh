#!/usr/bin/env bash
# Régénère les deux vidéos de l'intro et les dépose dans client/public/intro/.
# Prérequis : Node 18+, FFmpeg, et un Chromium (variable
# HYPERFRAMES_BROWSER_PATH si celui que HyperFrames télécharge ne convient pas).
# Compter environ deux minutes par format sur quatre cœurs.
set -euo pipefail

ici="$(cd "$(dirname "$0")" && pwd)"
cible="$ici/../../client/public/intro"

node "$ici/build.mjs"
mkdir -p "$cible"
for f in paysage portrait; do
  # Le script « render » porte la version de HyperFrames figée par build.mjs.
  (cd "$ici/.rendu/$f" && npm run --silent render -- -q looks -w 4 -o maitre.mp4)
  # Encodage web : H.264 + AAC lisibles partout, lecture dès les premiers
  # octets (faststart). CRF 28 : environ 5 Mo pour 42 s, sans perte visible
  # sur ces aplats.
  ffmpeg -v error -y -i "$ici/.rendu/$f/maitre.mp4" \
    -c:v libx264 -preset slow -tune animation -crf 28 -pix_fmt yuv420p \
    -profile:v high -level 4.1 -c:a aac -b:a 128k -movflags +faststart \
    "$cible/intro-$f.mp4"
  echo "→ client/public/intro/intro-$f.mp4"
done
