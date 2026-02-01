import * as vscode from "vscode";
import * as path from 'path';
import * as fs from 'fs';
import gitUrlParse from 'git-url-parse';
import { Snippet } from "../../types/IAttachment";
import { logger } from '../utils/logger';
import { RelocatorEngine } from "./RelocationService";

export class NavigatorService {

    private snippetDecoration = vscode.window.createTextEditorDecorationType({
        backgroundColor: new vscode.ThemeColor('editor.wordHighlightStrongBackground'),
        isWholeLine: true,
    });

    private relocator = new RelocatorEngine();

    public async openSnippet(snippet: Snippet): Promise<boolean> {
        if (!snippet) return false;

        const gitExtension = vscode.extensions.getExtension('vscode.git');
        if (!gitExtension) {
            logger.error('SnippetService', 'Git extension not found.');
            vscode.window.showErrorMessage('Please enable Git extension in VSCode.');
            return false;
        }

        if (!gitExtension.isActive) {
            try {
                logger.info('SnippetService', 'Activating Git extension...');
                await gitExtension.activate();
            }
            catch (e) {
                logger.error('SnippetService', 'Failed to activate Git extension:', e);
                vscode.window.showErrorMessage('Please enable Git extension in VSCode.');
                return false;
            }
        }

        const api = gitExtension.exports.getAPI(1);
        const repos = api.repositories;
        if (!repos || repos.length === 0) return false;

        let targetIdentity: string | null = null;
        try {
            const snippetInfo = gitUrlParse(snippet.remote_url);
            targetIdentity = snippetInfo.full_name;
        }
        catch (e) {
            logger.error('NavigatorService', 'Failed to parse repo url:', e);
            return false;
        }

        const matchingRepo = repos.find((repo: any) => {
            return repo.state.remotes.some((remote: any) => {
                const url = remote.fetchUrl;
                const remoteInfo = gitUrlParse(url);
                return remoteInfo.full_name.toLowerCase() === targetIdentity.toLowerCase();
            });
        });

        if (matchingRepo) {
            let targetUri: vscode.Uri | undefined;
            const snippetFilePath = snippet.file_path.split('/').join(path.sep);
            const candidate = path.join(matchingRepo.rootUri.fsPath, snippetFilePath);
            if (fs.existsSync(candidate)) {
                targetUri = vscode.Uri.file(candidate);
            }

            if (!targetUri) {
                // TODO: Search all files in repo, this maybe a casing mismatch
                return false;
            }

            const editor = await vscode.window.showTextDocument(targetUri);
            let startLine = snippet.start_line - 1;
            let endLine = snippet.end_line - 1;

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
                    }
                } catch (e) {
                    logger.error('NavigatorService', 'Relocation failed', e);
                }
            }

            const selection = new vscode.Selection(
                new vscode.Position(startLine, 0),
                new vscode.Position(endLine, 0)
            );
            editor.revealRange(selection);
            editor.setDecorations(this.snippetDecoration, [selection]);
            setTimeout(() => {
                editor.setDecorations(this.snippetDecoration, []);
            }, 1500);
            logger.info('NavigatorService', 'Navigated to snippet', snippet);
            return true;
        }
        return false;
    }
    public dispose() {
        this.snippetDecoration.dispose();
    }
}
