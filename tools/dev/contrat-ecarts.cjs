// Écarts entre le contrat figé du panneau v1 et l'OpenAPI engendré par le Go.
// Usage : make gen puis node tools/dev/contrat-ecarts.cjs [schemas|routes]

const path = require('node:path');

const racine = path.join(__dirname, '..', '..');
const go = require(path.join(racine, 'openapi.json'));
const v1 = require(path.join(racine, 'web', 'contrat-v1.openapi.json'));

function nomDuSchema(operation) {
  const reponses = operation.responses || {};
  const reponse = reponses['200'] || reponses['201'] || {};
  const json = (reponse.content || {})['application/json'];
  if (!json || !json.schema) return '(corps anonyme)';
  const schema = json.schema;
  const ref = schema.$ref || (schema.allOf && schema.allOf[0] && schema.allOf[0].$ref);
  return ref ? ref.split('/').pop() : '(corps anonyme)';
}

function operations(contrat) {
  const table = {};
  for (const [chemin, item] of Object.entries(contrat.paths)) {
    for (const [methode, operation] of Object.entries(item)) {
      if (operation && typeof operation === 'object' && operation.responses) {
        table[`${methode.toUpperCase()} ${chemin}`] = operation;
      }
    }
  }
  return table;
}

const routesGo = operations(go);
const routesV1 = operations(v1);

function schemasDivergents() {
  const paires = new Map();
  for (const [route, operation] of Object.entries(routesV1)) {
    if (!routesGo[route]) continue;
    const ancien = nomDuSchema(operation);
    const nouveau = nomDuSchema(routesGo[route]);
    if (ancien === '(corps anonyme)' || ancien === nouveau) continue;
    if (!paires.has(ancien)) paires.set(ancien, new Set());
    paires.get(ancien).add(nouveau);
  }
  return [...paires].map(([ancien, nouveaux]) => [ancien, [...nouveaux]]);
}

const sansEquivalent = Object.keys(routesV1).filter((route) => !routesGo[route]);

const quoi = process.argv[2] || 'tout';

if (quoi === 'tout' || quoi === 'schemas') {
  const lignes = schemasDivergents();
  console.log(`# ${lignes.length} schémas du contrat figé portent un autre nom côté Go`);
  for (const [ancien, nouveaux] of lignes) {
    const marque = nouveaux.length > 1 ? '  (PLUSIEURS : voir route par route)' : '';
    console.log(`${ancien} -> ${nouveaux.join(' | ')}${marque}`);
  }
}

if (quoi === 'tout' || quoi === 'routes') {
  console.log(
    `\n# ${sansEquivalent.length} routes du contrat figé sans route de même forme côté Go`,
  );
  console.log('# Une route absente ICI peut rester VIVANTE : le Go déclare /referentiels/{kind}');
  console.log('# là où le contrat figé écrit /referentiels/banques. Sonder avant de supprimer.');
  for (const route of sansEquivalent) console.log(route);
}
