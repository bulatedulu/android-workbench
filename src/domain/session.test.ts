import { describe, it, expect } from 'vitest';
import { isUnderProject } from './session';

describe('isUnderProject', () => {
    it('工作目录等于项目路径时匹配', () => {
        expect(isUnderProject('D:\\bug_list\\BUG-1', 'D:\\bug_list\\BUG-1')).toBe(true);
    });

    it('工作目录位于项目子目录时匹配', () => {
        expect(isUnderProject('D:\\bug_list\\BUG-1\\src\\core', 'D:\\bug_list\\BUG-1')).toBe(true);
    });

    it('工作目录不在项目路径下时不匹配', () => {
        expect(isUnderProject('D:\\other\\project', 'D:\\bug_list\\BUG-1')).toBe(false);
    });

    it('仅前缀相同但不是子目录时不匹配', () => {
        expect(isUnderProject('D:\\bug_list\\BUG-10', 'D:\\bug_list\\BUG-1')).toBe(false);
    });

    it('忽略结尾分隔符差异', () => {
        expect(isUnderProject('D:\\bug_list\\BUG-1', 'D:\\bug_list\\BUG-1\\')).toBe(true);
    });

    it('正斜杠与反斜杠混用时仍匹配', () => {
        expect(isUnderProject('D:/bug_list/BUG-1/src', 'D:\\bug_list\\BUG-1')).toBe(true);
    });

    it.skipIf(process.platform !== 'win32')('在 Windows 上忽略大小写', () => {
        expect(isUnderProject('d:\\BUG_LIST\\bug-1', 'D:\\bug_list\\BUG-1')).toBe(true);
    });
});
