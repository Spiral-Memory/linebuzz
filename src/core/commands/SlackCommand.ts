import * as vscode from "vscode";
import { Container } from "../services/ServiceContainer";
import { SlackService } from "../services/SlackService";
import { logger } from "../utils/logger";

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
            const uriScheme = vscode.env.uriScheme || "vscode";
            const urlObj = new URL(result.url);
            const stateVal = urlObj.searchParams.get("state");
            if (stateVal) {
                urlObj.searchParams.set("state", `${stateVal}:${uriScheme}`);
            }
            await vscode.env.openExternal(vscode.Uri.parse(urlObj.toString()));
            vscode.window.showInformationMessage(
                "Slack connection URL generated. Please open the link to complete the authorization."
            );
        } else if ('settings' in result) {
            await slackService.showSlackChannelDialog();
        }

    } catch (error: any) {
        logger.error("SlackCommand", "Slack connection failed", error);
        vscode.window.showErrorMessage(
            "Slack connection failed. Please contact your host administrator to verify the configuration."
        );
    }
}
