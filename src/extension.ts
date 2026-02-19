import * as vscode from "vscode";
import { SupabaseAuthRepository } from './adapters/supabase/SupabaseAuthRepository';
import { AuthService } from './core/services/AuthService';
import { Container } from './core/services/ServiceContainer';
import { Storage } from "./core/platform/storage";
import { logger } from './core/utils/logger';
import { SupabaseTeamRepository } from "./adapters/supabase/SupabaseTeamRepository";
import { SupabaseCodeRepository } from "./adapters/supabase/SupabaseCodeRepository";
import { TeamService } from "./core/services/TeamService";
import { MessageService } from "./core/services/MessageService";
import { SupabaseMessageRepository } from "./adapters/supabase/SupabaseMessageRepository";
import { SupabaseActivityRepository } from "./adapters/supabase/SupabaseActivityRepository";
import { ActivityService } from "./core/services/ActivityService";
import { loginCommand } from "./core/commands/AuthCommand";
import { createTeamCommand, joinTeamCommand, leaveTeamCommand } from "./core/commands/TeamCommand";
import { sendMessageCommand } from "./core/commands/MessageCommand";
import { captureSnippetCommand } from "./core/commands/SnippetCommand";
import { TeamFeedProvider } from "./core/providers/TeamFeedProvider";
import { ChatPanelProvider } from "./core/providers/ChatPanelProvider";
import { SnippetService } from "./core/services/SnippetService";
import { NavigatorService } from "./core/services/NavigatorService";
import { ContextLensService } from "./core/services/ContextLensService";
import { refreshCLensCommand, activateCLensCommand, deactivateCLensCommand, openPeekCommand, showDiffCommand } from "./core/commands/CLensCommand";
import { CodeLensProvider } from "./core/providers/CodeLensProvider";
import { ReadOnlyContentProvider } from "./core/providers/ReadOnlyContentProvider";
import { NotificationService } from "./core/services/NotificationService";

export async function activate(context: vscode.ExtensionContext) {
    let authService: AuthService | undefined;
    let debounceTimer: NodeJS.Timeout;
    Storage.initialize(context);
    try {
        const supabaseTeamRepository = new SupabaseTeamRepository();
        const teamService = new TeamService(supabaseTeamRepository);
        context.subscriptions.push(teamService);
        Container.register('TeamService', teamService);
        await teamService.initialize();

        const supbaseAuthRepository = new SupabaseAuthRepository();
        authService = new AuthService(supbaseAuthRepository);
        context.subscriptions.push(authService);
        Container.register('AuthService', authService);
        await authService.initializeSession(false);

        const supabaseMessageRepository = new SupabaseMessageRepository();
        const messageService = new MessageService(supabaseMessageRepository);
        Container.register('MessageService', messageService);

        const supabaseActivityRepository = new SupabaseActivityRepository();
        const activityService = new ActivityService(supabaseActivityRepository);
        Container.register('ActivityService', activityService);

        const notificationService = new NotificationService(context);
        Container.register('NotificationService', notificationService);

        const snippetService = new SnippetService();
        context.subscriptions.push(snippetService);
        Container.register('SnippetService', snippetService);

        const navigatorService = new NavigatorService();
        context.subscriptions.push(navigatorService);
        Container.register('NavigatorService', navigatorService);

        const supabaseCodeRepository = new SupabaseCodeRepository();
        const contextLensService = new ContextLensService(supabaseCodeRepository, context);
        context.subscriptions.push(contextLensService);
        Container.register('ContextLensService', contextLensService);

        // const teamFeedPanelProvider = new TeamFeedProvider();
        // vscode.window.registerTreeDataProvider(TeamFeedProvider.viewId, teamFeedPanelProvider);

        const chatPanelProvider = new ChatPanelProvider(context.extensionUri);
        context.subscriptions.push(
            vscode.window.registerWebviewViewProvider(ChatPanelProvider.viewId, chatPanelProvider)
        );

        notificationService.setChatPanelProvider(chatPanelProvider);

        const codeLensProvider = new CodeLensProvider(contextLensService);
        context.subscriptions.push(
            vscode.languages.registerCodeLensProvider({ scheme: 'file' }, codeLensProvider)
        );

        context.subscriptions.push(
            vscode.workspace.registerTextDocumentContentProvider(ReadOnlyContentProvider.scheme, new ReadOnlyContentProvider())
        );

        context.subscriptions.push(
            vscode.commands.registerCommand('linebuzz.login', loginCommand),
            vscode.commands.registerCommand('linebuzz.createTeam', () => createTeamCommand()),
            vscode.commands.registerCommand('linebuzz.joinTeam', joinTeamCommand),
            vscode.commands.registerCommand('linebuzz.leaveTeam', leaveTeamCommand),
            vscode.commands.registerCommand('linebuzz.stepMuted', async () =>
                await notificationService.setMode('notify')
            ),
            vscode.commands.registerCommand('linebuzz.stepNotify', async () =>
                await notificationService.setMode('mute')
            ),
            vscode.commands.registerCommand('linebuzz.sendMessage', sendMessageCommand),
            vscode.commands.registerCommand('linebuzz.captureSnippet', captureSnippetCommand),
            vscode.commands.registerCommand('linebuzz.activateCLens', () =>
                activateCLensCommand(codeLensProvider)
            ),
            vscode.commands.registerCommand('linebuzz.deactivateCLens', () =>
                deactivateCLensCommand(codeLensProvider)
            ),
            vscode.commands.registerCommand('linebuzz.refreshCLens', () =>
                refreshCLensCommand(codeLensProvider)
            ),
            vscode.commands.registerCommand("clens.openPeek", openPeekCommand),
            vscode.commands.registerCommand("clens.showDiff", showDiffCommand),
            vscode.commands.registerCommand("linebuzz.jumpToMessage", (messageId: string) =>
                chatPanelProvider.jumpToMessage(messageId)
            )
        );

    } catch (e) {
        logger.error("Extension", "Failed to activate extension:", e);
        return;
    }

    const disposable = vscode.authentication.onDidChangeSessions((e) => {
        if (e.provider.id !== "github") return;
        if (authService) {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(async () => {
                await authService.initializeSession();
            }, 500);
        } else {
            logger.error("Extension", "AuthService not initialized when onDidChangeSessions fired.");
        }
    });

    context.subscriptions.push(disposable);
}

// --- Hiding team feed for now ---

// {
//     "id": "linebuzz.teamfeed",
//     "icon": "assets/logo.svg",
//     "name": "Team Feed",
//     "when": "extension.isLoggedIn && linebuzz.hasTeam"
// },