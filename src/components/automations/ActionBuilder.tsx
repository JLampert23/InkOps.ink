import { X, GripVertical } from 'lucide-react';
import { Action } from '../../types/automation';
import { ACTION_OPTIONS } from './automation-config';
import * as Icons from 'lucide-react';

interface ActionBuilderProps {
  actions: Action[];
  onUpdate: (id: string, updates: Partial<Action>) => void;
  onRemove: (id: string) => void;
}

export function ActionBuilder({ actions, onUpdate, onRemove }: ActionBuilderProps) {
  const getActionOption = (type: string) => {
    return ACTION_OPTIONS.find(a => a.value === type);
  };

  const renderConfigField = (action: Action, field: any) => {
    const value = action.config[field.name] || '';

    switch (field.type) {
      case 'select':
        return (
          <select
            value={value}
            onChange={(e) => onUpdate(action.id, {
              config: { ...action.config, [field.name]: e.target.value }
            })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          >
            <option value="">Select {field.label}...</option>
            {field.options?.map((opt: any) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        );

      case 'textarea':
        return (
          <textarea
            value={value}
            onChange={(e) => onUpdate(action.id, {
              config: { ...action.config, [field.name]: e.target.value }
            })}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            placeholder={`Enter ${field.label.toLowerCase()}...`}
          />
        );

      case 'number':
        return (
          <input
            type="number"
            value={value}
            onChange={(e) => onUpdate(action.id, {
              config: { ...action.config, [field.name]: e.target.value }
            })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            placeholder={`Enter ${field.label.toLowerCase()}...`}
          />
        );

      default:
        return (
          <input
            type="text"
            value={value}
            onChange={(e) => onUpdate(action.id, {
              config: { ...action.config, [field.name]: e.target.value }
            })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            placeholder={`Enter ${field.label.toLowerCase()}...`}
          />
        );
    }
  };

  return (
    <div className="space-y-3">
      {actions.map((action, index) => {
        const option = getActionOption(action.type);
        const IconComponent = option ? (Icons[option.icon as keyof typeof Icons] as any) : null;

        return (
          <div key={action.id} className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <div className="flex items-center gap-3 mb-4">
              <GripVertical className="w-4 h-4 text-gray-400" />
              <span className="text-xs font-medium text-gray-500 uppercase">
                Action {index + 1}
              </span>
              <button
                onClick={() => onRemove(action.id)}
                className="ml-auto p-1 text-red-600 hover:bg-red-50 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Action Type
                </label>
                <select
                  value={action.type}
                  onChange={(e) => onUpdate(action.id, { type: e.target.value as any, config: {} })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white"
                >
                  {ACTION_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                {option && (
                  <p className="mt-1 text-xs text-gray-500">{option.description}</p>
                )}
              </div>

              {option?.configFields.map(field => (
                <div key={field.name}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {field.label}
                    {field.required && <span className="text-red-500 ml-1">*</span>}
                  </label>
                  {renderConfigField(action, field)}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
