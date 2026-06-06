import { useState, useEffect, useRef } from 'preact/hooks';
import { vscode } from '../utils/vscode';

interface TypingUser {
    userId: string;
    username: string;
    lastTypedAt: number;
}

export const useTyping = () => {
    const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
    const lastSentTypingRef = useRef<number>(0);

    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            const message = event.data;
            if (message.command === 'typing') {
                const { userId, username } = message.payload;

                setTypingUsers(prev => {
                    const otherUsers = prev.filter(u => u.userId !== userId);
                    return [...otherUsers, { userId, username, lastTypedAt: Date.now() }];
                });
            } else if (message.command === 'appendMessage') {
                const { user_id } = message.message.u;
                setTypingUsers(prev => prev.filter(u => u.userId !== user_id));
            }
        };

        window.addEventListener('message', handleMessage);

        const intervalId = setInterval(() => {
            const now = Date.now();
            setTypingUsers(prev => prev.filter(u => now - u.lastTypedAt < 3000));
        }, 1000);

        return () => {
            window.removeEventListener('message', handleMessage);
            clearInterval(intervalId);
        };
    }, []);

    const sendTyping = () => {
        const now = Date.now();
        if (now - lastSentTypingRef.current > 2000) {
            vscode.postMessage({ command: 'sendTyping' });
            lastSentTypingRef.current = now;
        }
    };

    return {
        typingUsers,
        sendTyping
    };
};
