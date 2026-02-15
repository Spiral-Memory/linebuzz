import { MessageContent } from '../MessageContent/MessageContent';
import { getInitials } from '../../../utils/getInitials';
import { formatTime } from '../../../utils/formatTime';
import { getAvatarColor } from '../../../utils/getAvatarColor';
import styles from './MessageRow.module.css';

import { SnippetAttachment } from '../MessageAttachment/SnippetAttachment';
import { Snippet } from '../../../../types/IAttachment';

import { MessageResponse } from '../../../../types/IMessage';

interface MessageRowProps {
    message: MessageResponse;
    onOpenSnippet?: (snippet: Snippet, requestId?: string) => void;
    isHighlighted?: boolean;
    onReply?: (message: MessageResponse) => void;
}

export const MessageRow = ({ message, onOpenSnippet, isHighlighted, onReply }: MessageRowProps) => {
    const displayName = message.u?.display_name || message.u?.username || 'Unknown';
    const avatarUrl = message.u?.avatar_url;
    const initials = getInitials(displayName);
    const avatarColor = getAvatarColor(displayName);
    const isMe = message.userType === 'me';

    return (
        <div
            class={`${styles['message-row']} ${isMe ? styles['message-row-me'] : ''} ${isHighlighted ? styles['message-row-highlighted'] : ''}`}
            key={message.message_id}
            data-id={message.message_id}
        >
            <div class={styles['avatar-container']}>
                {avatarUrl ? (
                    <img
                        src={avatarUrl}
                        alt={displayName}
                        class={styles['avatar-image']}
                        onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                            ((e.target as HTMLImageElement).nextElementSibling as HTMLElement).style.display = 'flex';
                        }}
                    />
                ) : null}
                <div
                    class={styles['avatar-fallback']}
                    style={{
                        display: avatarUrl ? 'none' : 'flex',
                        backgroundColor: avatarColor,
                        color: '#fff'
                    }}
                >
                    {initials}
                </div>
            </div>
            <div class={styles['message-body']}>
                <div class={styles['message-header']}>
                    {!isMe && <span class={styles['user-name']}>{displayName}</span>}
                    <span class={styles['message-time']}>{formatTime(message.created_at)}</span>
                </div>
                {message.quoted_message && (
                    <div class={styles['quoted-message']}>
                        <div class={styles['quoted-user']}>
                            {message.quoted_message.u.display_name || message.quoted_message.u.username}
                        </div>
                        <div class={styles['quoted-content']}>
                            {message.quoted_message.content}
                        </div>
                    </div>
                )}
                <MessageContent content={message.content} isMe={isMe} />
                {message.attachments && message.attachments.length > 0 && (
                    <div class={styles['attachments-container']}>
                        {message.attachments.map((attachment: any, index: number) => {
                            if (attachment.type === 'code') {
                                return (
                                    <SnippetAttachment
                                        key={index}
                                        snippet={attachment as Snippet}
                                        onNavigate={(s, rid) => onOpenSnippet?.(s, rid)}
                                    />
                                );
                            }
                            return null;
                        })}
                    </div>
                )}
            </div>
            <div class={styles['actions-container']}>
                <div class={styles['action-button']} onClick={() => onReply?.(message)} title="Reply">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M9 14L4 9L9 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                        <path d="M4 9H14C18.4183 9 22 12.5817 22 17V20" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                    </svg>
                </div>
                {isMe && (
                    <>
                        <div class={styles['action-button']} title="Edit">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M11 4H4C3.46957 4 2.96086 4.21071 2.58579 4.58579C2.21071 4.96086 2 5.46957 2 6V20C2 20.5304 2.21071 21.0391 2.58579 21.4142C2.96086 21.7893 3.46957 22 4 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V13" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                                <path d="M18.5 2.50001C18.8978 2.10219 19.4374 1.87869 20 1.87869C20.5626 1.87869 21.1022 2.10219 21.5 2.50001C21.8978 2.89784 22.1213 3.4374 22.1213 4.00001C22.1213 4.56262 21.8978 5.10219 21.5 5.50001L12 15L8 16L9 12L18.5 2.50001Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                            </svg>
                        </div>
                        <div class={styles['action-button']} title="Delete">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M3 6H5H21" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                                <path d="M8 6V4C8 3.46957 8.21071 2.96086 8.58579 2.58579C8.96086 2.21071 9.46957 2 10 2H14C14.5304 2 15.0391 2.21071 15.4142 2.58579C15.7893 2.96086 16 3.46957 16 4V6M19 6V20C19 20.5304 18.7893 21.0391 18.4142 21.4142C18.0391 21.7893 17.5304 22 17 22H7C6.46957 22 5.96086 21.7893 5.58579 21.4142C5.21071 21.0391 5 20.5304 5 20V6H19Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                            </svg>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};
