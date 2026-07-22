import React, { useState, useEffect } from 'react';
import { formatToGoogleDriveDirectUrl } from '../utils/googleDrive';
import { User, Star } from 'lucide-react';

interface CandidatePhotoProps {
  photoUrl?: string;
  avatarImageUrl?: string;
  candidatePhotoURL?: string;
  alt?: string;
  className?: string;
  fallbackSeed?: string;
  themeGradient?: string;
}

export const CandidatePhoto: React.FC<CandidatePhotoProps> = ({
  photoUrl,
  avatarImageUrl,
  candidatePhotoURL,
  alt = 'Candidate Avatar',
  className = 'h-full w-full object-cover',
  fallbackSeed,
  themeGradient
}) => {
  const rawUrl = avatarImageUrl || photoUrl || candidatePhotoURL || '';
  const directUrl = formatToGoogleDriveDirectUrl(rawUrl);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [directUrl]);

  if (directUrl && !hasError) {
    return (
      <img
        src={directUrl}
        alt={alt}
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => setHasError(true)}
        className={className}
      />
    );
  }

  const errorMessage = "Unable to load image. Please make sure the Google Drive file is shared as 'Anyone with the link'.";

  // Default fallback avatar when no photo or on error
  if (themeGradient) {
    return (
      <div
        className={`h-full w-full bg-gradient-to-tr ${themeGradient} text-white font-bold flex flex-col items-center justify-center text-xs overflow-hidden`}
        title={hasError ? errorMessage : undefined}
      >
        <span className="text-base font-black uppercase font-mono">{fallbackSeed || 'CD'}</span>
      </div>
    );
  }

  return (
    <div
      className="h-full w-full bg-slate-100 text-slate-400 flex items-center justify-center"
      title={hasError ? errorMessage : undefined}
    >
      {fallbackSeed ? (
        <span className="font-bold text-xs uppercase font-mono text-slate-500">
          {fallbackSeed.slice(0, 2)}
        </span>
      ) : (
        <User className="h-1/2 w-1/2 stroke-[1.5]" />
      )}
    </div>
  );
};

interface CandidateSymbolProps {
  symbolUrl?: string;
  identitySymbolImageUrl?: string;
  symbolURL?: string;
  symbolText?: string;
  alt?: string;
  className?: string;
  fallbackSymbol?: string;
}

export const CandidateSymbol: React.FC<CandidateSymbolProps> = ({
  symbolUrl,
  identitySymbolImageUrl,
  symbolURL,
  symbolText,
  alt = 'Candidate Identity Symbol',
  className = 'h-4 w-4 object-contain shrink-0',
  fallbackSymbol
}) => {
  const rawUrl = identitySymbolImageUrl || symbolUrl || symbolURL || (symbolText?.startsWith('http') ? symbolText : '');
  const directUrl = formatToGoogleDriveDirectUrl(rawUrl);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [directUrl]);

  if (directUrl && !hasError) {
    return (
      <img
        src={directUrl}
        alt={alt}
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => setHasError(true)}
        className={className}
      />
    );
  }

  // Default fallback symbol when no symbol image or on error
  const displayChar = fallbackSymbol || (symbolText && !symbolText.startsWith('http') ? symbolText.split(' ')[0] : '⭐');
  const errorMessage = "Unable to load image. Please make sure the Google Drive file is shared as 'Anyone with the link'.";

  return (
    <span
      className="inline-flex items-center justify-center text-xs shrink-0"
      title={hasError ? errorMessage : undefined}
    >
      {displayChar}
    </span>
  );
};
