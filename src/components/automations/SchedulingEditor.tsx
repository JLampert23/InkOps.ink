import { Clock } from 'lucide-react';
import { SchedulingConfig } from '../../types/automation';

interface SchedulingEditorProps {
  scheduling: SchedulingConfig;
  onChange: (scheduling: SchedulingConfig) => void;
}

export function SchedulingEditor({ scheduling, onChange }: SchedulingEditorProps) {
  const timezones = [
    { value: 'America/New_York', label: 'Eastern Time (ET)' },
    { value: 'America/Chicago', label: 'Central Time (CT)' },
    { value: 'America/Denver', label: 'Mountain Time (MT)' },
    { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
    { value: 'America/Phoenix', label: 'Arizona Time (AZ)' },
    { value: 'America/Anchorage', label: 'Alaska Time (AK)' },
    { value: 'Pacific/Honolulu', label: 'Hawaii Time (HI)' },
    { value: 'UTC', label: 'UTC' },
  ];

  return (
    <div className="bg-gray-50 dark:bg-slate-900/50 border border-gray-200 dark:border-slate-700 rounded-lg p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Clock className="w-5 h-5 text-blue-600 dark:text-blue-400" />
        <h4 className="font-medium text-gray-900 dark:text-white">When should this automation run?</h4>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Execution Type
        </label>
        <div className="space-y-2">
          <label className="flex items-center gap-2 p-3 border border-gray-300 dark:border-slate-600 rounded-lg cursor-pointer hover:bg-white dark:hover:bg-slate-700/50">
            <input
              type="radio"
              name="scheduling-type"
              value="immediate"
              checked={scheduling.type === 'immediate'}
              onChange={(e) => onChange({ ...scheduling, type: 'immediate' })}
              className="text-blue-600"
            />
            <div>
              <div className="font-medium text-gray-900 dark:text-white">Immediately</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Run as soon as the trigger fires</div>
            </div>
          </label>

          <label className="flex items-center gap-2 p-3 border border-gray-300 dark:border-slate-600 rounded-lg cursor-pointer hover:bg-white dark:hover:bg-slate-700/50">
            <input
              type="radio"
              name="scheduling-type"
              value="delayed"
              checked={scheduling.type === 'delayed'}
              onChange={(e) => onChange({ ...scheduling, type: 'delayed', delay: 1, delayUnit: 'hours' })}
              className="text-blue-600"
            />
            <div className="flex-1">
              <div className="font-medium text-gray-900 dark:text-white">With a delay</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Wait before executing</div>
            </div>
          </label>

          {scheduling.type === 'delayed' && (
            <div className="ml-8 flex items-center gap-2">
              <span className="text-sm text-gray-700 dark:text-gray-300">Wait</span>
              <input
                type="number"
                min="1"
                value={scheduling.delay || 1}
                onChange={(e) => onChange({ ...scheduling, delay: parseInt(e.target.value) })}
                className="w-20 px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
              />
              <select
                value={scheduling.delayUnit || 'hours'}
                onChange={(e) => onChange({ ...scheduling, delayUnit: e.target.value as any })}
                className="px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
              >
                <option value="minutes">Minutes</option>
                <option value="hours">Hours</option>
                <option value="days">Days</option>
              </select>
            </div>
          )}

          <label className="flex items-center gap-2 p-3 border border-gray-300 dark:border-slate-600 rounded-lg cursor-pointer hover:bg-white dark:hover:bg-slate-700/50">
            <input
              type="radio"
              name="scheduling-type"
              value="scheduled"
              checked={scheduling.type === 'scheduled'}
              onChange={(e) => onChange({
                ...scheduling,
                type: 'scheduled',
                schedule: { frequency: 'daily', time: '09:00' }
              })}
              className="text-blue-600"
            />
            <div className="flex-1">
              <div className="font-medium text-gray-900 dark:text-white">On a schedule</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Run at specific times</div>
            </div>
          </label>

          {scheduling.type === 'scheduled' && (
            <div className="ml-8 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Frequency
                  </label>
                  <select
                    value={scheduling.schedule?.frequency || 'daily'}
                    onChange={(e) => onChange({
                      ...scheduling,
                      schedule: { ...scheduling.schedule!, frequency: e.target.value as any }
                    })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Time
                  </label>
                  <input
                    type="time"
                    value={scheduling.schedule?.time || '09:00'}
                    onChange={(e) => onChange({
                      ...scheduling,
                      schedule: { ...scheduling.schedule!, time: e.target.value }
                    })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              {scheduling.schedule?.frequency === 'weekly' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Day of Week
                  </label>
                  <select
                    value={scheduling.schedule?.dayOfWeek || 1}
                    onChange={(e) => onChange({
                      ...scheduling,
                      schedule: { ...scheduling.schedule!, dayOfWeek: parseInt(e.target.value) }
                    })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                  >
                    <option value={1}>Monday</option>
                    <option value={2}>Tuesday</option>
                    <option value={3}>Wednesday</option>
                    <option value={4}>Thursday</option>
                    <option value={5}>Friday</option>
                    <option value={6}>Saturday</option>
                    <option value={0}>Sunday</option>
                  </select>
                </div>
              )}

              {scheduling.schedule?.frequency === 'monthly' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Day of Month
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    value={scheduling.schedule?.dayOfMonth || 1}
                    onChange={(e) => onChange({
                      ...scheduling,
                      schedule: { ...scheduling.schedule!, dayOfMonth: parseInt(e.target.value) }
                    })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Timezone
        </label>
        <select
          value={scheduling.timezone || 'America/New_York'}
          onChange={(e) => onChange({ ...scheduling, timezone: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
        >
          {timezones.map(tz => (
            <option key={tz.value} value={tz.value}>
              {tz.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
