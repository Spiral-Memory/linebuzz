import * as vscode from 'vscode';
import { BaseWebviewProvider } from './BaseWebviewProvider';
import { Container } from '../services/ServiceContainer';

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

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        super.resolveWebviewView(webviewView, context, _token);

        const authSub = this.authService.onDidChangeSession(() => this.updateIdentity());
        const teamSub = this.teamService.onDidChangeTeam(() => this.updateIdentity());
        const snippetSub = this.snippetService.onDidCaptureSnippet(() => this.updateSnippet());

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
            if (typingSub) {
                typingSub.unsubscribe();
            }
        });
    }

    protected async _onDidReceiveMessage(data: any): Promise<void> {
        switch (data.command) {
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
                try {
                    const { limit, anchorId, direction, intent } = data;
                    const messages = await this.messageService.getMessages(limit, anchorId, direction);

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

                } catch (error) {
                    console.error('Error handling getMessages:', error);
                    vscode.window.showErrorMessage('Failed to get messages.');
                }
                break;
            }
            
            case 'sendTyping':
                await this.activityService.sendTypingSignal();
                break;
        }
    }

    public async jumpToMessage(messageId: string) {
        if (!this._view) {
            await vscode.commands.executeCommand('linebuzz.chatpanel.focus');
        }

        this._view?.webview.postMessage({
            command: 'jumpToMessage',
            targetId: messageId
        });
    }

    private async updateIdentity() {
        if (!this._view) { return; }

        const session = await this.authService.getSession();
        const team = this.teamService.getTeam();

        this._view.webview.postMessage({
            command: 'updateIdentityState',
            state: {
                isLoggedIn: !!session,
                hasTeam: !!team
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

