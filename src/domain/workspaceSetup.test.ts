import { describe, it, expect, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { buildWorkspaceFileContent, defaultWorkspaceFileName, ensureWorkspaceExtension, listSubdirectories } from './workspaceSetup';

let tmp: string | undefined;

afterEach(() => {
    if (tmp) {
        fs.rmSync(tmp, { recursive: true, force: true });
        tmp = undefined;
    }
});

describe('buildWorkspaceFileContent', () => {
    it('生成包含所选文件夹的 .code-workspace JSON', () => {
        const content = buildWorkspaceFileContent(['D:\\bug_list\\BUG-1', 'D:\\bug_list\\BUG-2']);
        const parsed = JSON.parse(content);
        expect(parsed.folders).toEqual([{ path: 'D:\\bug_list\\BUG-1' }, { path: 'D:\\bug_list\\BUG-2' }]);
    });
});

describe('defaultWorkspaceFileName', () => {
    it('默认名 = 父目录名 + .code-workspace', () => {
        expect(defaultWorkspaceFileName('D:\\bug_list')).toBe('bug_list.code-workspace');
    });

    it('路径为根时回退为 workspace', () => {
        expect(defaultWorkspaceFileName('C:\\')).toBe('workspace.code-workspace');
    });
});

describe('ensureWorkspaceExtension', () => {
    it('无后缀时补 .code-workspace', () => {
        expect(ensureWorkspaceExtension('bug_list')).toBe('bug_list.code-workspace');
    });

    it('已有后缀保持不变（大小写不敏感）', () => {
        expect(ensureWorkspaceExtension('bug_list.code-workspace')).toBe('bug_list.code-workspace');
        expect(ensureWorkspaceExtension('BUG_LIST.CODE-WORKSPACE')).toBe('BUG_LIST.CODE-WORKSPACE');
    });
});

describe('listSubdirectories', () => {
    it('只列出直接子文件夹（不含文件），按名排序', () => {
        tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ws-'));
        fs.mkdirSync(path.join(tmp, 'BUG-2'));
        fs.mkdirSync(path.join(tmp, 'BUG-1'));
        fs.writeFileSync(path.join(tmp, 'readme.txt'), 'x');

        const dirs = listSubdirectories(tmp);

        expect(dirs).toEqual([path.join(tmp, 'BUG-1'), path.join(tmp, 'BUG-2')]);
    });

    it('目录不存在返回空数组', () => {
        expect(listSubdirectories(path.join(os.tmpdir(), 'no-such-ws-xyz'))).toEqual([]);
    });
});
