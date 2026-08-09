import { describe, it, expect } from 'vitest';
import { projectFromPath } from './project';

describe('projectFromPath', () => {
    it('名称取文件夹名', () => {
        expect(projectFromPath('D:\\bug_list\\BUG-1').name).toBe('BUG-1');
        expect(projectFromPath('/home/user/proj').name).toBe('proj');
    });

    it('路径为根时名称回退为路径本身', () => {
        expect(projectFromPath('C:\\').name).toBe('C:\\');
    });

    it('携带标签副本（不受外部改动影响）', () => {
        const tags = ['bug'];
        const p = projectFromPath('D:\\x', tags);
        tags.push('extra');
        expect(p.tags).toEqual(['bug']);
    });
});
