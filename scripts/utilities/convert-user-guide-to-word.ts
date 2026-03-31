import { Document, Paragraph, TextRun, HeadingLevel, AlignmentType, Packer } from 'docx';
import * as fs from 'fs';

// Parse markdown and convert to Word document
function parseMarkdownToWord(markdown: string): any[] {
  const lines = markdown.split('\n');
  const children: any[] = [];
  let inCodeBlock = false;
  let inList = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Skip code blocks
    if (line.startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      continue;
    }
    if (inCodeBlock) continue;

    // Handle headings
    if (line.startsWith('# ') && !line.startsWith('## ')) {
      children.push(
        new Paragraph({
          text: line.replace('# ', ''),
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 400, after: 200 },
          pageBreakBefore: i > 0,
        })
      );
      inList = false;
    } else if (line.startsWith('## ')) {
      children.push(
        new Paragraph({
          text: line.replace('## ', ''),
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 300, after: 150 },
        })
      );
      inList = false;
    } else if (line.startsWith('### ')) {
      children.push(
        new Paragraph({
          text: line.replace('### ', ''),
          heading: HeadingLevel.HEADING_3,
          spacing: { before: 200, after: 100 },
        })
      );
      inList = false;
    } else if (line.startsWith('#### ')) {
      children.push(
        new Paragraph({
          text: line.replace('#### ', ''),
          heading: HeadingLevel.HEADING_4,
          spacing: { before: 150, after: 75 },
        })
      );
      inList = false;
    }
    // Handle horizontal rules
    else if (line.trim() === '---') {
      children.push(
        new Paragraph({
          text: '',
          spacing: { before: 200, after: 200 },
          border: {
            bottom: {
              color: '000000',
              space: 1,
              style: 'single',
              size: 6,
            },
          },
        })
      );
      inList = false;
    }
    // Handle bullet lists
    else if (line.match(/^- \*\*.*\*\*/)) {
      // Bold bullet point
      const match = line.match(/^- \*\*(.*?)\*\* ?-? ?(.*)/);
      if (match) {
        const textRuns = [
          new TextRun({ text: match[1], bold: true }),
        ];
        if (match[2]) {
          textRuns.push(new TextRun({ text: ' - ' + match[2] }));
        }
        children.push(
          new Paragraph({
            children: textRuns,
            bullet: { level: 0 },
            spacing: { after: 50 },
          })
        );
      }
      inList = true;
    } else if (line.startsWith('- ')) {
      children.push(
        new Paragraph({
          text: line.replace('- ', ''),
          bullet: { level: 0 },
          spacing: { after: 50 },
        })
      );
      inList = true;
    } else if (line.startsWith('  - ')) {
      children.push(
        new Paragraph({
          text: line.replace('  - ', ''),
          bullet: { level: 1 },
          spacing: { after: 50 },
        })
      );
      inList = true;
    } else if (line.startsWith('    - ')) {
      children.push(
        new Paragraph({
          text: line.replace('    - ', ''),
          bullet: { level: 2 },
          spacing: { after: 50 },
        })
      );
      inList = true;
    }
    // Handle numbered lists
    else if (line.match(/^\d+\. /)) {
      const text = line.replace(/^\d+\. /, '');

      // Check if it contains bold text
      if (text.includes('**')) {
        const parts = text.split('**');
        const textRuns: any[] = [];

        for (let j = 0; j < parts.length; j++) {
          if (j % 2 === 1) {
            textRuns.push(new TextRun({ text: parts[j], bold: true }));
          } else if (parts[j]) {
            textRuns.push(new TextRun({ text: parts[j] }));
          }
        }

        children.push(
          new Paragraph({
            children: textRuns,
            numbering: { reference: 'default-numbering', level: 0 },
            spacing: { after: 50 },
          })
        );
      } else {
        children.push(
          new Paragraph({
            text: text,
            numbering: { reference: 'default-numbering', level: 0 },
            spacing: { after: 50 },
          })
        );
      }
      inList = true;
    }
    // Handle regular text with formatting
    else if (line.trim()) {
      // Process inline formatting
      if (line.includes('**') || line.includes('`')) {
        const textRuns: any[] = [];
        let currentText = line;

        // Simple bold and code processing
        const parts = currentText.split(/(\*\*.*?\*\*|`.*?`)/g);

        for (const part of parts) {
          if (part.startsWith('**') && part.endsWith('**')) {
            textRuns.push(new TextRun({ text: part.slice(2, -2), bold: true }));
          } else if (part.startsWith('`') && part.endsWith('`')) {
            textRuns.push(new TextRun({ text: part.slice(1, -1), font: 'Courier New' }));
          } else if (part) {
            textRuns.push(new TextRun({ text: part }));
          }
        }

        children.push(
          new Paragraph({
            children: textRuns,
            spacing: { after: inList ? 50 : 100 },
          })
        );
      } else {
        children.push(
          new Paragraph({
            text: line,
            spacing: { after: inList ? 50 : 100 },
          })
        );
      }
    }
    // Handle empty lines
    else if (!inList) {
      children.push(
        new Paragraph({
          text: '',
          spacing: { after: 100 },
        })
      );
      inList = false;
    }
  }

  return children;
}

async function convertUserGuide() {
  console.log('Reading USER_GUIDE.md...');

  const markdown = fs.readFileSync('./USER_GUIDE.md', 'utf-8');

  console.log('Parsing markdown content...');
  const content = parseMarkdownToWord(markdown);

  console.log('Creating Word document...');
  const doc = new Document({
    numbering: {
      config: [
        {
          reference: 'default-numbering',
          levels: [
            {
              level: 0,
              format: 'decimal',
              text: '%1.',
              alignment: AlignmentType.START,
            },
            {
              level: 1,
              format: 'decimal',
              text: '%1.%2.',
              alignment: AlignmentType.START,
            },
          ],
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 1440,
              right: 1440,
              bottom: 1440,
              left: 1440,
            },
          },
        },
        children: [
          // Title page
          new Paragraph({
            text: 'InkOps User Guide',
            heading: HeadingLevel.TITLE,
            alignment: AlignmentType.CENTER,
            spacing: { before: 2000, after: 400 },
          }),
          new Paragraph({
            text: 'Complete User Documentation',
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
          }),
          new Paragraph({
            text: 'Version 2.0',
            alignment: AlignmentType.CENTER,
            spacing: { after: 100 },
          }),
          new Paragraph({
            text: 'Last Updated: March 2026',
            alignment: AlignmentType.CENTER,
            spacing: { after: 2000 },
          }),
          ...content,
        ],
      },
    ],
  });

  console.log('Generating Word file...');
  const buffer = await Packer.toBuffer(doc);

  // Create directory if it doesn't exist
  const dir = './documentation/word-docs';
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const outputPath = `${dir}/InkOps_User_Guide.docx`;
  fs.writeFileSync(outputPath, buffer);

  console.log(`✅ Created ${outputPath}`);

  // Get file size
  const stats = fs.statSync(outputPath);
  const fileSizeKB = (stats.size / 1024).toFixed(2);
  console.log(`📄 File size: ${fileSizeKB} KB`);

  return outputPath;
}

// Main execution
convertUserGuide().catch(console.error);
