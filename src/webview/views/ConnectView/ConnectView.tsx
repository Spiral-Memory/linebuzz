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
