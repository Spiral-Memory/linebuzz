import * as vscode from "vscode";
import { Container } from "../services/ServiceContainer";
import { Storage } from "../platform/storage";

export async function loginCommand({ createIfNone = true }: { createIfNone?: boolean } = {}) {
    if (createIfNone) {
        Storage.setGlobal("explicitly_signed_out", false);
    }
    const session = await vscode.authentication.getSession("github", ["user"], { createIfNone });
    const authService = Container.get('AuthService');

    if (createIfNone && session) {
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Logging into LineBuzz...",
            cancellable: false
        }, async () => {
            await authService.initializeSession(session, true);
        });
    } else {
        await authService.initializeSession(session, createIfNone);
    }
}
