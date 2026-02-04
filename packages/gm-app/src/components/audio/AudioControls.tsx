import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAudio } from '../../context/AudioContext';
import styles from './AudioControls.module.css';

/**
 * Format seconds to mm:ss display
 */
function formatTime(seconds: number): string {
    if (!isFinite(seconds) || seconds < 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

interface AudioControlsProps {
    compact?: boolean;
}

export const AudioControls: React.FC<AudioControlsProps> = ({ compact = false }) => {
    const { t } = useTranslation();
    const {
        playbackState,
        pause,
        resume,
        stop,
        next,
        previous,
        seek,
        setVolume,
        fadeOut,
        toggleShuffle,
        toggleRepeat,
    } = useAudio();

    const {
        currentTrack,
        isPlaying,
        volume,
        currentTime,
        duration,
        isShuffled,
        isRepeating,
        playbackSource,
    } = playbackState;

    const handlePlayPause = useCallback(() => {
        if (isPlaying) {
            pause();
        } else {
            resume();
        }
    }, [isPlaying, pause, resume]);

    const handleStop = useCallback(async () => {
        await fadeOut(1500);
        stop();
    }, [fadeOut, stop]);

    const handleSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        console.log('Seek event value:', e.target.value);
        seek(parseFloat(e.target.value));
    }, [seek]);

    const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setVolume(parseFloat(e.target.value));
    }, [setVolume]);

    const handleMuteToggle = useCallback(() => {
        setVolume(volume > 0 ? 0 : 0.7);
    }, [volume, setVolume]);

    const getVolumeIcon = () => {
        if (volume === 0) return '🔇';
        if (volume < 0.3) return '🔈';
        if (volume < 0.7) return '🔉';
        return '🔊';
    };

    return (
        <div className={styles.audioControls}>
            {/* Now Playing */}
            <div className={styles.nowPlaying}>
                <div className={styles.nowPlayingLabel}>
                    {t('audio.nowPlaying', 'Now Playing')}
                </div>
                {currentTrack ? (
                    <>
                        <div className={styles.trackInfo}>
                            <span className={styles.musicIcon}>🎵</span>
                            <span className={styles.trackName}>
                                {currentTrack.displayName || currentTrack.filename}
                            </span>
                        </div>
                        {playbackSource && (
                            <div className={styles.sourceInfo}>
                                {playbackSource.type === 'tag' && `🏷️ ${playbackSource.name}`}
                                {playbackSource.type === 'playlist' && `📋 ${playbackSource.name}`}
                            </div>
                        )}
                    </>
                ) : (
                    <div className={styles.noTrack}>
                        {t('audio.noTrackPlaying', 'No track playing')}
                    </div>
                )}
            </div>

            {/* Progress Bar */}
            <div className={styles.progressSection}>
                <div className={styles.progressBar}>
                    <span className={styles.time}>{formatTime(currentTime)}</span>
                    <input
                        type="range"
                        className={styles.progressSlider}
                        min="0"
                        max={duration || 0}
                        value={currentTime}
                        onChange={handleSeek}
                        disabled={!currentTrack}
                    />
                    <span className={styles.time}>{formatTime(duration)}</span>
                </div>
            </div>

            {/* Transport Controls */}
            <div className={styles.transportControls}>
                <button
                    className={`${styles.transportButton} ${styles.toggleButton} ${isShuffled ? styles.active : ''}`}
                    onClick={toggleShuffle}
                    title={t('audio.shuffle', 'Shuffle')}
                >
                    🔀
                </button>
                <button
                    className={styles.transportButton}
                    onClick={previous}
                    disabled={!currentTrack}
                    title={t('audio.previous', 'Previous')}
                >
                    ⏮
                </button>
                <button
                    className={`${styles.transportButton} ${styles.playButton}`}
                    onClick={handlePlayPause}
                    disabled={!currentTrack}
                    title={isPlaying ? t('audio.pause', 'Pause') : t('audio.play', 'Play')}
                >
                    {isPlaying ? '⏸' : '▶'}
                </button>
                <button
                    className={`${styles.transportButton} ${styles.stopButton}`}
                    onClick={handleStop}
                    disabled={!currentTrack}
                    title={t('audio.stop', 'Stop (Fade Out)')}
                >
                    ⏹
                </button>
                <button
                    className={styles.transportButton}
                    onClick={next}
                    disabled={!currentTrack}
                    title={t('audio.next', 'Next')}
                >
                    ⏭
                </button>
                <button
                    className={`${styles.transportButton} ${styles.toggleButton} ${isRepeating ? styles.active : ''}`}
                    onClick={toggleRepeat}
                    title={t('audio.repeat', 'Repeat')}
                >
                    🔁
                </button>
            </div>

            {/* Volume Control */}
            <div className={styles.volumeSection}>
                <span 
                    className={styles.volumeIcon}
                    onClick={handleMuteToggle}
                    title={volume > 0 ? t('audio.mute', 'Mute') : t('audio.unmute', 'Unmute')}
                >
                    {getVolumeIcon()}
                </span>
                <input
                    type="range"
                    className={styles.volumeSlider}
                    min="0"
                    max="1"
                    step="0.01"
                    value={volume}
                    onChange={handleVolumeChange}
                />
                <span className={styles.volumeValue}>
                    {Math.round(volume * 100)}%
                </span>
            </div>
        </div>
    );
};

export default AudioControls;
