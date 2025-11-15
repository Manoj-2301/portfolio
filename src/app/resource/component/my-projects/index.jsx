"use client";
import { useEffect, useState } from "react";
import "../../styles/home/home.scss";

export default function Home() {
    const [theme, setTheme] = useState("");
    const [message, setMessage] = useState("");
    const [skyObject, setSkyObject] = useState(""); // sun or moon

    useEffect(() => {
        const hour = new Date().getHours();

        if (hour >= 6 && hour < 12) {
            setTheme("morning");
            setSkyObject("sun");
            setMessage("Good Morning ☀️ Let's build something beautiful today.");
        } else if (hour >= 12 && hour < 15) {
            setTheme("afternoon");
            setSkyObject("sun");
            setMessage("Good Afternoon 🌤 Keep shining and creating!");
        } else if (hour >= 15 && hour < 15) {
            setTheme("evening");
            setSkyObject("sun");
            setMessage("Good Evening 🌇 Time to relax or dream up new ideas.");
        } else {
            setTheme("night");
            setSkyObject("moon");
            setMessage(
                "It's late 🌙 Meet you tomorrow! If you're up for work, drop me a message 💬"
            );
        }
    }, []);

    return (
        <main className={`main-container ${theme}`}>
            <div className={`sky-object ${skyObject}`}></div>

            <div className="environment-particles"></div>

            <div className="environment-hill hill1"></div>
            <div className="environment-hill hill2"></div>

            {theme === "night" && <div className="environment-stars"></div>}

            <div
                className={`sky-object ${skyObject} 
    ${theme === "morning" && skyObject === "sun" ? "morning-position" : ""}
    ${theme === "afternoon" && skyObject === "sun" ? "afternoon-position" : ""}
    ${theme === "evening" && skyObject === "sun" ? "evening-position" : ""}
    
    ${theme === "night" && skyObject === "moon" ? "night-position" : ""}
    ${theme === "evening" && skyObject === "moon" ? "evening-position" : ""}
    ${theme === "morning" && skyObject === "moon" ? "morning-position" : ""}
    
    ${(theme !== "morning" && skyObject === "sun") ? "below-horizon" : ""}
    ${(theme !== "evening" && theme !== "night" && skyObject === "moon") ? "below-horizon" : ""}
  `}
            ></div>


            <div className="content-box">
                <h1>{message}</h1>
                <p>Welcome to my portfolio — where creativity meets technology ✨</p>

                {theme === "night" && (
                    <button
                        className="message-btn"
                        onClick={() => alert("Thanks! Reach me at hello@yourmail.com")}
                    >
                        Leave a Message 💌
                    </button>
                )}
            </div>
        </main>
    );
}
