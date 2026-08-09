import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { Session, SessionContent, SessionMessage } from '../domain/session';
import { AgentProvider } from './provider';

const MAX_TITLE = 50;

/**
 * pi 会话提供者：扫描 ~/.pi/agent/sessions 下的 JSONL 文件。
 * 读取走直接解析 JSONL（含版本头，容忍版本迁移），绝不修改 pi 的存储（见 ADR-0001）。
 * storeRoot 可注入，便于测试用临时目录；commandExists 可注入，便于测试可用性判断。
 */
export class PiProvider implements AgentProvider {
    readonly agentName = 'pi';

    constructor(
        private readonly storeRoot?: string,
        private readonly commandExists: (command: string) => boolean = commandExistsOnPath
    ) {}

    discoverStore(): string | undefined {
        const root = this.storeRoot ?? path.join(os.homedir(), '.pi', 'agent', 'sessions');
        return fs.existsSync(root) ? root : undefined;
    }

    isAvailable(): boolean {
        return this.commandExists('pi');
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

    readSessionText(session: Session): string {
        return this.readSessionContent(session)
            .messages.map((m) => m.text)
            .filter((t) => t !== '')
            .join('\n');
    }

    readSessionContent(session: Session): SessionContent {
        let content: string;
        try {
            content = fs.readFileSync(session.path, 'utf8');
        } catch {
            return { messages: [] };
        }
        const messages: SessionMessage[] = [];
        forEachJsonLine(content, (obj) => {
            if (obj.type !== 'message') {
                return;
            }
            const message = obj.message as { role?: string; timestamp?: number; content?: unknown } | undefined;
            messages.push({
                role: message?.role ?? 'unknown',
                timestamp: typeof message?.timestamp === 'number' ? message.timestamp : 0,
                text: extractContentText(message?.content)
            });
        });
        return { messages };
    }

    resumeSession(session: Session, run: (command: string) => boolean): boolean {
        const escaped = session.path.replace(/"/g, '\\"');
        return run(`pi --resume "${escaped}"`);
    }
}

/** 逐行解析 JSONL，跳过空行与损坏行。 */
function forEachJsonLine(content: string, visit: (obj: Record<string, unknown>) => void): void {
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
        visit(obj);
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

/** 在 PATH 中查找命令是否存在（Windows 按 PATHEXT 尝试扩展名）。 */
function commandExistsOnPath(command: string): boolean {
    const pathEnv = process.env.PATH ?? '';
    const extensions = process.platform === 'win32'
        ? (process.env.PATHEXT ?? '.COM;.EXE;.BAT;.CMD')
              .split(';')
              .map((e) => e.toLowerCase())
              .filter(Boolean)
        : [''];
    const dirs = pathEnv.split(path.delimiter).filter(Boolean);
    for (const dir of dirs) {
        for (const ext of extensions) {
            try {
                if (fs.statSync(path.join(dir, command + ext)).isFile()) {
                    return true;
                }
            } catch {
                // 目录不存在或不是文件，继续查找
            }
        }
    }
    return false;
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
    let lastMessageTs: number | undefined;

    // 扫描完整文件：标题取首个用户消息，模型取最后出现的模型信息，更新时间取最后一条消息。
    forEachJsonLine(content, (obj) => {
        if (obj.type === 'session') {
            id = String(obj.id ?? '');
            cwd = typeof obj.cwd === 'string' ? obj.cwd : undefined;
            timestamp = typeof obj.timestamp === 'string' ? obj.timestamp : undefined;
        } else if (obj.type === 'message') {
            const message = obj.message as { role?: string; content?: unknown; model?: string; timestamp?: number } | undefined;
            if (message?.role === 'user' && title === undefined) {
                title = extractText(message.content);
            }
            if (typeof message?.model === 'string') {
                model = message.model;
            }
            if (typeof message?.timestamp === 'number' && (lastMessageTs === undefined || message.timestamp > lastMessageTs)) {
                lastMessageTs = message.timestamp;
            }
        } else if (obj.type === 'model_change') {
            if (typeof obj.modelId === 'string') {
                model = obj.modelId;
            }
        }
    });

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
        createdAt,
        updatedAt: lastMessageTs ?? createdAt
    };
}

/** 提取完整文本：保留换行与空白（供查看器渲染），不截断。 */
function extractContentText(content: unknown): string {
    if (typeof content === 'string') {
        return content;
    }
    if (Array.isArray(content)) {
        const parts = content
            .filter((part): part is { text?: string } => typeof part === 'object' && part !== null && 'text' in part)
            .map((part) => part.text ?? '');
        return parts.join('\n').trim();
    }
    return '';
}

function extractText(content: unknown, truncate = true): string | undefined {
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
    return truncate && text.length > MAX_TITLE ? text.slice(0, MAX_TITLE) + '…' : text;
}
