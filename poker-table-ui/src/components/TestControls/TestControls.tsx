import React, { useState } from 'react';
import styles from './test_controls.module.css';
import { sampleWinnerData } from '../../utils/testWinnerAnimation';

interface TestControlsProps {
  onTriggerAnimation: (scenario: keyof typeof sampleWinnerData) => void;
}

/**
 * Debug test controls for triggering win animations
 * Only shown when DEBUG_MODE is true
 */
const TestControls: React.FC<TestControlsProps> = ({ onTriggerAnimation }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const scenarios = Object.keys(sampleWinnerData) as (keyof typeof sampleWinnerData)[];

  const getScenarioLabel = (key: string): string => {
    const labels: Record<string, string> = {
      singleWinnerShowdown: '🏆 Single Winner (Flush)',
      splitPot: '🤝 Split Pot (2 Winners)',
      winByFold: '🎯 Win by Fold',
      royalFlush: '👑 Royal Flush ($2500)',
      fourOfAKind: '🎴 Four of a Kind',
    };
    return labels[key] || key;
  };

  return (
    <div className={styles.testControls}>
      <button
        className={styles.toggleButton}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {isExpanded ? '❌' : '🎮'} Test Win Animation
      </button>

      {isExpanded && (
        <div className={styles.scenarioPanel}>
          <div className={styles.scenarioTitle}>Test Scenarios:</div>
          {scenarios.map(scenario => (
            <button
              key={scenario}
              className={styles.scenarioButton}
              onClick={() => {
                onTriggerAnimation(scenario);
                setIsExpanded(false);
              }}
            >
              {getScenarioLabel(scenario)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default TestControls;
