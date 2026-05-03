import * as vscode from "vscode";
import { Container } from "../services/ServiceContainer";

export async function openSlackCommand() {
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

    await vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Notification,
            title: "Connecting Slack to your team workspace...",
            cancellable: false
        },
        async () => {
            try {
                const teamRepo = (teamService as any).teamRepo;
                const { url } = await teamRepo.generateSlackOAuthUrl(currentTeam.id);

                await vscode.env.openExternal(vscode.Uri.parse(url));

                vscode.window.showInformationMessage(
                    "Slack connection URL generated. Please open the link to complete the authorization."
                );

            } catch (error: any) {
                const errorMessage = error.message || "Failed to connect Slack";
                vscode.window.showErrorMessage(`Slack connection failed: ${errorMessage}`);
            }
        }
    );
}
