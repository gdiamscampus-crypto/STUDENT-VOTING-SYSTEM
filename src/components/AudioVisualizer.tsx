/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef, useState } from 'react';
import { setVisualizerCallback } from '../audio';
import { Volume2, VolumeX } from 'lucide-react';

export default function AudioVisualizer({ isEnabled }: { isEnabled: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    // Register the callback to get the AnalyserNode
    setVisualizerCallback((node) => {
      setAnalyser(node);
    });

    return () => {
      setVisualizerCallback(null);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Handle high DPI displays
    const resizeCanvas = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Render loop
    let lastTime = 0;
    const render = (time: number) => {
      const width = canvas.width / (window.devicePixelRatio || 1);
      const height = canvas.height / (window.devicePixelRatio || 1);

      ctx.clearRect(0, 0, width, height);

      if (analyser && isEnabled) {
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        analyser.getByteFrequencyData(dataArray);

        // Draw frequency bars
        const barWidth = (width / bufferLength) * 2.5;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
          const percent = dataArray[i] / 255;
          const barHeight = percent * height * 0.8;

          // Gradient color based on frequency
          const gradient = ctx.createLinearGradient(0, height, 0, height - barHeight);
          gradient.addColorStop(0, 'rgba(59, 130, 246, 0.15)'); // Blue
          gradient.addColorStop(0.5, 'rgba(139, 92, 246, 0.6)'); // Purple
          gradient.addColorStop(1, 'rgba(236, 72, 153, 0.95)'); // Pink

          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.roundRect(x, height - barHeight, barWidth - 1, barHeight, [2, 2, 0, 0]);
          ctx.fill();

          x += barWidth;
        }

        // Draw a digital overlay wave line
        analyser.getByteTimeDomainData(dataArray);
        ctx.lineWidth = 2;
        ctx.strokeStyle = 'rgba(139, 92, 246, 0.8)'; // Purple line
        ctx.beginPath();

        const sliceWidth = width / bufferLength;
        let lineX = 0;

        for (let i = 0; i < bufferLength; i++) {
          const v = dataArray[i] / 128.0;
          const lineY = (v * height) / 2;

          if (i === 0) {
            ctx.moveTo(lineX, lineY);
          } else {
            ctx.lineTo(lineX, lineY);
          }

          lineX += sliceWidth;
        }

        ctx.lineTo(width, height / 2);
        ctx.stroke();
      } else {
        // Draw an ambient, calm waves if no sound is playing
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = 'rgba(156, 163, 175, 0.3)'; // Cool gray
        ctx.beginPath();

        const speed = time * 0.003;
        for (let x = 0; x < width; x++) {
          const y = height / 2 + Math.sin(x * 0.02 + speed) * 4 * Math.cos(x * 0.005 + speed * 0.5);
          if (x === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.stroke();

        // Draw a second softer out-of-phase wave
        ctx.strokeStyle = 'rgba(139, 92, 246, 0.15)'; // Ambient Purple
        ctx.beginPath();
        for (let x = 0; x < width; x++) {
          const y = height / 2 + Math.cos(x * 0.015 - speed * 0.8) * 6 * Math.sin(x * 0.008 + speed * 0.3);
          if (x === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.stroke();
      }

      animationRef.current = requestAnimationFrame(render);
    };

    animationRef.current = requestAnimationFrame(render);

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [analyser, isEnabled]);

  return (
    <div className="relative w-full h-12 bg-slate-900/50 rounded-xl overflow-hidden border border-slate-800/80 backdrop-blur-sm px-4 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className="flex h-2 w-2 relative">
          <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${isEnabled ? 'bg-indigo-400' : 'bg-gray-400'} opacity-75`}></span>
          <span className={`relative inline-flex rounded-full h-2 w-2 ${isEnabled ? 'bg-indigo-500' : 'bg-gray-500'}`}></span>
        </span>
        <span className="text-xs font-mono text-slate-400 font-medium">
          {isEnabled ? 'AUDIO ENGINE ACTIVE' : 'AUDIO MUTED'}
        </span>
      </div>

      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none px-20" />

      <div className="flex items-center gap-1 z-10">
        {isEnabled ? (
          <Volume2 className="h-4 w-4 text-indigo-400 animate-pulse" id="vis-vol-icon" />
        ) : (
          <VolumeX className="h-4 w-4 text-slate-500" id="vis-mute-icon" />
        )}
      </div>
    </div>
  );
}
