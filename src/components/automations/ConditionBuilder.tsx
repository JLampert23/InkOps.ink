import { X } from 'lucide-react';
import { Condition } from '../../types/automation';
import { CONDITION_OPTIONS, OPERATOR_LABELS } from './automation-config';

interface ConditionBuilderProps {
  conditions: Condition[];
  onUpdate: (id: string, updates: Partial<Condition>) => void;
  onRemove: (id: string) => void;
}

export function ConditionBuilder({ conditions, onUpdate, onRemove }: ConditionBuilderProps) {
  const getConditionOption = (field: string) => {
    return CONDITION_OPTIONS.find(c => c.value === field);
  };

  const renderValueInput = (condition: Condition) => {
    const option = getConditionOption(condition.field);
    if (!option) return null;

    switch (option.valueType) {
      case 'select':
        return (
          <select
            value={condition.value}
            onChange={(e) => onUpdate(condition.id, { value: e.target.value })}
            className="flex-1 px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
          >
            <option value="">Select value...</option>
            {option.options?.map(opt => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        );

      case 'number':
        return (
          <input
            type="number"
            value={condition.value}
            onChange={(e) => onUpdate(condition.id, { value: e.target.value })}
            className="flex-1 px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
            placeholder="Enter number..."
          />
        );

      case 'date':
        return (
          <input
            type="date"
            value={condition.value}
            onChange={(e) => onUpdate(condition.id, { value: e.target.value })}
            className="flex-1 px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
          />
        );

      default:
        return (
          <input
            type="text"
            value={condition.value}
            onChange={(e) => onUpdate(condition.id, { value: e.target.value })}
            className="flex-1 px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
            placeholder="Enter value..."
          />
        );
    }
  };

  return (
    <div className="space-y-3">
      {conditions.map((condition, index) => {
        const option = getConditionOption(condition.field);

        return (
          <div key={condition.id}>
            {index > 0 && (
              <div className="flex items-center gap-2 mb-2">
                <div className="h-px flex-1 bg-gray-200 dark:bg-slate-700" />
                <select
                  value={condition.logicOperator || 'AND'}
                  onChange={(e) => onUpdate(condition.id, { logicOperator: e.target.value as 'AND' | 'OR' })}
                  className="px-3 py-1 text-sm border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 font-medium text-gray-700 dark:text-gray-300"
                >
                  <option value="AND">AND</option>
                  <option value="OR">OR</option>
                </select>
                <div className="h-px flex-1 bg-gray-200 dark:bg-slate-700" />
              </div>
            )}

            <div className="bg-gray-50 dark:bg-slate-900/50 border border-gray-200 dark:border-slate-700 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  Condition {index + 1}
                </span>
                <button
                  onClick={() => onRemove(condition.id)}
                  className="ml-auto p-1 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <select
                  value={condition.field}
                  onChange={(e) => onUpdate(condition.id, { field: e.target.value as any, value: '' })}
                  className="px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                >
                  {CONDITION_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>

                <select
                  value={condition.operator}
                  onChange={(e) => onUpdate(condition.id, { operator: e.target.value as any })}
                  className="px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                >
                  {option?.operators.map(op => (
                    <option key={op} value={op}>
                      {OPERATOR_LABELS[op]}
                    </option>
                  ))}
                </select>

                {renderValueInput(condition)}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
