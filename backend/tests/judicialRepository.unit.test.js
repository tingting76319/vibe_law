import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockQuery = vi.fn();
const { createJudicialRepository } = require('../src/repositories/judicialRepository');
const judicialRepository = createJudicialRepository({
  query: (...args) => mockQuery(...args)
});

describe('judicialRepository (unit)', () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });

  it('searchJudgments 應該以 ILIKE 與 limit 查詢', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ jid: 'J001' }] });
    const rows = await judicialRepository.searchJudgments('民事', 20);

    expect(rows).toHaveLength(1);
    expect(mockQuery).toHaveBeenCalledTimes(1);
    const [, params] = mockQuery.mock.calls[0];
    expect(params).toEqual(['%民事%', 20]);
  });

  it('getJudgmentById 找不到資料時應回傳 null', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const row = await judicialRepository.getJudgmentById('UNKNOWN');
    expect(row).toBeNull();
  });

  it('getJudgmentCount 應回傳數字', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ count: 12 }] });
    const count = await judicialRepository.getJudgmentCount();
    expect(count).toBe(12);
  });

  it('getJudgmentChangelog 應該帶入 limit 與 offset', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ jid: 'J001' }] });
    const rows = await judicialRepository.getJudgmentChangelog(10, 5);
    expect(rows).toHaveLength(1);
    const [, params] = mockQuery.mock.calls[0];
    expect(params).toEqual([10, 5]);
  });
});
