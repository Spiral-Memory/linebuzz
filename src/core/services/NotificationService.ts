import * as vscode from 'vscode';
import * as path from 'path';
import { Storage } from '../platform/storage';
import { logger } from '../utils/logger';

// @ts-ignore
import sound = require('play-sound');

const player = sound();

export type NotificationMode = 'mute' | 'notify' | 'sound';

export class NotificationService {
    private _mode: NotificationMode = 'mute';

    constructor(private context: vscode.ExtensionContext) {
        this.initialize();
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

        if (this._mode === 'notify' || this._mode === 'sound') {
            vscode.window.showInformationMessage(message);
        }

        if (this._mode === 'sound') {
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
