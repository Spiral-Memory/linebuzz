import * as vscode from "vscode";
import * as path from 'path';
import * as fs from 'fs';
import { formatDistanceToNow } from 'date-fns';
import { LRUCache } from 'lru-cache';
import { logger } from '../utils/logger';
import { Storage } from "../platform/storage";
import { Container } from "./ServiceContainer";
import { RelocatorEngine, RelocationInput } from "./RelocationService";
import { CodeDiscussion, ICodeRepository } from "../../adapters/interfaces/ICodeRepository";


interface FileContext {
    file_path: string;
    remote_url: string;
}

interface TrackedDiscussion {
    discussion: CodeDiscussion;
    startOffset: number;
    endOffset: number;
    liveRange: vscode.Range;
    relocationStatus?: {
        success: boolean;
        reason?: 'exact' | 'geometric' | 'orphaned' | 'empty';
    };
}

export class ContextLensService {
    private _isCLensActive: boolean = false
    private _isRangeChanging: boolean = false;
    private _shiftDebounce?: NodeJS.Timeout;
    private buzzDecorationType: vscode.TextEditorDecorationType;
    private cache = new LRUCache<string, TrackedDiscussion[]>({
        max: 100,
        allowStale: false
    });
    private relocator = new RelocatorEngine();

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
                if (currentTeam) {
                    logger.info('ContextLensService', 'Fetching discussions', context);
                    const discussions = await this.codeRepo.getDiscussionsByFile(context.file_path, context.remote_url, currentTeam.id);
                    trackedDiscussions = this.alignDiscussions(document, discussions);
                    this.cache.set(uri.toString(), trackedDiscussions);
                }
            } catch (e) {
                logger.error('ContextLensService', 'Data fetch failed', e);
            }
        }

        const lineGroups = new Map<number, TrackedDiscussion[]>();
        trackedDiscussions?.forEach(td => {
            const lineIndex = td.liveRange.start.line;
            const discussionList = lineGroups.get(lineIndex) || [];
            discussionList.push(td);
            lineGroups.set(lineIndex, discussionList);
        });

        const lenses: vscode.CodeLens[] = [];
        lineGroups.forEach((discussionList, lineIndex) => {
            if (this._isRangeChanging) {
                lenses.push(new vscode.CodeLens(discussionList[0].liveRange, {
                    title: `\u00a0\u00a0\u22ef\u00a0\u00a0`,
                    command: ""
                }));
            }
            else {
                const latestTimestamp = Math.max(...discussionList.map(d => new Date(d.discussion.created_at).getTime()));
                const timeAgo = formatDistanceToNow(new Date(latestTimestamp), { addSuffix: true });
                lenses.push(new vscode.CodeLens(discussionList[0].liveRange, {
                    title: `☕ ${discussionList.length} References, ${timeAgo}`,
                    command: "clens.openPeek",
                    arguments: [uri, lineIndex, discussionList]
                }));
            }
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


                if (d.relocationStatus?.success === false) {
                    md.appendMarkdown(`⚠️ **Unable to relocate code.** The snippet may have changed or moved.\n\n`);
                }

                const diffArgs = encodeURIComponent(JSON.stringify({
                    originalContent: d.discussion.content,
                    currentFileUri: uri.toString(),
                    startLine: d.discussion.start_line,
                    endLine: d.discussion.end_line,
                    liveStartLine: d.liveRange.start.line,
                    liveEndLine: d.liveRange.end.line,
                    ref: d.discussion.ref,
                    commit_sha: d.discussion.commit_sha,
                    patch: d.discussion.patch,
                    filePath: d.discussion.file_path,
                    remoteUrl: d.discussion.remote_url
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
        if (event.reason === vscode.TextDocumentChangeReason.Undo ||
            event.reason === vscode.TextDocumentChangeReason.Redo ||
            event.contentChanges.some(c => c.text.length > 500 || c.rangeLength > 500)) {

            this.cache.delete(event.document.uri.toString());
            vscode.commands.executeCommand('linebuzz.refreshCLens');
            return;
        }

        const key = event.document.uri.toString();
        const trackedDiscussions = this.cache.get(key);

        if (!trackedDiscussions || event.contentChanges.length === 0) return;

        if (!this._isRangeChanging) {
            this._isRangeChanging = true;
            vscode.commands.executeCommand('linebuzz.refreshCLens');
        }

        const changes = [...event.contentChanges].sort(
            (a, b) => a.rangeOffset - b.rangeOffset
        );

        for (const change of changes) {
            const changeStart = change.rangeOffset;
            const changeEnd = change.rangeOffset + change.rangeLength;
            const insertedEnd = changeStart + change.text.length;
            const delta = change.text.length - change.rangeLength;

            for (const td of trackedDiscussions) {
                // CASE 1:
                // Change is strictly before the range.
                if (changeEnd <= td.startOffset) {
                    td.startOffset += delta;
                    td.endOffset += delta;
                }

                // CASE 2:
                // Change is strictly after the range.
                else if (changeStart >= td.endOffset) {
                    // no-op
                }

                // CASE 3:
                // Change starts before or at the range and intersects it.
                // Treat edit as part of the same discussion.
                else if (changeStart <= td.startOffset && changeEnd > td.startOffset) {
                    td.startOffset = changeStart;
                    td.endOffset += delta;
                }

                // CASE 4:
                // Change intersects only the end of the range.
                else if (changeStart < td.endOffset && changeEnd >= td.endOffset) {
                    td.endOffset = insertedEnd;
                }

                // CASE 5:
                // Change lies strictly inside the range.
                else if (changeStart > td.startOffset && changeEnd < td.endOffset) {
                    td.endOffset += delta;
                }

                // CASE 6:
                // Safety normalization after destructive edits.
                if (td.startOffset > td.endOffset) {
                    td.endOffset = td.startOffset;
                }
            }
        }

        if (this._shiftDebounce) clearTimeout(this._shiftDebounce);

        this._shiftDebounce = setTimeout(() => {
            this._isRangeChanging = false;

            for (const td of trackedDiscussions) {
                td.liveRange = new vscode.Range(
                    event.document.positionAt(td.startOffset),
                    event.document.positionAt(td.endOffset)
                );
            }
            vscode.commands.executeCommand('linebuzz.refreshCLens');
        }, 800);
    }

    private alignDiscussions(document: vscode.TextDocument, discussions: CodeDiscussion[]): TrackedDiscussion[] {
        const fileContent = document.getText();

        const trackedDiscussions: TrackedDiscussion[] = discussions.map(d => ({
            discussion: d,
            startOffset: document.offsetAt(new vscode.Position(d.start_line - 1, 0)),
            endOffset: document.offsetAt(new vscode.Position(d.end_line - 1, 0)),
            liveRange: new vscode.Range(d.start_line - 1, 0, d.end_line - 1, 0)
        }));

        const candidates = trackedDiscussions.filter(td => td.discussion.content);
        if (!candidates.length) return trackedDiscussions;

        const inputs = candidates.map(td =>
            this.createRelocationInput(td.discussion, document, fileContent)
        );

        const results = this.relocator.relocate(inputs);

        results.forEach((result, i) => {
            const td = candidates[i];
            td.relocationStatus = {
                success: result.success,
                reason: result.reason
            };

            if (result.success) {
                td.startOffset = result.foundStartOffset;
                td.endOffset = result.foundEndOffset;
                td.liveRange = new vscode.Range(
                    document.positionAt(result.foundStartOffset),
                    document.positionAt(result.foundEndOffset)
                );
            }
        });

        return trackedDiscussions;
    }

    private createRelocationInput(d: CodeDiscussion, document: vscode.TextDocument, fileContent: string): RelocationInput {
        const searchStartLine = Math.max(0, d.start_line - 1 - 500);
        const searchEndLine = Math.min(document.lineCount - 1, d.end_line - 1 + 500);

        const windowStartOffset = document.offsetAt(new vscode.Position(searchStartLine, 0));
        const windowEndOffset = document.offsetAt(document.lineAt(searchEndLine).range.end);

        return {
            snapshot: d.content,
            targetCode: fileContent.substring(windowStartOffset, windowEndOffset),
            targetStartOffset: windowStartOffset,
            targetEndOffset: windowEndOffset,
            snapshotStartOffset: document.offsetAt(new vscode.Position(d.start_line - 1, 0)),
            snapshotEndOffset: document.offsetAt(new vscode.Position(d.end_line - 1, 0))
        };
    }

    public dispose() {
        this.cache.clear();
        this.buzzDecorationType.dispose();
    }
}
