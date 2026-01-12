import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const PRINTAVO_API_URL = "https://www.printavo.com/api/v2";
const DELAY_BETWEEN_REQUESTS = 50;
const PAGE_SIZE = 7;
const BATCH_SIZE = 50;
const MAX_RETRIES = 3;
const MIN_INVOICE_DATE = "2025-01-01T00:00:00Z";

interface GraphQLRequest {
  query: string;
  variables?: Record<string, unknown>;
  operationName?: string;
}

interface Invoice {
  id: string;
  visualId?: string;
  customerId?: string;
  status?: { name?: string };
  contact?: {
    id?: string;
    fullName?: string;
    email?: string;
  };
  subtotal?: number;
  salesTaxAmount?: number;
  total?: number;
  amountPaid?: number;
  amountOutstanding?: number;
  paidInFull?: boolean;
  createdAt?: string;
  dueAt?: string;
  timestamps?: {
    createdAt?: string;
    updatedAt?: string;
  };
  lineItemGroups?: {
    edges: Array<{
      node: {
        id: string;
        lineItems?: {
          edges: Array<{
            node: {
              id: string;
              description?: string;
              items?: number;
              price?: number;
            };
          }>;
        };
      };
    }>;
  };
}

interface Payment {
  id: string;
  amount?: number;
  timestamps?: {
    createdAt?: string;
  };
  transactedFor?: {
    id?: string;
    visualId?: string;
  };
}

interface PageInfo {
  hasNextPage: boolean;
  endCursor: string | null;
}

interface InvoicesResponse {
  data: {
    invoices: {
      edges: Array<{ node: Invoice }>;
      pageInfo: PageInfo;
    };
  };
}

interface PaymentsResponse {
  data: {
    transactions: {
      edges: Array<{ node: Payment }>;
      pageInfo: PageInfo;
    };
  };
}

async function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
}

async function decryptToken(encryptedToken: string, encryptionKey: string): Promise<string> {
  try {
    const combined = new Uint8Array(
      atob(encryptedToken).split('').map(c => c.charCodeAt(0))
    );

    const salt = combined.slice(0, 16);
    const iv = combined.slice(16, 28);
    const encryptedData = combined.slice(28);

    const key = await deriveKey(encryptionKey, salt);

    const decryptedData = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv },
      key,
      encryptedData
    );

    const decoder = new TextDecoder();
    return decoder.decode(decryptedData);
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error('Failed to decrypt token');
  }
}

async function fetchFromPrintavo(
  query: string,
  variables: Record<string, unknown>,
  printavoEmail: string,
  printavoToken: string,
  retryCount = 0
): Promise<any> {
  const body: GraphQLRequest = {
    query,
    variables,
  };

  const response = await fetch(PRINTAVO_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      email: printavoEmail,
      token: printavoToken,
    },
    body: JSON.stringify(body),
  });

  if (response.status === 429 && retryCount < MAX_RETRIES) {
    const waitTime = Math.pow(2, retryCount) * 5000;
    console.log(`Rate limited. Waiting ${waitTime}ms before retry ${retryCount + 1}/${MAX_RETRIES}`);
    await delay(waitTime);
    return fetchFromPrintavo(query, variables, printavoEmail, printavoToken, retryCount + 1);
  }

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Printavo API error: ${response.status} - ${errorText}`);
    throw new Error(
      `Printavo API error: ${response.status} - ${errorText}`
    );
  }

  const result = await response.json();
  if (result.errors) {
    console.error('GraphQL errors:', JSON.stringify(result.errors));
    throw new Error(`GraphQL errors: ${JSON.stringify(result.errors)}`);
  }

  return result;
}

/**
 * Fetches complete customer details from Printavo API.
 * This is the ONLY source of customer contact information including phone numbers and addresses.
 */
async function fetchCustomerDetails(
  printavoCustomerId: string,
  printavoEmail: string,
  printavoToken: string
): Promise<any> {
  const customerQuery = `
    query GetCustomer($id: ID!) {
      customer(id: $id) {
        id
        companyName
        publicUrl
        salesTax
        taxExempt
        primaryContact {
          firstName
          lastName
          email
          phone
        }
        billingAddress {
          address1
          address2
          city
          state
          postalCode
          country
        }
        shippingAddress {
          address1
          address2
          city
          state
          postalCode
          country
        }
      }
    }
  `;

  try {
    const result = await fetchFromPrintavo(
      customerQuery,
      { id: printavoCustomerId },
      printavoEmail,
      printavoToken
    );
    return result.data?.customer || null;
  } catch (error) {
    console.error('Error fetching customer details for ID', printavoCustomerId, ':', error);
    return null;
  }
}

/**
 * Finds or creates a customer record based on Printavo customer data.
 * IMPORTANT: All customer contact data comes from the Customer object, NOT from the invoice.
 * The invoice only provides invoice.customerId which we use to fetch the full customer record.
 */
async function findOrCreateCustomer(
  supabase: any,
  invoice: Invoice,
  printavoEmail: string,
  printavoToken: string
): Promise<{ id: string | null; details: any | null }> {
  // Step 1: Get customer ID from invoice (this is the ONLY reliable field)
  const printavoCustomerId = invoice.customerId;

  if (!printavoCustomerId) {
    console.log('No customerId found on invoice', invoice.id);
    return { id: null, details: null };
  }

  // Step 2: Fetch complete customer details from Printavo Customer object
  const customerDetails = await fetchCustomerDetails(printavoCustomerId, printavoEmail, printavoToken);

  if (!customerDetails) {
    console.error('Failed to fetch customer details for customerId:', printavoCustomerId);
    return { id: null, details: null };
  }

  console.log('Fetched customer details from Printavo:', {
    id: customerDetails.id,
    companyName: customerDetails.companyName,
    hasBilling: !!customerDetails.billingAddress,
    hasShipping: !!customerDetails.shippingAddress,
    primaryPhone: customerDetails.primaryContact?.phone,
  });

  // Step 3: Extract all customer fields from Customer object
  const companyName = customerDetails.companyName || '';
  const primaryContact = customerDetails.primaryContact || {};
  const contactName = primaryContact.firstName && primaryContact.lastName
    ? `${primaryContact.firstName} ${primaryContact.lastName}`.trim()
    : invoice.contact?.fullName || '';
  const customerEmail = primaryContact.email || invoice.contact?.email || '';
  const customerPhone = primaryContact.phone || '';

  if (!companyName && !contactName) {
    console.log('No customer name found for customerId:', printavoCustomerId);
    return { id: null, details: null };
  }

  // Step 4: Check if customer already exists in local database
  let existingCustomer = null;

  // Try to find by Printavo customer ID first (most reliable)
  const { data: customerByPrintavoId } = await supabase
    .from('customers')
    .select('id')
    .eq('printavo_customer_id', printavoCustomerId)
    .maybeSingle();
  existingCustomer = customerByPrintavoId;

  // Fallback: try by email if not found by Printavo ID
  if (!existingCustomer && customerEmail) {
    const { data } = await supabase
      .from('customers')
      .select('id')
      .eq('email', customerEmail)
      .maybeSingle();
    existingCustomer = data;
  }

  // Fallback: try by company name
  if (!existingCustomer && companyName) {
    const { data } = await supabase
      .from('customers')
      .select('id')
      .eq('company_name', companyName)
      .maybeSingle();
    existingCustomer = data;
  }

  // Step 5: Update existing customer with latest data from Printavo
  if (existingCustomer) {
    const updateData: any = {
      printavo_customer_id: printavoCustomerId,
    };

    // Update company and contact info
    if (companyName) updateData.company_name = companyName;
    if (contactName) updateData.contact_name = contactName;
    if (customerEmail) updateData.email = customerEmail;
    if (customerPhone) updateData.phone = customerPhone;

    // Update billing address from Customer object
    if (customerDetails.billingAddress) {
      const billing = customerDetails.billingAddress;
      if (billing.address1) updateData.billing_address_line1 = billing.address1;
      if (billing.address2) updateData.billing_address_line2 = billing.address2;
      if (billing.city) updateData.billing_city = billing.city;
      if (billing.state) updateData.billing_state = billing.state;
      if (billing.postalCode) updateData.billing_zip = billing.postalCode;
      if (billing.country) updateData.billing_country = billing.country;
    }

    // Update shipping address from Customer object
    if (customerDetails.shippingAddress) {
      const shipping = customerDetails.shippingAddress;
      if (shipping.address1) updateData.shipping_address_line1 = shipping.address1;
      if (shipping.address2) updateData.shipping_address_line2 = shipping.address2;
      if (shipping.city) updateData.shipping_city = shipping.city;
      if (shipping.state) updateData.shipping_state = shipping.state;
      if (shipping.postalCode) updateData.shipping_zip = shipping.postalCode;
      if (shipping.country) updateData.shipping_country = shipping.country;
    }

    await supabase
      .from('customers')
      .update(updateData)
      .eq('id', existingCustomer.id);

    console.log('Updated existing customer:', companyName || contactName);
    return { id: existingCustomer.id, details: customerDetails };
  }

  // Step 6: Create new customer with all data from Customer object
  const customerData: any = {
    printavo_customer_id: printavoCustomerId,
    company_name: companyName,
    contact_name: contactName,
    email: customerEmail,
    phone: customerPhone,
    status: 'active',
  };

  // Add billing address from Customer object
  if (customerDetails.billingAddress) {
    const billing = customerDetails.billingAddress;
    customerData.billing_address_line1 = billing.address1 || '';
    customerData.billing_address_line2 = billing.address2 || '';
    customerData.billing_city = billing.city || '';
    customerData.billing_state = billing.state || '';
    customerData.billing_zip = billing.postalCode || '';
    customerData.billing_country = billing.country || 'USA';
  }

  // Add shipping address from Customer object
  if (customerDetails.shippingAddress) {
    const shipping = customerDetails.shippingAddress;
    customerData.shipping_address_line1 = shipping.address1 || '';
    customerData.shipping_address_line2 = shipping.address2 || '';
    customerData.shipping_city = shipping.city || '';
    customerData.shipping_state = shipping.state || '';
    customerData.shipping_zip = shipping.postalCode || '';
    customerData.shipping_country = shipping.country || 'USA';
  }

  const { data: newCustomer, error } = await supabase
    .from('customers')
    .insert(customerData)
    .select('id')
    .single();

  if (error) {
    console.error('Error creating customer:', error);
    return { id: null, details: null };
  }

  console.log('Created new customer:', companyName || contactName, 'with ID:', newCustomer.id);
  return { id: newCustomer.id, details: customerDetails };
}

async function syncInvoices(
  supabase: any,
  printavoEmail: string,
  printavoToken: string
) {
  const { data: companySettings } = await supabase
    .from('company_settings')
    .select('id')
    .maybeSingle();

  if (!companySettings) {
    console.error('Company settings not found');
    return 0;
  }

  const { data: billingStatuses } = await supabase
    .from('printavo_statuses')
    .select('name')
    .eq('is_billing_eligible', true);

  const billingEligibleStatuses = (billingStatuses || []).map(s => s.name);
  console.log('Billing eligible statuses:', billingEligibleStatuses);

  // Invoice query - only fetches invoice fields and customerId
  // All customer contact data will be fetched separately using the Customer object
  const invoicesQuery = `
    query GetInvoices($after: String, $first: Int = 7, $paymentStatus: OrderPaymentStatus) {
      invoices(after: $after, first: $first, paymentStatus: $paymentStatus) {
        edges {
          node {
            id
            visualId
            customerId
            status {
              name
            }
            createdAt
            dueAt
            total
            subtotal
            salesTaxAmount
            paidInFull
            amountPaid
            amountOutstanding
            timestamps {
              createdAt
              updatedAt
            }
            contact {
              id
              fullName
              email
            }
            lineItemGroups {
              edges {
                node {
                  id
                  lineItems {
                    edges {
                      node {
                        id
                        description
                        items
                        price
                      }
                    }
                  }
                }
              }
            }
            fees {
              edges {
                node {
                  id
                  description
                  amount
                  taxable
                }
              }
            }
          }
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  `;

  // Recent invoices query - only fetches invoice fields and customerId
  // All customer contact data will be fetched separately using the Customer object
  const recentInvoicesQuery = `
    query GetRecentInvoices($after: String, $first: Int = 7) {
      invoices(after: $after, first: $first, sortDescending: true) {
        edges {
          node {
            id
            visualId
            customerId
            status {
              name
            }
            createdAt
            dueAt
            total
            subtotal
            salesTaxAmount
            paidInFull
            amountPaid
            amountOutstanding
            timestamps {
              createdAt
              updatedAt
            }
            contact {
              id
              fullName
              email
            }
            lineItemGroups {
              edges {
                node {
                  id
                  lineItems {
                    edges {
                      node {
                        id
                        description
                        items
                        price
                      }
                    }
                  }
                }
              }
            }
            fees {
              edges {
                node {
                  id
                  description
                  amount
                  taxable
                }
              }
            }
          }
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  `;

  let totalInvoices = 0;
  let batchBuffer: any[] = [];
  let lineItemsBatchBuffer: any[] = [];

  const flushBatch = async () => {
    if (batchBuffer.length > 0) {
      await supabase.from("printavo_invoices").upsert(batchBuffer, { onConflict: "id" });
      batchBuffer = [];
    }
    if (lineItemsBatchBuffer.length > 0) {
      await supabase.from("printavo_line_items").upsert(lineItemsBatchBuffer, { onConflict: "id" });
      lineItemsBatchBuffer = [];
    }
  };

  console.log(`Syncing unpaid and partially paid invoices...`);
  for (const paymentStatus of ['UNPAID', 'PARTIAL_PAYMENT']) {
    let hasNextPage = true;
    let after: string | null = null;
    let pageCount = 0;

    console.log(`Syncing ${paymentStatus} invoices...`);

    while (hasNextPage) {
      await delay(DELAY_BETWEEN_REQUESTS);

      const result: InvoicesResponse = await fetchFromPrintavo(
        invoicesQuery,
        { after, first: PAGE_SIZE, paymentStatus },
        printavoEmail,
        printavoToken
      );

      if (!result.data?.invoices?.edges) {
        console.log('No invoices data returned from API');
        break;
      }

      const invoices = result.data.invoices.edges.map((edge) => edge.node);
      const filteredInvoices = invoices.filter(invoice =>
        invoice.createdAt && new Date(invoice.createdAt) >= new Date(MIN_INVOICE_DATE)
      );

      for (const invoice of filteredInvoices) {
        if (filteredInvoices.indexOf(invoice) === 0) {
          console.log('Sample invoice structure:', JSON.stringify({
            id: invoice.id,
            visualId: invoice.visualId,
            customerId: invoice.customerId,
            contact: invoice.contact,
          }, null, 2));
        }

        // Fetch customer details using customerId - this is the source of ALL customer contact data
        const { id: customerId, details: customerDetails } = await findOrCreateCustomer(supabase, invoice, printavoEmail, printavoToken);

        const amountOutstanding = invoice.amountOutstanding || 0;
        let statusStage = 'billing_queue';
        if (amountOutstanding === 0 && invoice.paidInFull) {
          statusStage = 'paid';
        } else if (amountOutstanding > 0) {
          statusStage = 'accounts_receivable';
        }

        // Extract customer data from Customer object (stored in customerDetails)
        const primaryContact = customerDetails?.primaryContact || {};
        const customerName = customerDetails?.companyName ||
                            (primaryContact.firstName && primaryContact.lastName
                              ? `${primaryContact.firstName} ${primaryContact.lastName}`.trim()
                              : invoice.contact?.fullName) || '';
        const customerEmail = primaryContact.email || invoice.contact?.email || '';
        const customerPhone = primaryContact.phone || '';

        // Extract billing address from Customer object
        let billingAddress = null;
        if (customerDetails?.billingAddress) {
          const billing = customerDetails.billingAddress;
          if (billing.address1 || billing.city) {
            billingAddress = {
              line1: billing.address1 || '',
              line2: billing.address2 || '',
              city: billing.city || '',
              state: billing.state || '',
              zip: billing.postalCode || '',
              country: billing.country || 'USA',
            };
          }
        }

        // Extract shipping address from Customer object
        let shippingAddress = null;
        if (customerDetails?.shippingAddress) {
          const shipping = customerDetails.shippingAddress;
          if (shipping.address1 || shipping.city) {
            shippingAddress = {
              line1: shipping.address1 || '',
              line2: shipping.address2 || '',
              city: shipping.city || '',
              state: shipping.state || '',
              zip: shipping.postalCode || '',
              country: shipping.country || 'USA',
            };
          }
        }

        // Store invoice with complete customer snapshot
        batchBuffer.push({
          id: invoice.id,
          invoice_number: invoice.visualId,
          customer_id: customerId,
          customer_email: customerEmail,
          customer_phone: customerPhone,
          customer_name: customerName,
          customer_company: customerDetails?.companyName || '',
          billing_address: billingAddress,
          billing_address_line1: billingAddress?.line1 || null,
          billing_address_line2: billingAddress?.line2 || null,
          billing_city: billingAddress?.city || null,
          billing_state: billingAddress?.state || null,
          billing_zip: billingAddress?.zip || null,
          billing_country: billingAddress?.country || null,
          shipping_address: shippingAddress,
          shipping_address_line1: shippingAddress?.line1 || null,
          shipping_address_line2: shippingAddress?.line2 || null,
          shipping_city: shippingAddress?.city || null,
          shipping_state: shippingAddress?.state || null,
          shipping_zip: shippingAddress?.zip || null,
          shipping_country: shippingAddress?.country || null,
          subtotal: invoice.subtotal || 0,
          tax: invoice.salesTaxAmount || 0,
          total: invoice.total || 0,
          amount_paid: invoice.amountPaid || 0,
          amount_outstanding: amountOutstanding,
          status: invoice.status?.name,
          status_stage: statusStage,
          invoice_date: invoice.createdAt,
          due_date: invoice.dueAt,
          updated_at: new Date().toISOString(),
          raw_data: invoice,
        });

        // Update billing queue if this invoice is billing-eligible
        if (billingEligibleStatuses.includes(invoice.status?.name)) {
          const { data: existingQueueItem } = await supabase
            .from('billing_queue')
            .select('id, payment_status')
            .eq('printavo_invoice_id', invoice.id)
            .maybeSingle();

          if (existingQueueItem && existingQueueItem.payment_status !== 'paid') {
            await supabase
              .from('billing_queue')
              .update({
                printavo_status: invoice.status?.name,
                customer_name: customerName,
                customer_email: customerEmail,
                customer_company: customerDetails?.companyName || '',
                invoice_total: invoice.total || 0,
                invoice_date: invoice.createdAt,
                due_date: invoice.dueAt,
              })
              .eq('id', existingQueueItem.id);
          } else if (!existingQueueItem) {
            await supabase
              .from('billing_queue')
              .insert({
                company_id: companySettings.id,
                printavo_invoice_id: invoice.id,
                printavo_visual_id: invoice.visualId,
                printavo_status: invoice.status?.name,
                customer_name: customerName,
                customer_email: customerEmail,
                customer_company: customerDetails?.companyName || '',
                invoice_total: invoice.total || 0,
                invoice_date: invoice.createdAt,
                due_date: invoice.dueAt,
                payment_status: 'unpaid',
              });
          }
        }

        if (invoice.lineItemGroups?.edges) {
          for (const groupEdge of invoice.lineItemGroups.edges) {
            const group = groupEdge.node;
            if (group.lineItems?.edges) {
              for (const itemEdge of group.lineItems.edges) {
                const lineItem = itemEdge.node;
                lineItemsBatchBuffer.push({
                  id: lineItem.id,
                  invoice_id: invoice.id,
                  line_item_group_id: group.id,
                  description: lineItem.description,
                  quantity: lineItem.items || 0,
                  unit_price: lineItem.price || 0,
                  total_price: (lineItem.items || 0) * (lineItem.price || 0),
                  updated_at: new Date().toISOString(),
                  raw_data: lineItem,
                });
              }
            }
          }
        }

        if (batchBuffer.length >= BATCH_SIZE || lineItemsBatchBuffer.length >= BATCH_SIZE * 5) {
          await flushBatch();
        }
      }

      totalInvoices += filteredInvoices.length;
      console.log(`${paymentStatus} - Page ${pageCount + 1}: Found ${invoices.length} invoices, filtered to ${filteredInvoices.length} after ${MIN_INVOICE_DATE}`);

      hasNextPage = result.data.invoices.pageInfo.hasNextPage;
      after = result.data.invoices.pageInfo.endCursor;
      pageCount++;

      if (invoices.length === 0) {
        break;
      }
    }
  }

  await flushBatch();

  console.log(`Syncing all invoices from ${MIN_INVOICE_DATE} forward...`);
  let hasNextPage = true;
  let after: string | null = null;
  let pageCount = 0;

  while (hasNextPage) {
    await delay(DELAY_BETWEEN_REQUESTS);

    const result: InvoicesResponse = await fetchFromPrintavo(
      recentInvoicesQuery,
      { after, first: PAGE_SIZE },
      printavoEmail,
      printavoToken
    );

    if (!result.data?.invoices?.edges) {
      console.log('No invoices data returned from API');
      break;
    }

    const invoices = result.data.invoices.edges.map((edge) => edge.node);
    const recentInvoices = invoices.filter(invoice => {
      return invoice.createdAt && new Date(invoice.createdAt) >= new Date(MIN_INVOICE_DATE);
    });

    for (const invoice of recentInvoices) {
      // Fetch customer details using customerId - this is the source of ALL customer contact data
      const { id: customerId, details: customerDetails } = await findOrCreateCustomer(supabase, invoice, printavoEmail, printavoToken);

      const amountOutstanding = invoice.amountOutstanding || 0;
      let statusStage = 'billing_queue';
      if (amountOutstanding === 0 && invoice.paidInFull) {
        statusStage = 'paid';
      } else if (amountOutstanding > 0) {
        statusStage = 'accounts_receivable';
      }

      // Extract customer data from Customer object (stored in customerDetails)
      const primaryContact = customerDetails?.primaryContact || {};
      const customerName = customerDetails?.companyName ||
                          (primaryContact.firstName && primaryContact.lastName
                            ? `${primaryContact.firstName} ${primaryContact.lastName}`.trim()
                            : invoice.contact?.fullName) || '';
      const customerEmail = primaryContact.email || invoice.contact?.email || '';
      const customerPhone = primaryContact.phone || '';

      // Extract billing address from Customer object
      let billingAddress = null;
      if (customerDetails?.billingAddress) {
        const billing = customerDetails.billingAddress;
        if (billing.address1 || billing.city) {
          billingAddress = {
            line1: billing.address1 || '',
            line2: billing.address2 || '',
            city: billing.city || '',
            state: billing.state || '',
            zip: billing.postalCode || '',
            country: billing.country || 'USA',
          };
        }
      }

      // Extract shipping address from Customer object
      let shippingAddress = null;
      if (customerDetails?.shippingAddress) {
        const shipping = customerDetails.shippingAddress;
        if (shipping.address1 || shipping.city) {
          shippingAddress = {
            line1: shipping.address1 || '',
            line2: shipping.address2 || '',
            city: shipping.city || '',
            state: shipping.state || '',
            zip: shipping.postalCode || '',
            country: shipping.country || 'USA',
          };
        }
      }

      // Store invoice with complete customer snapshot
      batchBuffer.push({
        id: invoice.id,
        invoice_number: invoice.visualId,
        customer_id: customerId,
        customer_email: customerEmail,
        customer_phone: customerPhone,
        customer_name: customerName,
        customer_company: customerDetails?.companyName || '',
        billing_address: billingAddress,
        billing_address_line1: billingAddress?.line1 || null,
        billing_address_line2: billingAddress?.line2 || null,
        billing_city: billingAddress?.city || null,
        billing_state: billingAddress?.state || null,
        billing_zip: billingAddress?.zip || null,
        billing_country: billingAddress?.country || null,
        shipping_address: shippingAddress,
        shipping_address_line1: shippingAddress?.line1 || null,
        shipping_address_line2: shippingAddress?.line2 || null,
        shipping_city: shippingAddress?.city || null,
        shipping_state: shippingAddress?.state || null,
        shipping_zip: shippingAddress?.zip || null,
        shipping_country: shippingAddress?.country || null,
        subtotal: invoice.subtotal || 0,
        tax: invoice.salesTaxAmount || 0,
        total: invoice.total || 0,
        amount_paid: invoice.amountPaid || 0,
        amount_outstanding: amountOutstanding,
        status: invoice.status?.name,
        status_stage: statusStage,
        invoice_date: invoice.createdAt,
        due_date: invoice.dueAt,
        updated_at: new Date().toISOString(),
        raw_data: invoice,
      });

      // Update billing queue if this invoice is billing-eligible
      if (billingEligibleStatuses.includes(invoice.status?.name)) {
        const { data: existingQueueItem } = await supabase
          .from('billing_queue')
          .select('id, payment_status')
          .eq('printavo_invoice_id', invoice.id)
          .maybeSingle();

        if (existingQueueItem && existingQueueItem.payment_status !== 'paid') {
          await supabase
            .from('billing_queue')
            .update({
              printavo_status: invoice.status?.name,
              customer_name: customerName,
              customer_email: customerEmail,
              customer_company: customerDetails?.companyName || '',
              invoice_total: invoice.total || 0,
              invoice_date: invoice.createdAt,
              due_date: invoice.dueAt,
            })
            .eq('id', existingQueueItem.id);
        } else if (!existingQueueItem) {
          await supabase
            .from('billing_queue')
            .insert({
              company_id: companySettings.id,
              printavo_invoice_id: invoice.id,
              printavo_visual_id: invoice.visualId,
              printavo_status: invoice.status?.name,
              customer_name: customerName,
              customer_email: customerEmail,
              customer_company: customerDetails?.companyName || '',
              invoice_total: invoice.total || 0,
              invoice_date: invoice.createdAt,
              due_date: invoice.dueAt,
              payment_status: 'unpaid',
            });
        }
      }

      if (invoice.lineItemGroups?.edges) {
        for (const groupEdge of invoice.lineItemGroups.edges) {
          const group = groupEdge.node;
          if (group.lineItems?.edges) {
            for (const itemEdge of group.lineItems.edges) {
              const lineItem = itemEdge.node;
              lineItemsBatchBuffer.push({
                id: lineItem.id,
                invoice_id: invoice.id,
                line_item_group_id: group.id,
                description: lineItem.description,
                quantity: lineItem.items || 0,
                unit_price: lineItem.price || 0,
                total_price: (lineItem.items || 0) * (lineItem.price || 0),
                updated_at: new Date().toISOString(),
                raw_data: lineItem,
              });
            }
          }
        }
      }

      if (batchBuffer.length >= BATCH_SIZE || lineItemsBatchBuffer.length >= BATCH_SIZE * 5) {
        await flushBatch();
      }
    }

    totalInvoices += recentInvoices.length;
    console.log(`All invoices - Page ${pageCount + 1}: Found ${invoices.length} invoices, ${recentInvoices.length} after ${MIN_INVOICE_DATE}`);

    if (recentInvoices.length === 0 || invoices.length === 0) {
      console.log(`Reached invoices before ${MIN_INVOICE_DATE}, stopping sync`);
      break;
    }

    hasNextPage = result.data.invoices.pageInfo.hasNextPage;
    after = result.data.invoices.pageInfo.endCursor;
    pageCount++;
  }

  await flushBatch();
  return totalInvoices;
}

async function syncPayments(
  supabase: any,
  printavoEmail: string,
  printavoToken: string
) {
  const paymentsQuery = `
    query GetPayments($after: String, $first: Int = 7) {
      transactions(after: $after, first: $first) {
        edges {
          node {
            ... on Payment {
              id
              amount
              timestamps {
                createdAt
              }
              transactedFor {
                ... on Invoice {
                  id
                  visualId
                }
              }
            }
          }
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  `;

  let hasNextPage = true;
  let after: string | null = null;
  let totalPayments = 0;
  let pageCount = 0;
  let batchBuffer: any[] = [];

  const flushBatch = async () => {
    if (batchBuffer.length > 0) {
      await supabase.from("printavo_payments").upsert(batchBuffer, { onConflict: "id" });
      batchBuffer = [];
    }
  };

  while (hasNextPage) {
    await delay(DELAY_BETWEEN_REQUESTS);

    const result: PaymentsResponse = await fetchFromPrintavo(
      paymentsQuery,
      { after, first: PAGE_SIZE },
      printavoEmail,
      printavoToken
    );

    if (!result.data?.transactions?.edges) {
      console.log('No transactions data returned from API');
      break;
    }

    const payments = result.data.transactions.edges.map((edge) => edge.node);
    const filteredPayments = payments.filter(payment =>
      payment.transactedFor?.id
    );

    for (const payment of filteredPayments) {
      batchBuffer.push({
        id: payment.id,
        invoice_id: payment.transactedFor?.id,
        amount: payment.amount || 0,
        payment_date: payment.timestamps?.createdAt,
        updated_at: new Date().toISOString(),
        raw_data: payment,
      });

      if (batchBuffer.length >= BATCH_SIZE) {
        await flushBatch();
      }
    }

    totalPayments += filteredPayments.length;
    console.log(`Page ${pageCount + 1}: Found ${payments.length} payments, filtered to ${filteredPayments.length} with valid invoice references`);
    hasNextPage = result.data.transactions.pageInfo.hasNextPage;
    after = result.data.transactions.pageInfo.endCursor;
    pageCount++;

    if (payments.length === 0) {
      break;
    }
  }

  await flushBatch();
  return totalPayments;
}

async function performSync(
  supabase: any,
  printavoEmail: string,
  printavoToken: string,
  syncLogId: string,
  mode: string = 'quick'
) {
  try {
    console.log(`Starting ${mode} sync...`);
    const invoicesCount = await syncInvoices(
      supabase,
      printavoEmail,
      printavoToken
    );
    console.log(`Synced ${invoicesCount} invoices`);

    let paymentsCount = 0;
    if (mode === 'full') {
      console.log('Starting payment sync...');
      paymentsCount = await syncPayments(
        supabase,
        printavoEmail,
        printavoToken
      );
      console.log(`Synced ${paymentsCount} payments`);
    } else {
      console.log('Skipping payment sync (quick mode)');
    }

    await supabase
      .from("printavo_sync_log")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        records_synced: invoicesCount + paymentsCount,
      })
      .eq("id", syncLogId);

    console.log('Sync completed successfully');
  } catch (error) {
    console.error('Sync failed:', error);
    await supabase
      .from("printavo_sync_log")
      .update({
        status: "failed",
        completed_at: new Date().toISOString(),
        error_message: error instanceof Error ? error.message : "Unknown error",
      })
      .eq("id", syncLogId);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    console.log('Edge function called');

    let mode = 'quick';
    try {
      const body = await req.json();
      mode = body.mode || 'quick';
    } catch {
      mode = 'quick';
    }
    console.log(`Sync mode: ${mode}`);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const encryptionKey = Deno.env.get('ENCRYPTION_KEY');

    if (!encryptionKey) {
      throw new Error('ENCRYPTION_KEY not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: settings, error: settingsError } = await supabase
      .from('company_settings')
      .select('printavo_username, printavo_api_token_encrypted')
      .maybeSingle();

    if (settingsError || !settings || !settings.printavo_username || !settings.printavo_api_token_encrypted) {
      console.error('Failed to fetch Printavo credentials from company_settings:', settingsError);
      return new Response(
        JSON.stringify({
          error: "Printavo credentials not configured. Please configure in Account Settings.",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const printavoEmail = settings.printavo_username;
    const printavoToken = await decryptToken(settings.printavo_api_token_encrypted, encryptionKey);

    console.log('Credentials check:', {
      supabaseUrlSet: !!supabaseUrl,
      serviceKeySet: !!supabaseServiceKey,
      emailSet: !!printavoEmail,
      tokenSet: !!printavoToken,
      email: printavoEmail || 'NOT SET'
    });

    if (!printavoEmail || !printavoToken) {
      console.error('Printavo credentials missing from company_settings');
      return new Response(
        JSON.stringify({
          error: "Printavo credentials incomplete. Please configure in Account Settings.",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    await supabase
      .from("printavo_sync_log")
      .update({
        status: "failed",
        completed_at: new Date().toISOString(),
        error_message: "Stale sync cleared",
      })
      .eq("status", "running")
      .lt("started_at", new Date(Date.now() - 5 * 60 * 1000).toISOString());

    const { data: existingSync } = await supabase
      .from("printavo_sync_log")
      .select("*")
      .eq("status", "running")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingSync) {
      return new Response(
        JSON.stringify({
          message: "Sync already in progress",
          syncId: existingSync.id,
          started: existingSync.started_at,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: syncLog } = await supabase
      .from("printavo_sync_log")
      .insert({
        sync_type: mode,
        status: "running",
      })
      .select()
      .single();

    performSync(supabase, printavoEmail, printavoToken, syncLog.id, mode);

    return new Response(
      JSON.stringify({
        message: "Sync started",
        syncId: syncLog.id,
        status: "running",
        mode: mode,
        note: "Poll the printavo_sync_log table for status updates"
      }),
      {
        status: 202,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Sync error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
