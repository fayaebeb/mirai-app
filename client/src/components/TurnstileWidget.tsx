import { useState, useRef, useEffect, useCallback } from "react";
import Turnstile from "react-turnstile";

interface Props {
    onToken: (token: string | null) => void;
    className?: string;
}
const TURNSTILE_WIDTH = 300; // px  (normal variant)
const TURNSTILE_HEIGHT = 65;
/**
 * Cloudflare Turnstile that automatically scales down
 * when its container is narrower than 300 px.
 */
export default function TurnstileWidget({ onToken, className = "" }: Props) {
    const [siteKey] = useState(() => import.meta.env.VITE_TURNSTILE_SITE_KEY);

    /* Refs to the wrapper <div> and Turnstile element ----------------------- */
    const containerRef = useRef<HTMLDivElement | null>(null);

    const scaleTurnstileToFit = useCallback(() => {
        const container = containerRef.current;
        const turnstile = container?.querySelector(
            ".cf-turnstile-scalable-container .cf-turnstile",
        ) as HTMLElement | null;

        if (!container || !turnstile) return;

        const containerWidth = container.offsetWidth;
        //  const scale = Math.min(containerWidth / TURNSTILE_WIDTH, 1);

        if (containerWidth < 300) {
            const scale = containerWidth / 300;
            turnstile.style.transform = `scale(${scale})`;
            container.style.height = `${TURNSTILE_HEIGHT * scale}px`;

            // Optional: you can also adjust height on the wrapper if needed
        } else {
            const scale = containerWidth / 300;
            turnstile.style.transform = `scale(${scale})`;
            container.style.height = `${TURNSTILE_HEIGHT * scale}px`;
        }
    }, []);

    /* Run once after mount + on every window resize ------------------------ */
    useEffect(() => {
        // Run once after widget has had time to render its iframe
        const id = window.setTimeout(scaleTurnstileToFit, 150);

        window.addEventListener("resize", scaleTurnstileToFit);
        return () => {
            window.clearTimeout(id);
            window.removeEventListener("resize", scaleTurnstileToFit);
        };
    }, [scaleTurnstileToFit]);

    return (
        <div
            ref={containerRef}
            /* Tailwind + your custom class names --------------------------------- */
            className={`cf-turnstile-scalable-container w-full overflow-hidden ${className}`}
        >
            <Turnstile
                sitekey={siteKey}
                onVerify={onToken}
                size="normal" // “normal” = 300 px → we down-scale from there
                className="cf-turnstile origin-top-left"
            />
        </div>
    );
}
