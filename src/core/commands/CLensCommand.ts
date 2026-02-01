import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { findRepositoryByRemote } from '../utils/gitFileMapper';
import { logger } from '../utils/logger';
import dedent from 'dedent';
import { Container } from '../services/ServiceContainer';
import { CodeLensProvider } from '../providers/CodeLensProvider';
import { ReadOnlyContentProvider } from '../providers/ReadOnlyContentProvider';

export const refreshCLensCommand = async (codeLensProvider: CodeLensProvider) => {
    codeLensProvider.refresh();
};
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

const applyPatch = async (content: string, patch: string, filePath: string): Promise<string> => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'linebuzz-patch-'));
    try {
        const tempFilePath = path.join(tempDir, filePath);
        const patchFilePath = path.join(tempDir, 'changes.patch');

        fs.mkdirSync(path.dirname(tempFilePath), { recursive: true });
        fs.writeFileSync(tempFilePath, content);
        fs.writeFileSync(patchFilePath, patch);

        await new Promise<void>((resolve, reject) => {
            cp.exec(`git apply --ignore-space-change --ignore-whitespace "${patchFilePath}"`, { cwd: tempDir }, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });

        return fs.readFileSync(tempFilePath, 'utf-8');
    } finally {
        try {
            fs.rmSync(tempDir, { recursive: true, force: true });
        } catch (e) { }
    }
};

export const showDiffCommand = async (args: any) => {
    try {
        const { originalContent, currentFileUri, startLine, endLine, commit_sha, filePath, patch, remoteUrl } = args;

        if (!originalContent || !currentFileUri || startLine === undefined || endLine === undefined) {
            logger.error("CLensCommand", "Missing arguments");
            return;
        }

        const uri = vscode.Uri.parse(currentFileUri);
        const doc = await vscode.workspace.openTextDocument(uri);

        let fetchedContent: string | null = null;

        if (commit_sha && filePath) {
            try {
                const gitExtension = vscode.extensions.getExtension('vscode.git');
                if (gitExtension) {
                    if (!gitExtension.isActive) await gitExtension.activate();
                    const api = gitExtension.exports.getAPI(1);

                    let repo;
                    if (remoteUrl) {
                        repo = findRepositoryByRemote(api, remoteUrl);
                    }

                    if (!repo) {
                        repo = api.repositories.find((r: any) =>
                            uri.fsPath.toLowerCase().startsWith(r.rootUri.fsPath.toLowerCase())
                        );
                    }

                    if (repo) {
                        const refContent = await repo.show(commit_sha, filePath);
                        if (refContent) {
                            fetchedContent = refContent;
                            if (patch) {
                                try {
                                    const patchedContent = await applyPatch(refContent, patch, filePath);
                                    fetchedContent = patchedContent;
                                    logger.info("CLensCommand", "Successfully applied patch");
                                } catch (patchError) {
                                    logger.warn("CLensCommand", "Failed to apply patch, falling back to ref content", patchError);
                                }
                            }
                        }
                    }
                }
            } catch (e) {
                logger.warn("CLensCommand", "Failed to get content from git ref", e);
            }
        }

        if (fetchedContent) {
            const fullCurrentContent = doc.getText();
            const uniqueKey = `${encodeURIComponent(currentFileUri)}-${Date.now()}`;
            const filename = path.basename(filePath);
            const leftUri = ReadOnlyContentProvider.registerContent(`remote-ref/${uniqueKey}/${filename}`, fetchedContent);
            const rightUri = ReadOnlyContentProvider.registerContent(`local-current/${uniqueKey}/${filename}`, fullCurrentContent);

            await vscode.commands.executeCommand('vscode.diff', leftUri, rightUri, `${filename}: ${commit_sha.substring(0, 8)} ↔ Current`);
            return;
        }

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

        const filename = uri.path.split('/').pop() || 'file';
        const leftTitle = `Snapshot`;
        const rightTitle = `Current (L${startLine}-L${endLine})`;
        const title = `${filename}: ${leftTitle} ↔ ${rightTitle}`;

        const uniqueKey = `${encodeURIComponent(currentFileUri)}-${Date.now()}`;
        const leftUri = ReadOnlyContentProvider.registerContent(`original/${uniqueKey}/${filename}`, originalContent);
        const rightUri = ReadOnlyContentProvider.registerContent(`current/${uniqueKey}/${filename}`, currentContent);

        await vscode.commands.executeCommand('vscode.diff', leftUri, rightUri, title);

    } catch (e) {
        logger.error("CLensCommand", "Failed to show diff", e);
    }
};