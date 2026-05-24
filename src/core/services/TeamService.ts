import * as vscode from "vscode";
import { ITeamRepository, TeamInfo } from "../../adapters/interfaces/ITeamRepository";
import { Storage } from "../platform/storage";
import { logger } from "../utils/logger";
import { SlackService } from "./SlackService";

export class TeamService {
    private currentTeam: TeamInfo | undefined;
    private integrationSubscription: { unsubscribe: () => void } | undefined;
    private slackService: SlackService;
    private slackConnected: boolean = false;
    private slackChannel: string | null = null;

    private _onDidChangeTeam = new vscode.EventEmitter<TeamInfo | undefined>();
    public readonly onDidChangeTeam = this._onDidChangeTeam.event;

    private _onDidChangeSlackIntegration = new vscode.EventEmitter<boolean>();
    public readonly onDidChangeSlackIntegration = this._onDidChangeSlackIntegration.event;

    constructor(private teamRepo: ITeamRepository) {
        this.slackService = new SlackService(teamRepo);
    }

    public async initialize() {
        const storedInviteCode = await Storage.getSecret('teamInviteCode');
        if (storedInviteCode) {
            try {
                logger.info("TeamService", "Auto-rejoining team with stored invite code");
                await this.joinTeam(storedInviteCode, true);
            } catch (error) {
                logger.error("TeamService", "Failed to auto-rejoin team", error);
                await Storage.deleteSecret('teamInviteCode');
                await this.updateContext(false);
            }
        } else {
            await this.updateContext(false);
        }
    }

    public async createTeam(name: string): Promise<void> {
        try {
            const team = await this.teamRepo.createTeam(name);
            if (!team.invite_code) {
                logger.error("TeamService", "No invite code was generated.");
                throw new Error("No invite code was generated.");
            }
            const selection = await vscode.window.showInformationMessage(
                `Team '${team.name}' created successfully! Invite Code: ${team.invite_code}`,
                // { modal: true }, 
                'Copy Invite Code'
            );
            // TOOO: Once UI is ready, we may provide an option to retreive invite code per team
            if (selection === 'Copy Invite Code') {
                await vscode.env.clipboard.writeText(`Join my team '${team.name}' on LineBuzz using this invite code: ${team.invite_code!}`);
                vscode.window.showInformationMessage("All set. Invite code is ready to share.");
            }
            await this.setTeam(team);
        } catch (error: any) {
            logger.error("TeamService", "Error creating team", error);
            vscode.window.showErrorMessage("Failed to create team. Please try again.");
        }
    }

    public async joinTeam(inviteCode: string, autoJoin: boolean = false): Promise<void> {
        try {
            const team = await this.teamRepo.joinTeam(inviteCode);
            await this.setTeam(team);
            await Storage.setSecret('teamInviteCode', inviteCode);
            if (!autoJoin) {
                vscode.window.showInformationMessage(`Joined team '${team.name}' successfully!`);
            }
        } catch (error: any) {
            logger.error("TeamService", "Error joining team", error);
            vscode.window.showErrorMessage("Failed to join team. Please try again.");
        }
    }

    public async leaveTeam(showNotification: boolean = true): Promise<void> {
        this.currentTeam = undefined;
        this.slackConnected = false;
        this.slackChannel = null;
        this._onDidChangeSlackIntegration.fire(false);
        
        if (this.integrationSubscription) {
            this.integrationSubscription.unsubscribe();
            this.integrationSubscription = undefined;
            logger.info("TeamService", "Unsubscribed from integration changes");
        }
        
        this._onDidChangeTeam.fire(undefined);
        Storage.deleteGlobal("currentTeam");
        await Storage.deleteSecret("teamInviteCode");
        await this.updateContext(false);
        if (showNotification) {
            vscode.window.showInformationMessage("You have left the team.");
        }
    }

    private async setTeam(team: TeamInfo) {
        this.currentTeam = team;
        Storage.setGlobal("currentTeam", team);        
        if (team.invite_code) {
            await Storage.setSecret('teamInviteCode', team.invite_code);
        }

        try {
            this.slackConnected = await this.teamRepo.isSlackConnected(team.id);
            this.slackChannel = this.slackConnected && this.teamRepo.getSlackActiveChannel
                ? await this.teamRepo.getSlackActiveChannel(team.id)
                : null;
            this._onDidChangeSlackIntegration.fire(this.slackConnected);
        } catch (error) {
            logger.error("TeamService", "Failed to check initial slack connection", error);
            this.slackConnected = false;
            this.slackChannel = null;
        }
        
        try {
            if (this.integrationSubscription) {
                this.integrationSubscription.unsubscribe();
            }
            this.integrationSubscription = await this.slackService.listenForSlackIntegration(team.id);
            
            if (this.teamRepo.onSlackConnected) {
                this.teamRepo.onSlackConnected(async (isConnected: boolean) => {
                    const wasConnected = this.slackConnected;
                    const prevChannel = this.slackChannel;

                    this.slackConnected = isConnected;
                    this.slackChannel = isConnected && this.teamRepo.getSlackActiveChannel
                        ? await this.teamRepo.getSlackActiveChannel(team.id)
                        : null;

                    this._onDidChangeSlackIntegration.fire(isConnected);

                    const isAdmin = this.currentTeam?.role === 'admin';

                    if (isConnected) {
                        if (isAdmin) {
                            if (!wasConnected) {
                                this.slackService.showSlackConnectionNotification();
                            }
                        } else {
                            if (this.slackChannel && (!wasConnected || prevChannel !== this.slackChannel)) {
                                vscode.window.showInformationMessage(
                                    `Slack successfully connected! Syncing to #${this.slackChannel}`
                                );
                            }
                        }
                    }
                });
            }
            
            logger.info("TeamService", `Started listening for Slack integration changes for team: ${team.id}`);
        } catch (error) {
            logger.error("TeamService", "Failed to subscribe to integration changes", error);
        }
        
        await this.updateContext(true, team);
        this._onDidChangeTeam.fire(team);
    }

    public isSlackConnected(): boolean {
        return this.slackConnected;
    }

    public getSlackActiveChannelName(): string | null {
        return this.slackChannel;
    }

    private async updateContext(hasTeam: boolean, team?: TeamInfo) {
        await vscode.commands.executeCommand('setContext', 'linebuzz.hasTeam', hasTeam);
        const isAdmin = team?.role === 'admin';
        await vscode.commands.executeCommand('setContext', 'linebuzz.isAdmin', isAdmin);
    }

    public getTeam(): TeamInfo | undefined {
        return this.currentTeam;
    }

    public dispose() {
        this._onDidChangeTeam.dispose();
    }
}
