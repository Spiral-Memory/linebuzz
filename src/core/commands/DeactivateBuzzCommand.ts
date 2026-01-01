import * as vscode from 'vscode';


export const deactivateBuzzCommand = async () => {
    await vscode.commands.executeCommand('setContext', 'linebuzz.isBuzzActive', false);
};