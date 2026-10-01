export function extractTime(dateString: string) {
    const date = new Date(dateString);
    const now = new Date();

    const isToday =
        date.getDate() === now.getDate() &&
        date.getMonth() === now.getMonth() &&
        date.getFullYear() === now.getFullYear();

    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const isYesterday =
        date.getDate() === yesterday.getDate() &&
        date.getMonth() === yesterday.getMonth() &&
        date.getFullYear() === yesterday.getFullYear();

    const hours = padZero(date.getHours());
    const minutes = padZero(date.getMinutes());
    const timeString = `${hours}:${minutes}`;

    if (isToday) return timeString;
    if (isYesterday) return `Yesterday ${timeString}`;

    const options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
    return `${date.toLocaleDateString(undefined, options)} ${timeString}`;
}

// Helper function to pad single-digit numbers with a leading zero
function padZero(number: number) {
    return number.toString().padStart(2, "0");
}

// Short label for the conversation list: "14:05", "Yesterday", "Mon", "12 Sep"
export function extractListTime(dateString?: string) {
    if (!dateString) return "";
    const date = new Date(dateString);
    const now = new Date();
    const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const days = Math.round((startOfDay(now) - startOfDay(date)) / 86400000);

    if (days <= 0) return `${padZero(date.getHours())}:${padZero(date.getMinutes())}`;
    if (days === 1) return "Yesterday";
    if (days < 7) return date.toLocaleDateString(undefined, { weekday: "short" });
    return date.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}
