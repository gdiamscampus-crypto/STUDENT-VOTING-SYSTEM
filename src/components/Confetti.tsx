/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
import { motion } from 'motion/react';

interface ConfettiPiece {
  id: number;
  x: number;
  y: number;
  color: string;
  size: number;
  rotation: number;
  shape: 'circle' | 'square' | 'triangle';
  delay: number;
  duration: number;
}

const COLORS = [
  '#3B82F6', // Blue
  '#10B981', // Emerald
  '#F59E0B', // Amber
  '#EF4444', // Red
  '#8B5CF6', // Purple
  '#EC4899', // Pink
];

export default function Confetti() {
  const [pieces, setPieces] = useState<ConfettiPiece[]>([]);

  useEffect(() => {
    const arr: ConfettiPiece[] = [];
    for (let i = 0; i < 80; i++) {
      arr.push({
        id: i,
        x: Math.random() * 100, // percentage from left
        y: -10 - Math.random() * 20, // starting position above screen
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        size: Math.random() * 10 + 6,
        rotation: Math.random() * 360,
        shape: ['circle', 'square', 'triangle'][Math.floor(Math.random() * 3)] as any,
        delay: Math.random() * 0.5,
        duration: Math.random() * 2 + 2,
      });
    }
    setPieces(arr);
  }, []);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-50">
      {pieces.map((p) => (
        <motion.div
          key={p.id}
          initial={{
            x: `${p.x}vw`,
            y: `${p.y}vh`,
            rotate: p.rotation,
            opacity: 1,
            scale: 0.8,
          }}
          animate={{
            y: '110vh',
            x: `${p.x + (Math.random() * 15 - 7.5)}vw`, // slight horizontal drift
            rotate: p.rotation + 360 + Math.random() * 720,
            opacity: [1, 1, 0.8, 0],
          }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            ease: 'easeOut',
          }}
          style={{
            position: 'absolute',
            width: p.size,
            height: p.size,
            backgroundColor: p.shape !== 'triangle' ? p.color : undefined,
            borderRadius: p.shape === 'circle' ? '50%' : p.shape === 'triangle' ? undefined : '2px',
            borderLeft: p.shape === 'triangle' ? `${p.size / 2}px solid transparent` : undefined,
            borderRight: p.shape === 'triangle' ? `${p.size / 2}px solid transparent` : undefined,
            borderBottom: p.shape === 'triangle' ? `${p.size}px solid ${p.color}` : undefined,
          }}
        />
      ))}
    </div>
  );
}
