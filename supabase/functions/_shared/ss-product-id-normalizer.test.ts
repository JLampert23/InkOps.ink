const VALID_SS_FOB_IDS = ['IL', 'KS', 'NJ', 'TX', 'GA', 'NV', 'DS'];

function normalizeSsProductId(input: string): string {
  if (!input) return '';

  let cleaned = input.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');

  if (cleaned.startsWith('B') && cleaned.length > 1) {
    cleaned = cleaned.substring(1);
  }

  if (cleaned.startsWith('G') && /^G\d+$/.test(cleaned)) {
    cleaned = cleaned.substring(1);
  }

  if (/^\d+$/.test(cleaned)) {
    cleaned = cleaned.padStart(5, '0');
  }

  return 'B' + cleaned;
}

function validateFobId(fobId: string | null): string {
  if (!fobId) return 'NJ';
  const upperFob = fobId.toUpperCase();
  return VALID_SS_FOB_IDS.includes(upperFob) ? upperFob : 'NJ';
}

const testCases = [
  { input: "5000", expected: "B05000", description: "Numeric style pads to 5 digits" },
  { input: "G5000", expected: "B05000", description: "G-prefix Gildan style normalizes" },
  { input: "B5000", expected: "B05000", description: "Already B-prefixed normalizes" },
  { input: "00760", expected: "B00760", description: "Already padded numeric stays padded" },
  { input: "DG536", expected: "BDG536", description: "Alphanumeric style keeps letters" },
  { input: "2000", expected: "B02000", description: "Short numeric pads correctly" },
  { input: "8000", expected: "B08000", description: "Another numeric style" },
  { input: "18500", expected: "B18500", description: "5-digit style stays 5 digits" },
  { input: "29M", expected: "B29M", description: "Alphanumeric with letter suffix" },
  { input: "64000", expected: "B64000", description: "Test style from connection test" },
  { input: "g5000", expected: "B05000", description: "Lowercase G-prefix" },
  { input: "b5000", expected: "B05000", description: "Lowercase B-prefix" },
  { input: " 5000 ", expected: "B05000", description: "Whitespace trimmed" },
  { input: "", expected: "", description: "Empty string returns empty" },
];

const fobTestCases = [
  { input: "IL", expected: "IL", description: "Valid IL stays IL" },
  { input: "KS", expected: "KS", description: "Valid KS stays KS" },
  { input: "NJ", expected: "NJ", description: "Valid NJ stays NJ" },
  { input: "TX", expected: "TX", description: "Valid TX stays TX" },
  { input: "GA", expected: "GA", description: "Valid GA stays GA" },
  { input: "NV", expected: "NV", description: "Valid NV stays NV" },
  { input: "DS", expected: "DS", description: "Valid DS stays DS" },
  { input: "il", expected: "IL", description: "Lowercase normalizes to uppercase" },
  { input: "XX", expected: "NJ", description: "Invalid FOB defaults to NJ" },
  { input: null, expected: "NJ", description: "Null defaults to NJ" },
  { input: "", expected: "NJ", description: "Empty string defaults to NJ" },
];

console.log("=== S&S ProductId Normalization Tests ===\n");

let passed = 0;
let failed = 0;

for (const tc of testCases) {
  const result = normalizeSsProductId(tc.input);
  const status = result === tc.expected ? "PASS" : "FAIL";

  if (status === "PASS") {
    passed++;
    console.log(`[${status}] "${tc.input}" -> "${result}" (${tc.description})`);
  } else {
    failed++;
    console.log(`[${status}] "${tc.input}" -> "${result}" (expected "${tc.expected}") - ${tc.description}`);
  }
}

console.log("\n=== FOB Validation Tests ===\n");

for (const tc of fobTestCases) {
  const result = validateFobId(tc.input);
  const status = result === tc.expected ? "PASS" : "FAIL";

  if (status === "PASS") {
    passed++;
    console.log(`[${status}] "${tc.input}" -> "${result}" (${tc.description})`);
  } else {
    failed++;
    console.log(`[${status}] "${tc.input}" -> "${result}" (expected "${tc.expected}") - ${tc.description}`);
  }
}

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);

if (failed > 0) {
  Deno.exit(1);
}
