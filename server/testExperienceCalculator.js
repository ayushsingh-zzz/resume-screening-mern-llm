
const {
  parseMonthYear,
  calculateExperience
} = require('./screening/experienceCalculator');

const asOfMonth = parseMonthYear('November 2026');

function test(name, records, expectedMonths) {
  const result = calculateExperience(records, asOfMonth);

  const passed = result.total_months === expectedMonths;

  console.log(
    `${passed ? 'PASS' : 'FAIL'}: ${name} | Expected: ${expectedMonths}, Actual: ${result.total_months}`
  );

  if (!passed) {
    console.log(JSON.stringify(result, null, 2));
  }
}

// 1. Normal employment
test('One year employment', [
  {
    role: 'Developer',
    company: 'A',
    start_date: 'January 2023',
    end_date: 'December 2023',
    is_current: false
  }
], 12);

// 2. Overlapping employment
test('Overlapping employment', [
  {
    role: 'Developer',
    company: 'A',
    start_date: 'January 2023',
    end_date: 'December 2024',
    is_current: false
  },
  {
    role: 'Developer',
    company: 'B',
    start_date: 'January 2024',
    end_date: 'December 2024',
    is_current: false
  }
], 24);

// 3. Current employment
test('Current employment', [
  {
    role: 'Developer',
    company: 'A',
    start_date: 'January 2026',
    end_date: '',
    is_current: true
  }
], 11);

// 4. Missing dates
const missingDateResult = calculateExperience([
  {
    role: 'Developer',
    company: 'A',
    start_date: '',
    end_date: '',
    is_current: false
  }
], asOfMonth);

console.log(
  missingDateResult.unverified_records.length === 1
    ? 'PASS: Missing dates flagged'
    : 'FAIL: Missing dates not flagged'
);

// 5. Invalid date range
const invalidResult = calculateExperience([
  {
    role: 'Developer',
    company: 'A',
    start_date: 'December 2024',
    end_date: 'January 2024',
    is_current: false
  }
], asOfMonth);

console.log(
  invalidResult.unverified_records.length === 1
    ? 'PASS: Invalid date range flagged'
    : 'FAIL: Invalid date range not flagged'
);

// 6. Empty employment
test('No employment records', [], 0);
