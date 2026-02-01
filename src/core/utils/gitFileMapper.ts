import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import gitUrlParse from 'git-url-parse';
import { logger } from './logger';

export const findRepositoryByRemote = (api: any, remoteUrl: string): any => {
    const repos = api.repositories;
    if (!repos || repos.length === 0) return undefined;

    let targetIdentity: string | null = null;
    try {
        const snippetInfo = gitUrlParse(remoteUrl);
        targetIdentity = snippetInfo.full_name;
    }
    catch (e) {
        logger.error('gitFileMapper', 'Failed to parse repo url:', e);
        return undefined;
    }

    const matchingRepo = repos.find((repo: any) => {
        return repo.state.remotes.some((remote: any) => {
            const url = remote.fetchUrl;
            if (!url) return false;
            try {
                const remoteInfo = gitUrlParse(url);
                return remoteInfo.full_name.toLowerCase() === targetIdentity!.toLowerCase();
            } catch (e) {
                return false;
            }
        });
    });

    return matchingRepo;
};

export const resolveFilePath = (repository: any, relativePath: string): vscode.Uri | undefined => {
    const snippetFilePath = relativePath.split('/').join(path.sep);
    const candidate = path.join(repository.rootUri.fsPath, snippetFilePath);

    if (fs.existsSync(candidate)) {
        return vscode.Uri.file(candidate);
    }
    return undefined;
};
