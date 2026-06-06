import { IActivityRepository, TypingPayload } from "../interfaces/IActivityRepository";
import { SupabaseClient } from "./SupabaseClient";
import { logger } from "../../core/utils/logger";

export class SupabaseActivityRepository implements IActivityRepository {

    async sendTypingSignal(teamId: string, userId: string, username: string): Promise<void> {
        const supabaseClient = SupabaseClient.getInstance();
        await supabaseClient.syncRealtimeAuth();
        const supabase = supabaseClient.client;
        const channel = supabase.channel(`typing-team-${teamId}`);

        const response = await channel.send({
            type: 'broadcast',
            event: 'typing',
            payload: { userId, username }
        });

        if (response !== 'ok') {
            logger.error("SupabaseActivityRepository", `Broadcast failed: ${response}`);
        }
    }

    async subscribeToTyping(
        teamId: string,
        userId: string,
        callback: (payload: TypingPayload) => void
    ): Promise<{ unsubscribe: () => void }> {

        logger.info("SupabaseActivityRepository", `Subscribing to typing indicators for team: ${teamId}`);

        const supabaseClient = SupabaseClient.getInstance();
        await supabaseClient.syncRealtimeAuth();
        const supabase = supabaseClient.client;
        const channel = supabase.channel(`typing-team-${teamId}`);

        channel
            .on('broadcast', { event: 'typing' }, (response) => {
                const payload = response.payload as TypingPayload;

                if (payload.userId !== userId) {
                    callback(payload);
                }
            })
            .subscribe((status) => {
                logger.info("SupabaseActivityRepository", `Typing channel status: ${status}`);
            });

        return {
            unsubscribe: () => {
                logger.info("SupabaseActivityRepository", `Unsubscribing from typing for team: ${teamId}`);
                channel.unsubscribe();
            }
        };
    }
}