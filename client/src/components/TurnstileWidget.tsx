import { useState, useRef, useEffect, useCallback, useImperativeHandle, forwardRef } from "react";
import { Turnstile } from '@marsidev/react-turnstile'

interface Props {
    onToken: (token: string | null) => void;
    className?: string;
}

export interface TurnstileWidgetHandle {
    reset: () => void;
    refresh: () => void;
}

const TURNSTILE_WIDTH = 300;
const TURNSTILE_HEIGHT = 65;

const TurnstileWidget = forwardRef<TurnstileWidgetHandle, Props>(
    ({ onToken, className = "" }, ref) => {
        const [siteKey] = useState(() => import.meta.env.VITE_TURNSTILE_SITE_KEY);
        const containerRef = useRef<HTMLDivElement | null>(null);
        const turnstileRef = useRef<any>(null);

        // Debug: Log when turnstile ref changes
        useEffect(() => {
            console.log("Turnstile ref updated:", turnstileRef.current);
        }, [turnstileRef.current]);

        useImperativeHandle(ref, () => ({
            reset: () => {
                console.log("Reset called on turnstile, ref:", turnstileRef.current);
                if (turnstileRef.current) {
                    try {
                        turnstileRef.current.reset();
                        console.log("Turnstile reset successful");
                    } catch (error) {
                        console.error("Error resetting turnstile:", error);
                    }
                } else {
                    console.error("Cannot reset: turnstile ref is null");
                }
            },
            refresh: () => {
                console.log("Refresh called on turnstile");
                if (turnstileRef.current) {
                    turnstileRef.current.reset();
                }
            }
        }), []);

        const scaleTurnstileToFit = useCallback(() => {
            const container = containerRef.current;
            const turnstile = container?.querySelector(
                ".cf-turnstile-scalable-container .cf-turnstile",
            ) as HTMLElement | null;

            if (!container || !turnstile) return;

            const containerWidth = container.offsetWidth;

            if (containerWidth < 300) {
                const scale = containerWidth / 300;
                turnstile.style.transform = `scale(${scale})`;
                container.style.height = `${TURNSTILE_HEIGHT * scale}px`;
            } else {
                const scale = containerWidth / 300;
                turnstile.style.transform = `scale(${scale})`;
                container.style.height = `${TURNSTILE_HEIGHT * scale}px`;
            }
        }, []);

        useEffect(() => {
            const id = window.setTimeout(scaleTurnstileToFit, 150);
            window.addEventListener("resize", scaleTurnstileToFit);
            return () => {
                window.clearTimeout(id);
                window.removeEventListener("resize", scaleTurnstileToFit);
            };
        }, [scaleTurnstileToFit]);

        const handleTokenSuccess = useCallback((token: string) => {
            console.log("Token received:", token);
            onToken(token);
        }, [onToken]);

        const handleTokenExpire = useCallback(() => {
            console.log("Token expired");
            onToken(null);
        }, [onToken]);

        const handleError = useCallback(() => {
            console.log("Turnstile error occurred");
            onToken(null);
        }, [onToken]);

        return (
            <div
                ref={containerRef}
                className={`cf-turnstile-scalable-container w-full overflow-hidden ${className}`}
            >
                <Turnstile
                    ref={turnstileRef}
                    className="cf-turnstile origin-top-left"
                    siteKey={siteKey}
                    onSuccess={handleTokenSuccess}
                    onExpire={handleTokenExpire}
                    onError={handleError}
                    options={{
                        theme: "dark",
                        language: "ja",
                    }}
                />
            </div>
        );
    }
);

TurnstileWidget.displayName = "TurnstileWidget";
export default TurnstileWidget;