import React, { useEffect, useState, useRef } from 'react';
import styles from './player_hand_timer.module.css';

interface PlayerHandTimerProps {
  isActive: boolean;
  duration?: number; // seconds
  onTimeout?: () => void;
  onStop?: () => void;
}

export const PlayerHandTimer: React.FC<PlayerHandTimerProps> = ({
  isActive,
  duration = 20,
  onTimeout,
  onStop,
}) => {
  const [timeRemaining, setTimeRemaining] = useState(duration);
  const [isRunning, setIsRunning] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number | null>(null);

  // Calculate stroke dashoffset for circular progress
  // Perimeter of rectangle: 2 * (width + height) ≈ 2 * (180 + 120) = 600
  const rectanglePerimeter = 600;
  const progress = timeRemaining / duration;
  const strokeDashoffset = rectanglePerimeter * (1 - progress);

  // Determine color based on time remaining
  const getTimerColor = (): string => {
    if (timeRemaining <= 5) return '#ff3333'; // Red
    if (timeRemaining <= 10) return '#ffcc00'; // Yellow
    return '#00ff88'; // Green
  };

  // Start timer when active
  useEffect(() => {
    if (isActive && !isRunning) {
      setIsRunning(true);
      setTimeRemaining(duration);
      startTimeRef.current = Date.now();

      intervalRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - (startTimeRef.current || Date.now())) / 1000);
        const remaining = Math.max(0, duration - elapsed);
        
        setTimeRemaining(remaining);

        if (remaining === 0) {
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          setIsRunning(false);
          onTimeout?.();
        }
      }, 100); // Update every 100ms for smooth animation
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isActive, duration, onTimeout, isRunning]);

  // Stop timer when inactive
  useEffect(() => {
    if (!isActive && isRunning) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      setIsRunning(false);
      onStop?.();
    }
  }, [isActive, isRunning, onStop]);

  // Don't render if not active
  if (!isActive && !isRunning) {
    return null;
  }

  const timerColor = getTimerColor();
  const isDanger = timeRemaining <= 5;

  return (
    <div 
      className={`${styles.timerContainer} ${isActive ? styles.active : styles.fadeOut} ${isDanger ? styles.danger : ''}`}
    >
      {/* SVG Border Timer */}
      <svg 
        className={styles.timerBorder} 
        viewBox="0 0 180 120"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Background rectangle */}
        <rect
          x="2"
          y="2"
          width="176"
          height="116"
          rx="16"
          ry="16"
          fill="none"
          stroke="rgba(255, 255, 255, 0.1)"
          strokeWidth="1"
        />
        
        {/* Progress rectangle */}
        <rect
          x="2"
          y="2"
          width="176"
          height="116"
          rx="16"
          ry="16"
          fill="none"
          stroke={timerColor}
          strokeWidth="3"
          strokeDasharray={rectanglePerimeter}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className={styles.progressStroke}
          style={{
            filter: isDanger ? `drop-shadow(0 0 8px ${timerColor})` : 'none',
          }}
        />
      </svg>

      {/* Timer Display */}
      <div className={styles.timerDisplay}>
        <span className={styles.timerNumber}>{timeRemaining}</span>
      </div>
    </div>
  );
};

export default PlayerHandTimer;
