import { Session } from '../domain/session';

/**
 * Agent 会话提供者接口：工作台通过它发现并读取某个 Agent 的会话。
 * 每个 Agent 一个实现（v1 只有 pi），是接缝 2 的测试边界。
 */
export interface AgentProvider {
    readonly agentName: string;
    /** 返回会话存储根目录；若 Agent 未安装或存储不存在则返回 undefined。 */
    discoverStore(): string | undefined;
    /** 扫描存储，返回全部会话的元数据（内容按需读取）。 */
    scanSessions(): Session[];
    /** 读取会话的全部消息文本（用于搜索），失败时返回空字符串。 */
    readSessionText(session: Session): string;
}
