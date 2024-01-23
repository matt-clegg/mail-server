
export function chunkArray<T>(input: T[], size: number): T[][] {
    const result : T[][] = [];

    for (let i = 0; i < input.length; i += size) {
        result.push(input.slice(i, i + size));
    }

    return result;
}
