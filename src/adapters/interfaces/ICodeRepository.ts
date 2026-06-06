import { Snippet } from "../../types/IAttachment";
import { MessageResponse } from "../../types/IMessage";


export interface CodeDiscussion extends Snippet {
    id: string;
    created_at: string;
    message: Pick<MessageResponse, 'message_id' | 'content' | 'u'>;
}

export interface ICodeRepository {
    getDiscussionsByFile(file_path: string, remote_url: string, team_id: string): Promise<CodeDiscussion[]>;
    subscribeToCodeSnippets(teamId: string, userId: string, callback: (snippet: CodeDiscussion) => void): Promise<{ unsubscribe: () => void }>;
}
