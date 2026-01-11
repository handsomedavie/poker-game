import React, { useEffect, useState, useRef } from 'react';
import styles from './action_buttons_timer.module.css';

interface ActionButtonsTimerProps {
  isActive: boolean;
  duration?: number; // seconds
  onTimeout?: () => void;
}

export const ActionButtonsTimer: React.FC<ActionButtonsTimerProps> = ({
  isActive,
  duration = 20,
  onTimeout,
}) => {
  const [timeRemaining, setTimeRemaining] = useState(duration);
  const [isRunning, setIsRunning] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number | null>(null);

  // Calculate stroke dashoffset for circular progress
  // Approximate perimeter of action buttons container
  // Width ~600px, Height ~60px → Perimeter ≈ 2*(600+60) = 1320
  const containerPerimeter = 1320;
  const progress = timeRemaining / duration;
  const strokeDashoffset = containerPerimeter * (1 - progress);

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
    }
  }, [isActive, isRunning]);

  // Don't render if not active
  if (!isActive && !isRunning) {
    return null;
  }

  const timerColor = getTimerColor();
  const isDanger = timeRemaining <= 5;

  return (
    <div 
      className={`${styles.timerOverlay} ${isActive ? styles.active : styles.fadeOut} ${isDanger ? styles.danger : ''}`}
    >
      {/* SVG Border Timer */}
      <svg 
        className={styles.timerBorder} 
        viewBox="0 0 620 80"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="none"
      >
        {/* Background rectangle */}
        <rect
          x="2"
          y="2"
          width="616"
          height="76"
          rx="12"
          ry="12"
          fill="none"
          stroke="rgba(255, 255, 255, 0.1)"
          strokeWidth="1"
        />
        
        {/* Progress rectangle */}
        <rect
          x="2"
          y="2"
          width="616"
          height="76"
          rx="12"
          ry="12"
          fill="none"
          stroke={timerColor}
          strokeWidth="4"
          strokeDasharray={containerPerimeter}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className={styles.progressStroke}
          style={{
            filter: isDanger ? `drop-shadow(0 0 8px ${timerColor})` : `drop-shadow(0 0 4px ${timerColor})`,
          }}
        />
      </svg>

      {/* Timer Display (seconds counter in top-right) */}
      <div className={styles.timerDisplay}>
        <span className={styles.timerNumber}>{timeRemaining}</span>
      </div>
    </div>
  );
};

export default ActionButtonsTimer;
