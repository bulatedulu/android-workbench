import * as vscode from 'vscode';

/** 侧边栏助手引导配置（父目录 + 勾选子文件夹 + 工作区文件名）。 */
export interface AssistantConfig {
    parent?: string;
    folders: string[];
    name: string;
}

export const ASSISTANT_CONFIG_KEY = 'aiWorkbench.assistantConfig';

export const EMPTY_ASSISTANT_CONFIG: AssistantConfig = { parent: undefined, folders: [], name: '' };

/** 读取引导配置（清洗类型；无配置或格式异常时回退为空配置）。 */
export function readAssistantConfig(store: vscode.Memento): AssistantConfig {
    const raw = store.get<Partial<AssistantConfig>>(ASSISTANT_CONFIG_KEY);
    if (!raw || typeof raw !== 'object') {
        return { ...EMPTY_ASSISTANT_CONFIG };
    }
    return {
        parent: typeof raw.parent === 'string' && raw.parent.length > 0 ? raw.parent : undefined,
        folders: Array.isArray(raw.folders)
            ? raw.folders.filter((f): f is string => typeof f === 'string')
            : [],
        name: typeof raw.name === 'string' ? raw.name : ''
    };
}

/** 写入引导配置。 */
export function writeAssistantConfig(store: vscode.Memento, config: AssistantConfig): Thenable<void> {
    return store.update(ASSISTANT_CONFIG_KEY, config);
}
