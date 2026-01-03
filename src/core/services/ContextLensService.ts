import * as vscode from "vscode";
import * as path from 'path';
import * as fs from 'fs';
import { LRUCache } from 'lru-cache';
import { logger } from '../utils/logger';
import { Container } from "./ServiceContainer";
import { CodeDiscussion, ICodeRepository } from "../../adapters/interfaces/ICodeRepository";

interface FileContext {
    file_path: string;
    remote_url: string;
}

interface FileData extends FileContext {
    discussions: CodeDiscussion[];
}

export class ContextLensService {
    private decorationType: vscode.TextEditorDecorationType;
    private _onDidChange = new vscode.EventEmitter<void>();
    public readonly onDidChange = this._onDidChange.event;

    constructor(private codeRepo: ICodeRepository, context: vscode.ExtensionContext) {
        this.decorationType = vscode.window.createTextEditorDecorationType({
            gutterIconSize: 'contain',
            gutterIconPath: context.asAbsolutePath("assets/logo.svg")
        });
    }

    private cache = new LRUCache<string, FileData>({
        max: 100,
        ttl: 1000 * 60 * 30,
        updateAgeOnGet: true,
        allowStale: false
    });

    public async getCodeLenses(document: vscode.TextDocument): Promise<vscode.CodeLens[]> {
        const uri = document.uri;
        let fileData = this.cache.get(uri.toString());

        if (!fileData) {
            const context = await this.getFileContext(document);
            if (!context) return [];

            try {
                // Check if we already have a pending request for this file to avoid race conditions?
                // For simplicity, just fetch.
                const teamService = Container.get("TeamService");
                const currentTeam = teamService.getTeam();
                if (!currentTeam) {
                    return [];
                }

                logger.info('ContextLensService', 'Fetching discussions', context);
                const discussions = await this.codeRepo.getDiscussionsByFile(context.file_path, context.remote_url, currentTeam.id);
                logger.info('ContextLensService', 'Fetched discussions', discussions);

                fileData = {
                    ...context,
                    discussions
                };
                this.cache.set(uri.toString(), fileData);

                // Fire event to notify that data has changed, so the provider can re-query if needed
                // actually, since we are inside the provideCodeLenses flow (via provider), we are returning the lenses now.
                // However, since getCodeLenses is async, the provider will be awaiting this.
                // If we were fetching in background, we would need the event.
                // Since we are fetching on demand *inside* the request, we just return the result.
                // BUT, to be safe and allow other parts to know, or if we want to refresh later:
                this._onDidChange.fire();

            } catch (e) {
                logger.error('ContextLensService', 'Data fetch failed', e);
                return [];
            }
        }

        const threads = new Map<number, CodeDiscussion[]>();
        fileData.discussions.forEach(d => {
            const list = threads.get(d.start_line) || [];
            list.push(d);
            threads.set(d.start_line, list);
        });

        const lenses: vscode.CodeLens[] = [];
        threads.forEach((discussions, line) => {
            const range = new vscode.Range(line - 1, 0, line - 1, 0);

            lenses.push(new vscode.CodeLens(range, {
                title: `☕ ${discussions.length} Discussion${discussions.length > 1 ? 's' : ''}`,
                command: "clens.openDiscussion",
                arguments: [uri, line, discussions]
            }));
        });

        return lenses;
    }

    private async getFileContext(document: vscode.TextDocument): Promise<FileContext | void> {
        const gitExtension = vscode.extensions.getExtension('vscode.git');
        if (!gitExtension) {
            logger.error('ContextLensService', 'Git extension not found.');
            // vscode.window.showErrorMessage('Please enable Git extension in VSCode.'); // Don't spam notifications
            return;
        }

        if (!gitExtension.isActive) {
            try {
                await gitExtension.activate();
            }
            catch (e) {
                logger.error('ContextLensService', 'Failed to activate Git extension:', e);
                return;
            }
        }

        const api = gitExtension.exports.getAPI(1);
        const uri = document.uri;
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

    public dispose() {
        this.cache.clear();
        this._onDidChange.dispose();
    }
}
