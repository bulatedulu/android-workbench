import { describe, it, expect, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { FileTagsStore } from './tagsStore';

let tmp: string | undefined;

function makeStorePath(): string {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tags-'));
    return path.join(tmp, 'tags.json');
}

afterEach(() => {
    if (tmp) {
        fs.rmSync(tmp, { recursive: true, force: true });
        tmp = undefined;
    }
});

describe('FileTagsStore', () => {
    it('默认无标签', () => {
        expect(new FileTagsStore(makeStorePath()).get('D:\\x')).toEqual([]);
    });

    it('set 后可读取，按路径隔离', () => {
        const store = new FileTagsStore(makeStorePath());
        store.set('D:\\a', ['bug', 'urgent']);
        store.set('D:\\b', ['refactor']);
        expect(store.get('D:\\a')).toEqual(['bug', 'urgent']);
        expect(store.get('D:\\b')).toEqual(['refactor']);
    });

    it('持久化：新建 store 读同一文件仍可读到', () => {
        const file = makeStorePath();
        new FileTagsStore(file).set('D:\\a', ['bug']);
        const reloaded = new FileTagsStore(file);
        expect(reloaded.get('D:\\a')).toEqual(['bug']);
    });

    it('清空标签即删除条目', () => {
        const store = new FileTagsStore(makeStorePath());
        store.set('D:\\a', ['bug']);
        store.set('D:\\a', []);
        expect(store.get('D:\\a')).toEqual([]);
    });

    it('文件损坏时返回空', () => {
        const file = makeStorePath();
        fs.writeFileSync(file, 'not json', 'utf8');
        expect(new FileTagsStore(file).get('D:\\a')).toEqual([]);
    });
});
