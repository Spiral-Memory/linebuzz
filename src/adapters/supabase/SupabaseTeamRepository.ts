import { ITeamRepository, TeamInfo } from "../interfaces/ITeamRepository";
import { SupabaseClient } from "./SupabaseClient";
import { logger } from "../../core/utils/logger";
import * as vscode from "vscode";

export class SupabaseTeamRepository implements ITeamRepository {
    private integrationSubscriptions: Map<string, any> = new Map();
    private _onSlackConnectedEvent = new vscode.EventEmitter<void>();
    public readonly onSlackConnectedEvent = this._onSlackConnectedEvent.event;

    public onSlackConnected(callback: () => void): void {
        this._onSlackConnectedEvent.event(callback);
    }

    async createTeam(name: string): Promise<TeamInfo> {
        const supabase = SupabaseClient.getInstance().client;
        logger.info("SupabaseTeamRepository", `Creating team: ${name}`);

        const { data, error } = await supabase.rpc('create_team_and_invite', {
            team_name: name
        });

        if (error) {
            logger.error("SupabaseTeamRepository", "RPC call failed", error);
            throw new Error(`RPC call failed: ${error.message}`);
        }

        const response = data as any;

        if (response.status === 'error') {
            throw new Error(response.message);
        }

        if (response.status === 'success' || response.status === 'TEAM_CREATED') {
            return {
                id: response.team_id,
                name: response.team_name,
                invite_code: response.invite_code,
                role: response.role
            };
        }

        throw new Error(`Unexpected response status: ${response.status}`);
    }

    async joinTeam(inviteCode: string): Promise<TeamInfo> {
        const supabase = SupabaseClient.getInstance().client;
        logger.info("SupabaseTeamRepository", `Joining team with code: ${inviteCode}`);

        const { data, error } = await supabase.rpc('join_team_with_code', {
            p_invite_code: inviteCode
        });

        if (error) {
            logger.error("SupabaseTeamRepository", "RPC call failed", error);
            throw new Error(`RPC call failed: ${error.message}`);
        }

        const response = data as any;

        if (response.status === 'error') {
            throw new Error(response.message);
        }

        if (response.status === 'warning') {
            return {
                id: response.team_id,
                name: response.team_name,
                role: response.role
            };
        }

        if (response.status === 'success') {
            return {
                id: response.team_id,
                name: response.team_name,
                role: response.role
            };
        }

        throw new Error(`Unexpected response status: ${response.status}`);
    }

    async generateSlackOAuthUrl(teamId: string): Promise<{ url: string } | { settings: any }> {
        const supabase = SupabaseClient.getInstance().client;
        logger.info("SupabaseTeamRepository", `Generating Slack OAuth URL for team: ${teamId}`);

        const { data, error } = await supabase.rpc('get_slack_install_url', {
            p_team_id: teamId
        });

        if (error) {
            logger.error("SupabaseTeamRepository", "RPC call failed", error);
            throw new Error(`RPC call failed: ${error.message}`);
        }

        const response = data as any;

        if (response.status === 'error') {
            switch (response.code) {
                case 'UNAUTH':
                    throw new Error("Authentication is required");
                case 'CONFIG_ERROR':
                    throw new Error("Slack configuration not found");
                case 'FORBIDDEN':
                    throw new Error("Only team admins can add Slack");
                default:
                    throw new Error(response.message || "Unknown error occurred");
            }
        }

        if (response.status === 'success') {
            switch (response.code) {
                case 'URL_GENERATED':
                    return { url: response.url };
                case 'ALREADY_CONNECTED':
                    return { settings: response.settings };
                default:
                    throw new Error(response.message || "Unknown error occurred");
            }
        }

        throw new Error(`Unexpected response status: ${response.status}`);
    }

    async listenForSlackIntegration(teamId: string): Promise<{ unsubscribe: () => void }> {
        try {
            const supabaseClient = SupabaseClient.getInstance();
            await supabaseClient.syncRealtimeAuth();
            const supabase = supabaseClient.client;

            logger.info("SupabaseTeamRepository", `Subscribing to Slack integration changes for team: ${teamId}`);

            const channel = supabase
                .channel(`team_integrations-${teamId}`)
                .on(
                    'postgres_changes',
                    {
                        event: 'INSERT',
                        schema: 'public',
                        table: 'team_integrations',
                        filter: `team_id=eq.${teamId}`
                    },
                    async (payload: any) => {
                        logger.info("SupabaseTeamRepository", 'Integration change detected', payload);

                        if (!payload.new) {
                            return;
                        }

                        if (payload.new.provider === 'slack') {
                            if (payload.new.access_token !== null) {
                                this._onSlackConnectedEvent.fire();
                            }
                        }
                    }
                )
                .subscribe((status) => {
                    logger.info("SupabaseTeamRepository", `Integration subscription status: ${status}`);
                });

            this.integrationSubscriptions.set(teamId, channel);

            return {
                unsubscribe: () => {
                    logger.info("SupabaseTeamRepository", `Unsubscribing from integration changes for team: ${teamId}`);
                    channel.unsubscribe();
                    this.integrationSubscriptions.delete(teamId);
                }
            };

        } catch (error: any) {
            logger.error("SupabaseTeamRepository", "Error subscribing to integration changes", error);
            throw error;
        }
    }



    unsubscribeAllIntegrations(): void {
        for (const [teamId, channel] of this.integrationSubscriptions) {
            logger.info("SupabaseTeamRepository", `Unsubscribing from integration changes for team: ${teamId}`);
            channel.unsubscribe();
        }
        this.integrationSubscriptions.clear();
    }

    public async updateActiveChannel(teamId: string, channelId: string): Promise<void> {
        try {
            const supabase = SupabaseClient.getInstance().client;
            const { error } = await supabase.rpc('set_slack_channel', {
                p_team_id: teamId,
                p_channel_id: channelId
            });

            if (error) {
                throw new Error(`Failed to update active channel: ${error.message}`);
            }

            logger.info("SupabaseTeamRepository", `Active channel updated to ${channelId} for team ${teamId}`);
        } catch (error: any) {
            logger.error("SupabaseTeamRepository", "Error updating active channel", error);
            throw error;
        }
    }

    public async disconnectSlack(teamId: string): Promise<void> {
        try {
            const supabase = SupabaseClient.getInstance().client;
            const { error } = await supabase.rpc('disconnect_slack', {
                p_team_id: teamId
            });

            if (error) {
                throw new Error(`Failed to disconnect Slack: ${error.message}`);
            }

            logger.info("SupabaseTeamRepository", `Slack integration disconnected for team ${teamId}`);
        } catch (error: any) {
            logger.error("SupabaseTeamRepository", "Error disconnecting Slack", error);
            throw error;
        }
    }

}
