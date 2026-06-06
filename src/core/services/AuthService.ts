
import * as vscode from "vscode";
import { Container } from "./ServiceContainer";
import { IAuthRepository, AuthSession } from '../../adapters/interfaces/IAuthRepository';
import { logger } from "../utils/logger";
import { Storage } from "../platform/storage";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "../platform/config";
import { isVersionGte } from "../utils/version";

export interface VersionCheckResult {
    compatible: boolean;
    error?: string;
}

export class AuthService {

    private _onDidChangeSession = new vscode.EventEmitter<AuthSession | null>();
    public readonly onDidChangeSession = this._onDidChangeSession.event;

    constructor(private authRepo: IAuthRepository) { }

    public async checkVersionCompatibility(url: string, publishableKey: string, isCustom?: boolean): Promise<VersionCheckResult> {
        try {
            const res = await fetch(`${url}/rest/v1/app_metadata?limit=1`, {
                method: "GET",
                headers: {
                    "apikey": publishableKey,
                    "Authorization": `Bearer ${publishableKey}`
                }
            });
            if (res.status !== 200) {
                return {
                    compatible: false,
                    error: isCustom
                        ? "Couldn't connect to a compatible LineBuzz server. Please verify the URL and publishable key."
                        : "Couldn't connect to a compatible LineBuzz server."
                };
            }

            const json = await res.json();
            const minVersion = json?.[0]?.min_client_version;
            if (!minVersion) {
                return { compatible: false, error: "Failed to retrieve version requirement from server." };
            }

            const currentVersion = vscode.extensions.getExtension("SpiralMemory.linebuzz")?.packageJSON.version || "0.0.0";
            if (!isVersionGte(currentVersion, minVersion)) {
                return {
                    compatible: false,
                    error: `Your LineBuzz extension is outdated (v${currentVersion}). Minimum required version is v${minVersion}. Please upgrade.`
                };
            }
            return { compatible: true };
        } catch (error) {
            logger.error("AuthService", "Version check failed:", error);
            return {
                compatible: false,
                error: isCustom
                    ? "Failed to connect to host. Please verify the URL and publishable key."
                    : "Failed to connect to host."
            };
        }
    }

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

            const url = Storage.getGlobal<string>("custom_supabase_url") || SUPABASE_URL;
            const publishableKey = Storage.getGlobal<string>("custom_supabase_publishable_key") || SUPABASE_PUBLISHABLE_KEY;
            const versionResult = await this.checkVersionCompatibility(url, publishableKey);
            if (!versionResult.compatible) {
                if (showNotification && versionResult.error) {
                    vscode.window.showErrorMessage(versionResult.error);
                }
                await this.signOut();
                return null;
            }

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

