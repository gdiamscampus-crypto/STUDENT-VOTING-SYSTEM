/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import { jsPDF } from 'jspdf';
import { Student, Vote } from '../types';
import { 
  Printer, 
  Download, 
  Search, 
  QrCode, 
  Check, 
  Loader2, 
  SlidersHorizontal,
  FileText,
  Settings2,
  CheckSquare,
  Square,
  GraduationCap,
  ShieldCheck,
  AlertCircle,
  Eye,
  Sparkles,
  Award,
  Signature
} from 'lucide-react';
import { playSystemSound } from '../audio';

interface ElectionSlipsProps {
  students: Student[];
  votes: Vote[];
}

export default function ElectionSlips({ students, votes }: ElectionSlipsProps) {
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [gradeFilter, setGradeFilter] = useState('All');
  const [classFilter, setClassFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('All'); // 'All', 'Voted', 'Pending'

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Customization configurations
  const [schoolName, setSchoolName] = useState('SMART SCHOOL ELECTION SYSTEM');
  const [electionYear, setElectionYear] = useState('2026-2027');
  const [electionOfficer, setElectionOfficer] = useState('Chief Election Officer');
  const [portalUrl, setPortalUrl] = useState(window.location.origin || 'https://schoolvote.com/student/login');
  const [showQrCode, setShowQrCode] = useState(true);
  const [showSeal, setShowSeal] = useState(true);
  const [paperSize, setPaperSize] = useState<'A4' | 'A5' | 'A6'>('A4');

  // Interactive UI states
  const [activePreviewSlip, setActivePreviewSlip] = useState<Student | null>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [printPool, setPrintPool] = useState<Student[]>([]);

  // Get unique grades present in student list dynamically
  const availableGrades = useMemo(() => {
    const grades = new Set<string>();
    students.forEach(s => {
      if (s.grade) grades.add(s.grade);
    });
    return ['All', ...Array.from(grades).sort()];
  }, [students]);

  // Compute voting statuses
  const votedMap = useMemo(() => {
    const map = new Map<string, boolean>();
    students.forEach(s => {
      // Check both local Student object flag and dynamic votes list matching admissionId
      const voted = s.hasVoted || votes.some(v => v.studentId.trim().toUpperCase() === s.admissionId.trim().toUpperCase());
      map.set(s.admissionId, voted);
    });
    return map;
  }, [students, votes]);

  // Filter students
  const filteredStudents = useMemo(() => {
    return students.filter(student => {
      const q = searchQuery.toLowerCase().trim();
      const nameMatch = student.studentName.toLowerCase().includes(q);
      const idMatch = student.admissionId.toLowerCase().includes(q);
      const searchMatch = !q || nameMatch || idMatch;

      const gradeMatch = gradeFilter === 'All' || student.grade === gradeFilter;
      
      const cleanClassFilter = classFilter.toLowerCase().trim();
      const classMatch = !cleanClassFilter || student.grade.toLowerCase().includes(cleanClassFilter);

      const hasVoted = votedMap.get(student.admissionId) || false;
      const statusMatch = statusFilter === 'All' || 
                          (statusFilter === 'Voted' && hasVoted) || 
                          (statusFilter === 'Pending' && !hasVoted);

      return searchMatch && gradeMatch && classMatch && statusMatch;
    });
  }, [students, searchQuery, gradeFilter, classFilter, statusFilter, votedMap]);

  // Sync selection set on filter changes
  const allFilteredSelected = useMemo(() => {
    if (filteredStudents.length === 0) return false;
    return filteredStudents.every(s => selectedIds.has(s.admissionId));
  }, [filteredStudents, selectedIds]);

  const handleSelectAllToggle = () => {
    const next = new Set(selectedIds);
    if (allFilteredSelected) {
      filteredStudents.forEach(s => next.delete(s.admissionId));
    } else {
      filteredStudents.forEach(s => next.add(s.admissionId));
    }
    setSelectedIds(next);
    playSystemSound('select_sound');
  };

  const handleSelectToggle = (admissionId: string) => {
    const next = new Set(selectedIds);
    if (next.has(admissionId)) {
      next.delete(admissionId);
    } else {
      next.add(admissionId);
    }
    setSelectedIds(next);
    playSystemSound('select_sound');
  };

  const selectedStudentsList = useMemo(() => {
    return students.filter(s => selectedIds.has(s.admissionId));
  }, [students, selectedIds]);

  // Generate QR Code URL
  const getQrCodeUrl = (student: Student) => {
    const qrData = `Portal: ${portalUrl}\nID: ${student.admissionId}\nPass: ${student.passcode}`;
    return `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(qrData)}`;
  };

  // Helper to pre-fetch QR images as Base64 for PDF inserting
  const fetchBase64Image = async (url: string): Promise<string> => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });
    } catch (e) {
      console.warn("Could not fetch base64 QR Code. Proceeding with vector fallback in PDF:", e);
      return '';
    }
  };

  // Automated PDF generation engine using jsPDF
  const handleDownloadPDF = async (targetStudents: Student[]) => {
    if (targetStudents.length === 0) {
      alert("Please select at least one student to download their slips.");
      return;
    }

    setIsGeneratingPdf(true);
    playSystemSound('select_sound');

    try {
      // Create PDF instance
      // Paper configurations
      // A4 = [210, 297] mm
      // A5 = [148, 210] mm
      // A6 = [105, 148] mm
      const format = paperSize.toLowerCase() as 'a4' | 'a5' | 'a6';
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: format,
      });

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();

      // Slips layout mapping
      let cols = 1;
      let rows = 1;
      let cardWidth = pageWidth - 20;
      let cardHeight = pageHeight - 20;

      if (format === 'a4') {
        cols = 2;
        rows = 3;
        cardWidth = 90;
        cardHeight = 85;
      } else if (format === 'a5') {
        cols = 1;
        rows = 2;
        cardWidth = 128;
        cardHeight = 95;
      } else if (format === 'a6') {
        cols = 1;
        rows = 1;
        cardWidth = pageWidth - 10;
        cardHeight = pageHeight - 10;
      }

      const marginX = (pageWidth - (cols * cardWidth)) / 2;
      const marginY = (pageHeight - (rows * cardHeight)) / 2;

      for (let index = 0; index < targetStudents.length; index++) {
        const student = targetStudents[index];

        // Pagination indices
        const pageIdx = Math.floor(index / (cols * rows));
        const itemOnPageIdx = index % (cols * rows);
        const colIdx = itemOnPageIdx % cols;
        const rowIdx = Math.floor(itemOnPageIdx / cols);

        if (index > 0 && itemOnPageIdx === 0) {
          doc.addPage();
        }

        const x = marginX + colIdx * cardWidth;
        const y = marginY + rowIdx * cardHeight;

        // Card Border with light gray
        doc.setDrawColor(200, 200, 200);
        doc.setFillColor(255, 255, 255);
        doc.roundedRect(x + 1, y + 1, cardWidth - 2, cardHeight - 2, 3, 3, 'FD');

        // Top Border Decor Line (School Blue Accent)
        doc.setFillColor(79, 70, 229); // indigo-600
        doc.rect(x + 1, y + 1, cardWidth - 2, 3, 'F');

        // Header School Name
        doc.setTextColor(30, 41, 59); // slate-800
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(cardWidth > 100 ? 9 : 7);
        doc.text(schoolName.toUpperCase(), x + (cardWidth / 2), y + 9, { align: 'center' });

        // Document Title
        doc.setTextColor(79, 70, 229); // indigo-600
        doc.setFontSize(cardWidth > 100 ? 11 : 9);
        doc.text("Election Login Slip", x + (cardWidth / 2), y + 14, { align: 'center' });

        // Horizontal Separator
        doc.setDrawColor(241, 245, 249);
        doc.line(x + 5, y + 17, x + cardWidth - 5, y + 17);

        // Student Info Block
        doc.setTextColor(100, 116, 139); // slate-500
        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(cardWidth > 100 ? 8 : 7);

        const textStartY = y + 22;
        const lineSpacing = 4.5;

        doc.text("Student Name:", x + 6, textStartY);
        doc.text("Admission ID:", x + 6, textStartY + lineSpacing);
        doc.text("Grade / Class:", x + 6, textStartY + (lineSpacing * 2));
        doc.text("Election Year:", x + 6, textStartY + (lineSpacing * 3));

        // Info Values
        doc.setTextColor(15, 23, 42); // slate-900
        doc.setFont('Helvetica', 'bold');
        doc.text(student.studentName, x + 30, textStartY);
        doc.text(student.admissionId, x + 30, textStartY + lineSpacing);
        doc.text(student.grade, x + 30, textStartY + (lineSpacing * 2));
        doc.text(electionYear, x + 30, textStartY + (lineSpacing * 3));

        // Grey Credentials Box
        const credBoxY = textStartY + (lineSpacing * 3.5);
        const credBoxH = cardHeight > 90 ? 16 : 14;
        doc.setFillColor(248, 250, 252); // slate-50
        doc.setDrawColor(226, 232, 240); // slate-200
        doc.roundedRect(x + 5, credBoxY, cardWidth - 10, credBoxH, 1.5, 1.5, 'FD');

        // Credentials text
        doc.setTextColor(71, 85, 105); // slate-600
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(7);
        doc.text("VOTER PORTAL SECURE CREDENTIALS", x + (cardWidth / 2), credBoxY + 4.5, { align: 'center' });

        doc.setFont('Courier', 'bold');
        doc.setFontSize(cardWidth > 100 ? 10 : 8.5);
        doc.setTextColor(220, 38, 38); // rose-600
        doc.text(`ID: ${student.admissionId}   Passcode: ${student.passcode}`, x + (cardWidth / 2), credBoxY + (credBoxH / 2) + 3, { align: 'center' });

        // Instructions List
        const instStartY = credBoxY + credBoxH + 4;
        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(cardWidth > 100 ? 6.5 : 5.5);
        doc.setTextColor(100, 116, 139); // slate-500

        const insts = [
          "• Keep this secure passcode confidential.",
          "• Log in to cast your ballot once only.",
          "• Report any issues to the Officer."
        ];

        insts.forEach((inst, i) => {
          doc.text(inst, x + 6, instStartY + (i * 3));
        });

        // Add QR Code if enabled
        if (showQrCode) {
          const qrUrl = getQrCodeUrl(student);
          const qrBase64 = await fetchBase64Image(qrUrl);
          if (qrBase64) {
            const qrSize = cardHeight > 90 ? 15 : 12;
            const qrX = x + cardWidth - qrSize - 6;
            const qrY = y + 19;
            doc.addImage(qrBase64, 'PNG', qrX, qrY, qrSize, qrSize);
          }
        }

        // Add School Seal / Signature Lines at bottom
        const footerY = y + cardHeight - 8;
        doc.setDrawColor(241, 245, 249);
        doc.line(x + 5, footerY - 2, x + cardWidth - 5, footerY - 2);

        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(5.5);
        doc.setTextColor(148, 163, 184); // slate-400

        if (showSeal) {
          doc.text("OFFICIAL SEAL", x + 10, footerY);
          doc.text("VALID FOR ELECTION", x + 10, footerY + 2.5);
        }

        doc.text("SIGNATURE", x + cardWidth - 30, footerY);
        doc.text(electionOfficer, x + cardWidth - 30, footerY + 2.5);
      }

      // Save PDF document
      doc.save(`Election_Slips_${targetStudents.length}_Students.pdf`);
      playSystemSound('winner_sound');
    } catch (error) {
      console.error("PDF generation failed:", error);
      alert("Failed to download PDF slips. Please ensure you are connected to the network to pull QR configurations.");
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // Handle standard browser print view trigger
  const handlePrintSlips = (targetStudents: Student[]) => {
    if (targetStudents.length === 0) {
      alert("Please select student slips to print.");
      return;
    }

    setPrintPool(targetStudents);
    setIsPrinting(true);
    playSystemSound('select_sound');

    // Timeout triggers window.print after React renders the printable frame
    setTimeout(() => {
      window.print();
      setIsPrinting(false);
    }, 500);
  };

  return (
    <div className="space-y-6">
      
      {/* HEADER HERO AREA */}
      <div className="border-b border-slate-100 pb-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-lg font-black text-slate-800 tracking-tight flex items-center gap-2">
            <Printer className="h-5 w-5 text-indigo-600" />
            Voter Login Slips & Credentials Generator
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Generate, customize, and print official voting slips containing students' confidential passcodes.
          </p>
        </div>
        
        {/* ACTION BUTTONS */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => handlePrintSlips(selectedStudentsList)}
            disabled={selectedIds.size === 0}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              selectedIds.size > 0 
                ? 'bg-slate-900 text-white hover:bg-slate-800' 
                : 'bg-slate-100 text-slate-400 cursor-not-allowed'
            }`}
          >
            <Printer className="h-4 w-4" />
            <span>Print Selected ({selectedIds.size})</span>
          </button>

          <button
            onClick={() => handleDownloadPDF(selectedStudentsList)}
            disabled={selectedIds.size === 0 || isGeneratingPdf}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border ${
              selectedIds.size > 0 
                ? 'border-indigo-200 text-indigo-700 bg-indigo-50/50 hover:bg-indigo-50' 
                : 'border-slate-100 text-slate-400 bg-slate-50 cursor-not-allowed'
            }`}
          >
            {isGeneratingPdf ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Generating PDF...</span>
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                <span>Download PDF ({selectedIds.size})</span>
              </>
            )}
          </button>

          <button
            onClick={() => handlePrintSlips(filteredStudents)}
            className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm hover:shadow-indigo-500/10"
          >
            <Printer className="h-4 w-4" />
            <span>Print All Filtered ({filteredStudents.length})</span>
          </button>

          <button
            onClick={() => handleDownloadPDF(filteredStudents)}
            disabled={isGeneratingPdf}
            className="px-3.5 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
          >
            {isGeneratingPdf ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            <span>Bulk Download All Slips ({filteredStudents.length})</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* LEFT COLUMN: FILTERS AND SETTINGS */}
        <div className="space-y-6 lg:col-span-1">
          
          {/* SEARCH & FILTER MODULE */}
          <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm space-y-4">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2 pb-2 border-b border-slate-50">
              <SlidersHorizontal className="h-4 w-4 text-indigo-500" />
              Slip Search & Filtering
            </h3>

            <div className="space-y-3.5 text-xs">
              {/* Name / ID Search */}
              <div className="space-y-1.5">
                <label className="font-bold text-slate-600 flex items-center gap-1">
                  <Search className="h-3.5 w-3.5" /> Search Student
                </label>
                <input
                  type="text"
                  placeholder="Admission ID or Student Name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-xs transition-all placeholder:text-slate-400 text-slate-800"
                />
              </div>

              {/* Grade Filter */}
              <div className="space-y-1.5">
                <label className="font-bold text-slate-600">Grade / Standard</label>
                <select
                  value={gradeFilter}
                  onChange={(e) => setGradeFilter(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-xs text-slate-800 transition-all"
                >
                  {availableGrades.map(g => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>

              {/* Division / Class Custom Search */}
              <div className="space-y-1.5">
                <label className="font-bold text-slate-600">Class / Division Search</label>
                <input
                  type="text"
                  placeholder="e.g. Division A, 10-A, or A"
                  value={classFilter}
                  onChange={(e) => setClassFilter(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-xs transition-all placeholder:text-slate-400 text-slate-800"
                />
              </div>

              {/* Voting Status Filter */}
              <div className="space-y-1.5">
                <label className="font-bold text-slate-600">Voting Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-xs text-slate-800 transition-all"
                >
                  <option value="All">All Students</option>
                  <option value="Pending">Pending (Not Voted)</option>
                  <option value="Voted">Completed (Voted)</option>
                </select>
              </div>
            </div>
          </div>

          {/* CUSTOMIZATION AND PRINT SETTINGS */}
          <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm space-y-4">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2 pb-2 border-b border-slate-50">
              <Settings2 className="h-4 w-4 text-indigo-500" />
              Customize Slip Design
            </h3>

            <div className="space-y-3.5 text-xs">
              <div className="space-y-1.5">
                <label className="font-bold text-slate-600">School Name Header</label>
                <input
                  type="text"
                  value={schoolName}
                  onChange={(e) => setSchoolName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-xs text-slate-800"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-slate-600">Election Year</label>
                <input
                  type="text"
                  value={electionYear}
                  onChange={(e) => setElectionYear(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-xs text-slate-800"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-slate-600">Election Officer Title</label>
                <input
                  type="text"
                  value={electionOfficer}
                  onChange={(e) => setElectionOfficer(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-xs text-slate-800"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-slate-600">Voting Portal URL</label>
                <input
                  type="url"
                  value={portalUrl}
                  onChange={(e) => setPortalUrl(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-xs text-slate-800 font-mono"
                />
              </div>

              <div className="space-y-2 pt-1 border-t border-slate-50">
                <label className="font-bold text-slate-600 block">Print Settings</label>
                
                <div className="flex items-center justify-between py-1">
                  <span className="text-slate-500 text-[11px]">Paper Template Size</span>
                  <select
                    value={paperSize}
                    onChange={(e) => setPaperSize(e.target.value as any)}
                    className="px-2 py-1 rounded-lg border border-slate-200 text-[11px] text-slate-700 bg-white"
                  >
                    <option value="A4">A4 (Grid layout)</option>
                    <option value="A5">A5 (Half-page)</option>
                    <option value="A6">A6 (Single slip)</option>
                  </select>
                </div>

                <div className="flex items-center justify-between py-1">
                  <span className="text-slate-500 text-[11px]">Generate QR Codes</span>
                  <input
                    type="checkbox"
                    checked={showQrCode}
                    onChange={(e) => setShowQrCode(e.target.checked)}
                    className="h-4 w-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                  />
                </div>

                <div className="flex items-center justify-between py-1">
                  <span className="text-slate-500 text-[11px]">Show Official Seal Mark</span>
                  <input
                    type="checkbox"
                    checked={showSeal}
                    onChange={(e) => setShowSeal(e.target.checked)}
                    className="h-4 w-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* MIDDLE/RIGHT COLUMN: STUDENT CREDENTIALS TABLE */}
        <div className="space-y-6 lg:col-span-2">
          
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col min-h-[500px]">
            
            {/* Table Header Controls */}
            <div className="p-4 bg-slate-50 border-b border-slate-100 flex flex-wrap justify-between items-center gap-3">
              <div className="flex items-center gap-2">
                <button
                  onClick={handleSelectAllToggle}
                  className="p-1 text-slate-500 hover:text-indigo-600 rounded transition-colors"
                  title="Toggle Select All Filtered"
                >
                  {allFilteredSelected ? (
                    <CheckSquare className="h-5 w-5 text-indigo-600" />
                  ) : (
                    <Square className="h-5 w-5" />
                  )}
                </button>
                <span className="text-xs font-bold text-slate-700">
                  {selectedIds.size} selected of {filteredStudents.length} students filtered
                </span>
              </div>

              {selectedIds.size > 0 && (
                <button
                  onClick={() => {
                    setSelectedIds(new Set());
                    playSystemSound('select_sound');
                  }}
                  className="px-2 py-1 text-[10px] font-bold text-rose-600 bg-rose-50 border border-rose-100 rounded-lg hover:bg-rose-100 transition-colors cursor-pointer"
                >
                  Deselect All
                </button>
              )}
            </div>

            {/* Students List Table */}
            <div className="flex-1 overflow-y-auto max-h-[480px]">
              {filteredStudents.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center space-y-2">
                  <GraduationCap className="h-10 w-10 text-slate-300" />
                  <p className="text-xs font-bold text-slate-500">No student accounts match search criteria.</p>
                  <p className="text-[10px] text-slate-400">Clear filters or import student register database first.</p>
                </div>
              ) : (
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-100 text-[10px] uppercase tracking-wider">
                      <th className="py-2.5 px-4 w-10">Select</th>
                      <th className="py-2.5 px-3">Student Profile</th>
                      <th className="py-2.5 px-3">Credentials</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredStudents.map((student) => {
                      const isSelected = selectedIds.has(student.admissionId);
                      const hasVoted = votedMap.get(student.admissionId) || false;

                      return (
                        <tr 
                          key={student.admissionId}
                          className={`hover:bg-slate-50/50 transition-colors ${
                            isSelected ? 'bg-indigo-50/15' : ''
                          }`}
                        >
                          {/* Checkbox Column */}
                          <td className="py-3 px-4">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleSelectToggle(student.admissionId)}
                              className="h-4 w-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
                            />
                          </td>

                          {/* Student Info Column */}
                          <td className="py-3 px-3">
                            <div className="space-y-0.5">
                              <span className="font-bold text-slate-800 block">{student.studentName}</span>
                              <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                                <span className="font-mono bg-slate-100 px-1 py-0.2 rounded text-[9px] border border-slate-200">
                                  {student.admissionId}
                                </span>
                                <span>•</span>
                                <span className="font-semibold text-indigo-700 uppercase bg-indigo-50/50 px-1 py-0.2 rounded text-[9px]">
                                  {student.grade}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* Credentials Column */}
                          <td className="py-3 px-3">
                            <div className="font-mono text-[10px] space-y-0.5">
                              <p className="text-slate-500">
                                User: <strong className="text-slate-700">{student.admissionId}</strong>
                              </p>
                              <p className="text-slate-500">
                                Pass: <strong className="text-rose-600 bg-rose-50 border border-rose-100 px-1.5 py-0.2 rounded text-[9px] font-bold">{student.passcode}</strong>
                              </p>
                            </div>
                          </td>

                          {/* voting Status Column */}
                          <td className="py-3 px-3">
                            {hasVoted ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full">
                                <Check className="h-3 w-3" />
                                Voted
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-400 bg-slate-100 px-2.5 py-0.5 rounded-full">
                                Pending
                              </span>
                            )}
                          </td>

                          {/* Quick Actions Column */}
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => setActivePreviewSlip(student)}
                                className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                                title="Preview Design Card"
                              >
                                <Eye className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handlePrintSlips([student])}
                                className="p-1.5 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                                title="Print Slip"
                              >
                                <Printer className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleDownloadPDF([student])}
                                className="p-1.5 text-slate-400 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                                title="Download PDF"
                              >
                                <Download className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* INDIVIDUAL MODAL PREVIEW SLIP */}
      {activePreviewSlip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4" id="slip-preview-modal">
          <div className="bg-white rounded-3xl max-w-sm w-full border border-slate-100 shadow-2xl overflow-hidden flex flex-col">
            
            {/* Modal Header */}
            <div className="p-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
              <span className="text-xs font-bold text-slate-800">Election Slip Preview</span>
              <button 
                onClick={() => {
                  setActivePreviewSlip(null);
                  playSystemSound('select_sound');
                }}
                className="p-1 hover:bg-slate-200 rounded-full transition-colors cursor-pointer text-slate-500 text-xs font-bold"
              >
                ✕
              </button>
            </div>

            {/* Card Content styled as a high fidelity physical slip */}
            <div className="p-6 flex-1 flex flex-col items-center">
              
              {/* Slip Card */}
              <div className="w-full bg-white border border-slate-200 rounded-2xl shadow-md p-5 relative overflow-hidden space-y-4">
                {/* Border line */}
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-indigo-600"></div>

                {/* Header */}
                <div className="text-center space-y-1">
                  <div className="flex justify-center items-center gap-1">
                    <span className="text-lg">🏫</span>
                    <span className="text-[10px] font-black text-slate-800 tracking-tight uppercase leading-none">
                      {schoolName}
                    </span>
                  </div>
                  <h4 className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none mt-1">
                    SMART SCHOOL ELECTION SYSTEM
                  </h4>
                  <div className="inline-block bg-indigo-50 border border-indigo-100/50 text-indigo-700 text-[10px] font-extrabold px-2 py-0.5 rounded-full mt-1">
                    Election Login Slip
                  </div>
                </div>

                <div className="border-t border-slate-100 my-2"></div>

                {/* Slip Grid Details */}
                <div className="grid grid-cols-3 gap-y-2 text-[10px]">
                  <span className="text-slate-400 font-medium">Student Name</span>
                  <span className="col-span-2 text-slate-800 font-bold text-right">{activePreviewSlip.studentName}</span>

                  <span className="text-slate-400 font-medium">Admission ID</span>
                  <span className="col-span-2 text-slate-800 font-bold font-mono text-right">{activePreviewSlip.admissionId}</span>

                  <span className="text-slate-400 font-medium">Grade / Class</span>
                  <span className="col-span-2 text-slate-800 font-bold text-right">{activePreviewSlip.grade}</span>

                  <span className="text-slate-400 font-medium">Election Year</span>
                  <span className="col-span-2 text-slate-800 font-bold text-right">{electionYear}</span>
                </div>

                {/* Credentials Container */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center space-y-1.5">
                  <span className="text-[8px] font-black text-slate-500 uppercase tracking-wider block">
                    Secure Portal Login Credentials
                  </span>
                  <div className="font-mono text-xs flex justify-around items-center bg-white border border-slate-100 py-1.5 rounded-lg">
                    <div className="space-y-0.5">
                      <span className="text-[8px] text-slate-400 block">ADMISSION ID</span>
                      <strong className="text-slate-700 text-[11px]">{activePreviewSlip.admissionId}</strong>
                    </div>
                    <div className="h-6 w-[1px] bg-slate-100"></div>
                    <div className="space-y-0.5">
                      <span className="text-[8px] text-slate-400 block">PASSCODE</span>
                      <strong className="text-rose-600 text-[11px]">{activePreviewSlip.passcode}</strong>
                    </div>
                  </div>
                </div>

                {/* Instructions */}
                <div className="space-y-1 text-[8px] text-slate-400 leading-normal">
                  <p className="flex gap-1.5"><span className="text-slate-300">•</span> Keep this slip and passcode confidential.</p>
                  <p className="flex gap-1.5"><span className="text-slate-300">•</span> Log in to the portal and cast your ballot once only.</p>
                  <p className="flex gap-1.5"><span className="text-slate-300">•</span> Do not share your passcode with any other voter.</p>
                  <p className="flex gap-1.5"><span className="text-slate-300">•</span> Contact the Election Officer if you lose this slip.</p>
                </div>

                {/* Optional QR Code */}
                {showQrCode && (
                  <div className="flex items-center justify-center pt-1 gap-2 border-t border-slate-50">
                    <div className="h-14 w-14 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-center overflow-hidden">
                      <img 
                        src={getQrCodeUrl(activePreviewSlip)} 
                        alt="Slip Portal QR" 
                        className="h-12 w-12 object-contain"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                    <div className="text-[7px] text-slate-400 leading-normal max-w-[150px]">
                      <p className="font-bold text-slate-600">Scan to Vote</p>
                      <p>Points directly to the secure electronic polling portal. Scan with your tablet or phone camera.</p>
                    </div>
                  </div>
                )}

                {/* Footer seal or officer */}
                <div className="border-t border-slate-100 pt-2 flex justify-between items-center text-[7px] text-slate-400">
                  {showSeal ? (
                    <div className="space-y-0.5">
                      <p className="font-bold text-indigo-700">OFFICIAL SEAL</p>
                      <p>VALIDATED SLIP</p>
                    </div>
                  ) : <div />}
                  <div className="text-right space-y-0.5">
                    <p className="font-bold text-slate-700 flex items-center justify-end gap-0.5">
                      <Signature className="h-2 w-2 text-slate-400" />
                      SIGNATURE
                    </p>
                    <p className="font-medium text-slate-500">{electionOfficer}</p>
                  </div>
                </div>

              </div>

            </div>

            {/* Modal Actions */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex gap-2">
              <button
                onClick={() => handlePrintSlips([activePreviewSlip])}
                className="flex-1 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Printer className="h-4 w-4" />
                Print Slip
              </button>
              <button
                onClick={() => handleDownloadPDF([activePreviewSlip])}
                className="flex-1 py-2 border border-slate-200 hover:bg-slate-100 text-slate-700 bg-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Download className="h-4 w-4" />
                Download PDF
              </button>
            </div>

          </div>
        </div>
      )}

      {/* HIDDEN INLINE PRINT UTILITY BLOCK */}
      {/* This renders only when printing is triggered (window.print()) */}
      {isPrinting && (
        <div id="print-section" className="hidden print:block absolute inset-0 bg-white text-black p-0 m-0 z-[999999]">
          
          {/* Sizing wrapper based on paper templates */}
          <div className={`grid gap-4 ${
            paperSize === 'A4' ? 'grid-cols-2 p-4' : 'grid-cols-1 p-2'
          }`}>
            {printPool.map((student, idx) => (
              <div 
                key={student.admissionId} 
                className={`border border-gray-400 rounded-xl p-5 bg-white flex flex-col relative overflow-hidden space-y-3 page-break-inside-avoid ${
                  paperSize === 'A6' ? 'h-[140mm] w-[100mm]' : 'h-[85mm]'
                }`}
                style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}
              >
                {/* Accent strip */}
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-indigo-600"></div>

                {/* Header */}
                <div className="text-center space-y-0.5">
                  <h3 className="text-xs font-extrabold text-slate-900 tracking-tight uppercase leading-none">
                    🏫 {schoolName}
                  </h3>
                  <p className="text-[8px] font-bold text-slate-500 uppercase tracking-widest leading-none mt-1">
                    SMART SCHOOL ELECTION SYSTEM
                  </p>
                  <p className="text-[10px] font-black text-indigo-700 bg-indigo-50 border border-indigo-100 inline-block px-2.5 py-0.5 rounded-full mt-1.5">
                    Election Login Slip
                  </p>
                </div>

                <hr className="border-slate-100 my-1" />

                {/* Details Grid */}
                <div className="grid grid-cols-3 gap-y-1 text-[10px]">
                  <span className="text-slate-500">Student Name:</span>
                  <strong className="col-span-2 text-slate-900 text-right">{student.studentName}</strong>

                  <span className="text-slate-500">Admission ID:</span>
                  <strong className="col-span-2 text-slate-900 font-mono text-right">{student.admissionId}</strong>

                  <span className="text-slate-500">Grade / Class:</span>
                  <strong className="col-span-2 text-slate-900 text-right">{student.grade}</strong>

                  <span className="text-slate-500">Election Year:</span>
                  <strong className="col-span-2 text-slate-900 text-right">{electionYear}</strong>
                </div>

                {/* Credentials block */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-center">
                  <span className="text-[8px] font-black text-slate-500 uppercase tracking-wider block mb-1">
                    VOTER PORTAL SECURE CREDENTIALS
                  </span>
                  <div className="font-mono text-xs flex justify-around items-center bg-white border border-slate-100 py-1 rounded-lg">
                    <div className="space-y-0.5">
                      <span className="text-[8px] text-slate-400 block">ADMISSION ID</span>
                      <strong className="text-slate-800 text-[11px]">{student.admissionId}</strong>
                    </div>
                    <div className="h-5 w-[1px] bg-slate-100"></div>
                    <div className="space-y-0.5">
                      <span className="text-[8px] text-slate-400 block">PASSCODE</span>
                      <strong className="text-rose-600 text-[11px]">{student.passcode}</strong>
                    </div>
                  </div>
                </div>

                {/* Instructions */}
                <div className="space-y-0.5 text-[8px] text-slate-500 leading-normal">
                  <p>• Keep this slip confidential.</p>
                  <p>• Use the Admission ID and Passcode to log in.</p>
                  <p>• One student can vote only once.</p>
                  <p>• Do not share your passcode.</p>
                  <p>• Contact the Election Officer if you lose this slip.</p>
                </div>

                {/* QR code and Seal / Sig lines */}
                <div className="flex justify-between items-center pt-2 border-t border-slate-100 text-[8px] text-slate-500">
                  {showQrCode ? (
                    <div className="flex items-center gap-1.5">
                      <img 
                        src={getQrCodeUrl(student)} 
                        alt="QR Code" 
                        className="h-10 w-10 border border-slate-200 rounded p-0.5" 
                        referrerPolicy="no-referrer"
                      />
                      <span className="text-[7px] text-slate-400 leading-tight">Scan with camera<br />to login directly</span>
                    </div>
                  ) : <div />}

                  <div className="flex gap-4">
                    {showSeal && (
                      <div className="text-center">
                        <div className="h-5 w-5 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-full flex items-center justify-center font-bold text-[7px] mx-auto">
                          SEAL
                        </div>
                        <span className="text-[6px] text-indigo-600 block mt-0.5 font-bold uppercase">Validated</span>
                      </div>
                    )}
                    <div className="text-right">
                      <div className="h-5 border-b border-dashed border-slate-300 w-16 ml-auto"></div>
                      <span className="text-[6px] font-bold text-slate-400 block uppercase mt-0.5">Election Officer</span>
                    </div>
                  </div>
                </div>

              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
