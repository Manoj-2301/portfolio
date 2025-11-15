"use client";
import React, { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import SunCalc from "suncalc";

import "../../styles/home/home.scss";
import "../../styles/home/_environment.scss";
import "../../styles/home/_sky.scss";

// Fixed coordinates (Hyderabad)
const FIXED_LAT = 17.402350;
const FIXED_LON = 78.390468;

export default function Home() {
    const sunRef = useRef(null);
    const moonRef = useRef(null);
    const cloudsRef = useRef(null);

    const [theme, setTheme] = useState("morning");
    const [message, setMessage] = useState("");

    const ambient = useRef({});
    const sfx = useRef({});
    const audioReady = useRef(false);

    const prevSunVisible = useRef(false);
    const prevMoonVisible = useRef(false);

    const volume = 0.5;

    /* =====================================================
       AUDIO INITIALIZATION + AUTOPLAY SAFE
       (keeps behavior from your working version)
       ===================================================== */
    useEffect(() => {
        if (typeof window === "undefined") return;

        if ("mediaSession" in navigator) {
            try {
                navigator.mediaSession.metadata = null;
                navigator.mediaSession.setActionHandler("play", () => { });
                navigator.mediaSession.setActionHandler("pause", () => { });
                navigator.mediaSession.setActionHandler("stop", () => { });
            } catch { }
        }

        ambient.current = {
            morning: new window.Audio("/sounds/morning.mp3"),
            afternoon: new window.Audio("/sounds/afternoon.mp3"),
            evening: new window.Audio("/sounds/evening.mp3"),
            night: new window.Audio("/sounds/night.mp3"),
        };

        Object.values(ambient.current).forEach((t) => {
            t.loop = true;
            t.volume = 0;
            t.muted = true;
            t.preload = "auto";
            t.load();
        });

        sfx.current = {
            sunRise: new window.Audio("/sounds/sun-rise.mp3"),
            sunSet: new window.Audio("/sounds/sun-set.mp3"),
            moonRise: new window.Audio("/sounds/moon-rise.mp3"),
            moonSet: new window.Audio("/sounds/moon-set.mp3"),
        };

        const unlock = () => {
            if (audioReady.current) return;
            audioReady.current = true;
            Object.values(ambient.current).forEach((t) => (t.muted = false));
            playAmbientIfAllowed();
        };

        setTimeout(() => {
            ["click", "touchstart", "keydown", "mousedown", "pointerdown"].forEach(
                (evt) => window.addEventListener(evt, unlock, { once: true })
            );
        }, 50);

        const pauseAll = () => {
            Object.values(ambient.current).forEach((a) => a.pause());
            Object.values(sfx.current).forEach((a) => a.pause());
        };

        const playAmbientIfAllowed = () => {
            if (!audioReady.current) return;
            if (document.hidden) return;
            if (!document.hasFocus()) return;
            const track = ambient.current[theme];
            if (track) {
                track.muted = false;
                track.play().catch(() => { });
                gsap.to(track, { volume, duration: 0.25 });
            }
        };

        document.addEventListener("visibilitychange", () => {
            if (document.hidden) pauseAll();
            else playAmbientIfAllowed();
        });

        window.addEventListener("blur", pauseAll);
        window.addEventListener("focus", playAmbientIfAllowed);

        // cleanup
        return () => {
            pauseAll();
            Object.values(ambient.current).forEach((a) => {
                try {
                    a.pause();
                    a.src && (a.src = "");
                } catch { }
            });
            Object.values(sfx.current).forEach((a) => {
                try {
                    a.pause();
                    a.src && (a.src = "");
                } catch { }
            });
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    /* =====================================================
       Helpers: SFX + Ambient Fade (respect visibility & focus)
       ===================================================== */
    function playSFX(name) {
        if (!audioReady.current) return;
        if (document.hidden || !document.hasFocus()) return;
        const sound = sfx.current[name];
        if (!sound) return;
        sound.volume = volume;
        try {
            sound.currentTime = 0;
            sound.play().catch(() => { });
        } catch { }
    }

    function fadeAmbient(newTheme) {
        if (document.hidden || !document.hasFocus()) return;
        Object.values(ambient.current).forEach((t) =>
            gsap.to(t, { volume: 0, duration: 0.3 })
        );
        const track = ambient.current[newTheme];
        if (!track) return;
        track.play().catch(() => { });
        gsap.to(track, { volume, duration: 0.5 });
    }

    /* =====================================================
       Position mapping & simulation fallbacks
       ===================================================== */
    function azAltToScreen({ azimuth, altitude }) {
        const x = (azimuth + Math.PI) / (2 * Math.PI);
        const altNorm = Math.max(Math.min(altitude / (Math.PI / 2), 1), -1);
        const y = -altNorm * 40;
        return { xPercent: x * 100, yVh: y };
    }

    function simulatedAzAlt(date, type = "sun") {
        const hour = date.getHours() + date.getMinutes() / 60;
        if (type === "sun") {
            const t = Math.min(Math.max((hour - 6) / 12, 0), 1);
            return {
                azimuth: -Math.PI * 0.6 + t * Math.PI * 1.2,
                altitude: Math.sin(Math.PI * t) * (Math.PI / 4),
            };
        } else {
            const h = hour < 6 ? hour + 24 : hour;
            const t = Math.min(Math.max((h - 18) / 12, 0), 1);
            return {
                azimuth: Math.PI * 0.6 - t * Math.PI * 1.2,
                altitude: Math.sin(Math.PI * t) * (Math.PI / 5),
            };
        }
    }

    /* =====================================================
       Theme selection from sun altitude
       ===================================================== */
    function updateThemeUsingSun(alt) {
        let newTheme;
        if (alt > 0.6) newTheme = "afternoon";
        else if (alt > 0.25) newTheme = "morning";
        else if (alt > 0) newTheme = "evening";
        else newTheme = "night";

        if (newTheme !== theme) {
            fadeAmbient(newTheme);
            setTheme(newTheme);
            const messages = {
                morning: "Good Morning ☀️ Let's build something beautiful today.",
                afternoon: "Good Afternoon 🌤 Keep shining and creating!",
                evening: "Good Evening 🌇 Time to relax or dream up new ideas.",
                night: "It's late 🌙 Meet you tomorrow! If you’re up for work, drop me a message 💬",
            };
            setMessage(messages[newTheme]);
        }
    }

    /* =====================================================
       Moon phase update
       - uses SunCalc.getMoonIllumination
       - sets CSS variables on moonRef for the SCSS to render crescent/gibbous/full
       ===================================================== */
    function updateMoonPhase(now) {
        try {
            const ill = SunCalc.getMoonIllumination(now); // { fraction, phase, angle }
            // ill.phase: 0..1 (0 new moon, 0.25 first quarter, 0.5 full, 0.75 last quarter)
            const fraction = ill.fraction ?? 0; // illuminated fraction 0..1
            const phase = ill.phase ?? 0; // 0..1
            // We'll expose both: --moon-fraction and --moon-phase
            if (moonRef.current) {
                moonRef.current.style.setProperty("--moon-fraction", fraction.toString());
                moonRef.current.style.setProperty("--moon-phase", phase.toString());
                // angle (tilt) may be useful for rotation:
                moonRef.current.style.setProperty(
                    "--moon-angle",
                    (typeof ill.angle === "number" ? ill.angle : 0) + "rad"
                );
            }
        } catch (e) {
            // ignore
        }
    }

    /* =====================================================
       Animate DOM elements
       ===================================================== */
    function animateTo(el, pos) {
        if (!el) return;
        gsap.to(el, {
            xPercent: pos.xPercent - 50,
            y: `${pos.yVh}vh`,
            duration: 2.2,
            ease: "power2.out",
        });
    }

    /* =====================================================
       Move bodies: compute sun/moon positions, theme, SFX, phases
       ===================================================== */
    function moveBodies() {
        const now = new Date();
        let sunPos, moonPos;
        try {
            sunPos = SunCalc.getPosition(now, FIXED_LAT, FIXED_LON);
            moonPos = SunCalc.getMoonPosition(now, FIXED_LAT, FIXED_LON);
        } catch {
            sunPos = simulatedAzAlt(now, "sun");
            moonPos = simulatedAzAlt(now, "moon");
        }

        updateThemeUsingSun(sunPos.altitude);
        updateMoonPhase(now);

        const sunVisible = sunPos.altitude > 0;
        const moonVisible = moonPos.altitude > 0;

        if (sunVisible && !prevSunVisible.current) playSFX("sunRise");
        if (!sunVisible && prevSunVisible.current) playSFX("sunSet");

        if (moonVisible && !prevMoonVisible.current) playSFX("moonRise");
        if (!moonVisible && prevMoonVisible.current) playSFX("moonSet");

        prevSunVisible.current = sunVisible;
        prevMoonVisible.current = moonVisible;

        animateTo(sunRef.current, azAltToScreen(sunPos));
        animateTo(moonRef.current, azAltToScreen(moonPos));

        gsap.to(sunRef.current, { opacity: sunVisible ? 1 : 0 });
        gsap.to(moonRef.current, { opacity: moonVisible ? 1 : 0 });
    }

    /* =====================================================
       Init: set elements, start clouds animation, schedule update
       ===================================================== */
    useEffect(() => {
        gsap.set([sunRef.current, moonRef.current], {
            xPercent: -50,
            y: "50vh",
            opacity: 0,
        });

        // start a subtle cloud parallax (CSS does most of the work,
        // but we can nudge with JS for responsiveness if needed)
        if (cloudsRef.current) {
            // optional: adjust cloud animation speed based on viewport width
            cloudsRef.current.style.setProperty("--cloud-speed-mult", "1");
        }

        moveBodies();
        const interval = setInterval(moveBodies, 60_000);

        return () => clearInterval(interval);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <main className={`main-container ${theme}`}>
            <div ref={sunRef} className="sky-object sun" aria-hidden />
            <div ref={moonRef} className="sky-object moon" aria-hidden />

            {/* Clouds layer (parallax) */}
            {/* <div ref={cloudsRef} className="clouds" aria-hidden>
                <div className="cloud cloud--a" />
                <div className="cloud cloud--b" />
                <div className="cloud cloud--c" />
                <div className="cloud cloud--d" />
            </div> */}

            <div className="environment-particles" />
            <div className="environment-hill hill1" />
            <div className="environment-hill hill2" />
            {theme === "night" && <div className="environment-stars" />}
{/* 
            <div className="content-box">
                <h1 className="animate-fadeIn">{message}</h1>
                <p>Welcome to my portfolio — where creativity meets technology ✨</p>
            </div> */}
        </main>
    );
}
