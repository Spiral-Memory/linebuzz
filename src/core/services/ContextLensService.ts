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
    private buzzDecorationType: vscode.TextEditorDecorationType;
    private _onDidChange = new vscode.EventEmitter<void>();
    public readonly onDidChange = this._onDidChange.event;

    constructor(private codeRepo: ICodeRepository, context: vscode.ExtensionContext) {
        this.buzzDecorationType = vscode.window.createTextEditorDecorationType({
            isWholeLine: false,
        })
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
                const teamService = Container.get("TeamService");
                const currentTeam = teamService.getTeam();
                if (!currentTeam) return [];

                logger.info('ContextLensService', 'Fetching discussions', context);
                const discussions = await this.codeRepo.getDiscussionsByFile(context.file_path, context.remote_url, currentTeam.id);

                fileData = { ...context, discussions };
                this.cache.set(uri.toString(), fileData);
                this._onDidChange.fire();
                return [];
            } catch (e) {
                logger.error('ContextLensService', 'Data fetch failed', e);
                return [];
            }
        }

        const threads = new Map<number, CodeDiscussion[]>();
        fileData.discussions.forEach(d => {
            const lineIdx = d.start_line - 1;
            const list = threads.get(lineIdx) || [];
            list.push(d);
            threads.set(lineIdx, list);
        });

        const lenses: vscode.CodeLens[] = [];
        threads.forEach((discussions, lineIdx) => {
            const range = new vscode.Range(lineIdx, 0, lineIdx, 0);

            lenses.push(new vscode.CodeLens(range, {
                title: `☕ ${discussions.length} Buzz`,
                command: "clens.openPeek",
                arguments: [uri, lineIdx, discussions]
            }));
        });

        this.applyHoverDecorations(uri, threads);
        return lenses;
    }

    private applyHoverDecorations(uri: vscode.Uri, threads: Map<number, CodeDiscussion[]>) {
        const editor = vscode.window.visibleTextEditors.find(e => e.document.uri.toString() === uri.toString());
        if (!editor) return;

        const decorations: vscode.DecorationOptions[] = [];
        threads.forEach((discussions, lineIdx) => {
            decorations.push({
                range: new vscode.Range(lineIdx, 0, lineIdx, 0),
                hoverMessage: this.createMarkdownPopup(discussions)
            });
        });

        editor.setDecorations(this.buzzDecorationType, decorations);
    }

    private createMarkdownPopup(discussions: CodeDiscussion[]): vscode.MarkdownString {
        const md = new vscode.MarkdownString('', true);
        md.isTrusted = true;
        md.supportHtml = true;

        md.appendMarkdown(`### $(comment-discussion) LineBuzz Thread\n\n---\n\n`);

        discussions.forEach((d, i) => {
            const date = d.created_at ? new Date(d.created_at).toLocaleDateString() : 'Recent';
            md.appendMarkdown(`> ${d.content}\n\n`);
            md.appendMarkdown(`*$(git-commit) ${d.commit_sha.substring(0, 7)} • $(calendar) ${date}*\n\n`);
            if (i < discussions.length - 1) md.appendMarkdown('---\n\n');
        });

        const first = discussions[0];
        const args = encodeURIComponent(JSON.stringify([first.commit_sha]));
        md.appendMarkdown(`---\n[$(git-compare) View History](command:clens.showDiff?${args})`);

        return md;
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
