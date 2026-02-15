import * as vscode from 'vscode';
import * as path from 'path';
import { Storage } from '../platform/storage';
import { logger } from '../utils/logger';
import play from 'play-sound';

const player = play();

export type NotificationMode = 'mute' | 'notify';

export class NotificationService {
    private _mode: NotificationMode = 'mute';

    private chatPanelProvider?: { isVisible: boolean };

    constructor(private context: vscode.ExtensionContext) {
        this.initialize();
    }

    public setChatPanelProvider(provider: { isVisible: boolean }) {
        this.chatPanelProvider = provider;
    }

    private initialize() {
        const savedMode = Storage.getGlobal<NotificationMode>('linebuzz.notificationMode');
        this._mode = savedMode || 'mute';
        this.updateContext();
    }

    public get mode(): NotificationMode {
        return this._mode;
    }

    public async setMode(mode: NotificationMode) {
        this._mode = mode;
        Storage.setGlobal('linebuzz.notificationMode', mode);
        await this.updateContext();
    }

    private async updateContext() {
        await vscode.commands.executeCommand('setContext', 'linebuzz.notificationMode', this._mode);
    }

    public async notify(message: string) {
        if (this._mode === 'mute') {
            return;
        }

        if (this._mode === 'notify') {
            if (!this.chatPanelProvider?.isVisible) {
                vscode.window.showInformationMessage(message);
            }
            this.playSound();
        }
    }

    private playSound() {
        try {
            const soundPath = path.join(this.context.extensionPath, 'assets', 'incoming_msg.wav');
            player.play(soundPath, (err: any) => {
                if (err) {
                    logger.error('NotificationService', 'Failed to play sound', err);
                }
            });
        } catch (error) {
            logger.error('NotificationService', 'Error playing sound', error);
        }
    }
}
