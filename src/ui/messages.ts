export const NO_STORE_MESSAGE = '未找到 pi 会话存储（~/.pi/agent/sessions）。请先安装并运行 pi。';
export const NO_COMMAND_MESSAGE = '未找到 pi 命令，请先安装 pi。';
export const RESUME_SUCCESS_MESSAGE = '已在集成终端恢复该会话，请到终端继续对话。';
/** 助手指令：分析新问题（创建 BUG-N 工作区）。 */
export const NEW_ISSUE_COMMAND = '分析新问题';

/** 依据存储与命令可用性给出工作台状态消息；一切正常时返回 undefined。 */
export function statusMessage(hasStore: boolean, agentAvailable: boolean): string | undefined {
    if (!hasStore) {
        return NO_STORE_MESSAGE;
    }
    if (!agentAvailable) {
        return NO_COMMAND_MESSAGE;
    }
    return undefined;
}
