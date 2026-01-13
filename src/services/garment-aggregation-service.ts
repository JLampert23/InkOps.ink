import { supabase } from '../lib/supabase-client';

export interface GarmentSummary {
  styles: string[];
  colors: string[];
  totalItems: number;
  sizeBreakdown: Record<string, number>;
  topStyle: string | null;
  topColor: string | null;
}

export interface LineItemWithGarment {
  id: string;
  description: string | null;
  quantity: number;
  extracted_style: string | null;
  extracted_color: string | null;
  extracted_sizes: Record<string, number> | null;
}

export const garmentAggregationService = {
  async getInvoiceGarmentSummary(invoiceId: string): Promise<GarmentSummary> {
    const { data: lineItems, error } = await supabase
      .from('printavo_line_items')
      .select('id, description, quantity, extracted_style, extracted_color, extracted_sizes')
      .eq('invoice_id', invoiceId);

    if (error || !lineItems) {
      return {
        styles: [],
        colors: [],
        totalItems: 0,
        sizeBreakdown: {},
        topStyle: null,
        topColor: null,
      };
    }

    const styleSet = new Set<string>();
    const colorSet = new Set<string>();
    const sizeBreakdown: Record<string, number> = {};
    const styleCounts: Record<string, number> = {};
    const colorCounts: Record<string, number> = {};
    let totalItems = 0;

    for (const item of lineItems) {
      if (item.extracted_style) {
        styleSet.add(item.extracted_style);
        styleCounts[item.extracted_style] = (styleCounts[item.extracted_style] || 0) + item.quantity;
      }

      if (item.extracted_color) {
        colorSet.add(item.extracted_color);
        colorCounts[item.extracted_color] = (colorCounts[item.extracted_color] || 0) + item.quantity;
      }

      if (item.extracted_sizes) {
        for (const [size, count] of Object.entries(item.extracted_sizes)) {
          sizeBreakdown[size] = (sizeBreakdown[size] || 0) + count;
          totalItems += count;
        }
      } else {
        totalItems += item.quantity;
      }
    }

    const topStyle = Object.entries(styleCounts)
      .sort(([, a], [, b]) => b - a)[0]?.[0] || null;

    const topColor = Object.entries(colorCounts)
      .sort(([, a], [, b]) => b - a)[0]?.[0] || null;

    return {
      styles: Array.from(styleSet),
      colors: Array.from(colorSet),
      totalItems,
      sizeBreakdown,
      topStyle,
      topColor,
    };
  },

  async getMultipleInvoiceGarmentSummaries(invoiceIds: string[]): Promise<Map<string, GarmentSummary>> {
    if (invoiceIds.length === 0) {
      return new Map();
    }

    const { data: lineItems, error } = await supabase
      .from('printavo_line_items')
      .select('invoice_id, id, description, quantity, extracted_style, extracted_color, extracted_sizes')
      .in('invoice_id', invoiceIds);

    if (error || !lineItems) {
      return new Map();
    }

    const summaryMap = new Map<string, GarmentSummary>();

    const invoiceLineItems = new Map<string, LineItemWithGarment[]>();
    for (const item of lineItems) {
      if (!invoiceLineItems.has(item.invoice_id)) {
        invoiceLineItems.set(item.invoice_id, []);
      }
      invoiceLineItems.get(item.invoice_id)!.push(item);
    }

    for (const [invoiceId, items] of invoiceLineItems.entries()) {
      const styleSet = new Set<string>();
      const colorSet = new Set<string>();
      const sizeBreakdown: Record<string, number> = {};
      const styleCounts: Record<string, number> = {};
      const colorCounts: Record<string, number> = {};
      let totalItems = 0;

      for (const item of items) {
        if (item.extracted_style) {
          styleSet.add(item.extracted_style);
          styleCounts[item.extracted_style] = (styleCounts[item.extracted_style] || 0) + item.quantity;
        }

        if (item.extracted_color) {
          colorSet.add(item.extracted_color);
          colorCounts[item.extracted_color] = (colorCounts[item.extracted_color] || 0) + item.quantity;
        }

        if (item.extracted_sizes) {
          for (const [size, count] of Object.entries(item.extracted_sizes)) {
            sizeBreakdown[size] = (sizeBreakdown[size] || 0) + count;
            totalItems += count;
          }
        } else {
          totalItems += item.quantity;
        }
      }

      const topStyle = Object.entries(styleCounts)
        .sort(([, a], [, b]) => b - a)[0]?.[0] || null;

      const topColor = Object.entries(colorCounts)
        .sort(([, a], [, b]) => b - a)[0]?.[0] || null;

      summaryMap.set(invoiceId, {
        styles: Array.from(styleSet),
        colors: Array.from(colorSet),
        totalItems,
        sizeBreakdown,
        topStyle,
        topColor,
      });
    }

    for (const invoiceId of invoiceIds) {
      if (!summaryMap.has(invoiceId)) {
        summaryMap.set(invoiceId, {
          styles: [],
          colors: [],
          totalItems: 0,
          sizeBreakdown: {},
          topStyle: null,
          topColor: null,
        });
      }
    }

    return summaryMap;
  },

  formatGarmentSummary(summary: GarmentSummary): string {
    const parts: string[] = [];

    if (summary.topStyle) {
      parts.push(summary.topStyle);
    }

    if (summary.topColor) {
      parts.push(summary.topColor);
    }

    if (summary.totalItems > 0) {
      parts.push(`${summary.totalItems} items`);
    }

    return parts.length > 0 ? parts.join(' • ') : 'No garment data';
  },

  getUniqueStyles(summaries: GarmentSummary[]): string[] {
    const styles = new Set<string>();
    for (const summary of summaries) {
      summary.styles.forEach(s => styles.add(s));
    }
    return Array.from(styles).sort();
  },

  getUniqueColors(summaries: GarmentSummary[]): string[] {
    const colors = new Set<string>();
    for (const summary of summaries) {
      summary.colors.forEach(c => colors.add(c));
    }
    return Array.from(colors).sort();
  },
};
