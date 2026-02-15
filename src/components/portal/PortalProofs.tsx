import { useState, useEffect } from 'react';
import { PortalLayout } from './PortalLayout';
import { useCustomerPortal } from '../../contexts/CustomerPortalContext';
import { supabase } from '../../lib/supabase-client';
import { CheckCircle, XCircle, Eye, Loader2, MessageSquare } from 'lucide-react';
import { portalAnalyticsService } from '../../services/portal-analytics-service';

interface Proof {
  id: string;
  quote_id: string;
  quote_number: string;
  proof_version: number;
  status: string;
  composite_image_url: string | null;
  created_at: string;
  approved_at: string | null;
  rejected_at: string | null;
  feedback: string | null;
}

export function PortalProofs() {
  const { user } = useCustomerPortal();
  const [proofs, setProofs] = useState<Proof[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProof, setSelectedProof] = useState<Proof | null>(null);
  const [feedback, setFeedback] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (user) {
      loadProofs();
    }
  }, [user]);

  const loadProofs = async () => {
    try {
      setLoading(true);

      const { data: quoteData } = await supabase
        .from('quotes')
        .select('id')
        .eq('company_id', user!.company_id)
        .eq('customer_email', user!.email);

      if (!quoteData || quoteData.length === 0) {
        setProofs([]);
        setLoading(false);
        return;
      }

      const quoteIds = quoteData.map(q => q.id);

      const { data, error } = await supabase
        .from('proofs')
        .select(`
          id,
          quote_id,
          proof_version,
          status,
          composite_image_url,
          created_at,
          approved_at,
          rejected_at,
          feedback,
          quotes!inner(quote_number)
        `)
        .in('quote_id', quoteIds)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formattedProofs = data?.map((proof: any) => ({
        ...proof,
        quote_number: proof.quotes?.quote_number || 'N/A',
      })) || [];

      setProofs(formattedProofs);
    } catch (error) {
      console.error('Error loading proofs:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'approved':
        return 'bg-green-100 text-green-800';
      case 'rejected':
        return 'bg-red-100 text-red-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const handleViewProof = async (proof: Proof) => {
    setSelectedProof(proof);

    if (user?.company_id && user?.customer_id) {
      await portalAnalyticsService.trackEvent({
        companyId: user.company_id,
        customerId: user.customer_id,
        eventType: 'proof_viewed',
        resourceType: 'proof',
        resourceId: proof.id
      });
    }
  };

  const handleApprove = async () => {
    if (!selectedProof) return;

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('proofs')
        .update({
          status: 'approved',
          approved_at: new Date().toISOString(),
          feedback: feedback || null,
        })
        .eq('id', selectedProof.id);

      if (error) throw error;

      if (user?.company_id && user?.customer_id) {
        await portalAnalyticsService.trackEvent({
          companyId: user.company_id,
          customerId: user.customer_id,
          eventType: 'proof_approved',
          resourceType: 'proof',
          resourceId: selectedProof.id
        });
      }

      alert('Proof approved successfully!');
      setSelectedProof(null);
      setFeedback('');
      loadProofs();
    } catch (error) {
      console.error('Error approving proof:', error);
      alert('Failed to approve proof. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!selectedProof) return;

    if (!feedback.trim()) {
      alert('Please provide feedback for rejection.');
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('proofs')
        .update({
          status: 'rejected',
          rejected_at: new Date().toISOString(),
          feedback: feedback,
        })
        .eq('id', selectedProof.id);

      if (error) throw error;

      if (user?.company_id && user?.customer_id) {
        await portalAnalyticsService.trackEvent({
          companyId: user.company_id,
          customerId: user.customer_id,
          eventType: 'proof_rejected',
          resourceType: 'proof',
          resourceId: selectedProof.id
        });
      }

      alert('Proof rejected. Feedback has been sent.');
      setSelectedProof(null);
      setFeedback('');
      loadProofs();
    } catch (error) {
      console.error('Error rejecting proof:', error);
      alert('Failed to reject proof. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <PortalLayout activeTab="proofs">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
        </div>
      </PortalLayout>
    );
  }

  if (selectedProof) {
    return (
      <PortalLayout activeTab="proofs">
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">
              Proof for Quote {selectedProof.quote_number} (v{selectedProof.proof_version})
            </h2>
            <button
              onClick={() => {
                setSelectedProof(null);
                setFeedback('');
              }}
              className="text-sm text-blue-600 hover:text-blue-700"
            >
              Back to Proofs
            </button>
          </div>

          <div className="p-6 space-y-6">
            <div className="flex items-center gap-4">
              <span className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${getStatusColor(selectedProof.status)}`}>
                {selectedProof.status}
              </span>
              <span className="text-sm text-gray-600">
                Created: {new Date(selectedProof.created_at).toLocaleDateString()}
              </span>
            </div>

            {selectedProof.composite_image_url && (
              <div className="bg-gray-100 rounded-lg p-4">
                <img
                  src={selectedProof.composite_image_url}
                  alt="Proof"
                  className="max-w-full h-auto mx-auto"
                />
              </div>
            )}

            {selectedProof.feedback && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start gap-2">
                  <MessageSquare className="w-5 h-5 text-blue-600 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-blue-900 mb-1">Previous Feedback</p>
                    <p className="text-sm text-blue-800">{selectedProof.feedback}</p>
                  </div>
                </div>
              </div>
            )}

            {selectedProof.status === 'pending' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Feedback (optional for approval, required for rejection)
                  </label>
                  <textarea
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                    rows={4}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Add your comments or requested changes..."
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={handleApprove}
                    disabled={submitting}
                    className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                  >
                    <CheckCircle className="w-5 h-5" />
                    {submitting ? 'Processing...' : 'Approve Proof'}
                  </button>
                  <button
                    onClick={handleReject}
                    disabled={submitting}
                    className="flex items-center gap-2 px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                  >
                    <XCircle className="w-5 h-5" />
                    {submitting ? 'Processing...' : 'Request Changes'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </PortalLayout>
    );
  }

  return (
    <PortalLayout activeTab="proofs">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Your Proofs</h1>
        </div>

        {proofs.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <CheckCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No proofs found</h3>
            <p className="text-gray-600">You don't have any proofs to review yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {proofs.map((proof) => (
              <div key={proof.id} className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow">
                <div className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="text-sm font-medium text-gray-900">
                        Quote {proof.quote_number}
                      </h3>
                      <p className="text-xs text-gray-500">Version {proof.proof_version}</p>
                    </div>
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(proof.status)}`}>
                      {proof.status}
                    </span>
                  </div>

                  {proof.composite_image_url && (
                    <div className="bg-gray-100 rounded-lg mb-3 overflow-hidden">
                      <img
                        src={proof.composite_image_url}
                        alt="Proof preview"
                        className="w-full h-48 object-contain"
                      />
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">
                      {new Date(proof.created_at).toLocaleDateString()}
                    </span>
                    <button
                      onClick={() => handleViewProof(proof)}
                      className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
                    >
                      <Eye className="w-4 h-4" />
                      View
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </PortalLayout>
  );
}
