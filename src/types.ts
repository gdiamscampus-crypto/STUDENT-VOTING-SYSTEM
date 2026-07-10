/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Position {
  id: string;
  name: string;
}

export const DEFAULT_POSITIONS: Position[] = [
  { id: 'pos-1', name: 'Head Boy' },
  { id: 'pos-3', name: 'Head Girl' },
  { id: 'pos-5', name: 'Fine Arts Secretary' },
  { id: 'pos-7', name: 'Magazine Editor' },
];

export interface Candidate {
  id: string;
  positionId: string; // References position.id
  name: string;
  grade: string;      // Class
  division: string;   // Division
  rollNumber: string; // Roll Number
  symbol: string;     // Election Symbol / Symbol Text
  bio: string;        // Candidate Introduction
  manifesto: string;  // Manifesto
  avatarSeed: string; // Avatar Seed or Color styling info
  colorTheme: string; // Theme color (indigo, emerald, etc.)
  photoUrl?: string;  // Candidate photo URL
  symbolUrl?: string; // Symbol image URL
  votesCount: number;

  // Exact Firestore schema alignment fields
  candidateId?: string;
  electionId?: string;
  candidateName?: string;
  candidatePhotoURL?: string;
  class?: string;
  symbolURL?: string;
  biography?: string;
  createdAt?: string;
}

export interface Vote {
  id: string;
  studentId: string;
  studentName: string;
  positionId: string;  // References position.id
  candidateId: string; // References candidate.id
  timestamp: string;
}

export type SoundType =
  | 'login_sound'
  | 'select_sound'
  | 'vote_success'
  | 'warning_sound'
  | 'winner_sound'
  | 'new_vote_sound'
  | 'election_started_sound'
  | 'election_ended_sound'
  | 'candidate_added_sound';

export interface AudioSettings {
  enabled: boolean;
  volume: number; // 0 to 1
  soundToggles: Record<SoundType, boolean>;
}

export type ElectionStatus = 'setup' | 'active' | 'ended';

export interface StudentSession {
  id: string;
  name: string;
  hasVoted: boolean;
  votedForId?: string;
  grade?: string;
}

export interface Student {
  studentId: string;
  studentName: string;
  admissionId: string;
  grade: string;
  passcode: string;
  hasVoted: boolean;
  votedAt: string | null;
}

export interface Admin {
  adminId: string;
  name: string;
  username: string;
  email: string;
  password: string; // hashed password
  role: string;
  createdAt: string;
  lastLogin: string | null;
}

export interface SelfieVerification {
  id: string;
  admissionId: string;
  studentName: string;
  loginTime: string;
  capturedSelfie: string; // Base64 data URI
  deviceInfo: string;
}


