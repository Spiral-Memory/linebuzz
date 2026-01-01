import * as vscode from 'vscode';


export const activateBuzzCommand = async () => {
    await vscode.commands.executeCommand('setContext', 'linebuzz.isBuzzActive', true);
};  