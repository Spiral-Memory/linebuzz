import { useEffect, useLayoutEffect, useState, useRef } from 'preact/hooks';
import { ChatInput } from '../../components/chat/ChatInput/ChatInput';
import { MessageRow } from '../../components/chat/MessageRow/MessageRow';
import { MessageResponse } from '../../../types/IMessage';
import { WelcomeSplash } from '../../components/chat/WelcomeSplash/WelcomeSplash';
import { LoadingSpinner } from '../../components/ui/Loaders/LoadingSpinner';
import { Snippet } from '../../../types/IAttachment';
import { vscode } from '../../utils/vscode';
import styles from './ChatView.module.css';

interface ChatViewProps {
    stagedSnippet?: Snippet[] | [];
    onClearSnippet?: () => void;
    onRemoveSnippet?: (index: number) => void;
    onOpenSnippet?: (snippet: Snippet) => void;
}

export const ChatView = ({ stagedSnippet, onClearSnippet, onRemoveSnippet, onOpenSnippet }: ChatViewProps) => {
    const [messages, setMessages] = useState<MessageResponse[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [unreadCount, setUnreadCount] = useState(0);
    const [showScrollButton, setShowScrollButton] = useState(false);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const chatContainerRef = useRef<HTMLDivElement>(null);
    const messageListRef = useRef<HTMLDivElement>(null);
    const topSentinelRef = useRef<HTMLDivElement>(null);
    const bottomSentinelRef = useRef<HTMLDivElement>(null);
    const cachedMessagesRef = useRef<MessageResponse[]>([]);
    const snapshotRef = useRef<{ id: string; offset: number } | null>(null);
    const isAtBottomRef = useRef(true);
    const isInitialLoadRef = useRef(true);

    const FETCH_LIMIT = 50;
    const MAX_DOM_MESSAGE = 150;
    const MAX_CACHED_MESSAGE = 5000;
    const SCROLL_THRESHOLD = 400;

    const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior });
            setUnreadCount(0);
        }
    };


    useLayoutEffect(() => {
        if (snapshotRef.current && messageListRef.current) {
            const { id, offset } = snapshotRef.current;
            const node = messageListRef.current.querySelector(`[data-id="${id}"]`) as HTMLElement;

            if (node) {
                const currentOffset = node.offsetTop;
                const scrollDiff = currentOffset - offset;
                messageListRef.current.scrollTop += scrollDiff;
            }
            snapshotRef.current = null;
        } else if (isInitialLoadRef.current && messages.length > 0) {
            requestAnimationFrame(() => {
                scrollToBottom('smooth');
            });
        } else if (isAtBottomRef.current) {
            scrollToBottom('smooth');
        }
    }, [messages]);


    useEffect(() => {
        const observerCallback = (entries: IntersectionObserverEntry[]) => {
            entries.forEach(entry => {
                if (!entry.isIntersecting) return;

                if (isInitialLoadRef.current) return;

                if (entry.target === topSentinelRef.current && !isLoading) {
                    handleLoadOlder();
                } else if (entry.target === bottomSentinelRef.current) {
                    handleLoadNewer();
                }
            });
        };

        const observer = new IntersectionObserver(observerCallback, {
            root: messageListRef.current,
            rootMargin: '200px',

            threshold: 0.1
        });

        if (topSentinelRef.current) observer.observe(topSentinelRef.current);
        if (bottomSentinelRef.current) observer.observe(bottomSentinelRef.current);

        return () => observer.disconnect();
    }, [messages, isLoading, hasMore]);

    const captureSnapshot = () => {
        if (!messageListRef.current) return;
        const topMsg = messages[0];
        if (topMsg) {
            const node = messageListRef.current.querySelector(`[data-id="${topMsg.message_id}"]`) as HTMLElement;
            if (node) {
                snapshotRef.current = { id: topMsg.message_id, offset: node.offsetTop };
            }
        }
    };

    const handleLoadOlder = () => {
        if (isLoading) return;
        const topMsgId = messages[0]?.message_id;
        const cacheIndex = cachedMessagesRef.current.findIndex(m => m.message_id === topMsgId);

        if (cacheIndex > 0) {
            const newStartIndex = Math.max(0, cacheIndex - 20);
            const newSlice = cachedMessagesRef.current.slice(newStartIndex, newStartIndex + MAX_DOM_MESSAGE);
            captureSnapshot();
            setMessages(newSlice);

        } else if (hasMore) {
            setIsLoading(true);
            const currentCacheSize = cachedMessagesRef.current.length;
            captureSnapshot();
            vscode.postMessage({ command: 'getMessages', limit: FETCH_LIMIT, offset: currentCacheSize });
        }
    };

    const handleLoadNewer = () => {
        const bottomMsgId = messages[messages.length - 1]?.message_id;
        const cacheIndex = cachedMessagesRef.current.findIndex(m => m.message_id === bottomMsgId);

        if (cacheIndex !== -1 && cacheIndex < cachedMessagesRef.current.length - 1) {
            const newEndIndex = Math.min(cachedMessagesRef.current.length, cacheIndex + 21);
            const newStartIndex = Math.max(0, newEndIndex - MAX_DOM_MESSAGE);
            const newSlice = cachedMessagesRef.current.slice(newStartIndex, newEndIndex);
            const newTopMsg = newSlice[0];
            const node = messageListRef.current?.querySelector(`[data-id="${newTopMsg.message_id}"]`) as HTMLElement;
            if (node) {
                snapshotRef.current = { id: newTopMsg.message_id, offset: node.offsetTop };
            }
            setMessages(newSlice);
        }
    };


    const onScroll = () => {
        if (!messageListRef.current) return;
        const { scrollTop, scrollHeight, clientHeight } = messageListRef.current;
        const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
        const isAtBottom = distanceFromBottom < 50;
        isAtBottomRef.current = isAtBottom;

        if (!isInitialLoadRef.current) {
            setShowScrollButton(distanceFromBottom > SCROLL_THRESHOLD);
        }

        if (isAtBottom && unreadCount > 0) setUnreadCount(0);
        if (isAtBottom && isInitialLoadRef.current) {
            isInitialLoadRef.current = false;
        }
    };

    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            const message = event.data;
            switch (message.command) {
                case 'loadInitialMessages':
                    cachedMessagesRef.current = message.messages;
                    setMessages(message.messages.slice(-MAX_DOM_MESSAGE));
                    setHasMore(message.messages.length >= FETCH_LIMIT);
                    setIsLoading(false);
                    isInitialLoadRef.current = true;

                    break;
                case 'prependMessages':
                    const newMessages = message.messages;
                    cachedMessagesRef.current = [...newMessages, ...cachedMessagesRef.current];
                    if (cachedMessagesRef.current.length > MAX_CACHED_MESSAGE) {
                        cachedMessagesRef.current = cachedMessagesRef.current.slice(0, MAX_CACHED_MESSAGE);
                    }

                    setMessages(prev => {
                        const combined = [...newMessages, ...prev];

                        if (combined.length > MAX_DOM_MESSAGE) {
                            return combined.slice(0, MAX_DOM_MESSAGE);
                        }
                        return combined;
                    });

                    setHasMore(newMessages.length >= FETCH_LIMIT);
                    setIsLoading(false);
                    break;
                case 'appendMessage':
                    const msg = message.message;
                    cachedMessagesRef.current = [...cachedMessagesRef.current, msg];
                    if (cachedMessagesRef.current.length > MAX_CACHED_MESSAGE) {
                        cachedMessagesRef.current = cachedMessagesRef.current.slice(-MAX_CACHED_MESSAGE);
                    }

                    setMessages(prev => {
                        const next = [...prev, msg];
                        if (next.length > MAX_DOM_MESSAGE) {
                            if (isAtBottomRef.current) {
                                return next.slice(-MAX_DOM_MESSAGE);
                            }
                            return prev;
                        }
                        return next;
                    });

                    if (msg.userType === 'me') {
                        isAtBottomRef.current = true;
                    } else if (!isAtBottomRef.current) {
                        setUnreadCount(prev => prev + 1);
                    }
                    break;
            }
        };

        window.addEventListener('message', handleMessage);
        vscode.postMessage({ command: 'getMessages', limit: FETCH_LIMIT, offset: 0 });

        return () => {
            window.removeEventListener('message', handleMessage);
        };
    }, []);

    return (
        <div class={styles['chat-view-container']} ref={chatContainerRef}>
            {messages.length === 0 ? (
                <div class={styles['splash-container']}>
                    <WelcomeSplash />
                </div>
            ) : (
                <div class={styles['message-list']} ref={messageListRef} onScroll={onScroll}>
                    <div ref={topSentinelRef} style={{ height: '20px', width: '100%' }} />
                    {isLoading && <LoadingSpinner />}
                    {messages.map((msg) => {
                        return (
                            <MessageRow
                                message={msg}
                                key={msg.message_id}
                                onOpenSnippet={onOpenSnippet}
                            />
                        );
                    })}
                    <div ref={bottomSentinelRef} style={{ height: '20px', width: '100%' }} />
                    <div ref={messagesEndRef} />
                    {(unreadCount > 0 || showScrollButton) && (
                        <div class={styles['new-messages-indicator']} onClick={() => scrollToBottom('smooth')}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M7 13L12 18L17 13M7 6L12 11L17 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                            </svg>
                            {unreadCount > 0 && <span class={styles['indicator-count']}>{unreadCount}</span>}
                        </div>
                    )
                    }
                </div >
            )}
            <div class={styles['chat-input-container']}>
                <ChatInput
                    stagedSnippet={stagedSnippet}
                    onClearSnippet={onClearSnippet}
                    onRemoveSnippet={onRemoveSnippet}
                    onOpenSnippet={onOpenSnippet}
                />
            </div>
        </div >
    );
};