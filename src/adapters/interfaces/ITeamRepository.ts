export interface TeamInfo {
    id: string;
    name: string;
    invite_code?: string;
    role?: string;
}

export interface ITeamRepository {
    createTeam(name: string): Promise<TeamInfo>;
    joinTeam(inviteCode: string): Promise<TeamInfo>;
    generateSlackOAuthUrl(teamId: string): Promise<{ url: string } | { settings: any }>;
    listenForSlackIntegration(teamId: string): Promise<{ unsubscribe: () => void }>;
    onSlackConnected?(callback: () => void): void;
    updateActiveChannel(teamId: string, channelId: string): Promise<void>;
    disconnectSlack(teamId: string): Promise<void>;
}
