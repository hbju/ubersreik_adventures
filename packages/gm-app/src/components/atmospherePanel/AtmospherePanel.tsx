import React, { useRef, useState } from 'react';
import styles from './AtmospherePanel.module.css';

const musicTracks = [
    {
        id: 'calm', name: 'Calm', src: [
            "assets/music/WHG_Dwarfs(main).ogg",
            "assets/music/The City Gates.mp3",
            "assets/music/Ancient Stones.mp3",
            "assets/music/Geheimnisnacht.mp3",
            "assets/music/General Tavern B.wav",
            "assets/music/Outskirts of Novigrad.mp3",
        ]
    },
    {
        id: 'tavern', name: 'Tavern', src: [
            "assets/music/Lion's Pride.mp3",
            "assets/music/Shady Rest.mp3",
            "assets/music/Around the Fire.mp3",
            "assets/music/Out of the Cold.mp3",
        ]
    },
    {
        id: 'docks', name: 'Docks', src: [
            'assets/music/Boralus Harbor.mp3',
            'assets/music/Arendella.wav'
        ]
    },
    {
        id: 'tense', name: 'Tense', src: [
            'assets/music/Decide.wav',
            'assets/music/Hybrid String Ambience.wav',
            'assets/music/Combat Atmos.wav',
            'assets/music/Cello Atmos.wav',
            'assets/music/WHG_Chaos(ambient-01).ogg',
            "assets/music/WHG_Chaos(aux-01).wav",
        ]
    },
    {
        id: "intrigue", name: "Intrigue", src: [
            "assets/music/Conspiracy Theme.wav",
            "assets/music/Silent Footsteps.mp3",
            "assets/music/Starting Zone.wav",
        ]
    },
    {
        id: 'epic', name: 'Epic', src: [
            'assets/music/Song of Elune.mp3',
            "assets/music/Khadgar's Plan.mp3",
            "assets/music/Unbroken Road.mp3",
            "assets/music/Sigmar's Glorious Empire.mp3",
        ]
    },
    {
        id: 'battle', name: 'Battle', src: [
            "assets/music/Epic Battle.wav",
            "assets/music/Hatred.wav",
            "assets/music/Combat Braams.wav",
            "assets/music/Combat Sequence.wav",
            "assets/music/Daring Strings.wav",
            "assets/music/Death or Sovngarde.mp3",
            "assets/music/Tooth and Claw.mp3",
        ]
    },
    {
        id: 'mysterious', name: 'Mysterious', src: [
            "assets/music/Whispering Harps.wav",
        ]
    }
]

interface AtmospherePanelProps {
    onClose: () => void,
}

const AtmospherePanel: React.FC<AtmospherePanelProps> = ({ onClose }) => {
    const audioRef = useRef<HTMLAudioElement>(null);
    const fadeIntervalRef = useRef<number | null>(null);

    const [activeTrackId, setActiveTrackId] = useState<string | null>(null);
    const [activeTrackSrc, setActiveTrackSrc] = useState<string | null>(null);

    const handlePlayTrack = (trackId: string | null) => {
        const audio = audioRef.current
        if (!audio) return;

        if (fadeIntervalRef.current)
            clearInterval(fadeIntervalRef.current)

        const fadeOut = (onComplete: () => void) => {
            if (audio.volume === 0) {
                onComplete()
                return;
            }

            fadeIntervalRef.current = window.setInterval(() => {
                if (audio.volume > 0.1)
                    audio.volume -= 0.1;
                else {
                    audio.volume = 0;
                    audio.pause()
                    if (fadeIntervalRef.current) clearInterval(fadeIntervalRef.current);
                    onComplete();
                }
            }, 50);
        };

        const fadeIn = () => {
            audio.volume = 0;
            audio.play();
            fadeIntervalRef.current = window.setInterval(() => {
                if (audio.volume < 0.9) {
                    audio.volume += 0.1;
                } else {
                    audio.volume = 1;
                    if (fadeIntervalRef.current) clearInterval(fadeIntervalRef.current);
                }
            }, 50)
        };

        if (trackId === null) {
            fadeOut(() => setActiveTrackId(null))
            return;
        }

        const newTrack = musicTracks.find(t => t.id === trackId);
        if (!newTrack) return;

        fadeOut(() => {
            setActiveTrackId(newTrack.id);
            const newTrackSrcIndex = Math.floor(Math.random() * (newTrack.src.length - 1));
            const randomSrc = newTrack.src.filter(t => t !== activeTrackSrc)[newTrackSrcIndex];
            audio.src = randomSrc;
            setActiveTrackSrc(randomSrc);
            fadeIn();
        });
    }

    return (

        <div className={styles.panel}>
            {/* This audio element is invisible but does all the work. It must be present. */}
            <audio ref={audioRef} loop />

            <div className={styles.buttons}>
                {musicTracks.map(track =>
                    <button
                        key={track.id}
                        className={activeTrackId === track.id ? styles.active : ''}
                        onClick={() => handlePlayTrack(track.id)}
                    >
                        {track.name}
                    </button>
                )}
                <button
                    className={styles.stopButton}
                    onClick={() => handlePlayTrack(null)}
                >
                    Stop
                </button>

                <button onClick={onClose} className={styles.closeButton}>✖</button>

            </div>
        </div>
    )
}

export default AtmospherePanel;