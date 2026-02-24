import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase-client';
import { Image, Loader2, CheckCircle, XCircle, Clock, Eye, ThumbsUp, ThumbsDown, MessageSquare, X, AlertCircle, FileText } from 'lucide-react';
import { format } from 'date-fns';

interface Proof {
  id: string;
  proof_number: string;
  proof_version: number;
  composite_image_url: string | null;
  garment_image_url: string | null;
  garment_name: string | null;
  garment_brand: string | null;
  status: string;
  notes: string | null;
  created_at: string;
  approved_at: string | null;
  rejected_at: string | null;
  type_of_work: string | null;
  group_label: string | null;
  quote?: {
    quote_number: string;
    nickname: string | null;
  } | null;
}

interface PortalProofsTabProps {
  customerId: string;
  companyId: string;
}

export function PortalProofsTab({ customerId, companyId }: PortalProofsTabProps) {
  const [proofs, setProofs] = useState<Proof[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedProof, setSelectedProof] = useState<Proof | null>(null);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [approvalAction, setApprovalAction] = useState<'approve' | 'reject' | null>(null);
  const [rejectionNotes, setRejectionNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadProofs();
  }, [customerId, companyId]);

  const loadProofs = async () => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('proofs')
        .select(`
          id,
          proof_number,
          proof_version,
          composite_image_url,
          garment_image_url,
          garment_name,
          garment_brand,
          status,
          notes,
          created_at,
          approved_at,
          rejected_at,
          type_of_work,
          group_label,
          quote_id
        `)
        .eq('customer_id', customerId)
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      const proofsWithQuotes = await Promise.all(
        (data || []).map(async (proof) => {
          if (proof.quote_id) {
            const { data: quoteData } = await supabase
              .from('quotes')
              .select('quote_number, nickname')
              .eq('id', proof.quote_id)
              .maybeSingle();
            return { ...proof, quote: quoteData };
          }
          return { ...proof, quote: null };
        })
      );

      setProofs(proofsWithQuotes);
    } catch (err) {
      console.error('Error loading proofs:', err);
      setError('Failed to load proofs');
    } finally {
      setLoading(false);
    }
  };

  const handleApprovalAction = (proof: Proof, action: 'approve' | 'reject') => {
    setSelectedProof(proof);
    setApprovalAction(action);
    setRejectionNotes('');
    setShowApprovalModal(true);
  };

  const submitApproval = async () => {
    if (!selectedProof || !approvalAction) return;

    setSubmitting(true);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/portal-proof-approval`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            proofId: selectedProof.id,
            customerId,
            companyId,
            action: approvalAction,
            notes: approvalAction === 'reject' ? rejectionNotes : null,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update proof status');
      }

      await loadProofs();
      setShowApprovalModal(false);
      setSelectedProof(null);
      setApprovalAction(null);
      setRejectionNotes('');
    } catch (err) {
      console.error('Error updating proof status:', err);
      setError(err instanceof Error ? err.message : 'Failed to update proof status');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
            <CheckCircle className="w-3 h-3" />
            Approved
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800">
            <XCircle className="w-3 h-3" />
            Rejected
          </span>
        );
      case 'pending':
      case 'sent':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800">
            <Clock className="w-3 h-3" />
            Pending Review
          </span>
        );
    }
  };

  const isPendingApproval = (status: string) => {
    const s = status?.toLowerCase();
    return s === 'pending' || s === 'sent' || s === 'awaiting_approval';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <XCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
        <p className="text-gray-600">{error}</p>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <h2 className="text-lg font-semibold text-gray-900">Proof Approvals</h2>
          <p className="text-sm text-gray-600 mt-1">Review and approve proofs for your orders</p>
        </div>

        {proofs.length === 0 ? (
          <div className="text-center py-12">
            <Image className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No proofs available</h3>
            <p className="text-gray-600">Proofs will appear here when they are ready for your review.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {proofs.map((proof) => (
              <div key={proof.id} className="p-6 hover:bg-gray-50 transition-colors">
                <div className="flex gap-6">
                  <div className="flex-shrink-0">
                    {proof.composite_image_url ? (
                      <img
                        src={proof.composite_image_url}
                        alt={`Proof ${proof.proof_number}`}
                        className="w-32 h-32 object-contain rounded-lg border border-gray-200 bg-gray-50"
                      />
                    ) : proof.garment_image_url ? (
                      <img
                        src={proof.garment_image_url}
                        alt={proof.garment_name || 'Garment'}
                        className="w-32 h-32 object-contain rounded-lg border border-gray-200 bg-gray-50"
                      />
                    ) : (
                      <div className="w-32 h-32 bg-gray-100 rounded-lg border border-gray-200 flex items-center justify-center">
                        <Image className="w-8 h-8 text-gray-400" />
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="text-lg font-medium text-gray-900">
                          {proof.proof_number}
                          {proof.proof_version > 1 && (
                            <span className="ml-2 text-sm text-gray-500">v{proof.proof_version}</span>
                          )}
                        </h3>
                        {proof.group_label && (
                          <p className="text-sm text-gray-600 mt-0.5">{proof.group_label}</p>
                        )}
                      </div>
                      {getStatusBadge(proof.status)}
                    </div>

                    <div className="mt-2 space-y-1">
                      {proof.garment_name && (
                        <p className="text-sm text-gray-600">
                          <span className="font-medium">Garment:</span> {proof.garment_brand && `${proof.garment_brand} `}{proof.garment_name}
                        </p>
                      )}
                      {proof.type_of_work && (
                        <p className="text-sm text-gray-600">
                          <span className="font-medium">Decoration:</span> {proof.type_of_work}
                        </p>
                      )}
                      {proof.quote && (
                        <p className="text-sm text-gray-600">
                          <span className="font-medium">Quote:</span> {proof.quote.quote_number}
                          {proof.quote.nickname && ` - ${proof.quote.nickname}`}
                        </p>
                      )}
                      <p className="text-sm text-gray-500">
                        Sent on {format(new Date(proof.created_at), 'MMM d, yyyy')}
                      </p>
                    </div>

                    {proof.status === 'rejected' && proof.notes && (
                      <div className="mt-3 p-3 bg-red-50 border border-red-100 rounded-lg">
                        <p className="text-sm text-red-800">
                          <span className="font-medium">Rejection reason:</span> {proof.notes}
                        </p>
                      </div>
                    )}

                    {proof.approved_at && (
                      <p className="mt-2 text-sm text-green-600">
                        Approved on {format(new Date(proof.approved_at), 'MMM d, yyyy')}
                      </p>
                    )}

                    {proof.rejected_at && (
                      <p className="mt-2 text-sm text-red-600">
                        Rejected on {format(new Date(proof.rejected_at), 'MMM d, yyyy')}
                      </p>
                    )}

                    {isPendingApproval(proof.status) && (
                      <div className="mt-4 flex items-center gap-3">
                        <button
                          onClick={() => handleApprovalAction(proof, 'approve')}
                          className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
                        >
                          <ThumbsUp className="w-4 h-4" />
                          Approve
                        </button>
                        <button
                          onClick={() => handleApprovalAction(proof, 'reject')}
                          className="inline-flex items-center gap-2 px-4 py-2 bg-white text-red-600 text-sm font-medium rounded-lg border border-red-300 hover:bg-red-50 transition-colors"
                        >
                          <ThumbsDown className="w-4 h-4" />
                          Request Changes
                        </button>
                        {proof.composite_image_url && (
                          <a
                            href={proof.composite_image_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 px-4 py-2 text-gray-600 text-sm font-medium rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
                          >
                            <Eye className="w-4 h-4" />
                            View Full Size
                          </a>
                        )}
                      </div>
                    )}

                    {!isPendingApproval(proof.status) && proof.composite_image_url && (
                      <div className="mt-4">
                        <a
                          href={proof.composite_image_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 px-4 py-2 text-gray-600 text-sm font-medium rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
                        >
                          <Eye className="w-4 h-4" />
                          View Full Size
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showApprovalModal && selectedProof && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                {approvalAction === 'approve' ? 'Approve Proof' : 'Request Changes'}
              </h2>
              <button
                onClick={() => setShowApprovalModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="p-6">
              <div className="flex gap-4 mb-6">
                {selectedProof.composite_image_url && (
                  <img
                    src={selectedProof.composite_image_url}
                    alt={`Proof ${selectedProof.proof_number}`}
                    className="w-24 h-24 object-contain rounded-lg border border-gray-200"
                  />
                )}
                <div>
                  <h3 className="font-medium text-gray-900">{selectedProof.proof_number}</h3>
                  {selectedProof.garment_name && (
                    <p className="text-sm text-gray-600">{selectedProof.garment_name}</p>
                  )}
                  {selectedProof.quote && (
                    <p className="text-sm text-gray-500">Quote: {selectedProof.quote.quote_number}</p>
                  )}
                </div>
              </div>

              {approvalAction === 'approve' ? (
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-green-800">Confirm Approval</p>
                      <p className="text-sm text-green-700 mt-1">
                        By approving this proof, you confirm that the design, placement, and colors are correct.
                        Production will proceed based on this approved proof.
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg mb-4">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium text-yellow-800">Request Changes</p>
                        <p className="text-sm text-yellow-700 mt-1">
                          Please describe what changes you would like made to this proof.
                        </p>
                      </div>
                    </div>
                  </div>

                  <label className="block">
                    <span className="text-sm font-medium text-gray-700">
                      Change Request Notes <span className="text-red-500">*</span>
                    </span>
                    <textarea
                      value={rejectionNotes}
                      onChange={(e) => setRejectionNotes(e.target.value)}
                      placeholder="Please describe the changes you need..."
                      rows={4}
                      className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </label>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-gray-200 bg-gray-50 flex gap-3">
              <button
                onClick={() => setShowApprovalModal(false)}
                className="flex-1 px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={submitApproval}
                disabled={submitting || (approvalAction === 'reject' && !rejectionNotes.trim())}
                className={`flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 text-white rounded-lg disabled:opacity-50 ${
                  approvalAction === 'approve'
                    ? 'bg-green-600 hover:bg-green-700'
                    : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Processing...
                  </>
                ) : approvalAction === 'approve' ? (
                  <>
                    <ThumbsUp className="w-4 h-4" />
                    Approve Proof
                  </>
                ) : (
                  <>
                    <ThumbsDown className="w-4 h-4" />
                    Submit Changes
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
