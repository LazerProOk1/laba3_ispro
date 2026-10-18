import * as vscode from 'vscode';
import { findDefLine, parseFunction, buildDocstring } from './parser';

export function activate(context: vscode.ExtensionContext) {
  const cmd = vscode.commands.registerCommand('docgen.generate', () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'python') {
      vscode.window.showWarningMessage('Открой Python-файл и поставь курсор на функцию.');
      return;
    }

    const lines = editor.document.getText().split(/\r?\n/);

    const defLine = findDefLine(lines, editor.selection.active.line);
    if (defLine === -1) {
      vscode.window.showWarningMessage('Выше курсора нет функции (def).');
      return;
    }

    const info = parseFunction(lines, defLine);
    if (!info) {
      vscode.window.showWarningMessage('Не удалось разобрать строку def.');
      return;
    }
    if (info.hasDocstring) {
      vscode.window.showInformationMessage('У функции ' + info.name + ' уже есть docstring.');
      return;
    }

    const eol = editor.document.eol === vscode.EndOfLine.CRLF ? '\r\n' : '\n';
    const text = buildDocstring(info)
      .map(l => (l === '' ? '' : info.indent + '    ' + l))
      .join(eol) + eol;

    const position = new vscode.Position(info.signatureEnd + 1, 0);
    editor.edit(builder => builder.insert(position, text));
  });

  context.subscriptions.push(cmd);
}

export function deactivate() {}