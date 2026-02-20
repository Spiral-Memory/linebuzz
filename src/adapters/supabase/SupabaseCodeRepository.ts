import { SupabaseClient } from "./SupabaseClient";
import { logger } from "../../core/utils/logger";
import { ICodeRepository, CodeDiscussion } from "../interfaces/ICodeRepository";

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
            logger.info("SupabaseCodeRepository", "Code discussions retrieved successfully");
            return response.discussions;
        }

        throw new Error(`Unexpected response status: ${response.status}`);
    }

    async subscribeToCodeSnippets(teamId: string, userId: string, callback: (snippet: CodeDiscussion) => void): Promise<{ unsubscribe: () => void }> {
        logger.info("SupabaseCodeRepository", `Subscribing to code snippets for team: ${teamId}`);
        const supabaseClient = SupabaseClient.getInstance();
        await supabaseClient.syncRealtimeAuth();
        const supabase = supabaseClient.client;

        const channel = supabase
            .channel(`code_snippets-team-${teamId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'code_snippets',
                    filter: `team_id=eq.${teamId}`
                },
                async (payload) => {
                    logger.info("SupabaseCodeRepository", 'Realtime snippet payload received', payload);

                    if (!payload.new || !payload.new.message_id) {
                        logger.warn("SupabaseCodeRepository", "Payload missing message_id");
                        return;
                    }

                    try {
                        const discussions = await this.getDiscussionsByFile(payload.new.file_path, payload.new.remote_url, teamId);
                        const newDiscussion = discussions.find(d => d.id === payload.new.id);
                        if (newDiscussion) {
                            callback(newDiscussion);
                        } else {
                            logger.warn("SupabaseCodeRepository", `New snippet discussion not found after fetch: ${payload.new.id}`);
                        }
                    } catch (error) {
                        logger.error("SupabaseCodeRepository", "Failed to fetch discussion details for snippet", error);
                    }
                }
            )
            .subscribe((status) => {
                logger.info("SupabaseCodeRepository", `Subscription status for team ${teamId} snippets: ${status}`);
            });

        return {
            unsubscribe: () => {
                logger.info("SupabaseCodeRepository", `Unsubscribing from code snippets for team: ${teamId}`);
                channel.unsubscribe();
            }
        };
    }
}
