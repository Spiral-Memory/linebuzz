import * as vscode from "vscode";
import { Container } from "../services/ServiceContainer";
import { SlackService } from "../services/SlackService";

export async function syncSlackCommand() {
    const teamService = Container.get("TeamService");
    const currentTeam = teamService.getTeam();

    if (!currentTeam) {
        vscode.window.showErrorMessage('No team found. Please join or create a team first.');
        return;
    }

    if (currentTeam.role !== 'admin') {
        vscode.window.showErrorMessage('Only team admins can connect Slack.');
        return;
    }

    try {
        const teamRepo = (teamService as any).teamRepo;
        const slackService = new SlackService(teamRepo);
        const result = await slackService.generateSlackOAuthUrl(currentTeam.id);

        if ('url' in result) {
            await vscode.env.openExternal(vscode.Uri.parse(result.url));
            vscode.window.showInformationMessage(
                "Slack connection URL generated. Please open the link to complete the authorization."
            );
        } else if ('settings' in result) {
            await slackService.showSlackChannelDialog();
        }

    } catch (error: any) {
        const errorMessage = error.message || "Failed to connect Slack";
        vscode.window.showErrorMessage(`Slack connection failed: ${errorMessage}`);
    }
}
