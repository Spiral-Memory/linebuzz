import * as vscode from "vscode";
import * as path from 'path';
import * as fs from 'fs';
import { formatDistanceToNow } from 'date-fns';
import { LRUCache } from 'lru-cache';
import { logger } from '../utils/logger';
import { Storage } from "../platform/storage";
import { Container } from "./ServiceContainer";
import { CodeDiscussion, ICodeRepository } from "../../adapters/interfaces/ICodeRepository";


interface FileContext {
    file_path: string;
    remote_url: string;
}

interface TrackedDiscussion {
    discussion: CodeDiscussion;
    liveRange: vscode.Range;
}

export class ContextLensService {
    private _isCLensActive: boolean = false
    private buzzDecorationType: vscode.TextEditorDecorationType;
    private cache = new LRUCache<string, TrackedDiscussion[]>({
        max: 100,
        allowStale: false
    });

    constructor(private codeRepo: ICodeRepository, context: vscode.ExtensionContext) {
        this.buzzDecorationType = vscode.window.createTextEditorDecorationType({
            isWholeLine: false,
        });

        this._isCLensActive = Storage.getGlobal<boolean>("clens.active") ?? false;
        vscode.commands.executeCommand('setContext', 'linebuzz.isCLensActive', this._isCLensActive);
        context.subscriptions.push(
            vscode.workspace.onDidChangeTextDocument(e => this.updateLiveRanges(e))
        );
    }

    public toggleCodeLens(value: boolean) {
        if (!value) {
            this.cache.clear();
            vscode.window.visibleTextEditors.forEach(editor => {
                editor.setDecorations(this.buzzDecorationType, []);
            });
        }
        this._isCLensActive = value;
        Storage.setGlobal("clens.active", value);
    }

    public async getCodeLenses(document: vscode.TextDocument): Promise<vscode.CodeLens[]> {
        if (!this._isCLensActive) {
            return [];
        }
        const uri = document.uri;
        let trackedDiscussions: TrackedDiscussion[] | undefined = this.cache.get(uri.toString());
        if (!trackedDiscussions) {
            const context = await this.getFileContext(document);
            if (!context) return [];

            try {
                const teamService = Container.get("TeamService");
                const currentTeam = teamService.getTeam();
                if (!currentTeam) return [];

                logger.info('ContextLensService', 'Fetching discussions', context);
                const originalDiscussions = await this.codeRepo.getDiscussionsByFile(context.file_path, context.remote_url, currentTeam.id);
                trackedDiscussions = originalDiscussions.map(d => ({
                    discussion: d,
                    liveRange: new vscode.Range(d.start_line - 1, 0, d.end_line - 1, 0)
                }));
                this.cache.set(uri.toString(), trackedDiscussions);
            } catch (e) {
                logger.error('ContextLensService', 'Data fetch failed', e);
                return [];
            }
        }

        const lineGroups = new Map<number, TrackedDiscussion[]>();
        trackedDiscussions.forEach(td => {
            const lineIndex = td.liveRange.start.line;
            const discussionList = lineGroups.get(lineIndex) || [];
            discussionList.push(td);
            lineGroups.set(lineIndex, discussionList);
        });

        const lenses: vscode.CodeLens[] = [];
        lineGroups.forEach((discussionList, lineIndex) => {
            const latestTimestamp = Math.max(...discussionList.map(d => new Date(d.discussion.created_at).getTime()));
            const timeAgo = formatDistanceToNow(new Date(latestTimestamp), { addSuffix: true });
            lenses.push(new vscode.CodeLens(discussionList[0].liveRange, {
                title: `☕ ${discussionList.length} References, ${timeAgo}`,
                command: "clens.openPeek",
                arguments: [uri, lineIndex, discussionList]
            }));
        });
        this.applyHoverDecorations(uri, lineGroups);
        return lenses;
    }

    private applyHoverDecorations(uri: vscode.Uri, lineGroups: Map<number, TrackedDiscussion[]>) {
        const editor = vscode.window.visibleTextEditors.find(e => e.document.uri.toString() === uri.toString());
        if (!editor) return;

        const decorations: vscode.DecorationOptions[] = [];
        lineGroups.forEach((discussionList, lineIndex) => {
            const textLine = editor.document.lineAt(lineIndex);
            const range = new vscode.Range(lineIndex, textLine.firstNonWhitespaceCharacterIndex, lineIndex, textLine.firstNonWhitespaceCharacterIndex);
            decorations.push({
                range,
                hoverMessage: this.createMarkdownPopup(discussionList, uri)
            });
        });

        editor.setDecorations(this.buzzDecorationType, decorations);
    }

    private createMarkdownPopup(discussionList: TrackedDiscussion[], uri: vscode.Uri): vscode.MarkdownString {
        const md = new vscode.MarkdownString('', true);
        md.isTrusted = true;
        md.supportHtml = true;

        discussionList.forEach((d, i) => {
            const timeAgo = formatDistanceToNow(new Date(d.discussion.created_at), { addSuffix: true });
            const user = d.discussion.message.u;
            const userName = user?.display_name || user?.username || 'User';
            const avatarUrl = user?.avatar_url;

            const avatarMd = avatarUrl
                ? `<img src="${avatarUrl}" height="30" style="border-radius: 4px; vertical-align: middle;">`
                : `$(account)`;

            md.appendMarkdown(`\n`);
            md.appendMarkdown(`${avatarMd}&nbsp;&nbsp;**${userName}**&nbsp;&nbsp;<span style="color:#808080;">$(history) ${timeAgo}</span>&nbsp;&nbsp;\n\n`);

            if (d.discussion.content) {
                const filename = path.basename(uri.fsPath);
                md.appendMarkdown(`[\`@${filename}:L${d.discussion.start_line}-L${d.discussion.end_line}\`](command:clens.highlightCode "Reveal code")`);
                md.appendMarkdown('\n\n');

                if (d.discussion.message.content) {
                    const content = d.discussion.message.content.length > 100
                        ? d.discussion.message.content.substring(0, 100) + '...'
                        : d.discussion.message.content;
                    md.appendMarkdown(`${content}\n\n`);
                }

                const diffArgs = encodeURIComponent(JSON.stringify({
                    originalContent: d.discussion.content,
                    currentFileUri: uri.toString(),
                    startLine: d.discussion.start_line,
                    endLine: d.discussion.end_line
                }));
                md.appendMarkdown(`[$(git-compare)](command:clens.showDiff?${diffArgs} "View Diff")`);
                md.appendMarkdown(`&nbsp;&nbsp;|&nbsp;&nbsp;`);
                md.appendMarkdown(`[$(comment-discussion) Jump to Chat](command:linebuzz.jumpToMessage?${encodeURIComponent(JSON.stringify(d.discussion.message.message_id))} "View Discussion")`);

                if (i < discussionList.length - 1) {
                    md.appendMarkdown('\n\n---\n\n');
                }
                md.appendMarkdown(`\n`);
            }
        });

        return md;
    }

    private async getFileContext(document: vscode.TextDocument): Promise<FileContext | void> {
        const gitExtension = vscode.extensions.getExtension('vscode.git');
        if (!gitExtension) {
            logger.error('ContextLensService', 'Git extension not found.');
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

    private updateLiveRanges(event: vscode.TextDocumentChangeEvent) {
        const key = event.document.uri.toString();
        const trackedDiscussions = this.cache.get(key);

        if (!trackedDiscussions || event.contentChanges.length === 0) return;

        for (const change of event.contentChanges) {
            const lineDelta = (change.text.split('\n').length - 1) - (change.range.end.line - change.range.start.line);
            if (lineDelta === 0) continue;

            const editStart = change.range.start;

            for (const td of trackedDiscussions) {
                const { start, end } = td.liveRange;

                if (editStart.line > end.line) continue;

                if (editStart.isBeforeOrEqual(start)) {
                    td.liveRange = new vscode.Range(
                        start.translate(lineDelta),
                        end.translate(lineDelta)
                    );
                }
                else {
                    const newEndLine = Math.max(start.line, end.line + lineDelta);
                    td.liveRange = new vscode.Range(start, end.with({ line: newEndLine }));
                }
            }
        }
    }

    public dispose() {
        this.cache.clear();
        this.buzzDecorationType.dispose();
    }
}
