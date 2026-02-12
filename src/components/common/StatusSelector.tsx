import { useInvoiceStatuses, InvoiceStatus } from '../../hooks/useInvoiceStatuses';

interface StatusSelectorProps {
  companyId: string | undefined;
  value: string;
  onChange: (status: string, color: string) => void;
  className?: string;
  disabled?: boolean;
}

export function StatusSelector({
  companyId,
  value,
  onChange,
  className = '',
  disabled = false,
}: StatusSelectorProps) {
  const { statuses, loading } = useInvoiceStatuses(companyId);

  const groupedStatuses = statuses.reduce(
    (acc, status) => {
      if (status.isCustom) {
        const category = status.category || 'Custom Statuses';
        if (!acc[category]) {
          acc[category] = [];
        }
        acc[category].push(status);
      } else {
        acc['System Statuses'].push(status);
      }
      return acc;
    },
    { 'System Statuses': [] } as Record<string, InvoiceStatus[]>
  );

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedStatus = statuses.find((s) => s.name === e.target.value);
    if (selectedStatus) {
      onChange(selectedStatus.name, selectedStatus.color);
    }
  };

  if (loading) {
    return (
      <select
        disabled
        className={`${className} opacity-50 cursor-not-allowed`}
      >
        <option>Loading statuses...</option>
      </select>
    );
  }

  return (
    <div className="relative">
      <select
        value={value}
        onChange={handleChange}
        disabled={disabled}
        className={`${className} pr-10`}
      >
        {Object.entries(groupedStatuses).map(([category, categoryStatuses]) => (
          <optgroup key={category} label={category}>
            {categoryStatuses.map((status) => (
              <option key={status.id} value={status.name}>
                {status.name}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      {/* Color indicator */}
      <div
        className="absolute right-3 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full pointer-events-none"
        style={{
          backgroundColor: statuses.find((s) => s.name === value)?.color || '#6B7280',
        }}
      />
    </div>
  );
}

// Simplified version for filters/lists
interface StatusBadgeProps {
  status: string;
  color?: string;
  companyId?: string;
}

export function StatusBadge({ status, color, companyId }: StatusBadgeProps) {
  const { getStatusColor } = useInvoiceStatuses(companyId);
  const badgeColor = color || getStatusColor(status);

  return (
    <span
      className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium"
      style={{
        backgroundColor: `${badgeColor}15`,
        color: badgeColor,
        border: `1px solid ${badgeColor}40`,
      }}
    >
      <span
        className="w-2 h-2 rounded-full"
        style={{ backgroundColor: badgeColor }}
      />
      {status}
    </span>
  );
}
