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
    const [hasOlder, setHasOlder] = useState(true);
    const [hasNewer, setHasNewer] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);
    const [showScrollButton, setShowScrollButton] = useState(false);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const messageListRef = useRef<HTMLDivElement>(null);
    const topSentinelRef = useRef<HTMLDivElement>(null);
    const bottomSentinelRef = useRef<HTMLDivElement>(null);
    const cachedMessagesRef = useRef<MessageResponse[]>([]);
    const snapshotRef = useRef<{ id: string; offset: number } | null>(null);
    const isAtBottomRef = useRef(true);
    const isInitialLoadRef = useRef(true);
    const shouldScrollToBottomRef = useRef(false);
    const oldestMessageOffsetRef = useRef(0);
    const messagesRef = useRef<MessageResponse[]>([]);

    const FETCH_LIMIT = 50;
    const MAX_DOM_MESSAGE = 150;
    const MAX_CACHED_MESSAGE = 5000;
    const SCROLL_THRESHOLD = 400;

    const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
        if (messageListRef.current) {
            if (behavior === 'auto') {
                messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
            } else if (messagesEndRef.current) {
                messagesEndRef.current.scrollIntoView({ behavior });
            }
            setUnreadCount(0);
        }
    };

    useLayoutEffect(() => {
        if (shouldScrollToBottomRef.current) {
            snapshotRef.current = null;
            scrollToBottom('auto');
            shouldScrollToBottomRef.current = false;
            return;
        }

        if (isInitialLoadRef.current) {
            snapshotRef.current = null;
            requestAnimationFrame(() => {
                scrollToBottom('auto');
                isInitialLoadRef.current = false;
            });
            return;
        }

        if (snapshotRef.current && messageListRef.current) {
            const { id, offset } = snapshotRef.current;
            const node = messageListRef.current.querySelector(`[data-id="${id}"]`) as HTMLElement;

            if (node) {
                const currentOffset = node.offsetTop;
                const scrollDiff = currentOffset - offset;
                messageListRef.current.scrollTop += scrollDiff;
            }
            snapshotRef.current = null;
            return;
        }
    }, [messages]);

    useEffect(() => {
        messagesRef.current = messages;
    }, [messages]);


    useEffect(() => {
        const observerCallback = (entries: IntersectionObserverEntry[]) => {
            entries.forEach(entry => {
                if (!entry.isIntersecting) return;

                if (isInitialLoadRef.current || shouldScrollToBottomRef.current) return;

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
    }, [messages, isLoading, hasOlder, hasNewer]);

    const captureSnapshot = (targetMsg: MessageResponse) => {
        if (!messageListRef.current) return;

        if (targetMsg) {
            const node = messageListRef.current.querySelector(
                `[data-id="${targetMsg.message_id}"]`
            ) as HTMLElement;

            if (node) {
                snapshotRef.current = {
                    id: targetMsg.message_id,
                    offset: node.offsetTop
                };
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
            captureSnapshot(messages[0]);
            setMessages(newSlice);

        } else if (hasOlder) {
            setIsLoading(true);
            const currentCacheSize = oldestMessageOffsetRef.current;
            captureSnapshot(messages[0]);
            vscode.postMessage({ command: 'getMessages', limit: FETCH_LIMIT, offset: currentCacheSize, intent: 'paginate-older' });
        }
    };

    const handleLoadNewer = () => {
        if (isLoading) return;

        const bottomMsgId = messages[messages.length - 1]?.message_id;
        const cacheIndex = cachedMessagesRef.current.findIndex(m => m.message_id === bottomMsgId);

        if (cacheIndex !== -1 && cacheIndex < cachedMessagesRef.current.length - 1) {
            const newEndIndex = Math.min(cachedMessagesRef.current.length, cacheIndex + 21);
            const newStartIndex = Math.max(0, newEndIndex - MAX_DOM_MESSAGE);
            const newSlice = cachedMessagesRef.current.slice(newStartIndex, newEndIndex);

            captureSnapshot(newSlice[0]);
            setMessages(newSlice);

        } else if (hasNewer) {
            setIsLoading(true);
            const currentNewestOffset = Math.max(0, oldestMessageOffsetRef.current - cachedMessagesRef.current.length);
            const fetchOffset = Math.max(0, currentNewestOffset - FETCH_LIMIT);

            vscode.postMessage({ command: 'getMessages', limit: FETCH_LIMIT, offset: fetchOffset, intent: 'paginate-newer' });
        }
    };


    const handleJumpToBottom = () => {
        const cachedLen = cachedMessagesRef.current.length;
        const currentLen = messages.length;
        const lastCachedMsg = cachedMessagesRef.current[cachedLen - 1];
        const lastRenderedMsg = messages[currentLen - 1];

        if (lastCachedMsg && lastRenderedMsg && lastCachedMsg.message_id === lastRenderedMsg.message_id) {
            scrollToBottom('auto');
            return;
        }

        if (cachedLen >= MAX_CACHED_MESSAGE) {
            vscode.postMessage({ command: 'getMessages', limit: MAX_DOM_MESSAGE, offset: 0, intent: 'jump' });

        } else {
            const newSlice = cachedMessagesRef.current.slice(-MAX_DOM_MESSAGE);
            shouldScrollToBottomRef.current = true;
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
    };

    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            const message = event.data;
            switch (message.command) {
                case 'loadInitialMessages':
                    cachedMessagesRef.current = message.messages;
                    setMessages(message.messages.slice(-MAX_DOM_MESSAGE));
                    setHasOlder(message.messages.length >= FETCH_LIMIT);
                    setHasNewer(false);
                    setIsLoading(false);
                    oldestMessageOffsetRef.current = message.messages.length;
                    isInitialLoadRef.current = true;
                    break;
                case 'prependMessages':
                    const olderMessages = message.messages;
                    const uniqueOlder = olderMessages.filter((newMsg: MessageResponse) =>
                        !cachedMessagesRef.current.some(existing => existing.message_id === newMsg.message_id)
                    );

                    if (uniqueOlder.length === 0) {
                        setIsLoading(false);
                        if (olderMessages.length < FETCH_LIMIT) setHasOlder(false);
                        break;
                    }

                    cachedMessagesRef.current = [...uniqueOlder, ...cachedMessagesRef.current];
                    if (cachedMessagesRef.current.length > MAX_CACHED_MESSAGE) {
                        cachedMessagesRef.current = cachedMessagesRef.current.slice(0, MAX_CACHED_MESSAGE);
                        setHasNewer(true);
                    }
                    setMessages(prev => {
                        const combined = [...uniqueOlder, ...prev];

                        if (combined.length > MAX_DOM_MESSAGE) {
                            return combined.slice(0, MAX_DOM_MESSAGE);
                        }
                        return combined;
                    });

                    setHasOlder(olderMessages.length >= FETCH_LIMIT);
                    setIsLoading(false);
                    oldestMessageOffsetRef.current += uniqueOlder.length;
                    break;
                case 'appendMessagesBatch':
                    const newerMessages = message.messages;
                    const uniqueNewer = newerMessages.filter((newMsg: MessageResponse) =>
                        !cachedMessagesRef.current.some(existing => existing.message_id === newMsg.message_id)
                    );

                    if (uniqueNewer.length === 0) {
                        setIsLoading(false);
                        const currentNewestOffset = Math.max(0, oldestMessageOffsetRef.current - cachedMessagesRef.current.length);
                        setHasNewer(currentNewestOffset > 0);
                        break;
                    }

                    const lastVisibleMsg = messagesRef.current[messagesRef.current.length - 1];
                    captureSnapshot(lastVisibleMsg);

                    cachedMessagesRef.current = [...cachedMessagesRef.current, ...uniqueNewer];

                    if (cachedMessagesRef.current.length > MAX_CACHED_MESSAGE) {
                        const removeCount = cachedMessagesRef.current.length - MAX_CACHED_MESSAGE;
                        cachedMessagesRef.current = cachedMessagesRef.current.slice(removeCount);

                        oldestMessageOffsetRef.current -= removeCount;
                        setHasOlder(true);
                    }

                    setMessages(prev => {
                        const combined = [...prev, ...uniqueNewer].filter((msg, index, self) =>
                            index === self.findIndex((m) => m.message_id === msg.message_id)
                        );

                        if (combined.length > MAX_DOM_MESSAGE) {
                            return combined.slice(-MAX_DOM_MESSAGE);
                        }
                        return combined;
                    });

                    const currentNewestOffset = Math.max(0, oldestMessageOffsetRef.current - cachedMessagesRef.current.length);
                    setHasNewer(currentNewestOffset > 0);
                    setIsLoading(false);
                    break;
                case 'appendMessage':
                    const msg = message.message;
                    if (cachedMessagesRef.current.some(m => m.message_id === msg.message_id)) {
                        return;
                    }

                    cachedMessagesRef.current = [...cachedMessagesRef.current, msg];
                    if (cachedMessagesRef.current.length > MAX_CACHED_MESSAGE) {
                        cachedMessagesRef.current = cachedMessagesRef.current.slice(-MAX_CACHED_MESSAGE);
                        setHasOlder(true);
                    }

                    setMessages(prev => {
                        const next = [...prev, msg];
                        if (next.length > MAX_DOM_MESSAGE) {
                            if (isAtBottomRef.current) {
                                return next.slice(-MAX_DOM_MESSAGE);
                            }
                            return next.slice(-MAX_DOM_MESSAGE);
                        }
                        return next;
                    });

                    oldestMessageOffsetRef.current += 1;

                    if (msg.userType === 'me') {
                        isAtBottomRef.current = true;
                        shouldScrollToBottomRef.current = true;
                    } else if (!isAtBottomRef.current) {
                        setUnreadCount(prev => prev + 1);
                    } else {
                        shouldScrollToBottomRef.current = true;
                    }
                    break;

                case 'jumpToAnchor':
                    cachedMessagesRef.current = message.messages;
                    setMessages(message.messages.slice(-MAX_DOM_MESSAGE));

                    setHasOlder(message.messages.length >= FETCH_LIMIT);
                    const newestOffset = Math.max(
                        0,
                        oldestMessageOffsetRef.current - message.messages.length
                    );
                    setHasNewer(newestOffset > 0);

                    setIsLoading(false);
                    oldestMessageOffsetRef.current = message.messages.length;
                    shouldScrollToBottomRef.current = true;
                    break;

            }
        };

        window.addEventListener('message', handleMessage);
        vscode.postMessage({ command: 'getMessages', limit: FETCH_LIMIT, offset: 0, intent: 'initial' });

        return () => {
            window.removeEventListener('message', handleMessage);
        };
    }, []);

    return (
        <div class={styles['chat-view-container']}>
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
                        <div class={styles['new-messages-indicator']} onClick={handleJumpToBottom}>
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
                    jumpToBottom={handleJumpToBottom}
                />
            </div>
        </div >
    );
};
