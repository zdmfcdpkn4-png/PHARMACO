// Prépare les deux projets HyperFrames à partir de la source unique
// src/intro.html, qui porte les jetons {{W}}, {{H}} et {{FORMAT}} :
//   .rendu/paysage/  → 1920 × 1080 (écrans plus larges que hauts)
//   .rendu/portrait/ → 1080 × 1920 (téléphone en portrait)
// Un projet HyperFrames ne doit porter qu'une composition racine (sinon
// l'audio peut être joué deux fois) : chaque format a donc son dossier, avec
// une copie des ressources. La mise en page propre à chaque format est décidée
// dans la composition (fonction K(paysage, portrait)). `.rendu/` est ignoré
// par git.
import { cpSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Version de HyperFrames figée : un rendu doit rester reproductible. Elle est
// inscrite dans le package.json de chaque format (scripts dev, check, render).
const VERSION_HYPERFRAMES = '0.8.150';

const ici = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(ici, 'src/intro.html'), 'utf8');

const FORMATS = [
  { nom: 'paysage', W: 1920, H: 1080 },
  { nom: 'portrait', W: 1080, H: 1920 },
];

for (const f of FORMATS) {
  const dossier = join(ici, '.rendu', f.nom);
  mkdirSync(dossier, { recursive: true });
  const html = source
    .replaceAll('{{W}}', String(f.W))
    .replaceAll('{{H}}', String(f.H))
    .replaceAll('{{FORMAT}}', f.nom);
  writeFileSync(join(dossier, 'index.html'), html);
  cpSync(join(ici, 'assets'), join(dossier, 'assets'), { recursive: true });
  cpSync(join(ici, 'hyperframes.json'), join(dossier, 'hyperframes.json'));
  const id = `intro-${f.nom}`;
  writeFileSync(join(dossier, 'meta.json'), `${JSON.stringify({ id, name: id }, null, 2)}\n`);
  const hf = `npx --yes hyperframes@${VERSION_HYPERFRAMES}`;
  const paquet = {
    name: id,
    private: true,
    type: 'module',
    scripts: { dev: `${hf} preview`, check: `${hf} check`, render: `${hf} render` },
  };
  writeFileSync(join(dossier, 'package.json'), `${JSON.stringify(paquet, null, 2)}\n`);
  console.log(`${join('.rendu', f.nom)} : ${f.W} × ${f.H}`);
}
