import { useState, useEffect } from 'react';
import { Bell, Save, Loader2, Volume2, VolumeX, Mail } from 'lucide-react';
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

export default function NotificationSettings() {
  const { user } = useAuth();
  const { showNotification } = useNotification();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);

  useEffect(() => {
    if (user) {
      loadPreferences();
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

  const handleToggle = (field: keyof NotificationPreferences) => {
    if (!preferences) return;

    setPreferences({
      ...preferences,
      [field]: !preferences[field],
    });
  };

  const handleSave = async () => {
    if (!preferences) return;

    try {
      setSaving(true);

      const { error } = await supabase
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

      if (error) throw error;

      showNotification('success', 'Notification preferences saved successfully');
    } catch (error) {
      console.error('Error saving notification preferences:', error);
      showNotification('error', 'Failed to save notification preferences');
    } finally {
      setSaving(false);
    }
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
        </div>

        <div className="p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 rounded-b-lg">
          <button
            onClick={handleSave}
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
                Save Preferences
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
