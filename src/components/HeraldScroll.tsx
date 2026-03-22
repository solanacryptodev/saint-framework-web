// src/components/HeraldScroll.tsx
//
// Renders the Herald's monologue as scrolling text — think opening crawl.
// The text types out character by character, then shows a "continue" prompt.
//
// Usage:
//   <HeraldScroll text={heraldText()} onComplete={handleHeraldDone} />

import { createSignal, onMount, onCleanup, Show } from "solid-js";

interface Props {
    text: string;
    onComplete: () => void;
    speed?: number;  // ms per character, default 28
}

export default function HeraldScroll(props: Props) {
    const [displayedText, setDisplayedText] = createSignal("");
    const [showContinue, setShowContinue] = createSignal(false);
    const [skipped, setSkipped] = createSignal(false);
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let charIndex = 0;

    const speed = () => props.speed ?? 28;

    function typeNextChar() {
        if (charIndex < props.text.length) {
            setDisplayedText(props.text.slice(0, charIndex + 1));
            charIndex++;
            timeoutId = setTimeout(typeNextChar, speed());
        } else {
            // Typing complete — show continue prompt
            setShowContinue(true);
        }
    }

    function skipToEnd() {
        if (timeoutId) {
            clearTimeout(timeoutId);
            timeoutId = null;
        }
        setDisplayedText(props.text);
        setSkipped(true);
        setShowContinue(true);
    }

    function handleContinue() {
        props.onComplete();
    }

    function handleKeyDown(e: KeyboardEvent) {
        if (showContinue()) {
            handleContinue();
        } else {
            skipToEnd();
        }
    }

    function handleClick() {
        if (showContinue()) {
            handleContinue();
        } else {
            skipToEnd();
        }
    }

    onMount(() => {
        // Start typing after a brief delay
        timeoutId = setTimeout(typeNextChar, 500);
        window.addEventListener("keydown", handleKeyDown);
    });

    onCleanup(() => {
        if (timeoutId) {
            clearTimeout(timeoutId);
        }
        window.removeEventListener("keydown", handleKeyDown);
    });

    return (
        <div class="herald-scroll" onClick={handleClick}>
            <div class="herald-text">{displayedText()}</div>
            <Show when={showContinue()}>
                <div class="herald-continue">
                    {skipped() ? "CONTINUE" : "PRESS ANY KEY"}
                </div>
            </Show>
        </div>
    );
}
