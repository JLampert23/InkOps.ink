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
  status?: { name?: string };
  contact?: {
    id?: string;
    fullName?: string;
    email?: string;
    phone?: string;
    customer?: {
      id?: string;
      companyName?: string;
      primaryContact?: {
        firstName?: string;
        lastName?: string;
        email?: string;
        phone?: string;
      };
      billingAddress?: {
        address1?: string;
        address2?: string;
        city?: string;
        state?: string;
        postalCode?: string;
        country?: string;
      };
      shippingAddress?: {
        address1?: string;
        address2?: string;
        city?: string;
        state?: string;
        postalCode?: string;
        country?: string;
      };
    };
  };
  billingAddress?: {
    address1?: string;
    address2?: string;
    city?: string;
    state?: string;
    zip?: string;
    country?: string;
  };
  shippingAddress?: {
    address1?: string;
    address2?: string;
    city?: string;
    state?: string;
    zip?: string;
    country?: string;
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
        contacts {
          edges {
            node {
              id
              fullName
              email
              phone
            }
          }
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
    console.error('Error fetching customer details:', error);
    return null;
  }
}

async function findOrCreateCustomer(
  supabase: any,
  invoice: Invoice,
  printavoEmail: string,
  printavoToken: string
): Promise<{ id: string | null; details: any | null }> {
  const customerName = invoice.contact?.customer?.companyName || invoice.contact?.fullName;
  const customerEmail = invoice.contact?.email;
  let customerPhone = invoice.contact?.customer?.primaryContact?.phone ||
                       invoice.contact?.phone;
  const printavoCustomerId = invoice.contact?.customer?.id;

  let customerDetails = null;
  if (printavoCustomerId) {
    customerDetails = await fetchCustomerDetails(printavoCustomerId, printavoEmail, printavoToken);
    if (customerDetails) {
      console.log('Fetched customer details from Printavo:', {
        id: customerDetails.id,
        name: customerDetails.companyName,
        hasBilling: !!customerDetails.billingAddress,
        hasShipping: !!customerDetails.shippingAddress,
        primaryPhone: customerDetails.primaryContact?.phone,
      });

      if (!customerPhone && customerDetails.primaryContact?.phone) {
        customerPhone = customerDetails.primaryContact.phone;
      }
    }
  }

  if (!customerName) {
    console.log('No customer name found for invoice', invoice.id);
    return { id: null, details: null };
  }

  let existingCustomer = null;

  if (customerEmail) {
    const { data } = await supabase
      .from('customers')
      .select('id')
      .eq('email', customerEmail)
      .maybeSingle();
    existingCustomer = data;
  }

  if (!existingCustomer && customerName) {
    const { data } = await supabase
      .from('customers')
      .select('id')
      .eq('company_name', customerName)
      .maybeSingle();
    existingCustomer = data;
  }

  if (existingCustomer) {
    const updateData: any = {};
    let hasUpdates = false;

    const billingFromCustomer = customerDetails?.billingAddress || invoice.contact?.customer?.billingAddress;
    const billingFromInvoice = invoice.billingAddress;

    if (billingFromCustomer && (billingFromCustomer.address1 || billingFromCustomer.city)) {
      if (billingFromCustomer.address1) { updateData.billing_address_line1 = billingFromCustomer.address1; hasUpdates = true; }
      if (billingFromCustomer.address2) { updateData.billing_address_line2 = billingFromCustomer.address2; hasUpdates = true; }
      if (billingFromCustomer.city) { updateData.billing_city = billingFromCustomer.city; hasUpdates = true; }
      if (billingFromCustomer.state) { updateData.billing_state = billingFromCustomer.state; hasUpdates = true; }
      if (billingFromCustomer.postalCode) { updateData.billing_zip = billingFromCustomer.postalCode; hasUpdates = true; }
      if (billingFromCustomer.country) { updateData.billing_country = billingFromCustomer.country; hasUpdates = true; }
    } else if (billingFromInvoice && (billingFromInvoice.address1 || billingFromInvoice.city)) {
      if (billingFromInvoice.address1) { updateData.billing_address_line1 = billingFromInvoice.address1; hasUpdates = true; }
      if (billingFromInvoice.address2) { updateData.billing_address_line2 = billingFromInvoice.address2; hasUpdates = true; }
      if (billingFromInvoice.city) { updateData.billing_city = billingFromInvoice.city; hasUpdates = true; }
      if (billingFromInvoice.state) { updateData.billing_state = billingFromInvoice.state; hasUpdates = true; }
      if (billingFromInvoice.zip) { updateData.billing_zip = billingFromInvoice.zip; hasUpdates = true; }
      if (billingFromInvoice.country) { updateData.billing_country = billingFromInvoice.country; hasUpdates = true; }
    }

    const shippingFromCustomer = customerDetails?.shippingAddress || invoice.contact?.customer?.shippingAddress;
    const shippingFromInvoice = invoice.shippingAddress;

    if (shippingFromCustomer && (shippingFromCustomer.address1 || shippingFromCustomer.city)) {
      if (shippingFromCustomer.address1) { updateData.shipping_address_line1 = shippingFromCustomer.address1; hasUpdates = true; }
      if (shippingFromCustomer.address2) { updateData.shipping_address_line2 = shippingFromCustomer.address2; hasUpdates = true; }
      if (shippingFromCustomer.city) { updateData.shipping_city = shippingFromCustomer.city; hasUpdates = true; }
      if (shippingFromCustomer.state) { updateData.shipping_state = shippingFromCustomer.state; hasUpdates = true; }
      if (shippingFromCustomer.postalCode) { updateData.shipping_zip = shippingFromCustomer.postalCode; hasUpdates = true; }
      if (shippingFromCustomer.country) { updateData.shipping_country = shippingFromCustomer.country; hasUpdates = true; }
    } else if (shippingFromInvoice && (shippingFromInvoice.address1 || shippingFromInvoice.city)) {
      if (shippingFromInvoice.address1) { updateData.shipping_address_line1 = shippingFromInvoice.address1; hasUpdates = true; }
      if (shippingFromInvoice.address2) { updateData.shipping_address_line2 = shippingFromInvoice.address2; hasUpdates = true; }
      if (shippingFromInvoice.city) { updateData.shipping_city = shippingFromInvoice.city; hasUpdates = true; }
      if (shippingFromInvoice.state) { updateData.shipping_state = shippingFromInvoice.state; hasUpdates = true; }
      if (shippingFromInvoice.zip) { updateData.shipping_zip = shippingFromInvoice.zip; hasUpdates = true; }
      if (shippingFromInvoice.country) { updateData.shipping_country = shippingFromInvoice.country; hasUpdates = true; }
    }

    if (customerEmail) { updateData.email = customerEmail; hasUpdates = true; }
    if (customerPhone) { updateData.phone = customerPhone; hasUpdates = true; }
    if (invoice.contact?.fullName) { updateData.contact_name = invoice.contact.fullName; hasUpdates = true; }
    if (printavoCustomerId) { updateData.printavo_customer_id = printavoCustomerId; hasUpdates = true; }

    if (hasUpdates) {
      await supabase
        .from('customers')
        .update(updateData)
        .eq('id', existingCustomer.id);
      console.log('Updated existing customer:', customerName, 'with new data');
    }

    return { id: existingCustomer.id, details: customerDetails };
  }

  const customerData: any = {
    company_name: customerName,
    contact_name: invoice.contact?.fullName,
    email: customerEmail,
    phone: customerPhone,
    printavo_customer_id: printavoCustomerId,
    status: 'active',
  };

  const billingFromCustomer = customerDetails?.billingAddress || invoice.contact?.customer?.billingAddress;
  const billingFromInvoice = invoice.billingAddress;

  if (billingFromCustomer && (billingFromCustomer.address1 || billingFromCustomer.city)) {
    customerData.billing_address_line1 = billingFromCustomer.address1;
    customerData.billing_address_line2 = billingFromCustomer.address2;
    customerData.billing_city = billingFromCustomer.city;
    customerData.billing_state = billingFromCustomer.state;
    customerData.billing_zip = billingFromCustomer.postalCode;
    customerData.billing_country = billingFromCustomer.country || 'USA';
  } else if (billingFromInvoice && (billingFromInvoice.address1 || billingFromInvoice.city)) {
    customerData.billing_address_line1 = billingFromInvoice.address1;
    customerData.billing_address_line2 = billingFromInvoice.address2;
    customerData.billing_city = billingFromInvoice.city;
    customerData.billing_state = billingFromInvoice.state;
    customerData.billing_zip = billingFromInvoice.zip;
    customerData.billing_country = billingFromInvoice.country || 'USA';
  }

  const shippingFromCustomer = customerDetails?.shippingAddress || invoice.contact?.customer?.shippingAddress;
  const shippingFromInvoice = invoice.shippingAddress;

  if (shippingFromCustomer && (shippingFromCustomer.address1 || shippingFromCustomer.city)) {
    customerData.shipping_address_line1 = shippingFromCustomer.address1;
    customerData.shipping_address_line2 = shippingFromCustomer.address2;
    customerData.shipping_city = shippingFromCustomer.city;
    customerData.shipping_state = shippingFromCustomer.state;
    customerData.shipping_zip = shippingFromCustomer.postalCode;
    customerData.shipping_country = shippingFromCustomer.country || 'USA';
  } else if (shippingFromInvoice && (shippingFromInvoice.address1 || shippingFromInvoice.city)) {
    customerData.shipping_address_line1 = shippingFromInvoice.address1;
    customerData.shipping_address_line2 = shippingFromInvoice.address2;
    customerData.shipping_city = shippingFromInvoice.city;
    customerData.shipping_state = shippingFromInvoice.state;
    customerData.shipping_zip = shippingFromInvoice.zip;
    customerData.shipping_country = shippingFromInvoice.country || 'USA';
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

  console.log('Created new customer:', customerName, 'with ID:', newCustomer.id);
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

  const invoicesQuery = `
    query GetInvoices($after: String, $first: Int = 7, $paymentStatus: OrderPaymentStatus) {
      invoices(after: $after, first: $first, paymentStatus: $paymentStatus) {
        edges {
          node {
            id
            visualId
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
              phone
              customer {
                id
                companyName
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
            billingAddress {
              address1
              address2
              city
              state
              zip
              country
            }
            shippingAddress {
              address1
              address2
              city
              state
              zip
              country
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

  const recentInvoicesQuery = `
    query GetRecentInvoices($after: String, $first: Int = 7) {
      invoices(after: $after, first: $first, sortDescending: true) {
        edges {
          node {
            id
            visualId
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
              phone
              customer {
                id
                companyName
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
            billingAddress {
              address1
              address2
              city
              state
              zip
              country
            }
            shippingAddress {
              address1
              address2
              city
              state
              zip
              country
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
            contact: invoice.contact,
            billingAddress: invoice.billingAddress,
            shippingAddress: invoice.shippingAddress,
          }, null, 2));
        }

        const { id: customerId, details: customerDetails } = await findOrCreateCustomer(supabase, invoice, printavoEmail, printavoToken);

        const amountOutstanding = invoice.amountOutstanding || 0;
        let statusStage = 'billing_queue';
        if (amountOutstanding === 0 && invoice.paidInFull) {
          statusStage = 'paid';
        } else if (amountOutstanding > 0) {
          statusStage = 'accounts_receivable';
        }

        const phoneNumber = customerDetails?.primaryContact?.phone ||
                           invoice.contact?.customer?.primaryContact?.phone ||
                           invoice.contact?.phone ||
                           '';

        const billingFromCustomer = customerDetails?.billingAddress || invoice.contact?.customer?.billingAddress;
        const billingFromInvoice = invoice.billingAddress;
        let billingAddress = null;

        if (billingFromCustomer && (billingFromCustomer.address1 || billingFromCustomer.city)) {
          billingAddress = {
            line1: billingFromCustomer.address1 || '',
            line2: billingFromCustomer.address2 || '',
            city: billingFromCustomer.city || '',
            state: billingFromCustomer.state || '',
            zip: billingFromCustomer.postalCode || '',
            country: billingFromCustomer.country || 'USA',
          };
        } else if (billingFromInvoice && (billingFromInvoice.address1 || billingFromInvoice.city)) {
          billingAddress = {
            line1: billingFromInvoice.address1 || '',
            line2: billingFromInvoice.address2 || '',
            city: billingFromInvoice.city || '',
            state: billingFromInvoice.state || '',
            zip: billingFromInvoice.zip || '',
            country: billingFromInvoice.country || 'USA',
          };
        }

        const shippingFromCustomer = customerDetails?.shippingAddress || invoice.contact?.customer?.shippingAddress;
        const shippingFromInvoice = invoice.shippingAddress;
        let shippingAddress = null;

        if (shippingFromCustomer && (shippingFromCustomer.address1 || shippingFromCustomer.city)) {
          shippingAddress = {
            line1: shippingFromCustomer.address1 || '',
            line2: shippingFromCustomer.address2 || '',
            city: shippingFromCustomer.city || '',
            state: shippingFromCustomer.state || '',
            zip: shippingFromCustomer.postalCode || '',
            country: shippingFromCustomer.country || 'USA',
          };
        } else if (shippingFromInvoice && (shippingFromInvoice.address1 || shippingFromInvoice.city)) {
          shippingAddress = {
            line1: shippingFromInvoice.address1 || '',
            line2: shippingFromInvoice.address2 || '',
            city: shippingFromInvoice.city || '',
            state: shippingFromInvoice.state || '',
            zip: shippingFromInvoice.zip || '',
            country: shippingFromInvoice.country || 'USA',
          };
        }

        batchBuffer.push({
          id: invoice.id,
          invoice_number: invoice.visualId,
          customer_id: customerId,
          customer_email: invoice.contact?.email || '',
          customer_phone: phoneNumber,
          customer_name: invoice.contact?.fullName || invoice.contact?.customer?.companyName || '',
          customer_company: invoice.contact?.customer?.companyName || '',
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
                customer_name: invoice.contact?.fullName || invoice.contact?.customer?.companyName,
                customer_email: invoice.contact?.email,
                customer_company: invoice.contact?.customer?.companyName,
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
                customer_name: invoice.contact?.fullName || invoice.contact?.customer?.companyName,
                customer_email: invoice.contact?.email,
                customer_company: invoice.contact?.customer?.companyName,
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
      const { id: customerId, details: customerDetails } = await findOrCreateCustomer(supabase, invoice, printavoEmail, printavoToken);

      const amountOutstanding = invoice.amountOutstanding || 0;
      let statusStage = 'billing_queue';
      if (amountOutstanding === 0 && invoice.paidInFull) {
        statusStage = 'paid';
      } else if (amountOutstanding > 0) {
        statusStage = 'accounts_receivable';
      }

      const phoneNumber = customerDetails?.primaryContact?.phone ||
                         invoice.contact?.customer?.primaryContact?.phone ||
                         invoice.contact?.phone ||
                         '';

      const billingFromCustomer = customerDetails?.billingAddress || invoice.contact?.customer?.billingAddress;
      const billingFromInvoice = invoice.billingAddress;
      let billingAddress = null;

      if (billingFromCustomer && (billingFromCustomer.address1 || billingFromCustomer.city)) {
        billingAddress = {
          line1: billingFromCustomer.address1 || '',
          line2: billingFromCustomer.address2 || '',
          city: billingFromCustomer.city || '',
          state: billingFromCustomer.state || '',
          zip: billingFromCustomer.postalCode || '',
          country: billingFromCustomer.country || 'USA',
        };
      } else if (billingFromInvoice && (billingFromInvoice.address1 || billingFromInvoice.city)) {
        billingAddress = {
          line1: billingFromInvoice.address1 || '',
          line2: billingFromInvoice.address2 || '',
          city: billingFromInvoice.city || '',
          state: billingFromInvoice.state || '',
          zip: billingFromInvoice.zip || '',
          country: billingFromInvoice.country || 'USA',
        };
      }

      const shippingFromCustomer = customerDetails?.shippingAddress || invoice.contact?.customer?.shippingAddress;
      const shippingFromInvoice = invoice.shippingAddress;
      let shippingAddress = null;

      if (shippingFromCustomer && (shippingFromCustomer.address1 || shippingFromCustomer.city)) {
        shippingAddress = {
          line1: shippingFromCustomer.address1 || '',
          line2: shippingFromCustomer.address2 || '',
          city: shippingFromCustomer.city || '',
          state: shippingFromCustomer.state || '',
          zip: shippingFromCustomer.postalCode || '',
          country: shippingFromCustomer.country || 'USA',
        };
      } else if (shippingFromInvoice && (shippingFromInvoice.address1 || shippingFromInvoice.city)) {
        shippingAddress = {
          line1: shippingFromInvoice.address1 || '',
          line2: shippingFromInvoice.address2 || '',
          city: shippingFromInvoice.city || '',
          state: shippingFromInvoice.state || '',
          zip: shippingFromInvoice.zip || '',
          country: shippingFromInvoice.country || 'USA',
        };
      }

      batchBuffer.push({
        id: invoice.id,
        invoice_number: invoice.visualId,
        customer_id: customerId,
        customer_email: invoice.contact?.email || '',
        customer_phone: phoneNumber,
        customer_name: invoice.contact?.fullName || invoice.contact?.customer?.companyName || '',
        customer_company: invoice.contact?.customer?.companyName || '',
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
              customer_name: invoice.contact?.fullName || invoice.contact?.customer?.companyName,
              customer_email: invoice.contact?.email,
              customer_company: invoice.contact?.customer?.companyName,
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
              customer_name: invoice.contact?.fullName || invoice.contact?.customer?.companyName,
              customer_email: invoice.contact?.email,
              customer_company: invoice.contact?.customer?.companyName,
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
