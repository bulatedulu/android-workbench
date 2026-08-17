import * as vscode from 'vscode';
import { WorkbenchService } from '../domain/workbench';
import { AgentProvider } from '../agent/provider';
import { Session } from '../domain/session';
import { RESUME_HINT } from './messages';
import {
    parseIntent,
    findSessionByKeyword,
    buildSessionListMarkdown,
    buildSessionContentMarkdown,
    ProjectSessions
} from './chatParticipantLogic';

/** 注册聊天视图参与者（像 Codex 一样出现在聊天视图）：列/看/继续会话。 */
export function registerChatParticipant(
    context: vscode.ExtensionContext,
    service: WorkbenchService,
    provider: AgentProvider
): void {
    const participant = vscode.chat.createChatParticipant(
        'aiWorkbench.sessions',
        async (request, _ctx, stream, token) => {
            const intent = parseIntent(request.prompt);
            const groups: ProjectSessions[] = service.listProjects().map((p) => ({
                name: p.name,
                sessions: service.listAllSessionsForProject(p)
            }));
            switch (intent.type) {
                case 'list': {
                    stream.markdown(buildSessionListMarkdown(groups));
                    break;
                }
                case 'show': {
                    const session = findSessionByKeyword(groups, intent.keyword);
                    if (!session) {
                        stream.markdown(`未找到与「${intent.keyword}」匹配的会话。可用「列出会话」查看全部。`);
                        break;
                    }
                    stream.markdown(
                        buildSessionContentMarkdown(session.title, provider.readSessionContent(session))
                    );
                    break;
                }
                case 'continue': {
                    const session = findSessionByKeyword(groups, intent.keyword);
                    if (!session) {
                        stream.markdown(`未找到与「${intent.keyword}」匹配的会话。`);
                        break;
                    }
                    await continueSession(session, intent.question, provider, stream, token);
                    break;
                }
                default: {
                    stream.markdown(
                        [
                            '我是 Android 工作台会话助手。可用指令：',
                            '- 「列出会话」查看当前工作区所有项目的会话',
                            '- 「显示 <关键词>」查看某个会话内容',
                            '- 「继续 <关键词> <问题>」基于该会话继续提问（不写回 pi 存储）',
                            RESUME_HINT
                        ].join('\n')
                    );
                }
            }
            return { metadata: {} };
        }
    );
    participant.iconPath = new vscode.ThemeIcon('tools');
    context.subscriptions.push(participant);
}

/** 基于会话内容继续提问（vscode.lm，不写回 pi 存储，符合 ADR-0001）。 */
async function continueSession(
    session: Session,
    question: string,
    provider: AgentProvider,
    stream: vscode.ChatResponseStream,
    token: vscode.CancellationToken
): Promise<void> {
    const content = provider.readSessionContent(session);
    const contextText = content.messages.map((m) => `[${m.role}] ${m.text}`).join('\n');
    const models = await vscode.lm.selectChatModels({ vendor: 'copilot' });
    if (models.length === 0) {
        stream.markdown(`未找到可用模型（需要 Copilot 授权）。${RESUME_HINT}`);
        return;
    }
    const [model] = models;
    const messages = [
        vscode.LanguageModelChatMessage.User(
            `这是会话「${session.title}」的内容：\n${contextText || '（空）'}\n\n请基于以上内容回答：${question}`
        )
    ];
    try {
        const response = await model.sendRequest(messages, {}, token);
        for await (const fragment of response.text) {
            stream.markdown(fragment);
        }
    } catch (err) {
        stream.markdown(`调用模型失败：${err instanceof Error ? err.message : String(err)}`);
    }
}
