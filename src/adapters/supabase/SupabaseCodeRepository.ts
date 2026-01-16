import { SupabaseClient } from "./SupabaseClient";
import { logger } from "../../core/utils/logger";
import { ICodeRepository, CodeDiscussion} from "../interfaces/ICodeRepository";

export class SupabaseCodeRepository implements ICodeRepository {
    async getDiscussionsByFile(file_path: string, remote_url: string, teamId: string): Promise<CodeDiscussion[]> {
        const supabase = SupabaseClient.getInstance().client;
        logger.info("SupabaseCodeRepository", `Getting code discussions for file: ${file_path} in team: ${teamId}`);

        const { data, error } = await supabase.rpc('get_code_discussions', {
            p_team_id: teamId,
            p_file_path: file_path,
            p_remote_url: remote_url,
        });
        if (error) {
            logger.error("SupabaseCodeRepository", "RPC call failed", error);
            throw new Error(`RPC call failed: ${error.message}`);
        }

        const response = data as any;

        if (response.status === 'error') {
            throw new Error(response.message);
        }

        if (response.status === 'success') {
            logger.info("SupabaseCodeRepository", `Discussions retrieved successfully: ${JSON.stringify(response.discussions)}`);
            return response.discussions;
        }

        throw new Error(`Unexpected response status: ${response.status}`);
    }
}
