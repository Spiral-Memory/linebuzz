import styles from './TypingIndicator.module.css';

interface TypingIndicatorProps {
    typingUsers: { userId: string; username: string }[];
}

export const TypingIndicator = ({ typingUsers }: TypingIndicatorProps) => {
    let text = '';
    const isTyping = typingUsers && typingUsers.length > 0;

    if (isTyping) {
        if (typingUsers.length === 1) {
            text = `${typingUsers[0].username} is typing...`;
        } else if (typingUsers.length === 2) {
            text = `${typingUsers[0].username} & ${typingUsers[1].username} are typing...`;
        } else {
            text = 'Multiple users are typing...';
        }
    }

    return (
        <div
            class={styles['typing-indicator-container']}
            style={{ visibility: isTyping ? 'visible' : 'hidden' }}
        >
            <span class={styles['typing-text']}>{text}</span>
        </div>
    );
};
