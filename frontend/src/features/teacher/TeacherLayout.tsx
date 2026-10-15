import React, { useState } from 'react';
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  Sparkles,
  Trophy,
  BarChart3,
  Cpu,
  Settings as SettingsIcon,
  FileDown,
  ExternalLink,
  LogOut,
  Menu,
  X,
  CheckCircle,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/useAuth';
import { downloadAnalyticsCsvApi } from '../../services/api';
import { OverviewPage } from './OverviewPage';
import { StudentsPage } from './StudentsPage';
import { ClassesPage } from './ClassesPage';
import { WashSessionsPage } from './WashSessionsPage';
import { LeaderboardPage } from './LeaderboardPage';
import { AnalyticsPage } from './AnalyticsPage';
import { KioskStatusPage } from './KioskStatusPage';
import { SettingsPage } from './SettingsPage';

const NAV_ITEMS = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'students', label: 'Students', icon: Users },
  { id: 'classes', label: 'Classes', icon: GraduationCap },
  { id: 'sessions', label: 'Wash Sessions', icon: Sparkles },
  { id: 'leaderboard', label: 'Leaderboard', icon: Trophy },
  { id: 'analytics', label: 'Analytics & Reports', icon: BarChart3 },
  { id: 'status', label: 'Kiosk & AI Status', icon: Cpu },
  { id: 'settings', label: 'Settings', icon: SettingsIcon },
];

export const TeacherLayout: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [selectedPeriod, setSelectedPeriod] = useState<string>('30d');
  const [classFilterForStudents, setClassFilterForStudents] = useState<string | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [generatingReport, setGeneratingReport] = useState<boolean>(false);
  const [reportFeedback, setReportFeedback] = useState<string | null>(null);

  const { token, user, logout } = useAuth();

  const handleGenerateReport = async () => {
    if (!token) return;
    setGeneratingReport(true);
    setReportFeedback(null);
    try {
      const ok = await downloadAnalyticsCsvApi(token, selectedPeriod);
      if (ok) {
        setReportFeedback('Compliance CSV report downloaded successfully.');
      } else {
        setReportFeedback('Report export failed. Switched to Analytics view.');
        setActiveTab('analytics');
      }
    } catch {
      setActiveTab('analytics');
    } finally {
      setGeneratingReport(false);
      setTimeout(() => setReportFeedback(null), 4000);
    }
  };

  const getTabSubtitle = (tab: string) => {
    switch (tab) {
      case 'overview':
        return "Your school's handwashing activity and protocol compliance at a glance.";
      case 'students':
        return 'Manage student rosters, print QR code badges, and review wash credentials.';
      case 'classes':
        return 'Create classes, monitor cohort completion, and track wash engagement.';
      case 'sessions':
        return 'Searchable forensic log of handwashing sessions and AI sequence recognition.';
      case 'leaderboard':
        return 'Monthly competition standings and audited point transaction reviews.';
      case 'analytics':
        return 'Compliance trends, step difficulty forensics, and sanitized CSV reports.';
      case 'status':
        return 'Webcam, AI pose model, scanner hardware, and database system health.';
      case 'settings':
        return 'School timezone, protocol rules, scoring criteria, and kiosk privacy options.';
      default:
        return "Bubsy teacher portal.";
    }
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: 'var(--color-canvas)' }}>
      {/* Mobile Backdrop */}
      {mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.4)',
            zIndex: 40,
          }}
        />
      )}

      {/* Sidebar (Fixed on desktop, drawer on mobile) */}
      <aside
        style={{
          width: '264px',
          backgroundColor: 'var(--color-surface)',
          borderRight: '1px solid var(--color-border)',
          display: 'flex',
          flexDirection: 'column',
          padding: '28px 18px',
          position: mobileMenuOpen ? 'fixed' : 'sticky',
          top: 0,
          left: 0,
          bottom: 0,
          height: '100vh',
          zIndex: 50,
          transform: mobileMenuOpen ? 'translateX(0)' : undefined,
          transition: 'transform 0.2s ease',
        }}
      >
        {/* Brand Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '36px',
            paddingLeft: '8px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--color-primary)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                fontSize: '20px',
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              B
            </div>
            <div>
              <h2
                style={{
                  fontSize: '22px',
                  fontWeight: 800,
                  color: 'var(--color-dark-text)',
                  margin: 0,
                  letterSpacing: '-0.02em',
                }}
              >
                Bubsy
              </h2>
              <span style={{ fontSize: '13px', color: 'var(--color-muted-text)', fontWeight: 600 }}>
                Teacher Portal
              </span>
            </div>
          </div>

          {/* Mobile close button */}
          {mobileMenuOpen && (
            <button
              onClick={() => setMobileMenuOpen(false)}
              aria-label="Close menu"
              style={{ color: 'var(--color-muted-text)' }}
            >
              <X size={22} />
            </button>
          )}
        </div>

        {/* Navigation Items */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1, overflowY: 'auto' }}>
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  if (item.id === 'students') setClassFilterForStudents(null);
                  if (item.id === 'sessions') setSelectedSessionId(null);
                  setActiveTab(item.id);
                  setMobileMenuOpen(false);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '14px',
                  padding: '12px 16px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: isActive ? 'var(--color-soft-blue)' : 'transparent',
                  color: isActive ? 'var(--color-primary)' : 'var(--color-dark-text)',
                  fontWeight: isActive ? 700 : 500,
                  fontSize: '15px',
                  textAlign: 'left',
                  cursor: 'pointer',
                  transition: 'background-color 0.15s ease',
                }}
              >
                <Icon size={20} style={{ color: isActive ? 'var(--color-primary)' : 'var(--color-muted-text)' }} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Launch Kiosk shortcut */}
        <div style={{ paddingTop: '20px', borderTop: '1px solid var(--color-border)' }}>
          <Link
            to="/kiosk"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 16px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--color-canvas)',
              fontSize: '14px',
              fontWeight: 600,
              color: 'var(--color-primary)',
              border: '1px solid var(--color-border)',
            }}
          >
            <span>Launch Kiosk</span>
            <ExternalLink size={16} />
          </Link>
        </div>
      </aside>

      {/* Main Container */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Header */}
        <header
          style={{
            minHeight: '80px',
            backgroundColor: 'var(--color-surface)',
            borderBottom: '1px solid var(--color-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 36px',
            flexWrap: 'wrap',
            gap: '16px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <button
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open mobile navigation menu"
              style={{
                display: 'none',
                color: 'var(--color-dark-text)',
                cursor: 'pointer',
              }}
              className="mobile-menu-btn"
            >
              <Menu size={22} />
            </button>
            <div>
              <h1
                style={{
                  fontSize: '24px',
                  fontWeight: 800,
                  margin: 0,
                  color: 'var(--color-dark-text)',
                  textTransform: 'capitalize',
                  letterSpacing: '-0.02em',
                }}
              >
                {activeTab === 'status' ? 'Kiosk & AI Status' : activeTab === 'analytics' ? 'Analytics & Reports' : activeTab}
              </h1>
              <p style={{ fontSize: '14px', color: 'var(--color-muted-text)', margin: '4px 0 0' }}>
                {getTabSubtitle(activeTab)}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '18px', flexWrap: 'wrap' }}>
            {/* Period Selector (visible for Overview & Analytics) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <label htmlFor="top-period-select" style={{ fontSize: '14px', color: 'var(--color-muted-text)', fontWeight: 600 }}>
                Period:
              </label>
              <select
                id="top-period-select"
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(e.target.value)}
                style={{
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--color-border)',
                  backgroundColor: 'var(--color-surface)',
                  fontSize: '14px',
                  fontWeight: 600,
                  color: 'var(--color-dark-text)',
                }}
              >
                <option value="today">Today</option>
                <option value="7d">Last 7 Days</option>
                <option value="30d">Last 30 Days</option>
                <option value="90d">Last 90 Days</option>
                <option value="this_month">Current Month</option>
              </select>
            </div>

            {/* Generate Report Button */}
            <button
              onClick={handleGenerateReport}
              disabled={generatingReport}
              style={{
                backgroundColor: 'var(--color-primary)',
                color: '#ffffff',
                padding: '10px 18px',
                borderRadius: 'var(--radius-sm)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '14px',
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                opacity: generatingReport ? 0.7 : 1,
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              <FileDown size={18} />
              <span>{generatingReport ? 'Generating...' : 'Generate Report'}</span>
            </button>

            {/* Staff User & Logout */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '14px',
                paddingLeft: '18px',
                borderLeft: '1px solid var(--color-border)',
              }}
            >
              <div style={{ textAlign: 'right' }}>
                <span
                  style={{
                    display: 'block',
                    fontSize: '14px',
                    fontWeight: 700,
                    color: 'var(--color-dark-text)',
                  }}
                >
                  {user?.username || 'Staff'}
                </span>
                <span
                  style={{
                    display: 'inline-block',
                    fontSize: '12px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    backgroundColor: 'var(--color-soft-blue)',
                    color: 'var(--color-primary)',
                    padding: '2px 8px',
                    borderRadius: 'var(--radius-full)',
                  }}
                >
                  {user?.role || 'teacher'}
                </span>
              </div>

              <button
                onClick={() => logout()}
                aria-label="Log out of teacher portal"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '9px 14px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'transparent',
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-dark-text)',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'background-color 0.15s ease',
                }}
              >
                <LogOut size={16} aria-hidden="true" />
                <span>Log out</span>
              </button>
            </div>
          </div>
        </header>

        {/* Report Download Notification */}
        {reportFeedback && (
          <div
            style={{
              padding: '10px 32px',
              backgroundColor: '#f0fdf4',
              color: 'var(--color-success)',
              borderBottom: '1px solid #bbf7d0',
              fontSize: '13px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
            role="status"
          >
            <CheckCircle size={16} />
            <span>{reportFeedback}</span>
          </div>
        )}

        {/* Workspace */}
        <main style={{ padding: '32px', flex: 1, overflowY: 'auto' }}>
          {activeTab === 'overview' && (
            <OverviewPage
              period={selectedPeriod}
              onNavigateTab={(tab) => {
                if (tab === 'students') setClassFilterForStudents(null);
                setActiveTab(tab);
              }}
              onSelectSession={(sessId) => {
                setSelectedSessionId(sessId);
                setActiveTab('sessions');
              }}
            />
          )}

          {activeTab === 'students' && (
            <StudentsPage initialClassId={classFilterForStudents} />
          )}

          {activeTab === 'classes' && (
            <ClassesPage
              onSelectClass={(clsId) => {
                setClassFilterForStudents(clsId);
                setActiveTab('students');
              }}
            />
          )}

          {activeTab === 'sessions' && (
            <WashSessionsPage initialSessionId={selectedSessionId} />
          )}

          {activeTab === 'leaderboard' && (
            <LeaderboardPage />
          )}

          {activeTab === 'analytics' && (
            <AnalyticsPage />
          )}

          {activeTab === 'status' && (
            <KioskStatusPage />
          )}

          {activeTab === 'settings' && (
            <SettingsPage />
          )}
        </main>
      </div>
    </div>
  );
};
