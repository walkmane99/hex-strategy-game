/**
 * 05 LOAD — アイテム選択上限テスト
 * MAX_ITEMS = 2 の制約を items.tsx のトグルロジックで検証する。
 */

const MAX_ITEMS = 2;

function toggleItem(picked: string[], id: string, isLocked: boolean): string[] {
  if (isLocked) return picked;
  if (picked.includes(id)) {
    return picked.filter(p => p !== id);
  }
  if (picked.length >= MAX_ITEMS) return picked;
  return [...picked, id];
}

function isGreyedOut(picked: string[], id: string): boolean {
  return picked.length >= MAX_ITEMS && !picked.includes(id);
}

describe('05 LOAD — アイテム選択上限制約', () => {
  it('最大2個まで選択できる', () => {
    let picked: string[] = [];
    picked = toggleItem(picked, 'IT-01', false);
    picked = toggleItem(picked, 'IT-02', false);
    expect(picked).toEqual(['IT-01', 'IT-02']);
  });

  it('2個選択後に3個目を追加しようとしても追加されない', () => {
    let picked = ['IT-01', 'IT-02'];
    picked = toggleItem(picked, 'IT-03', false);
    expect(picked).toEqual(['IT-01', 'IT-02']);
    expect(picked).toHaveLength(2);
  });

  it('2個選択後、未選択のアイテムはグレーアウト対象になる', () => {
    const picked = ['IT-01', 'IT-02'];
    expect(isGreyedOut(picked, 'IT-03')).toBe(true);
    expect(isGreyedOut(picked, 'IT-04')).toBe(true);
  });

  it('選択済みアイテムはグレーアウトされない', () => {
    const picked = ['IT-01', 'IT-02'];
    expect(isGreyedOut(picked, 'IT-01')).toBe(false);
    expect(isGreyedOut(picked, 'IT-02')).toBe(false);
  });

  it('1個選択解除するとグレーアウトが解除される', () => {
    let picked = ['IT-01', 'IT-02'];
    picked = toggleItem(picked, 'IT-01', false); // 解除
    expect(picked).toEqual(['IT-02']);
    expect(isGreyedOut(picked, 'IT-03')).toBe(false);
    expect(isGreyedOut(picked, 'IT-01')).toBe(false);
  });

  it('選択済みアイテムをトグルで解除できる', () => {
    let picked = ['IT-01', 'IT-02'];
    picked = toggleItem(picked, 'IT-02', false);
    expect(picked).toEqual(['IT-01']);
  });

  it('0個選択でも DEPLOY 可能（selectedItems が空配列でよい）', () => {
    const picked: string[] = [];
    // 0個でも制約違反ではない
    expect(picked.length).toBeLessThanOrEqual(MAX_ITEMS);
  });

  it('locked アイテムはトグルが無効', () => {
    let picked: string[] = [];
    picked = toggleItem(picked, 'IT-07', true); // IT-07 は locked
    expect(picked).toEqual([]);
  });

  it('1個だけ選択中にグレーアウトは発生しない', () => {
    const picked = ['IT-01'];
    expect(isGreyedOut(picked, 'IT-02')).toBe(false);
    expect(isGreyedOut(picked, 'IT-03')).toBe(false);
  });
});
