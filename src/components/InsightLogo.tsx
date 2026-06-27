/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';

interface InsightLogoProps {
  layout?: 'horizontal' | 'vertical' | 'icon-only';
  height?: number | string;
  className?: string;
  iconColor?: string;
  textColor?: string;
}

export default function InsightLogo({
  layout = 'horizontal',
  height,
  className = '',
  iconColor = '#13a5e1',
  textColor = '#13a5e1',
}: InsightLogoProps) {
  const [hasError, setHasError] = useState(false);
  const logoUrl = 'https://lh3.googleusercontent.com/d/1W8M61hlTvYjFPnQ6rhPqlmQXT4DNOPYm';

  // Fallback icon when the Google Drive image fails to load or during offline testing
  const renderFallbackIcon = (size: number) => (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="shrink-0 drop-shadow-sm"
      id="insight-logo-fallback-svg"
    >
      <rect
        x="12"
        y="14"
        width="76"
        height="76"
        rx="14"
        fill={iconColor}
        stroke={iconColor}
        strokeWidth="1.5"
      />
      <path
        d="M 16 14 C 16 28, 28 28, 40 28 L 78 28 C 86 28, 88 22, 88 14"
        fill="none"
        stroke="#ffffff"
        strokeWidth="6"
        strokeLinecap="round"
      />
      <circle
        cx="46"
        cy="48"
        r="11"
        fill="none"
        stroke="#ffffff"
        strokeWidth="3.5"
      />
      <circle
        cx="46"
        cy="48"
        r="3"
        fill="#ffffff"
      />
      <path
        d="M 34 82
           C 31 75, 33 70, 38 70
           C 41 70, 43 73, 44 76
           L 46 64
           C 46 59, 51 59, 51 64
           L 52 48
           C 52 43, 57 43, 57 48
           L 62 68
           C 63 64, 67 64, 67 68
           L 71 76
           C 72 72, 75 72, 75 76
           L 78 84
           C 80 92, 70 96, 62 92
           L 44 92
           Z"
        fill="#ffffff"
        stroke={iconColor}
        strokeWidth="1"
        strokeLinejoin="round"
      />
    </svg>
  );

  if (layout === 'icon-only') {
    const iconSize = typeof height === 'number' ? height : parseInt(String(height || 48), 10);
    return (
      <div className={`inline-flex items-center justify-center ${className}`} id="insight-logo-container">
        {!hasError ? (
          <img
            src={logoUrl}
            alt="Insight Logo"
            onError={() => setHasError(true)}
            style={{ height: iconSize, width: 'auto' }}
            className="object-contain max-w-full rounded-lg"
            referrerPolicy="no-referrer"
          />
        ) : (
          renderFallbackIcon(iconSize)
        )}
      </div>
    );
  }

  if (layout === 'vertical') {
    return (
      <div className={`flex flex-col items-center text-center ${className}`} id="insight-logo-vertical">
        {/* Main Logo Image or Fallback at top */}
        {!hasError ? (
          <img
            src={logoUrl}
            alt="Insight Logo"
            onError={() => setHasError(true)}
            style={{ height: typeof height === 'number' ? height : 96, width: 'auto' }}
            className="object-contain max-w-full rounded-xl"
            referrerPolicy="no-referrer"
          />
        ) : (
          <>
            {renderFallbackIcon(76)}
            {/* Brand texts below only if fallback */}
            <div className="mt-3 flex flex-col items-center">
              <span
                className="text-3xl font-black tracking-wider leading-none uppercase"
                style={{ color: textColor, fontFamily: 'Outfit, sans-serif' }}
              >
                INSIGHT
              </span>
              <span
                className="text-sm font-semibold tracking-[0.25em] uppercase mt-1 leading-none"
                style={{ color: textColor, fontFamily: 'Outfit, sans-serif' }}
              >
                Online Academy
              </span>
              <span
                className="text-lg italic mt-1 leading-none text-slate-500"
                style={{ fontFamily: 'Caveat, cursive' }}
              >
                Learn from anywhere
              </span>
            </div>
          </>
        )}
      </div>
    );
  }

  // Default: Horizontal layout (logo left, with optional companion details depending on style)
  const iconSize = typeof height === 'number' ? height : parseInt(String(height || 44), 10);
  return (
    <div className={`flex items-center gap-3 ${className}`} id="insight-logo-horizontal">
      {!hasError ? (
        <img
          src={logoUrl}
          alt="Insight Logo"
          onError={() => setHasError(true)}
          style={{ height: iconSize, width: 'auto' }}
          className="object-contain max-w-full rounded-lg"
          referrerPolicy="no-referrer"
        />
      ) : (
        <>
          {renderFallbackIcon(iconSize)}
          <div className="flex flex-col justify-center select-none text-left">
            <h1
              className="text-lg font-black tracking-wide leading-none uppercase"
              style={{ color: textColor, fontFamily: 'Outfit, sans-serif' }}
            >
              INSIGHT
            </h1>
            <p
              className="text-[10px] font-bold tracking-[0.22em] uppercase mt-0.5 leading-none"
              style={{ color: textColor, fontFamily: 'Outfit, sans-serif' }}
            >
              Online Academy
            </p>
            <p
              className="text-xs italic mt-0.5 leading-none text-slate-400"
              style={{ fontFamily: 'Caveat, cursive' }}
            >
              Learn from anywhere
            </p>
          </div>
        </>
      )}
    </div>
  );
}
