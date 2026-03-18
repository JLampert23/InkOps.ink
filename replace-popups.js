#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Files to process
const filesToProcess = [
  'src/components/accounting/ARAutomationSettings.tsx',
  'src/components/accounting/ARReportBuilderModal.tsx',
  'src/components/accounting/CustomerArtworkLibrary.tsx',
  'src/components/automations/AutomationBuilder.tsx',
  'src/components/automations/AutomationsDashboard.tsx',
  'src/components/billing/BillingQueue.tsx',
  'src/components/billing/SendInvoiceModal.tsx',
  'src/components/CustomerProfiles.tsx',
  'src/components/email/CommunicationTemplatesManager.tsx',
  'src/components/portal/PortalPaymentMethods.tsx',
  'src/components/portal/PortalProofs.tsx',
  'src/components/portal/PortalQuotes.tsx',
  'src/components/production/CustomersManager.tsx',
  'src/components/production/KanbanBoard.tsx',
  'src/components/production/LabelPreviewModal.tsx',
  'src/components/production/MockupGenerator.tsx',
  'src/components/production/ProductionScheduler.tsx',
  'src/components/production/PublicQuoteApproval.tsx',
  'src/components/production/PublicQuoteApprovalPage.tsx',
  'src/components/production/QuoteBuilder.tsx',
  'src/components/production/QuoteDetail.tsx',
  'src/components/production/QuotesList.tsx',
  'src/components/production/SchedulerTabManager.tsx',
  'src/components/production/SendQuoteModal.tsx',
  'src/components/production/StripePayments.tsx',
  'src/components/production/WorkflowBuilder.tsx',
  'src/components/production/WorkflowCustomization.tsx',
  'src/components/production/WorkOrderDetail.tsx',
  'src/components/production/WorkOrdersList.tsx',
  'src/components/purchase-orders/CreatePurchaseOrder.tsx',
  'src/components/purchase-orders/POSelectionModal.tsx',
  'src/components/purchase-orders/POValidationModal.tsx',
  'src/components/purchase-orders/ProductSearchModal.tsx',
  'src/components/purchase-orders/PurchaseOrderDetail.tsx',
  'src/components/purchase-orders/PurchaseOrdersList.tsx',
  'src/components/purchase-orders/PurchaseOrdersManager.tsx',
  'src/components/purchase-orders/ReceiveGoods.tsx',
  'src/components/purchase-orders/ReceivingDashboard.tsx',
  'src/components/settings/CustomInvoiceStatusManager.tsx',
  'src/components/settings/KanbanSettings.tsx',
  'src/components/settings/POSettings.tsx',
];

function addImportsIfNeeded(content, filePath) {
  const hasNotification = content.includes('useNotification');
  const hasConfirmation = content.includes('useConfirmation');

  const needsNotification = content.match(/alert\(/);
  const needsConfirmation = content.match(/confirm\(/);

  let newContent = content;

  // Add useNotification import if needed and not present
  if (needsNotification && !hasNotification) {
    newContent = newContent.replace(
      /(import.*from\s+['"].*Context['"];?\n)/,
      "$1import { useNotification } from '../../contexts/NotificationContext';\n"
    );
    if (newContent === content) {
      // Try another pattern
      newContent = newContent.replace(
        /(import\s+{[^}]+}\s+from\s+['"]lucide-react['"];?\n)/,
        "$1import { useNotification } from '../../contexts/NotificationContext';\n"
      );
    }
  }

  // Add useConfirmation import if needed and not present
  if (needsConfirmation && !hasConfirmation) {
    newContent = newContent.replace(
      /(import.*from\s+['"].*Context['"];?\n)/,
      "$1import { useConfirmation } from '../../contexts/ConfirmationContext';\n"
    );
    if (newContent === content) {
      // Try another pattern
      newContent = newContent.replace(
        /(import\s+{[^}]+}\s+from\s+['"]lucide-react['"];?\n)/,
        "$1import { useConfirmation } from '../../contexts/ConfirmationContext';\n"
      );
    }
  }

  return newContent;
}

function addHooksToComponent(content) {
  let newContent = content;

  const needsNotification = content.match(/alert\(/);
  const needsConfirmation = content.match(/confirm\(/);
  const hasNotificationHook = content.match(/const\s+{[^}]*showNotification[^}]*}\s*=\s*useNotification\(\)/);
  const hasConfirmationHook = content.match(/const\s+{[^}]*confirm[^}]*}\s*=\s*useConfirmation\(\)/);

  // Find the component function start
  const componentMatch = content.match(/(export\s+(?:default\s+)?function\s+\w+[^{]*{[\s\n]+)/);
  if (!componentMatch) return content;

  const insertPoint = componentMatch[0];
  let hooksToAdd = [];

  if (needsNotification && !hasNotificationHook) {
    hooksToAdd.push("  const { showNotification } = useNotification();");
  }

  if (needsConfirmation && !hasConfirmationHook) {
    hooksToAdd.push("  const { confirm } = useConfirmation();");
  }

  if (hooksToAdd.length > 0) {
    newContent = newContent.replace(
      insertPoint,
      insertPoint + hooksToAdd.join('\n') + '\n'
    );
  }

  return newContent;
}

function replaceAlerts(content) {
  let newContent = content;

  // Replace success alerts
  newContent = newContent.replace(
    /alert\(((['"`])([^'"`]*success[^'"`]*)\2)\);?/gi,
    "showNotification('success', $1);"
  );

  // Replace error alerts with template literals
  newContent = newContent.replace(
    /alert\(([^)]+\.message\s*\|\|\s*(['"`])([^'"`]+)\2)\);?/g,
    "showNotification('error', $3, $1.split(' || ')[0]);"
  );

  // Replace simple error alerts
  newContent = newContent.replace(
    /alert\(((['"`])(?:Error|Failed|Cannot|Unable)[^'"`]*\2)\);?/gi,
    "showNotification('error', $1);"
  );

  // Replace remaining alerts as info
  newContent = newContent.replace(
    /alert\(((['"`])[^'"`]+\2)\);?/g,
    "showNotification('info', $1);"
  );

  return newContent;
}

function replaceConfirms(content) {
  let newContent = content;

  // Replace if (!confirm(...)) return patterns
  newContent = newContent.replace(
    /if\s*\(\s*!confirm\(((['"`])([^'"`]+)\2)\)\s*\)\s*return;?/g,
    `const confirmed = await confirm({ title: 'Confirm Action', message: $1, variant: 'warning' });\n    if (!confirmed) return;`
  );

  // Replace if (confirm(...)) {...} patterns
  newContent = newContent.replace(
    /if\s*\(\s*confirm\(((['"`])([^'"`]+)\2)\)\s*\)\s*{/g,
    `const confirmed = await confirm({ title: 'Confirm Action', message: $1, variant: 'warning' });\n    if (confirmed) {`
  );

  // Replace standalone confirms
  newContent = newContent.replace(
    /const\s+(\w+)\s*=\s*confirm\(((['"`])([^'"`]+)\2)\);?/g,
    `const $1 = await confirm({ title: 'Confirm Action', message: $2, variant: 'warning' });`
  );

  return newContent;
}

function makeAsyncIfNeeded(content) {
  // If we added confirm or prompt calls, make handlers async
  if (content.includes('await confirm') || content.includes('await prompt')) {
    // Find function handlers that aren't already async
    content = content.replace(
      /(const\s+\w+\s*=\s*)\(([^)]*)\)\s*=>\s*{/g,
      (match, prefix, params) => {
        if (match.includes('async')) return match;
        return `${prefix}async (${params}) => {`;
      }
    );

    content = content.replace(
      /(function\s+\w+\s*)\(([^)]*)\)\s*{/g,
      (match, prefix, params) => {
        if (match.includes('async')) return match;
        return `${prefix}async (${params}) {`;
      }
    );
  }

  return content;
}

function processFile(filePath) {
  const fullPath = path.join(process.cwd(), filePath);

  if (!fs.existsSync(fullPath)) {
    console.log(`Skipping ${filePath} (not found)`);
    return;
  }

  let content = fs.readFileSync(fullPath, 'utf8');
  const original = content;

  // Step 1: Add imports
  content = addImportsIfNeeded(content, filePath);

  // Step 2: Add hooks to component
  content = addHooksToComponent(content);

  // Step 3: Replace alerts
  content = replaceAlerts(content);

  // Step 4: Replace confirms
  content = replaceConfirms(content);

  // Step 5: Make functions async if needed
  content = makeAsyncIfNeeded(content);

  if (content !== original) {
    fs.writeFileSync(fullPath, content, 'utf8');
    console.log(`✓ Processed ${filePath}`);
  } else {
    console.log(`- No changes needed for ${filePath}`);
  }
}

// Process all files
console.log('Starting batch replacement of popups...\n');
filesToProcess.forEach(processFile);
console.log('\nDone!');
