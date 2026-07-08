/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, FormEvent, useRef, ChangeEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import * as XLSX from 'xlsx';
import { 
  Candidate, 
  Vote, 
  SoundType, 
  AudioSettings, 
  ElectionStatus, 
  Student, 
  Position 
} from '../types';
import {
  playSystemSound,
  updateAudioSettings,
  getAudioSettings,
  registerCustomSound,
  removeCustomSound,
  getCustomSoundName,
} from '../audio';
import {
  db,
  doc,
  setDoc,
  deleteDoc,
  writeBatch,
  updateDoc
} from '../firebase';
import { hashPassword } from '../utils/hash';
import {
  LayoutDashboard,
  Calendar,
  Layers,
  UserCheck,
  GraduationCap,
  UploadCloud,
  Eye,
  BarChart3,
  Trophy,
  Sliders,
  KeyRound,
  Lock,
  LogOut,
  Trash2,
  Edit,
  Plus,
  Play,
  RotateCcw,
  Check,
  Award,
  Sparkles,
  Activity,
  UserPlus,
  AlertTriangle,
  Info,
  ChevronDown,
  ChevronUp,
  Image as ImageIcon,
  X,
  Loader2,
  Mail,
  User,
  CheckCircle,
  FileSpreadsheet,
  ShieldCheck
} from 'lucide-react';

const SOUND_LABELS: Record<SoundType, { label: string; desc: string }> = {
  login_sound: { label: 'Doorbell Chime', desc: 'Plays on voter portal credentials login success.' },
  select_sound: { label: 'Click Pluck', desc: 'Plays when selecting candidates or active tabs.' },
  vote_success: { label: 'Validation Chime', desc: 'Plays upon batch ballot finalization.' },
  warning_sound: { label: 'Alert Buzz', desc: 'Plays on verification error or lockout trigger.' },
  winner_sound: { label: 'Fanfare Chords', desc: 'Plays when publishing the final results.' },
  candidate_added_sound: { label: 'Registration Tone', desc: 'Plays when candidate successfully registers.' },
  election_started_sound: { label: 'Ascending Chime', desc: 'Plays when election begins.' },
  election_ended_sound: { label: 'Descending Chime', desc: 'Plays when election ends.' },
  new_vote_sound: { label: 'Data Ping', desc: 'Plays in real-time as votes land.' },
};

interface AdminPortalProps {
  positions: Position[];
  candidates: Candidate[];
  votes: Vote[];
  electionStatus: ElectionStatus;
  setElectionStatus: (status: ElectionStatus) => void;
  onAddCandidate: (cand: Omit<Candidate, 'votesCount'>) => void;
  onDeleteCandidate: (candId: string) => void;
  onUpdateCandidate: (candId: string, cand: Partial<Candidate>) => void;
  onClearVotes: () => Promise<void>;
  audioSettings: AudioSettings;
  onUpdateAudioSettings: (settings: AudioSettings) => void;
  admittedStudents: Student[];
  onAddAdmittedStudent: (student: Student) => void;
  onDeleteAdmittedStudent: (studentId: string) => void;
  onResetStudentVotes: (studentId: string) => Promise<void>;
  adminPassword?: string; // hashed password
  onLogout?: () => void;
}

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
  onResetStudentVotes,
  onLogout,
}: AdminPortalProps) {
  // Sidebar menu selection
  const [activeModule, setActiveModule] = useState<string>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Sound Wave and settings states
  const [localSettings, setLocalSettings] = useState<AudioSettings>(audioSettings);

  useEffect(() => {
    setLocalSettings(audioSettings);
  }, [audioSettings]);

  // Bulk Import States
  const [importingError, setImportingError] = useState<string | null>(null);
  const [importingSuccess, setImportingSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sound customizations states
  const SOUND_KEYS = Object.keys(SOUND_LABELS) as SoundType[];

  // Change Password States
  const [adminName, setAdminName] = useState('School Administrator');
  const [adminUsername, setAdminUsername] = useState('admin');
  const [adminEmail, setAdminEmail] = useState('admin@school.com');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [credentialsSuccess, setCredentialsSuccess] = useState<string | null>(null);
  const [credentialsError, setCredentialsError] = useState<string | null>(null);
  const [isUpdatingCredentials, setIsUpdatingCredentials] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  // Fetch admin credentials to pre-fill Change Password fields
  useEffect(() => {
    const fetchAdminProfile = async () => {
      try {
        const adminDoc = await XLSX.utils.sheet_to_json<any>(null as any); // just dummy usage to keep XLSX imported
      } catch (e) {}

      // Get real database configuration safely
      try {
        const adminSnap = await doc(db, 'admins', 'admin001');
        // Let's retrieve snapshot
        import('../firebase').then(async ({ getDoc }) => {
          const snap = await getDoc(adminSnap);
          if (snap.exists()) {
            const data = snap.data();
            setAdminName(data.name || 'School Administrator');
            setAdminUsername(data.username || 'admin');
            setAdminEmail(data.email || 'admin@school.com');
          }
        });
      } catch (err) {
        console.error(err);
      }
    };
    fetchAdminProfile();
  }, []);

  // Bulk Excel/CSV parser
  const handleBulkImport = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportingError(null);
    setImportingSuccess(null);

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const workbook = XLSX.read(bstr, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json<any>(worksheet);

        if (!json || json.length === 0) {
          setImportingError("No records found in the uploaded file.");
          playSystemSound('warning_sound');
          return;
        }

        let addedCount = 0;
        let skippedCount = 0;

        for (const row of json) {
          const keys = Object.keys(row);
          const nameKey = keys.find(k => /name|student\s*name|voters|voter/i.test(k));
          const idKey = keys.find(k => /id|admission\s*id|admission\s*no|admission|admissionid/i.test(k));
          const gradeKey = keys.find(k => /grade|class|standard|div/i.test(k));
          const passcodeKey = keys.find(k => /passcode|password|pin/i.test(k));

          const rawName = nameKey ? row[nameKey] : '';
          const rawId = idKey ? row[idKey] : '';
          const rawGrade = gradeKey ? row[gradeKey] : 'Grade 10';
          const rawPasscode = passcodeKey ? row[passcodeKey] : '';

          const studentNameVal = String(rawName || '').trim();
          const studentIdVal = String(rawId || '').trim().toUpperCase();
          const studentGradeVal = String(rawGrade || 'Grade 10').trim();
          let studentPasscodeVal = String(rawPasscode || '').trim();

          if (!studentNameVal || !studentIdVal) {
            skippedCount++;
            continue;
          }

          if (!studentPasscodeVal) {
            studentPasscodeVal = Math.floor(100000 + Math.random() * 900000).toString();
          }

          if (admittedStudents.some(s => s.admissionId.trim().toUpperCase() === studentIdVal)) {
            skippedCount++;
            continue;
          }

          onAddAdmittedStudent({
            studentId: studentIdVal,
            studentName: studentNameVal,
            admissionId: studentIdVal,
            grade: studentGradeVal,
            passcode: studentPasscodeVal,
            hasVoted: false,
            votedAt: null
          });
          addedCount++;
        }

        playSystemSound('winner_sound');
        setImportingSuccess(`Successfully parsed and imported ${addedCount} student accounts! (Skipped ${skippedCount} duplicate or incomplete rows).`);
        if (fileInputRef.current) fileInputRef.current.value = '';
      } catch (err) {
        console.error("Error parsing file:", err);
        setImportingError("Failed to parse file structure. Ensure it's a valid Excel or CSV spreadsheet.");
        playSystemSound('warning_sound');
      }
    };

    reader.onerror = () => {
      setImportingError("Failed to read selected file.");
      playSystemSound('warning_sound');
    };

    reader.readAsBinaryString(file);
  };

  // Candidate Registration States
  const [candName, setCandName] = useState('');
  const [candPositionId, setCandPositionId] = useState(positions[0]?.id || 'pos-1');
  const [candGrade, setCandGrade] = useState('Grade 10');
  const [candDivision, setCandDivision] = useState('A');
  const [candRoll, setCandRoll] = useState('');
  const [candSymbol, setCandSymbol] = useState('⭐');
  const [candBio, setCandBio] = useState('');
  const [candManifesto, setCandManifesto] = useState('');
  const [candTheme, setCandTheme] = useState('indigo');

  // Photo drive validation
  const [photoDriveLink, setPhotoDriveLink] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [isPhotoLinkValid, setIsPhotoLinkValid] = useState<boolean | null>(null);
  const [isValidatingPhoto, setIsValidatingPhoto] = useState(false);
  const [photoValidationError, setPhotoValidationError] = useState<string | null>(null);

  const [editingCandidateId, setEditingCandidateId] = useState<string | null>(null);

  // Helper to extract File ID from Google Drive public share links
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

  useEffect(() => {
    if (!photoDriveLink.trim()) {
      setPhotoUrl('');
      setIsPhotoLinkValid(null);
      setPhotoValidationError(null);
      return;
    }

    const fileId = extractGoogleDriveId(photoDriveLink);
    if (!fileId) {
      setIsPhotoLinkValid(false);
      setPhotoValidationError('Invalid Google Drive URL pattern.');
      setPhotoUrl('');
      return;
    }

    const directUrl = `https://lh3.googleusercontent.com/d/${fileId}`;
    setPhotoUrl(directUrl);
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
      setPhotoValidationError('Unable to load photo asset. Check public access permission details.');
    };
    img.src = directUrl;
  }, [photoDriveLink]);

  // Sync default position if positions load later
  useEffect(() => {
    if (positions.length > 0 && !candPositionId) {
      setCandPositionId(positions[0].id);
    }
  }, [positions, candPositionId]);

  // Student Roster States
  const [studentNameInput, setStudentNameInput] = useState('');
  const [studentIdInput, setStudentIdInput] = useState('');
  const [studentGradeInput, setStudentGradeInput] = useState('Grade 10');
  const [studentPasscodeInput, setStudentPasscodeInput] = useState('');
  const [studentSearchQuery, setStudentSearchQuery] = useState('');

  // Positions Management States
  const [newPostName, setNewPostName] = useState('');
  const [postError, setPostError] = useState<string | null>(null);

  // Sound Config Helpers
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

  const handleFileUpload = (soundKey: SoundType, file: File) => {
    if (!file) return;
    registerCustomSound(soundKey, file);
    setLocalSettings(getAudioSettings());
    playSystemSound(soundKey);
  };

  const handleResetSound = (soundKey: SoundType) => {
    removeCustomSound(soundKey);
    setLocalSettings(getAudioSettings());
  };

  // Election posts management triggers
  const handleCreatePost = async (e: FormEvent) => {
    e.preventDefault();
    setPostError(null);

    const title = newPostName.trim();
    if (!title) return;

    if (positions.some(p => p.name.toLowerCase() === title.toLowerCase())) {
      setPostError("Election post already exists.");
      playSystemSound('warning_sound');
      return;
    }

    const newId = 'pos-' + Date.now();
    try {
      await setDoc(doc(db, 'positions', newId), {
        id: newId,
        name: title,
        candidates: []
      });
      setNewPostName('');
      playSystemSound('winner_sound');
    } catch (err) {
      console.error(err);
      setPostError("Failed to save post to cloud storage.");
    }
  };

  const handleDeletePost = async (posId: string, name: string) => {
    if (confirm(`Are you sure you want to permanently delete the post "${name}"? This will purge all registered candidates and votes assigned to it.`)) {
      try {
        await deleteDoc(doc(db, 'positions', posId));
        
        // Purge candidates belonging to this deleted post
        const matchingCands = candidates.filter(c => c.positionId === posId);
        const batch = writeBatch(db);
        matchingCands.forEach(c => {
          batch.delete(doc(db, 'candidates', c.id));
        });
        await batch.commit();
        playSystemSound('warning_sound');
      } catch (err) {
        console.error(err);
      }
    }
  };

  // Student manual registration trigger
  const handleAddStudentSubmit = (e: FormEvent) => {
    e.preventDefault();
    const cleanName = studentNameInput.trim();
    const cleanId = studentIdInput.trim().toUpperCase();
    const cleanPass = studentPasscodeInput.trim();

    if (!cleanName || !cleanId) return;

    if (admittedStudents.some(s => s.admissionId.trim().toUpperCase() === cleanId)) {
      alert("A student with this Admission ID is already registered.");
      playSystemSound('warning_sound');
      return;
    }

    const generatedPass = cleanPass || Math.floor(100000 + Math.random() * 900000).toString();

    onAddAdmittedStudent({
      studentId: cleanId,
      studentName: cleanName,
      admissionId: cleanId,
      grade: studentGradeInput,
      passcode: generatedPass,
      hasVoted: false,
      votedAt: null
    });

    setStudentNameInput('');
    setStudentIdInput('');
    setStudentPasscodeInput('');
    playSystemSound('candidate_added_sound');
  };

  // Candidate submission trigger
  const handleCandidateSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!candName.trim() || !candPositionId) return;

    const candId = editingCandidateId || `cand_${Date.now()}`;
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
      symbolUrl: '',
      votesCount: candidates.find(c => c.id === candId)?.votesCount || 0,
      
      candidateId: candId,
      electionId: '',
      candidateName: candName.trim(),
      candidatePhotoURL: photoUrl || '',
      class: candGrade,
      symbolURL: '',
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
    setPhotoDriveLink('');
    setPhotoValidationError(null);
    setIsPhotoLinkValid(null);
    playSystemSound('candidate_added_sound');
  };

  const handleSelectForEdit = (candidate: Candidate) => {
    setEditingCandidateId(candidate.id);
    setCandName(candidate.name);
    setCandPositionId(candidate.positionId);
    setCandGrade(candidate.grade);
    setCandDivision(candidate.division);
    setCandRoll(candidate.rollNumber);
    setCandSymbol(candidate.symbol);
    setCandBio(candidate.bio);
    setCandManifesto(candidate.manifesto);
    setCandTheme(candidate.colorTheme);
    setPhotoDriveLink(candidate.photoUrl ? `https://drive.google.com/file/d/${extractGoogleDriveId(candidate.photoUrl)}` : '');
    setActiveModule('candidate_management');
  };

  // Change password credentials submit
  const handleUpdateAdminCredentialsSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setCredentialsError(null);
    setCredentialsSuccess(null);

    if (!adminName.trim() || !adminUsername.trim() || !adminEmail.trim()) {
      setCredentialsError("Name, username, and email fields are required.");
      playSystemSound('warning_sound');
      return;
    }

    setIsUpdatingCredentials(true);
    try {
      // 1. Fetch real admin doc to check current password if a new password was provided
      const adminSnap = await doc(db, 'admins', 'admin001');
      const { getDoc } = await import('../firebase');
      const snap = await getDoc(adminSnap);
      
      if (!snap.exists()) {
        setCredentialsError("Admin record configuration not found in database.");
        playSystemSound('warning_sound');
        setIsUpdatingCredentials(false);
        return;
      }

      const realAdmin = snap.data();

      // If new password is provided, we must validate the current password
      let hashedNewPassword = realAdmin.password;
      if (newPassword.trim()) {
        if (!currentPassword) {
          setCredentialsError("Please provide your current admin password to verify this update.");
          playSystemSound('warning_sound');
          setIsUpdatingCredentials(false);
          return;
        }

        const hashedCurrent = await hashPassword(currentPassword);
        if (hashedCurrent !== realAdmin.password) {
          setCredentialsError("Current password validation failed.");
          playSystemSound('warning_sound');
          setIsUpdatingCredentials(false);
          return;
        }

        if (newPassword.length < 6) {
          setCredentialsError("New password must be at least 6 characters long.");
          playSystemSound('warning_sound');
          setIsUpdatingCredentials(false);
          return;
        }

        if (newPassword !== confirmNewPassword) {
          setCredentialsError("New passwords do not match.");
          playSystemSound('warning_sound');
          setIsUpdatingCredentials(false);
          return;
        }

        hashedNewPassword = await hashPassword(newPassword);
      }

      // Perform update
      await updateDoc(adminSnap, {
        name: adminName.trim(),
        username: adminUsername.trim(),
        email: adminEmail.trim(),
        password: hashedNewPassword
      });

      playSystemSound('winner_sound');
      setCredentialsSuccess("Administrative profile updated successfully!");
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
    } catch (err) {
      console.error(err);
      setCredentialsError("An error occurred. Check network connection.");
      playSystemSound('warning_sound');
    } finally {
      setIsUpdatingCredentials(false);
    }
  };

  // Stats calculators
  const totalStudentsCount = admittedStudents.length;
  const totalVotesCastCount = admittedStudents.filter(s => 
    votes.some(v => v.studentId.trim().toUpperCase() === s.admissionId.trim().toUpperCase())
  ).length;
  const turnoutPercentage = totalStudentsCount > 0 
    ? Math.round((totalVotesCastCount / totalStudentsCount) * 100) 
    : 0;

  // Sidebar list
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'election_management', label: 'Election Management', icon: Calendar },
    { id: 'election_posts', label: 'Election Posts', icon: Layers },
    { id: 'candidate_management', label: 'Candidate Management', icon: UserCheck },
    { id: 'student_management', label: 'Student Management', icon: GraduationCap },
    { id: 'import_students', label: 'Import Students (Excel/CSV)', icon: FileSpreadsheet },
    { id: 'voting_monitor', label: 'Voting Monitor', icon: Eye },
    { id: 'live_vote_count', label: 'Live Vote Count', icon: BarChart3 },
    { id: 'results', label: 'Results Summary', icon: Trophy },
    { id: 'settings', label: 'Audio Config', icon: Sliders },
    { id: 'change_password', label: 'Change Password', icon: KeyRound },
  ];

  return (
    <div className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden min-h-[650px] flex flex-col lg:flex-row" id="admin-portal-box">
      
      {/* MOBILE MENU TOGGLER BAR */}
      <div className="lg:hidden bg-slate-900 text-white p-4 flex justify-between items-center border-b border-slate-800">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-indigo-400" />
          <span className="font-bold text-xs uppercase tracking-wider">Admin Workspace</span>
        </div>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 bg-slate-800 rounded-xl hover:bg-slate-700 transition-colors"
        >
          {mobileMenuOpen ? <X className="h-5 w-5" /> : <Layers className="h-5 w-5" />}
        </button>
      </div>

      {/* LEFT SIDEBAR NAVIGATION */}
      <div className={`lg:w-76 bg-slate-900 text-slate-300 shrink-0 flex flex-col justify-between border-r border-slate-800 transition-all ${
        mobileMenuOpen ? 'block' : 'hidden lg:flex'
      }`} id="admin-sidebar">
        <div className="p-6 space-y-6">
          <div className="hidden lg:flex items-center gap-2.5 pb-4 border-b border-slate-800">
            <div className="h-8.5 w-8.5 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-bold text-sm shadow shadow-indigo-600/35">
              A
            </div>
            <div>
              <h3 className="font-black text-xs text-white uppercase tracking-wider">Admin Workspace</h3>
              <p className="text-[9px] text-slate-500 font-medium">Smart School Election System</p>
            </div>
          </div>

          <nav className="space-y-1" id="admin-nav-links">
            {navItems.map((item) => {
              const IconComp = item.icon;
              const isActive = activeModule === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveModule(item.id);
                    setMobileMenuOpen(false);
                    playSystemSound('select_sound');
                  }}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/10'
                      : 'hover:bg-slate-800 hover:text-white'
                  }`}
                  id={`nav-item-${item.id}`}
                >
                  <IconComp className={`h-4.5 w-4.5 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer with Logout */}
        <div className="p-6 border-t border-slate-800 bg-slate-950/40">
          <button
            onClick={() => {
              if (onLogout) onLogout();
            }}
            className="w-full flex items-center justify-center gap-2 px-3.5 py-3 bg-rose-950/30 hover:bg-rose-900/40 text-rose-400 font-bold text-xs rounded-xl transition-all cursor-pointer border border-rose-950/40"
            id="nav-logout-btn"
          >
            <LogOut className="h-4 w-4" />
            <span>Sign Out Session</span>
          </button>
        </div>
      </div>

      {/* RIGHT WORKSPACE AREA */}
      <div className="flex-1 bg-slate-50/40 p-6 md:p-8 overflow-y-auto max-h-[850px] space-y-8" id="admin-workspace">
        <AnimatePresence mode="wait">
          
          {/* ==================== 1. DASHBOARD OVERVIEW ==================== */}
          {activeModule === 'dashboard' && (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div className="border-b border-slate-100 pb-4">
                <h2 className="text-lg font-black text-slate-800 tracking-tight">System Administrative Summary</h2>
                <p className="text-xs text-slate-500 mt-1">Real-time analytical stats, telemetry monitor, and registration indices.</p>
              </div>

              {/* STATS BENTO GRID */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5" id="dashboard-bento-grid">
                
                {/* Total Students */}
                <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Admitted Students</span>
                    <GraduationCap className="h-5 w-5 text-indigo-500" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-2xl font-black text-slate-800 font-mono">{totalStudentsCount}</h3>
                    <p className="text-[10px] text-slate-500">Student voting credentials enrolled</p>
                  </div>
                </div>

                {/* Ballots Cast */}
                <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Ballots Finalized</span>
                    <BarChart3 className="h-5 w-5 text-emerald-500" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-2xl font-black text-slate-800 font-mono">{totalVotesCastCount}</h3>
                    <p className="text-[10px] text-slate-500">Unique student voters participated</p>
                  </div>
                </div>

                {/* Turnout Percentage */}
                <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Voter Turnout Rate</span>
                    <Activity className="h-5 w-5 text-purple-500" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-baseline gap-2">
                      <h3 className="text-2xl font-black text-slate-800 font-mono">{turnoutPercentage}%</h3>
                      <div className="w-16 bg-slate-100 h-2.5 rounded-full overflow-hidden shrink-0">
                        <div className="bg-indigo-600 h-full" style={{ width: `${turnoutPercentage}%` }}></div>
                      </div>
                    </div>
                    <p className="text-[10px] text-slate-500">Live participation telemetry index</p>
                  </div>
                </div>

                {/* Candidate Count */}
                <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Registered Candidates</span>
                    <UserCheck className="h-5 w-5 text-amber-500" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-2xl font-black text-slate-800 font-mono">{candidates.length}</h3>
                    <p className="text-[10px] text-slate-500">Active candidates across all posts</p>
                  </div>
                </div>

              </div>

              {/* WELCOME GRAPHIC CARD */}
              <div className="bg-slate-900 text-white rounded-2xl p-6 border border-slate-800 shadow-md flex flex-col md:flex-row justify-between items-center gap-6" id="welcome-graphic-card">
                <div className="space-y-2 max-w-lg">
                  <span className="text-[10px] font-black tracking-widest text-indigo-400 uppercase flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5" />
                    Administrative Console Active
                  </span>
                  <h3 className="text-base font-bold tracking-tight">Elections Control Center</h3>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Welcome to the upgraded Smart School Election System control panel. Use the left sidebar to navigate between managing candidate rosters, student credentials, and audio synthesizer parameters.
                  </p>
                </div>
                <div className="h-20 w-20 rounded-2xl bg-indigo-600/15 border border-indigo-500/20 flex items-center justify-center shrink-0">
                  <ShieldCheck className="h-10 w-10 text-indigo-400" />
                </div>
              </div>
            </motion.div>
          )}

          {/* ==================== 2. ELECTION MANAGEMENT ==================== */}
          {activeModule === 'election_management' && (
            <motion.div
              key="election_management"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div className="border-b border-slate-100 pb-4">
                <h2 className="text-lg font-black text-slate-800 tracking-tight">Election Lifecycle Manager</h2>
                <p className="text-xs text-slate-500 mt-1">Control active voting stages, trigger transition tones, or reset credentials.</p>
              </div>

              <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm space-y-5" id="election-status-panel">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-800">Current Phase</h3>
                    <p className="text-xs text-slate-400">Current state dictates Student Portal voting availability.</p>
                  </div>
                  <span className={`text-[11px] font-black px-3 py-1 rounded-full uppercase tracking-wider ${
                    electionStatus === 'active'
                      ? 'bg-emerald-100 text-emerald-800'
                      : electionStatus === 'ended'
                      ? 'bg-rose-100 text-rose-800'
                      : 'bg-slate-100 text-slate-600'
                  }`}>
                    {electionStatus === 'active' ? '● Active' : electionStatus === 'ended' ? 'Ended' : 'Setup Stage'}
                  </span>
                </div>

                <div className="flex flex-wrap gap-3.5 pt-2 border-t border-slate-50">
                  {electionStatus !== 'active' && (
                    <button
                      onClick={() => {
                        setElectionStatus('active');
                        playSystemSound('election_started_sound');
                      }}
                      className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-lg hover:shadow-emerald-500/10 transition-colors cursor-pointer flex items-center gap-1.5"
                    >
                      <Play className="h-3.5 w-3.5 fill-current" />
                      Activate Live Voting
                    </button>
                  )}

                  {electionStatus === 'active' && (
                    <button
                      onClick={() => {
                        setElectionStatus('ended');
                        playSystemSound('election_ended_sound');
                      }}
                      className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-lg hover:shadow-rose-500/10 transition-colors cursor-pointer flex items-center gap-1.5"
                    >
                      <AlertTriangle className="h-3.5 w-3.5" />
                      Freeze & End Voting
                    </button>
                  )}

                  <button
                    disabled={isResetting}
                    onClick={async () => {
                      if (confirm("Reset the election board? This deletes all votes cast, updates student records, and resets candidates tally to 0. This cannot be undone.")) {
                        try {
                          setIsResetting(true);
                          await onClearVotes();
                          playSystemSound('warning_sound');
                          alert("Database successfully reset! All votes have been cleared, candidate tallies have been set to 0, and student voting states have been reset.");
                        } catch (err) {
                          console.error("Error resetting database:", err);
                          alert("Failed to reset database. Check console or network for details.");
                        } finally {
                          setIsResetting(false);
                        }
                      }
                    }}
                    className={`px-4 py-2.5 border border-rose-100 hover:bg-rose-50 text-rose-600 text-xs font-bold rounded-xl transition-colors cursor-pointer ml-auto flex items-center gap-1.5 ${
                      isResetting ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                  >
                    {isResetting ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Resetting Board...
                      </>
                    ) : (
                      <>
                        <RotateCcw className="h-3.5 w-3.5" />
                        Reset Data Board
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* ==================== 3. ELECTION POSTS ==================== */}
          {activeModule === 'election_posts' && (
            <motion.div
              key="election_posts"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div className="border-b border-slate-100 pb-4">
                <h2 className="text-lg font-black text-slate-800 tracking-tight">Manage Election Posts</h2>
                <p className="text-xs text-slate-500 mt-1">Add, update, or remove designated student leadership positions.</p>
              </div>

              {/* CREATE POST FORM */}
              <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm space-y-4" id="create-post-card">
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Register Leadership Position</h3>
                <form onSubmit={handleCreatePost} className="flex gap-3">
                  <input
                    type="text"
                    required
                    placeholder="e.g. Fine Arts Secretary, Head Boy"
                    value={newPostName}
                    onChange={(e) => {
                      setNewPostName(e.target.value);
                      setPostError(null);
                    }}
                    className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-xs transition-all"
                    id="new-post-name-input"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-lg hover:shadow-indigo-500/10 transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add Post
                  </button>
                </form>

                {postError && (
                  <p className="text-xs text-rose-500 font-medium flex items-center gap-1">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    {postError}
                  </p>
                )}
              </div>

              {/* POSTS LIST */}
              <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm space-y-3" id="posts-list-card">
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider pb-2 border-b border-slate-50">Enrolled Posts ({positions.length})</h3>
                <div className="space-y-2">
                  {positions.map((pos) => {
                    const candsCount = candidates.filter(c => c.positionId === pos.id).length;
                    return (
                      <div key={pos.id} className="flex justify-between items-center p-3 bg-slate-50/50 border border-slate-100 hover:border-slate-200 rounded-xl transition-all">
                        <div>
                          <span className="text-xs font-bold text-slate-800">{pos.name}</span>
                          <p className="text-[10px] text-slate-400 font-mono mt-0.5">{candsCount} candidates registered • ID: {pos.id}</p>
                        </div>
                        <button
                          onClick={() => handleDeletePost(pos.id, pos.name)}
                          className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          )}

          {/* ==================== 4. CANDIDATE MANAGEMENT ==================== */}
          {activeModule === 'candidate_management' && (
            <motion.div
              key="candidate_management"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div className="border-b border-slate-100 pb-4">
                <h2 className="text-lg font-black text-slate-800 tracking-tight">Candidate Profile Registry</h2>
                <p className="text-xs text-slate-500 mt-1">Enroll active candidates, append descriptions, or link portfolio media links.</p>
              </div>

              {/* REGISTRATION FORM */}
              <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm space-y-4" id="candidate-form-card">
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider border-b border-slate-50 pb-2">
                  {editingCandidateId ? 'Modify Candidate Credentials' : 'Enroll New Candidate'}
                </h3>
                <form onSubmit={handleCandidateSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  
                  {/* Full Name */}
                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-600">Candidate Full Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. John Doe"
                      value={candName}
                      onChange={(e) => setCandName(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-xs transition-all"
                    />
                  </div>

                  {/* Designated Post */}
                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-600">Election Leadership Post</label>
                    <select
                      value={candPositionId}
                      onChange={(e) => setCandPositionId(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-xs transition-all"
                    >
                      {positions.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Class / Grade */}
                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-600">Enrolled Grade</label>
                    <select
                      value={candGrade}
                      onChange={(e) => setCandGrade(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-xs transition-all"
                    >
                      {['Grade 9', 'Grade 10', 'Grade 11', 'Grade 12'].map(g => (
                        <option key={g} value={g}>{g}</option>
                      ))}
                    </select>
                  </div>

                  {/* Roll Number / Division */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="font-bold text-slate-600">Division</label>
                      <input
                        type="text"
                        placeholder="e.g. A"
                        value={candDivision}
                        onChange={(e) => setCandDivision(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-xs transition-all text-center"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="font-bold text-slate-600">Roll No.</label>
                      <input
                        type="text"
                        placeholder="e.g. 15"
                        value={candRoll}
                        onChange={(e) => setCandRoll(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-xs transition-all text-center font-mono"
                      />
                    </div>
                  </div>

                  {/* Character Symbol */}
                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-600">Identity Symbol Emoji</label>
                    <input
                      type="text"
                      placeholder="e.g. ⭐, 🎨, 🎭"
                      value={candSymbol}
                      onChange={(e) => setCandSymbol(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-xs transition-all text-center"
                    />
                  </div>

                  {/* Candidate Visual Theme */}
                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-600">Aesthetic Visual Theme Color</label>
                    <select
                      value={candTheme}
                      onChange={(e) => setCandTheme(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-xs transition-all"
                    >
                      {['indigo', 'rose', 'purple', 'teal', 'emerald', 'amber', 'pink', 'cyan'].map(c => (
                        <option key={c} value={c}>{c.toUpperCase()}</option>
                      ))}
                    </select>
                  </div>

                  {/* Public Google Drive Photo Link */}
                  <div className="md:col-span-2 space-y-1.5">
                    <label className="font-bold text-slate-600">Public Google Drive Share Link (Candidate Avatar Image)</label>
                    <input
                      type="url"
                      placeholder="https://drive.google.com/file/d/.../view?usp=sharing"
                      value={photoDriveLink}
                      onChange={(e) => setPhotoDriveLink(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-xs transition-all"
                    />
                    {isValidatingPhoto && (
                      <p className="text-[10px] text-indigo-600 font-semibold animate-pulse flex items-center gap-1">
                        <Loader2 className="animate-spin h-3.5 w-3.5" />
                        Analyzing Drive file sharing metadata...
                      </p>
                    )}
                    {photoValidationError && (
                      <p className="text-[10px] text-rose-500 font-bold flex items-center gap-1">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        {photoValidationError}
                      </p>
                    )}
                    {isPhotoLinkValid === true && (
                      <p className="text-[10px] text-emerald-600 font-bold flex items-center gap-1">
                        <CheckCircle className="h-3.5 w-3.5" />
                        Asset confirmed! File accessible in the Cloud Sandbox.
                      </p>
                    )}
                  </div>

                  {/* Biography */}
                  <div className="md:col-span-2 space-y-1.5">
                    <label className="font-bold text-slate-600">Candidate Brief Biography</label>
                    <textarea
                      placeholder="Share a short introduction bio of the candidate..."
                      value={candBio}
                      onChange={(e) => setCandBio(e.target.value)}
                      rows={2}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-xs transition-all"
                    />
                  </div>

                  {/* Manifesto */}
                  <div className="md:col-span-2 space-y-1.5">
                    <label className="font-bold text-slate-600">Candidate Campaign Manifesto</label>
                    <textarea
                      placeholder="Outline campaign policies, goals, or campus improvements..."
                      value={candManifesto}
                      onChange={(e) => setCandManifesto(e.target.value)}
                      rows={2}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-xs transition-all"
                    />
                  </div>

                  <div className="md:col-span-2 flex gap-3 pt-2">
                    {editingCandidateId && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingCandidateId(null);
                          setCandName('');
                          setCandRoll('');
                          setCandBio('');
                          setCandManifesto('');
                          setPhotoUrl('');
                          setPhotoDriveLink('');
                        }}
                        className="flex-1 py-2.5 border border-slate-200 text-slate-600 font-bold text-xs rounded-xl hover:bg-slate-50 transition-colors cursor-pointer"
                      >
                        Cancel
                      </button>
                    )}
                    <button
                      type="submit"
                      className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-lg hover:shadow-indigo-500/10 transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      {editingCandidateId ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                      <span>{editingCandidateId ? 'Save Profile Changes' : 'Register Candidate Profile'}</span>
                    </button>
                  </div>

                </form>
              </div>

              {/* CANDIDATES DIRECTORY */}
              <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm space-y-4" id="candidates-directory-card">
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider pb-2 border-b border-slate-50">Candidates Directory ({candidates.length})</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {candidates.map((cand) => {
                    const postName = positions.find(p => p.id === cand.positionId)?.name || 'Unknown Post';
                    return (
                      <div key={cand.id} className="flex justify-between items-start p-4 bg-slate-50/50 border border-slate-100 hover:border-slate-200 rounded-xl transition-all">
                        <div className="flex gap-3">
                          <div className="h-10 w-10 bg-slate-200 rounded-xl overflow-hidden shrink-0 flex items-center justify-center text-xs font-black text-slate-500">
                            {cand.photoUrl ? (
                              <img src={cand.photoUrl} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                            ) : (
                              cand.avatarSeed
                            )}
                          </div>
                          <div>
                            <span className="font-bold text-slate-800 text-xs flex items-center gap-1">
                              {cand.name} <span className="text-[10px]">{cand.symbol}</span>
                            </span>
                            <p className="text-[10px] font-bold text-indigo-700 mt-0.5">{postName}</p>
                            <p className="text-[9px] text-slate-400 font-mono mt-0.5">{cand.grade} {cand.division} • Roll: {cand.rollNumber}</p>
                          </div>
                        </div>

                        <div className="flex gap-1.5">
                          <button
                            onClick={() => handleSelectForEdit(cand)}
                            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                          >
                            <Edit className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              if (confirm(`Are you sure you want to delete candidate ${cand.name}?`)) {
                                onDeleteCandidate(cand.id);
                              }
                            }}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          )}

          {/* ==================== 5. STUDENT MANAGEMENT ==================== */}
          {activeModule === 'student_management' && (
            <motion.div
              key="student_management"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div className="border-b border-slate-100 pb-4">
                <h2 className="text-lg font-black text-slate-800 tracking-tight">Student Database Administration</h2>
                <p className="text-xs text-slate-500 mt-1">Manage physical student credentials, authorize passcodes, or reset voting flags.</p>
              </div>

              {/* MANUAL STUDENT FORM */}
              <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm space-y-4" id="manual-student-card">
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Register Single Student Account</h3>
                <form onSubmit={handleAddStudentSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
                  
                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-600">Student Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Safa"
                      value={studentNameInput}
                      onChange={(e) => setStudentNameInput(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 text-xs transition-all"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-600">Admission ID (Unique)</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. S101"
                      value={studentIdInput}
                      onChange={(e) => setStudentIdInput(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 text-xs font-mono transition-all uppercase"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-600">Grade / Class</label>
                    <select
                      value={studentGradeInput}
                      onChange={(e) => setStudentGradeInput(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 text-xs transition-all"
                    >
                      {['Grade 9', 'Grade 10', 'Grade 11', 'Grade 12'].map(g => (
                        <option key={g} value={g}>{g}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-600">Passcode (Blank for random)</label>
                    <input
                      type="text"
                      placeholder="Optional"
                      value={studentPasscodeInput}
                      onChange={(e) => setStudentPasscodeInput(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 text-xs font-mono transition-all"
                    />
                  </div>

                  <div className="md:col-span-4 pt-1">
                    <button
                      type="submit"
                      className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-lg hover:shadow-indigo-500/10 transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <UserPlus className="h-4 w-4" />
                      Register Student Account
                    </button>
                  </div>

                </form>
              </div>

              {/* SEARCH & Roster */}
              <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm space-y-4" id="roster-card">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                  <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Registered Student Accounts ({admittedStudents.length})</h3>
                  <input
                    type="text"
                    placeholder="Search by Admission ID, name, class..."
                    value={studentSearchQuery}
                    onChange={(e) => setStudentSearchQuery(e.target.value)}
                    className="px-3.5 py-1.5 max-w-xs rounded-xl border border-slate-200 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/10 text-[11px] transition-all"
                  />
                </div>

                <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1">
                  {admittedStudents
                    .filter(s => {
                      const q = studentSearchQuery.trim().toLowerCase();
                      if (!q) return true;
                      return s.studentName.toLowerCase().includes(q) || s.admissionId.toLowerCase().includes(q) || s.grade.toLowerCase().includes(q);
                    })
                    .map((student) => {
                      const hasVoted = student.hasVoted || votes.some(v => v.studentId.trim().toUpperCase() === student.admissionId.trim().toUpperCase());
                      return (
                        <div key={student.admissionId} className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 bg-slate-50/50 border border-slate-100 rounded-xl transition-all hover:border-slate-200 text-xs gap-3">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono font-bold text-slate-700 bg-white px-2 py-0.5 border border-slate-200 rounded text-[10px]">
                                {student.admissionId}
                              </span>
                              <span className="font-bold text-slate-800">{student.studentName}</span>
                              <span className="text-[9px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded uppercase">
                                {student.grade}
                              </span>
                            </div>
                            <div className="text-slate-500 text-[10px] font-mono">
                              Passcode: <strong className="text-slate-700">{student.passcode}</strong>
                              {student.votedAt && (
                                <span className="text-[9px] text-slate-400 ml-2">
                                  • Voted at: {new Date(student.votedAt).toLocaleTimeString()}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2.5">
                            {hasVoted ? (
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full">
                                  ✓ Voted
                                </span>
                                <button
                                  onClick={async () => {
                                    if (confirm(`Reset voting status for ${student.studentName}? This deletes their cast votes and authorizes them to vote again.`)) {
                                      await onResetStudentVotes(student.admissionId);
                                      playSystemSound('winner_sound');
                                    }
                                  }}
                                  className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-[10px] font-bold text-amber-800 rounded transition-colors cursor-pointer"
                                >
                                  Reset Status
                                </button>
                              </div>
                            ) : (
                              <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 px-2.5 py-0.5 rounded-full">
                                Pending
                              </span>
                            )}

                            <button
                              onClick={() => {
                                if (confirm(`Delete student account ${student.studentName}?`)) {
                                  onDeleteAdmittedStudent(student.admissionId);
                                }
                              }}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            </motion.div>
          )}

          {/* ==================== 6. IMPORT STUDENTS (EXCEL/CSV) ==================== */}
          {activeModule === 'import_students' && (
            <motion.div
              key="import_students"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div className="border-b border-slate-100 pb-4">
                <h2 className="text-lg font-black text-slate-800 tracking-tight">Bulk Student Database Import</h2>
                <p className="text-xs text-slate-500 mt-1">Import hundreds of student accounts using Excel spreadsheets or CSV registers instantly.</p>
              </div>

              <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm space-y-5" id="bulk-import-card">
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Drag & Drop Upload Zone</h3>
                
                <div className="border border-dashed border-slate-200 hover:border-indigo-400 bg-slate-50/50 rounded-2xl p-8 flex flex-col items-center justify-center text-center space-y-4 transition-colors">
                  <div className="h-12 w-12 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-500">
                    <UploadCloud className="h-6 w-6" />
                  </div>
                  <div className="space-y-1.5 text-xs text-slate-500">
                    <p className="font-semibold text-slate-800">Choose Spreadsheet Register</p>
                    <p className="text-[10px]">Supports standard Excel (.xlsx) or comma-separated CSV (.csv) files.</p>
                  </div>
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept=".xlsx,.xls,.csv"
                    onChange={handleBulkImport}
                    className="hidden"
                    id="bulk-import-file-selector"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition-all cursor-pointer shadow hover:shadow-indigo-500/10"
                  >
                    Select File
                  </button>
                </div>

                {importingError && (
                  <div className="p-3.5 bg-rose-50 border border-rose-100 rounded-xl text-xs text-rose-700 flex gap-2.5 items-start leading-relaxed">
                    <AlertTriangle className="h-4.5 w-4.5 text-rose-500 shrink-0 mt-0.5" />
                    <span>{importingError}</span>
                  </div>
                )}

                {importingSuccess && (
                  <div className="p-3.5 bg-emerald-50 border border-emerald-100 rounded-xl text-xs text-emerald-800 flex gap-2.5 items-start leading-relaxed">
                    <CheckCircle className="h-4.5 w-4.5 text-emerald-600 shrink-0 mt-0.5" />
                    <span>{importingSuccess}</span>
                  </div>
                )}

                <div className="p-4 bg-indigo-50/40 rounded-2xl border border-indigo-50 space-y-2 text-xs">
                  <h4 className="font-bold text-indigo-950 flex items-center gap-1.5">
                    <Info className="h-4.5 w-4.5 text-indigo-600 shrink-0" />
                    Spreadsheet Template Schema Rules
                  </h4>
                  <p className="text-[10px] text-indigo-900/80 leading-relaxed">
                    Make sure your table columns include headers resembling: <strong>Name</strong> (Full Name), <strong>Admission ID</strong>, and <strong>Grade</strong>. If the <strong>Passcode</strong> column is empty or omitted, our system will automatically generate a secure 6-digit random code for each student account on the fly.
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {/* ==================== 7. VOTING MONITOR ==================== */}
          {activeModule === 'voting_monitor' && (
            <motion.div
              key="voting_monitor"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div className="border-b border-slate-100 pb-4">
                <h2 className="text-lg font-black text-slate-800 tracking-tight">Real-Time Ballot Monitor</h2>
                <p className="text-xs text-slate-500 mt-1">Live audit stream of cast ballots logs as students lock in selection choices.</p>
              </div>

              <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm space-y-4" id="voters-monitor-card">
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Ballots Audit Logs ({votes.length})</h3>
                <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                  {votes.map((v) => {
                    const student = admittedStudents.find(s => s.admissionId.trim().toUpperCase() === v.studentId.trim().toUpperCase());
                    const candidate = candidates.find(c => c.id === v.candidateId);
                    const postName = positions.find(p => p.id === v.positionId)?.name || 'Unknown Post';

                    return (
                      <div key={v.id} className="p-3 bg-slate-50/50 border border-slate-100 rounded-xl flex justify-between items-center text-xs gap-3">
                        <div className="space-y-0.5">
                          <span className="font-bold text-slate-800">{student?.studentName || v.studentId}</span>
                          <p className="text-[10px] text-slate-400 font-mono">Admission No: <strong className="text-slate-600">{v.studentId}</strong></p>
                          <p className="text-[10px] font-bold text-indigo-700">{postName} → <span className="text-slate-800">{candidate?.name || 'Selected Candidate'}</span></p>
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono shrink-0">
                          {new Date(v.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                    );
                  })}

                  {votes.length === 0 && (
                    <div className="text-center py-8 text-slate-400 text-xs">
                      No ballots cast yet. Live stream will update automatically on new votes.
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {/* ==================== 8. LIVE VOTE COUNT ==================== */}
          {activeModule === 'live_vote_count' && (
            <motion.div
              key="live_vote_count"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div className="border-b border-slate-100 pb-4">
                <h2 className="text-lg font-black text-slate-800 tracking-tight">Post-wise Tallies & Charts</h2>
                <p className="text-xs text-slate-500 mt-1">Live reactive indicators showing dynamic total votes and current leading candidates.</p>
              </div>

              {positions.map((pos) => {
                const posCands = candidates.filter(c => c.positionId === pos.id);
                const posVotesTotal = votes.filter(v => v.positionId === pos.id).length;

                return (
                  <div key={pos.id} className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm space-y-4">
                    <div className="flex justify-between items-center border-b border-slate-50 pb-2">
                      <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">{pos.name}</h3>
                      <span className="text-[10px] font-mono font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                        {posVotesTotal} votes recorded
                      </span>
                    </div>

                    <div className="space-y-3">
                      {posCands.map((cand) => {
                        const tally = votes.filter(v => v.candidateId === cand.id).length;
                        const percent = posVotesTotal > 0 ? Math.round((tally / posVotesTotal) * 100) : 0;

                        return (
                          <div key={cand.id} className="space-y-1.5 text-xs">
                            <div className="flex justify-between items-center text-slate-700">
                              <span className="font-semibold flex items-center gap-1">
                                {cand.symbol} {cand.name}
                              </span>
                              <span className="font-mono font-bold text-slate-800">{tally} votes ({percent}%)</span>
                            </div>
                            <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                              <div className="bg-indigo-600 h-full rounded-full transition-all duration-500" style={{ width: `${percent}%` }}></div>
                            </div>
                          </div>
                        );
                      })}

                      {posCands.length === 0 && (
                        <p className="text-xs text-slate-400 py-2">No candidates registered for this post.</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </motion.div>
          )}

          {/* ==================== 9. RESULTS SUMMARY ==================== */}
          {activeModule === 'results' && (
            <motion.div
              key="results"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div className="border-b border-slate-100 pb-4">
                <h2 className="text-lg font-black text-slate-800 tracking-tight">Final Elections Results</h2>
                <p className="text-xs text-slate-500 mt-1">Conclude ballot registries, publish official results, and trigger festive chord playbacks.</p>
              </div>

              {/* ACTION PANEL */}
              <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm space-y-4" id="results-control-panel">
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Conclude Election</h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Conclude live voting, compute winners, and broadcast a final celebratory sound effect in real-time.
                </p>
                <div className="pt-1 flex gap-3">
                  <button
                    onClick={() => {
                      playSystemSound('winner_sound');
                    }}
                    className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-lg transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <Trophy className="h-4 w-4" />
                    Play Celebratory Fanfare Sound
                  </button>
                </div>
              </div>

              {/* DECLARATIVE WINNERS LIST */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {positions.map((pos) => {
                  const posCands = candidates.map(c => {
                    const count = votes.filter(v => v.candidateId === c.id).length;
                    return { ...c, votesCount: count };
                  }).filter(c => c.positionId === pos.id);

                  // Sort desc to identify winner
                  posCands.sort((a, b) => b.votesCount - a.votesCount);
                  const winner = posCands[0];
                  const hasVotes = winner && winner.votesCount > 0;

                  return (
                    <div key={pos.id} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-3.5 flex flex-col justify-between">
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded uppercase">
                          {pos.name}
                        </span>
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider pt-1.5">Official Declared Winner</h4>
                      </div>

                      {hasVotes ? (
                        <div className="flex gap-3.5 items-center p-3 bg-emerald-50/40 border border-emerald-100 rounded-2xl">
                          <div className="h-11 w-11 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center font-black shrink-0 text-xl">
                            🏆
                          </div>
                          <div className="space-y-0.5">
                            <span className="font-bold text-slate-800 text-xs">{winner.name}</span>
                            <p className="text-[10px] text-slate-500">{winner.grade} {winner.division} • {winner.votesCount} votes logged</p>
                          </div>
                        </div>
                      ) : (
                        <div className="p-3.5 bg-slate-50 border border-slate-100 rounded-2xl text-center text-[11px] text-slate-400">
                          Pending ballots computation.
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* ==================== 10. SETTINGS ==================== */}
          {activeModule === 'settings' && (
            <motion.div
              key="settings"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div className="border-b border-slate-100 pb-4">
                <h2 className="text-lg font-black text-slate-800 tracking-tight">Audio Tone Sandbox Settings</h2>
                <p className="text-xs text-slate-500 mt-1">Configure Web Audio API parameters, mute select sounds, or upload custom files.</p>
              </div>

              {/* Master Volume */}
              <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm space-y-5" id="volume-card">
                <div className="flex justify-between items-center border-b border-slate-50 pb-3">
                  <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Master Sound Gains</h3>
                  <button
                    onClick={() => handleToggleGlobal(!localSettings.enabled)}
                    className={`px-3 py-1.5 rounded-xl transition-all text-[11px] font-bold flex items-center gap-1.5 cursor-pointer ${
                      localSettings.enabled
                        ? 'bg-indigo-50 text-indigo-700'
                        : 'bg-slate-100 text-slate-400'
                    }`}
                  >
                    {localSettings.enabled ? 'Mute Master Output' : 'Enable Audio Output'}
                  </button>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-xs text-slate-500">
                    <span>Gain Level</span>
                    <span className="font-mono font-bold text-slate-700">{Math.round(localSettings.volume * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={Math.round(localSettings.volume * 100)}
                    onChange={(e) => handleVolumeChange(parseInt(e.target.value) / 100)}
                    disabled={!localSettings.enabled}
                    className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-600 disabled:opacity-45"
                  />
                </div>
              </div>

              {/* Sound sandbox */}
              <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm space-y-4" id="sandbox-card">
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider border-b border-slate-50 pb-2">Toggle Individual Tone Triggers</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {SOUND_KEYS.map((key) => {
                    const sound = SOUND_LABELS[key];
                    const toggled = localSettings.soundToggles[key];

                    return (
                      <div key={key} className="p-3 bg-slate-50/50 rounded-xl border border-slate-100 flex items-center justify-between text-xs gap-3">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={toggled}
                              disabled={!localSettings.enabled}
                              onChange={(e) => handleToggleSound(key, e.target.checked)}
                              className="rounded text-indigo-600 focus:ring-indigo-500 h-3 w-3 cursor-pointer disabled:opacity-50"
                            />
                            <span className="font-bold text-slate-700">{sound.label}</span>
                          </div>
                          <p className="text-[10px] text-slate-400">{sound.desc}</p>
                        </div>
                        <button
                          onClick={() => playSystemSound(key)}
                          disabled={!localSettings.enabled || !toggled}
                          className="p-1.5 bg-indigo-50 hover:bg-indigo-100 disabled:bg-slate-100 text-indigo-600 rounded-lg shrink-0 cursor-pointer"
                        >
                          <Play className="h-3 w-3 fill-current" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          )}

          {/* ==================== 11. CHANGE PASSWORD ==================== */}
          {activeModule === 'change_password' && (
            <motion.div
              key="change_password"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div className="border-b border-slate-100 pb-4">
                <h2 className="text-lg font-black text-slate-800 tracking-tight">Modify Admin Credentials</h2>
                <p className="text-xs text-slate-500 mt-1">Change administrator account details, including Name, Email, Username, or Passcode.</p>
              </div>

              <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm max-w-xl" id="change-credentials-card">
                <form onSubmit={handleUpdateAdminCredentialsSubmit} className="space-y-4 text-xs">
                  
                  {/* Admin Name */}
                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-600">Administrator Contact Name</label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400">
                        <User className="h-4 w-4" />
                      </span>
                      <input
                        type="text"
                        required
                        placeholder="e.g. School Administrator"
                        value={adminName}
                        onChange={(e) => setAdminName(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-xs transition-all"
                      />
                    </div>
                  </div>

                  {/* Admin Username */}
                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-600">Username</label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400">
                        <ShieldCheck className="h-4 w-4" />
                      </span>
                      <input
                        type="text"
                        required
                        placeholder="e.g. admin"
                        value={adminUsername}
                        onChange={(e) => setAdminUsername(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-xs transition-all"
                      />
                    </div>
                  </div>

                  {/* Admin Email */}
                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-600">Registered Admin Email</label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400">
                        <Mail className="h-4 w-4" />
                      </span>
                      <input
                        type="email"
                        required
                        placeholder="e.g. admin@school.com"
                        value={adminEmail}
                        onChange={(e) => setAdminEmail(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-xs transition-all"
                      />
                    </div>
                  </div>

                  {/* Current Password - Required only if changing password */}
                  <div className="space-y-1.5 border-t border-slate-50 pt-3">
                    <label className="font-bold text-slate-600">Current Passcode (Required only if modifying passcode)</label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400">
                        <Lock className="h-4 w-4" />
                      </span>
                      <input
                        type="password"
                        placeholder="Input current password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-xs font-mono transition-all"
                      />
                    </div>
                  </div>

                  {/* New Password & Confirm */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="font-bold text-slate-600">New Passcode</label>
                      <input
                        type="password"
                        placeholder="Minimum 6 characters"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-xs font-mono transition-all"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="font-bold text-slate-600">Confirm New Passcode</label>
                      <input
                        type="password"
                        placeholder="Confirm password"
                        value={confirmNewPassword}
                        onChange={(e) => setConfirmNewPassword(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-xs font-mono transition-all"
                      />
                    </div>
                  </div>

                  {credentialsSuccess && (
                    <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-emerald-800 font-semibold flex items-center gap-2">
                      <Check className="h-4 w-4 text-emerald-600 shrink-0" />
                      <span>{credentialsSuccess}</span>
                    </div>
                  )}

                  {credentialsError && (
                    <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-rose-700 font-semibold flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-rose-500 shrink-0" />
                      <span>{credentialsError}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isUpdatingCredentials}
                    className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-100 disabled:text-slate-400 text-white font-bold text-xs rounded-xl shadow-lg hover:shadow-indigo-500/10 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    {isUpdatingCredentials ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Updating cloud directory...</span>
                      </>
                    ) : (
                      <>
                        <Check className="h-4 w-4" />
                        <span>Save Account Configuration</span>
                      </>
                    )}
                  </button>

                </form>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>

    </div>
  );
}
