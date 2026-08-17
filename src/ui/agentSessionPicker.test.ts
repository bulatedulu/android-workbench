import { describe, it, expect } from 'vitest';
import { fixedSessionId } from './agentSessionPicker';

describe('fixedSessionId', () => {
    it('同一目录路径生成相同 id（确定性）', () => {
        expect(fixedSessionId('C:/bug1')).toBe(fixedSessionId('C:/bug1'));
    });

    it('不同目录路径生成不同 id', () => {
        expect(fixedSessionId('C:/bug1')).not.toBe(fixedSessionId('C:/bug2'));
    });

    it('返回非空且不含路径分隔符（可作 pi session-id）', () => {
        const id = fixedSessionId('D:\\bug_list\\BUG-1');
        expect(id.length).toBeGreaterThan(0);
        expect(id).not.toMatch(/[\\/]/);
    });
});
