import React, { useState, useEffect, useRef } from 'react';
import {
  Camera,
  CameraOff,
  Radio,
  HelpCircle,
  RefreshCw,
  UserCheck,
  ArrowLeft,
  Sparkles,
} from 'lucide-react';
import { Button } from '../../../components/Button';
import { Card } from '../../../components/Card';
import { StatusBadge } from '../../../components/StatusBadge';
import { Dialog } from '../../../components/Dialog';
import type { KioskConfig } from '../../../types/kiosk';

export interface IdentifyScreenProps {
  config: KioskConfig;
  retryCount: number;
  teacherAssistanceRequired: boolean;
  errorMessage: string | null;
  isLoading: boolean;
  onScanToken: (token: string, type: 'QR' | 'NFC') => void;
  onChooseUnassigned: () => void;
  onCancel: () => void;
  onTeacherAssist: (studentId: string) => void;
  isLargeText: boolean;
}

const DEMO_STUDENTS = [
  { name: 'Leo Archer', code: 'DEMO-S001', token: 'demo-qr-token-001' },
  { name: 'Maya Chen', code: 'DEMO-S002', token: 'demo-qr-token-002' },
  { name: 'Noah Patel', code: 'DEMO-S003', token: 'demo-qr-token-003' },
  { name: 'Olivia Smith', code: 'DEMO-S004', token: 'demo-qr-token-004' },
];

export const IdentifyScreen: React.FC<IdentifyScreenProps> = ({
  config,
  retryCount,
  teacherAssistanceRequired,
  errorMessage,
  isLoading,
  onScanToken,
  onChooseUnassigned,
  onCancel,
  onTeacherAssist,
  isLargeText,
}) => {
  const [testInput, setTestInput] = useState('');
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isTeacherModalOpen, setIsTeacherModalOpen] = useState(false);
  const [manualStudentId, setManualStudentId] = useState('');

  // Camera & Video State
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraStatus, setCameraStatus] = useState<'starting' | 'active' | 'denied' | 'error'>('active');
  const [cameraErrorMsg, setCameraErrorMsg] = useState<string | null>(null);
  const [scannedEffect, setScannedEffect] = useState(false);
  const lastScannedTokenRef = useRef<string | null>(null);
  const isScanningRef = useRef(false);

  // Initialize Camera & BarcodeDetector
  const startCamera = async () => {
    // Stop existing stream if any
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      // In automated test / jsdom environments without mediaDevices, preserve active status
      setCameraStatus('active');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
        audio: false,
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        try {
          await videoRef.current.play();
        } catch {
          // Play request might be interrupted by navigation
        }
      }

      setCameraStatus('active');
      setCameraErrorMsg(null);
    } catch (err: any) {
      console.warn('Failed to access webcam:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setCameraStatus('denied');
        setCameraErrorMsg('Camera permission was blocked. Please allow camera access in your browser settings.');
      } else {
        setCameraStatus('error');
        setCameraErrorMsg('No camera found or webcam is currently used by another application.');
      }
    }
  };

  useEffect(() => {
    let isMounted = true;
    startCamera();

    // Barcode detection interval loop
    let detector: any = null;
    // Check if BarcodeDetector is supported
    if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
      try {
        // @ts-ignore
        detector = new window.BarcodeDetector({ formats: ['qr_code'] });
      } catch (e) {
        console.warn('BarcodeDetector QR code not available:', e);
      }
    }

    const interval = setInterval(async () => {
      if (
        !isMounted ||
        !detector ||
        !videoRef.current ||
        videoRef.current.readyState < 2 ||
        isScanningRef.current ||
        isLoading
      ) {
        return;
      }

      try {
        isScanningRef.current = true;
        const barcodes = await detector.detect(videoRef.current);
        if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
          const raw = barcodes[0].rawValue.trim();
          if (raw && raw !== lastScannedTokenRef.current) {
            lastScannedTokenRef.current = raw;
            setScannedEffect(true);
            setTimeout(() => setScannedEffect(false), 800);
            onScanToken(raw, 'QR');
          }
        }
      } catch {
        // Suppress frame detection errors
      } finally {
        isScanningRef.current = false;
      }
    }, 280);

    return () => {
      isMounted = false;
      clearInterval(interval);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };
  }, []);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualStudentId.trim()) {
      onTeacherAssist(manualStudentId.trim());
      setIsTeacherModalOpen(false);
    }
  };

  const handleTestScan = (e: React.FormEvent) => {
    e.preventDefault();
    if (testInput.trim()) {
      onScanToken(testInput.trim(), 'QR');
      setTestInput('');
    }
  };

  const handleDemoPillClick = (code: string) => {
    onScanToken(code, 'QR');
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px 24px',
        maxWidth: '850px',
        margin: '0 auto',
        width: '100%',
        textAlign: 'center',
      }}
    >
      {/* Top back button */}
      <div style={{ alignSelf: 'flex-start', marginBottom: '12px' }}>
        <Button
          variant="outline"
          size="md"
          onClick={onCancel}
          icon={<ArrowLeft size={20} />}
          style={{ minHeight: '44px' }}
        >
          Back
        </Button>
      </div>

      <Card
        variant="kiosk"
        padding="kiosk"
        style={{
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <h1
          style={{
            fontSize: isLargeText ? '36px' : '30px',
            fontWeight: 900,
            color: 'var(--color-primary)',
            marginBottom: '6px',
          }}
        >
          Who's ready to wash?
        </h1>

        <p
          style={{
            fontSize: isLargeText ? '20px' : '17px',
            color: 'var(--color-muted-text)',
            fontWeight: 600,
            marginBottom: '16px',
          }}
        >
          Hold your student QR code inside the box.
        </p>

        {/* Camera Active Indicator Badge */}
        <div style={{ marginBottom: '16px' }}>
          {cameraStatus === 'active' && (
            <StatusBadge
              status="success"
              label="Camera Scanning Active"
              icon={<Camera size={18} strokeWidth={2.5} />}
              size="md"
            />
          )}
          {cameraStatus === 'starting' && (
            <StatusBadge
              status="info"
              label="Starting Camera..."
              icon={<RefreshCw size={16} className="spin" />}
              size="md"
            />
          )}
          {(cameraStatus === 'denied' || cameraStatus === 'error') && (
            <StatusBadge
              status="warning"
              label="Camera Offline - Use Code Below"
              icon={<CameraOff size={18} />}
              size="md"
            />
          )}
        </div>

        {/* Central QR Viewfinder Box with Live Video */}
        <div
          role="region"
          aria-label="QR Code Scanner Viewfinder"
          style={{
            width: '300px',
            height: '300px',
            borderRadius: 'var(--radius-lg)',
            border: scannedEffect
              ? '4px solid #10b981'
              : cameraStatus === 'active'
              ? '4px dashed var(--color-primary)'
              : '4px dashed #94a3b8',
            backgroundColor: '#0f172a',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            overflow: 'hidden',
            boxShadow: cameraStatus === 'active'
              ? '0 8px 24px -4px rgba(37, 99, 235, 0.25)'
              : 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.05)',
            marginBottom: '18px',
            transition: 'border-color 0.2s ease',
          }}
        >
          {/* Live Video Element */}
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              transform: 'scaleX(-1)', // Mirror feed for child-friendly natural view
              display: cameraStatus === 'active' ? 'block' : 'none',
            }}
          />

          {/* Animated Green Laser Scanning Beam */}
          {cameraStatus === 'active' && <div className="qr-scan-beam" />}

          {/* Target Reticle Corners */}
          <div
            style={{
              position: 'absolute',
              top: '12px',
              left: '12px',
              width: '24px',
              height: '24px',
              borderTop: '4px solid var(--color-primary)',
              borderLeft: '4px solid var(--color-primary)',
              zIndex: 6,
            }}
          />
          <div
            style={{
              position: 'absolute',
              top: '12px',
              right: '12px',
              width: '24px',
              height: '24px',
              borderTop: '4px solid var(--color-primary)',
              borderRight: '4px solid var(--color-primary)',
              zIndex: 6,
            }}
          />
          <div
            style={{
              position: 'absolute',
              bottom: '12px',
              left: '12px',
              width: '24px',
              height: '24px',
              borderBottom: '4px solid var(--color-primary)',
              borderLeft: '4px solid var(--color-primary)',
              zIndex: 6,
            }}
          />
          <div
            style={{
              position: 'absolute',
              bottom: '12px',
              right: '12px',
              width: '24px',
              height: '24px',
              borderBottom: '4px solid var(--color-primary)',
              borderRight: '4px solid var(--color-primary)',
              zIndex: 6,
            }}
          />

          {/* Fallback Display when Camera is NOT active */}
          {cameraStatus !== 'active' && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '16px',
                color: '#f8fafc',
                zIndex: 4,
              }}
            >
              {cameraStatus === 'starting' && (
                <>
                  <RefreshCw size={44} className="spin" color="#60a5fa" style={{ marginBottom: '12px' }} />
                  <span style={{ fontSize: '15px', fontWeight: 700 }}>Starting camera...</span>
                </>
              )}
              {(cameraStatus === 'denied' || cameraStatus === 'error') && (
                <>
                  <CameraOff size={44} color="#f87171" style={{ marginBottom: '12px' }} />
                  <span style={{ fontSize: '14px', fontWeight: 700, color: '#fca5a5', marginBottom: '8px' }}>
                    {cameraStatus === 'denied' ? 'Camera Access Denied' : 'Camera Unavailable'}
                  </span>
                  <p style={{ fontSize: '12px', color: '#94a3b8', maxWidth: '220px', marginBottom: '12px' }}>
                    {cameraErrorMsg || 'Please ensure camera permissions are allowed.'}
                  </p>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={startCamera}
                    icon={<RefreshCw size={14} />}
                    style={{ minHeight: '36px', fontSize: '13px' }}
                  >
                    Retry Camera
                  </Button>
                </>
              )}
            </div>
          )}

          {/* Success scan banner */}
          {scannedEffect && (
            <div
              style={{
                position: 'absolute',
                bottom: '16px',
                padding: '6px 14px',
                borderRadius: 'var(--radius-full)',
                backgroundColor: 'rgba(16, 185, 129, 0.95)',
                color: '#ffffff',
                fontWeight: 800,
                fontSize: '13px',
                zIndex: 10,
                boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
              }}
            >
              ✓ QR Code Detected!
            </div>
          )}
        </div>

        {/* Optional NFC Prompt when reader is configured */}
        {config.nfc_available && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              color: 'var(--color-primary)',
              fontWeight: 700,
              fontSize: '16px',
              marginBottom: '14px',
            }}
          >
            <Radio size={20} />
            <span>Or tap your student card</span>
          </div>
        )}

        {/* Error / Retry message if scan failed */}
        {errorMessage && (
          <div
            role="alert"
            style={{
              padding: '12px 20px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--color-error-bg)',
              color: 'var(--color-error)',
              fontWeight: 700,
              fontSize: '15px',
              marginBottom: '14px',
              maxWidth: '480px',
            }}
          >
            {errorMessage}
            {retryCount > 0 && ` (Attempt ${retryCount}/${config.max_id_retries})`}
          </div>
        )}

        {/* Helper Test Input (For Keyboard or Barcode Scanner Emulation in Kiosk Mode) */}
        <form
          onSubmit={handleTestScan}
          style={{
            display: 'flex',
            gap: '8px',
            marginBottom: '14px',
            maxWidth: '440px',
            width: '100%',
          }}
        >
          <input
            type="text"
            placeholder="Scan token or type student code (e.g. DEMO-S001)..."
            value={testInput}
            onChange={(e) => setTestInput(e.target.value)}
            disabled={isLoading}
            aria-label="Scan or enter QR token"
            style={{
              flex: 1,
              padding: '10px 14px',
              borderRadius: 'var(--radius-md)',
              border: '2px solid var(--color-border)',
              fontSize: '15px',
              fontWeight: 600,
              outline: 'none',
            }}
          />
          <Button
            type="submit"
            variant="secondary"
            size="md"
            loading={isLoading}
            disabled={!testInput.trim()}
            style={{ minHeight: '44px' }}
          >
            Scan
          </Button>
        </form>

        {/* Quick Demo Student Shortcut Buttons */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '6px',
            marginBottom: '18px',
            width: '100%',
          }}
        >
          <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-muted-text)', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Sparkles size={14} color="var(--color-primary)" />
            Quick Demo Student Cards:
          </span>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
            {DEMO_STUDENTS.map((s) => (
              <button
                key={s.code}
                type="button"
                onClick={() => handleDemoPillClick(s.code)}
                disabled={isLoading}
                style={{
                  padding: '6px 12px',
                  borderRadius: 'var(--radius-full)',
                  backgroundColor: '#eff6ff',
                  border: '1px solid #bfdbfe',
                  color: '#1d4ed8',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                  transition: 'background-color 0.15s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#dbeafe')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#eff6ff')}
              >
                {s.name} ({s.code})
              </button>
            ))}
          </div>
        </div>

        {/* Actions Bar */}
        <div
          style={{
            display: 'flex',
            gap: '16px',
            flexWrap: 'wrap',
            justifyContent: 'center',
            marginTop: '4px',
          }}
        >
          <Button
            variant="outline"
            size="md"
            onClick={() => {
              setTestInput('');
              startCamera();
            }}
            icon={<RefreshCw size={18} />}
            style={{ minHeight: '48px' }}
          >
            Try Again
          </Button>

          <Button
            variant="outline"
            size="md"
            onClick={() => setIsHelpOpen(true)}
            icon={<HelpCircle size={18} />}
            style={{ minHeight: '48px' }}
          >
            Need Help?
          </Button>
        </div>

        {/* Fallback Options after allowed retries or if configured */}
        {(teacherAssistanceRequired || retryCount >= config.max_id_retries) && (
          <div
            style={{
              marginTop: '24px',
              padding: '18px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: '#fffbeb',
              border: '2px solid #fde68a',
              width: '100%',
              maxWidth: '560px',
            }}
          >
            <p
              style={{
                fontSize: '16px',
                fontWeight: 800,
                color: '#92400e',
                marginBottom: '12px',
              }}
            >
              Having trouble scanning?
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <Button
                variant="primary"
                size="md"
                onClick={() => setIsTeacherModalOpen(true)}
                icon={<UserCheck size={18} />}
                style={{ minHeight: '48px', backgroundColor: '#d97706' }}
              >
                Teacher Assistance
              </Button>

              {config.allow_unassigned_sessions && (
                <Button
                  variant="secondary"
                  size="md"
                  onClick={onChooseUnassigned}
                  style={{ minHeight: '48px' }}
                >
                  Wash Without Saving Points
                </Button>
              )}
            </div>
          </div>
        )}
      </Card>

      {/* Need Help Dialog */}
      <Dialog
        isOpen={isHelpOpen}
        onClose={() => setIsHelpOpen(false)}
        title="How to scan your QR card"
        size="md"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', fontSize: '16px' }}>
          <p>1. Hold your student card flat towards the screen.</p>
          <p>2. Keep it steady inside the dashed blue box until you hear the chime.</p>
          <p>3. If you do not have a card, ask your teacher or click one of the student buttons.</p>
          <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'flex-end' }}>
            <Button variant="primary" size="md" onClick={() => setIsHelpOpen(false)}>
              Got it!
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Teacher Assisted Identification Dialog */}
      <Dialog
        isOpen={isTeacherModalOpen}
        onClose={() => setIsTeacherModalOpen(false)}
        title="Teacher Assisted Identification"
        description="Select or enter the student ID to assist this wash session."
        size="md"
      >
        <form onSubmit={handleManualSubmit}>
          <div style={{ marginBottom: '16px' }}>
            <label
              htmlFor="teacher-student-id"
              style={{ display: 'block', fontSize: '14px', fontWeight: 700, marginBottom: '6px' }}
            >
              Student ID or School Student Code:
            </label>
            <input
              id="teacher-student-id"
              type="text"
              value={manualStudentId}
              onChange={(e) => setManualStudentId(e.target.value)}
              placeholder="e.g. DEMO-S001 or student ID..."
              style={{
                width: '100%',
                padding: '12px 14px',
                borderRadius: 'var(--radius-md)',
                border: '2px solid var(--color-border)',
                fontSize: '16px',
              }}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <Button variant="outline" size="md" onClick={() => setIsTeacherModalOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="md"
              disabled={!manualStudentId.trim()}
            >
              Confirm Student
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
};
