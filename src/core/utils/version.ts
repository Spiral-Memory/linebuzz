import { compare } from 'compare-versions';

export function isVersionGte(current: string, minimum: string): boolean {
    return compare(current, minimum, '>=');
}

