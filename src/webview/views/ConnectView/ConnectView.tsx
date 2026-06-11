import { useState, useEffect } from 'preact/hooks';
import { vscode } from '../../utils/vscode';
import { WelcomeSplash } from '../../components/chat/WelcomeSplash/WelcomeSplash';
import styles from './ConnectView.module.css';

interface ConnectViewProps {
    isLoggedIn: boolean;
    hasTeam: boolean;
    customServerUrl?: string | null;
}

export const ConnectView = ({ isLoggedIn, hasTeam, customServerUrl }: ConnectViewProps) => {
    const [showForm, setShowForm] = useState(false);
    const [host, setHost] = useState('');
    const [key, setKey] = useState('');
    const [isValidating, setIsValidating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (customServerUrl) {
            setHost(customServerUrl);
        }
    }, [customServerUrl]);

    useEffect(() => {
        const handleMsg = (event: MessageEvent) => {
            const message = event.data;
            if (message.command === 'signInCustomResult') {
                setIsValidating(false);
                if (message.success) {
                    setShowForm(false);
                    setError(null);
                } else {
                    setError(message.error || 'Connection failed. Invalid host or publishable key.');
                }
            }
        };
        window.addEventListener('message', handleMsg);
        return () => window.removeEventListener('message', handleMsg);
    }, []);

    const handleSignIn = () => {
        vscode.postMessage({ command: 'signIn' });
    };

    const handleCreateTeam = () => {
        vscode.postMessage({ command: 'createTeam' });
    };

    const handleJoinTeam = () => {
        vscode.postMessage({ command: 'joinTeam' });
    };

    const handleConnectCustom = () => {
        setIsValidating(true);
        setError(null);
        vscode.postMessage({
            command: 'signInCustom',
            url: host.trim(),
            publishableKey: key.trim()
        });
    };

    const handleResetDefault = () => {
        vscode.postMessage({ command: 'resetDefaultServer' });
        setHost('');
        setKey('');
        setShowForm(false);
        setError(null);
    };

    return (
        <div class={styles['connect-view-container']}>
            <WelcomeSplash />
            <div class={styles['action-section']}>
                {!isLoggedIn ? (
                    !showForm ? (
                        <>
                            <button
                                class={`${styles['connect-btn']} ${styles['primary']}`}
                                onClick={handleSignIn}
                            >
                                Sign in with GitHub
                            </button>
                            <div class={styles['server-customization']}>
                                {customServerUrl ? (
                                    <button class={styles['link-btn']} onClick={handleResetDefault}>
                                        Reset to default server
                                    </button>
                                ) : (
                                    <button class={styles['link-btn']} onClick={() => setShowForm(true)}>
                                        Use a custom server?
                                    </button>
                                )}
                            </div>
                        </>
                    ) : (
                        <div class={styles['custom-server-form']}>
                            <div class={styles['setup-info']}>
                                <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" class={styles['setup-icon']}>
                                    <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
                                    <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
                                    <line x1="6" y1="6" x2="6.01" y2="6" />
                                    <line x1="6" y1="18" x2="6.01" y2="18" />
                                </svg>
                                <span>
                                    Don't have a server? Deploy <a href="https://github.com/Spiral-Memory/linebuzz-core/blob/dev/scripts/README.md" target="_blank" rel="noopener noreferrer" class={styles['setup-link']}>linebuzz-core</a>
                                </span>
                            </div>
                            <div class={styles['form-group']}>
                                <input
                                    type="text"
                                    placeholder="Host (e.g. https://your-project.supabase.co)"
                                    value={host}
                                    onInput={(e) => setHost((e.target as HTMLInputElement).value)}
                                    disabled={isValidating}
                                    class={styles['form-input']}
                                />
                            </div>
                            <div class={styles['form-group']}>
                                <input
                                    type="password"
                                    placeholder="Publishable Key (e.g. sb_publishable_...)"
                                    value={key}
                                    onInput={(e) => setKey((e.target as HTMLInputElement).value)}
                                    disabled={isValidating}
                                    class={styles['form-input']}
                                />
                            </div>
                            {error && <div class={styles['form-error']}>{error}</div>}
                            <div class={styles['form-actions']}>
                                <button
                                    class={`${styles['form-btn']} ${styles['primary']}`}
                                    onClick={handleConnectCustom}
                                    disabled={isValidating || !host.trim() || !key.trim()}
                                >
                                    {isValidating ? 'Saving...' : 'Save'}
                                </button>
                                <button
                                    class={`${styles['form-btn']} ${styles['secondary']}`}
                                    onClick={() => {
                                        setShowForm(false);
                                        setError(null);
                                    }}
                                    disabled={isValidating}
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    )
                ) : !hasTeam ? (
                    <>
                        <button class={`${styles['connect-btn']} ${styles['primary']}`} onClick={handleCreateTeam}>
                            Create New Team
                        </button>
                        <button class={`${styles['connect-btn']} ${styles['secondary']}`} onClick={handleJoinTeam}>
                            Join Existing Team
                        </button>
                    </>
                ) : (
                    <div class={styles['success-message']}>
                        <p>You are all set!</p>
                    </div>
                )}
            </div>
        </div>
    );
};
