export interface TeamInfo {
    id: string;
    name: string;
    invite_code?: string;
    role?: string;
}

export interface ITeamRepository {
    createTeam(name: string): Promise<TeamInfo>;
    joinTeam(inviteCode: string): Promise<TeamInfo>;
    generateSlackOAuthUrl(teamId: string): Promise<{ url: string }>;
}
