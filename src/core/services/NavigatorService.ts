import * as vscode from "vscode";
import { Snippet } from "../../types/IAttachment";
import { logger } from '../utils/logger';
import { RelocatorEngine } from "./RelocationService";
import { findRepositoryByRemote, resolveFilePath } from "../utils/gitFileMapper";

export class NavigatorService implements vscode.UriHandler {

    private snippetDecoration = vscode.window.createTextEditorDecorationType({
        backgroundColor: new vscode.ThemeColor('editor.wordHighlightStrongBackground'),
        isWholeLine: true,
    });

    private relocator = new RelocatorEngine();

    public async openSnippet(snippet: Snippet): Promise<{ success: boolean; reason?: 'file_not_found' | 'exact' | 'geometric' | 'orphaned' | 'empty' | 'error'; diffArgs?: any }> {
        if (!snippet) return { success: false, reason: 'error' };

        const gitExtension = vscode.extensions.getExtension('vscode.git');
        if (!gitExtension) {
            logger.error('SnippetService', 'Git extension not found.');
            vscode.window.showErrorMessage('Please enable Git extension in VSCode.');
            return { success: false, reason: 'error' };
        }

        if (!gitExtension.isActive) {
            try {
                logger.info('SnippetService', 'Activating Git extension...');
                await gitExtension.activate();
            }
            catch (e) {
                logger.error('SnippetService', 'Failed to activate Git extension:', e);
                vscode.window.showErrorMessage('Please enable Git extension in VSCode.');
                return { success: false, reason: 'error' };
            }
        }

        const api = gitExtension.exports.getAPI(1);
        const matchingRepo = findRepositoryByRemote(api, snippet.remote_url);

        if (matchingRepo) {
            let targetUri = resolveFilePath(matchingRepo, snippet.file_path);

            if (!targetUri) {
                // TODO: Search all files in repo, this maybe a casing mismatch
                return { success: false, reason: 'file_not_found' };
            }

            const editor = await vscode.window.showTextDocument(targetUri);
            let startLine = snippet.start_line - 1;
            let endLine = snippet.end_line - 1;
            let matchReason: 'exact' | 'geometric' | 'orphaned' | 'empty' | 'error' = 'error';
            let diffArgs: any | undefined;

            if (snippet.content) {
                try {
                    const text = editor.document.getText();
                    const searchStartLine = Math.max(0, startLine - 500);
                    const searchEndLine = Math.min(editor.document.lineCount - 1, endLine + 500);
                    const windowStartOffset = editor.document.offsetAt(new vscode.Position(searchStartLine, 0));
                    const windowEndOffset = editor.document.offsetAt(editor.document.lineAt(searchEndLine).range.end);

                    const targetCode = text.substring(windowStartOffset, windowEndOffset);
                    const estimatedStartOffset = editor.document.offsetAt(new vscode.Position(startLine, 0));
                    const estimatedEndOffset = editor.document.offsetAt(new vscode.Position(endLine, 0));

                    const results = this.relocator.relocate([{
                        snapshot: snippet.content,
                        targetCode: targetCode,
                        targetStartOffset: windowStartOffset,
                        targetEndOffset: windowEndOffset,
                        snapshotStartOffset: estimatedStartOffset,
                        snapshotEndOffset: estimatedEndOffset
                    }]);
                    const result = results[0];

                    if (result && result.success) {
                        const startPos = editor.document.positionAt(result.foundStartOffset);
                        const endPos = editor.document.positionAt(result.foundEndOffset);
                        startLine = startPos.line;
                        endLine = endPos.line;
                        logger.info('NavigatorService', 'Relocated snippet to lines', startLine, endLine);

                        if (result.reason) {
                            matchReason = result.reason;
                        }
                    }
                } catch (e) {
                    logger.error('NavigatorService', 'Relocation failed', e);
                }
            }

            const selection = new vscode.Selection(
                new vscode.Position(startLine, 0),
                new vscode.Position(endLine, 0)
            );
            editor.revealRange(selection, vscode.TextEditorRevealType.InCenterIfOutsideViewport);
            editor.setDecorations(this.snippetDecoration, [selection]);
            setTimeout(() => {
                editor.setDecorations(this.snippetDecoration, []);
            }, 1500);

            if (matchReason !== 'exact') {
                diffArgs = {
                    originalContent: snippet.content,
                    currentFileUri: editor.document.uri.toString(),
                    startLine: snippet.start_line,
                    endLine: snippet.end_line,
                    liveStartLine: startLine,
                    liveEndLine: endLine,
                    ref: snippet.ref,
                    commit_sha: snippet.commit_sha,
                    patch: snippet.patch,
                    filePath: snippet.file_path,
                    remoteUrl: snippet.remote_url
                };
            }

            logger.info('NavigatorService', 'Navigated to snippet', snippet);

            return {
                success: true,
                reason: matchReason,
                diffArgs
            };
        }
        return { success: false, reason: 'file_not_found' };
    }

    public async openFileByPath(filePath: string, startLine?: number, endLine?: number): Promise<boolean> {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            logger.warn('NavigatorService', 'No workspace folders are open.');
            return false;
        }

        const workspaceUri = workspaceFolders[0].uri;
        const fileUri = vscode.Uri.joinPath(workspaceUri, filePath);
        try {
            const doc = await vscode.workspace.openTextDocument(fileUri);
            const editor = await vscode.window.showTextDocument(doc);
            
            if (startLine !== undefined) {
                const lineIdx = Math.max(0, startLine - 1);
                const safeLineIdx = Math.min(lineIdx, doc.lineCount - 1);
                const safeEndLineIdx = endLine !== undefined ? Math.min(Math.max(0, endLine - 1), doc.lineCount - 1) : safeLineIdx;

                const textLine = doc.lineAt(safeLineIdx);
                const pos = new vscode.Position(safeLineIdx, textLine.firstNonWhitespaceCharacterIndex);
                editor.selection = new vscode.Selection(pos, pos);

                const range = new vscode.Range(
                    new vscode.Position(safeLineIdx, 0),
                    new vscode.Position(safeEndLineIdx, doc.lineAt(safeEndLineIdx).text.length)
                );

                editor.revealRange(
                    range,
                    vscode.TextEditorRevealType.InCenter
                );

                editor.setDecorations(this.snippetDecoration, [range]);
                setTimeout(() => {
                    editor.setDecorations(this.snippetDecoration, []);
                }, 1500);
            }
            logger.info('NavigatorService', `Successfully opened file by path: ${filePath}`);
            return true;
        } catch (e) {
            logger.warn('NavigatorService', `Failed to open file path: ${filePath}`, e);
            return false;
        }
    }

    public async handleUri(uri: vscode.Uri) {
        logger.info("NavigatorService", `Received protocol link: ${uri.toString()}`);
        if (uri.path === '/open') {
            const params = new URLSearchParams(uri.query);
            const filePath = params.get('filePath');
            const startLine = params.get('startLine') ? parseInt(params.get('startLine')!, 10) : undefined;
            const endLine = params.get('endLine') ? parseInt(params.get('endLine')!, 10) : undefined;

            if (filePath) {
                const opened = await this.openFileByPath(filePath, startLine, endLine);
                if (!opened) {
                    await vscode.commands.executeCommand('workbench.view.extension.linebuzz-view-container');
                    await vscode.commands.executeCommand('linebuzz.chatpanel.focus');
                }
            }
        }
    }

    public dispose() {
        this.snippetDecoration.dispose();
    }
}
