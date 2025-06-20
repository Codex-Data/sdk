'use client'; // Mark as client component

import React, { useState, useEffect, useRef } from 'react';

interface GlitchTextProps {
  text: string;
  className?: string;
  charSet?: string; // Optional custom character set
  intervalMs?: number; // Optional interval speed
  iterationsPerChar?: number; // Optional number of glitches per character
}

// Escape the double quote in the character set
const defaultCharSet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-=[]{};:\'';
const defaultIntervalMs = 100;
const defaultIterationsPerChar = 10;

export const GlitchText: React.FC<GlitchTextProps> = ({
  text,
  className = '',
  charSet = defaultCharSet,
  intervalMs = defaultIntervalMs,
  iterationsPerChar = defaultIterationsPerChar,
}) => {
  const [displayText, setDisplayText] = useState(text);
  const [isAnimating, setIsAnimating] = useState(false); // State to track animation
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const iterationCounters = useRef<number[]>([]);

  useEffect(() => {
    // Start animation
    setIsAnimating(true);
    iterationCounters.current = Array(text.length).fill(0);
    setDisplayText(Array.from({ length: text.length }, () =>
      charSet[Math.floor(Math.random() * charSet.length)]
    ).join(''));

    intervalRef.current = setInterval(() => {
      let allDone = true;
      const nextText = Array.from(text).map((originalChar, index) => {
        if (iterationCounters.current[index] < iterationsPerChar) {
          allDone = false;
          iterationCounters.current[index]++;
          // Return a random character for glitching
          return charSet[Math.floor(Math.random() * charSet.length)];
        } else {
          // Once iterations are done, return the original character
          return originalChar;
        }
      }).join('');

      setDisplayText(nextText);

      if (allDone) {
        // Stop animation and clear interval
        setIsAnimating(false);
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      }
    }, intervalMs);

    // Cleanup function to clear the interval when the component unmounts or text changes
    return () => {
      setIsAnimating(false); // Ensure animation stops on unmount
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  // Rerun effect if the target text changes
  }, [text, charSet, intervalMs, iterationsPerChar]);

  // Conditionally apply opacity class
  const animationClass = isAnimating ? 'opacity-50' : '';

  return <span className={`${className} ${animationClass}`}>{displayText}</span>;
};