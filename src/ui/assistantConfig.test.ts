import { describe, it, expect, vi } from 'vitest';
import * as vscode from 'vscode';
import {
    readAssistantConfig,
    writeAssistantConfig,
    AssistantConfig,
    ASSISTANT_CONFIG_KEY,
    EMPTY_ASSISTANT_CONFIG
} from './assistantConfig';

vi.mock('vscode', () => ({}));

function makeStore(initial?: unknown): { store: vscode.Memento; data: Map<string, unknown> } {
    const data = new Map<string, unknown>();
    if (initial !== undefined) {
        data.set(ASSISTANT_CONFIG_KEY, initial);
    }
    const store = {
        get: (key: string) => data.get(key),
        update: (key: string, value: unknown) => {
            data.set(key, value);
            return Promise.resolve();
        }
    };
    return { store: store as unknown as vscode.Memento, data };
}

describe('readAssistantConfig', () => {
    it('无配置时返回空配置', () => {
        const { store } = makeStore();
        expect(readAssistantConfig(store)).toEqual(EMPTY_ASSISTANT_CONFIG);
    });

    it('读取已保存配置', () => {
        const cfg: AssistantConfig = {
            parent: 'D:\\bug_list',
            folders: ['D:\\bug_list\\BUG-1', 'D:\\bug_list\\BUG-2'],
            name: 'bug_list.code-workspace'
        };
        const { store } = makeStore(cfg);
        expect(readAssistantConfig(store)).toEqual(cfg);
    });

    it('清洗异常类型：folders 非数组/含非字符串时回退', () => {
        const { store } = makeStore({
            parent: 'D:\\x',
            folders: ['ok', 42, null],
            name: 'x.code-workspace'
        });
        const cfg = readAssistantConfig(store);
        expect(cfg.parent).toBe('D:\\x');
        expect(cfg.folders).toEqual(['ok']);
        expect(cfg.name).toBe('x.code-workspace');
    });

    it('parent 为空字符串时回退为 undefined', () => {
        const { store } = makeStore({ parent: '', folders: [], name: '' });
        expect(readAssistantConfig(store).parent).toBeUndefined();
    });
});

describe('writeAssistantConfig', () => {
    it('写入配置并持久化到 store', async () => {
        const { store, data } = makeStore();
        const cfg: AssistantConfig = {
            parent: 'D:\\bug_list',
            folders: ['D:\\bug_list\\BUG-1'],
            name: 'bug_list.code-workspace'
        };
        await writeAssistantConfig(store, cfg);
        expect(data.get(ASSISTANT_CONFIG_KEY)).toEqual(cfg);
    });
});
