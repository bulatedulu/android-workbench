import { describe, it, expect, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { nextBugNumber, bugDirectoryName, resolveProjectRoot, listBugDirectories, createBugDirectory } from './issueSpace';

let tmp: string | undefined;

afterEach(() => {
    if (tmp) {
        fs.rmSync(tmp, { recursive: true, force: true });
        tmp = undefined;
    }
});

describe('nextBugNumber', () => {
    it('无已有 BUG 目录时从 1 开始', () => {
        expect(nextBugNumber([])).toBe(1);
        expect(nextBugNumber(['readme.txt'])).toBe(1);
    });

    it('按已有最大编号自增', () => {
        expect(nextBugNumber(['BUG-1'])).toBe(2);
        expect(nextBugNumber(['BUG-1', 'BUG-5', 'BUG-2'])).toBe(6);
    });

    it('忽略大小写与无关目录', () => {
        expect(nextBugNumber(['bug-3', 'BUG-1', 'OTHER'])).toBe(4);
    });
});

describe('bugDirectoryName', () => {
    it('生成 BUG-N 目录名', () => {
        expect(bugDirectoryName(3)).toBe('BUG-3');
    });
});

describe('resolveProjectRoot', () => {
    it('取工作区文件所在目录', () => {
        expect(resolveProjectRoot('D:\\bug_list\\bug_list.code-workspace')).toBe('D:\\bug_list');
    });

    it('无工作区文件时返回 undefined', () => {
        expect(resolveProjectRoot(undefined)).toBeUndefined();
    });
});

describe('listBugDirectories', () => {
    it('列出根目录下的 BUG-N 目录（含大小写），按名排序', () => {
        tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bugs-'));
        fs.mkdirSync(path.join(tmp, 'BUG-1'));
        fs.mkdirSync(path.join(tmp, 'bug-2'));
        fs.mkdirSync(path.join(tmp, 'readme'));

        expect(listBugDirectories(tmp)).toEqual(['BUG-1', 'bug-2']);
    });

    it('目录不存在返回空数组', () => {
        expect(listBugDirectories(path.join(os.tmpdir(), 'no-such-bugs-x'))).toEqual([]);
    });
});

describe('createBugDirectory', () => {
    it('创建目录并返回完整路径', () => {
        tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bugs-'));
        const dirPath = createBugDirectory(tmp, 'BUG-2');
        expect(fs.existsSync(dirPath)).toBe(true);
        expect(dirPath).toBe(path.join(tmp, 'BUG-2'));
    });

    it('目录已存在时不报错（幂等）', () => {
        tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bugs-'));
        const dir = tmp;
        fs.mkdirSync(path.join(dir, 'BUG-1'));
        expect(() => createBugDirectory(dir, 'BUG-1')).not.toThrow();
    });
});
