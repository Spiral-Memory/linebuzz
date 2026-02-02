import * as fuzzball from "fuzzball";

export interface RelocationInput {
    snapshot: string;
    targetCode: string;
    targetStartOffset: number;
    targetEndOffset: number;
    snapshotStartOffset: number;
    snapshotEndOffset: number;
}

export interface RelocationResult {
    success: boolean;
    foundStartOffset: number;
    foundEndOffset: number;
    confidence: number;
    reason: 'exact' | 'geometric' | 'orphaned' | 'empty';
}

interface Anchor {
    text: string;
    relativeOffset: number;
}

interface Vote {
    predictedStartOffset: number;
    weight: number;
}


export class RelocatorEngine {
    private readonly LOOKAHEAD_BUFFER = 50;
    private readonly MIN_CONFIDENCE_SCORE = 75;
    private readonly STRECH_THRESHOLD_RATIO = 0.05;
    private readonly MATCH_DENSITY_THRESHOLD_RATIO = 0.4;
    private readonly COLLISION_THRESHOLD = 0.85;

    public relocate(inputs: RelocationInput[]): RelocationResult[] {
        return inputs.map(input => this.processSingleRelocation(input));
    }

    private processSingleRelocation(input: RelocationInput): RelocationResult {
        if (!input.snapshot.trim()) {
            return {
                success: false,
                foundStartOffset: 0,
                foundEndOffset: 0,
                confidence: 0,
                reason: 'empty'
            };
        }
        return this.tryExactMatch(input) ?? this.fuzzyRelocate(input);
    }

    private tryExactMatch(input: RelocationInput): RelocationResult | null {
        const relativeStart = input.snapshotStartOffset - input.targetStartOffset;
        const snapshotLength = input.snapshot.length;
        if (relativeStart >= 0 && (relativeStart + snapshotLength) <= input.targetCode.length) {
            const candidate = input.targetCode.substring(relativeStart, relativeStart + snapshotLength + this.LOOKAHEAD_BUFFER);
            const cleanSnapshot = input.snapshot.replace(/\s+/g, '');
            const cleanCandidate = candidate.replace(/\s+/g, '');

            if (cleanCandidate.startsWith(cleanSnapshot)) {
                return {
                    success: true,
                    foundStartOffset: input.snapshotStartOffset,
                    foundEndOffset: input.snapshotStartOffset + snapshotLength,
                    confidence: 1.0,
                    reason: 'exact'
                };
            }
        }
        return null;
    }

    private fuzzyRelocate(input: RelocationInput): RelocationResult {
        const snapshotLines = input.snapshot.split('\n');
        const targetLines = input.targetCode.split('\n');
        const targetLineOffsets = this.calculateLineOffsets(input.targetCode);

        const anchors = this.selectAnchors(snapshotLines);
        const votes: Vote[] = [];

        for (const anchor of anchors) {
            const matches = fuzzball.extract(anchor.text, targetLines, {
                scorer: fuzzball.token_sort_ratio,
                limit: 5,
                returnObjects: true
            });

            matches.forEach((match: any) => {
                if (match.score < this.MIN_CONFIDENCE_SCORE) return;

                const localLineOffset = targetLineOffsets[match.key];
                const globalFoundOffset = input.targetStartOffset + localLineOffset;
                const predictedStart = globalFoundOffset - anchor.relativeOffset;

                votes.push({
                    predictedStartOffset: predictedStart,
                    weight: match.score / 100
                });
            });
        }

        if (votes.length === 0) {
            return {
                success: false,
                foundStartOffset: 0,
                foundEndOffset: 0,
                confidence: 0,
                reason: 'orphaned'
            };
        }

        return this.resolveConsensus(votes, input.snapshot.length, anchors.length, input.snapshotStartOffset);
    }

    private resolveConsensus(votes: Vote[], originalLength: number, anchorCount: number, originalOffset: number): RelocationResult {
        const tolerance = Math.min(100, Math.max(10, Math.floor(originalLength * this.STRECH_THRESHOLD_RATIO)));
        const clusters = new Map<number, { weight: number, votes: Vote[] }>();

        for (const vote of votes) {
            const clusterKey = Math.floor(vote.predictedStartOffset / tolerance) * tolerance;
            const cluster = clusters.get(clusterKey) ?? { weight: 0, votes: [] };
            cluster.weight += vote.weight;
            cluster.votes.push(vote);
            clusters.set(clusterKey, cluster);
        }

        let [primaryCluster, runnerUpCluster] = Array.from(clusters.values()).sort((a, b) => b.weight - a.weight);

        if (!primaryCluster || primaryCluster.weight < this.MATCH_DENSITY_THRESHOLD_RATIO * anchorCount) {
            return { success: false, foundStartOffset: 0, foundEndOffset: 0, confidence: 0, reason: 'orphaned' };
        }

        let finalBestVote = primaryCluster.votes.reduce((best, current) =>
            (current.predictedStartOffset < best.predictedStartOffset) ? current : best
        );

        if (runnerUpCluster && runnerUpCluster.weight > this.COLLISION_THRESHOLD * primaryCluster.weight) {
            const runnerBestVote = runnerUpCluster.votes.reduce((best, current) =>
                (current.predictedStartOffset < best.predictedStartOffset) ? current : best
            );

            const primaryDist = Math.abs(finalBestVote.predictedStartOffset - originalOffset);
            const runnerDist = Math.abs(runnerBestVote.predictedStartOffset - originalOffset);

            if (runnerDist < primaryDist) {
                primaryCluster = runnerUpCluster;
                finalBestVote = runnerBestVote;
            }
        }

        const finalStart = finalBestVote.predictedStartOffset;

        return {
            success: true,
            foundStartOffset: finalStart,
            foundEndOffset: finalStart + originalLength,
            confidence: primaryCluster.weight / anchorCount,
            reason: 'geometric'
        };
    }
    private selectAnchors(lines: string[]): Anchor[] {
        const anchors: Anchor[] = lines[0] ? [{ text: lines[0], relativeOffset: 0 }] : [];

        const lineOffsets = this.calculateLineOffsets(lines.join('\n'));
        const targetCount = Math.min(20, Math.ceil(lines.length / 5) || 1);
        const step = Math.max(1, Math.floor(lines.length / targetCount));

        for (let i = step; i < lines.length && anchors.length < 20; i += step) {
            const segment = lines.slice(i, i + step);
            const localIdx = segment.findIndex(line => !this.isBoilerPlate(line));

            if (localIdx !== -1) {
                const globalIdx = i + localIdx;
                anchors.push({
                    text: lines[globalIdx],
                    relativeOffset: lineOffsets[globalIdx]
                });
            }
        }

        return anchors;
    }

    private isBoilerPlate(line: string): boolean {
        const canonicalLine = line.trim().replace(/\s+/g, ' ');
        const boilerplate = new Set([
            '{', '}', '};',
            'else {', 'try {', 'finally {',
            'return;', 'break;', 'continue;'
        ]);
        return (
            canonicalLine.length < 4 ||
            boilerplate.has(canonicalLine) ||
            canonicalLine.startsWith('//') ||
            canonicalLine.startsWith('import ')
        );
    }


    private calculateLineOffsets(text: string): number[] {
        let offset = 0;
        return text.split('\n').map(line => {
            const current = offset;
            offset += line.length + 1;
            return current;
        });
    }
}