/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Candidate, Vote, ElectionStatus, AudioSettings, AdmittedStudent, Position, DEFAULT_POSITIONS } from './types';
import { getAudioSettings, updateAudioSettings } from './audio';
import StudentPortal from './components/StudentPortal';
import AdminPortal from './components/AdminPortal';
import AdminLogin from './components/AdminLogin';
import AudioVisualizer from './components/AudioVisualizer';
import InsightLogo from './components/InsightLogo';
import { Vote as VoteIcon, ShieldCheck, HelpCircle, Activity, Award, CheckCircle } from 'lucide-react';
import { db, collection, doc, onSnapshot, setDoc, updateDoc, getDoc, getDocs, writeBatch, deleteDoc, handleFirestoreError, OperationType } from './firebase';

const INITIAL_ADMITTED_STUDENTS: AdmittedStudent[] = [
  { id: 'S101', name: 'Safa', pin: '1234' },
  { id: 'S102', name: 'Sarang', pin: '2468' },
  { id: 'S103', name: 'Meenakshi', pin: '1357' },
  { id: 'S104', name: 'Aadhav', pin: '1111' },
  { id: 'S105', name: 'Nandana', pin: '2222' },
];

const INITIAL_CANDIDATES: Candidate[] = [
  // pos-1: Head Boy
  {
    id: 'cand-1-1',
    positionId: 'pos-1',
    name: 'Ahmed Rahman',
    grade: 'Grade 10',
    division: 'A',
    rollNumber: '1',
    symbol: '⭐',
    bio: 'Dedicated to student leadership, academic support, and peer mentoring.',
    manifesto: 'I will advocate for regular career guidance programs, student grievance cell, and cleaner campus environment.',
    avatarSeed: 'AR',
    colorTheme: 'indigo',
    votesCount: 0,
  },
  {
    id: 'cand-1-2',
    positionId: 'pos-1',
    name: 'Rahul Kumar',
    grade: 'Grade 10',
    division: 'B',
    rollNumber: '14',
    symbol: '🔥',
    bio: 'Sports captain, team player, and vocal advocate of interactive extracurriculars.',
    manifesto: 'My manifesto focuses on sports infrastructure upgrades, monthly intra-school sports leagues, and music rooms.',
    avatarSeed: 'RK',
    colorTheme: 'rose',
    votesCount: 0,
  },
  // pos-2: Assistant Head Boy
  {
    id: 'cand-2-1',
    positionId: 'pos-2',
    name: 'Roshan S',
    grade: 'Grade 9',
    division: 'A',
    rollNumber: '23',
    symbol: '🌟',
    bio: 'Tech enthusiast, helper, and science club active member.',
    manifesto: 'I promise to assist the Head Boy, help organize technical workshops, and implement smart classroom aids.',
    avatarSeed: 'RS',
    colorTheme: 'emerald',
    votesCount: 0,
  },
  {
    id: 'cand-2-2',
    positionId: 'pos-2',
    name: 'Devadhathan',
    grade: 'Grade 9',
    division: 'B',
    rollNumber: '5',
    symbol: '☀️',
    bio: 'An approachable listener, passionate about discipline and clean campus.',
    manifesto: 'I want to bridge the communication gap between junior classes and the high-school cabinet.',
    avatarSeed: 'DD',
    colorTheme: 'amber',
    votesCount: 0,
  },
  // pos-3: Head Girl
  {
    id: 'cand-3-1',
    positionId: 'pos-3',
    name: 'Safa Fathima',
    grade: 'Grade 10',
    division: 'A',
    rollNumber: '12',
    symbol: '🌸',
    bio: 'Elocutionist, creative writer, and mentor to middle school students.',
    manifesto: 'I will push for regular health & hygiene webinars, self-defense workshops, and arts clubs integration.',
    avatarSeed: 'SF',
    colorTheme: 'purple',
    votesCount: 0,
  },
  {
    id: 'cand-3-2',
    positionId: 'pos-3',
    name: 'Meenakshi Rajesh',
    grade: 'Grade 10',
    division: 'B',
    rollNumber: '3',
    symbol: '🍀',
    bio: 'A topper, gentle guide, and pioneer of student wellness programs.',
    manifesto: 'I propose dedicated student-led mental health lounges, peer tutoring networks, and library expansion.',
    avatarSeed: 'MR',
    colorTheme: 'teal',
    votesCount: 0,
  },
  // pos-4: Assistant Head Girl
  {
    id: 'cand-4-1',
    positionId: 'pos-4',
    name: 'Gouri Priya',
    grade: 'Grade 9',
    division: 'B',
    rollNumber: '8',
    symbol: '🕊️',
    bio: 'Classical singer, energetic volunteer, and class representative.',
    manifesto: 'I will focus on empowering girls to lead debate tournaments, book clubs, and cultural festivals.',
    avatarSeed: 'GP',
    colorTheme: 'rose',
    votesCount: 0,
  },
  // pos-5: Fine Arts Secretary (Boys)
  {
    id: 'cand-5-1',
    positionId: 'pos-5',
    name: 'Siddharth S',
    grade: 'Grade 10',
    division: 'C',
    rollNumber: '30',
    symbol: '🎨',
    bio: 'State-level painting champion, visual designer, and mural artist.',
    manifesto: 'I want to host an annual inter-school art expo, paint campus murals, and introduce modern digital art clubs.',
    avatarSeed: 'SS',
    colorTheme: 'indigo',
    votesCount: 0,
  },
  // pos-6: Fine Arts Secretary (Girls)
  {
    id: 'cand-6-1',
    positionId: 'pos-6',
    name: 'Nandana Nair',
    grade: 'Grade 10',
    division: 'B',
    rollNumber: '21',
    symbol: '🎭',
    bio: 'Classical dancer, theater enthusiast, and public speaker.',
    manifesto: 'I will work towards establishing a robust drama guild, folk dance teams, and monthly talent expos.',
    avatarSeed: 'NN',
    colorTheme: 'amber',
    votesCount: 0,
  },
  // pos-7: Magazine Editor
  {
    id: 'cand-7-1',
    positionId: 'pos-7',
    name: 'Sarang Murali',
    grade: 'Grade 10',
    division: 'C',
    rollNumber: '27',
    symbol: '✍️',
    bio: 'Literary club secretary, editor of school wall magazine.',
    manifesto: 'I will launch a high-quality quarterly student newsletter and digitize our school magazine with audio/video.',
    avatarSeed: 'SM',
    colorTheme: 'emerald',
    votesCount: 0,
  },
];

export default function App() {
  const [positions, setPositions] = useState<Position[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [votes, setVotes] = useState<Vote[]>([]);
  const [admittedStudents, setAdmittedStudents] = useState<AdmittedStudent[]>([]);
  const [electionStatus, setElectionStatus] = useState<ElectionStatus>('active');
  const [currentTab, setCurrentTab] = useState<'student' | 'admin'>('student');
  const [audioSettings, setAudioSettings] = useState<AudioSettings>(getAudioSettings());
  
  // Admin Portal Password & Authentication states
  const [adminPassword, setAdminPassword] = useState<string>('admin123');
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState<boolean>(() => {
    return sessionStorage.getItem('isAdminAuthenticated') === 'true';
  });

  // 0. Sync Positions in real-time & seed if empty
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'positions'), async (snapshot) => {
      if (snapshot.empty) {
        const batch = writeBatch(db);
        DEFAULT_POSITIONS.forEach((pos) => {
          batch.set(doc(db, 'positions', pos.id), pos);
        });
        await batch.commit();
      } else {
        const list: Position[] = [];
        snapshot.forEach((doc) => {
          list.push(doc.data() as Position);
        });
        // Sort according to DEFAULT_POSITIONS ordering
        const orderMap = DEFAULT_POSITIONS.reduce((acc, pos, idx) => {
          acc[pos.id] = idx;
          return acc;
        }, {} as Record<string, number>);
        list.sort((a, b) => (orderMap[a.id] ?? 99) - (orderMap[b.id] ?? 99));
        setPositions(list);
      }
    }, (error) => {
      console.error("Firestore positions sync error:", error);
      handleFirestoreError(error, OperationType.GET, 'positions');
    });

    return () => unsub();
  }, []);

  // 1. Sync Candidates in real-time & seed if empty
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'candidates'), async (snapshot) => {
      if (snapshot.empty) {
        // Seed default candidates
        const batch = writeBatch(db);
        INITIAL_CANDIDATES.forEach((c) => {
          batch.set(doc(db, 'candidates', c.id), c);
        });
        await batch.commit();
      } else {
        const list: Candidate[] = [];
        snapshot.forEach((doc) => {
          list.push(doc.data() as Candidate);
        });
        setCandidates(list);
      }
    }, (error) => {
      console.error("Firestore candidates sync error:", error);
      handleFirestoreError(error, OperationType.GET, 'candidates');
    });

    return () => unsub();
  }, []);

  // 2. Sync Votes in real-time
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'votes'), (snapshot) => {
      const list: Vote[] = [];
      snapshot.forEach((doc) => {
        list.push(doc.data() as Vote);
      });
      setVotes(list);
    }, (error) => {
      console.error("Firestore votes sync error:", error);
      handleFirestoreError(error, OperationType.GET, 'votes');
    });

    return () => unsub();
  }, []);

  // 3. Sync Election Status
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'settings', 'election'), async (snapshot) => {
      if (snapshot.exists()) {
        setElectionStatus(snapshot.data().status as ElectionStatus);
      } else {
        // Initialize with default 'active' status
        await setDoc(doc(db, 'settings', 'election'), { status: 'active' });
      }
    }, (error) => {
      console.error("Firestore election status sync error:", error);
      handleFirestoreError(error, OperationType.GET, 'settings/election');
    });

    return () => unsub();
  }, []);

  // 4. Sync Audio Settings
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'settings', 'audio'), async (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data() as AudioSettings;
        setAudioSettings(data);
        updateAudioSettings(data);
      } else {
        // Initialize with default audio settings
        const defaults = getAudioSettings();
        await setDoc(doc(db, 'settings', 'audio'), defaults);
      }
    }, (error) => {
      console.error("Firestore audio settings sync error:", error);
      handleFirestoreError(error, OperationType.GET, 'settings/audio');
    });

    return () => unsub();
  }, []);

  // 5. Sync Admitted Students in real-time & seed if empty
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'admitted_students'), async (snapshot) => {
      if (snapshot.empty) {
        const batch = writeBatch(db);
        INITIAL_ADMITTED_STUDENTS.forEach((student) => {
          batch.set(doc(db, 'admitted_students', student.id.trim().toUpperCase()), {
            id: student.id.trim().toUpperCase(),
            name: student.name.trim(),
            pin: student.pin
          });
        });
        await batch.commit();
      } else {
        const list: AdmittedStudent[] = [];
        const batch = writeBatch(db);
        let needsMigration = false;
        
        snapshot.forEach((snapshotDoc) => {
          const data = snapshotDoc.data() as AdmittedStudent;
          if (!data.pin) {
            const initial = INITIAL_ADMITTED_STUDENTS.find(
              (s) => s.id.trim().toUpperCase() === data.id.trim().toUpperCase()
            );
            const resolvedPin = initial ? initial.pin : '1234';
            data.pin = resolvedPin;
            batch.update(snapshotDoc.ref, { pin: resolvedPin });
            needsMigration = true;
          }
          list.push(data);
        });

        if (needsMigration) {
          batch.commit().catch((err) => console.error("Admitted student PIN auto-migration failed:", err));
        }

        setAdmittedStudents(list);
      }
    }, (error) => {
      console.error("Firestore admitted students sync error:", error);
      handleFirestoreError(error, OperationType.GET, 'admitted_students');
    });

    return () => unsub();
  }, []);

  // 6. Sync Admin Password in real-time
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'settings', 'admin'), async (snapshot) => {
      if (snapshot.exists()) {
        setAdminPassword(snapshot.data().password || 'admin123');
      } else {
        // Initialize with default 'admin123'
        await setDoc(doc(db, 'settings', 'admin'), { password: 'admin123' });
      }
    }, (error) => {
      console.error("Firestore admin settings sync error:", error);
      handleFirestoreError(error, OperationType.GET, 'settings/admin');
    });

    return () => unsub();
  }, []);

  // Track who voted dynamically & securely to prevent any duplicate votes (normalized to uppercase)
  const votedStudentIds = useMemo(() => {
    return new Set(votes.map((v) => v.studentId.trim().toUpperCase()));
  }, [votes]);

  // Compute votesCount dynamically and reactively on-the-fly to guarantee perfect sync and prevent race conditions
  const candidatesWithVotes = useMemo(() => {
    return candidates.map((cand) => {
      const count = votes.filter((v) => v.candidateId === cand.id).length;
      return { ...cand, votesCount: count };
    });
  }, [candidates, votes]);

  // Handle newly cast votes in a batch to support voting across all posts simultaneously
  const handleVotesSubmitted = async (newVotes: Vote[]) => {
    try {
      const batch = writeBatch(db);
      newVotes.forEach((vote) => {
        const normalizedStudentId = vote.studentId.trim().toUpperCase();
        const voteDocRef = doc(db, 'votes', vote.id);
        batch.set(voteDocRef, {
          ...vote,
          studentId: normalizedStudentId
        });
      });
      await batch.commit();
    } catch (error) {
      console.error("Error submitting votes in batch to Firestore:", error);
      handleFirestoreError(error, OperationType.WRITE, 'votes_batch_submit');
    }
  };

  // Add a new candidate
  const handleAddCandidate = async (newCand: Omit<Candidate, 'votesCount'>) => {
    try {
      const candDocRef = doc(db, 'candidates', newCand.id);
      await setDoc(candDocRef, { ...newCand, votesCount: 0 });
    } catch (error) {
      console.error("Error adding candidate to Firestore:", error);
      handleFirestoreError(error, OperationType.WRITE, `candidates/${newCand.id}`);
    }
  };

  // Delete a candidate
  const handleDeleteCandidate = async (candId: string) => {
    try {
      await deleteDoc(doc(db, 'candidates', candId));
    } catch (error) {
      console.error("Error deleting candidate:", error);
      handleFirestoreError(error, OperationType.DELETE, `candidates/${candId}`);
    }
  };

  // Update an existing candidate
  const handleUpdateCandidate = async (candId: string, updatedFields: Partial<Candidate>) => {
    try {
      const candDocRef = doc(db, 'candidates', candId);
      await updateDoc(candDocRef, updatedFields);
    } catch (error) {
      console.error("Error updating candidate:", error);
      handleFirestoreError(error, OperationType.UPDATE, `candidates/${candId}`);
    }
  };

  // Reset all votes for testing
  const handleClearVotes = async () => {
    try {
      const batch = writeBatch(db);

      // Delete all votes
      const votesQuery = await getDocs(collection(db, 'votes'));
      votesQuery.forEach((d) => {
        batch.delete(d.ref);
      });
      
      // Reset candidates counts to 0 in firestore just in case
      const candidatesQuery = await getDocs(collection(db, 'candidates'));
      candidatesQuery.forEach((d) => {
        batch.update(d.ref, { votesCount: 0 });
      });
      
      await batch.commit();
    } catch (error) {
      console.error("Error clearing votes from Firestore:", error);
      handleFirestoreError(error, OperationType.DELETE, 'votes');
    }
  };

  // Set election status in database
  const handleSetElectionStatus = async (status: ElectionStatus) => {
    try {
      await setDoc(doc(db, 'settings', 'election'), { status });
    } catch (error) {
      console.error("Error setting election status:", error);
      handleFirestoreError(error, OperationType.WRITE, 'settings/election');
    }
  };

  // Update audio settings in database
  const handleUpdateAudioSettings = async (settings: AudioSettings) => {
    try {
      await setDoc(doc(db, 'settings', 'audio'), settings);
    } catch (error) {
      console.error("Error updating audio settings:", error);
      handleFirestoreError(error, OperationType.WRITE, 'settings/audio');
    }
  };

  // Add a student to admitted list
  const handleAddAdmittedStudent = async (student: AdmittedStudent) => {
    try {
      const normalizedId = student.id.trim().toUpperCase();
      await setDoc(doc(db, 'admitted_students', normalizedId), {
        id: normalizedId,
        name: student.name.trim(),
        pin: student.pin.trim()
      });
    } catch (error) {
      console.error("Error adding admitted student:", error);
      handleFirestoreError(error, OperationType.WRITE, `admitted_students/${student.id}`);
    }
  };

  // Delete a student from admitted list
  const handleDeleteAdmittedStudent = async (studentId: string) => {
    try {
      const normalizedId = studentId.trim().toUpperCase();
      await deleteDoc(doc(db, 'admitted_students', normalizedId));
    } catch (error) {
      console.error("Error deleting admitted student:", error);
      handleFirestoreError(error, OperationType.DELETE, `admitted_students/${studentId}`);
    }
  };

  // Update administrative passcode
  const handleUpdateAdminPassword = async (newPassword: string) => {
    try {
      await setDoc(doc(db, 'settings', 'admin'), { password: newPassword });
    } catch (error) {
      console.error("Error updating admin password:", error);
      handleFirestoreError(error, OperationType.WRITE, 'settings/admin');
    }
  };

  // Handle successful administrative login
  const handleAdminLoginSuccess = () => {
    setIsAdminAuthenticated(true);
    sessionStorage.setItem('isAdminAuthenticated', 'true');
  };

  // Handle administrative logout
  const handleAdminLogout = () => {
    setIsAdminAuthenticated(false);
    sessionStorage.removeItem('isAdminAuthenticated');
  };

  if (positions.length === 0 || candidates.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans" id="loading-screen">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          className="bg-white rounded-3xl shadow-xl border border-slate-100 p-8 max-w-md w-full text-center space-y-6"
        >
          <div className="flex flex-col items-center justify-center space-y-2">
            <div className="relative inline-flex items-center justify-center">
              <InsightLogo layout="icon-only" height={64} className="animate-bounce" />
              <div className="absolute inset-0 rounded-3xl border-4 border-[#13a5e1]/20 animate-ping"></div>
            </div>
          </div>
          <div>
            <InsightLogo layout="vertical" className="scale-95" />
            <h2 className="text-sm font-black text-slate-400 tracking-wider uppercase mt-6 border-t border-slate-100 pt-4">Smart School Election System</h2>
            <p className="text-xs text-indigo-600 font-bold uppercase tracking-wider mt-1 animate-pulse">
              Loading election data...
            </p>
          </div>
          <p className="text-xs text-slate-400 max-w-xs mx-auto leading-relaxed">
            Initializing secure real-time ballot register databases, student verification rosters, and high-fidelity audio synthesis engine...
          </p>
          <div className="flex justify-center items-center gap-2">
            <span className="h-2 w-2 bg-indigo-600 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
            <span className="h-2 w-2 bg-indigo-600 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
            <span className="h-2 w-2 bg-indigo-600 rounded-full animate-bounce"></span>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/50 text-slate-800 font-sans flex flex-col justify-between" id="app-root-container">
      
      {/* HEADER BAR */}
      <header className="bg-white border-b border-slate-100 sticky top-0 z-40" id="main-app-header">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row justify-between items-center gap-4">
          
          {/* Logo & Portal Brand */}
          <div className="flex items-center gap-4">
            <InsightLogo layout="horizontal" height={44} className="border-r border-slate-200/60 pr-4 mr-1 hidden md:flex" />
            <div className="md:hidden">
              <InsightLogo layout="icon-only" height={40} />
            </div>
            <div>
              <h1 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-1.5">
                Smart School Election System
                <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full uppercase tracking-wider">
                  V.3.5
                </span>
              </h1>
              <p className="text-[10px] text-slate-400 font-medium">Secure Real-Time Student Ballot with High-Fidelity Audio Feedback</p>
            </div>
          </div>

          {/* Navigation Tab Selectors */}
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200/50" id="portal-role-navigation">
            <button
              onClick={() => setCurrentTab('student')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                currentTab === 'student'
                  ? 'bg-white text-indigo-700 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
              id="student-role-btn"
            >
              <VoteIcon className="h-4.5 w-4.5" />
              Voting Booth
            </button>
            <button
              onClick={() => setCurrentTab('admin')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                currentTab === 'admin'
                  ? 'bg-white text-indigo-700 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
              id="admin-role-btn"
            >
              <ShieldCheck className="h-4.5 w-4.5" />
              Admin Portal
            </button>
          </div>

        </div>
      </header>

      {/* CORE CONTENT LAYOUT */}
      <main className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 flex-1 flex flex-col gap-8" id="main-app-content">
        
        {/* Dynamic Waveform Audio Visualizer (Always displays state wave when sounds trigger!) */}
        <div className="space-y-2" id="visualizer-wrapper">
          <div className="flex justify-between items-center text-xs">
            <span className="font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
              <Activity className="h-4 w-4 text-indigo-500" />
              Soundwave Visual Feedback
            </span>
            <span className="text-slate-400 font-medium text-[11px]">
              {audioSettings.enabled ? 'Web Audio API Mode Active' : 'Waveform Visualizer Muted'}
            </span>
          </div>
          <AudioVisualizer isEnabled={audioSettings.enabled} />
        </div>

        {/* Portal Workspace Switcher */}
        <div className="flex-1" id="workspace-container">
          <AnimatePresence mode="wait">
            {currentTab === 'student' ? (
              <motion.div
                key="student-view"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ duration: 0.25 }}
              >
                <StudentPortal
                  positions={positions}
                  candidates={candidatesWithVotes}
                  onVotesSubmitted={handleVotesSubmitted}
                  votedStudentIds={votedStudentIds}
                  electionActive={electionStatus === 'active'}
                  admittedStudents={admittedStudents}
                />
              </motion.div>
            ) : (
              <motion.div
                key="admin-view"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.25 }}
              >
                {!isAdminAuthenticated ? (
                  <AdminLogin
                    correctPasswordHash={adminPassword}
                    onLoginSuccess={handleAdminLoginSuccess}
                  />
                ) : (
                  <AdminPortal
                    positions={positions}
                    candidates={candidatesWithVotes}
                    votes={votes}
                    electionStatus={electionStatus}
                    setElectionStatus={handleSetElectionStatus}
                    onAddCandidate={handleAddCandidate}
                    onDeleteCandidate={handleDeleteCandidate}
                    onUpdateCandidate={handleUpdateCandidate}
                    onClearVotes={handleClearVotes}
                    audioSettings={audioSettings}
                    onUpdateAudioSettings={handleUpdateAudioSettings}
                    admittedStudents={admittedStudents}
                    onAddAdmittedStudent={handleAddAdmittedStudent}
                    onDeleteAdmittedStudent={handleDeleteAdmittedStudent}
                    adminPassword={adminPassword}
                    onUpdateAdminPassword={handleUpdateAdminPassword}
                    onLogout={handleAdminLogout}
                  />
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

      </main>

      {/* FOOTER BAR */}
      <footer className="bg-white border-t border-slate-100 py-6 text-center text-xs text-slate-400 font-medium" id="main-app-footer">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p>🏫 Smart School Election System © 2026. Made with professional HTML5 Web Audio synthesis.</p>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
              Mobile Compatible
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <Award className="h-3.5 w-3.5 text-indigo-500" />
              Zero Latency Audio
            </span>
          </div>
        </div>
      </footer>

    </div>
  );
}

