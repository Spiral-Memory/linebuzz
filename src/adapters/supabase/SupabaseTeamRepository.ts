import { ITeamRepository, TeamInfo } from "../interfaces/ITeamRepository";
import { SupabaseClient } from "./SupabaseClient";
import { logger } from "../../core/utils/logger";

export class SupabaseTeamRepository implements ITeamRepository {
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

    async generateSlackOAuthUrl(teamId: string): Promise<{ url: string }> {
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

        if (response.status === 'success' && response.code === 'URL_GENERATED') {
            return { url: response.url };
        }

        throw new Error(`Unexpected response status: ${response.status}`);
    }


}
