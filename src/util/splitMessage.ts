export default function splitMessage(str: string) {
    const substrings: string[] = [];
    const length = 950;
    let start = 0;

    while (start < str.length) {
        let end = start + length;
        if (end >= str.length) {
            substrings.push(str.substring(start));
            break;
        }

        while (end > start && str[end] !== ' ') {
            end--;
        }

        const linkRegex = /\bhttps?:\/\/[^\s]+/gi;
        let result: RegExpExecArray | null;
        while ((result = linkRegex.exec(str)) !== null) {
            const urlStart = result.index;
            const urlEnd = urlStart + result[0].length;

            if (start < urlStart && end > urlStart && end < urlEnd) {
                end = urlEnd;
                break;
            }
        }

        // If no space was found in the interval, and not in the middle of a URL, force split at length
        if (end === start) {
            end = start + length;
        }

        substrings.push(str.substring(start, end));
        start = end;
    }

    return substrings;
}
