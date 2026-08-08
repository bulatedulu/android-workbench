import { describe, it, expect } from 'vitest';
import { ProjectRegistry, ProjectStore, Project } from './project';

class MemoryStore implements ProjectStore {
  private data: Project[] = [];
  load(): Project[] {
    return this.data;
  }
  save(projects: Project[]): void {
    this.data = projects;
  }
}

describe('ProjectRegistry', () => {
  it('添加项目后可以在列表中看到它', () => {
    const store = new MemoryStore();
    const registry = new ProjectRegistry(store);

    const project = registry.add({ name: '示例项目', path: 'D:\\work\\demo' });

    const list = registry.list();
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe(project.id);
    expect(list[0].name).toBe('示例项目');
    expect(list[0].path).toBe('D:\\work\\demo');
    expect(list[0].tags).toEqual([]);
  });

  it('项目通过存储持久化：模拟重启后仍然存在', () => {
    const store = new MemoryStore();
    const registry = new ProjectRegistry(store);
    registry.add({ name: '示例项目', path: 'D:\\work\\demo' });

    const restarted = new ProjectRegistry(store);
    const list = restarted.list();
    expect(list).toHaveLength(1);
    expect(list[0].name).toBe('示例项目');
    expect(list[0].path).toBe('D:\\work\\demo');
  });

  it('可以更新项目的名称和标签，且更新会持久化', () => {
    const store = new MemoryStore();
    const registry = new ProjectRegistry(store);
    const project = registry.add({ name: '示例项目', path: 'D:\\work\\demo', tags: ['a'] });

    const updated = registry.update(project.id, { name: '新名称', tags: ['x', 'y'] });

    expect(updated?.name).toBe('新名称');
    expect(updated?.tags).toEqual(['x', 'y']);
    const restarted = new ProjectRegistry(store);
    expect(restarted.list()[0].name).toBe('新名称');
    expect(restarted.list()[0].tags).toEqual(['x', 'y']);
  });

  it('更新不存在的项目返回 undefined', () => {
    const registry = new ProjectRegistry(new MemoryStore());
    expect(registry.update('no-such-id', { name: 'x' })).toBeUndefined();
  });

  it('可以删除项目，且删除会持久化', () => {
    const store = new MemoryStore();
    const registry = new ProjectRegistry(store);
    const project = registry.add({ name: '示例项目', path: 'D:\\work\\demo' });
    const other = registry.add({ name: '另一个', path: 'D:\\work\\other' });

    const removed = registry.remove(project.id);

    expect(removed).toBe(true);
    expect(registry.list()).toHaveLength(1);
    expect(registry.list()[0].id).toBe(other.id);
    const restarted = new ProjectRegistry(store);
    expect(restarted.list()).toHaveLength(1);
    expect(restarted.list()[0].id).toBe(other.id);
  });

  it('删除不存在的项目返回 false', () => {
    const registry = new ProjectRegistry(new MemoryStore());
    expect(registry.remove('no-such-id')).toBe(false);
  });

  it('拒绝注册重复的项目路径，并保持原列表不变', () => {
    const registry = new ProjectRegistry(new MemoryStore());
    registry.add({ name: '示例项目', path: 'D:\\work\\demo' });

    expect(() => registry.add({ name: '重复项目', path: 'D:\\work\\demo' })).toThrow(/已注册/);
    expect(registry.list()).toHaveLength(1);
  });

  it('拒绝空名称的项目', () => {
    const registry = new ProjectRegistry(new MemoryStore());
    expect(() => registry.add({ name: '   ', path: 'D:\\work\\x' })).toThrow(/名称不能为空/);
  });

  it('拒绝把名称更新为空', () => {
    const registry = new ProjectRegistry(new MemoryStore());
    const project = registry.add({ name: '示例', path: 'D:\\work\\x' });
    expect(() => registry.update(project.id, { name: '  ' })).toThrow(/名称不能为空/);
    expect(registry.list()[0].name).toBe('示例');
  });

  it.skipIf(process.platform !== 'win32')('在 Windows 上拒绝大小写不同的重复路径', () => {
    const registry = new ProjectRegistry(new MemoryStore());
    registry.add({ name: 'A', path: 'D:\\Work\\Demo' });
    expect(() => registry.add({ name: 'B', path: 'd:\\work\\demo' })).toThrow(/已注册/);
  });
});
