import { useLocation } from "@solidjs/router";
import { Title } from "@solidjs/meta";
import { createMemo } from "solid-js";

// Route to title mapping
const routeTitles: Record<string, string> = {
    "/": "The Saint Framework",
    "/play": "Play - The Saint Framework",
    "/create": "Create - The Saint Framework",
    "/about": "About - The Saint Framework",
    "/join": "Join - The Saint Framework",
    "/player": "Player - The Saint Framework",
    "/create/forge": "World Forge - The Saint Framework",
};

// Helper function to format title: replace dashes with spaces and capitalize words
function formatTitle(slug: string): string {
    return slug
        .replace(/-/g, " ")
        .replace(/\b\w/g, (char) => char.toUpperCase());
}

// Function to get title based on pathname
function getTitleFromPath(pathname: string): string {
    // Check for exact matches first
    if (routeTitles[pathname]) {
        return routeTitles[pathname];
    }

    // Check for dynamic routes
    // /play/game/[gameTitle]
    const gameMatch = pathname.match(/^\/play\/game\/([^/]+)$/);
    if (gameMatch) {
        const gameTitle = formatTitle(decodeURIComponent(gameMatch[1]));
        return `${gameTitle} - The Saint Framework`;
    }

    // /play/game/[gameTitle]/play
    const playMatch = pathname.match(/^\/play\/game\/([^/]+)\/play$/);
    if (playMatch) {
        const gameTitle = formatTitle(decodeURIComponent(playMatch[1]));
        return `Playing ${gameTitle} - The Saint Framework`;
    }

    // Default title for unknown routes
    return "The Saint Framework";
}

export default function PageTitle() {
    const location = useLocation();

    const title = createMemo(() => getTitleFromPath(location.pathname));

    return <Title>{title()}</Title>;
}