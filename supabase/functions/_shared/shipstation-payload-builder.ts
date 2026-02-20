interface Invoice {
  id: string;
  uuid?: string;
  invoice_number: string;
  customer_name: string;
  customer_company?: string;
  customer_email: string;
  customer_phone?: string;
  customer_address?: string;
  customer_address2?: string;
  customer_city?: string;
  customer_state?: string;
  customer_zip_code?: string;
  customer_country?: string;
  shipping_address1?: string;
  shipping_address2?: string;
  shipping_city?: string;
  shipping_state?: string;
  shipping_zip_code?: string;
  shipping_country?: string;
  created_at: string;
  total?: number;
  tax?: number;
  shipping?: number;
}

interface LineItem {
  id: string;
  sku?: string;
  name?: string;
  quantity: number;
  unit_price: number;
  weight_oz?: number;
}

interface ShipStationOrderPayload {
  orderNumber: string;
  orderKey: string;
  orderDate: string;
  orderStatus: string;
  customerUsername?: string;
  customerEmail: string;
  billTo: {
    name: string;
    company?: string;
    street1: string;
    street2?: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
    phone?: string;
  };
  shipTo: {
    name: string;
    company?: string;
    street1: string;
    street2?: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
    phone?: string;
  };
  items: Array<{
    lineItemKey: string;
    sku: string;
    name: string;
    quantity: number;
    unitPrice: number;
    weight: {
      value: number;
      units: string;
    };
  }>;
  amountPaid?: number;
  taxAmount?: number;
  shippingAmount?: number;
  internalNotes?: string;
  advancedOptions?: {
    source: string;
  };
}

export function buildShipStationOrderPayload(
  invoice: Invoice,
  lineItems: LineItem[] = []
): ShipStationOrderPayload {
  const billToAddress = {
    name: invoice.customer_name || 'Customer',
    company: invoice.customer_company || undefined,
    street1: invoice.customer_address || '',
    street2: invoice.customer_address2 || undefined,
    city: invoice.customer_city || '',
    state: invoice.customer_state || '',
    postalCode: invoice.customer_zip_code || '',
    country: invoice.customer_country || 'US',
    phone: invoice.customer_phone || undefined,
  };

  const hasShippingAddress =
    invoice.shipping_address1 ||
    invoice.shipping_city ||
    invoice.shipping_state ||
    invoice.shipping_zip_code;

  const shipToAddress = hasShippingAddress
    ? {
        name: invoice.customer_name || 'Customer',
        company: invoice.customer_company || undefined,
        street1: invoice.shipping_address1 || '',
        street2: invoice.shipping_address2 || undefined,
        city: invoice.shipping_city || '',
        state: invoice.shipping_state || '',
        postalCode: invoice.shipping_zip_code || '',
        country: invoice.shipping_country || 'US',
        phone: invoice.customer_phone || undefined,
      }
    : billToAddress;

  const items = lineItems.map((item) => ({
    lineItemKey: item.id,
    sku: item.sku || item.id,
    name: item.name || 'Custom Item',
    quantity: item.quantity || 1,
    unitPrice: item.unit_price || 0,
    weight: {
      value: item.weight_oz || 8,
      units: 'ounces',
    },
  }));

  const payload: ShipStationOrderPayload = {
    orderNumber: invoice.invoice_number,
    orderKey: invoice.uuid || invoice.id,
    orderDate: invoice.created_at,
    orderStatus: 'awaiting_shipment',
    customerUsername: invoice.customer_email,
    customerEmail: invoice.customer_email,
    billTo: billToAddress,
    shipTo: shipToAddress,
    items: items,
    amountPaid: invoice.total || 0,
    taxAmount: invoice.tax || 0,
    shippingAmount: invoice.shipping || 0,
    internalNotes: `InkOps Invoice: ${invoice.invoice_number}`,
    advancedOptions: {
      source: 'InkOps',
    },
  };

  return payload;
}

export function validateShipStationPayload(payload: ShipStationOrderPayload): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!payload.shipTo.street1) {
    errors.push('Shipping address is required');
  }

  if (!payload.shipTo.city) {
    errors.push('Shipping city is required');
  }

  if (!payload.shipTo.state) {
    errors.push('Shipping state is required');
  }

  if (!payload.shipTo.postalCode) {
    errors.push('Shipping postal code is required');
  }

  if (!payload.items || payload.items.length === 0) {
    errors.push('At least one line item is required');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
