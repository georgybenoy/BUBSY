import React, { useState, useEffect } from 'react';
import {
  Shield,
  Save,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Info,
  Clock,
  Award,
  Layers,
  Volume2,
  Lock,
} from 'lucide-react';
import { useAuth } from '../../context/useAuth';
import { fetchSettingsApi, updateSettingsApi } from '../../services/api';
import type { SettingsData } from '../../types/teacher';

export const SettingsPage: React.FC = () => {
  const { token, user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Editable Form State
  const [schoolTimezone, setSchoolTimezone] = useState<string>('UTC');
  const [dataRetentionDays, setDataRetentionDays] = useState<number>(365);
  const [protocolVersion, setProtocolVersion] = useState<string>('who_six_step_v1');
  const [minStepDurationSeconds, setMinStepDurationSeconds] = useState<number>(5);
  const [minQualifyingScore, setMinQualifyingScore] = useState<number>(80);
  const [dailyRewardCap, setDailyRewardCap] = useState<number>(2);
  const [leaderboardVisibility, setLeaderboardVisibility] = useState<string>('school');
  const [firstNameDisplayAllowed, setFirstNameDisplayAllowed] = useState<boolean>(true);
  const [kioskLanguage, setKioskLanguage] = useState<string>('en');
  const [kioskAudioEnabled, setKioskAudioEnabled] = useState<boolean>(true);
  const [allowUnassignedSessions, setAllowUnassignedSessions] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;
    if (!token) return;

    fetchSettingsApi(token)
      .then((res) => {
        if (!isMounted) return;
        if (res.data) {
          setSettings(res.data);
          setSchoolTimezone(res.data.school_timezone);
          setDataRetentionDays(res.data.data_retention_days);
          setProtocolVersion(res.data.protocol_version);
          setMinStepDurationSeconds(res.data.min_step_duration_seconds);
          setMinQualifyingScore(res.data.min_qualifying_score);
          setDailyRewardCap(res.data.daily_reward_cap);
          setLeaderboardVisibility(res.data.leaderboard_visibility);
          setFirstNameDisplayAllowed(res.data.first_name_display_allowed);
          setKioskLanguage(res.data.kiosk_language);
          setKioskAudioEnabled(res.data.kiosk_audio_enabled);
          setAllowUnassignedSessions(res.data.allow_unassigned_sessions);
        } else if (res.error) {
          setError(res.error.message || 'Failed to fetch settings.');
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        setError(err instanceof Error ? err.message : 'Network error loading settings.');
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [token]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !isAdmin) return;

    setSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const res = await updateSettingsApi(token, {
        school_timezone: schoolTimezone,
        data_retention_days: dataRetentionDays,
        protocol_version: protocolVersion,
        min_step_duration_seconds: minStepDurationSeconds,
        min_qualifying_score: minQualifyingScore,
        daily_reward_cap: dailyRewardCap,
        leaderboard_visibility: leaderboardVisibility,
        first_name_display_allowed: firstNameDisplayAllowed,
        kiosk_language: kioskLanguage,
        kiosk_audio_enabled: kioskAudioEnabled,
        allow_unassigned_sessions: allowUnassignedSessions,
      });

      if (res.data) {
        setSettings(res.data);
        setSuccessMessage('Settings updated successfully and recorded in audit log.');
        setTimeout(() => setSuccessMessage(null), 4000);
      } else if (res.error) {
        setError(res.error.message || 'Failed to update settings.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update settings.');
    } finally {
      setSaving(false);
    }
  };

  if (loading && !settings) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '400px',
          gap: '12px',
        }}
        role="status"
      >
        <RefreshCw size={28} className="spin" style={{ color: 'var(--color-primary)' }} />
        <p style={{ color: 'var(--color-muted-text)', fontSize: '14px' }}>Loading configuration...</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div
        style={{
          backgroundColor: 'var(--color-surface)',
          padding: '20px',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--color-border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: 800, margin: 0, color: 'var(--color-dark-text)' }}>
            System Settings & School Configuration
          </h2>
          <p style={{ fontSize: '12px', color: 'var(--color-muted-text)', margin: '2px 0 0' }}>
            Handwashing protocol parameters, scoring thresholds, kiosk preferences, and retention rules
          </p>
        </div>

        {isAdmin ? (
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              backgroundColor: 'var(--color-primary)',
              color: '#ffffff',
              padding: '8px 18px',
              borderRadius: 'var(--radius-sm)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '13px',
              fontWeight: 600,
              opacity: saving ? 0.6 : 1,
            }}
          >
            <Save size={15} />
            <span>{saving ? 'Saving Changes...' : 'Save Configuration'}</span>
          </button>
        ) : (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'var(--color-canvas)',
              border: '1px solid var(--color-border)',
              fontSize: '12px',
              color: 'var(--color-muted-text)',
            }}
          >
            <Lock size={14} />
            <span>Read-Only Mode ({user?.role || 'staff'})</span>
          </div>
        )}
      </div>

      {/* RBAC Notice if non-admin */}
      {!isAdmin && (
        <div
          style={{
            padding: '12px 16px',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: '#eff6ff',
            border: '1px solid #bfdbfe',
            fontSize: '13px',
            color: '#1e40af',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <Info size={16} />
          <span>
            Configuration settings are read-only for your role. Contact a system administrator to adjust school handwashing policies.
          </span>
        </div>
      )}

      {/* Status Messages */}
      {successMessage && (
        <div
          style={{
            padding: '12px 16px',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: '#f0fdf4',
            color: 'var(--color-success)',
            border: '1px solid #bbf7d0',
            fontSize: '13px',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
          role="status"
        >
          <CheckCircle size={16} />
          <span>{successMessage}</span>
        </div>
      )}

      {error && (
        <div
          style={{
            padding: '12px 16px',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: 'var(--color-error-bg)',
            color: 'var(--color-error)',
            border: '1px solid var(--color-error)',
            fontSize: '13px',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
          role="alert"
        >
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* Settings Form */}
      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Section 1: School & Timezone */}
        <div
          style={{
            backgroundColor: 'var(--color-surface)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-border)',
            padding: '20px',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <Clock size={18} style={{ color: 'var(--color-primary)' }} />
            <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: 'var(--color-dark-text)' }}>
              School Timezone & Data Retention
            </h3>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
            <div>
              <label htmlFor="settings-timezone" style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
                School Timezone
              </label>
              <select
                id="settings-timezone"
                value={schoolTimezone}
                disabled={!isAdmin}
                onChange={(e) => setSchoolTimezone(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--color-border)',
                  backgroundColor: !isAdmin ? 'var(--color-canvas)' : 'var(--color-surface)',
                  fontSize: '13px',
                }}
              >
                <option value="UTC">UTC (Universal Coordinated Time)</option>
                <option value="America/New_York">America/New_York (Eastern)</option>
                <option value="America/Chicago">America/Chicago (Central)</option>
                <option value="America/Los_Angeles">America/Los_Angeles (Pacific)</option>
                <option value="Europe/London">Europe/London (GMT/BST)</option>
                <option value="Asia/Tokyo">Asia/Tokyo (JST)</option>
                <option value="Australia/Sydney">Australia/Sydney (AEST)</option>
              </select>
              <span style={{ fontSize: '11px', color: 'var(--color-muted-text)', display: 'block', marginTop: '4px' }}>
                Governs midnight daily reward limits and monthly leaderboard resets.
              </span>
            </div>

            <div>
              <label htmlFor="settings-retention" style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
                Data Retention (Days)
              </label>
              <input
                id="settings-retention"
                type="number"
                min="30"
                max="3650"
                value={dataRetentionDays}
                disabled={!isAdmin}
                onChange={(e) => setDataRetentionDays(parseInt(e.target.value, 10) || 365)}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--color-border)',
                  backgroundColor: !isAdmin ? 'var(--color-canvas)' : 'var(--color-surface)',
                  fontSize: '13px',
                }}
              />
              <span style={{ fontSize: '11px', color: 'var(--color-muted-text)', display: 'block', marginTop: '4px' }}>
                Retains session and step metrics for school reporting. Raw frames are never retained.
              </span>
            </div>
          </div>
        </div>

        {/* Section 2: Handwashing Protocol & Timing */}
        <div
          style={{
            backgroundColor: 'var(--color-surface)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-border)',
            padding: '20px',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <Layers size={18} style={{ color: 'var(--color-primary)' }} />
            <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: 'var(--color-dark-text)' }}>
              Handwashing Protocol & Timing
            </h3>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
            <div>
              <label htmlFor="settings-protocol" style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
                Curriculum Protocol Version
              </label>
              <select
                id="settings-protocol"
                value={protocolVersion}
                disabled={!isAdmin}
                onChange={(e) => setProtocolVersion(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--color-border)',
                  backgroundColor: !isAdmin ? 'var(--color-canvas)' : 'var(--color-surface)',
                  fontSize: '13px',
                }}
              >
                <option value="who_six_step_v1">WHO 6-Step Rubbing Protocol (v1.0)</option>
                <option value="cdc_standard_v1">CDC Standard Clean Hands Protocol (v1.0)</option>
              </select>
              <span style={{ fontSize: '11px', color: 'var(--color-muted-text)', display: 'block', marginTop: '4px' }}>
                Specifies step sequence: Preparation, Palm, Back of Hands, Interlaced, Back of Fingers, Thumbs, Fingertips, Rinse & Dry.
              </span>
            </div>

            <div>
              <label htmlFor="settings-step-duration" style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
                Minimum Step Duration (Seconds)
              </label>
              <input
                id="settings-step-duration"
                type="number"
                min="2"
                max="30"
                value={minStepDurationSeconds}
                disabled={!isAdmin}
                onChange={(e) => setMinStepDurationSeconds(parseInt(e.target.value, 10) || 5)}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--color-border)',
                  backgroundColor: !isAdmin ? 'var(--color-canvas)' : 'var(--color-surface)',
                  fontSize: '13px',
                }}
              />
              <span style={{ fontSize: '11px', color: 'var(--color-muted-text)', display: 'block', marginTop: '4px' }}>
                Minimum recognized gesture persistence required before advancing to next step.
              </span>
            </div>
          </div>
        </div>

        {/* Section 3: Scoring & Reward Rules */}
        <div
          style={{
            backgroundColor: 'var(--color-surface)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-border)',
            padding: '20px',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <Award size={18} style={{ color: 'var(--color-primary)' }} />
            <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: 'var(--color-dark-text)' }}>
              Scoring Thresholds & Daily Reward Caps
            </h3>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
            <div>
              <label htmlFor="settings-score-threshold" style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
                Minimum Qualifying Score (%)
              </label>
              <input
                id="settings-score-threshold"
                type="number"
                min="50"
                max="100"
                value={minQualifyingScore}
                disabled={!isAdmin}
                onChange={(e) => setMinQualifyingScore(parseInt(e.target.value, 10) || 80)}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--color-border)',
                  backgroundColor: !isAdmin ? 'var(--color-canvas)' : 'var(--color-surface)',
                  fontSize: '13px',
                }}
              />
              <span style={{ fontSize: '11px', color: 'var(--color-muted-text)', display: 'block', marginTop: '4px' }}>
                Session technique threshold required to qualify for Bubsy Points.
              </span>
            </div>

            <div>
              <label htmlFor="settings-daily-cap" style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
                Daily Reward Cap (Washes / Day)
              </label>
              <input
                id="settings-daily-cap"
                type="number"
                min="1"
                max="10"
                value={dailyRewardCap}
                disabled={!isAdmin}
                onChange={(e) => setDailyRewardCap(parseInt(e.target.value, 10) || 2)}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--color-border)',
                  backgroundColor: !isAdmin ? 'var(--color-canvas)' : 'var(--color-surface)',
                  fontSize: '13px',
                }}
              />
              <span style={{ fontSize: '11px', color: 'var(--color-muted-text)', display: 'block', marginTop: '4px' }}>
                Prevents badge grinding by capping points to 2 qualifying sessions daily.
              </span>
            </div>
          </div>
        </div>

        {/* Section 4: Kiosk Preferences & Privacy */}
        <div
          style={{
            backgroundColor: 'var(--color-surface)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-border)',
            padding: '20px',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <Volume2 size={18} style={{ color: 'var(--color-primary)' }} />
            <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: 'var(--color-dark-text)' }}>
              Kiosk Display, Audio & Privacy
            </h3>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
            <div>
              <label htmlFor="settings-kiosk-lang" style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
                Kiosk Audio/Text Language
              </label>
              <select
                id="settings-kiosk-lang"
                value={kioskLanguage}
                disabled={!isAdmin}
                onChange={(e) => setKioskLanguage(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--color-border)',
                  backgroundColor: !isAdmin ? 'var(--color-canvas)' : 'var(--color-surface)',
                  fontSize: '13px',
                }}
              >
                <option value="en">English (Default)</option>
                <option value="es">Español (Spanish)</option>
                <option value="fr">Français (French)</option>
              </select>
            </div>

            <div>
              <label htmlFor="settings-leaderboard-vis" style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
                Leaderboard Visibility
              </label>
              <select
                id="settings-leaderboard-vis"
                value={leaderboardVisibility}
                disabled={!isAdmin}
                onChange={(e) => setLeaderboardVisibility(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--color-border)',
                  backgroundColor: !isAdmin ? 'var(--color-canvas)' : 'var(--color-surface)',
                  fontSize: '13px',
                }}
              >
                <option value="school">School-Wide Public Leaderboard</option>
                <option value="class">Class-Only Visibility</option>
                <option value="hidden">Hidden from Students</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', cursor: isAdmin ? 'pointer' : 'default' }}>
              <input
                type="checkbox"
                checked={kioskAudioEnabled}
                disabled={!isAdmin}
                onChange={(e) => setKioskAudioEnabled(e.target.checked)}
                style={{ width: '16px', height: '16px' }}
              />
              <span>Enable audio speech synthesis & sound feedback on student kiosk</span>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', cursor: isAdmin ? 'pointer' : 'default' }}>
              <input
                type="checkbox"
                checked={firstNameDisplayAllowed}
                disabled={!isAdmin}
                onChange={(e) => setFirstNameDisplayAllowed(e.target.checked)}
                style={{ width: '16px', height: '16px' }}
              />
              <span>Allow first name display on kiosk screen after student badge scan</span>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', cursor: isAdmin ? 'pointer' : 'default' }}>
              <input
                type="checkbox"
                checked={allowUnassignedSessions}
                disabled={!isAdmin}
                onChange={(e) => setAllowUnassignedSessions(e.target.checked)}
                style={{ width: '16px', height: '16px' }}
              />
              <span>Allow unassigned anonymous sessions (for visitors or forgotten badges)</span>
            </label>
          </div>
        </div>

        {/* Audit Notice */}
        <div
          style={{
            padding: '12px 16px',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: 'var(--color-canvas)',
            border: '1px solid var(--color-border)',
            fontSize: '12px',
            color: 'var(--color-muted-text)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <Shield size={16} />
          <span>
            <strong>Audit Policy:</strong> Every update to system parameters is immutably logged in the audit events
            repository with teacher username and timestamp.
          </span>
        </div>
      </form>
    </div>
  );
};
