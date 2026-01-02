import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const PRINTAVO_API_URL = "https://www.printavo.com/api/v2";
const DELAY_BETWEEN_REQUESTS = 50;
const PAGE_SIZE = 25;
const BATCH_SIZE = 50;
const MAX_RETRIES = 3;
const MIN_INVOICE_DATE = "2025-01-01T00:00:00Z";
const RECENT_DAYS_LOOKBACK = 30;

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
    customer?: {
      id?: string;
      companyName?: string;
    };
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

async function syncInvoices(
  supabase: any,
  printavoEmail: string,
  printavoToken: string
) {
  const invoicesQuery = `
    query GetInvoices($after: String, $first: Int = 10, $paymentStatus: OrderPaymentStatus) {
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
              customer {
                id
                companyName
              }
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
    query GetRecentInvoices($after: String, $first: Int = 10) {
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
              customer {
                id
                companyName
              }
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
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - RECENT_DAYS_LOOKBACK);
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
        batchBuffer.push({
          id: invoice.id,
          invoice_number: invoice.visualId,
          customer_email: invoice.contact?.email,
          customer_name: invoice.contact?.fullName,
          customer_company: invoice.contact?.customer?.companyName,
          subtotal: invoice.subtotal || 0,
          tax: invoice.salesTaxAmount || 0,
          total: invoice.total || 0,
          amount_paid: invoice.amountPaid || 0,
          amount_outstanding: invoice.amountOutstanding || 0,
          status: invoice.status?.name,
          invoice_date: invoice.createdAt,
          due_date: invoice.dueAt,
          updated_at: new Date().toISOString(),
          raw_data: invoice,
        });

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

  console.log(`Syncing recently updated invoices (last ${RECENT_DAYS_LOOKBACK} days)...`);
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
      batchBuffer.push({
        id: invoice.id,
        invoice_number: invoice.visualId,
        customer_email: invoice.contact?.email,
        customer_name: invoice.contact?.fullName,
        customer_company: invoice.contact?.customer?.companyName,
        subtotal: invoice.subtotal || 0,
        tax: invoice.salesTaxAmount || 0,
        total: invoice.total || 0,
        amount_paid: invoice.amountPaid || 0,
        amount_outstanding: invoice.amountOutstanding || 0,
        status: invoice.status?.name,
        invoice_date: invoice.createdAt,
        due_date: invoice.dueAt,
        updated_at: new Date().toISOString(),
        raw_data: invoice,
      });

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
              });            }
          }
        }
      }

      if (batchBuffer.length >= BATCH_SIZE || lineItemsBatchBuffer.length >= BATCH_SIZE * 5) {
        await flushBatch();
      }
    }

    totalInvoices += recentInvoices.length;
    console.log(`Recent - Page ${pageCount + 1}: Found ${invoices.length} invoices, ${recentInvoices.length} after ${MIN_INVOICE_DATE}`);

    if (pageCount >= 15) {
      console.log(`Fetched ${pageCount + 1} pages (${totalInvoices} invoices total), stopping quick sync`);
      break;
    }

    hasNextPage = result.data.invoices.pageInfo.hasNextPage;
    after = result.data.invoices.pageInfo.endCursor;
    pageCount++;

    if (invoices.length === 0) {
      break;
    }
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
    query GetPayments($after: String, $first: Int = 10) {
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