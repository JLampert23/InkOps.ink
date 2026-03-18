import { useState, useEffect } from 'react';
import { X, User, Mail, Phone, Star, FileText, Loader2, Plus } from 'lucide-react';
import { supabase } from '../../lib/supabase-client';

interface Contact {
  id: string;
  full_name: string;
  title: string | null;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  is_primary: boolean;
}

interface ContactSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  customerId: string;
  customerName: string;
  onCreateQuote: (customerId: string, contactId?: string) => void;
  onAddContact?: (customerId: string) => void;
}

export default function ContactSelectionModal({
  isOpen,
  onClose,
  customerId,
  customerName,
  onCreateQuote,
  onAddContact
}: ContactSelectionModalProps) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen && customerId) {
      loadContacts();
    }
  }, [isOpen, customerId]);

  const loadContacts = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('customer_contacts')
        .select('id, full_name, title, email, phone, mobile, is_primary')
        .eq('customer_id', customerId)
        .order('is_primary', { ascending: false })
        .order('full_name', { ascending: true });

      if (error) throw error;
      setContacts(data || []);
    } catch (error) {
      console.error('Error loading contacts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateQuote = (contactId?: string) => {
    onCreateQuote(customerId, contactId);
    onClose();
  };

  const handleAddContact = () => {
    if (onAddContact) {
      onAddContact(customerId);
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Select Contact for Quote
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {customerName}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
          ) : contacts.length === 0 ? (
            <div className="text-center py-12">
              <User className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                No contacts found for this customer
              </p>
              {onAddContact && (
                <button
                  onClick={handleAddContact}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add Contact First
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {contacts.map((contact) => (
                <div
                  key={contact.id}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    contact.is_primary
                      ? 'border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-semibold text-gray-900 dark:text-white">
                          {contact.full_name}
                        </h3>
                        {contact.is_primary && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300">
                            <Star className="w-3 h-3 fill-current" />
                            Primary
                          </span>
                        )}
                      </div>

                      {contact.title && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                          {contact.title}
                        </p>
                      )}

                      <div className="space-y-1">
                        {contact.email && (
                          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                            <Mail className="w-4 h-4 flex-shrink-0" />
                            <span className="truncate">{contact.email}</span>
                          </div>
                        )}
                        {(contact.phone || contact.mobile) && (
                          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                            <Phone className="w-4 h-4 flex-shrink-0" />
                            <span>{contact.phone || contact.mobile}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => handleCreateQuote(contact.id)}
                      className="flex-shrink-0 inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                    >
                      <FileText className="w-4 h-4" />
                      Create Quote
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-slate-700 flex items-center justify-between">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {contacts.length} {contacts.length === 1 ? 'contact' : 'contacts'} available
          </p>
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
