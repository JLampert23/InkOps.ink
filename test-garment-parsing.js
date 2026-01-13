// Test garment metadata parsing

const testCases = [
  {
    description: "Gildan 5000 Black S-5, M-12, L-8, XL-3",
    expected: {
      style: "Gildan 5000",
      color: "Black",
      sizes: { S: 5, M: 12, L: 8, XL: 3 }
    }
  },
  {
    description: "BC3001 Heather Navy S(5), M(12), L(8)",
    expected: {
      style: "BC3001",
      color: "Heather Navy",
      sizes: { S: 5, M: 12, L: 8 }
    }
  },
  {
    description: "Next Level 6210 Sport Grey Small 5, Medium 12, Large 8",
    expected: {
      style: "Next Level 6210",
      color: "Sport Grey",
      sizes: { S: 5, M: 12, L: 8 }
    }
  }
];

console.log("Garment Parsing Test Cases:");
console.log("============================\n");

testCases.forEach((test, i) => {
  console.log(`Test ${i + 1}:`);
  console.log(`Input: "${test.description}"`);
  console.log(`Expected Style: ${test.expected.style}`);
  console.log(`Expected Color: ${test.expected.color}`);
  console.log(`Expected Sizes: ${JSON.stringify(test.expected.sizes)}`);
  console.log();
});
