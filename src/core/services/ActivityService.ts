import * as vscode from "vscode";
import { IActivityRepository, TypingPayload } from "../../adapters/interfaces/IActivityRepository";
import { logger } from "../utils/logger";
import { Container } from "./ServiceContainer";

export class ActivityService {
    constructor(private activityRepo: IActivityRepository) { }

    public async sendTypingSignal(): Promise<void> {
        try {
            const teamService = Container.get("TeamService");
            const authService = Container.get("AuthService");
            
            const currentTeam = teamService.getTeam();
            const session = await authService.getSession();

            if (!currentTeam || !session) {
                return;
            }

            await this.activityRepo.sendTypingSignal(
                currentTeam.id, 
                session.user_id, 
                session.username || "Someone"
            );
            
        } catch (error: any) {
            logger.error("ActivityService", "Error sending typing signal", error);
        }
    }

    public async subscribeToTyping(
        onTyping: (payload: TypingPayload) => void
    ): Promise<{ unsubscribe: () => void } | void> {
        try {
            const teamService = Container.get("TeamService");
            const authService = Container.get("AuthService");

            const currentTeam = teamService.getTeam();
            const session = await authService.getSession();

            if (!currentTeam || !session) {
                return;
            }

            const subscription = await this.activityRepo.subscribeToTyping(
                currentTeam.id, 
                session.user_id, 
                (payload) => {
                    onTyping(payload);
                }
            );

            logger.info("ActivityService", `Subscribed to typing for team ${currentTeam.id}`);
            return subscription;

        } catch (error: any) {
            logger.error("ActivityService", "Error subscribing to typing indicators", error);
        }
    }
}