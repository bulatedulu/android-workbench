import { describe, it, expect } from 'vitest';
import { statusMessage, NO_STORE_MESSAGE, NO_COMMAND_MESSAGE } from './messages';

describe('statusMessage', () => {
    it('存储与命令都可用时返回 undefined', () => {
        expect(statusMessage(true, true)).toBeUndefined();
    });

    it('存储缺失时提示安装并运行 pi（无论命令是否可用）', () => {
        expect(statusMessage(false, true)).toBe(NO_STORE_MESSAGE);
        expect(statusMessage(false, false)).toBe(NO_STORE_MESSAGE);
    });

    it('仅命令缺失时提示安装 pi', () => {
        expect(statusMessage(true, false)).toBe(NO_COMMAND_MESSAGE);
    });
});
