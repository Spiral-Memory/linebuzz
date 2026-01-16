import * as vscode from 'vscode';
import { logger } from '../utils/logger';
import dedent from 'dedent';
import { Container } from '../services/ServiceContainer';
import { CodeLensProvider } from '../providers/CodeLensProvider';
import { ReadOnlyContentProvider } from '../providers/ReadOnlyContentProvider';

export const activateCLensCommand = async (codeLensProvider: CodeLensProvider) => {
    await vscode.commands.executeCommand('setContext', 'linebuzz.isCLensActive', true);
    Container.get('ContextLensService').toggleCodeLens(true);
    codeLensProvider.refresh();
};

export const deactivateCLensCommand = async (codeLensProvider: CodeLensProvider) => {
    await vscode.commands.executeCommand('setContext', 'linebuzz.isCLensActive', false);
    Container.get('ContextLensService').toggleCodeLens(false);
    codeLensProvider.refresh();
};

export const openPeekCommand = async (uri: vscode.Uri, line: number) => {
    const editor = vscode.window.activeTextEditor;
    if (editor && editor.document.uri.toString() === uri.toString()) {
        const textLine = editor.document.lineAt(line);
        const pos = new vscode.Position(line, textLine.firstNonWhitespaceCharacterIndex);
        editor.selection = new vscode.Selection(pos, pos);
        await vscode.commands.executeCommand("editor.action.showHover");
    }
};
export const showDiffCommand = async (args: any) => {
    try {
        const { originalContent, currentFileUri, startLine, endLine } = args;

        if (!originalContent || !currentFileUri || startLine === undefined || endLine === undefined) {
            logger.error("CLensCommand", "Missing arguments");
            return;
        }

        const uri = vscode.Uri.parse(currentFileUri);
        const doc = await vscode.workspace.openTextDocument(uri);

        const startIdx = Math.max(0, startLine - 1);
        const endIdx = Math.max(0, endLine - 1);
        const safeStartIdx = Math.min(startIdx, doc.lineCount - 1);
        const safeEndIdx = Math.min(endIdx, doc.lineCount - 1);

        const range = new vscode.Range(
            new vscode.Position(safeStartIdx, 0),
            doc.lineAt(safeEndIdx).range.end
        );

        let currentContent: string;
        try {
            currentContent = dedent(doc.getText(range));
        } catch (e) {
            currentContent = doc.getText(range);
        }

        const filename = uri.path.split('/').pop();
        const leftTitle = `Snapshot`;
        const rightTitle = `Current (L${startLine}-L${endLine})`;
        const title = `${filename}: ${leftTitle} ↔ ${rightTitle}`;

        const providerKey = encodeURIComponent(currentFileUri);
        const leftUri = ReadOnlyContentProvider.registerContent(`original/${providerKey}`, originalContent);
        const rightUri = ReadOnlyContentProvider.registerContent(`current/${providerKey}`, currentContent);

        await vscode.commands.executeCommand('vscode.diff', leftUri, rightUri, title);

    } catch (e) {
        logger.error("CLensCommand", "Failed to show diff", e);
    }
};