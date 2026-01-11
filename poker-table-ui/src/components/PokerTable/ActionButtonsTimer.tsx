import React, { useEffect, useState, useRef } from 'react';
import styles from './action_buttons_timer.module.css';

interface ActionButtonsTimerProps {
  isActive: boolean;
  duration?: number; // seconds
  onTimeout?: () => void;
  testMode?: boolean; // ТЕСТОВЫЙ РЕЖИМ - автостарт без ожидания isActive
}

export const ActionButtonsTimer: React.FC<ActionButtonsTimerProps> = ({
  isActive,
  duration = 20,
  onTimeout,
  testMode = true, // По умолчанию включен для тестирования
}) => {
  const [timeRemaining, setTimeRemaining] = useState(duration);
  const [isRunning, setIsRunning] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number | null>(null);

  // ОТЛАДКА: Логирование при монтировании компонента
  useEffect(() => {
    console.log('[ActionButtonsTimer] Component mounted');
    console.log('[ActionButtonsTimer] Test mode:', testMode);
    console.log('[ActionButtonsTimer] isActive:', isActive);
    console.log('[ActionButtonsTimer] Starting 20s countdown');
  }, []);

  // ОТЛАДКА: Логирование каждую секунду
  useEffect(() => {
    if (isRunning) {
      console.log('[Timer]', timeRemaining, 'seconds left');
    }
  }, [timeRemaining, isRunning]);

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

  // ТЕСТОВЫЙ РЕЖИМ: Автостарт таймера при монтировании
  useEffect(() => {
    const shouldStart = testMode || (isActive && !isRunning);
    
    if (shouldStart && !isRunning) {
      console.log('[ActionButtonsTimer] Starting timer...');
      setIsRunning(true);
      setTimeRemaining(duration);
      startTimeRef.current = Date.now();

      intervalRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - (startTimeRef.current || Date.now())) / 1000);
        const remaining = Math.max(0, duration - elapsed);
        
        setTimeRemaining(remaining);

        if (remaining === 0) {
          console.log('[ActionButtonsTimer] Timer expired!');
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          setIsRunning(false);
          onTimeout?.();
          
          // ТЕСТОВЫЙ РЕЖИМ: Автоматический рестарт
          if (testMode) {
            console.log('[ActionButtonsTimer] Auto-restarting in 2 seconds...');
            setTimeout(() => {
              setTimeRemaining(duration);
              setIsRunning(false);
            }, 2000);
          }
        }
      }, 100); // Update every 100ms for smooth animation
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isActive, duration, onTimeout, isRunning, testMode]);

  // Stop timer when inactive (только если НЕ тестовый режим)
  useEffect(() => {
    if (!testMode && !isActive && isRunning) {
      console.log('[ActionButtonsTimer] Stopping timer (inactive)');
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      setIsRunning(false);
    }
  }, [isActive, isRunning, testMode]);

  // ТЕСТОВЫЙ РЕЖИМ: Всегда рендерить
  // В обычном режиме: рендерить только если активен
  if (!testMode && !isActive && !isRunning) {
    return null;
  }

  console.log('[ActionButtonsTimer] Rendering timer', { timeRemaining, isActive, isRunning });

  const timerColor = getTimerColor();
  const isDanger = timeRemaining <= 5;

  return (
    <div 
      className={`${styles.timerOverlay} ${(testMode || isActive) ? styles.active : styles.fadeOut} ${isDanger ? styles.danger : ''}`}
      style={{
        // ОТЛАДКА: Красная рамка для видимости границ
        border: '2px solid red',
      }}
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
          x="3"
          y="3"
          width="614"
          height="74"
          rx="20"
          ry="20"
          fill="none"
          stroke="rgba(255, 255, 255, 0.2)"
          strokeWidth="2"
        />
        
        {/* Progress rectangle - УВЕЛИЧЕННАЯ ТОЛЩИНА И СВЕЧЕНИЕ */}
        <rect
          x="3"
          y="3"
          width="614"
          height="74"
          rx="20"
          ry="20"
          fill="none"
          stroke={timerColor}
          strokeWidth="6"
          strokeDasharray={containerPerimeter}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className={styles.progressStroke}
          style={{
            filter: isDanger 
              ? `drop-shadow(0 0 20px ${timerColor}) drop-shadow(0 0 40px ${timerColor})` 
              : `drop-shadow(0 0 25px ${timerColor}) drop-shadow(0 0 50px rgba(0, 255, 136, 0.6))`,
          }}
        />
      </svg>

      {/* КРУПНАЯ ЦИФРА В ЦЕНТРЕ */}
      <div className={styles.timerDisplayCenter}>
        <span className={styles.timerNumberLarge}>{timeRemaining}</span>
      </div>
      
      {/* Timer Display (seconds counter in top-right) */}
      <div className={styles.timerDisplay}>
        <span className={styles.timerNumber}>{timeRemaining}s</span>
      </div>
    </div>
  );
};

export default ActionButtonsTimer;
