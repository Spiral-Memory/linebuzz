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

interface ScrollSnapshot {
    id: string;
    rect: DOMRect;
    scrollTop: number;
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
    const snapshotRef = useRef<ScrollSnapshot | null>(null);
    const isAtBottomRef = useRef(true);
    const isInitialLoadRef = useRef(true);
    const shouldScrollToBottomRef = useRef(false);
    const oldestMessageOffsetRef = useRef(0);
    const messagesRef = useRef<MessageResponse[]>([]);
    const isLoadingRef = useRef(false);
    const hasOlderRef = useRef(true);
    const hasNewerRef = useRef(false);

    const FETCH_LIMIT = 50;
    const MAX_DOM_MESSAGE = 150;
    const MAX_CACHED_MESSAGE = 200;
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
        if (messages.length === 0) return;

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
            const { id, rect: prevRect, scrollTop: prevScrollTop } = snapshotRef.current;
            const node = messageListRef.current.querySelector(`[data-id="${id}"]`) as HTMLElement;

            if (node) {
                const currentRect = node.getBoundingClientRect();
                const scrollDiff = currentRect.top - prevRect.top;
                messageListRef.current.scrollTop = prevScrollTop + scrollDiff;
            }
            snapshotRef.current = null;
            return;
        }
    }, [messages]);

    useEffect(() => {
        messagesRef.current = messages;
    }, [messages]);

    useEffect(() => {
        isLoadingRef.current = isLoading;
    }, [isLoading]);

    useEffect(() => {
        hasOlderRef.current = hasOlder;
    }, [hasOlder]);

    useEffect(() => {
        hasNewerRef.current = hasNewer;
    }, [hasNewer]);

    const captureSnapshot = (targetMsg: MessageResponse) => {
        if (!messageListRef.current || !targetMsg) return;

        const node = messageListRef.current.querySelector(
            `[data-id="${targetMsg.message_id}"]`
        ) as HTMLElement;

        if (node) {
            snapshotRef.current = {
                id: targetMsg.message_id,
                rect: node.getBoundingClientRect(),
                scrollTop: messageListRef.current.scrollTop
            };
        }
    };

    const handleLoadOlder = () => {
        if (isLoadingRef.current) return;

        const currentMessages = messagesRef.current;
        const topMsgId = currentMessages[0]?.message_id;
        const cacheIndex = cachedMessagesRef.current.findIndex(m => m.message_id === topMsgId);

        if (cacheIndex > 0) {
            const newStartIndex = Math.max(0, cacheIndex - 20);
            const newSlice = cachedMessagesRef.current.slice(newStartIndex, newStartIndex + MAX_DOM_MESSAGE);
            captureSnapshot(currentMessages[0]);
            setMessages(newSlice);

        } else if (hasOlderRef.current) {
            setIsLoading(true);
            const currentCacheSize = oldestMessageOffsetRef.current;
            captureSnapshot(currentMessages[0]);
            vscode.postMessage({ command: 'getMessages', limit: FETCH_LIMIT, offset: currentCacheSize, intent: 'paginate-older' });
        }
    };

    const handleLoadNewer = () => {
        if (isLoadingRef.current) return;

        const currentMessages = messagesRef.current;
        const bottomMsgId = currentMessages[currentMessages.length - 1]?.message_id;
        const cacheIndex = cachedMessagesRef.current.findIndex(m => m.message_id === bottomMsgId);

        if (cacheIndex !== -1 && cacheIndex < cachedMessagesRef.current.length - 1) {
            const newEndIndex = Math.min(cachedMessagesRef.current.length, cacheIndex + 21);
            const newStartIndex = Math.max(0, newEndIndex - MAX_DOM_MESSAGE);
            const newSlice = cachedMessagesRef.current.slice(newStartIndex, newEndIndex);

            captureSnapshot(newSlice[0]);
            setMessages(newSlice);

        } else if (hasNewerRef.current) {
            setIsLoading(true);
            const currentNewestOffset = Math.max(0, oldestMessageOffsetRef.current - cachedMessagesRef.current.length);
            const fetchOffset = Math.max(0, currentNewestOffset - FETCH_LIMIT);

            vscode.postMessage({ command: 'getMessages', limit: FETCH_LIMIT, offset: fetchOffset, intent: 'paginate-newer' });
        }
    };

    const handleLoadOlderRef = useRef(handleLoadOlder);
    const handleLoadNewerRef = useRef(handleLoadNewer);
    handleLoadOlderRef.current = handleLoadOlder;
    handleLoadNewerRef.current = handleLoadNewer;

    useEffect(() => {
        if (messages.length === 0) return;
        if (!messageListRef.current || !topSentinelRef.current || !bottomSentinelRef.current) return;

        const observer = new IntersectionObserver(
            (entries: IntersectionObserverEntry[]) => {
                entries.forEach(entry => {
                    if (!entry.isIntersecting) return;
                    if (isInitialLoadRef.current || shouldScrollToBottomRef.current) return;

                    if (entry.target === topSentinelRef.current && !isLoadingRef.current) {
                        handleLoadOlderRef.current();
                    } else if (entry.target === bottomSentinelRef.current) {
                        handleLoadNewerRef.current();
                    }
                });
            },
            {
                root: messageListRef.current,
                rootMargin: '400px',
                threshold: 0.1
            }
        );

        observer.observe(topSentinelRef.current);
        observer.observe(bottomSentinelRef.current);

        return () => observer.disconnect();
    }, [messages.length > 0]);

    const handleJumpToBottom = () => {
        const cachedLen = cachedMessagesRef.current.length;
        const currentLen = messagesRef.current.length;
        const lastCachedMsg = cachedMessagesRef.current[cachedLen - 1];
        const lastRenderedMsg = messagesRef.current[currentLen - 1];

        if (lastCachedMsg && lastRenderedMsg && lastCachedMsg.message_id === lastRenderedMsg.message_id) {
            scrollToBottom('auto');
            setUnreadCount(0);
            return;
        }

        if (cachedLen >= MAX_CACHED_MESSAGE) {
            cachedMessagesRef.current = [];
            oldestMessageOffsetRef.current = 0;
            vscode.postMessage({ command: 'getMessages', limit: MAX_DOM_MESSAGE, offset: 0, intent: 'jump' });
        } else {
            const newSlice = cachedMessagesRef.current.slice(-MAX_DOM_MESSAGE);
            shouldScrollToBottomRef.current = true;
            setUnreadCount(0);
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
                    break;

                case 'prependMessages': {
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
                }

                case 'appendMessagesBatch': {
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
                    if (lastVisibleMsg && messageListRef.current) {
                        const node = messageListRef.current.querySelector(
                            `[data-id="${lastVisibleMsg.message_id}"]`
                        ) as HTMLElement;
                        if (node) {
                            snapshotRef.current = {
                                id: lastVisibleMsg.message_id,
                                rect: node.getBoundingClientRect(),
                                scrollTop: messageListRef.current.scrollTop
                            };
                        }
                    }

                    cachedMessagesRef.current = [...cachedMessagesRef.current, ...uniqueNewer];

                    if (cachedMessagesRef.current.length > MAX_CACHED_MESSAGE) {
                        const removeCount = cachedMessagesRef.current.length - MAX_CACHED_MESSAGE;
                        cachedMessagesRef.current = cachedMessagesRef.current.slice(removeCount);
                        oldestMessageOffsetRef.current -= removeCount;
                        setHasOlder(true);
                    }

                    setMessages(prev => {
                        const combined = [...prev, ...uniqueNewer];
                        if (combined.length > MAX_DOM_MESSAGE) {
                            return combined.slice(-MAX_DOM_MESSAGE);
                        }
                        return combined;
                    });

                    const currentNewestOffset = Math.max(0, oldestMessageOffsetRef.current - cachedMessagesRef.current.length);
                    setHasNewer(currentNewestOffset > 0);
                    setIsLoading(false);
                    break;
                }

                case 'appendMessage': {
                    const msg = message.message;
                    if (cachedMessagesRef.current.some(m => m.message_id === msg.message_id)) {
                        return;
                    }

                    let newCache = [...cachedMessagesRef.current, msg];
                    let didPrune = false;
                    let prunedMsg: MessageResponse | undefined;

                    if (newCache.length > MAX_CACHED_MESSAGE) {
                        prunedMsg = newCache[0];
                        newCache = newCache.slice(-MAX_CACHED_MESSAGE);
                        setHasOlder(true);
                        didPrune = true;
                    }

                    cachedMessagesRef.current = newCache;
                    if (!didPrune) {
                        oldestMessageOffsetRef.current += 1;
                    }

                    const isAtBottom = isAtBottomRef.current;
                    const isMyMessage = msg.userType === 'me';

                    if (isAtBottom || isMyMessage) {
                        setMessages(prev => {
                            if (prev.some(m => m.message_id === msg.message_id)) return prev;
                            const next = [...prev, msg];
                            if (next.length > MAX_DOM_MESSAGE) {
                                return next.slice(-MAX_DOM_MESSAGE);
                            }
                            return next;
                        });
                        shouldScrollToBottomRef.current = true;
                        isAtBottomRef.current = true;
                    } else {
                        setUnreadCount(prev => prev + 1);
                        if (didPrune && prunedMsg) {
                            const currentView = messagesRef.current;
                            if (currentView.length > 0 && currentView[0].message_id === prunedMsg.message_id) {
                                if (currentView.length > 1) {
                                    captureSnapshot(currentView[1]);
                                    setMessages(prev => prev.filter(m => m.message_id !== prunedMsg!.message_id));
                                } else {
                                    setMessages([]);
                                }
                            }
                        }
                    }
                    break;
                }

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
                    setUnreadCount(0);
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
                    <div ref={topSentinelRef} style={{ height: '40px', width: '100%' }} />
                    {isLoading && <LoadingSpinner />}
                    {messages.map((msg) => (
                        <MessageRow
                            message={msg}
                            key={msg.message_id}
                            onOpenSnippet={onOpenSnippet}
                        />
                    ))}
                    <div ref={bottomSentinelRef} style={{ height: '40px', width: '100%' }} />
                    <div ref={messagesEndRef} />
                    {(unreadCount > 0 || showScrollButton) && (
                        <div class={styles['new-messages-indicator']} onClick={handleJumpToBottom}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M7 13L12 18L17 13M7 6L12 11L17 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                            </svg>
                            {unreadCount > 0 && <span class={styles['indicator-count']}>{unreadCount}</span>}
                        </div>
                    )}
                </div>
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
        </div>
    );
};
