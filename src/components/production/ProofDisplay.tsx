import React, { useState, useEffect } from 'react';
import {
  Eye,
  Edit,
  Trash2,
  CheckCircle,
  XCircle,
  Clock,
  Image as ImageIcon,
  Palette,
  Ruler,
} from 'lucide-react';
import { supabase } from '../../lib/supabase-client';
import { format } from 'date-fns';

interface Proof {
  id: string;
  proof_number: string;
  proof_version: number;
  garment_image_url: string;
  garment_name: string;
  print_width: number;
  print_height: number;
  print_depth: number;
  print_unit: string;
  status: string;
  created_at: string;
  proof_artwork: Array<{
    id: string;
    artwork_url: string;
    artwork_name: string;
  }>;
  proof_colors: Array<{
    id: string;
    color_type: string;
    color_name: string;
    color_code: string;
  }>;
}

interface ProofDisplayProps {
  lineItemId: string;
  onEdit: (proofId: string) => void;
  refreshTrigger?: number;
}

export default function ProofDisplay({ lineItemId, onEdit, refreshTrigger }: ProofDisplayProps) {
  const [proofs, setProofs] = useState<Proof[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedProofId, setExpandedProofId] = useState<string | null>(null);

  useEffect(() => {
    loadProofs();
  }, [lineItemId, refreshTrigger]);

  const loadProofs = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/proofs-api/line-items/${lineItemId}`;
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) throw new Error('Failed to load proofs');

      const { proofs: loadedProofs } = await response.json();
      setProofs(loadedProofs || []);
    } catch (error) {
      console.error('Error loading proofs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (proofId: string) => {
    if (!confirm('Are you sure you want to delete this proof?')) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/proofs-api/${proofId}`;
      const response = await fetch(url, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) throw new Error('Failed to delete proof');

      loadProofs();
    } catch (error) {
      console.error('Error deleting proof:', error);
      alert('Failed to delete proof');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
      case 'pending_approval':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
      case 'approved':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
      case 'rejected':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <CheckCircle className="w-4 h-4" />;
      case 'rejected':
        return <XCircle className="w-4 h-4" />;
      case 'pending_approval':
        return <Clock className="w-4 h-4" />;
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (proofs.length === 0) {
    return null;
  }

  return (
    <div className="mt-4 space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
        <ImageIcon className="w-4 h-4" />
        Proofs ({proofs.length})
      </div>

      {proofs.map((proof) => (
        <div
          key={proof.id}
          className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg overflow-hidden"
        >
          {/* Proof Header */}
          <div className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-4 flex-1">
              {/* Thumbnail */}
              <div
                className="w-20 h-20 bg-gray-100 dark:bg-slate-700 rounded-lg border border-gray-300 dark:border-slate-600 overflow-hidden cursor-pointer flex-shrink-0"
                onClick={() => setExpandedProofId(expandedProofId === proof.id ? null : proof.id)}
              >
                {proof.garment_image_url ? (
                  <img
                    src={proof.garment_image_url}
                    alt={proof.garment_name}
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <ImageIcon className="w-8 h-8 text-gray-400" />
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-semibold text-gray-900 dark:text-white">
                    {proof.proof_number}
                  </h4>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(proof.status)}`}>
                    {getStatusIcon(proof.status)}
                    {proof.status.replace('_', ' ')}
                  </span>
                  {proof.proof_version > 1 && (
                    <span className="px-2 py-0.5 bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 rounded-full text-xs font-medium">
                      v{proof.proof_version}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                  {proof.garment_name && (
                    <span className="flex items-center gap-1">
                      <ImageIcon className="w-3 h-3" />
                      {proof.garment_name}
                    </span>
                  )}
                  {proof.print_width && proof.print_height && (
                    <span className="flex items-center gap-1">
                      <Ruler className="w-3 h-3" />
                      {proof.print_width} × {proof.print_height} {proof.print_unit}
                    </span>
                  )}
                  {proof.proof_colors && proof.proof_colors.length > 0 && (
                    <span className="flex items-center gap-1">
                      <Palette className="w-3 h-3" />
                      {proof.proof_colors.length} color{proof.proof_colors.length !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>

                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Created {format(new Date(proof.created_at), 'MMM d, yyyy')}
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setExpandedProofId(expandedProofId === proof.id ? null : proof.id)}
                className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                title="View Details"
              >
                <Eye className="w-4 h-4" />
              </button>
              <button
                onClick={() => onEdit(proof.id)}
                className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                title="Edit Proof"
              >
                <Edit className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleDelete(proof.id)}
                className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                title="Delete Proof"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Expanded Details */}
          {expandedProofId === proof.id && (
            <div className="border-t border-gray-200 dark:border-slate-600 p-4 bg-gray-50 dark:bg-slate-700/50">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Preview */}
                <div>
                  <h5 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Preview</h5>
                  <div className="bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded-lg p-4 flex items-center justify-center min-h-[200px]">
                    {proof.garment_image_url ? (
                      <img
                        src={proof.garment_image_url}
                        alt={proof.garment_name}
                        className="max-w-full max-h-[200px] object-contain"
                      />
                    ) : (
                      <ImageIcon className="w-16 h-16 text-gray-400" />
                    )}
                  </div>
                </div>

                {/* Details */}
                <div className="space-y-4">
                  {/* Artwork */}
                  {proof.proof_artwork && proof.proof_artwork.length > 0 && (
                    <div>
                      <h5 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                        Artwork Files ({proof.proof_artwork.length})
                      </h5>
                      <div className="space-y-2">
                        {proof.proof_artwork.map((artwork) => (
                          <div
                            key={artwork.id}
                            className="flex items-center gap-2 p-2 bg-white dark:bg-slate-800 rounded border border-gray-200 dark:border-slate-600"
                          >
                            <img
                              src={artwork.artwork_url}
                              alt={artwork.artwork_name}
                              className="w-10 h-10 object-contain bg-gray-100 dark:bg-slate-700 rounded"
                            />
                            <span className="text-sm text-gray-700 dark:text-gray-300 truncate">
                              {artwork.artwork_name}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Colors */}
                  {proof.proof_colors && proof.proof_colors.length > 0 && (
                    <div>
                      <h5 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                        Selected Colors
                      </h5>
                      <div className="flex flex-wrap gap-2">
                        {proof.proof_colors.map((color) => (
                          <div
                            key={color.id}
                            className="flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-slate-800 rounded-full border border-gray-200 dark:border-slate-600"
                          >
                            <div
                              className="w-4 h-4 rounded-full border border-gray-300 dark:border-slate-600"
                              style={{ backgroundColor: color.color_code }}
                            />
                            <span className="text-xs text-gray-700 dark:text-gray-300">
                              {color.color_name}
                            </span>
                            <span className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                              ({color.color_type})
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Print Size */}
                  {proof.print_width && proof.print_height && (
                    <div>
                      <h5 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                        Print Size
                      </h5>
                      <div className="text-sm text-gray-700 dark:text-gray-300">
                        {proof.print_width} × {proof.print_height}
                        {proof.print_depth && ` × ${proof.print_depth}`} {proof.print_unit}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
