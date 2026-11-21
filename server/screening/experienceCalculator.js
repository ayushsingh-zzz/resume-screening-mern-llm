
const MONTHS = {
  january: 0, jan: 0,
  february: 1, feb: 1,
  march: 2, mar: 2,
  april: 3, apr: 3,
  may: 4,
  june: 5, jun: 5,
  july: 6, jul: 6,
  august: 7, aug: 7,
  september: 8, sep: 8, sept: 8,
  october: 9, oct: 9,
  november: 10, nov: 10,
  december: 11, dec: 11
};

function parseMonthYear(value) {
  if (typeof value !== 'string' || !value.trim()) {
    return null;
  }

  const input = value.trim().toLowerCase();

  let match = input.match(/^(\d{4})-(\d{1,2})$/);

  if (match) {
    const year = Number(match[1]);
    const month = Number(match[2]);

    if (month < 1 || month > 12) return null;

    return year * 12 + month - 1;
  }

  match = input.match(/^(\d{1,2})\/(\d{4})$/);

  if (match) {
    const month = Number(match[1]);
    const year = Number(match[2]);

    if (month < 1 || month > 12) return null;

    return year * 12 + month - 1;
  }

  match = input.match(/^([a-z]+)\s+(\d{4})$/);

  if (match && MONTHS[match[1]] !== undefined) {
    return Number(match[2]) * 12 + MONTHS[match[1]];
  }

  match = input.match(/^(\d{4})$/);

  if (match) {
    return Number(match[1]) * 12;
  }

  return null;
}

function mergeIntervals(intervals) {
  if (intervals.length === 0) return [];

  const sorted = [...intervals].sort(
    (a, b) => a.start - b.start
  );

  const merged = [{ ...sorted[0] }];

  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i];
    const previous = merged[merged.length - 1];

    if (current.start <= previous.end + 1) {
      previous.end = Math.max(previous.end, current.end);
    } else {
      merged.push({ ...current });
    }
  }

  return merged;
}

function calculateExperience(workExperience, asOfMonth) {
  if (!Array.isArray(workExperience)) {
    throw new Error('Work experience must be an array.');
  }

  const validIntervals = [];
  const unverifiedRecords = [];

  workExperience.forEach((job, index) => {
    const start = parseMonthYear(job.start_date);

    const end = job.is_current
      ? asOfMonth
      : parseMonthYear(job.end_date);

    if (
      start === null ||
      end === null ||
      end < start
    ) {
      unverifiedRecords.push({
        index,
        role: job.role,
        company: job.company,
        reason: 'Missing or invalid employment dates.'
      });

      return;
    }

    validIntervals.push({ start, end });
  });

  const mergedIntervals = mergeIntervals(validIntervals);

  const totalMonths = mergedIntervals.reduce(
    (total, interval) =>
      total + interval.end - interval.start + 1,
    0
  );

  return {
    total_months: totalMonths,
    total_years: Number((totalMonths / 12).toFixed(2)),
    verified_records: validIntervals.length,
    unverified_records: unverifiedRecords,
    merged_intervals: mergedIntervals
  };
}

module.exports = {
  parseMonthYear,
  mergeIntervals,
  calculateExperience
};
