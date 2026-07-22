/**
 * Google Drive URL parsing and direct image link formatting utility
 */

/**
 * Extracts Google Drive FILE_ID from any Google Drive link
 */
export function extractGoogleDriveId(url: string | undefined | null): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  
  // 1. Match /file/d/FILE_ID
  const fileDMatch = trimmed.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (fileDMatch && fileDMatch[1]) return fileDMatch[1];
  
  // 2. Match open?id=FILE_ID, uc?id=FILE_ID, ?export=view&id=FILE_ID, etc.
  const idMatch = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idMatch && idMatch[1]) return idMatch[1];
  
  // 3. Match googleusercontent.com/d/FILE_ID
  const lh3Match = trimmed.match(/googleusercontent\.com\/d\/([a-zA-Z0-9_-]+)/);
  if (lh3Match && lh3Match[1]) return lh3Match[1];

  // 4. Raw file ID check (alphanumeric, 20-60 chars, no slashes or colons)
  if (!trimmed.includes('/') && !trimmed.includes(':') && /^[a-zA-Z0-9_-]{20,60}$/.test(trimmed)) {
    return trimmed;
  }
  
  return null;
}

/**
 * Validates if the given string is a Google Drive link containing a valid FILE_ID
 */
export function isGoogleDriveUrl(url: string | undefined | null): boolean {
  if (!url) return false;
  const trimmed = url.trim();
  const isDriveHost = trimmed.includes('drive.google.com') || trimmed.includes('googleusercontent.com');
  const fileId = extractGoogleDriveId(trimmed);
  return Boolean(isDriveHost && fileId);
}

/**
 * Converts any Google Drive public URL or ID into direct view link:
 * https://drive.google.com/uc?export=view&id=FILE_ID
 */
export function formatToGoogleDriveDirectUrl(urlOrId: string | undefined | null): string {
  if (!urlOrId) return '';
  const fileId = extractGoogleDriveId(urlOrId);
  if (fileId) {
    return `https://drive.google.com/uc?export=view&id=${fileId}`;
  }
  return urlOrId.trim();
}
