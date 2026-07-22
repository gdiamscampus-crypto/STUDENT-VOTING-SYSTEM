/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, FormEvent, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Candidate, Vote, StudentSession, Student, Position } from '../types';
import { playSystemSound } from '../audio';
import { db, doc, setDoc, handleFirestoreError, OperationType } from '../firebase';
import { User, ShieldAlert, CheckCircle, Award, Sparkles, ChevronRight, ChevronLeft, LogOut, FileText, Check, Camera, CameraOff, RotateCcw, Loader2 } from 'lucide-react';
import Confetti from './Confetti';
import InsightLogo from './InsightLogo';
import { CandidatePhoto, CandidateSymbol } from './CandidateMedia';

interface StudentPortalProps {
  positions: Position[];
  candidates: Candidate[];
  onVotesSubmitted: (votes: Vote[]) => void;
  votedStudentIds: Set<string>;
  electionActive: boolean;
  admittedStudents: Student[];
}

export default function StudentPortal({
  positions,
  candidates,
  onVotesSubmitted,
  votedStudentIds,
  electionActive,
  admittedStudents,
}: StudentPortalProps) {
  const [studentId, setStudentId] = useState('');
  const [studentPin, setStudentPin] = useState('');
  const [warningMessage, setWarningMessage] = useState<string | null>(null);
  const [session, setSession] = useState<StudentSession | null>(null);

  // Automatically read and pre-fill Student Admission ID from URL query parameters
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const idFromUrl = params.get('admissionId') || params.get('id');
    if (idFromUrl) {
      setStudentId(idFromUrl.toUpperCase().trim());
    }
  }, []);

  // Camera Verification States
  const [showCameraStep, setShowCameraStep] = useState(false);
  const [tempStudent, setTempStudent] = useState<StudentSession | null>(null);
  const [capturedSelfie, setCapturedSelfie] = useState<string | null>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isInitializingCamera, setIsInitializingCamera] = useState(false);
  const [isSavingSelfie, setIsSavingSelfie] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Multi-post voting states
  const [currentPositionIndex, setCurrentPositionIndex] = useState(0);
  const [selectedCandidateIds, setSelectedCandidateIds] = useState<Record<string, string>>({}); // positionId -> candidateId
  const [isReviewStep, setIsReviewStep] = useState(false);
  const [voteSubmitted, setVoteSubmitted] = useState(false);
  const [selectionConfirmedText, setSelectionConfirmedText] = useState<string | null>(null);

  // Stop camera tracks to release camera hardware
  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
    }
    setCameraStream(null);
  };

  // Start video stream from the user-facing device camera
  const startCamera = async () => {
    setIsInitializingCamera(true);
    setCameraError(null);
    setCapturedSelfie(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user', // Request user-facing front camera
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
        audio: false,
      });
      setCameraStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch((err) => console.error("Error playing camera video stream:", err));
      }
    } catch (err: any) {
      console.error("Camera access error:", err);
      let errMsg = "Camera access denied or unavailable. Camera permission is mandatory to proceed with voting.";
      if (err.name === 'NotAllowedError') {
        errMsg = "Camera permission was denied. Camera permission is mandatory to verify your identity and vote.";
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        errMsg = "No camera was found on your device. An active camera is required for student verification.";
      }
      setCameraError(errMsg);
      playSystemSound('warning_sound');
    } finally {
      setIsInitializingCamera(false);
    }
  };

  // Keep camera synced with step transitions
  useEffect(() => {
    if (showCameraStep && tempStudent) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [showCameraStep]);

  // Capture current live frame from the video stream onto a canvas and stop stream
  const handleCapture = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (context) {
      // Adjust canvas to match active video source size
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;

      // Draw mirrored selfie for natural perspective
      context.translate(canvas.width, 0);
      context.scale(-1, 1);
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      context.setTransform(1, 0, 0, 1, 0, 0); // reset matrix

      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      setCapturedSelfie(dataUrl);
      playSystemSound('select_sound');

      // Release video stream immediately once captured
      if (cameraStream) {
        cameraStream.getTracks().forEach((track) => track.stop());
      }
      setCameraStream(null);
    }
  };

  // Re-enable live preview to retake
  const handleRetake = () => {
    setCapturedSelfie(null);
    startCamera();
  };

  // Commit selfie and student data to Firestore, and log in to start voting
  const handleConfirmVerification = async () => {
    if (!tempStudent || !capturedSelfie) return;

    setIsSavingSelfie(true);
    try {
      const selfieId = `selfie_${tempStudent.id}_${Date.now()}`;
      await setDoc(doc(db, 'selfies', selfieId), {
        id: selfieId,
        admissionId: tempStudent.id,
        studentName: tempStudent.name,
        loginTime: new Date().toISOString(),
        capturedSelfie: capturedSelfie,
        deviceInfo: navigator.userAgent || 'Unknown Device',
      });

      // Login success
      playSystemSound('login_sound');
      setSession(tempStudent);

      // Reset local transition states
      setShowCameraStep(false);
      setTempStudent(null);
      setCapturedSelfie(null);
      setWarningMessage(null);

      // Reset voting flow states
      setCurrentPositionIndex(0);
      setSelectedCandidateIds({});
      setIsReviewStep(false);
      setVoteSubmitted(false);
    } catch (error) {
      console.error("Failed to save selfie verification:", error);
      handleFirestoreError(error, OperationType.CREATE, `selfies/selfie_${tempStudent.id}`);
    } finally {
      setIsSavingSelfie(false);
    }
  };

  // Return to initial login step
  const handleCancelVerification = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
    }
    setCameraStream(null);
    setShowCameraStep(false);
    setTempStudent(null);
    setCapturedSelfie(null);
    setCameraError(null);
    setStudentId('');
    setStudentPin('');
    playSystemSound('select_sound');
  };

  // Trigger login - Authenticates credentials and opens Camera Verification
  const handleLogin = (e: FormEvent) => {
    e.preventDefault();
    const trimmedId = studentId.trim().toUpperCase();

    if (!trimmedId) return;

    if (!electionActive) {
      setWarningMessage("The election is not currently active. Contact the administrator.");
      playSystemSound('warning_sound');
      return;
    }

    // Find in school student database
    const registeredStudent = admittedStudents.find(
      (s) => s.admissionId.trim().toUpperCase() === trimmedId
    );

    if (!registeredStudent) {
      setWarningMessage("ഈ സ്കൂളിൽ അഡ്മിഷൻ ഉള്ള വിദ്യാർത്ഥികൾക്ക് മാത്രമേ വോട്ട് ചെയ്യാൻ സാധിക്കൂ! (Only students with a valid school admission are permitted to vote!)");
      playSystemSound('warning_sound');
      return;
    }

    // Verify Passcode securely
    const enteredPasscode = studentPin.trim();
    const registeredPasscode = (registeredStudent.passcode || '').trim();

    if (enteredPasscode !== registeredPasscode) {
      setWarningMessage("തെറ്റായ പാസ്‌കോഡ് നമ്പർ! ദയവായി ശരിയായ പാസ്‌കോഡ് നൽകുക. (Incorrect Passcode! Please enter the correct security passcode.)");
      playSystemSound('warning_sound');
      return;
    }

    // Check if duplicate vote
    if (votedStudentIds.has(trimmedId) || registeredStudent.hasVoted) {
      setWarningMessage(`ഈ വിദ്യാർത്ഥി ഇതിനകം വോട്ട് ചെയ്തിട്ടുണ്ട്! Student ID ${trimmedId} (${registeredStudent.studentName}) has already submitted a vote.`);
      playSystemSound('warning_sound');
      return;
    }

    // Success login credentials - transition to selfie capture
    playSystemSound('select_sound');
    setWarningMessage(null);
    setTempStudent({
      id: trimmedId,
      name: registeredStudent.studentName,
      grade: registeredStudent.grade,
      hasVoted: false,
    });
    setShowCameraStep(true);
  };

  // Handle Candidate Selection for current post
  const handleSelectCandidate = (candidate: Candidate, positionId: string) => {
    setSelectedCandidateIds((prev) => ({
      ...prev,
      [positionId]: candidate.id,
    }));
    setSelectionConfirmedText(`"${candidate.name}" Selected for ${positions.find(p => p.id === positionId)?.name || 'Post'}`);
    playSystemSound('select_sound');
    
    // Clear selection text after 2 seconds
    setTimeout(() => {
      setSelectionConfirmedText(null);
    }, 2000);
  };

  // Skip or clear selection for current post
  const handleSkipPosition = (positionId: string) => {
    setSelectedCandidateIds((prev) => ({
      ...prev,
      [positionId]: 'none',
    }));
    playSystemSound('select_sound');
  };

  // Advance to next position or review step
  const handleNextPosition = () => {
    if (currentPositionIndex < positions.length - 1) {
      setCurrentPositionIndex((prev) => prev + 1);
    } else {
      setIsReviewStep(true);
    }
  };

  // Go back to previous position or review editing
  const handlePrevPosition = () => {
    if (currentPositionIndex > 0) {
      setCurrentPositionIndex((prev) => prev - 1);
    }
  };

  // Handle Final Batch Vote Submission
  const handleConfirmVote = () => {
    if (!session) return;

    // Build the list of votes
    const votesList: Vote[] = positions.map((pos) => {
      const selectedId = selectedCandidateIds[pos.id];
      return {
        id: `vote_${pos.id}_${session.id}_${Date.now()}`,
        studentId: session.id,
        studentName: session.name,
        candidateId: selectedId || 'none',
        positionId: pos.id,
        timestamp: new Date().toISOString(),
      };
    });

    // Play Vote Submission Sounds
    playSystemSound('vote_success');
    
    setVoteSubmitted(true);
    setIsReviewStep(false);
    onVotesSubmitted(votesList);

    // Notify new vote sound (for admin or general channel) after a brief delay
    setTimeout(() => {
      playSystemSound('new_vote_sound');
    }, 1200);
  };

  // Logout / Reset
  const handleLogout = () => {
    setSession(null);
    setStudentId('');
    setStudentPin('');
    setSelectedCandidateIds({});
    setCurrentPositionIndex(0);
    setIsReviewStep(false);
    setWarningMessage(null);
    setVoteSubmitted(false);
    setSelectionConfirmedText(null);
  };

  const currentPosition = positions[currentPositionIndex];
  const currentPositionCandidates = currentPosition
    ? candidates.filter((c) => c.positionId === currentPosition.id)
    : [];
  const currentSelectionId = currentPosition ? selectedCandidateIds[currentPosition.id] : undefined;

  return (
    <div className="relative w-full max-w-4xl mx-auto animate-fadeIn" id="student-portal-wrapper">
      <AnimatePresence mode="wait">
        {/* Step 1: Login Form */}
        {!session && !showCameraStep && (
          <motion.div
            key="login"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.3 }}
            className="bg-white rounded-2xl shadow-xl border border-slate-100 p-8 max-w-md mx-auto space-y-5"
            id="student-login-card"
          >
            <div className="text-center">
              <InsightLogo layout="vertical" className="mb-4 scale-95" />
              <h2 className="text-xs font-bold text-slate-400 tracking-wider uppercase border-t border-slate-100 pt-4">Smart School Election System</h2>
              <p className="text-[11px] text-slate-400 mt-1">Authenticate using your unique Student Admission ID and Passcode</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
                  Admission ID
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. S101"
                  value={studentId}
                  onChange={(e) => {
                    setStudentId(e.target.value);
                    if (warningMessage) setWarningMessage(null);
                  }}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm font-mono tracking-wider transition-all uppercase"
                  id="student-id-input"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
                  Passcode
                </label>
                <input
                  type="password"
                  required
                  placeholder="Enter Passcode"
                  value={studentPin}
                  onChange={(e) => {
                    setStudentPin(e.target.value);
                    if (warningMessage) setWarningMessage(null);
                  }}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm font-mono tracking-wider transition-all"
                  id="student-pin-input"
                />
              </div>

              {warningMessage && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="flex gap-2.5 p-3.5 bg-rose-50 border border-rose-100 rounded-xl text-rose-700 text-xs leading-relaxed"
                  id="login-warning-box"
                >
                  <ShieldAlert className="h-4.5 w-4.5 text-rose-500 shrink-0 mt-0.5" id="login-alert-icon" />
                  <div>
                    <span className="font-semibold block">Access Restricted</span>
                    <p className="text-[11px] text-rose-600/90 mt-0.5">{warningMessage}</p>
                    <p className="text-[10px] text-rose-500 font-medium mt-1 uppercase tracking-wide">
                      🔊 Alert Sound Activated
                    </p>
                  </div>
                </motion.div>
              )}

              <button
                type="submit"
                disabled={!studentId.trim() || !studentPin.trim()}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-100 disabled:text-slate-400 text-white font-medium text-sm rounded-xl shadow-lg shadow-indigo-600/10 hover:shadow-indigo-600/20 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                id="student-login-submit"
              >
                Verify Identity
                <ChevronRight className="h-4 w-4" />
              </button>
            </form>
          </motion.div>
        )}

        {!session && showCameraStep && tempStudent && (
          <motion.div
            key="camera-step"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.3 }}
            className="bg-white rounded-2xl shadow-xl border border-slate-100 p-8 max-w-lg mx-auto space-y-6"
            id="student-camera-card"
          >
            <div className="text-center space-y-2">
              <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full uppercase tracking-wider">
                Step 2: Camera Verification
              </span>
              <h2 className="text-lg font-black text-slate-800 tracking-tight">Verify Your Identity</h2>
              <p className="text-xs text-slate-400">
                Hi <span className="font-bold text-slate-700">{tempStudent.name}</span> ({tempStudent.grade}). Please capture a quick live selfie to authenticate.
              </p>
            </div>

            {/* Hidden Canvas used for capturing the selfie frame */}
            <canvas ref={canvasRef} className="hidden" />

            {/* Live Camera Viewport or Captured Selfie Image */}
            <div className="relative aspect-video w-full bg-slate-900 rounded-2xl overflow-hidden border border-slate-200 shadow-inner flex items-center justify-center group">
              {isInitializingCamera && (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center space-y-3 bg-slate-950/90 text-white z-10 animate-fadeIn">
                  <Loader2 className="h-8 w-8 text-indigo-400 animate-spin" />
                  <p className="text-xs font-semibold tracking-wide uppercase text-indigo-200">Initializing Secure Lens...</p>
                  <p className="text-[11px] text-slate-400 max-w-xs leading-relaxed">
                    Please approve browser camera permissions if prompted to verify your biometric voting lock.
                  </p>
                </div>
              )}

              {cameraError ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center space-y-4 bg-slate-950 text-white z-10 animate-fadeIn">
                  <CameraOff className="h-10 w-10 text-rose-500 animate-bounce" />
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-rose-400">Verification Interrupted</h4>
                    <p className="text-[11px] text-slate-300 mt-2 max-w-xs leading-relaxed">
                      {cameraError}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={startCamera}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-xl transition-all cursor-pointer"
                    >
                      Retry Camera
                    </button>
                    <button
                      onClick={handleCancelVerification}
                      className="px-4 py-2 bg-slate-850 hover:bg-slate-800 text-slate-300 font-semibold text-xs rounded-xl transition-all cursor-pointer"
                    >
                      Back to Login
                    </button>
                  </div>
                </div>
              ) : null}

              {/* Live Video Feed */}
              {!capturedSelfie && !cameraError && (
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover transform scale-x-[-1]"
                />
              )}

              {/* Biometric overlay frame guidelines when video is active */}
              {!capturedSelfie && !cameraError && !isInitializingCamera && (
                <div className="absolute inset-0 border-2 border-dashed border-indigo-500/30 rounded-2xl pointer-events-none flex items-center justify-center">
                  <div className="w-56 h-56 rounded-full border-2 border-indigo-500/40 border-dashed relative animate-pulse">
                    <div className="absolute top-2 left-1/2 -translate-x-1/2 text-[9px] font-bold text-indigo-400/80 tracking-widest uppercase bg-slate-950/80 px-2 py-0.5 rounded-full">
                      Align Face
                    </div>
                  </div>
                </div>
              )}

              {/* Captured Image Preview */}
              {capturedSelfie && (
                <img
                  src={capturedSelfie}
                  alt="Captured Selfie"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              )}
            </div>

            {/* Action buttons */}
            <div className="flex flex-col sm:flex-row gap-3">
              {!capturedSelfie ? (
                <>
                  <button
                    onClick={handleCapture}
                    disabled={isInitializingCamera || !!cameraError}
                    className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-100 disabled:text-slate-400 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-600/10 hover:shadow-indigo-600/20 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Camera className="h-4 w-4" />
                    Capture Selfie
                  </button>
                  <button
                    onClick={handleCancelVerification}
                    className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    Cancel Verification
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={handleConfirmVerification}
                    disabled={isSavingSelfie}
                    className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-100 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-600/10 hover:shadow-emerald-600/20 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    {isSavingSelfie ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Verifying & Logging In...
                      </>
                    ) : (
                      <>
                        <Check className="h-4 w-4" />
                        Confirm & Log In to Vote
                      </>
                    )}
                  </button>
                  <button
                    onClick={handleRetake}
                    disabled={isSavingSelfie}
                    className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <RotateCcw className="h-4 w-4" />
                    Retake Selfie
                  </button>
                </>
              )}
            </div>
            <p className="text-[10px] text-slate-400 text-center leading-relaxed">
              🔒 Biometric verifications are stored securely inside high-integrity cloud databases. Gallery uploads are strictly disabled to prevent spoofing.
            </p>
          </motion.div>
        )}

        {/* Step 2: Voting, Review & Confirmation Step */}
        {session && (
          <motion.div
            key="voting-interface"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="space-y-6"
            id="student-voting-workspace"
          >
            {/* Confetti celebration when successfully voted */}
            {voteSubmitted && <Confetti />}

            {/* Student Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-5 bg-white rounded-2xl shadow-sm border border-slate-100 gap-4" id="student-portal-header">
              <div>
                <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full uppercase tracking-wider">
                  Active Student Session
                </span>
                <h3 className="text-lg font-bold text-slate-800 mt-1 flex items-center gap-1.5 flex-wrap">
                  Welcome, {session.name}
                  <span className="text-xs font-mono font-normal text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">
                    {session.grade}
                  </span>
                  <span className="text-xs font-mono font-normal text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
                    Admission ID: {session.id}
                  </span>
                </h3>
              </div>
              
              {!voteSubmitted && (
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs text-slate-500 hover:text-slate-800 hover:bg-slate-50 rounded-lg transition-all cursor-pointer"
                  id="student-logout-btn"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Exit Session
                </button>
              )}
            </div>

            {/* Steps / Positions List Sidebar Indicator */}
            {!voteSubmitted && positions.length > 0 && (
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100" id="voting-steps-progress">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-3">
                  Ballot Voting Progress ({isReviewStep ? 'Reviewing' : `${currentPositionIndex + 1} of ${positions.length}`})
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
                  {positions.map((pos, idx) => {
                    const isCompleted = selectedCandidateIds[pos.id] !== undefined;
                    const isActive = currentPositionIndex === idx && !isReviewStep;
                    return (
                      <button
                        key={pos.id}
                        disabled={voteSubmitted}
                        onClick={() => {
                          setIsReviewStep(false);
                          setCurrentPositionIndex(idx);
                        }}
                        className={`py-2 px-2 rounded-xl text-left border transition-all text-xs flex flex-col justify-between h-14 cursor-pointer ${
                          isActive
                            ? 'border-indigo-600 bg-indigo-50/50 ring-2 ring-indigo-50'
                            : isCompleted
                            ? 'border-emerald-200 bg-emerald-50/20 text-emerald-800'
                            : 'border-slate-100 hover:border-slate-200 bg-slate-50 text-slate-500'
                        }`}
                      >
                        <span className="text-[9px] text-slate-400 uppercase font-bold">Post {idx + 1}</span>
                        <span className="font-semibold truncate w-full">{pos.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <AnimatePresence mode="wait">
              {/* Review Ballot Step */}
              {isReviewStep && !voteSubmitted ? (
                <motion.div
                  key="ballot-review"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-6"
                >
                  <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 space-y-4">
                    <div className="text-center max-w-md mx-auto space-y-2">
                      <div className="h-12 w-12 bg-amber-50 rounded-full text-amber-500 flex items-center justify-center mx-auto shadow-inner">
                        <FileText className="h-6 w-6" />
                      </div>
                      <h4 className="text-lg font-bold text-slate-800">Verify Your Complete Ballot</h4>
                      <p className="text-xs text-slate-500">
                        Review your selections for each election post below. You can edit any post before final submission.
                      </p>
                    </div>

                    <div className="border-t border-slate-50 pt-4 space-y-3">
                      {positions.map((pos) => {
                        const selId = selectedCandidateIds[pos.id];
                        const selCandidate = candidates.find((c) => c.id === selId);

                        return (
                          <div
                            key={pos.id}
                            className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-3.5 rounded-xl bg-slate-50/50 border border-slate-100 hover:border-slate-200 transition-all gap-3"
                          >
                            <div className="flex items-center gap-3">
                              {/* Candidate Circular Thumbnail */}
                              {selCandidate && (
                                <div className="h-10 w-10 rounded-full border border-slate-200 overflow-hidden shrink-0 bg-slate-100 relative flex items-center justify-center">
                                  <CandidatePhoto
                                    photoUrl={selCandidate.photoUrl}
                                    avatarImageUrl={selCandidate.avatarImageUrl}
                                    candidatePhotoURL={selCandidate.candidatePhotoURL}
                                    fallbackSeed={selCandidate.name}
                                  />
                                </div>
                              )}

                              <div className="space-y-0.5">
                                <span className="text-[9px] font-bold text-indigo-600 uppercase tracking-wider block">
                                  {pos.name}
                                </span>
                                <h5 className="font-bold text-slate-800 text-sm">
                                  {selCandidate ? (
                                    <span className="flex items-center gap-1.5 flex-wrap">
                                      <CandidateSymbol
                                        symbolUrl={selCandidate.symbolUrl}
                                        identitySymbolImageUrl={selCandidate.identitySymbolImageUrl}
                                        symbolURL={selCandidate.symbolURL}
                                        symbolText={selCandidate.symbol}
                                      />
                                      {selCandidate.name}
                                      <span className="text-xs font-mono font-normal text-slate-400 bg-slate-100 px-1.5 py-0.2 rounded">
                                        Class: {selCandidate.grade} / Div {selCandidate.division}
                                      </span>
                                    </span>
                                  ) : (
                                    <span className="text-rose-600 italic font-semibold">No selection / Bypassed</span>
                                  )}
                                </h5>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => {
                                const idx = positions.findIndex((p) => p.id === pos.id);
                                setCurrentPositionIndex(idx);
                                setIsReviewStep(false);
                              }}
                              className="px-3 py-1 text-[11px] font-semibold text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 border border-indigo-100 rounded-lg transition-all cursor-pointer"
                            >
                              Change Vote
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-4">
                    <div className="text-center sm:text-left">
                      <p className="text-xs font-semibold text-slate-700">Submit secure final ballot?</p>
                      <p className="text-[11px] text-slate-500">Your selection will be securely recorded in the school register.</p>
                    </div>

                    <div className="flex gap-3">
                      <button
                        onClick={() => {
                          setIsReviewStep(false);
                          setCurrentPositionIndex(0);
                        }}
                        className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition-all cursor-pointer"
                      >
                        Back to Booth
                      </button>
                      <button
                        onClick={handleConfirmVote}
                        className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-lg hover:shadow-indigo-600/20 active:scale-[0.98] transition-all cursor-pointer"
                        id="confirm-vote-submit"
                      >
                        CONFIRM FINAL VOTE
                      </button>
                    </div>
                  </div>
                </motion.div>
              ) : !voteSubmitted && currentPosition ? (
                /* Dynamic Selection for current Position */
                <motion.div
                  key={`voting-candidates-${currentPosition.id}`}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="space-y-6"
                >
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <div className="text-left">
                      <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider">
                        Now Voting For Post
                      </span>
                      <h4 className="text-lg font-black text-slate-800 flex items-center gap-2">
                        {currentPosition.name}
                      </h4>
                      <p className="text-xs text-slate-500 mt-0.5">Please select one candidate below for this official school position.</p>
                    </div>

                    <button
                      onClick={() => handleSkipPosition(currentPosition.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                        currentSelectionId === 'none'
                          ? 'bg-rose-50 border border-rose-200 text-rose-700'
                          : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {currentSelectionId === 'none' ? '✓ Post Bypassed' : 'Skip / None of these'}
                    </button>
                  </div>

                  {/* Candidates Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5" id="candidates-grid">
                    {currentPositionCandidates.map((c) => {
                      const isSelected = currentSelectionId === c.id;
                      const themeColors: Record<string, { bg: string, border: string, text: string, accent: string, gradient: string }> = {
                        indigo: { bg: 'bg-indigo-50/50', border: 'border-indigo-200', text: 'text-indigo-700', accent: 'bg-indigo-600', gradient: 'from-indigo-500 to-blue-600' },
                        emerald: { bg: 'bg-emerald-50/50', border: 'border-emerald-200', text: 'text-emerald-700', accent: 'bg-emerald-600', gradient: 'from-emerald-500 to-teal-600' },
                        rose: { bg: 'bg-rose-50/50', border: 'border-rose-200', text: 'text-rose-700', accent: 'bg-rose-600', gradient: 'from-rose-500 to-pink-600' },
                        amber: { bg: 'bg-amber-50/50', border: 'border-amber-200', text: 'text-amber-700', accent: 'bg-amber-600', gradient: 'from-amber-500 to-orange-600' },
                        purple: { bg: 'bg-purple-50/50', border: 'border-purple-200', text: 'text-purple-700', accent: 'bg-purple-600', gradient: 'from-purple-500 to-fuchsia-600' },
                        teal: { bg: 'bg-teal-50/50', border: 'border-teal-200', text: 'text-teal-700', accent: 'bg-teal-600', gradient: 'from-teal-500 to-emerald-600' },
                      };

                      const theme = themeColors[c.colorTheme] || themeColors.indigo;

                      return (
                        <motion.div
                          key={c.id}
                          whileHover={{ y: -3 }}
                          transition={{ duration: 0.2 }}
                          onClick={() => handleSelectCandidate(c, currentPosition.id)}
                          className={`relative cursor-pointer bg-white rounded-2xl border-2 p-5 flex flex-col justify-between transition-all duration-300 shadow-sm hover:shadow-md ${
                            isSelected
                              ? 'border-indigo-600 bg-indigo-50/30 shadow-indigo-100 ring-4 ring-indigo-50/50'
                              : 'border-slate-100 hover:border-slate-200'
                          }`}
                          id={`candidate-card-${c.id}`}
                        >
                          {isSelected && (
                            <div className="absolute top-4 right-4 bg-indigo-600 text-white rounded-full p-1.5 shadow z-10" id={`selected-badge-${c.id}`}>
                              <CheckCircle className="h-4 w-4" />
                            </div>
                          )}

                          <div className="flex gap-4">
                            {/* Circular Profile Photo Design with default placeholder */}
                            <div className="h-16 w-16 rounded-full border border-slate-200 overflow-hidden shrink-0 bg-slate-50 relative flex items-center justify-center">
                              <CandidatePhoto
                                photoUrl={c.photoUrl}
                                avatarImageUrl={c.avatarImageUrl}
                                candidatePhotoURL={c.candidatePhotoURL}
                                fallbackSeed={c.avatarSeed || c.name}
                                themeGradient={theme.gradient}
                              />
                            </div>

                            <div className="space-y-1">
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded uppercase">
                                  {c.grade} / Div {c.division}
                                </span>
                                <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                                  Roll {c.rollNumber}
                                </span>
                              </div>
                              <h5 className="font-extrabold text-slate-800 text-base leading-tight mt-1">{c.name}</h5>
                              <div className="flex items-center gap-1.5 text-xs text-indigo-600 font-medium italic mt-0.5">
                                <CandidateSymbol
                                  symbolUrl={c.symbolUrl}
                                  identitySymbolImageUrl={c.identitySymbolImageUrl}
                                  symbolURL={c.symbolURL}
                                  symbolText={c.symbol}
                                />
                                <span>Symbol</span>
                              </div>
                            </div>
                          </div>

                          <div className="mt-4 space-y-2 border-t border-slate-50 pt-3">
                            <div>
                              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Candidate Introduction</span>
                              <p className="text-xs text-slate-600 leading-relaxed line-clamp-3">{c.bio}</p>
                            </div>
                            {c.manifesto && (
                              <div>
                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Manifesto Platform</span>
                                <p className="text-xs text-indigo-900 bg-indigo-50/40 p-2.5 rounded-lg border border-indigo-100/20 leading-relaxed font-medium italic text-[11px] line-clamp-3">
                                  "{c.manifesto}"
                                </p>
                              </div>
                            )}
                          </div>

                          <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between">
                            <span className="text-[10px] text-slate-400 uppercase tracking-wide flex items-center gap-1 font-bold">
                              <Sparkles className="h-3 w-3 text-amber-500" />
                              Official Ballot Profile
                            </span>
                            <span className={`text-xs font-bold px-3 py-1 rounded-lg ${isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-50 text-slate-600'}`}>
                              {isSelected ? '✓ Selected' : 'Select Candidate'}
                            </span>
                          </div>
                        </motion.div>
                      );
                    })}

                    {currentPositionCandidates.length === 0 && (
                      <div className="col-span-full bg-slate-50 border border-slate-100 rounded-2xl p-10 text-center space-y-2">
                        <p className="text-slate-400 text-xs">No candidates registered for {currentPosition.name}.</p>
                        <p className="text-xs text-slate-400">You can safely skip this post to continue your ballot.</p>
                        <button
                          onClick={() => handleSkipPosition(currentPosition.id)}
                          className="mt-2 px-4 py-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 transition-all cursor-pointer"
                        >
                          Skip This Post
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Toast Selection Feedback */}
                  <AnimatePresence>
                    {selectionConfirmedText && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-950 text-white px-5 py-3 rounded-full shadow-2xl flex items-center gap-2 border border-slate-800 text-xs font-medium animate-none"
                        id="selection-toast"
                      >
                        <Sparkles className="h-4 w-4 text-amber-400 animate-spin" />
                        <span>{selectionConfirmedText}</span>
                        <span className="text-[10px] text-slate-400 bg-slate-900 px-2 py-0.5 rounded ml-2 uppercase font-mono tracking-wider">
                          🔊 Select Sound
                        </span>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Navigation Buttons */}
                  <div className="flex justify-between items-center bg-slate-50 rounded-2xl p-5 border border-slate-100">
                    <button
                      onClick={handlePrevPosition}
                      disabled={currentPositionIndex === 0}
                      className="px-4 py-2.5 bg-white border border-slate-200 text-slate-600 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Previous Post
                    </button>

                    <button
                      onClick={handleNextPosition}
                      disabled={currentSelectionId === undefined}
                      className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-extrabold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer shadow-md shadow-indigo-600/10"
                    >
                      {currentPositionIndex === positions.length - 1 ? 'Go to Review' : 'Next Post'}
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </motion.div>
              ) : (
                /* Success screen of submissions */
                <motion.div
                  key="vote-submitted"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-white rounded-2xl border border-slate-100 shadow-xl p-8 text-center space-y-6 max-w-lg mx-auto"
                  id="vote-success-screen"
                >
                  <div className="relative inline-flex items-center justify-center p-5 bg-emerald-50 rounded-full text-emerald-600 mx-auto animate-none" id="success-checkmark-outer">
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: [0, 1.2, 1] }}
                      transition={{ duration: 0.4, ease: 'easeOut' }}
                    >
                      <CheckCircle className="h-12 w-12" />
                    </motion.div>
                    <span className="absolute inset-0 rounded-full border-4 border-emerald-500/20 animate-ping"></span>
                  </div>

                  <div className="space-y-2">
                    <h4 className="text-xl font-extrabold text-slate-800 tracking-tight">✓ Complete Ballot Cast Successfully</h4>
                    <p className="text-base font-medium text-slate-600">🎉 Thank You For Voting</p>
                    <p className="text-xs text-indigo-600 bg-indigo-50 rounded-lg py-2 px-4 max-w-sm mx-auto font-medium mt-3">
                      🔊 Digital confirmation beep, success tone, and celebration effect played.
                    </p>
                  </div>

                  <div className="border-t border-slate-100 pt-6 space-y-4">
                    <div className="text-[11px] text-slate-400 bg-slate-50 rounded-xl p-4 text-left space-y-2.5 font-mono">
                      <p className="font-sans font-bold text-xs text-slate-600 border-b border-slate-200/50 pb-1.5">Official Voting Receipt</p>
                      <p>• Student Name: {session.name}</p>
                      <p>• Student ID: {session.id}</p>
                      <div className="space-y-1.5 pt-1">
                        <p className="font-sans font-semibold text-slate-500 text-[10px] uppercase">Ballot Selections:</p>
                        {positions.map((pos) => {
                          const selId = selectedCandidateIds[pos.id];
                          const selCandidate = candidates.find((c) => c.id === selId);
                          return (
                            <div key={pos.id} className="pl-2 border-l border-indigo-200 flex items-center gap-1.5 text-xs text-slate-700">
                              <span>- {pos.name}:</span>
                              {selCandidate ? (
                                <span className="font-bold text-indigo-700 flex items-center gap-1">
                                  <CandidateSymbol
                                    symbolUrl={selCandidate.symbolUrl}
                                    identitySymbolImageUrl={selCandidate.identitySymbolImageUrl}
                                    symbolURL={selCandidate.symbolURL}
                                    symbolText={selCandidate.symbol}
                                    className="h-3.5 w-3.5 object-contain shrink-0"
                                  />
                                  <span>{selCandidate.name}</span>
                                </span>
                              ) : (
                                <span className="text-rose-600 font-medium italic">Skipped</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      <p className="pt-1.5 border-t border-slate-200/50 text-[10px]">• Timestamp: {new Date().toLocaleString()}</p>
                    </div>

                    <button
                      onClick={handleLogout}
                      className="w-full mt-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                      id="finish-session-btn"
                    >
                      Complete & Log Out
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
