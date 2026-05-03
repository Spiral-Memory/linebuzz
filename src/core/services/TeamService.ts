import * as vscode from "vscode";
import { ITeamRepository, TeamInfo } from "../../adapters/interfaces/ITeamRepository";
import { Storage } from "../platform/storage";
import { logger } from "../utils/logger";

export class TeamService {
    private currentTeam: TeamInfo | undefined;

    private _onDidChangeTeam = new vscode.EventEmitter<TeamInfo | undefined>();
    public readonly onDidChangeTeam = this._onDidChangeTeam.event;

    constructor(private teamRepo: ITeamRepository) { }

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
        Storage.deleteGlobal("currentTeam");
        await Storage.deleteSecret("teamInviteCode");
        await this.updateContext(false);
        this._onDidChangeTeam.fire(undefined);
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
        
        await this.updateContext(true, team);
        this._onDidChangeTeam.fire(team);
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
