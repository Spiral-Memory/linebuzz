import * as vscode from 'vscode';
import { logger } from '../utils/logger';
import { Container } from '../services/ServiceContainer';
import { CodeLensProvider } from '../providers/CodeLensProvider';

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

export const showDiffCommand = async (uriString: string, diffTarget: string) => {
    try {
        const uri = vscode.Uri.parse(uriString);
        const gitExtension = vscode.extensions.getExtension('vscode.git');
        if (!gitExtension) {
            logger.error("Extension", "Git extension not found");
            return;
        }
        const api = gitExtension.exports.getAPI(1);
        const leftUri = api.toGitUri(uri, diffTarget);
        const rightUri = uri;

        const filename = uri.path.split('/').pop();
        const title = `${filename} (${diffTarget} ⟷ Current)`;
        await vscode.commands.executeCommand('vscode.diff', leftUri, rightUri, title);
    } catch (e) {
        logger.error("Extension", "Failed to show diff", e);
    }
};