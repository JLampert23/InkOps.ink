import { useState, useEffect } from 'react';
import { Image, Search, Check, X, MessageSquare, Eye, AlertCircle, FileImage } from 'lucide-react';
import { format } from 'date-fns';
import { Proof, ProofComment } from '../../types/production';
import { productionService } from '../../services/production-service';

export function ProofsManager() {
  const [proofs, setProofs] = useState<Proof[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedProof, setSelectedProof] = useState<Proof | null>(null);
  const [showProofModal, setShowProofModal] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');

  useEffect(() => {
    loadProofs();
  }, [statusFilter]);

  const loadProofs = async () => {
    setLoading(true);
    try {
      const filters = statusFilter !== 'all' ? { status: statusFilter } : undefined;
      const data = await productionService.fetchProofs(filters);
      setProofs(data);
    } catch (error) {
      console.error('Error loading proofs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (proofId: string) => {
    try {
      await productionService.approveProof(proofId, 'current-user');
      await loadProofs();
      setShowProofModal(false);
    } catch (error) {
      console.error('Error approving proof:', error);
    }
  };

  const handleReject = async (proofId: string) => {
    if (!rejectionReason.trim()) {
      alert('Please provide a rejection reason');
      return;
    }
    try {
      await productionService.rejectProof(proofId, rejectionReason);
      await loadProofs();
      setShowProofModal(false);
      setRejectionReason('');
    } catch (error) {
      console.error('Error rejecting proof:', error);
    }
  };

  const handleAddComment = async (proofId: string) => {
    if (!newComment.trim()) return;
    try {
      await productionService.addProofComment(proofId, 'current-user', newComment);
      setNewComment('');
      if (selectedProof) {
        const updatedProof = await productionService.fetchProofById(proofId);
        if (updatedProof) setSelectedProof(updatedProof);
      }
    } catch (error) {
      console.error('Error adding comment:', error);
    }
  };

  const filteredProofs = proofs.filter(proof =>
    proof.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    proof.orderNumber.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusBadge = (status: Proof['status']) => {
    const statusConfig = {
      pending: { label: 'Pending Review', color: 'bg-yellow-100 text-yellow-800', icon: AlertCircle },
      approved: { label: 'Approved', color: 'bg-green-100 text-green-800', icon: Check },
      rejected: { label: 'Rejected', color: 'bg-red-100 text-red-800', icon: X },
      revision_requested: { label: 'Revision Requested', color: 'bg-orange-100 text-orange-800', icon: AlertCircle },
    };

    const config = statusConfig[status];
    const Icon = config.icon;

    return (
      <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${config.color}`}>
        <Icon className="w-3 h-3" />
        {config.label}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Proofs & Approvals</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Review and approve artwork proofs</p>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" />
            <input
              type="text"
              placeholder="Search by customer or order number..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending Review</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="revision_requested">Revision Requested</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-12 text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Loading proofs...</p>
        </div>
      ) : filteredProofs.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-12 text-center">
          <FileImage className="w-12 h-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No proofs found</h3>
          <p className="text-gray-600 dark:text-gray-400">Proofs will appear here when they are uploaded</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProofs.map((proof) => (
            <div key={proof.id} className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 overflow-hidden hover:shadow-md transition-shadow">
              <div className="aspect-video bg-gray-100 relative">
                {proof.thumbnailUrl ? (
                  <img
                    src={proof.thumbnailUrl}
                    alt={`Proof for ${proof.orderNumber}`}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Image className="w-12 h-12 text-gray-400" />
                  </div>
                )}
                <div className="absolute top-2 right-2">
                  {getStatusBadge(proof.status)}
                </div>
                <div className="absolute bottom-2 left-2 bg-black bg-opacity-60 text-white px-2 py-1 rounded text-xs">
                  Version {proof.version}
                </div>
              </div>

              <div className="p-4">
                <div className="mb-3">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Order #{proof.orderNumber}</h3>
                  <p className="text-xs text-gray-600 dark:text-gray-400">{proof.customerName}</p>
                </div>

                <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-3">
                  <span>{format(new Date(proof.createdAt), 'MMM d, yyyy')}</span>
                  <div className="flex items-center gap-1">
                    <MessageSquare className="w-3 h-3" />
                    {proof.comments.length}
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setSelectedProof(proof);
                      setShowProofModal(true);
                    }}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                  >
                    <Eye className="w-4 h-4" />
                    View
                  </button>
                  {proof.status === 'pending' && (
                    <>
                      <button
                        onClick={() => handleApprove(proof.id)}
                        className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                        title="Approve"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          setSelectedProof(proof);
                          setShowProofModal(true);
                        }}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Reject"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showProofModal && selectedProof && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 dark:border-slate-700">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">Proof Review</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Order #{selectedProof.orderNumber} - Version {selectedProof.version}</p>
                </div>
                <button
                  onClick={() => {
                    setShowProofModal(false);
                    setRejectionReason('');
                  }}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              <div className="bg-gray-100 dark:bg-slate-700 rounded-lg overflow-hidden">
                {selectedProof.artworkUrl ? (
                  <img
                    src={selectedProof.artworkUrl}
                    alt={`Proof for ${selectedProof.orderNumber}`}
                    className="w-full h-auto"
                  />
                ) : (
                  <div className="aspect-video flex items-center justify-center">
                    <Image className="w-24 h-24 text-gray-400" />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Customer</label>
                  <p className="text-base text-gray-900 dark:text-white mt-1">{selectedProof.customerName}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Status</label>
                  <div className="mt-1">{getStatusBadge(selectedProof.status)}</div>
                </div>
              </div>

              <div className="border-t border-gray-200 dark:border-slate-700 pt-6">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                  <MessageSquare className="w-4 h-4" />
                  Comments ({selectedProof.comments.length})
                </h4>
                <div className="space-y-3 mb-4 max-h-48 overflow-y-auto">
                  {selectedProof.comments.length === 0 ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">No comments yet</p>
                  ) : (
                    selectedProof.comments.map((comment) => (
                      <div key={comment.id} className="bg-gray-50 dark:bg-slate-700 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-gray-900 dark:text-white">{comment.userName}</span>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {format(new Date(comment.createdAt), 'MMM d, h:mm a')}
                          </span>
                        </div>
                        <p className="text-sm text-gray-700 dark:text-gray-300">{comment.comment}</p>
                      </div>
                    ))
                  )}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Add a comment..."
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        handleAddComment(selectedProof.id);
                      }
                    }}
                  />
                  <button
                    onClick={() => handleAddComment(selectedProof.id)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Post
                  </button>
                </div>
              </div>

              {selectedProof.status === 'pending' && (
                <div className="border-t border-gray-200 dark:border-slate-700 pt-6">
                  <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3">Approval Actions</h4>
                  <div className="space-y-3">
                    <button
                      onClick={() => handleApprove(selectedProof.id)}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                    >
                      <Check className="w-5 h-5" />
                      Approve Proof
                    </button>
                    <div className="space-y-2">
                      <textarea
                        value={rejectionReason}
                        onChange={(e) => setRejectionReason(e.target.value)}
                        placeholder="Reason for rejection or revision request..."
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                      />
                      <button
                        onClick={() => handleReject(selectedProof.id)}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                      >
                        <X className="w-5 h-5" />
                        Request Revision / Reject
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
