import * as vscode from "vscode";
import * as path from 'path';
import * as fs from 'fs';
import { LRUCache } from 'lru-cache';
import { logger } from '../utils/logger';

export interface FileData {
    file_path: string;
    remote_url: string;
    discussions: any[];
}

export class ContextLensService {
    private cache = new LRUCache<string, FileData>({
        max: 100,
        ttl: 1000 * 60 * 30,
        updateAgeOnGet: true,
        allowStale: false
    });

    public async handleFileActivation(editor: vscode.TextEditor): Promise<void> {
        const uri = editor.document.uri;

        const cached = this.cache.get(uri.toString());
        if (cached) {
            this.render(editor, cached.discussions);
            return;
        }
        const context = await this.getFileContext(editor);
        if (!context) return;

        try {
            // Delegate: We will call adapters later to get discussions
            const discussions: any[] = [];

            this.cache.set(uri.toString(), {
                ...context,
                discussions
            });
            this.render(editor, discussions);
        } catch (e) {
            logger.error('ContextLensService', 'Data fetch failed', e);
        }
    }

    private render(editor: vscode.TextEditor, discussions: any[]) {
        logger.info('ContextLensService', 'Rendering discussions', discussions);
    }

    private async getFileContext(editor: vscode.TextEditor): Promise<Pick<FileData, 'file_path' | 'remote_url'> | void> {
        if (!editor) return;

        const gitExtension = vscode.extensions.getExtension('vscode.git');
        if (!gitExtension) {
            logger.error('ContextLensService', 'Git extension not found.');
            vscode.window.showErrorMessage('Please enable Git extension in VSCode.');
            return;
        }

        if (!gitExtension.isActive) {
            try {
                logger.info('ContextLensService', 'Activating Git extension...');
                await gitExtension.activate();
            }
            catch (e) {
                logger.error('ContextLensService', 'Failed to activate Git extension:', e);
                vscode.window.showErrorMessage('Please enable Git extension in VSCode.');
                return;
            }
        }

        const api = gitExtension.exports.getAPI(1);
        const uri = editor.document.uri;
        const repo = api.repositories.find((r: any) =>
            uri.fsPath.toLowerCase().startsWith(r.rootUri.fsPath.toLowerCase())
        );
        const remotes = repo?.state?.remotes;
        if (!repo || !remotes?.length) {
            return;
        }

        const chosenRemote = remotes.find((r: any) => r.name === 'origin') || remotes[0];
        if (!chosenRemote || !chosenRemote.fetchUrl) {
            return;
        }

        const realPath = fs.existsSync(uri.fsPath) ? fs.realpathSync.native(uri.fsPath) : uri.fsPath;
        const relativePath = path.relative(repo.rootUri.fsPath, realPath).split(path.sep).join('/');
        return {
            file_path: relativePath,
            remote_url: chosenRemote.fetchUrl,
        };
    }
}
