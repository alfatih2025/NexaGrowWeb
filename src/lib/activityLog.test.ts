import { describe, it, expect, beforeEach } from 'vitest';
import {
  getJakartaDateKey,
  formatActivityTime,
  readActivityLogs,
  writeActivityLogs,
  recordActivity,
  clearActivityLogs,
  mapActivityDayKey,
  groupActivitiesByDay,
  dedupeActivityLogs,
  sortActivityLogs,
  toCsv,
  type ActivityLogEntry,
} from './activityLog';

const STORAGE_KEY = 'nexagrow-activity-log-v1';

function makeEntry(overrides: Partial<ActivityLogEntry> = {}): ActivityLogEntry {
  return {
    id: 'id-1',
    source: 'ui',
    type: 'click',
    title: 'Title',
    message: 'Message',
    created_at: '2025-01-01T00:00:00.000Z',
    details: null,
    ...overrides,
  };
}

beforeEach(() => {
  window.localStorage.clear();
});

describe('getJakartaDateKey', () => {
  it('formats a date into an en-CA (YYYY-MM-DD) key in the Jakarta timezone', () => {
    // 2025-01-01T18:00:00Z is 2025-01-02 01:00 in Asia/Jakarta (UTC+7)
    expect(getJakartaDateKey('2025-01-01T18:00:00.000Z')).toBe('2025-01-02');
  });

  it('accepts a Date instance', () => {
    expect(getJakartaDateKey(new Date('2025-06-15T00:00:00.000Z'))).toBe('2025-06-15');
  });

  it('falls back to the current date for invalid input', () => {
    expect(getJakartaDateKey('not-a-date')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('formatActivityTime', () => {
  it('returns a formatted string for a valid date', () => {
    expect(formatActivityTime('2025-01-01T00:00:00.000Z')).not.toBe('-');
  });

  it('returns a dash for an invalid date', () => {
    expect(formatActivityTime('nope')).toBe('-');
  });
});

describe('read/write/record/clear', () => {
  it('reads an empty array when nothing is stored', () => {
    expect(readActivityLogs()).toEqual([]);
  });

  it('reads an empty array when stored JSON is corrupt', () => {
    window.localStorage.setItem(STORAGE_KEY, '{not json');
    expect(readActivityLogs()).toEqual([]);
  });

  it('writes and reads back entries', () => {
    const entries = [makeEntry()];
    writeActivityLogs(entries);
    expect(readActivityLogs()).toEqual(entries);
  });

  it('records an activity, generating id and created_at when omitted', () => {
    const entry = recordActivity({ source: 'sensor', type: 'reading', title: 'T', message: 'M' });
    expect(entry).not.toBeNull();
    expect(entry?.id).toBeTruthy();
    expect(entry?.created_at).toBeTruthy();
    expect(entry?.details).toBeNull();
    expect(readActivityLogs()).toHaveLength(1);
  });

  it('prepends newly recorded activities', () => {
    recordActivity({ id: 'first', source: 'ui', type: 't', title: 'a', message: 'm' });
    recordActivity({ id: 'second', source: 'ui', type: 't', title: 'b', message: 'm' });
    const logs = readActivityLogs();
    expect(logs[0].id).toBe('second');
    expect(logs[1].id).toBe('first');
  });

  it('clears stored logs', () => {
    writeActivityLogs([makeEntry()]);
    clearActivityLogs();
    expect(readActivityLogs()).toEqual([]);
  });
});

describe('grouping and mapping', () => {
  it('maps an entry to its Jakarta day key', () => {
    expect(mapActivityDayKey({ created_at: '2025-01-01T18:00:00.000Z' })).toBe('2025-01-02');
  });

  it('groups activities by day key', () => {
    const grouped = groupActivitiesByDay([
      makeEntry({ id: 'a', created_at: '2025-01-01T02:00:00.000Z' }),
      makeEntry({ id: 'b', created_at: '2025-01-01T05:00:00.000Z' }),
      makeEntry({ id: 'c', created_at: '2025-01-02T05:00:00.000Z' }),
    ]);
    expect(grouped['2025-01-01']).toHaveLength(2);
    expect(grouped['2025-01-02']).toHaveLength(1);
  });
});

describe('dedupeActivityLogs', () => {
  it('removes entries with identical source/type/title/message/created_at', () => {
    const base = makeEntry({ id: 'x' });
    const dup = makeEntry({ id: 'y' });
    const other = makeEntry({ id: 'z', message: 'Different' });
    const result = dedupeActivityLogs([base, dup, other]);
    expect(result).toHaveLength(2);
    expect(result.map((e) => e.id)).toEqual(['x', 'z']);
  });
});

describe('sortActivityLogs', () => {
  it('sorts newest first without mutating the input', () => {
    const input = [
      makeEntry({ id: 'old', created_at: '2025-01-01T00:00:00.000Z' }),
      makeEntry({ id: 'new', created_at: '2025-02-01T00:00:00.000Z' }),
    ];
    const result = sortActivityLogs(input);
    expect(result.map((e) => e.id)).toEqual(['new', 'old']);
    expect(input.map((e) => e.id)).toEqual(['old', 'new']);
  });
});

describe('toCsv', () => {
  it('includes a header row', () => {
    expect(toCsv([]).split('\n')[0]).toBe('created_at,source,type,title,message,details');
  });

  it('serializes details as JSON and escapes special characters', () => {
    const csv = toCsv([
      makeEntry({
        title: 'Has, comma',
        message: 'Line1\nLine2',
        details: { a: 1 },
      }),
    ]);
    const dataRow = csv.split('\n').slice(1).join('\n');
    expect(dataRow).toContain('"Has, comma"');
    expect(dataRow).toContain('"Line1\nLine2"');
    expect(dataRow).toContain('"{""a"":1}"');
  });

  it('renders an empty details column when details is null', () => {
    const csv = toCsv([makeEntry({ details: null })]);
    expect(csv.trim().endsWith(',')).toBe(true);
  });
});
