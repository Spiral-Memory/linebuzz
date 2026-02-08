import * as vscode from "vscode";
import { Container } from "../services/ServiceContainer";
import { Input } from "../platform/input";

export async function createTeamCommand() {
    const name = await Input.showInputBox({
        placeHolder: "Enter team name",
        prompt: "Create a new team"
    });

    if (!name) {
        return;
    }

    const teamService = Container.get("TeamService");
    await teamService.createTeam(name);
}


export async function joinTeamCommand() {
    const inviteCode = await Input.showInputBox({
        placeHolder: "Enter invite code",
        prompt: "Join an existing team"
    });

    if (!inviteCode) {
        return;
    }

    const teamService = Container.get("TeamService");
    await teamService.joinTeam(inviteCode);
}

export async function leaveTeamCommand() {
    const confirm = await vscode.window.showWarningMessage(
        "Are you sure you want to leave the team?",
        { modal: true },
        "Yes",
        "No"
    );

    if (confirm !== "Yes") {
        return;
    }

    const teamService = Container.get("TeamService");
    await teamService.leaveTeam();
}
