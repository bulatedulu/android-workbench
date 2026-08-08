import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { Session } from '../domain/session';
import { AgentProvider } from './provider';

const MAX_TITLE = 50;

/**
 * pi 会话提供者：扫描 ~/.pi/agent/sessions 下的 JSONL 文件。
 * 读取走直接解析 JSONL（含版本头，容忍版本迁移），绝不修改 pi 的存储（见 ADR-0001）。
 * storeRoot 可注入，便于测试用临时目录。
 */
export class PiProvider implements AgentProvider {
    readonly agentName = 'pi';

    constructor(private readonly storeRoot?: string) {}

    discoverStore(): string | undefined {
        const root = this.storeRoot ?? path.join(os.homedir(), '.pi', 'agent', 'sessions');
        return fs.existsSync(root) ? root : undefined;
    }

    scanSessions(): Session[] {
        const root = this.discoverStore();
        if (!root) {
            return [];
        }
        const sessions: Session[] = [];
        for (const file of findJsonlFiles(root)) {
            const session = parseSessionFile(file);
            if (session) {
                sessions.push(session);
            }
        }
        return sessions;
    }
}

function findJsonlFiles(root: string): string[] {
    const files: string[] = [];
    const walk = (dir: string): void => {
        let entries;
        try {
            entries = fs.readdirSync(dir, { withFileTypes: true });
        } catch {
            return;
        }
        for (const entry of entries) {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                walk(full);
            } else if (entry.isFile() && entry.name.endsWith('.jsonl')) {
                files.push(full);
            }
        }
    };
    walk(root);
    return files;
}

/** 解析单个 pi 会话文件；文件不可读或无有效头部时返回 undefined。 */
function parseSessionFile(filePath: string): Session | undefined {
    let content: string;
    try {
        content = fs.readFileSync(filePath, 'utf8');
    } catch {
        return undefined;
    }

    let id: string | undefined;
    let cwd: string | undefined;
    let timestamp: string | undefined;
    let title: string | undefined;
    let model: string | undefined;

    // 扫描完整文件：标题取首个用户消息，模型取最后出现的模型信息。
    for (const line of content.split(/\r?\n/)) {
        if (!line.trim()) {
            continue;
        }
        let obj: Record<string, unknown>;
        try {
            obj = JSON.parse(line) as Record<string, unknown>;
        } catch {
            continue; // 容忍个别损坏行
        }
        if (obj.type === 'session') {
            id = String(obj.id ?? '');
            cwd = typeof obj.cwd === 'string' ? obj.cwd : undefined;
            timestamp = typeof obj.timestamp === 'string' ? obj.timestamp : undefined;
        } else if (obj.type === 'message') {
            const message = obj.message as { role?: string; content?: unknown; model?: string } | undefined;
            if (message?.role === 'user' && title === undefined) {
                title = extractText(message.content);
            }
            if (typeof message?.model === 'string') {
                model = message.model;
            }
        } else if (obj.type === 'model_change') {
            if (typeof obj.modelId === 'string') {
                model = obj.modelId;
            }
        }
    }

    if (!id) {
        return undefined;
    }

    const parsed = Date.parse(timestamp ?? '');
    let createdAt = Number.isNaN(parsed) ? undefined : parsed;
    if (createdAt === undefined) {
        try {
            createdAt = fs.statSync(filePath).mtimeMs;
        } catch {
            createdAt = 0;
        }
    }

    return {
        id,
        agent: 'pi',
        path: filePath,
        cwd: cwd ?? '',
        title: title ?? '无标题会话',
        model: model ?? undefined,
        createdAt
    };
}

function extractText(content: unknown): string | undefined {
    let text: string | undefined;
    if (typeof content === 'string') {
        // 兼容旧版 pi：content 可能是纯字符串
        text = content.trim();
    } else if (Array.isArray(content)) {
        text = content
            .filter((part): part is { text?: string } => typeof part === 'object' && part !== null && 'text' in part)
            .map((part) => part.text ?? '')
            .join(' ')
            .replace(/\s+/g, ' ')
            .trim();
    }
    if (!text) {
        return undefined;
    }
    return text.length > MAX_TITLE ? text.slice(0, MAX_TITLE) + '…' : text;
}
