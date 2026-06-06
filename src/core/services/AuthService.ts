
import * as vscode from "vscode";
import { Container } from "./ServiceContainer";
import { IAuthRepository, AuthSession } from '../../adapters/interfaces/IAuthRepository';
import { logger } from "../utils/logger";
import { Storage } from "../platform/storage";

export class AuthService {

    private _onDidChangeSession = new vscode.EventEmitter<AuthSession | null>();
    public readonly onDidChangeSession = this._onDidChangeSession.event;

    constructor(private authRepo: IAuthRepository) { }

    public async getSession(): Promise<AuthSession | null> {
        try {
            return await this.authRepo.getSession();
        } catch (error) {
            logger.error("AuthService", "Failed to retrieve session:", error);
            return null;
        }
    }

    public async initializeSession(githubSession: vscode.AuthenticationSession | undefined, showNotification: boolean = true): Promise<AuthSession | null> {
        const explicitlySignedOut = Storage.getGlobal<boolean>("explicitly_signed_out") || false;
        if (!githubSession || explicitlySignedOut) {
            await this.authRepo.signOut();
            const teamService = Container.get("TeamService");
            teamService.leaveTeam(false);
            vscode.commands.executeCommand('setContext', 'extension.isLoggedIn', false);
            this._onDidChangeSession.fire(null);
            return null;
        }

        logger.info("AuthService", `GitHub token available for: ${githubSession.account.label}`);

        try {
            const session = await Promise.race([
                this.authRepo.exchangeTokenForSession(githubSession.accessToken),
                new Promise<AuthSession>((_, reject) => 
                    setTimeout(() => reject(new Error("Connection timed out. Please check if host server is running.")), 15000)
                )
            ]);
            logger.info("AuthService", "Secure session established with backend.");
            if (showNotification) {
                vscode.window.showInformationMessage(`Logged in as ${session.username}`);
            }
            vscode.commands.executeCommand('setContext', 'extension.isLoggedIn', true);
            this._onDidChangeSession.fire(session);
            return session;

        } catch (error: any) {
            logger.error("AuthService", "Token exchange failed:", error);
            if (showNotification) {
                const msg = error.message?.includes("timed out") ? error.message : "Failed to log in. Please try again.";
                vscode.window.showErrorMessage(msg);
            }
            vscode.commands.executeCommand('setContext', 'extension.isLoggedIn', false);
            this._onDidChangeSession.fire(null);
            return null;
        }
    }

    public async signOut(): Promise<void> {
        try {
            await this.authRepo.signOut();
        } catch (error) {
            logger.error("AuthService", "Failed to sign out:", error);
        }
        Storage.setGlobal("explicitly_signed_out", true);
        const teamService = Container.get("TeamService");
        teamService.leaveTeam(false);
        vscode.commands.executeCommand('setContext', 'extension.isLoggedIn', false);
        this._onDidChangeSession.fire(null);
    }

    public dispose() {
        this._onDidChangeSession.dispose();
    }
}

