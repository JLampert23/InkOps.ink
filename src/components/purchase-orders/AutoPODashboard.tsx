import React, { useState, useEffect } from 'react';
import {
  Package,
  TrendingUp,
  Clock,
  CheckCircle,
  AlertCircle,
  Settings,
  Play,
  FileText,
  Truck,
  DollarSign,
} from 'lucide-react';
import {
  POAutoCreationService,
  GarmentRequirement,
} from '../../services/po-auto-creation-service';
import { useNotification } from '../../contexts/NotificationContext';

export function AutoPODashboard() {
  const { showNotification } = useNotification();
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const [requirements, setRequirements] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>(null);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [reqSummary, vendorStats, poStats, reqByVendor, settingsData] =
        await Promise.all([
          POAutoCreationService.getRequirementsSummary(),
          POAutoCreationService.getVendorStats(),
          POAutoCreationService.getPOStatsByStatus(),
          POAutoCreationService.getRequirementsByVendor(),
          POAutoCreationService.getAutoCreateSettings(),
        ]);

      if (reqSummary.data) {
        setStats((prev: any) => ({
          ...prev,
          requirements: reqSummary.data,
        }));
      }

      if (vendorStats.data) {
        setStats((prev: any) => ({ ...prev, vendors: vendorStats.data }));
      }

      if (poStats.data) {
        setStats((prev: any) => ({ ...prev, pos: poStats.data }));
      }

      if (reqByVendor.data) {
        setRequirements(reqByVendor.data);
      }

      if (settingsData.data) {
        setSettings(settingsData.data);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      showNotification('Failed to load auto-PO data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleAutoCreatePOs = async () => {
    if (
      !confirm(
        'This will create draft POs for all pending garment requirements. Continue?'
      )
    ) {
      return;
    }

    setCreating(true);
    try {
      const { data, error } = await POAutoCreationService.autoCreatePOs();

      if (error) throw error;

      if (data?.success) {
        showNotification(
          `Successfully created ${data.pos_created} draft PO(s)`,
          'success'
        );
        await loadData();
      } else {
        showNotification(data?.message || 'No POs created', 'info');
      }
    } catch (error) {
      console.error('Error creating POs:', error);
      showNotification('Failed to create POs', 'error');
    } finally {
      setCreating(false);
    }
  };

  const handleUpdateSettings = async () => {
    try {
      const { error } = await POAutoCreationService.updateAutoCreateSettings(
        settings
      );

      if (error) throw error;

      showNotification('Settings updated successfully', 'success');
      setShowSettings(false);
    } catch (error) {
      console.error('Error updating settings:', error);
      showNotification('Failed to update settings', 'error');
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            Auto-PO Dashboard
          </h2>
          <p className="text-gray-600 mt-1">
            Automatic purchase order creation from garment requirements
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowSettings(true)}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-2"
          >
            <Settings className="h-4 w-4" />
            Settings
          </button>
          <button
            onClick={handleAutoCreatePOs}
            disabled={creating || !stats?.requirements?.pending}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {creating ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Creating...
              </>
            ) : (
              <>
                <Play className="h-4 w-4" />
                Create POs
              </>
            )}
          </button>
        </div>
      </div>

      {/* Status Alert */}
      {!settings?.po_auto_create_enabled && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-lg">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-yellow-800">
                Auto-PO Creation Disabled
              </h3>
              <p className="text-sm text-yellow-700 mt-1">
                Automatic PO creation is currently disabled. Enable it in
                settings to automatically create draft POs from garment
                requirements.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Pending Requirements */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Pending Requirements</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {stats?.requirements?.pending || 0}
              </p>
            </div>
            <div className="bg-orange-100 p-3 rounded-lg">
              <Clock className="h-6 w-6 text-orange-600" />
            </div>
          </div>
          <p className="text-sm text-gray-600 mt-2">
            {formatCurrency(stats?.requirements?.pending_value || 0)} value
          </p>
        </div>

        {/* PO Created */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">POs Created</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {stats?.requirements?.po_created || 0}
              </p>
            </div>
            <div className="bg-green-100 p-3 rounded-lg">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
          </div>
          <p className="text-sm text-gray-600 mt-2">
            {stats?.requirements?.total_requirements || 0} total requirements
          </p>
        </div>

        {/* Active Vendors */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Active Vendors</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {stats?.vendors?.total_vendors || 0}
              </p>
            </div>
            <div className="bg-blue-100 p-3 rounded-lg">
              <Truck className="h-6 w-6 text-blue-600" />
            </div>
          </div>
          <p className="text-sm text-gray-600 mt-2">
            {stats?.vendors?.auto_po_enabled || 0} auto-PO enabled
          </p>
        </div>

        {/* Draft POs */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Draft POs</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {stats?.pos?.draft || 0}
              </p>
            </div>
            <div className="bg-purple-100 p-3 rounded-lg">
              <FileText className="h-6 w-6 text-purple-600" />
            </div>
          </div>
          <p className="text-sm text-gray-600 mt-2">Awaiting review</p>
        </div>
      </div>

      {/* Requirements by Vendor */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">
            Requirements by Vendor
          </h3>
          <p className="text-sm text-gray-600 mt-1">
            Pending garment requirements grouped by supplier
          </p>
        </div>

        <div className="p-6">
          {requirements.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Package className="h-12 w-12 mx-auto mb-3 text-gray-400" />
              <p>No pending requirements</p>
              <p className="text-sm mt-1">
                All garment requirements have been converted to POs
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {requirements.map((group, index) => (
                <div
                  key={index}
                  className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <h4 className="font-semibold text-gray-900">
                          {group.supplier_name}
                        </h4>
                        <span className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded uppercase">
                          {group.supplier_type}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
                        <span className="flex items-center gap-1">
                          <Package className="h-4 w-4" />
                          {group.requirement_count} requirements
                        </span>
                        <span className="flex items-center gap-1">
                          <DollarSign className="h-4 w-4" />
                          {formatCurrency(group.total_value)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Requirement Details */}
                  <div className="mt-4 space-y-2">
                    {group.requirements.map((req: GarmentRequirement) => (
                      <div
                        key={req.id}
                        className="text-sm text-gray-600 pl-4 border-l-2 border-gray-200"
                      >
                        <p className="font-medium text-gray-900">
                          {req.style_number} - {req.style_name}
                        </p>
                        <p className="text-xs">
                          Color: {req.color} | Qty: {req.total_quantity} |
                          Cost: {formatCurrency(req.total_cost)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-xl font-bold text-gray-900">
                Auto-PO Settings
              </h3>
            </div>

            <div className="p-6 space-y-6">
              {/* Enable/Disable */}
              <div>
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={settings?.po_auto_create_enabled || false}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        po_auto_create_enabled: e.target.checked,
                      })
                    }
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <div>
                    <span className="font-medium text-gray-900">
                      Enable Automatic PO Creation
                    </span>
                    <p className="text-sm text-gray-600">
                      Automatically create draft POs from garment requirements
                    </p>
                  </div>
                </label>
              </div>

              {/* Threshold Days */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Creation Threshold (Days)
                </label>
                <input
                  type="number"
                  value={settings?.po_auto_create_threshold_days || 14}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      po_auto_create_threshold_days: parseInt(e.target.value),
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  min="1"
                />
                <p className="text-sm text-gray-600 mt-1">
                  Create POs when production date is within this many days
                </p>
              </div>

              {/* Group by Vendor */}
              <div>
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={settings?.po_auto_group_by_vendor || false}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        po_auto_group_by_vendor: e.target.checked,
                      })
                    }
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <div>
                    <span className="font-medium text-gray-900">
                      Group by Vendor
                    </span>
                    <p className="text-sm text-gray-600">
                      Create one PO per vendor (recommended)
                    </p>
                  </div>
                </label>
              </div>

              {/* Notifications */}
              <div>
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={settings?.po_auto_create_notify_enabled || false}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        po_auto_create_notify_enabled: e.target.checked,
                      })
                    }
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <div>
                    <span className="font-medium text-gray-900">
                      Enable Notifications
                    </span>
                    <p className="text-sm text-gray-600">
                      Notify purchasing team when POs are created
                    </p>
                  </div>
                </label>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 bg-gray-50 flex items-center justify-end gap-3">
              <button
                onClick={() => setShowSettings(false)}
                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateSettings}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Save Settings
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
