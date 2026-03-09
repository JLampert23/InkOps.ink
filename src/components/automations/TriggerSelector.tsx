import { TRIGGER_OPTIONS, TRIGGER_CONDITION_OPTIONS } from './automation-config';
import * as Icons from 'lucide-react';

interface TriggerSelectorProps {
  value: string;
  triggerConfig: Record<string, any>;
  onChange: (value: string) => void;
  onConfigChange: (config: Record<string, any>) => void;
}

export function TriggerSelector({ value, triggerConfig, onChange, onConfigChange }: TriggerSelectorProps) {
  const selectedTrigger = TRIGGER_OPTIONS.find(t => t.value === value);
  const conditionConfig = value ? TRIGGER_CONDITION_OPTIONS[value] : null;

  const handleConditionChange = (selectedValue: string) => {
    onConfigChange({
      ...triggerConfig,
      selected_value: selectedValue,
    });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {TRIGGER_OPTIONS.map((trigger) => {
          const IconComponent = (Icons[trigger.icon as keyof typeof Icons] || Icons.Zap) as any;
          const isSelected = value === trigger.value;

          return (
            <button
              key={trigger.value}
              onClick={() => onChange(trigger.value)}
              className={`p-4 border-2 rounded-lg text-left transition-all ${
                isSelected
                  ? 'border-blue-600 dark:border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-gray-200 dark:border-slate-600 hover:border-gray-300 dark:hover:border-slate-500 hover:bg-gray-50 dark:hover:bg-slate-700/50'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`p-2 rounded-lg ${isSelected ? 'bg-blue-100 dark:bg-blue-800/40' : 'bg-gray-100 dark:bg-slate-700'}`}>
                  <IconComponent className={`w-5 h-5 ${isSelected ? 'text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400'}`} />
                </div>
                <div className="flex-1">
                  <h4 className={`font-medium mb-1 ${isSelected ? 'text-blue-900 dark:text-blue-300' : 'text-gray-900 dark:text-white'}`}>
                    {trigger.label}
                  </h4>
                  <p className={`text-sm ${isSelected ? 'text-blue-700 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400'}`}>
                    {trigger.description}
                  </p>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {conditionConfig && (
        <div className="bg-gray-50 dark:bg-slate-900/50 border border-gray-200 dark:border-slate-700 rounded-lg p-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {conditionConfig.label} <span className="text-red-500">*</span>
          </label>
          <select
            value={triggerConfig.selected_value || ''}
            onChange={(e) => handleConditionChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">Select {conditionConfig.label}...</option>
            {conditionConfig.options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
