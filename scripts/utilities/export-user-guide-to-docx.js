import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, BorderStyle } from 'docx';
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const projectRoot = join(__dirname, '../../');
const inputPath = join(projectRoot, 'USER_GUIDE.md');
const outputPath = join(projectRoot, 'InkOps_User_Guide.docx');

const markdownContent = readFileSync(inputPath, 'utf-8');

function parseMarkdownToDocx(markdown) {
  const lines = markdown.split('\n');
  const paragraphs = [];
  let inCodeBlock = false;
  let codeBlockContent = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith('```')) {
      if (inCodeBlock) {
        paragraphs.push(
          new Paragraph({
            children: [
              new TextRun({
                text: codeBlockContent.join('\n'),
                font: 'Courier New',
                size: 20,
              }),
            ],
            spacing: { before: 120, after: 120 },
            shading: { fill: 'F5F5F5' },
          })
        );
        codeBlockContent = [];
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockContent.push(line);
      continue;
    }

    if (line.startsWith('# ')) {
      paragraphs.push(
        new Paragraph({
          text: line.substring(2),
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 480, after: 240 },
          border: {
            bottom: {
              color: '2563EB',
              space: 1,
              style: BorderStyle.SINGLE,
              size: 6,
            },
          },
        })
      );
    } else if (line.startsWith('## ')) {
      paragraphs.push(
        new Paragraph({
          text: line.substring(3),
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 360, after: 180 },
        })
      );
    } else if (line.startsWith('### ')) {
      paragraphs.push(
        new Paragraph({
          text: line.substring(4),
          heading: HeadingLevel.HEADING_3,
          spacing: { before: 240, after: 120 },
        })
      );
    } else if (line.startsWith('#### ')) {
      paragraphs.push(
        new Paragraph({
          text: line.substring(5),
          heading: HeadingLevel.HEADING_4,
          spacing: { before: 180, after: 100 },
        })
      );
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      const content = line.substring(2);
      const children = parseInlineFormatting(content);
      paragraphs.push(
        new Paragraph({
          children,
          bullet: { level: 0 },
          spacing: { before: 60, after: 60 },
        })
      );
    } else if (line.match(/^\d+\.\s/)) {
      const content = line.replace(/^\d+\.\s/, '');
      const children = parseInlineFormatting(content);
      paragraphs.push(
        new Paragraph({
          children,
          numbering: { reference: 'default-numbering', level: 0 },
          spacing: { before: 60, after: 60 },
        })
      );
    } else if (line.startsWith('> ')) {
      paragraphs.push(
        new Paragraph({
          text: line.substring(2),
          italics: true,
          spacing: { before: 120, after: 120, left: 720 },
          shading: { fill: 'F9FAFB' },
        })
      );
    } else if (line.trim() === '') {
      paragraphs.push(new Paragraph({ text: '' }));
    } else {
      const children = parseInlineFormatting(line);
      paragraphs.push(
        new Paragraph({
          children,
          spacing: { before: 60, after: 60 },
        })
      );
    }
  }

  return paragraphs;
}

function parseInlineFormatting(text) {
  const children = [];
  let currentIndex = 0;
  const patterns = [
    { regex: /\*\*\*(.+?)\*\*\*/g, bold: true, italics: true },
    { regex: /\*\*(.+?)\*\*/g, bold: true },
    { regex: /\*(.+?)\*/g, italics: true },
    { regex: /`(.+?)`/g, code: true },
    { regex: /\[(.+?)\]\((.+?)\)/g, link: true },
  ];

  let parts = [{ text, start: 0, end: text.length }];

  for (const pattern of patterns) {
    const newParts = [];
    for (const part of parts) {
      if (part.bold || part.italics || part.code || part.link) {
        newParts.push(part);
        continue;
      }

      let lastIndex = 0;
      const matches = [...part.text.matchAll(pattern.regex)];

      if (matches.length === 0) {
        newParts.push(part);
        continue;
      }

      for (const match of matches) {
        if (match.index > lastIndex) {
          newParts.push({
            text: part.text.substring(lastIndex, match.index),
          });
        }

        if (pattern.link) {
          newParts.push({
            text: match[1],
            link: match[2],
          });
        } else {
          newParts.push({
            text: match[1],
            bold: pattern.bold,
            italics: pattern.italics,
            code: pattern.code,
          });
        }

        lastIndex = match.index + match[0].length;
      }

      if (lastIndex < part.text.length) {
        newParts.push({
          text: part.text.substring(lastIndex),
        });
      }
    }
    parts = newParts;
  }

  for (const part of parts) {
    const runOptions = {
      text: part.text,
    };

    if (part.bold) runOptions.bold = true;
    if (part.italics) runOptions.italics = true;
    if (part.code) {
      runOptions.font = 'Courier New';
      runOptions.shading = { fill: 'F5F5F5' };
    }

    children.push(new TextRun(runOptions));
  }

  return children;
}

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
            alignment: AlignmentType.LEFT,
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
      children: parseMarkdownToDocx(markdownContent),
    },
  ],
});

Packer.toBuffer(doc).then((buffer) => {
  writeFileSync(outputPath, buffer);
  console.log(`✅ Word document created: ${outputPath}`);
  console.log('\nYou can now download: InkOps_User_Guide.docx');
});
