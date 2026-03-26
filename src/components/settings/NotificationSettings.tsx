import { useState, useEffect } from 'react';
import { Bell, Save, Loader2, Volume2, VolumeX, Mail, Send, AlertCircle, CheckCircle2 } from 'lucide-react';
import { supabase } from '../../lib/supabase-client';
import { useAuth } from '../../contexts/AuthContext';
import { useNotification } from '../../contexts/NotificationContext';

interface NotificationPreferences {
  id: string;
  user_id: string;
  company_id: string;
  quote_approved_enabled: boolean;
  quote_declined_enabled: boolean;
  payment_received_enabled: boolean;
  production_completed_enabled: boolean;
  sound_enabled: boolean;
  email_notifications_enabled: boolean;
}

interface CompanySettings {
  id: string;
  notification_forwarding_email: string | null;
  notification_forwarding_enabled: boolean;
}

export default function NotificationSettings() {
  const { user } = useAuth();
  const { showNotification } = useNotification();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null);
  const [forwardingEmail, setForwardingEmail] = useState('');
  const [forwardingEnabled, setForwardingEnabled] = useState(false);
  const [sendingTestEmail, setSendingTestEmail] = useState(false);
  const [testEmailSent, setTestEmailSent] = useState(false);

  useEffect(() => {
    if (user) {
      loadPreferences();
      loadCompanySettings();
    }
  }, [user]);

  const loadPreferences = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('user_notification_preferences')
        .select('*')
        .eq('user_id', user?.id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No preferences exist, create default ones
          await createDefaultPreferences();
        } else {
          throw error;
        }
      } else {
        setPreferences(data);
      }
    } catch (error) {
      console.error('Error loading notification preferences:', error);
      showNotification('error', 'Failed to load notification preferences');
    } finally {
      setLoading(false);
    }
  };

  const createDefaultPreferences = async () => {
    try {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('company_id')
        .eq('id', user?.id)
        .single();

      if (!profile?.company_id) {
        throw new Error('No company found for user');
      }

      const defaultPrefs = {
        user_id: user?.id,
        company_id: profile.company_id,
        quote_approved_enabled: true,
        quote_declined_enabled: true,
        payment_received_enabled: true,
        production_completed_enabled: true,
        sound_enabled: true,
        email_notifications_enabled: false,
      };

      const { data, error } = await supabase
        .from('user_notification_preferences')
        .insert(defaultPrefs)
        .select()
        .single();

      if (error) throw error;
      setPreferences(data);
    } catch (error) {
      console.error('Error creating default preferences:', error);
      showNotification('error', 'Failed to create notification preferences');
    }
  };

  const loadCompanySettings = async () => {
    try {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('company_id')
        .eq('id', user?.id)
        .single();

      if (!profile?.company_id) {
        throw new Error('No company found for user');
      }

      const { data, error } = await supabase
        .from('company_settings')
        .select('id, notification_forwarding_email, notification_forwarding_enabled')
        .eq('id', profile.company_id)
        .single();

      if (error) throw error;

      setCompanySettings(data);
      setForwardingEmail(data.notification_forwarding_email || '');
      setForwardingEnabled(data.notification_forwarding_enabled || false);
    } catch (error) {
      console.error('Error loading company settings:', error);
    }
  };

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleSaveAll = async () => {
    if (!preferences) return;

    // Validate email if forwarding is enabled
    if (companySettings && forwardingEnabled && forwardingEmail && !validateEmail(forwardingEmail)) {
      showNotification('error', 'Please enter a valid email address');
      return;
    }

    try {
      setSaving(true);

      // Save notification preferences
      const { error: prefsError } = await supabase
        .from('user_notification_preferences')
        .update({
          quote_approved_enabled: preferences.quote_approved_enabled,
          quote_declined_enabled: preferences.quote_declined_enabled,
          payment_received_enabled: preferences.payment_received_enabled,
          production_completed_enabled: preferences.production_completed_enabled,
          sound_enabled: preferences.sound_enabled,
          email_notifications_enabled: preferences.email_notifications_enabled,
          updated_at: new Date().toISOString(),
        })
        .eq('id', preferences.id);

      if (prefsError) throw prefsError;

      // Save email forwarding settings if company settings exist
      if (companySettings) {
        const { error: forwardingError } = await supabase
          .from('company_settings')
          .update({
            notification_forwarding_email: forwardingEmail || null,
            notification_forwarding_enabled: forwardingEnabled,
          })
          .eq('id', companySettings.id);

        if (forwardingError) throw forwardingError;
      }

      showNotification('success', 'Settings saved successfully');
      setTestEmailSent(false);
    } catch (error) {
      console.error('Error saving settings:', error);
      showNotification('error', 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleSendTestEmail = async () => {
    if (!companySettings || !forwardingEmail) return;

    if (!validateEmail(forwardingEmail)) {
      showNotification('error', 'Please enter a valid email address');
      return;
    }

    try {
      setSendingTestEmail(true);

      const { data, error } = await supabase.functions.invoke('forward-notification-email', {
        body: {
          notification_id: 'test-notification',
          company_id: companySettings.id,
          notification_type: 'test',
          title: 'Test Notification',
          message: 'This is a test notification to verify your email forwarding configuration is working correctly.',
          reference_type: 'Test',
          reference_id: 'test-123',
        },
      });

      if (error) throw error;

      if (data?.success) {
        setTestEmailSent(true);
        showNotification('success', `Test email sent to ${forwardingEmail}`);
      } else {
        throw new Error(data?.error || 'Failed to send test email');
      }
    } catch (error) {
      console.error('Error sending test email:', error);
      showNotification('error', 'Failed to send test email. Please check your email configuration.');
    } finally {
      setSendingTestEmail(false);
    }
  };

  const handleToggle = (field: keyof NotificationPreferences) => {
    if (!preferences) return;

    setPreferences({
      ...preferences,
      [field]: !preferences[field],
    });
  };


  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!preferences) {
    return (
      <div className="p-8 text-center text-gray-500 dark:text-gray-400">
        Unable to load notification preferences
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <Bell className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Notification Preferences
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Choose which notifications you want to receive
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Notification Types */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">
              Notification Types
            </h3>
            <div className="space-y-4">
              <NotificationToggle
                label="Quote Approved"
                description="Get notified when a quote is approved by a customer"
                enabled={preferences.quote_approved_enabled}
                onChange={() => handleToggle('quote_approved_enabled')}
              />

              <NotificationToggle
                label="Quote Declined"
                description="Get notified when a quote is declined by a customer"
                enabled={preferences.quote_declined_enabled}
                onChange={() => handleToggle('quote_declined_enabled')}
              />

              <NotificationToggle
                label="Payment Received"
                description="Get notified when a payment is received (coming soon)"
                enabled={preferences.payment_received_enabled}
                onChange={() => handleToggle('payment_received_enabled')}
                disabled
              />

              <NotificationToggle
                label="Production Completed"
                description="Get notified when a production job is completed (coming soon)"
                enabled={preferences.production_completed_enabled}
                onChange={() => handleToggle('production_completed_enabled')}
                disabled
              />
            </div>
          </div>

          {/* Notification Settings */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">
              Notification Settings
            </h3>
            <div className="space-y-4">
              <NotificationToggle
                label="Sound Effects"
                description="Play a sound when you receive a notification"
                enabled={preferences.sound_enabled}
                onChange={() => handleToggle('sound_enabled')}
                icon={preferences.sound_enabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
              />

              <NotificationToggle
                label="Email Notifications"
                description="Receive email copies of in-app notifications (coming soon)"
                enabled={preferences.email_notifications_enabled}
                onChange={() => handleToggle('email_notifications_enabled')}
                icon={<Mail className="w-5 h-5" />}
                disabled
              />
            </div>
          </div>

          {/* Email Forwarding (Admin Only) */}
          {companySettings && (
            <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
              <div className="flex items-center gap-3 mb-4">
                <Send className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                    Email Forwarding (Admin)
                  </h3>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                    Forward all in-app notifications to an external email address
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Forwarding Email Address
                  </label>
                  <input
                    type="email"
                    value={forwardingEmail}
                    onChange={(e) => {
                      setForwardingEmail(e.target.value);
                      setTestEmailSent(false);
                    }}
                    placeholder="manager@company.com"
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    All notifications will be forwarded to this email address when enabled
                  </p>
                </div>

                <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                  <div className="flex-1">
                    <div className="font-medium text-gray-900 dark:text-white">
                      Enable Email Forwarding
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      Send all notifications to the configured email address
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setForwardingEnabled(!forwardingEnabled);
                      setTestEmailSent(false);
                    }}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 ${
                      forwardingEnabled ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        forwardingEnabled ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={handleSendTestEmail}
                    disabled={!forwardingEmail || sendingTestEmail || !validateEmail(forwardingEmail)}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {sendingTestEmail ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Sending...
                      </>
                    ) : testEmailSent ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-green-600" />
                        Test Email Sent
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        Send Test Email
                      </>
                    )}
                  </button>

                  {!validateEmail(forwardingEmail) && forwardingEmail && (
                    <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 text-sm">
                      <AlertCircle className="w-4 h-4" />
                      Invalid email address
                    </div>
                  )}
                </div>

                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-blue-900 dark:text-blue-100">
                      <p className="font-medium mb-1">Important Notes:</p>
                      <ul className="list-disc list-inside space-y-1 text-blue-800 dark:text-blue-200">
                        <li>Email forwarding respects your notification type preferences above</li>
                        <li>Only enabled notification types will be forwarded</li>
                        <li>Make sure your Resend API key is configured in integrations</li>
                        <li>Failed emails will not prevent notifications from appearing in-app</li>
                      </ul>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 rounded-b-lg">
          <button
            onClick={handleSaveAll}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save Settings
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

interface NotificationToggleProps {
  label: string;
  description: string;
  enabled: boolean;
  onChange: () => void;
  icon?: React.ReactNode;
  disabled?: boolean;
}

function NotificationToggle({
  label,
  description,
  enabled,
  onChange,
  icon,
  disabled = false,
}: NotificationToggleProps) {
  return (
    <div className="flex items-start justify-between gap-4 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
      <div className="flex items-start gap-3 flex-1">
        {icon && (
          <div className="text-gray-600 dark:text-gray-400 mt-0.5">
            {icon}
          </div>
        )}
        <div className="flex-1">
          <div className="font-medium text-gray-900 dark:text-white">
            {label}
            {disabled && (
              <span className="ml-2 text-xs text-gray-500 dark:text-gray-400 font-normal">
                (Coming Soon)
              </span>
            )}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            {description}
          </div>
        </div>
      </div>
      <button
        onClick={onChange}
        disabled={disabled}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 disabled:opacity-50 disabled:cursor-not-allowed ${
          enabled ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            enabled ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  );
}
