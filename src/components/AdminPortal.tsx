/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, FormEvent, useRef, ChangeEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Candidate, Vote, SoundType, AudioSettings, ElectionStatus, AdmittedStudent, Position } from '../types';
import {
  playSystemSound,
  updateAudioSettings,
  getAudioSettings,
  registerCustomSound,
  removeCustomSound,
  getCustomSoundName,
} from '../audio';
import {
  Settings,
  Volume2,
  VolumeX,
  Plus,
  Play,
  RotateCcw,
  UploadCloud,
  Check,
  Award,
  Sparkles,
  Trophy,
  Activity,
  UserPlus,
  Calendar,
  AlertTriangle,
  Info,
  Trash2,
  Users,
  ChevronDown,
  ChevronUp,
  Image as ImageIcon,
  Edit,
  X,
  Loader2,
  LogOut,
  KeyRound,
  Lock,
  Eye,
  EyeOff,
  ShieldCheck,
} from 'lucide-react';

interface AdminPortalProps {
  positions: Position[];
  candidates: Candidate[];
  votes: Vote[];
  electionStatus: ElectionStatus;
  setElectionStatus: (status: ElectionStatus) => void;
  onAddCandidate: (candidate: Omit<Candidate, 'votesCount'>) => void;
  onDeleteCandidate: (candidateId: string) => void;
  onUpdateCandidate: (candidateId: string, updatedFields: Partial<Candidate>) => void;
  onClearVotes: () => void;
  audioSettings: AudioSettings;
  onUpdateAudioSettings: (settings: AudioSettings) => void;
  admittedStudents: AdmittedStudent[];
  onAddAdmittedStudent: (student: AdmittedStudent) => void;
  onDeleteAdmittedStudent: (studentId: string) => void;
  adminPassword?: string;
  onUpdateAdminPassword?: (newPassword: string) => Promise<void>;
  onLogout?: () => void;
}

const SOUND_LABELS: Record<SoundType, { label: string; desc: string }> = {
  login_sound: { label: 'Student Login Chime', desc: 'Plays a warm, soft chord after entering student details.' },
  select_sound: { label: 'Candidate Click Select', desc: 'Tactile high-pitched chirp when clicking a ballot profile.' },
  vote_success: { label: 'Vote Submitted Success', desc: 'Digital triple-frequency fanfare with sparkling confirmation.' },
  warning_sound: { label: 'Duplicate Vote Warning', desc: 'Low-frequency detuned warning buzz for blockages or errors.' },
  winner_sound: { label: 'Victory & Crowd Applause', desc: 'Five-tone crescendo with synthesized crowd clapping.' },
  new_vote_sound: { label: 'Admin Vote Received', desc: 'High-frequency double chime alert when a new ballot is cast.' },
  election_started_sound: { label: 'Election Started Bell', desc: 'Ascending brassy synthesizer wave indicating start.' },
  election_ended_sound: { label: 'Election Stopped Bell', desc: 'Descending deep triangle wave indicating shutdown.' },
  candidate_added_sound: { label: 'Candidate Added Chirp', desc: 'Cheerful upward triple chirp when adding profile.' },
};

export default function AdminPortal({
  positions,
  candidates,
  votes,
  electionStatus,
  setElectionStatus,
  onAddCandidate,
  onDeleteCandidate,
  onUpdateCandidate,
  onClearVotes,
  audioSettings,
  onUpdateAudioSettings,
  admittedStudents,
  onAddAdmittedStudent,
  onDeleteAdmittedStudent,
  adminPassword = 'admin123',
  onUpdateAdminPassword,
  onLogout,
}: AdminPortalProps) {
  // Sound Settings State
  const [localSettings, setLocalSettings] = useState<AudioSettings>(audioSettings);
  const [resultsPublished, setResultsPublished] = useState(false);
  
  // Filter state for candidates table
  const [filterPositionId, setFilterPositionId] = useState<string>('all');
  
  // Collapsed sections for results
  const [expandedResults, setExpandedResults] = useState<Record<string, boolean>>({});

  // Passcode Settings States
  const [newPasscode, setNewPasscode] = useState(adminPassword);
  const [showPasscodeText, setShowPasscodeText] = useState(false);
  const [isSavingPasscode, setIsSavingPasscode] = useState(false);
  const [passcodeSuccess, setPasscodeSuccess] = useState(false);

  // Keep newPasscode state synced if parent updates adminPassword
  useEffect(() => {
    setNewPasscode(adminPassword);
  }, [adminPassword]);

  // Sync state from Parent/Firestore
  useEffect(() => {
    setLocalSettings(audioSettings);
  }, [audioSettings]);

  // Add Candidate Form States
  const [candName, setCandName] = useState('');
  const [candPositionId, setCandPositionId] = useState(positions[0]?.id || 'pos-1');
  const [candGrade, setCandGrade] = useState('Grade 10');
  const [candDivision, setCandDivision] = useState('A');
  const [candRoll, setCandRoll] = useState('');
  const [candSymbol, setCandSymbol] = useState('⭐');
  const [candBio, setCandBio] = useState('');
  const [candManifesto, setCandManifesto] = useState('');
  const [candTheme, setCandTheme] = useState('indigo');

  // Candidate photo/symbol system & editing states
  const [editingCandidateId, setEditingCandidateId] = useState<string | null>(null);
  const [activeCandidateId, setActiveCandidateId] = useState<string>(`cand_${Date.now()}`);
  const [photoUrl, setPhotoUrl] = useState<string>('');
  const [symbolUrl, setSymbolUrl] = useState<string>('');
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string>('');
  const [symbolPreviewUrl, setSymbolPreviewUrl] = useState<string>('');

  // Google Drive Link states
  const [photoDriveLink, setPhotoDriveLink] = useState<string>('');
  const [isPhotoLinkValid, setIsPhotoLinkValid] = useState<boolean | null>(null);
  const [isValidatingPhoto, setIsValidatingPhoto] = useState<boolean>(false);
  const [photoValidationError, setPhotoValidationError] = useState<string | null>(null);

  // Helper to extract File ID from public Google Drive Link
  const extractGoogleDriveId = (url: string): string | null => {
    if (!url) return null;
    const match1 = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (match1 && match1[1]) return match1[1];
    const match2 = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (match2 && match2[1]) return match2[1];
    const match3 = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (match3 && match3[1]) return match3[1];
    if (/^[a-zA-Z0-9_-]{25,45}$/.test(url)) return url;
    return null;
  };

  // Automatically parse Google Drive URL, extract ID, and validate image loading
  useEffect(() => {
    if (!photoDriveLink.trim()) {
      setPhotoUrl('');
      setPhotoPreviewUrl('');
      setIsPhotoLinkValid(null);
      setPhotoValidationError(null);
      return;
    }

    const fileId = extractGoogleDriveId(photoDriveLink);
    if (!fileId) {
      setIsPhotoLinkValid(false);
      setPhotoValidationError('Please enter a valid Google Drive link.');
      setPhotoUrl('');
      setPhotoPreviewUrl('');
      return;
    }

    const directUrl = `https://lh3.googleusercontent.com/d/${fileId}`;
    setPhotoUrl(directUrl);
    setPhotoPreviewUrl(directUrl);
    setIsValidatingPhoto(true);
    setPhotoValidationError(null);

    const img = new Image();
    img.onload = () => {
      setIsPhotoLinkValid(true);
      setIsValidatingPhoto(false);
      setPhotoValidationError(null);
    };
    img.onerror = () => {
      setIsPhotoLinkValid(false);
      setIsValidatingPhoto(false);
      setPhotoValidationError('Could not load image. Make sure sharing is set to "Anyone with the link"');
    };
    img.src = directUrl;
  }, [photoDriveLink]);

  // Sync default position if positions load later
  useEffect(() => {
    if (positions.length > 0 && !candPositionId) {
      setCandPositionId(positions[0].id);
    }
  }, [positions, candPositionId]);

  // Sync expanded status
  useEffect(() => {
    if (positions.length > 0 && Object.keys(expandedResults).length === 0) {
      const initial: Record<string, boolean> = {};
      positions.forEach((p, idx) => {
        initial[p.id] = idx < 2; // Expand first 2 by default
      });
      setExpandedResults(initial);
    }
  }, [positions, expandedResults]);

  // Sync state to service and parent/database
  const handleToggleGlobal = (enabled: boolean) => {
    const updated = { ...localSettings, enabled };
    setLocalSettings(updated);
    updateAudioSettings(updated);
    onUpdateAudioSettings(updated);
  };

  const handleVolumeChange = (volume: number) => {
    const updated = { ...localSettings, volume };
    setLocalSettings(updated);
    updateAudioSettings(updated);
    onUpdateAudioSettings(updated);
  };

  const handleToggleSound = (soundKey: SoundType, enabled: boolean) => {
    const updatedToggles = { ...localSettings.soundToggles, [soundKey]: enabled };
    const updated = { ...localSettings, soundToggles: updatedToggles };
    setLocalSettings(updated);
    updateAudioSettings(updated);
    onUpdateAudioSettings(updated);
  };

  const getPositionSlug = (positionId: string) => {
    const pos = positions.find((p) => p.id === positionId);
    if (!pos) return 'unknown';
    return pos.name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
  };

  const handleSelectForEdit = (candidate: Candidate) => {
    setEditingCandidateId(candidate.id);
    setActiveCandidateId(candidate.id);
    setCandName(candidate.name);
    setCandPositionId(candidate.positionId);
    setCandGrade(candidate.grade);
    setCandDivision(candidate.division);
    setCandRoll(candidate.rollNumber);
    setCandSymbol(candidate.symbol);
    setCandBio(candidate.bio);
    setCandManifesto(candidate.manifesto);
    setCandTheme(candidate.colorTheme);
    setPhotoUrl(candidate.photoUrl || '');
    setPhotoPreviewUrl(candidate.photoUrl || '');
    setSymbolUrl(candidate.symbolUrl || '');
    setSymbolPreviewUrl(candidate.symbolUrl || '');
    
    // Reverse-engineer the Google Drive view link from direct link if possible
    const fileId = extractGoogleDriveId(candidate.photoUrl);
    if (fileId) {
      setPhotoDriveLink(`https://drive.google.com/file/d/${fileId}/view`);
    } else {
      setPhotoDriveLink(candidate.photoUrl || '');
    }

    setPhotoValidationError(null);
    setIsPhotoLinkValid(null);
    setIsValidatingPhoto(false);

    playSystemSound('select_sound');
  };

  const handleCancelEdit = () => {
    setEditingCandidateId(null);
    setActiveCandidateId(`cand_${Date.now()}`);
    setCandName('');
    setCandRoll('');
    setCandBio('');
    setCandManifesto('');
    setPhotoUrl('');
    setPhotoPreviewUrl('');
    setSymbolUrl('');
    setSymbolPreviewUrl('');
    setPhotoDriveLink('');
    setPhotoValidationError(null);
    setIsPhotoLinkValid(null);
    setIsValidatingPhoto(false);
    playSystemSound('select_sound');
  };

  const handleDeleteTrigger = (candidateId: string) => {
    if (confirm("Are you sure you want to delete this candidate? This action is irreversible.")) {
      onDeleteCandidate(candidateId);
      if (editingCandidateId === candidateId) {
        handleCancelEdit();
      }
      playSystemSound('warning_sound');
    }
  };

  // Add or Update candidate action
  const handleCreateCandidate = (e: FormEvent) => {
    e.preventDefault();
    if (!candName.trim() || !candPositionId) return;

    const candId = editingCandidateId || activeCandidateId;
    const candidateData: Candidate = {
      id: candId,
      positionId: candPositionId,
      name: candName.trim(),
      grade: candGrade,
      division: candDivision.trim() || 'A',
      rollNumber: candRoll.trim() || '1',
      symbol: candSymbol.trim() || '⭐',
      bio: candBio.trim() || 'No biography details provided.',
      manifesto: candManifesto.trim() || 'No manifesto detailed.',
      avatarSeed: candName.trim().slice(0, 2).toUpperCase(),
      colorTheme: candTheme,
      photoUrl: photoUrl || '',
      symbolUrl: symbolUrl || '',
      votesCount: candidates.find(c => c.id === candId)?.votesCount || 0,

      // Exact Firestore schema alignment fields
      candidateId: candId,
      electionId: '',
      candidateName: candName.trim(),
      candidatePhotoURL: photoUrl || '',
      class: candGrade,
      symbolURL: symbolUrl || '',
      biography: candBio.trim() || 'No biography details provided.',
      createdAt: new Date().toISOString()
    };

    if (editingCandidateId) {
      onUpdateCandidate(editingCandidateId, candidateData);
      setEditingCandidateId(null);
    } else {
      onAddCandidate(candidateData);
    }

    setCandName('');
    setCandRoll('');
    setCandBio('');
    setCandManifesto('');
    setPhotoUrl('');
    setPhotoPreviewUrl('');
    setSymbolUrl('');
    setSymbolPreviewUrl('');
    setPhotoDriveLink('');
    setPhotoValidationError(null);
    setIsPhotoLinkValid(null);
    setIsValidatingPhoto(false);
    setActiveCandidateId(`cand_${Date.now()}`);
    
    playSystemSound('candidate_added_sound');
  };

  // State control actions
  const handleStartElection = () => {
    setElectionStatus('active');
    setResultsPublished(false);
    playSystemSound('election_started_sound');
  };

  const handleEndElection = () => {
    setElectionStatus('ended');
    playSystemSound('election_ended_sound');
  };

  const handlePublishResults = () => {
    setResultsPublished(true);
    playSystemSound('winner_sound');
  };

  // Custom File uploads
  const handleFileUpload = (soundKey: SoundType, file: File) => {
    if (!file) return;
    registerCustomSound(soundKey, file);
    setLocalSettings(getAudioSettings());
    playSystemSound(soundKey);
  };

  // Reset custom sound back to default synthesized
  const handleResetSound = (soundKey: SoundType) => {
    removeCustomSound(soundKey);
    setLocalSettings(getAudioSettings());
  };

  const toggleResultCollapse = (id: string) => {
    setExpandedResults((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  // Total unique voters who submitted ballots
  const totalBallotsCast = admittedStudents.filter((s) =>
    votes.some((v) => v.studentId.trim().toUpperCase() === s.id.trim().toUpperCase())
  ).length;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-fadeIn" id="admin-portal-grid">
      {/* Top Banner with Administrative Welcome & Logout */}
      <div className="lg:col-span-12 bg-indigo-950 text-white p-6 rounded-2xl flex flex-col md:flex-row justify-between items-center gap-4 shadow-lg border border-indigo-900" id="admin-top-banner">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 bg-white/10 rounded-xl flex items-center justify-center text-indigo-400 shrink-0">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-base font-black tracking-tight">Administrative Session Active</h2>
            <p className="text-xs text-indigo-200">You have full read/write permission to student records, candidates list, and database status.</p>
          </div>
        </div>
        {onLogout && (
          <button
            onClick={() => {
              if (confirm("Logout from the Administrative session?")) {
                onLogout();
              }
            }}
            className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white font-bold text-xs rounded-xl shadow border border-white/20 transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
            id="admin-logout-btn"
          >
            <LogOut className="h-4 w-4 text-indigo-400" />
            End Admin Session
          </button>
        )}
      </div>

      {/* LEFT COLUMN: Controls, Candidate Register, Live Stats */}
      <div className="lg:col-span-7 space-y-8">
        
        {/* Election Status Control */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 space-y-4" id="election-controls-card">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <Calendar className="h-5 w-5 text-indigo-500" />
              Election State Manager
            </h3>
            <span className={`text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider ${
              electionStatus === 'active'
                ? 'bg-emerald-100 text-emerald-800 animate-pulse'
                : electionStatus === 'ended'
                ? 'bg-rose-100 text-rose-800'
                : 'bg-slate-100 text-slate-700'
            }`}>
              {electionStatus === 'active' ? '● Live Voting' : electionStatus === 'ended' ? 'Ended' : 'Setup Stage'}
            </span>
          </div>

          <p className="text-xs text-slate-500 leading-relaxed">
            Configure the current phase of the election. Turning on/off elections triggers custom ascending or descending audio bell indicators.
          </p>

          <div className="flex flex-wrap gap-3 pt-2">
            {electionStatus !== 'active' && (
              <button
                onClick={handleStartElection}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl shadow transition-colors flex items-center gap-1.5 cursor-pointer"
                id="start-election-btn"
              >
                <Play className="h-3.5 w-3.5 fill-current" />
                Start Election
              </button>
            )}

            {electionStatus === 'active' && (
              <button
                onClick={handleEndElection}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs rounded-xl shadow transition-colors flex items-center gap-1.5 cursor-pointer"
                id="end-election-btn"
              >
                <AlertTriangle className="h-3.5 w-3.5" />
                End Election & Freeze Ballots
              </button>
            )}

            {electionStatus === 'ended' && !resultsPublished && (
              <button
                onClick={handlePublishResults}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-xl shadow transition-colors flex items-center gap-1.5 cursor-pointer"
                id="publish-results-btn"
              >
                <Trophy className="h-3.5 w-3.5" />
                Publish Winner & Play Fanfare
              </button>
            )}

            <button
              onClick={() => {
                if (confirm("Are you sure you want to clear all data and reset the board? This deletes all votes.")) {
                  onClearVotes();
                  setResultsPublished(false);
                }
              }}
              className="px-4 py-2 text-slate-500 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 hover:border-rose-100 rounded-xl font-medium text-xs transition-colors ml-auto cursor-pointer"
              id="clear-votes-btn"
            >
              Reset Data Board
            </button>
          </div>
        </div>

        {/* Live Election Results / Separate Results for Each Post */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 space-y-6" id="election-results-card">
          <div className="flex justify-between items-center border-b border-slate-50 pb-4">
            <div>
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <Activity className="h-5 w-5 text-indigo-500" />
                Post-wise Election Tallies
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Total Voters Participated: <strong className="font-mono text-slate-800">{totalBallotsCast}</strong> of <strong className="font-mono text-slate-800">{admittedStudents.length}</strong>
              </p>
            </div>

            {resultsPublished && (
              <span className="flex items-center gap-1 bg-amber-50 border border-amber-200 text-amber-700 text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider animate-none" id="results-published-tag">
                <Trophy className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                Published
              </span>
            )}
          </div>

          {/* Collapsible tally groups per position */}
          <div className="space-y-4" id="post-tallies-wrapper">
            {positions.map((pos) => {
              const positionCandidates = candidates.filter((c) => c.positionId === pos.id);
              const positionVotes = votes.filter((v) => v.positionId === pos.id);
              
              // Sort candidates running for this position by votes Count
              const sortedCandidates = [...positionCandidates].sort((a, b) => b.votesCount - a.votesCount);
              const leadingCand = sortedCandidates[0];
              const isWinner = resultsPublished && leadingCand && leadingCand.votesCount > 0;
              const isExpanded = !!expandedResults[pos.id];

              return (
                <div key={pos.id} className="border border-slate-100 rounded-xl overflow-hidden" id={`post-tally-${pos.id}`}>
                  {/* Tally Group Header */}
                  <button
                    onClick={() => toggleResultCollapse(pos.id)}
                    className="w-full flex items-center justify-between p-4 bg-slate-50/50 hover:bg-slate-50 transition-colors text-left cursor-pointer"
                  >
                    <div>
                      <span className="text-[9px] font-extrabold text-indigo-600 uppercase tracking-wider block">Election Post</span>
                      <h4 className="text-sm font-black text-slate-800 flex items-center gap-1.5">
                        {pos.name}
                        {isWinner && (
                          <span className="bg-amber-100 border border-amber-200 text-amber-800 text-[9px] font-bold px-1.5 py-0.2 rounded-full flex items-center gap-0.5 animate-bounce">
                            🏆 Winner: {leadingCand.name}
                          </span>
                        )}
                      </h4>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <span className="font-mono">{positionVotes.length} votes</span>
                      {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </div>
                  </button>

                  {/* Tally Group Content */}
                  <AnimatePresence initial={false}>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="p-4 border-t border-slate-50 space-y-4 bg-white"
                      >
                        {sortedCandidates.map((c) => {
                          const percentage = positionVotes.length > 0 ? Math.round((c.votesCount / positionVotes.length) * 100) : 0;
                          const isLead = leadingCand && leadingCand.id === c.id && c.votesCount > 0;

                          return (
                            <div key={c.id} className="p-3 bg-slate-50/50 hover:bg-slate-50 rounded-xl border border-slate-100 transition-all space-y-2.5" id={`cand-bar-${c.id}`}>
                              <div className="flex justify-between items-center text-xs flex-wrap gap-2">
                                <div className="flex items-center gap-2.5">
                                  {/* Candidate Circular Profile Image */}
                                  <div className="h-9 w-9 rounded-full border border-slate-200 overflow-hidden bg-slate-100 shrink-0 relative flex items-center justify-center">
                                    {c.photoUrl ? (
                                      <img src={c.photoUrl} alt={c.name} loading="lazy" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
                                    ) : (
                                      <span className="text-[10px] font-bold text-slate-400 uppercase font-mono">
                                        {c.name.slice(0, 2).toUpperCase()}
                                      </span>
                                    )}
                                  </div>

                                  <div className="space-y-0.5">
                                    <span className="font-bold text-slate-800 flex items-center gap-1.5 flex-wrap">
                                      {c.symbolUrl ? (
                                        <img src={c.symbolUrl} className="h-4 w-4 object-contain shrink-0" referrerPolicy="no-referrer" alt="symbol" />
                                      ) : (
                                        <span>{c.symbol.split(' ')[0]}</span>
                                      )}
                                      {c.name}
                                      <span className="text-[10px] text-slate-400 font-mono">({c.grade} / Div {c.division})</span>
                                      {isWinner && isLead && (
                                        <span className="inline-flex items-center gap-0.5 bg-amber-500 text-white px-1.5 py-0.2 rounded text-[9px] font-bold">
                                          👑 Winner
                                        </span>
                                      )}
                                    </span>
                                    <p className="text-[10px] text-slate-400 font-mono">Roll: {c.rollNumber}</p>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2.5">
                                  <span className="text-slate-500 font-mono text-[11px] font-medium">
                                    <strong>{c.votesCount}</strong> {c.votesCount === 1 ? 'vote' : 'votes'} ({percentage}%)
                                  </span>
                                  
                                  {/* Action Buttons */}
                                  <div className="flex items-center gap-1">
                                    <button
                                      type="button"
                                      onClick={() => handleSelectForEdit(c)}
                                      className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                                      title="Edit Candidate"
                                    >
                                      <Edit className="h-3.5 w-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteTrigger(c.id)}
                                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                      title="Delete Candidate"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  </div>
                                </div>
                              </div>

                              <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden relative">
                                <motion.div
                                  initial={{ width: 0 }}
                                  animate={{ width: `${percentage}%` }}
                                  transition={{ duration: 0.6, ease: 'easeOut' }}
                                  className={`h-full rounded-full ${
                                    isLead && resultsPublished
                                      ? 'bg-gradient-to-r from-amber-500 to-orange-500 shadow-sm'
                                      : isLead
                                      ? 'bg-indigo-600/80'
                                      : 'bg-indigo-600/40'
                                  }`}
                                />
                              </div>
                            </div>
                          );
                        })}

                        {positionCandidates.length === 0 && (
                          <div className="text-center py-4 text-slate-400 text-xs">
                            No candidates registered for this post.
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </div>

        {/* Register Candidate Form */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 space-y-4" id="add-candidate-card">
          <div className="flex justify-between items-center">
            <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
              {editingCandidateId ? (
                <>
                  <Edit className="h-5 w-5 text-indigo-500 animate-pulse" />
                  Update Candidate Profile
                </>
              ) : (
                <>
                  <UserPlus className="h-5 w-5 text-indigo-500" />
                  Add Candidate Profile
                </>
              )}
            </h3>
            {editingCandidateId && (
              <button
                type="button"
                onClick={handleCancelEdit}
                className="text-xs text-indigo-600 hover:text-indigo-800 font-bold hover:underline flex items-center gap-1 cursor-pointer"
              >
                <X className="h-3 w-3" />
                Cancel Edit
              </button>
            )}
          </div>

          {/* Live Profile Ballot Preview Card */}
          <div className="border border-indigo-100 bg-indigo-50/25 rounded-2xl p-4.5 space-y-3">
            <span className="text-[10px] font-black text-indigo-600 uppercase tracking-wider block">
              Live Profile Ballot Preview
            </span>
            <div className="flex gap-4 items-center">
              {/* Circular Candidate Photo Preview */}
              <div className="flex flex-col items-center gap-1">
                <div className="h-14 w-14 rounded-full border border-slate-200 overflow-hidden shrink-0 relative flex items-center justify-center text-slate-400 bg-slate-50 shadow-sm">
                  {photoPreviewUrl || photoUrl ? (
                    <img src={photoPreviewUrl || photoUrl} alt="Circular Preview" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex flex-col items-center justify-center">
                      <ImageIcon className="h-5 w-5 text-slate-300" />
                    </div>
                  )}
                </div>
                <span className="text-[8px] font-bold text-slate-400">Circular</span>
              </div>

              {/* Square Candidate Photo Preview */}
              <div className="flex flex-col items-center gap-1">
                <div className="h-14 w-14 rounded-xl border border-slate-200 overflow-hidden shrink-0 relative flex items-center justify-center text-slate-400 bg-slate-50 shadow-sm">
                  {photoPreviewUrl || photoUrl ? (
                    <img src={photoPreviewUrl || photoUrl} alt="Square Preview" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex flex-col items-center justify-center">
                      <ImageIcon className="h-5 w-5 text-slate-300" />
                    </div>
                  )}
                </div>
                <span className="text-[8px] font-bold text-slate-400">Square</span>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded uppercase">
                    {candGrade} / Div {candDivision || 'A'}
                  </span>
                  <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                    Roll {candRoll || '0'}
                  </span>
                </div>
                <h5 className="font-extrabold text-slate-800 text-sm leading-tight">
                  {candName || 'Candidate Name'}
                </h5>
                <div className="flex items-center gap-1.5 text-xs text-indigo-600 font-semibold italic mt-0.5">
                  {symbolPreviewUrl || symbolUrl ? (
                    <img src={symbolPreviewUrl || symbolUrl} referrerPolicy="no-referrer" className="h-4 w-4 object-contain" alt="Symbol" />
                  ) : (
                    <span>{candSymbol.split(' ')[0] || '⭐'}</span>
                  )}
                  <span>Symbol: {candSymbol}</span>
                </div>
              </div>
            </div>
          </div>

          <form onSubmit={handleCreateCandidate} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Candidate Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ahmed Rahman"
                  value={candName}
                  onChange={(e) => setCandName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 text-xs transition-all"
                  id="admin-cand-name"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Election Post Name</label>
                <select
                  value={candPositionId}
                  onChange={(e) => setCandPositionId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 text-xs transition-all"
                  id="admin-cand-position"
                >
                  {positions.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Grade Level</label>
                <select
                  value={candGrade}
                  onChange={(e) => setCandGrade(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 text-xs transition-all"
                  id="admin-cand-grade"
                >
                  <option>Grade 8</option>
                  <option>Grade 9</option>
                  <option>Grade 10</option>
                  <option>Grade 11</option>
                  <option>Grade 12</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Division</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. A"
                  value={candDivision}
                  onChange={(e) => setCandDivision(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 text-xs transition-all"
                  id="admin-cand-division"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Roll Number</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 15"
                  value={candRoll}
                  onChange={(e) => setCandRoll(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 text-xs transition-all"
                  id="admin-cand-roll"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Election Symbol</label>
                <select
                  value={candSymbol}
                  onChange={(e) => setCandSymbol(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 text-xs transition-all"
                  id="admin-cand-symbol"
                >
                  <option>⭐ Star</option>
                  <option>🔥 Fire</option>
                  <option>🌟 Sparkles</option>
                  <option>☀️ Sun</option>
                  <option>🌸 Flower</option>
                                  <option>🕊️ Dove</option>
                  <option>🎨 Palette</option>
                  <option>🎭 Drama Mask</option>
                  <option>✍️ Pencil</option>
                </select>
              </div>
            </div>

            {/* Google Drive Photo Link Row */}
            <div className="border-y border-slate-50 py-4">
              <div className="space-y-1.5 bg-slate-50/40 p-4 rounded-2xl border border-slate-100 flex flex-col justify-between">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                    Candidate Photo Google Drive Link
                  </label>
                  <div className="mt-1.5 space-y-2">
                    <input
                      type="text"
                      placeholder="e.g. https://drive.google.com/file/d/FILE_ID/view"
                      value={photoDriveLink}
                      onChange={(e) => setPhotoDriveLink(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 text-xs transition-all"
                      id="admin-cand-photo-drive-link"
                    />
                    
                    <p className="text-[10px] text-slate-400 font-medium leading-relaxed">
                      Example: <span className="font-mono bg-slate-100 px-1 py-0.5 rounded text-[9px]">https://drive.google.com/file/d/FILE_ID/view</span>
                    </p>
                  </div>

                  {/* Validation Indicators */}
                  {photoDriveLink.trim() !== '' && (
                    <div className="mt-3 p-3 rounded-xl bg-white border border-slate-100 space-y-2 text-xs shadow-sm">
                      {isValidatingPhoto && (
                        <div className="flex items-center gap-2 text-indigo-600 font-semibold animate-pulse">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          <span>Validating Google Drive link and checking accessibility...</span>
                        </div>
                      )}

                      {!isValidatingPhoto && isPhotoLinkValid === true && (
                        <div className="p-2 bg-emerald-50 border border-emerald-100 rounded-lg text-emerald-700 font-bold flex items-center gap-2 text-[11px]">
                          <Check className="h-4 w-4" />
                          <span>Google Drive Link Verified & Publicly Accessible</span>
                        </div>
                      )}

                      {!isValidatingPhoto && isPhotoLinkValid === false && (
                        <div className="p-2.5 bg-amber-50 border border-amber-100 rounded-lg text-amber-800 space-y-1.5 text-[11px]">
                          <div className="flex items-start gap-2">
                            <span className="text-amber-500 text-sm leading-none font-bold">⚠️</span>
                            <div className="space-y-1">
                              <p className="font-bold">{photoValidationError || 'Invalid link or private file.'}</p>
                              <p className="text-[10px] text-slate-500 font-normal leading-relaxed">
                                Note: <strong>You can still save this candidate.</strong> Sometimes Google Drive links fail to verify inside our nested development sandbox, but will show up fine on your ballot. Just make sure the file is shared with <strong>"Anyone with the link"</strong> in Google Drive!
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Biography & Campaign Agenda (Candidate Introduction)</label>
              <textarea
                placeholder="Brief introduction of candidate platform..."
                rows={2}
                value={candBio}
                onChange={(e) => setCandBio(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 text-xs transition-all resize-none"
                id="admin-cand-bio"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Manifesto Platform</label>
              <textarea
                placeholder="Candidate manifesto details..."
                rows={2}
                value={candManifesto}
                onChange={(e) => setCandManifesto(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 text-xs transition-all resize-none"
                id="admin-cand-manifesto"
              />
            </div>

            {/* Profile theme color selector */}
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">Aesthetic Color Theme</label>
              <div className="flex gap-3" id="admin-theme-selector">
                {['indigo', 'emerald', 'rose', 'amber', 'purple', 'teal'].map((theme) => {
                  const colors: Record<string, string> = {
                    indigo: 'bg-indigo-500 ring-indigo-200',
                    emerald: 'bg-emerald-500 ring-emerald-200',
                    rose: 'bg-rose-500 ring-rose-200',
                    amber: 'bg-amber-500 ring-amber-200',
                    purple: 'bg-purple-500 ring-purple-200',
                    teal: 'bg-teal-500 ring-teal-200',
                  };
                  return (
                    <button
                      type="button"
                      key={theme}
                      onClick={() => setCandTheme(theme)}
                      className={`h-6 w-6 rounded-full ${colors[theme]} transition-all relative cursor-pointer ${
                        candTheme === theme ? 'ring-4 scale-110' : 'hover:scale-105'
                      }`}
                      id={`theme-btn-${theme}`}
                    >
                      {candTheme === theme && (
                        <Check className="h-3.5 w-3.5 text-white absolute inset-0 m-auto" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {editingCandidateId ? (
              <div className="flex gap-2.5 pt-2.5">
                <button
                  type="submit"
                  disabled={isValidatingPhoto}
                  className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-100 disabled:text-slate-400 text-white font-bold text-xs rounded-xl shadow transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  id="submit-candidate-btn"
                >
                  {isValidatingPhoto ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin text-indigo-500" />
                      Validating Photo Link...
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4" />
                      Update Candidate
                    </>
                  )}
                </button>
                <button
                  type="button"
                  disabled={isValidatingPhoto}
                  onClick={() => handleDeleteTrigger(editingCandidateId)}
                  className="py-2.5 px-4 bg-rose-50 hover:bg-rose-100 disabled:bg-slate-50 disabled:text-slate-300 text-rose-700 font-bold text-xs rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </button>
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="submit"
                disabled={!candName.trim() || isValidatingPhoto}
                className="w-full py-2.5 bg-slate-800 hover:bg-slate-900 disabled:bg-slate-100 disabled:text-slate-400 text-white font-bold text-xs rounded-xl transition-colors flex items-center justify-center gap-1 cursor-pointer"
                id="submit-candidate-btn"
              >
                {isValidatingPhoto ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                    Validating Photo Link...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4" />
                    Save Candidate
                  </>
                )}
              </button>
            )}
          </form>
        </div>

        {/* School Admission Database Card */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 space-y-6" id="school-admissions-card">
          <div className="flex justify-between items-center border-b border-slate-50 pb-4">
            <div>
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <Users className="h-5 w-5 text-indigo-500" />
                School Admission Database
              </h3>
              <p className="text-xs text-slate-400 mt-1">Manage student credentials permitted to cast votes</p>
            </div>
            <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full uppercase tracking-wider animate-none">
              {admittedStudents.length} Admitted
            </span>
          </div>

          {/* Add Student Form */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const form = e.currentTarget;
              const idInput = form.elements.namedItem('studentId') as HTMLInputElement;
              const nameInput = form.elements.namedItem('studentName') as HTMLInputElement;
              const pinInput = form.elements.namedItem('studentPin') as HTMLInputElement;
              const studentIdVal = idInput.value.trim().toUpperCase();
              const studentNameVal = nameInput.value.trim();
              let studentPinVal = pinInput.value.trim();

              if (!studentIdVal || !studentNameVal) return;

              // Generate random 4-digit PIN if left blank
              if (!studentPinVal) {
                studentPinVal = Math.floor(1000 + Math.random() * 9000).toString();
              }

              // Check if duplicate ID
              if (admittedStudents.some(s => s.id === studentIdVal)) {
                alert(`Student ID "${studentIdVal}" is already registered in the admission database!`);
                return;
              }

              onAddAdmittedStudent({ id: studentIdVal, name: studentNameVal, pin: studentPinVal });
              playSystemSound('candidate_added_sound');
              form.reset();
            }}
            className="bg-slate-50 p-4 rounded-xl space-y-3"
            id="add-student-admission-form"
          >
            <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">Admit New Student</span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <input
                  type="text"
                  name="studentId"
                  required
                  placeholder="ID (e.g. S106)"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 text-xs uppercase font-mono"
                />
              </div>
              <div>
                <input
                  type="text"
                  name="studentName"
                  required
                  placeholder="Full Name"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 text-xs"
                />
              </div>
              <div>
                <input
                  type="text"
                  name="studentPin"
                  placeholder="PIN (blank for auto)"
                  maxLength={6}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 text-xs font-mono"
                />
              </div>
            </div>
            <button
              type="submit"
              className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg transition-colors flex items-center justify-center gap-1 cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              Register to Admission List
            </button>
          </form>

          {/* Admitted Students Scrollable List */}
          <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1" id="admitted-students-list">
            {admittedStudents.map((student) => {
              // Check if this student already voted
              const hasVoted = votes.some(v => v.studentId.trim().toUpperCase() === student.id.trim().toUpperCase());

              return (
                <div
                  key={student.id}
                  className="flex items-center justify-between p-3 bg-slate-50/50 rounded-xl border border-slate-100 hover:border-slate-200 transition-all text-xs"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-bold text-slate-700 bg-white px-2 py-0.5 border border-slate-200 rounded text-[11px]">
                        {student.id}
                      </span>
                      <span className="font-semibold text-slate-800">{student.name}</span>
                      <span className="font-mono text-[10px] text-indigo-700 bg-indigo-50 border border-indigo-100/50 px-1.5 py-0.5 rounded font-medium">
                        PIN: {student.pin || '1234'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {hasVoted ? (
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full">
                        ✓ Voted
                      </span>
                    ) : (
                      <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                        Pending
                      </span>
                    )}

                    <button
                      onClick={() => {
                        if (confirm(`Remove ${student.name} (${student.id}) from the school admissions database?`)) {
                          onDeleteAdmittedStudent(student.id);
                        }
                      }}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                      title="Remove admission"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}

            {admittedStudents.length === 0 && (
              <div className="text-center py-6 text-slate-400 text-xs">
                No students in the admissions database.
              </div>
            )}
          </div>
        </div>

      </div>

      {/* RIGHT COLUMN: Audio Settings, Sound Customizations, Sound Tester */}
      <div className="lg:col-span-5 space-y-8">

        {/* Administrative Passcode Management Card */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 space-y-4 animate-fadeIn" id="passcode-settings-card">
          <div className="border-b border-slate-50 pb-4">
            <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-indigo-500" />
              Administrative Security
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">View or modify the secret passcode required to access the Admin Portal.</p>
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block">Admin Passcode</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400">
                  <Lock className="h-4.5 w-4.5" />
                </span>
                <input
                  type={showPasscodeText ? 'text' : 'password'}
                  value={newPasscode}
                  onChange={(e) => {
                    setNewPasscode(e.target.value);
                    setPasscodeSuccess(false);
                  }}
                  className="w-full pl-10 pr-11 py-2.5 rounded-xl border border-slate-200 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm font-mono tracking-wide transition-all"
                  id="admin-new-passcode-input"
                  placeholder="Enter secret passcode"
                />
                <button
                  type="button"
                  onClick={() => setShowPasscodeText(!showPasscodeText)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                >
                  {showPasscodeText ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
                </button>
              </div>
            </div>

            {passcodeSuccess && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-emerald-800 text-xs font-semibold flex items-center gap-2"
                id="passcode-success-alert"
              >
                <Check className="h-4 w-4 text-emerald-600 shrink-0" />
                <span>Passcode successfully synchronized to cloud database!</span>
              </motion.div>
            )}

            <button
              onClick={async () => {
                if (!newPasscode.trim()) return;
                setIsSavingPasscode(true);
                try {
                  if (onUpdateAdminPassword) {
                    await onUpdateAdminPassword(newPasscode.trim());
                    playSystemSound('vote_success');
                    setPasscodeSuccess(true);
                    setTimeout(() => setPasscodeSuccess(false), 4000);
                  }
                } catch (err) {
                  console.error(err);
                  playSystemSound('warning_sound');
                } finally {
                  setIsSavingPasscode(false);
                }
              }}
              disabled={isSavingPasscode || !newPasscode.trim() || newPasscode === adminPassword}
              className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-100 disabled:text-slate-400 text-white font-bold text-xs rounded-xl shadow transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              id="save-passcode-btn"
            >
              {isSavingPasscode ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Synchronizing...</span>
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  <span>Save Passcode</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Global Volume & Switch Config */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 space-y-5" id="audio-settings-card">
          <div className="flex items-center justify-between border-b border-slate-50 pb-4">
            <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <Settings className="h-5 w-5 text-indigo-500" />
              Master Audio Settings
            </h3>

            {/* Global Enable / Disable Sound */}
            <button
              onClick={() => handleToggleGlobal(!localSettings.enabled)}
              className={`p-2 rounded-xl transition-all flex items-center gap-1.5 text-xs font-semibold cursor-pointer ${
                localSettings.enabled
                  ? 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
                  : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
              }`}
              id="audio-global-toggle"
            >
              {localSettings.enabled ? (
                <>
                  <Volume2 className="h-4 w-4" />
                  Sound On
                </>
              ) : (
                <>
                  <VolumeX className="h-4 w-4" />
                  Muted
                </>
              )}
            </button>
          </div>

          {/* Master Volume Slider */}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-xs text-slate-500">
              <span className="font-semibold">Master Gains Level</span>
              <span className="font-mono font-bold text-slate-700">{Math.round(localSettings.volume * 100)}%</span>
            </div>
            <div className="flex items-center gap-3">
              <VolumeX className="h-4 w-4 text-slate-400" />
              <input
                type="range"
                min="0"
                max="100"
                value={Math.round(localSettings.volume * 100)}
                onChange={(e) => handleVolumeChange(parseInt(e.target.value) / 100)}
                disabled={!localSettings.enabled}
                className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-600 disabled:opacity-40"
                id="master-volume-slider"
              />
              <Volume2 className="h-4 w-4 text-slate-400" />
            </div>
          </div>

          <div className="rounded-xl bg-indigo-50/50 p-3.5 border border-indigo-50 flex items-start gap-2.5">
            <Info className="h-4.5 w-4.5 text-indigo-500 shrink-0 mt-0.5" />
            <p className="text-[11px] text-indigo-800 leading-relaxed">
              No audio will autoplay prior to client actions. The system initializes the browser AudioContext safely when you trigger sounds. Adjusting the slider alters the Web Audio API Master Gain node instantly.
            </p>
          </div>
        </div>

        {/* Custom School Sound Customizer */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 space-y-4" id="custom-sounds-card">
          <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
            <UploadCloud className="h-5 w-5 text-indigo-500" />
            Upload Custom School Sounds
          </h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            Upload custom MP3 sounds to override the default synthesized chimes. Drag & drop file elements or tap to pick local audio files.
          </p>

          <div className="space-y-4 pt-2">
            {/* Display first 5 main sounds that support override */}
            {(['login_sound', 'select_sound', 'vote_success', 'warning_sound', 'winner_sound'] as SoundType[]).map((key) => {
              const label = SOUND_LABELS[key]?.label || key;
              const customName = getCustomSoundName(key);

              return (
                <div key={key} className="p-3.5 bg-slate-50 rounded-xl border border-slate-100 space-y-2 text-xs" id={`sound-customizer-${key}`}>
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-slate-700">{label}</span>
                    {customName ? (
                      <span className="bg-emerald-100 text-emerald-800 font-mono text-[9px] font-bold px-2 py-0.5 rounded-full uppercase" id={`custom-sound-badge-${key}`}>
                        Custom Active
                      </span>
                    ) : (
                      <span className="bg-slate-200 text-slate-500 font-mono text-[9px] px-2 py-0.5 rounded-full uppercase">
                        Default Synth
                      </span>
                    )}
                  </div>

                  {customName ? (
                    <div className="flex justify-between items-center bg-white p-2 border border-slate-200 rounded-lg">
                      <span className="text-[11px] text-slate-600 font-medium truncate max-w-[200px]" title={customName}>
                        📁 {customName}
                      </span>
                      <button
                        onClick={() => handleResetSound(key)}
                        className="text-[10px] text-rose-500 font-semibold hover:underline flex items-center gap-0.5 cursor-pointer"
                        id={`reset-sound-${key}`}
                      >
                        <RotateCcw className="h-3 w-3" />
                        Reset
                      </button>
                    </div>
                  ) : (
                    <div className="relative">
                      <label
                        className="flex flex-col items-center justify-center border border-dashed border-slate-300 rounded-lg p-2.5 bg-white cursor-pointer hover:bg-slate-100/50 transition-colors"
                        id={`upload-label-${key}`}
                      >
                        <span className="text-[10px] text-slate-500 font-medium">Select/Drop MP3/WAV</span>
                        <input
                           type="file"
                           accept="audio/*"
                           className="hidden"
                           onChange={(e) => {
                             const file = e.target.files?.[0];
                             if (file) handleFileUpload(key, file);
                           }}
                        />
                      </label>
                    </div>
                  )}

                  {/* Play preview */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => playSystemSound(key)}
                      className="flex-1 py-1 px-3.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold text-[10px] rounded-lg transition-colors flex items-center justify-center gap-1 cursor-pointer"
                      id={`test-play-${key}`}
                    >
                      <Play className="h-3 w-3 fill-current" />
                      Test Sound
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Live Audio Test Board */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 space-y-4" id="sound-tester-card">
          <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-indigo-500" />
            Sound Effects Sandbox
          </h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            Click any action button below to trigger and test the professional sound effects in real-time. Use this to audit tone volume and clarity.
          </p>

          <div className="grid grid-cols-1 gap-2.5 pt-2" id="sound-tester-grid">
            {(Object.keys(SOUND_LABELS) as SoundType[]).map((key) => {
              const item = SOUND_LABELS[key];
              const isToggled = localSettings.soundToggles[key];

              return (
                <div
                  key={key}
                  className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                    isToggled
                      ? 'bg-white border-slate-100 hover:border-slate-200'
                      : 'bg-slate-50/50 border-slate-100 opacity-60'
                  }`}
                  id={`tester-row-${key}`}
                >
                  <div className="space-y-0.5 max-w-[70%]">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={isToggled}
                        disabled={!localSettings.enabled}
                        onChange={(e) => handleToggleSound(key, e.target.checked)}
                        className="rounded text-indigo-600 focus:ring-indigo-500 h-3 w-3 border-slate-300 accent-indigo-600 cursor-pointer disabled:opacity-50"
                        id={`toggle-sound-${key}`}
                      />
                      <span className="text-[11px] font-bold text-slate-700 leading-none">{item.label}</span>
                    </div>
                    <p className="text-[10px] text-slate-400 leading-relaxed">{item.desc}</p>
                  </div>

                  <button
                    onClick={() => playSystemSound(key)}
                    disabled={!localSettings.enabled || !isToggled}
                    className="p-2 bg-indigo-50 hover:bg-indigo-100 disabled:bg-slate-100 disabled:text-slate-400 text-indigo-600 rounded-lg transition-colors flex items-center justify-center shrink-0 cursor-pointer"
                    id={`trigger-test-${key}`}
                    title="Play Tone"
                  >
                    <Play className="h-3.5 w-3.5 fill-current" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}
