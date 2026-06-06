import * as vscode from 'vscode';
import { BaseWebviewProvider } from './BaseWebviewProvider';
import { Container } from '../services/ServiceContainer';
import { MessageResponse } from '../../types/IMessage';
import { Storage } from '../platform/storage';
import { SupabaseClient } from '../../adapters/supabase/SupabaseClient';
import { loginCommand } from '../commands/AuthCommand';

export class ChatPanelProvider extends BaseWebviewProvider {
    public static readonly viewId = 'linebuzz.chatpanel';

    private _subscription: { unsubscribe: () => void } | undefined;
    private authService = Container.get('AuthService');
    private teamService = Container.get('TeamService');
    private snippetService = Container.get('SnippetService');
    private messageService = Container.get('MessageService');
    private navigatorService = Container.get('NavigatorService');
    private activityService = Container.get('ActivityService');

    constructor(extensionUri: vscode.Uri) {
        super(extensionUri);
    }

    public get isVisible(): boolean {
        return this._view?.visible ?? false;
    }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        super.resolveWebviewView(webviewView, context, _token);

        const authSub = this.authService.onDidChangeSession(() => this.updateIdentity());
        const teamSub = this.teamService.onDidChangeTeam(() => this.updateIdentity());
        const snippetSub = this.snippetService.onDidCaptureSnippet(() => this.updateSnippet());
        const slackSub = this.teamService.onDidChangeSlackIntegration(() => this.updateIdentity());

        let typingSub: { unsubscribe: () => void } | void;
        this.activityService.subscribeToTyping((payload) => {
            webviewView.webview.postMessage({
                command: 'typing',
                payload
            });
        }).then(sub => typingSub = sub);

        webviewView.onDidDispose(() => {
            if (this._subscription) {
                this._subscription.unsubscribe();
                this._subscription = undefined;
            }
            authSub.dispose();
            teamSub.dispose();
            snippetSub.dispose();
            slackSub.dispose();
            if (typingSub) {
                typingSub.unsubscribe();
            }
        });
    }

    protected async _onDidReceiveMessage(data: any): Promise<void> {
        switch (data.command) {
            case 'signInCustom': {
                const { url, anonKey } = data;
                try {
                    if (!url || !anonKey) {
                        this._view?.webview.postMessage({
                            command: 'signInCustomResult',
                            success: false,
                            error: 'URL and Key are required.'
                        });
                        break;
                    }
                    let formattedUrl = url.trim();
                    if (!/^https?:\/\//i.test(formattedUrl)) {
                        formattedUrl = 'https://' + formattedUrl;
                    }
                    formattedUrl = formattedUrl.replace(/\/$/, "");

                    const testUrl = `${formattedUrl}/rest/v1/team_integrations?select=settings&limit=1`;
                    const res = await fetch(testUrl, {
                        method: 'GET',
                        headers: {
                            'apikey': anonKey,
                            'Authorization': `Bearer ${anonKey}`
                        }
                    });

                    if (res.status !== 401 && res.status !== 403 && res.status !== 400) {
                        Storage.setGlobal('custom_supabase_url', formattedUrl);
                        Storage.setGlobal('custom_supabase_anon_key', anonKey);
                        SupabaseClient.resetInstance();
                        this._view?.webview.postMessage({
                            command: 'signInCustomResult',
                            success: true
                        });
                        await this.updateIdentity();
                    } else {
                        this._view?.webview.postMessage({
                            command: 'signInCustomResult',
                            success: false
                        });
                    }
                } catch (error: any) {
                    console.error('Error during custom server health check:', error);
                    this._view?.webview.postMessage({
                        command: 'signInCustomResult',
                        success: false
                    });
                }
                break;
            }
            case 'resetDefaultServer': {
                Storage.deleteGlobal('custom_supabase_url');
                Storage.deleteGlobal('custom_supabase_anon_key');
                SupabaseClient.resetInstance();
                await loginCommand({ createIfNone: false });
                await this.updateIdentity();
                break;
            }
            case 'getWebviewState':
                await this.updateIdentity();
                await this.updateSnippet();
                break;
            case 'signIn':
                await vscode.commands.executeCommand('linebuzz.login');
                break;
            case 'createTeam':
                await vscode.commands.executeCommand('linebuzz.createTeam');
                break;
            case 'joinTeam':
                await vscode.commands.executeCommand('linebuzz.joinTeam');
                break;
            case 'removeSnippet':
                this.snippetService.removeSnippet(data.index);
                break;
            case 'clearSnippet':
                this.snippetService.clearStagedSnippet();
                break;
            case 'openSnippet': {
                const result = await this.navigatorService.openSnippet(data.snippet);
                this._view?.webview.postMessage({
                    command: 'openSnippetCompleted',
                    requestId: data.requestId,
                    success: result.success,
                    reason: result.reason,
                    diffArgs: result.diffArgs
                });
                break;
            }

            case 'openDiff':
                await vscode.commands.executeCommand('clens.showDiff', data.args);
                break;

            case 'sendMessage': {
                try {
                    const MessageResponse = await this.messageService.sendMessage(data.body);
                    if (MessageResponse) {
                        this._view?.webview.postMessage({
                            command: 'appendMessage',
                            message: MessageResponse,
                        });
                    }
                } catch (error) {
                    console.error('Error handling sendMessage:', error);
                    vscode.window.showErrorMessage('Failed to send message.');
                }
                break;
            }

            case 'getMessages': {
                const { limit, anchorId, direction, intent } = data;
                let command: string | null = null;
                switch (intent) {
                    case 'initial':
                        command = 'loadInitialMessages';
                        break;
                    case 'jump-to-bottom':
                        command = 'jumpToBottom';
                        break;
                    case 'paginate-newer':
                        command = 'appendMessagesBatch';
                        break;
                    case 'paginate-older':
                        command = 'prependMessages';
                        break;
                    case 'jump-to-message':
                        command = 'jumpToMessage';
                        break;
                }

                try {
                    let isThreadReply = false;
                    let parentMessage: MessageResponse | null = null;

                    if (anchorId) {
                        const msgDetails = await this.messageService.getMessageById(anchorId);
                        if (msgDetails && msgDetails.parent_id) {
                            isThreadReply = true;
                            parentMessage = await this.messageService.getMessageById(msgDetails.parent_id);
                        }
                    }

                    if (isThreadReply && parentMessage) {
                        this._view?.webview.postMessage({
                            command: 'openThreadAndJump',
                            parentMessage: parentMessage,
                            targetId: anchorId
                        });
                        break;
                    }

                    const messages = await this.messageService.getMessages(limit, anchorId, direction);

                    if (command) {
                        this._view?.webview.postMessage({
                            command: command,
                            messages: messages,
                            targetId: anchorId
                        });
                    }

                    if (this._subscription) {
                        this._subscription.unsubscribe();
                    }


                    const sub = await this.messageService.subscribeToMessages((message) => {
                        this._view?.webview.postMessage({
                            command: 'appendMessage',
                            message: message,
                        });
                    });

                    if (sub) {
                        this._subscription = sub;
                    }

                } catch (error: any) {
                    console.error('Error handling getMessages:', error);
                    vscode.window.showErrorMessage('Failed to get messages.');
                    if (command) {
                        this._view?.webview.postMessage({
                            command: command,
                            messages: [],
                            error: error.message,
                            targetId: anchorId
                        });
                    }
                }
                break;
            }

            case 'getThreadMessages': {
                const { threadId, limit, anchorId, direction, intent } = data;
                let command: string | null = null;
                switch (intent) {
                    case 'initial':
                        command = 'loadThreadMessages';
                        break;
                    case 'jump-to-bottom':
                        command = 'jumpThreadToBottom';
                        break;
                    case 'paginate-newer':
                        command = 'appendThreadMessagesBatch';
                        break;
                    case 'paginate-older':
                        command = 'prependThreadMessages';
                        break;
                    case 'jump-to-message':
                        command = 'jumpThreadToMessage';
                        break;
                }

                try {
                    const messages = await this.messageService.getThreadMessages(threadId, limit, anchorId, direction);

                    if (command) {
                        this._view?.webview.postMessage({
                            command: command,
                            messages: messages,
                            targetId: anchorId
                        });
                    }
                } catch (error: any) {
                    console.error('Error handling getThreadMessages:', error);
                    vscode.window.showErrorMessage('Failed to get thread messages.');
                    if (command) {
                        this._view?.webview.postMessage({
                            command: command,
                            messages: [],
                            error: error.message,
                            targetId: anchorId
                        });
                    }
                }
                break;
            }


            case 'sendTyping':
                await this.activityService.sendTypingSignal();
                break;

            case 'openExternal':
                if (data.url) {
                    await vscode.env.openExternal(vscode.Uri.parse(data.url));
                }
                break;
        }
    }

    public async jumpToMessage(messageId: string) {
        if (!this._view) {
            await vscode.commands.executeCommand('linebuzz.chatpanel.focus');
        }

        try {
            const enrichedTargetMsg = await this.messageService.getMessageById(messageId);
            if (enrichedTargetMsg) {
                if (enrichedTargetMsg.parent_id) {
                    const enrichedParentMsg = await this.messageService.getMessageById(enrichedTargetMsg.parent_id);
                    if (enrichedParentMsg) {
                        this._view?.webview.postMessage({
                            command: 'jumpToMessage',
                            targetId: messageId,
                            parentMessage: enrichedParentMsg
                        });
                        return;
                    }
                }

                this._view?.webview.postMessage({
                    command: 'jumpToMessage',
                    targetId: messageId
                });
            }
        } catch (err) {
            console.error("Error resolving jumpToMessage on backend:", err);
            this._view?.webview.postMessage({
                command: 'jumpToMessage',
                targetId: messageId
            });
        }
    }

    private async updateIdentity() {
        if (!this._view) { return; }

        const session = await this.authService.getSession();
        const team = this.teamService.getTeam();

        this._view.webview.postMessage({
            command: 'updateIdentityState',
            state: {
                isLoggedIn: !!session,
                hasTeam: !!team,
                isSlackConnected: this.teamService.isSlackConnected(),
                slackChannel: this.teamService.getSlackActiveChannelName(),
                customServerUrl: Storage.getGlobal<string>("custom_supabase_url") || null
            }
        });
    }

    private async updateSnippet() {
        if (!this._view) { return; }

        const stagedSnippet = this.snippetService.getStagedSnippet();
        if (stagedSnippet) {
            this._view.webview.postMessage({
                command: 'updateSnippet',
                snippet: stagedSnippet
            });
        }
    }
}

