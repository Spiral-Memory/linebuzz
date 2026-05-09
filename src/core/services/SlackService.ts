import * as vscode from "vscode";
import { ITeamRepository, TeamInfo } from "../../adapters/interfaces/ITeamRepository";
import { logger } from "../utils/logger";
import { Storage } from "../platform/storage";
import { QuickPick, QuickPickOption } from "../platform/quickPick";

export class SlackService {
    constructor(private teamRepo: ITeamRepository) { }

    public async generateSlackOAuthUrl(teamId: string): Promise<{ url: string } | { settings: any }> {
        return await this.teamRepo.generateSlackOAuthUrl(teamId);
    }

    public async listenForSlackIntegration(teamId: string): Promise<{ unsubscribe: () => void }> {
        return await this.teamRepo.listenForSlackIntegration(teamId);
    }

    public async showSlackChannelDialog(): Promise<void> {
        try {
            const teamInfo = await Storage.getGlobal("currentTeam") as TeamInfo;
            if (!teamInfo) {
                await vscode.window.showErrorMessage('No active team found');
                return;
            }

            const result = await this.teamRepo.generateSlackOAuthUrl(teamInfo.id);

            if ('settings' in result) {
                const settings = result.settings as any;
                const channels = settings.channels || [];
                const activeChannelId = settings.active_channel_id;

                const items: QuickPickOption[] = [
                    ...channels.map((channel: any) => ({
                        label: channel.id === activeChannelId ? `$(check) #${channel.name}` : `$(circle-outline) #${channel.name}`,
                        data: channel
                    })),
                    {
                        label: `$(plug) Disconnect Slack`,
                        detail: 'Clears all tokens and channel settings for this team. You will need to re-authenticate to reconnect.',
                        data: 'disconnect'
                    }
                ];

                const selected = await QuickPick.showQuickPick(items, 'Configure Slack Channel');

                if (selected) {
                    if (selected.data === 'disconnect') {
                        await this.teamRepo.disconnectSlack(teamInfo.id);
                        await vscode.window.showInformationMessage('Slack integration disconnected successfully');
                    } 
                    else if (selected.data === 'Cancelled') {
                        logger.info("SlackService", "User cancelled Slack channel selection");
                    }
                    else if (selected.data) {
                        await this.teamRepo.updateActiveChannel(teamInfo.id, selected.data.id);
                        await vscode.window.showInformationMessage(`Synced to #${selected.data.name}`);
                    }
                }
            }
        } catch (error: any) {
            logger.error("SlackService", "Error showing Slack channel dialog", error);
            await vscode.window.showErrorMessage(`Error: ${error.message}`);
        }
    }

    public async showSlackConnectionNotification(): Promise<void> {
        try {
            const teamInfo = await Storage.getGlobal("currentTeam") as TeamInfo;
            const isAdmin = teamInfo?.role === 'admin';

            const message = 'Slack successfully connected! Your team can now use Slack integration.';
            const buttons = isAdmin ? ['Manage Channels'] : undefined;

            const selection = await vscode.window.showInformationMessage(message, ...(buttons || []));

            if (selection === 'Manage Channels' && isAdmin) {
                await this.showSlackChannelDialog();
            }

            logger.info("SlackService", "Slack connection notification shown");
        } catch (error: any) {
            logger.error("SlackService", "Error showing Slack connection notification", error);
        }
    }

    }
