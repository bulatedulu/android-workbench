/** 路径归一化：Windows 忽略大小写、统一正斜杠、去掉结尾分隔符。用于路径比较/匹配。 */
export function normalizePathForMatch(p: string): string {
    let s = process.platform === 'win32' ? p.toLowerCase() : p;
    s = s.replace(/\\/g, '/');
    s = s.replace(/\/+$/, '');
    return s;
}
