import { Packer } from 'docx';
import * as fs from 'fs';
import { generateDocumentation } from './scripts/utilities/generate-api-documentation';

async function main() {
  console.log('Generating API documentation...');

  const doc = await generateDocumentation();

  const buffer = await Packer.toBuffer(doc);

  const outputPath = './InkOps_API_Documentation_v1.docx';
  fs.writeFileSync(outputPath, buffer);

  console.log(`✅ Documentation generated successfully: ${outputPath}`);
  console.log(`File size: ${(buffer.length / 1024).toFixed(2)} KB`);
}

main().catch(console.error);
