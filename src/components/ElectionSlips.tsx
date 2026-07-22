/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { jsPDF } from 'jspdf';
import { Student, Vote } from '../types';
import { 
  Printer, 
  Search, 
  CheckSquare, 
  Square, 
  ChevronLeft, 
  ChevronRight, 
  FileText,
  Filter,
  Check,
  X,
  Download,
  Eye,
  EyeOff,
  LayoutGrid,
  List,
  Info,
  HelpCircle
} from 'lucide-react';
import { playSystemSound } from '../audio';

interface ElectionSlipsProps {
  students: Student[];
  votes: Vote[];
}

interface SingleElectionSlipProps {
  student: Student;
  onPrint?: () => void;
  onDownloadPDF?: () => void;
  isSelected?: boolean;
  onSelectToggle?: () => void;
  key?: React.Key;
}

/**
 * Normalizes grade and division strings consistently
 */
function useNormalizedGrade(gradeString: string) {
  return useMemo(() => {
    const rawGrade = gradeString || '';
    if (rawGrade.includes('-')) {
      const parts = rawGrade.split('-');
      return {
        gradeText: parts[0].trim(),
        divisionText: parts[1].trim(),
      };
    }
    const match = rawGrade.match(/^(Grade\s+\d+|\d+)\s+([A-D])$/i);
    if (match) {
      return {
        gradeText: match[1].trim(),
        divisionText: match[2].trim(),
      };
    }
    return {
      gradeText: rawGrade,
      divisionText: 'A',
    };
  }, [gradeString]);
}

/**
 * Renders a clean, beautifully designed simple white card with a blue header
 * for on-screen visualization. Designed exactly according to administrative specs.
 */
function SingleElectionSlip({ student, onPrint, onDownloadPDF, isSelected, onSelectToggle }: SingleElectionSlipProps) {
  const { gradeText, divisionText } = useNormalizedGrade(student.grade);

  return (
    <div className="relative bg-white rounded-xl shadow-md border border-slate-200 overflow-hidden text-slate-800 flex flex-col justify-between max-w-md mx-auto w-full group transition-all duration-300 hover:shadow-lg hover:border-blue-200">
      {/* Selection Checkbox (Top Left) */}
      {onSelectToggle && (
         <button
           onClick={(e) => {
             e.stopPropagation();
             onSelectToggle();
           }}
           className="absolute top-3.5 left-3.5 z-10 p-1 bg-white/95 backdrop-blur-sm rounded-lg shadow-sm border border-slate-200 text-slate-600 hover:text-blue-600 hover:border-blue-300 transition-all active:scale-95 cursor-pointer"
           title={isSelected ? "Deselect" : "Select for bulk action"}
         >
           {isSelected ? (
             <CheckSquare className="h-5 w-5 text-blue-600" />
           ) : (
             <Square className="h-5 w-5 text-slate-400" />
           )}
         </button>
      )}

      {/* Quick Action Buttons (Top Right) */}
      <div className="absolute top-3.5 right-3.5 z-10 flex gap-1.5">
        {onPrint && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onPrint();
            }}
            className="p-1.5 bg-white/95 backdrop-blur-sm rounded-lg shadow-sm border border-slate-200 text-slate-600 hover:text-blue-600 hover:border-blue-300 transition-all active:scale-95 hover:scale-105 cursor-pointer"
            title="Print slip"
          >
            <Printer className="h-4 w-4" />
          </button>
        )}
        {onDownloadPDF && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDownloadPDF();
            }}
            className="p-1.5 bg-white/95 backdrop-blur-sm rounded-lg shadow-sm border border-slate-200 text-slate-600 hover:text-blue-600 hover:border-blue-300 transition-all active:scale-95 hover:scale-105 cursor-pointer"
            title="Download PDF"
          >
            <Download className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Slip Header: Solid Blue */}
      <div className="bg-blue-600 text-white p-5 text-center">
        {/* Mock Simple Logo Crest */}
        <div className="mx-auto h-7 w-7 bg-white/10 rounded-full flex items-center justify-center mb-1.5 border border-white/20">
          <FileText className="h-4 w-4 text-white" />
        </div>
        <h3 className="text-xs font-black tracking-wider uppercase">Smart School Election System</h3>
        <p className="text-[10px] font-bold tracking-widest text-blue-100 mt-0.5 uppercase">Election Login Slip</p>
      </div>

      {/* Dash line separator resembling thermal paper slips */}
      <div className="border-t border-dashed border-slate-200 w-full" />

      {/* Slip Information Fields */}
      <div className="p-5 space-y-4">
        {/* Core Student metadata */}
        <div className="space-y-2 text-xs leading-relaxed text-slate-600">
          <div className="flex justify-between items-center py-0.5 border-b border-slate-50">
            <span className="font-bold text-slate-400 uppercase tracking-wider text-[9px]">Student Name</span>
            <span className="font-bold text-slate-950 text-sm truncate max-w-[200px]">{student.studentName}</span>
          </div>
          <div className="flex justify-between items-center py-0.5 border-b border-slate-50">
            <span className="font-bold text-slate-400 uppercase tracking-wider text-[9px]">Admission ID</span>
            <span className="font-semibold text-slate-800 text-sm">{student.admissionId}</span>
          </div>
          <div className="flex justify-between items-center py-0.5 border-b border-slate-50">
            <span className="font-bold text-slate-400 uppercase tracking-wider text-[9px]">Grade</span>
            <span className="font-semibold text-slate-800 text-sm">{gradeText}</span>
          </div>
          <div className="flex justify-between items-center py-0.5 border-b border-slate-50">
            <span className="font-bold text-slate-400 uppercase tracking-wider text-[9px]">Division</span>
            <span className="font-semibold text-slate-800 text-sm">{divisionText}</span>
          </div>
          <div className="flex justify-between items-center py-0.5">
            <span className="font-bold text-slate-400 uppercase tracking-wider text-[9px]">Election Year</span>
            <span className="font-semibold text-slate-800 text-sm">2026</span>
          </div>
        </div>

        {/* Credentials separator line */}
        <div className="relative py-1 flex items-center justify-center">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-dashed border-slate-200"></div>
          </div>
          <span className="relative px-3 bg-white text-[9px] font-black uppercase tracking-widest text-slate-400">LOGIN CREDENTIALS</span>
        </div>

        {/* Credentials details box */}
        <div className="bg-slate-50/80 p-4 rounded-xl border border-slate-100 space-y-2.5">
          <div className="flex justify-between items-center text-xs">
            <span className="font-bold text-slate-500 uppercase tracking-wider text-[9px]">Admission ID:</span>
            <span className="font-mono font-bold text-slate-900 bg-white px-2.5 py-1 rounded-md border border-slate-200 shadow-sm">{student.admissionId}</span>
          </div>
          <div className="flex justify-between items-center text-xs">
            <span className="font-bold text-slate-500 uppercase tracking-wider text-[9px]">Passcode:</span>
            <span className="font-mono font-black text-blue-600 bg-white px-2.5 py-1 rounded-md border border-blue-200 shadow-sm tracking-wider">{student.passcode}</span>
          </div>
        </div>

        {/* Instructions separator line */}
        <div className="relative py-1 flex items-center justify-center">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-dashed border-slate-200"></div>
          </div>
          <span className="relative px-3 bg-white text-[9px] font-black uppercase tracking-widest text-slate-400">IMPORTANT</span>
        </div>

        {/* Important notices */}
        <ul className="text-[11px] text-slate-500 space-y-1.5 bg-blue-50/20 p-4 rounded-xl border border-blue-100/30">
          <li className="flex items-start gap-1.5 leading-relaxed">
            <span className="text-blue-500 font-bold text-xs shrink-0 mt-[-2px]">•</span>
            <span>Keep this Election Slip confidential.</span>
          </li>
          <li className="flex items-start gap-1.5 leading-relaxed">
            <span className="text-blue-500 font-bold text-xs shrink-0 mt-[-2px]">•</span>
            <span>Do not share your Admission ID or Passcode.</span>
          </li>
          <li className="flex items-start gap-1.5 leading-relaxed">
            <span className="text-blue-500 font-bold text-xs shrink-0 mt-[-2px]">•</span>
            <span>One student can vote only once.</span>
          </li>
          <li className="flex items-start gap-1.5 leading-relaxed">
            <span className="text-blue-500 font-bold text-xs shrink-0 mt-[-2px]">•</span>
            <span>Contact the Election Administrator if you need assistance.</span>
          </li>
        </ul>
      </div>

      {/* Slip Footer Divider */}
      <div className="border-t border-dashed border-slate-200 w-full" />
    </div>
  );
}

/**
 * High-contrast layout component optimized for standard browser printing.
 * Keeps shadows out, and uses strict browser styles.
 */
interface PrintSlipProps {
  student: Student;
  key?: React.Key;
}

function PrintSlip({ student }: PrintSlipProps) {
  const { gradeText, divisionText } = useNormalizedGrade(student.grade);

  return (
    <div className="print-slip-card break-inside-avoid">
      <div className="print-blue-header">
        <div className="text-sm font-extrabold tracking-wider">SMART SCHOOL ELECTION SYSTEM</div>
        <div className="text-[10px] font-semibold tracking-widest mt-0.5 opacity-90">ELECTION LOGIN SLIP</div>
      </div>

      <div className="my-3 border-t border-dashed border-slate-400" />

      {/* Info fields */}
      <div className="space-y-1.5 text-xs text-slate-800">
        <div className="flex justify-between py-0.5 border-b border-slate-100">
          <span className="font-bold text-slate-500">Student Name:</span>
          <span className="font-bold text-slate-900">{student.studentName}</span>
        </div>
        <div className="flex justify-between py-0.5 border-b border-slate-100">
          <span className="font-bold text-slate-500">Admission ID:</span>
          <span className="font-medium text-slate-800">{student.admissionId}</span>
        </div>
        <div className="flex justify-between py-0.5 border-b border-slate-100">
          <span className="font-bold text-slate-500">Grade:</span>
          <span className="font-medium text-slate-800">{gradeText}</span>
        </div>
        <div className="flex justify-between py-0.5 border-b border-slate-100">
          <span className="font-bold text-slate-500">Division:</span>
          <span className="font-medium text-slate-800">{divisionText}</span>
        </div>
        <div className="flex justify-between py-0.5">
          <span className="font-bold text-slate-500">Election Year:</span>
          <span className="font-medium text-slate-800">2026</span>
        </div>
      </div>

      <div className="my-3 border-t border-dashed border-slate-400" />

      {/* Credentials */}
      <div className="text-center font-bold text-[9px] text-slate-400 tracking-widest mb-1.5 uppercase">LOGIN CREDENTIALS</div>
      <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1.5 text-xs">
        <div className="flex justify-between">
          <span className="font-bold text-slate-500">Admission ID:</span>
          <span className="font-mono font-bold text-slate-950">{student.admissionId}</span>
        </div>
        <div className="flex justify-between">
          <span className="font-bold text-slate-500">Passcode:</span>
          <span className="font-mono font-extrabold text-blue-700">{student.passcode}</span>
        </div>
      </div>

      <div className="my-3 border-t border-dashed border-slate-400" />

      {/* Rules Notice */}
      <div className="text-xs text-slate-700">
        <div className="font-bold text-[9px] text-slate-400 tracking-widest uppercase mb-1">IMPORTANT</div>
        <ul className="list-disc pl-4 space-y-1 text-slate-600">
          <li>Keep this Election Slip confidential.</li>
          <li>Do not share your Admission ID or Passcode.</li>
          <li>One student can vote only once.</li>
          <li>Contact the Election Administrator if you need assistance.</li>
        </ul>
      </div>

      <div className="mt-3 border-t border-dashed border-slate-400" />
    </div>
  );
}

/**
 * Reusable helper function to draw a clean vector-based election slip on a jsPDF document
 */
function drawVectorSlipToPDF(doc: jsPDF, student: Student, x: number, y: number) {
  const cardWidth = 90;
  const cardHeight = 125;
  const headerHeight = 18;

  // Extract Normalized Grade and Division
  const rawGrade = student.grade || '';
  let gradeText = rawGrade;
  let divisionText = 'A';
  if (rawGrade.includes('-')) {
    const parts = rawGrade.split('-');
    gradeText = parts[0].trim();
    divisionText = parts[1].trim();
  } else {
    const match = rawGrade.match(/^(Grade\s+\d+|\d+)\s+([A-D])$/i);
    if (match) {
      gradeText = match[1].trim();
      divisionText = match[2].trim();
    }
  }

  // 1. Draw dashed border bounding box around the card
  doc.setLineWidth(0.3);
  doc.setDrawColor(148, 163, 184); // Slate-400
  doc.setLineDashPattern([2, 2], 0);
  doc.rect(x, y, cardWidth, cardHeight, 'S');

  // Disable line dash pattern for fills and lines
  doc.setLineDashPattern([], 0);

  // 2. Solid Blue Header Rectangle
  doc.setFillColor(37, 99, 235); // Blue-600
  doc.rect(x + 0.1, y + 0.1, cardWidth - 0.2, headerHeight, 'F');

  // 3. Header White Shield Logo Icon
  doc.setDrawColor(255, 255, 255);
  doc.setFillColor(255, 255, 255);
  doc.circle(x + 8, y + headerHeight / 2, 3.2, 'FD');

  doc.setFillColor(37, 99, 235); // Blue
  // Tiny vector graduation cap or shield inside
  doc.triangle(
    x + 8, y + headerHeight / 2 - 1.8,
    x + 6, y + headerHeight / 2 + 0.8,
    x + 10, y + headerHeight / 2 + 0.8,
    'F'
  );

  // 4. Header text (white)
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text('SMART SCHOOL ELECTION SYSTEM', x + 14, y + 7.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.text('ELECTION LOGIN SLIP', x + 14, y + 11.5);

  // 5. Light dashed divider line right below header
  doc.setDrawColor(226, 232, 240); // Slate-200
  doc.setLineWidth(0.2);
  doc.setLineDashPattern([1.5, 1.5], 0);
  doc.line(x, y + headerHeight + 2.5, x + cardWidth, y + headerHeight + 2.5);

  // Reset to solid line format
  doc.setLineDashPattern([], 0);

  // 6. Student Information fields
  let currentY = y + headerHeight + 8;
  const labelX = x + 6;
  const valueX = x + cardWidth - 6;

  const infoFields = [
    { label: 'STUDENT NAME', value: student.studentName, isBold: true },
    { label: 'ADMISSION ID', value: student.admissionId, isBold: false },
    { label: 'GRADE', value: gradeText, isBold: false },
    { label: 'DIVISION', value: divisionText, isBold: false },
    { label: 'ELECTION YEAR', value: '2026', isBold: false }
  ];

  infoFields.forEach((f) => {
    // Label text (slate-400/500)
    doc.setTextColor(100, 116, 139);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6);
    doc.text(f.label, labelX, currentY);

    // Value text (slate-900)
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', f.isBold ? 'bold' : 'normal');
    doc.setFontSize(7.5);
    const valWidth = doc.getTextWidth(f.value);
    doc.text(f.value, valueX - valWidth, currentY);

    // Separator line
    doc.setDrawColor(241, 245, 249); // slate-100
    doc.line(labelX, currentY + 2, valueX, currentY + 2);

    currentY += 6.5;
  });

  // 7. Credentials separator heading
  currentY += 1.5;
  doc.setDrawColor(226, 232, 240); // Slate-200
  doc.setLineDashPattern([1.5, 1.5], 0);
  doc.line(x + 10, currentY, x + cardWidth - 10, currentY);

  doc.setLineDashPattern([], 0);
  const credsHeadingText = 'LOGIN CREDENTIALS';
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(5.5);
  doc.setTextColor(148, 163, 184); // slate-400
  const headingWidth = doc.getTextWidth(credsHeadingText);

  // Mask border behind credential heading
  doc.setFillColor(255, 255, 255);
  doc.rect(x + (cardWidth - headingWidth) / 2 - 2, currentY - 1.2, headingWidth + 4, 2.4, 'F');
  doc.text(credsHeadingText, x + (cardWidth - headingWidth) / 2, currentY + 0.6);

  // 8. Credentials light box
  currentY += 3.5;
  const boxWidth = cardWidth - 12;
  const boxHeight = 15;
  doc.setFillColor(248, 250, 252); // slate-50
  doc.setDrawColor(226, 232, 240); // slate-200
  doc.rect(x + 6, currentY, boxWidth, boxHeight, 'FD');

  // Box details
  doc.setFontSize(7);
  // Admission ID
  doc.setTextColor(100, 116, 139);
  doc.setFont('helvetica', 'bold');
  doc.text('Admission ID:', x + 10, currentY + 5.2);
  doc.setTextColor(15, 23, 42);
  doc.setFont('courier', 'bold'); // Monospace
  doc.text(student.admissionId, x + 32, currentY + 5.2);

  // Passcode
  doc.setTextColor(100, 116, 139);
  doc.setFont('helvetica', 'bold');
  doc.text('Passcode:', x + 10, currentY + 10.8);
  doc.setTextColor(37, 99, 235); // Blue-600
  doc.setFont('courier', 'bold');
  doc.text(student.passcode, x + 32, currentY + 10.8);

  // 9. Important guidelines separator
  currentY += boxHeight + 3.5;
  doc.setDrawColor(226, 232, 240); // Slate-200
  doc.setLineDashPattern([1.5, 1.5], 0);
  doc.line(x + 10, currentY, x + cardWidth - 10, currentY);

  doc.setLineDashPattern([], 0);
  const infoHeadingText = 'IMPORTANT';
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(5.5);
  doc.setTextColor(148, 163, 184); // slate-400
  const infoHeadingWidth = doc.getTextWidth(infoHeadingText);

  // Mask border behind important heading
  doc.setFillColor(255, 255, 255);
  doc.rect(x + (cardWidth - infoHeadingWidth) / 2 - 2, currentY - 1.2, infoHeadingWidth + 4, 2.4, 'F');
  doc.text(infoHeadingText, x + (cardWidth - infoHeadingWidth) / 2, currentY + 0.6);

  // Notice items bullet points
  currentY += 4.5;
  doc.setFontSize(6);
  doc.setTextColor(100, 116, 139); // slate-500

  const instructions = [
    'Keep this Election Slip confidential.',
    'Do not share your Admission ID or Passcode.',
    'One student can vote only once.',
    'Contact the Election Administrator if you need assistance.'
  ];

  instructions.forEach((inst) => {
    // Custom blue bullet
    doc.setTextColor(37, 99, 235);
    doc.setFont('helvetica', 'bold');
    doc.text('*', x + 8, currentY);

    // Instruction text
    doc.setTextColor(100, 116, 139);
    doc.setFont('helvetica', 'normal');
    doc.text(inst, x + 11, currentY);
    currentY += 4;
  });
}

export default function ElectionSlips({ students, votes }: ElectionSlipsProps) {
  // Navigation & Page State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;

  // Search and Filters state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGrade, setSelectedGrade] = useState('All');
  const [selectedDivision, setSelectedDivision] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');

  // View style toggle: 'table' or 'grid'
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');

  // PDF Target Paper Size Format: 'A4' | 'A5' | 'A6'
  const [pdfFormat, setPdfFormat] = useState<'A4' | 'A5' | 'A6'>('A4');

  // Multi-select bulk state
  const [selectedStudentIds, setSelectedStudentIds] = useState<Record<string, boolean>>({});

  // Dynamic print pool state (updated just before triggering native print)
  const [printPool, setPrintPool] = useState<Student[]>([]);

  // State for single slip inspection modal
  const [previewStudent, setPreviewStudent] = useState<Student | null>(null);

  // Track password reveal toggles per student
  const [revealedPasscodes, setRevealedPasscodes] = useState<Record<string, boolean>>({});

  // Track vote counts/statuses dynamically from incoming votes list
  const votedSet = useMemo(() => {
    return new Set(votes.map((v) => v.studentId));
  }, [votes]);

  // Extract unique grades list
  const availableGrades = useMemo(() => {
    const gradesSet = new Set<string>();
    students.forEach((student) => {
      if (student.grade) {
        const raw = student.grade.split('-')[0].trim();
        gradesSet.add(raw);
      }
    });
    return Array.from(gradesSet).sort();
  }, [students]);

  // Extract unique divisions list
  const availableDivisions = useMemo(() => {
    const divisionsSet = new Set<string>();
    students.forEach((student) => {
      const raw = student.grade || '';
      if (raw.includes('-')) {
        const parts = raw.split('-');
        if (parts[1]) divisionsSet.add(parts[1].trim());
      } else {
        const match = raw.match(/^(Grade\s+\d+|\d+)\s+([A-D])$/i);
        if (match && match[2]) divisionsSet.add(match[2].trim());
      }
    });
    return Array.from(divisionsSet).sort();
  }, [students]);

  // Filter students based on all selected criteria
  const filteredStudents = useMemo(() => {
    return students.filter((student) => {
      // 1. Search Query (Admission ID, Name, Grade)
      const matchesSearch = 
        student.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        student.admissionId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        student.grade.toLowerCase().includes(searchQuery.toLowerCase());

      // 2. Grade Filter
      const rawGrade = student.grade || '';
      const baseGrade = rawGrade.split('-')[0].trim();
      const matchesGrade = selectedGrade === 'All' || baseGrade === selectedGrade;

      // 3. Division Filter
      let div = 'A';
      if (rawGrade.includes('-')) {
        div = rawGrade.split('-')[1]?.trim() || 'A';
      } else {
        const match = rawGrade.match(/^(Grade\s+\d+|\d+)\s+([A-D])$/i);
        if (match && match[2]) div = match[2].trim();
      }
      const matchesDivision = selectedDivision === 'All' || div === selectedDivision;

      // 4. Voting Status Filter
      const hasVoted = votedSet.has(student.admissionId) || !!student.hasVoted;
      const matchesStatus = 
        selectedStatus === 'All' ||
        (selectedStatus === 'voted' && hasVoted) ||
        (selectedStatus === 'pending' && !hasVoted);

      return matchesSearch && matchesGrade && matchesDivision && matchesStatus;
    });
  }, [students, searchQuery, selectedGrade, selectedDivision, selectedStatus, votedSet]);

  // Pagination current slice
  const paginatedStudents = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredStudents.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredStudents, currentPage]);

  const totalPages = Math.ceil(filteredStudents.length / itemsPerPage);

  // Statistics calculation
  const stats = useMemo(() => {
    const total = students.length;
    let completed = 0;
    students.forEach((s) => {
      if (votedSet.has(s.admissionId) || s.hasVoted) {
        completed++;
      }
    });
    return {
      total,
      completed,
      pending: total - completed,
      selectedCount: Object.values(selectedStudentIds).filter(Boolean).length
    };
  }, [students, votedSet, selectedStudentIds]);

  // Handle individual select toggle
  const handleSelectToggle = (admissionId: string) => {
    setSelectedStudentIds((prev) => ({
      ...prev,
      [admissionId]: !prev[admissionId],
    }));
  };

  // Determine if all filtered students on current page are selected
  const isAllCurrentPageSelected = useMemo(() => {
    if (paginatedStudents.length === 0) return false;
    return paginatedStudents.every((s) => selectedStudentIds[s.admissionId]);
  }, [paginatedStudents, selectedStudentIds]);

  // Handle Page Select All Toggle
  const handleSelectAllPageToggle = () => {
    const nextSelected = { ...selectedStudentIds };
    if (isAllCurrentPageSelected) {
      paginatedStudents.forEach((s) => {
        nextSelected[s.admissionId] = false;
      });
    } else {
      paginatedStudents.forEach((s) => {
        nextSelected[s.admissionId] = true;
      });
    }
    setSelectedStudentIds(nextSelected);
  };

  // Clear all selections
  const handleClearSelections = () => {
    setSelectedStudentIds({});
    playSystemSound('select_sound');
  };

  // Select all filtered students globally
  const handleSelectAllFiltered = () => {
    const nextSelected: Record<string, boolean> = {};
    filteredStudents.forEach((s) => {
      nextSelected[s.admissionId] = true;
    });
    setSelectedStudentIds(nextSelected);
    playSystemSound('select_sound');
  };

  // Extract selected student list
  const selectedStudentsList = useMemo(() => {
    return students.filter((s) => selectedStudentIds[s.admissionId]);
  }, [students, selectedStudentIds]);

  // Trigger standard browser printing for a list of students
  const handlePrintSlips = (studentsToPrint: Student[]) => {
    if (studentsToPrint.length === 0) {
      alert('No slips selected to print.');
      return;
    }
    playSystemSound('select_sound');
    setPrintPool(studentsToPrint);

    // Briefly delay the native window.print call to guarantee DOM is updated
    setTimeout(() => {
      window.print();
    }, 200);
  };

  // Programmatic custom vector PDF downloader for any list of students
  const handleDownloadPDF = (studentsToDownload: Student[], size: 'A4' | 'A5' | 'A6') => {
    if (studentsToDownload.length === 0) {
      alert('No student slips available to download.');
      return;
    }

    playSystemSound('select_sound');

    // Page configurations based on paper size
    let format: 'a4' | 'a5' | 'a6' = 'a4';
    let orientation: 'portrait' | 'landscape' = 'portrait';
    let cols = 2;
    let rows = 2;
    let leftMargin = 10;
    let topMargin = 15;
    let colSpacing = 10;
    let rowSpacing = 10;
    const cardWidth = 90;
    const cardHeight = 125;

    if (size === 'A4') {
      format = 'a4';
      orientation = 'portrait';
      cols = 2;
      rows = 2;
      leftMargin = 10;
      topMargin = 15;
      colSpacing = 10;
      rowSpacing = 10;
    } else if (size === 'A5') {
      // Landscape A5 allows placing 2 cards beautifully side-by-side!
      format = 'a5';
      orientation = 'landscape';
      cols = 2;
      rows = 1;
      leftMargin = 10;
      topMargin = 11;
      colSpacing = 10;
      rowSpacing = 0;
    } else if (size === 'A6') {
      format = 'a6';
      orientation = 'portrait';
      cols = 1;
      rows = 1;
      leftMargin = 7.5;
      topMargin = 11.5;
      colSpacing = 0;
      rowSpacing = 0;
    }

    const slipsPerPage = cols * rows;
    const doc = new jsPDF({
      orientation: orientation,
      unit: 'mm',
      format: format
    });

    studentsToDownload.forEach((student, index) => {
      const pageNum = Math.floor(index / slipsPerPage);
      const indexOnPage = index % slipsPerPage;
      const row = Math.floor(indexOnPage / cols);
      const col = indexOnPage % cols;

      // Add page if we have exceeded the previous page limits
      if (index > 0 && indexOnPage === 0) {
        doc.addPage(format, orientation);
      }

      const posX = leftMargin + col * (cardWidth + colSpacing);
      const posY = topMargin + row * (cardHeight + rowSpacing);

      drawVectorSlipToPDF(doc, student, posX, posY);
    });

    const stamp = new Date().toISOString().split('T')[0];
    doc.save(`Election_Login_Slips_${size}_${stamp}.pdf`);
  };

  // Toggle reveal state for a specific student's passcode
  const togglePasscodeReveal = (admissionId: string) => {
    setRevealedPasscodes(prev => ({
      ...prev,
      [admissionId]: !prev[admissionId]
    }));
  };

  return (
    <div className="space-y-6">
      {/* Injectable CSS print stylesheet to strip out non-print elements */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          /* Hide everything except print-section */
          body * {
            visibility: hidden !important;
          }
          #print-section, #print-section * {
            visibility: visible !important;
          }
          #print-section {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            background: white !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          
          /* Render grid for multiple printed slips nicely */
          .print-slips-grid {
            display: grid !important;
            grid-template-columns: repeat(2, 1fr) !important;
            gap: 15px !important;
            width: 100% !important;
            box-sizing: border-box !important;
          }

          .print-slip-card {
            border: 2px dashed #94a3b8 !important;
            border-radius: 10px !important;
            padding: 20px !important;
            background: white !important;
            width: 100% !important;
            max-width: 440px !important;
            box-shadow: none !important;
            color: black !important;
            box-sizing: border-box !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            margin-bottom: 20px !important;
          }
          
          .print-blue-header {
            background-color: #2563eb !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color: white !important;
            padding: 12px !important;
            text-align: center !important;
            border-radius: 6px !important;
          }
        }
      `}} />

      {/* Overview stats board */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">Total Students</span>
          <span className="text-2xl font-black text-slate-900 mt-1">{stats.total}</span>
          <span className="text-[10px] text-slate-400 mt-1.5 font-medium">Registered Voter Database</span>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">Slips Selected</span>
          <span className="text-2xl font-black text-blue-600 mt-1">{stats.selectedCount}</span>
          {stats.selectedCount > 0 ? (
            <button 
              onClick={handleClearSelections}
              className="text-[10px] text-rose-600 font-bold hover:underline text-left mt-1.5 transition-all cursor-pointer"
            >
              Clear Selected ({stats.selectedCount})
            </button>
          ) : (
            <span className="text-[10px] text-slate-400 mt-1.5 font-medium">No bulk selection</span>
          )}
        </div>
        <div className="bg-emerald-50/50 p-5 rounded-2xl border border-emerald-100 shadow-sm flex flex-col justify-between">
          <span className="text-[10px] font-extrabold text-emerald-600 uppercase tracking-widest">Voting Completed</span>
          <span className="text-2xl font-black text-emerald-800 mt-1">{stats.completed}</span>
          <span className="text-[10px] text-emerald-600 mt-1.5 font-medium">Completed Ballot Votes</span>
        </div>
        <div className="bg-amber-50/50 p-5 rounded-2xl border border-amber-100 shadow-sm flex flex-col justify-between">
          <span className="text-[10px] font-extrabold text-amber-600 uppercase tracking-widest">Voting Pending</span>
          <span className="text-2xl font-black text-amber-800 mt-1">{stats.pending}</span>
          <span className="text-[10px] text-amber-600 mt-1.5 font-medium">Pending Election Slips</span>
        </div>
      </div>

      {/* Main filter, format select and controls console */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-5 font-sans">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <FileText className="h-5.5 w-5.5 text-blue-600" />
              Election Slip Generator
            </h2>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Generate individual or bulk election login slips containing secure voting passcodes. Clean professional design, automatically paginated.
            </p>
          </div>

          {/* Quick instructions/actions bar */}
          <div className="flex flex-wrap items-center gap-3">
            {/* PDF Format Selector Group */}
            <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-xl border border-slate-200">
              <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider pl-1.5 font-mono">Paper:</span>
              <div className="flex gap-1">
                {(['A4', 'A5', 'A6'] as const).map((sz) => (
                  <button
                    key={sz}
                    onClick={() => {
                      setPdfFormat(sz);
                      playSystemSound('select_sound');
                    }}
                    className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
                      pdfFormat === sz 
                        ? 'bg-blue-600 text-white shadow-sm' 
                        : 'bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-800'
                    }`}
                  >
                    {sz}
                  </button>
                ))}
              </div>
            </div>

            {/* Main Action Buttons */}
            <div className="flex gap-2">
              {stats.selectedCount > 0 ? (
                <>
                  <button
                    onClick={() => handlePrintSlips(selectedStudentsList)}
                    className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all active:scale-95 cursor-pointer"
                    title="Print slips for selected students using browser"
                  >
                    <Printer className="h-4 w-4" />
                    Print Selected ({stats.selectedCount})
                  </button>
                  <button
                    onClick={() => handleDownloadPDF(selectedStudentsList, pdfFormat)}
                    className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all active:scale-95 cursor-pointer"
                    title={`Download multi-page PDF formatted to ${pdfFormat}`}
                  >
                    <Download className="h-4 w-4" />
                    Download Selected PDF
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={handleSelectAllFiltered}
                    className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
                  >
                    Select All Filtered ({filteredStudents.length})
                  </button>
                  <button
                    onClick={() => handlePrintSlips(filteredStudents)}
                    disabled={filteredStudents.length === 0}
                    className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-800 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Printer className="h-4 w-4" />
                    Print All Filtered
                  </button>
                  <button
                    onClick={() => handleDownloadPDF(filteredStudents, pdfFormat)}
                    disabled={filteredStudents.length === 0}
                    className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                  >
                    <Download className="h-4 w-4" />
                    Download PDF ({pdfFormat})
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Filters and Layout controls panel */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-2">
          {/* Search bar */}
          <div className="relative lg:col-span-2">
            <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by ID, Student Name, or Grade..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium font-sans"
            />
          </div>

          {/* Grade filter */}
          <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 border border-slate-200 rounded-xl">
            <Filter className="h-3.5 w-3.5 text-slate-400 shrink-0" />
            <select
              value={selectedGrade}
              onChange={(e) => {
                setSelectedGrade(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full bg-transparent text-xs text-slate-700 focus:outline-none cursor-pointer font-semibold font-sans"
            >
              <option value="All">All Grades</option>
              {availableGrades.map((grade) => (
                <option key={grade} value={grade}>{grade}</option>
              ))}
            </select>
          </div>

          {/* Division filter */}
          <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 border border-slate-200 rounded-xl">
            <Filter className="h-3.5 w-3.5 text-slate-400 shrink-0" />
            <select
              value={selectedDivision}
              onChange={(e) => {
                setSelectedDivision(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full bg-transparent text-xs text-slate-700 focus:outline-none cursor-pointer font-semibold font-sans"
            >
              <option value="All">All Divisions</option>
              {availableDivisions.map((div) => (
                <option key={div} value={div}>Division {div}</option>
              ))}
            </select>
          </div>

          {/* Voting Status filter */}
          <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 border border-slate-200 rounded-xl">
            <Filter className="h-3.5 w-3.5 text-slate-400 shrink-0" />
            <select
              value={selectedStatus}
              onChange={(e) => {
                setSelectedStatus(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full bg-transparent text-xs text-slate-700 focus:outline-none cursor-pointer font-semibold font-sans"
            >
              <option value="All">All Statuses</option>
              <option value="pending">Pending (Not Voted)</option>
              <option value="voted">Voted (Completed)</option>
            </select>
          </div>
        </div>

        {/* View Toggle Bar (Grid vs Table) */}
        <div className="flex items-center justify-between pt-1 border-t border-slate-100">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1 font-mono">
            <Info className="h-3.5 w-3.5 text-blue-500 shrink-0" />
            PDF format is generated programmatically to ensure instant vector crispness.
          </p>

          <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => {
                setViewMode('table');
                playSystemSound('select_sound');
              }}
              className={`p-1.5 rounded-lg transition-all flex items-center gap-1.5 text-xs font-bold cursor-pointer ${
                viewMode === 'table'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
              title="Table view list"
            >
              <List className="h-4 w-4" />
              Student Table
            </button>
            <button
              onClick={() => {
                setViewMode('grid');
                playSystemSound('select_sound');
              }}
              className={`p-1.5 rounded-lg transition-all flex items-center gap-1.5 text-xs font-bold cursor-pointer ${
                viewMode === 'grid'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
              title="Grid view cards"
            >
              <LayoutGrid className="h-4 w-4" />
              Cards Grid
            </button>
          </div>
        </div>
      </div>

      {/* Main Slips Viewport */}
      {filteredStudents.length === 0 ? (
        <div className="text-center py-16 bg-white border border-slate-200/80 rounded-2xl shadow-sm">
          <FileText className="h-12 w-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-800 font-bold text-sm font-sans">No students match your filter criteria.</p>
          <p className="text-xs text-slate-400 mt-1 font-sans">Try resetting the filters or typing a different search query.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Action header bar inside viewport */}
          <div className="flex items-center justify-between bg-slate-100 p-3 px-4 rounded-xl border border-slate-200 font-sans">
            <div className="flex items-center gap-2.5">
              <button
                onClick={handleSelectAllPageToggle}
                className="p-1 bg-white hover:bg-slate-50 rounded-lg border border-slate-200 text-slate-600 transition-colors flex items-center gap-1.5 text-xs font-semibold cursor-pointer"
              >
                {isAllCurrentPageSelected ? (
                  <CheckSquare className="h-4.5 w-4.5 text-blue-600" />
                ) : (
                  <Square className="h-4.5 w-4.5 text-slate-400" />
                )}
                Select Page ({paginatedStudents.length})
              </button>
            </div>
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider font-mono">
              Showing {Math.min(filteredStudents.length, (currentPage - 1) * itemsPerPage + 1)} - {Math.min(filteredStudents.length, currentPage * itemsPerPage)} of {filteredStudents.length} Students
            </p>
          </div>

          {/* TABLE MODE RENDER */}
          {viewMode === 'table' ? (
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden font-sans">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/75 border-b border-slate-200 text-slate-400 text-[10px] font-extrabold uppercase tracking-widest font-mono">
                      <th className="py-3 px-4 w-12">Select</th>
                      <th className="py-3 px-4">Student Name</th>
                      <th className="py-3 px-4">Admission ID</th>
                      <th className="py-3 px-4">Grade & Div</th>
                      <th className="py-3 px-4">Passcode</th>
                      <th className="py-3 px-4">Voting Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {paginatedStudents.map((student) => {
                      const hasVoted = votedSet.has(student.admissionId) || student.hasVoted;
                      const isRevealed = !!revealedPasscodes[student.admissionId];

                      return (
                        <tr 
                          key={student.admissionId} 
                          className={`hover:bg-slate-50/50 transition-colors ${
                            selectedStudentIds[student.admissionId] ? 'bg-blue-50/10' : ''
                          }`}
                        >
                          {/* Selector */}
                          <td className="py-3.5 px-4">
                            <button
                              onClick={() => handleSelectToggle(student.admissionId)}
                              className="text-slate-500 hover:text-blue-600 transition-colors cursor-pointer"
                            >
                              {selectedStudentIds[student.admissionId] ? (
                                <CheckSquare className="h-5 w-5 text-blue-600" />
                              ) : (
                                <Square className="h-5 w-5 text-slate-300" />
                              )}
                            </button>
                          </td>

                          {/* Student Name */}
                          <td className="py-3.5 px-4 font-bold text-slate-900">
                            {student.studentName}
                          </td>

                          {/* Admission ID */}
                          <td className="py-3.5 px-4 font-semibold text-slate-600 font-mono">
                            {student.admissionId}
                          </td>

                          {/* Grade & Div */}
                          <td className="py-3.5 px-4 text-slate-600 font-medium font-sans">
                            {student.grade}
                          </td>

                          {/* Passcode (Secured toggle) */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200 select-all">
                                {isRevealed ? student.passcode : '••••••'}
                              </span>
                              <button
                                onClick={() => togglePasscodeReveal(student.admissionId)}
                                className="text-slate-400 hover:text-slate-600 transition-all p-1 hover:bg-slate-100 rounded cursor-pointer"
                                title={isRevealed ? "Hide passcode" : "Reveal passcode"}
                              >
                                {isRevealed ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                              </button>
                            </div>
                          </td>

                          {/* Status */}
                          <td className="py-3.5 px-4">
                            {hasVoted ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200 font-mono">
                                <Check className="h-3 w-3" />
                                Voted
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200 font-mono">
                                <HelpCircle className="h-3 w-3" />
                                Pending
                              </span>
                            )}
                          </td>

                          {/* Action cell */}
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => {
                                  playSystemSound('select_sound');
                                  setPreviewStudent(student);
                                }}
                                className="p-1 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors text-xs font-bold flex items-center gap-1 cursor-pointer"
                                title="Generate Slip preview modal"
                              >
                                <Eye className="h-3.5 w-3.5" />
                                Generate Slip
                              </button>
                              <button
                                onClick={() => handlePrintSlips([student])}
                                className="p-1 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors cursor-pointer"
                                title="Quick print slip"
                              >
                                <Printer className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => handleDownloadPDF([student], 'A6')}
                                className="p-1 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors cursor-pointer"
                                title="Quick download PDF (A6 size)"
                              >
                                <Download className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* GRID CARDS MODE RENDER */
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 font-sans">
              {paginatedStudents.map((student) => (
                <SingleElectionSlip
                  key={student.admissionId}
                  student={student}
                  isSelected={!!selectedStudentIds[student.admissionId]}
                  onSelectToggle={() => handleSelectToggle(student.admissionId)}
                  onPrint={() => handlePrintSlips([student])}
                  onDownloadPDF={() => handleDownloadPDF([student], 'A6')}
                />
              ))}
            </div>
          )}

          {/* Pagination Navigation */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-slate-200 shadow-sm font-sans">
              <button
                onClick={() => {
                  setCurrentPage((p) => Math.max(1, p - 1));
                  window.scrollTo({ top: 300, behavior: 'smooth' });
                }}
                disabled={currentPage === 1}
                className="p-2 border border-slate-200 rounded-xl hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-transparent transition-colors text-slate-600 flex items-center gap-1 text-xs font-bold cursor-pointer"
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </button>

              <span className="text-xs text-slate-500 font-bold">
                Page {currentPage} of {totalPages}
              </span>

              <button
                onClick={() => {
                  setCurrentPage((p) => Math.min(totalPages, p + 1));
                  window.scrollTo({ top: 300, behavior: 'smooth' });
                }}
                disabled={currentPage === totalPages}
                className="p-2 border border-slate-200 rounded-xl hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-transparent transition-colors text-slate-600 flex items-center gap-1 text-xs font-bold cursor-pointer"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          INTERACTIVE SLIP PREVIEW MODAL
          ========================================================================= */}
      {previewStudent && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden max-w-md w-full animate-in fade-in zoom-in-95 duration-200 flex flex-col font-sans">
            
            {/* Modal Header bar */}
            <div className="p-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-1.5 font-mono">
                <FileText className="h-4 w-4 text-blue-600" />
                Voter Election Slip Preview
              </h3>
              <button
                onClick={() => setPreviewStudent(null)}
                className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-all cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body scroll area */}
            <div className="p-6 overflow-y-auto max-h-[75vh] flex justify-center bg-slate-50/50">
              <SingleElectionSlip 
                student={previewStudent}
                onPrint={() => handlePrintSlips([previewStudent])}
                onDownloadPDF={() => handleDownloadPDF([previewStudent], 'A6')}
              />
            </div>

            {/* Modal Action footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                onClick={() => handleDownloadPDF([previewStudent], 'A6')}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="h-4 w-4" />
                Download PDF (A6)
              </button>
              <button
                onClick={() => handlePrintSlips([previewStudent])}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="h-4 w-4" />
                Print Slip
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          HIDDEN PRINT SECTION FOR BROWSERS
          ========================================================================= */}
      <div id="print-section" className="hidden">
        <div className="print-slips-grid">
          {printPool.map((student) => (
            <PrintSlip key={student.admissionId} student={student} />
          ))}
        </div>
      </div>
    </div>
  );
}
