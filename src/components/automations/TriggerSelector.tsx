import { TRIGGER_OPTIONS } from './automation-config';
import * as Icons from 'lucide-react';

interface TriggerSelectorProps {
  value: string;
  onChange: (value: string) => void;
}

export function TriggerSelector({ value, onChange }: TriggerSelectorProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {TRIGGER_OPTIONS.map((trigger) => {
        const IconComponent = Icons[trigger.icon as keyof typeof Icons] as any;
        const isSelected = value === trigger.value;

        return (
          <button
            key={trigger.value}
            onClick={() => onChange(trigger.value)}
            className={`p-4 border-2 rounded-lg text-left transition-all ${
              isSelected
                ? 'border-blue-600 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
            }`}
          >
            <div className="flex items-start gap-3">
              <div className={`p-2 rounded-lg ${isSelected ? 'bg-blue-100' : 'bg-gray-100'}`}>
                <IconComponent className={`w-5 h-5 ${isSelected ? 'text-blue-600' : 'text-gray-600'}`} />
              </div>
              <div className="flex-1">
                <h4 className={`font-medium mb-1 ${isSelected ? 'text-blue-900' : 'text-gray-900'}`}>
                  {trigger.label}
                </h4>
                <p className={`text-sm ${isSelected ? 'text-blue-700' : 'text-gray-600'}`}>
                  {trigger.description}
                </p>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
