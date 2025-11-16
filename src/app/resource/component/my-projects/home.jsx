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

  const [theme, setTheme] = useState("morning");
  const [message, setMessage] = useState("");

  const ambient = useRef({});
  const sfx = useRef({});
  const audioReady = useRef(false);

  const prevSunVisible = useRef(false);
  const prevMoonVisible = useRef(false);

  const volume = 0.5;

  /* ===========================
     AUDIO SETUP (autoplay-safe + no media session)
     =========================== */
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Disable Media Session metadata/controls so Android doesn't show a notification
    if ("mediaSession" in navigator) {
      try {
        navigator.mediaSession.metadata = null;
        const noop = () => {};
        ["play", "pause", "stop", "seekbackward", "seekforward"].forEach((a) =>
          navigator.mediaSession.setActionHandler(a, noop)
        );
      } catch {}
    }

    // Create ambient tracks (muted preload so they buffer)
    ambient.current = {
      morning: new window.Audio("/sounds/morning.mp3"),
      afternoon: new window.Audio("/sounds/afternoon.mp3"),
      evening: new window.Audio("/sounds/evening.mp3"),
      night: new window.Audio("/sounds/night.mp3"),
    };

    Object.values(ambient.current).forEach((t) => {
      try {
        t.loop = true;
        t.volume = 0;
        t.muted = true; // required to allow autoplay/buffering
        t.preload = "auto";
        t.load();
      } catch {}
    });

    // SFX (loaded but not autoplayed)
    sfx.current = {
      sunRise: new window.Audio("/sounds/sun-rise.mp3"),
      sunSet: new window.Audio("/sounds/sun-set.mp3"),
      moonRise: new window.Audio("/sounds/moon-rise.mp3"),
      moonSet: new window.Audio("/sounds/moon-set.mp3"),
    };

    // Unlock audio: wait for a trusted gesture then unmute and play current theme if visible
    const unlock = () => {
      if (audioReady.current) return;
      audioReady.current = true;

      Object.values(ambient.current).forEach((t) => {
        try {
          t.muted = false;
        } catch {}
      });

      // Play the current theme only if visible & focused
      playAmbientIfAllowed();
    };

    // Trusted gestures for all browsers
    const events = ["click", "pointerdown", "touchstart", "keydown", "mousedown"];
    // attach after a small timeout (improves reliability)
    const attachTimeout = setTimeout(() => {
      events.forEach((evt) => window.addEventListener(evt, unlock, { once: true, passive: true }));
    }, 50);

    // Pause/resume helpers
    const pauseAll = () => {
      Object.values(ambient.current).forEach((a) => {
        try {
          a.pause();
        } catch {}
      });
      Object.values(sfx.current).forEach((a) => {
        try {
          a.pause();
        } catch {}
      });
    };

    function playAmbientIfAllowed() {
      if (!audioReady.current) return;
      if (document.hidden) return;
      if (!document.hasFocus()) return;
      const track = ambient.current[theme];
      if (track) {
        try {
          track.muted = false;
          track.play().catch(() => {});
          gsap.to(track, { volume, duration: 0.25 });
        } catch {}
      }
    }

    // Visibility & focus handling: stop audio on background, resume only when allowed
    const onVisibility = () => {
      if (document.hidden) {
        pauseAll();
      } else {
        playAmbientIfAllowed();
      }
    };
    const onBlur = () => pauseAll();
    const onFocus = () => playAmbientIfAllowed();

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);

    // cleanup
    return () => {
      clearTimeout(attachTimeout);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
      // Remove any added gesture listeners is unnecessary because they were once:true; just ensure pause + source clear
      try {
        Object.values(ambient.current).forEach((t) => {
          t.pause();
          t.src && (t.src = "");
        });
        Object.values(sfx.current).forEach((s) => {
          s.pause();
          s.src && (s.src = "");
        });
      } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run once

  /* ===========================
     SFX helper (no background play)
     =========================== */
  function playSFX(name) {
    if (!audioReady.current) return;
    if (document.hidden || !document.hasFocus()) return;
    const snd = sfx.current[name];
    if (!snd) return;
    snd.volume = volume;
    try {
      snd.currentTime = 0;
      snd.play().catch(() => {});
    } catch {}
  }

  /* ===========================
     Fade ambient if theme changes (respect visibility)
     =========================== */
  function fadeAmbient(newTheme) {
    if (document.hidden || !document.hasFocus()) return;

    // fade out others
    Object.values(ambient.current).forEach((t) => {
      try {
        gsap.to(t, { volume: 0, duration: 0.35 });
      } catch {}
    });

    const track = ambient.current[newTheme];
    if (!track) return;
    try {
      track.play().catch(() => {});
      gsap.to(track, { volume, duration: 0.5 });
    } catch {}
  }

  /* ===========================
     Conversion & simulation utils
     =========================== */
  function azAltToScreen({ azimuth, altitude }) {
    const x = (azimuth + Math.PI) / (2 * Math.PI); // 0..1 left->right
    const altNorm = Math.max(Math.min(altitude / (Math.PI / 2), 1), -1);
    const y = -altNorm * 40; // vh
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

  /* ===========================
     Theme selection by sun altitude
     =========================== */
  function updateThemeUsingSun(altitude) {
    let newTheme;
    if (altitude > 0.6) newTheme = "afternoon";
    else if (altitude > 0.25) newTheme = "morning";
    else if (altitude > 0) newTheme = "evening";
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

  /* ===========================
     Moon phase update (JS -> CSS vars)
     =========================== */
  function writeMoonVars(now) {
    try {
      const ill = SunCalc.getMoonIllumination(now); // { fraction, phase, angle }
      const fraction = typeof ill.fraction === "number" ? ill.fraction : 0;
      const phase = typeof ill.phase === "number" ? ill.phase : 0;
      const angle = typeof ill.angle === "number" ? ill.angle : 0;
      if (moonRef.current) {
        moonRef.current.style.setProperty("--moon-fraction", String(fraction));
        moonRef.current.style.setProperty("--moon-phase", String(phase));
        moonRef.current.style.setProperty("--moon-angle", `${angle}rad`);
      }
    } catch {}
  }

  /* ===========================
     Animate helpers
     =========================== */
  function animateTo(el, pos) {
    if (!el) return;
    gsap.to(el, {
      xPercent: pos.xPercent - 50,
      y: `${pos.yVh}vh`,
      duration: 2.4,
      ease: "power2.out",
    });
  }

  /* ===========================
     Main update: positions, phases, SFX, theme
     =========================== */
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

    // update theme (keeps visuals consistent)
    updateThemeUsingSun(sunPos.altitude);

    // moon phase CSS vars
    writeMoonVars(now);

    const sunVisible = sunPos.altitude > 0;
    const moonVisible = moonPos.altitude > 0;

    // Decide when to actually show moon:
    // - never show in morning/afternoon (design choice)
    // - hide on new moon (very small fraction)
    const illum = SunCalc.getMoonIllumination(now);
    const isNewMoon = illum && (illum.phase < 0.03 || illum.phase > 0.97);

    const forceHideMoon = theme === "morning" || theme === "afternoon";

    // SFX on transitions (only when audible)
    if (sunVisible && !prevSunVisible.current) playSFX("sunRise");
    if (!sunVisible && prevSunVisible.current) playSFX("sunSet");
    if (moonVisible && !prevMoonVisible.current) playSFX("moonRise");
    if (!moonVisible && prevMoonVisible.current) playSFX("moonSet");

    prevSunVisible.current = sunVisible;
    prevMoonVisible.current = moonVisible;

    // Animate positions
    animateTo(sunRef.current, azAltToScreen(sunPos));
    animateTo(moonRef.current, azAltToScreen(moonPos));

    // final moon opacity logic
    const finalMoonOpacity = forceHideMoon || isNewMoon ? 0 : moonVisible ? 1 : 0;
    gsap.to(moonRef.current, { opacity: finalMoonOpacity, duration: 0.6 });
    gsap.to(sunRef.current, { opacity: sunVisible ? 1 : 0, duration: 0.6 });
  }

  /* ===========================
     INIT: set initial positions + interval
     =========================== */
  useEffect(() => {
    gsap.set([sunRef.current, moonRef.current], {
      xPercent: -50,
      y: "50vh",
      opacity: 0,
    });

    // run once immediately
    moveBodies();

    const interval = setInterval(moveBodies, 60_000); // update every minute
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className={`main-container ${theme}`}>
      <div ref={sunRef} className="sky-object sun" aria-hidden />
      <div ref={moonRef} className="sky-object moon" aria-hidden />

      <div className="environment-particles" />
      <div className="environment-hill hill1" />
      <div className="environment-hill hill2" />
      {theme === "night" && <div className="environment-stars" />}

      <div className="content-box">
        <h1 className="animate-fadeIn">{message}</h1>
        <p>Welcome to my portfolio — where creativity meets technology ✨</p>
      </div>
    </main>
  );
}
