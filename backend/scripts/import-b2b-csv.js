import fs from 'node:fs/promises';
import path from 'node:path';
import { b2bDirectoryService } from '../src/services/b2bDirectoryService.js';

async function main() {
  const targetArg = process.argv[2] || '../sample-data/contacts-b2b-exemple.csv';
  const resolvedPath = path.resolve(process.cwd(), targetArg);

  console.info(`Lecture du fichier CSV : ${resolvedPath}`);
  const csvContent = await fs.readFile(resolvedPath, 'utf8');

  const report = await b2bDirectoryService.importFromCsvString(csvContent, {
    sourceBatch: path.basename(resolvedPath),
  });

  console.info('\n=== RAPPORT DE CONTRÔLE QUALITÉ ANNUAIRE B2B ===');
  console.table(report.stats);

  if (report.rejectedSamples.length > 0) {
    console.info('\nDétail des lignes rejetées :');
    console.table(report.rejectedSamples);
  }

  if (report.insertedPreview.length > 0) {
    console.info('\nAperçu des contacts professionnels génériques retenus :');
    console.table(
      report.insertedPreview.map((r) => ({
        company_name: r.company_name,
        email: r.email,
        role_prefix: r.role_prefix,
        country: r.country,
        mx_verified: r.mx_verified,
      }))
    );
  }
}

main().catch((err) => {
  console.error('Erreur lors de l’import CSV B2B :', err.message);
  process.exit(1);
});
