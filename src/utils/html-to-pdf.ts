import jsPDF from 'jspdf';

interface RenderOptions {
  fontSize: number;
  lineHeight: number;
  maxWidth: number;
  startY: number;
  marginLeft: number;
  pageHeight: number;
  marginBottom: number;
  textColor: [number, number, number];
  boldColor?: [number, number, number];
}

interface RenderResult {
  finalY: number;
  pageBreakOccurred: boolean;
}

interface TextSegment {
  text: string;
  bold: boolean;
  italic: boolean;
  underline: boolean;
}

interface ListItem {
  segments: TextSegment[];
  isOrdered: boolean;
  index?: number;
}

interface ParsedBlock {
  type: 'paragraph' | 'list';
  segments?: TextSegment[];
  items?: ListItem[];
  isOrdered?: boolean;
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
}

function parseHtmlToBlocks(html: string): ParsedBlock[] {
  const blocks: ParsedBlock[] = [];

  if (!html || html.trim() === '' || html === '<p><br></p>') {
    return blocks;
  }

  const cleanHtml = html.replace(/\r?\n/g, ' ').replace(/\s+/g, ' ');

  const listMatch = cleanHtml.match(/<(ul|ol)>([\s\S]*?)<\/\1>/gi);
  const paragraphSplit = cleanHtml.split(/<\/?(?:ul|ol)[^>]*>/gi);

  let listIndex = 0;

  paragraphSplit.forEach((section, sectionIndex) => {
    if (section.trim()) {
      const paragraphs = section.split(/<\/?p[^>]*>/gi).filter(p => p.trim());

      paragraphs.forEach(p => {
        const stripped = stripHtml(p);
        if (stripped) {
          const segments = parseInlineStyles(p);
          if (segments.length > 0) {
            blocks.push({ type: 'paragraph', segments });
          }
        }
      });
    }

    if (listMatch && listIndex < listMatch.length && sectionIndex < paragraphSplit.length - 1) {
      const listHtml = listMatch[listIndex];
      const isOrdered = listHtml.toLowerCase().startsWith('<ol');
      const items = listHtml.match(/<li[^>]*>([\s\S]*?)<\/li>/gi) || [];

      const listItems: ListItem[] = items.map((item, idx) => {
        const content = item.replace(/<\/?li[^>]*>/gi, '');
        return {
          segments: parseInlineStyles(content),
          isOrdered,
          index: idx + 1
        };
      });

      if (listItems.length > 0) {
        blocks.push({ type: 'list', items: listItems, isOrdered });
      }

      listIndex++;
    }
  });

  return blocks;
}

function parseInlineStyles(html: string): TextSegment[] {
  const segments: TextSegment[] = [];

  const parts = html.split(/(<(?:strong|b|em|i|u)[^>]*>[\s\S]*?<\/(?:strong|b|em|i|u)>)/gi);

  parts.forEach(part => {
    if (!part.trim()) return;

    const boldMatch = part.match(/<(?:strong|b)[^>]*>([\s\S]*?)<\/(?:strong|b)>/i);
    const italicMatch = part.match(/<(?:em|i)[^>]*>([\s\S]*?)<\/(?:em|i)>/i);
    const underlineMatch = part.match(/<u[^>]*>([\s\S]*?)<\/u>/i);

    if (boldMatch) {
      const text = stripHtml(boldMatch[1]);
      if (text) {
        segments.push({ text, bold: true, italic: false, underline: false });
      }
    } else if (italicMatch) {
      const text = stripHtml(italicMatch[1]);
      if (text) {
        segments.push({ text, bold: false, italic: true, underline: false });
      }
    } else if (underlineMatch) {
      const text = stripHtml(underlineMatch[1]);
      if (text) {
        segments.push({ text, bold: false, italic: false, underline: true });
      }
    } else {
      const text = stripHtml(part);
      if (text) {
        segments.push({ text, bold: false, italic: false, underline: false });
      }
    }
  });

  return segments;
}

export function renderHtmlToPdf(
  doc: jsPDF,
  html: string,
  options: RenderOptions
): RenderResult {
  const {
    fontSize,
    lineHeight,
    maxWidth,
    startY,
    marginLeft,
    pageHeight,
    marginBottom,
    textColor,
    boldColor = textColor
  } = options;

  let yPosition = startY;
  let pageBreakOccurred = false;

  const blocks = parseHtmlToBlocks(html);

  if (blocks.length === 0) {
    return { finalY: yPosition, pageBreakOccurred };
  }

  doc.setFontSize(fontSize);

  blocks.forEach((block, blockIndex) => {
    if (yPosition + lineHeight > pageHeight - marginBottom) {
      doc.addPage();
      yPosition = 15;
      pageBreakOccurred = true;
    }

    if (block.type === 'paragraph' && block.segments) {
      let xPosition = marginLeft;
      let currentLineY = yPosition;

      block.segments.forEach(segment => {
        if (segment.bold) {
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(...boldColor);
        } else if (segment.italic) {
          doc.setFont('helvetica', 'italic');
          doc.setTextColor(...textColor);
        } else {
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(...textColor);
        }

        const words = segment.text.split(' ');
        words.forEach((word, wordIndex) => {
          const wordWithSpace = wordIndex < words.length - 1 ? word + ' ' : word;
          const wordWidth = doc.getTextWidth(wordWithSpace);

          if (xPosition + wordWidth > marginLeft + maxWidth && xPosition > marginLeft) {
            xPosition = marginLeft;
            currentLineY += lineHeight;

            if (currentLineY + lineHeight > pageHeight - marginBottom) {
              doc.addPage();
              currentLineY = 15;
              pageBreakOccurred = true;
            }
          }

          doc.text(wordWithSpace, xPosition, currentLineY);

          if (segment.underline) {
            const textWidth = doc.getTextWidth(word);
            doc.setDrawColor(...textColor);
            doc.setLineWidth(0.2);
            doc.line(xPosition, currentLineY + 0.5, xPosition + textWidth, currentLineY + 0.5);
          }

          xPosition += wordWidth;
        });
      });

      yPosition = currentLineY + lineHeight * 0.8;
    }

    if (block.type === 'list' && block.items) {
      const bulletIndent = 4;
      const textIndent = bulletIndent + 3;

      block.items.forEach((item, itemIndex) => {
        if (yPosition + lineHeight > pageHeight - marginBottom) {
          doc.addPage();
          yPosition = 15;
          pageBreakOccurred = true;
        }

        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...textColor);

        const bullet = block.isOrdered ? `${itemIndex + 1}.` : '\u2022';
        doc.text(bullet, marginLeft + bulletIndent, yPosition);

        let xPosition = marginLeft + textIndent;
        let currentLineY = yPosition;

        item.segments.forEach(segment => {
          if (segment.bold) {
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(...boldColor);
          } else if (segment.italic) {
            doc.setFont('helvetica', 'italic');
            doc.setTextColor(...textColor);
          } else {
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(...textColor);
          }

          const words = segment.text.split(' ');
          words.forEach((word, wordIndex) => {
            const wordWithSpace = wordIndex < words.length - 1 ? word + ' ' : word;
            const wordWidth = doc.getTextWidth(wordWithSpace);

            if (xPosition + wordWidth > marginLeft + maxWidth && xPosition > marginLeft + textIndent) {
              xPosition = marginLeft + textIndent;
              currentLineY += lineHeight;

              if (currentLineY + lineHeight > pageHeight - marginBottom) {
                doc.addPage();
                currentLineY = 15;
                pageBreakOccurred = true;
              }
            }

            doc.text(wordWithSpace, xPosition, currentLineY);
            xPosition += wordWidth;
          });
        });

        yPosition = currentLineY + lineHeight * 0.7;
      });

      yPosition += lineHeight * 0.3;
    }

    if (blockIndex < blocks.length - 1) {
      yPosition += lineHeight * 0.3;
    }
  });

  return { finalY: yPosition, pageBreakOccurred };
}

export function htmlToPlainText(html: string): string {
  if (!html || html === '<p><br></p>') return '';

  let text = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<li[^>]*>/gi, '  - ')
    .replace(/<\/ul>/gi, '\n')
    .replace(/<\/ol>/gi, '\n');

  text = text.replace(/<[^>]*>/g, '');

  text = text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

  text = text.replace(/\n{3,}/g, '\n\n').trim();

  return text;
}
