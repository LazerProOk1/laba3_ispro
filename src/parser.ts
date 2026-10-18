export interface Param {
  name: string;
  type?: string;
  defaultValue?: string;
}

export interface FunctionInfo {
  name: string;
  params: Param[];
  returnType?: string;
  hasReturn: boolean;
  raises: string[];
  indent: string;
  signatureEnd: number;
  hasDocstring: boolean;
}

export function findDefLine(lines: string[], cursor: number): number {
  for (let i = cursor; i >= 0; i--) {
    if (/^\s*(async\s+)?def\s+\w+/.test(lines[i])) {
      return i;
    }
  }
  return -1;
}

export function readSignature(lines: string[], start: number): { text: string; end: number } {
  let text = '';
  let depth = 0;
  let seenParen = false;
  for (let i = start; i < lines.length; i++) {
    text += lines[i] + ' ';
    for (const ch of lines[i]) {
      if (ch === '(') { depth++; seenParen = true; }
      if (ch === ')') { depth--; }
    }
    if (seenParen && depth === 0) {
      return { text, end: i };
    }
  }
  return { text, end: lines.length - 1 };
}

export function splitTopLevel(text: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let quote = '';
  let current = '';
  for (const ch of text) {
    if (quote !== '') {
      if (ch === quote) { quote = ''; }
    } else if (ch === '"' || ch === "'") {
      quote = ch;
    } else if ('([{'.includes(ch)) {
      depth++;
    } else if (')]}'.includes(ch)) {
      depth--;
    }
    if (ch === ',' && depth === 0 && quote === '') {
      parts.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim() !== '') {
    parts.push(current);
  }
  return parts.map(p => p.trim()).filter(p => p !== '');
}

export function parseParam(raw: string): Param | null {
  if (raw === '/' || raw === '*') {
    return null;
  }
  let rest = raw;
  let defaultValue: string | undefined;
  const eq = rest.indexOf('=');
  if (eq !== -1) {
    defaultValue = rest.substring(eq + 1).trim();
    rest = rest.substring(0, eq).trim();
  }
  let type: string | undefined;
  const colon = rest.indexOf(':');
  if (colon !== -1) {
    type = rest.substring(colon + 1).trim();
    rest = rest.substring(0, colon).trim();
  }
  if (rest === 'self' || rest === 'cls') {
    return null;
  }
  return { name: rest, type, defaultValue };
}

export function analyzeBody(lines: string[], signatureEnd: number, defIndent: number) {
  let hasReturn = false;
  const raises: string[] = [];
  let hasDocstring = false;
  let firstStatement = true;
  for (let i = signatureEnd + 1; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === '') {
      continue;
    }
    const indent = line.length - line.trimStart().length;
    if (indent <= defIndent) {
      break;
    }
    const t = line.trim();
    if (firstStatement) {
      hasDocstring = t.startsWith("'''") || t.startsWith('"""');
      firstStatement = false;
    }
    if (/^return\s+\S/.test(t)) {
      hasReturn = true;
    }
    const m = /^raise\s+(\w+)/.exec(t);
    if (m && !raises.includes(m[1])) {
      raises.push(m[1]);
    }
  }
  return { hasReturn, raises, hasDocstring };
}

export function parseFunction(lines: string[], defLine: number): FunctionInfo | null {
  const { text, end } = readSignature(lines, defLine);
  const m = /def\s+(\w+)\s*\(([\s\S]*)\)\s*(?:->\s*([^:]+?))?\s*:\s*$/.exec(text.trim());
  if (!m) {
    return null;
  }
  const params: Param[] = [];
  for (const raw of splitTopLevel(m[2])) {
    const p = parseParam(raw);
    if (p) {
      params.push(p);
    }
  }
  const defIndent = lines[defLine].length - lines[defLine].trimStart().length;
  const body = analyzeBody(lines, end, defIndent);
  return {
    name: m[1],
    params,
    returnType: m[3]?.trim(),
    hasReturn: body.hasReturn,
    raises: body.raises,
    indent: lines[defLine].substring(0, defIndent),
    signatureEnd: end,
    hasDocstring: body.hasDocstring,
  };
}

export function buildDocstring(info: FunctionInfo): string[] {
  const out: string[] = ["'''", `Описание функции ${info.name}.`, ''];
  if (info.params.length > 0) {
    out.push('Параметры:');
    for (const p of info.params) {
      const type = p.type ? ` (${p.type})` : '';
      const def = p.defaultValue !== undefined ? `, по умолчанию ${p.defaultValue}` : '';
      out.push(`    ${p.name}${type}: описание${def}`);
    }
    out.push('');
  }
  if (info.hasReturn) {
    out.push('Возвращаемое значение:');
    out.push(`    ${info.returnType ?? 'тип'}: описание`);
    out.push('');
  }
  if (info.raises.length > 0) {
    out.push('Исключения:');
    for (const r of info.raises) {
      out.push(`    ${r}: когда возникает`);
    }
    out.push('');
  }
  const args = info.params
    .filter(p => p.defaultValue === undefined && !p.name.startsWith('*'))
    .map(p => p.name)
    .join(', ');
  out.push('Пример вызова:');
  out.push(`    ${info.name}(${args})`);
  out.push("'''");
  return out;
}