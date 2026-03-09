import React, { useState, useEffect, useRef } from 'react';
import {
  Plus,
  Edit,
  Trash2,
  Save,
  X,
  Power,
  PowerOff,
  Code,
  CheckCircle2,
  Copy,
} from 'lucide-react';
import { useNotification } from '../../contexts/NotificationContext';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase-client';
import ShortCodePicker from './ShortCodePicker';
import RichTextEmailEditor from './RichTextEmailEditor';
import {
  CommunicationTemplateService,
  validateTemplate,
} from '../../services/communication-template-service';
import type {
  CommunicationTemplate,
  TemplateType,
  TemplateValidation,
} from '../../types/communication-template';
import {
  TEMPLATE_TYPE_METADATA,
} from '../../types/communication-template';

export default function CommunicationTemplatesManager() {
  const { showNotification } = useNotification();
  const { user, userProfile } = useAuth();
  const [templates, setTemplates] = useState<CommunicationTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEditor, setShowEditor] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<CommunicationTemplate | null>(null);
  const [showShortCodes, setShowShortCodes] = useState(false);

  // Form state
  const [templateType, setTemplateType] = useState<TemplateType>('quote_email_default');
  const [templateName, setTemplateName] = useState('');
  const [subjectTemplate, setSubjectTemplate] = useState('');
  const [bodyTemplate, setBodyTemplate] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [autoAttachQuoteLink, setAutoAttachQuoteLink] = useState(true);
  const [autoAttachPdf, setAutoAttachPdf] = useState(false);
  const [autoAttachMockups, setAutoAttachMockups] = useState(false);
  const [autoAttachTerms, setAutoAttachTerms] = useState(false);

  // Validation state
  const [validation, setValidation] = useState<TemplateValidation | null>(null);

  const subjectRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const [activeField, setActiveField] = useState<'subject' | 'body'>('body');

  const isAdmin = userProfile?.role === 'super_admin' || userProfile?.role === 'admin';

  useEffect(() => {
    console.log('User Profile:', { email: userProfile?.email, role: userProfile?.role, isAdmin });
  }, [userProfile, isAdmin]);

  useEffect(() => {
    if (user) {
      loadTemplates();
    }
  }, [user]);

  useEffect(() => {
    // Auto-validate as user types
    if (showEditor && (subjectTemplate || bodyTemplate)) {
      const result = validateTemplate(subjectTemplate, bodyTemplate, templateType);
      setValidation(result);
    }
  }, [subjectTemplate, bodyTemplate, templateType, showEditor]);

  async function loadTemplates() {
    try {
      setLoading(true);
      const templates = await CommunicationTemplateService.listTemplates();
      setTemplates(templates);
    } catch (error: any) {
      showNotification('error', 'Failed to Load Templates', error.message);
    } finally {
      setLoading(false);
    }
  }

  function openEditor(template?: CommunicationTemplate) {
    if (template) {
      setEditingTemplate(template);
      setTemplateType(template.template_type as TemplateType);
      setTemplateName(template.template_name);
      setSubjectTemplate(template.subject_template);
      setBodyTemplate(template.body_template);
      setIsActive(template.is_active);
      setAutoAttachQuoteLink(template.auto_attach_quote_link);
      setAutoAttachPdf(template.auto_attach_pdf);
      setAutoAttachMockups(template.auto_attach_mockups);
      setAutoAttachTerms(template.auto_attach_terms);
    } else {
      // New template - use defaults from metadata
      const metadata = TEMPLATE_TYPE_METADATA[templateType];
      setEditingTemplate(null);
      setTemplateName('');
      setSubjectTemplate(metadata.defaultSubject);
      setBodyTemplate(metadata.defaultBody);
      setIsActive(true);
      setAutoAttachQuoteLink(metadata.supportedAttachments.quoteLink);
      setAutoAttachPdf(metadata.supportedAttachments.pdf);
      setAutoAttachMockups(metadata.supportedAttachments.mockups);
      setAutoAttachTerms(metadata.supportedAttachments.terms);
    }
    setShowEditor(true);
    setValidation(null);
  }

  function closeEditor() {
    setShowEditor(false);
    setEditingTemplate(null);
    setValidation(null);
  }

  function handleTemplateTypeChange(newType: TemplateType) {
    setTemplateType(newType);
    if (!editingTemplate) {
      // Load defaults for new template type
      const metadata = TEMPLATE_TYPE_METADATA[newType];
      setSubjectTemplate(metadata.defaultSubject);
      setBodyTemplate(metadata.defaultBody);
      setAutoAttachQuoteLink(metadata.supportedAttachments.quoteLink);
      setAutoAttachPdf(metadata.supportedAttachments.pdf);
      setAutoAttachMockups(metadata.supportedAttachments.mockups);
      setAutoAttachTerms(metadata.supportedAttachments.terms);
    }
  }

  function handleInsertShortCode(shortCode: string) {
    if (activeField === 'subject') {
      const input = subjectRef.current;
      if (input) {
        const start = input.selectionStart || 0;
        const end = input.selectionEnd || 0;
        const newSubject =
          subjectTemplate.substring(0, start) + shortCode + subjectTemplate.substring(end);
        setSubjectTemplate(newSubject);
        setTimeout(() => {
          input.focus();
          input.setSelectionRange(start + shortCode.length, start + shortCode.length);
        }, 0);
      }
    } else {
      const textarea = bodyRef.current;
      if (textarea) {
        const start = textarea.selectionStart || 0;
        const end = textarea.selectionEnd || 0;
        const newBody =
          bodyTemplate.substring(0, start) + shortCode + bodyTemplate.substring(end);
        setBodyTemplate(newBody);
        setTimeout(() => {
          textarea.focus();
          textarea.setSelectionRange(start + shortCode.length, start + shortCode.length);
        }, 0);
      }
    }
  }

  async function handleSave(overrideValidation = false) {
    if (!isAdmin) {
      showNotification('error', 'Permission Denied', 'Only admins can create/edit templates');
      return;
    }

    // Validate before saving
    const result = validateTemplate(subjectTemplate, bodyTemplate, templateType);
    setValidation(result);

    // Check for syntax errors
    if (!result.isValid) {
      showNotification(
        'error',
        'Validation Failed',
        'Please fix template errors before saving'
      );
      return;
    }

    try {
      const templateData = {
        template_type: templateType,
        template_name: templateName,
        subject_template: subjectTemplate,
        body_template: bodyTemplate,
        is_active: isActive,
        auto_attach_quote_link: autoAttachQuoteLink,
        auto_attach_pdf: autoAttachPdf,
        auto_attach_mockups: autoAttachMockups,
        auto_attach_terms: autoAttachTerms,
        override_required_validation: overrideValidation,
      };

      if (editingTemplate) {
        await CommunicationTemplateService.updateTemplate(editingTemplate.id, templateData);
        showNotification('success', 'Template Updated', 'Email template saved successfully');
      } else {
        await CommunicationTemplateService.createTemplate(templateData);
        showNotification('success', 'Template Created', 'Email template created successfully');
      }

      closeEditor();
      loadTemplates();
    } catch (error: any) {
      showNotification('error', 'Save Failed', error.message);
    }
  }

  async function handleDelete(templateId: string) {
    if (!isAdmin) {
      showNotification('error', 'Permission Denied', 'Only admins can delete templates');
      return;
    }

    if (!confirm('Are you sure you want to delete this template?')) {
      return;
    }

    try {
      await CommunicationTemplateService.deleteTemplate(templateId);
      showNotification('success', 'Template Deleted', 'Email template deleted successfully');
      loadTemplates();
    } catch (error: any) {
      showNotification('error', 'Delete Failed', error.message);
    }
  }

  async function handleToggleActive(template: CommunicationTemplate) {
    if (!isAdmin) {
      showNotification('error', 'Permission Denied', 'Only admins can activate/deactivate templates');
      return;
    }

    try {
      if (!template.is_active) {
        await CommunicationTemplateService.activateTemplate(template.id);
        showNotification('success', 'Template Activated', 'Template is now active');
      } else {
        await CommunicationTemplateService.deactivateTemplate(template.id);
        showNotification('success', 'Template Deactivated', 'Template is now inactive');
      }
      loadTemplates();
    } catch (error: any) {
      showNotification('error', 'Update Failed', error.message);
    }
  }

  async function handleClone(template: CommunicationTemplate) {
    if (!isAdmin) {
      showNotification('error', 'Permission Denied', 'Only admins can clone templates');
      return;
    }

    try {
      await CommunicationTemplateService.cloneTemplate(template.id);
      showNotification('success', 'Template Cloned', 'Template cloned successfully');
      loadTemplates();
    } catch (error: any) {
      showNotification('error', 'Clone Failed', error.message);
    }
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-600 dark:text-slate-400">Please sign in to access email templates.</div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-600 dark:text-slate-400">Loading templates...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-xl shadow-lg border border-slate-200 dark:border-slate-800">
        <div>
          <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 dark:from-blue-400 dark:to-cyan-400 bg-clip-text text-transparent">
            Email Templates
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Manage customizable email templates with short codes
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={() => openEditor()}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white rounded-lg transition-all font-semibold text-base shadow-md hover:shadow-lg"
          >
            <Plus className="w-5 h-5" />
            Create New Template
          </button>
        )}
      </div>

      {/* Template List */}
      {!showEditor && (
        <div className="grid grid-cols-1 gap-4">
          {templates.length === 0 ? (
            <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm rounded-xl border border-slate-200 dark:border-slate-800 p-8 text-center shadow-lg">
              <p className="text-slate-600 dark:text-slate-400">
                No email templates yet. Create your first template to get started.
              </p>
            </div>
          ) : (
            templates.map((template) => {
              const metadata = TEMPLATE_TYPE_METADATA[template.template_type as TemplateType];

              return (
                <div
                  key={template.id}
                  className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-lg hover:shadow-xl transition-all"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                          {template.template_name}
                        </h3>
                        <span
                          className={`px-2 py-1 text-xs font-medium rounded ${
                            template.is_active
                              ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                              : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'
                          }`}
                        >
                          {template.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                        {metadata?.label || template.template_type}
                      </p>
                      <div className="mt-3 space-y-1">
                        <div className="text-sm">
                          <span className="text-slate-600 dark:text-slate-400">Subject: </span>
                          <span className="text-slate-900 dark:text-white font-mono text-xs">
                            {template.subject_template}
                          </span>
                        </div>
                      </div>
                    </div>
                    {isAdmin && (
                      <div className="flex items-center gap-2 ml-4">
                        <button
                          onClick={() => handleToggleActive(template)}
                          className={`p-2 rounded-lg transition-colors ${
                            template.is_active
                              ? 'text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20'
                              : 'text-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800'
                          }`}
                          title={template.is_active ? 'Deactivate' : 'Activate'}
                        >
                          {template.is_active ? (
                            <Power className="w-4 h-4" />
                          ) : (
                            <PowerOff className="w-4 h-4" />
                          )}
                        </button>
                        <button
                          onClick={() => openEditor(template)}
                          className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleClone(template)}
                          className="p-2 text-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg transition-colors"
                          title="Clone"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(template.id)}
                          className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Template Editor */}
      {showEditor && (
        <div className="space-y-6">
          {/* Template Configuration */}
          <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-lg">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 dark:from-blue-400 dark:to-cyan-400 bg-clip-text text-transparent">
                    {editingTemplate ? 'Edit Template' : 'New Template'}
                  </h3>
                  <button
                    onClick={closeEditor}
                    className="p-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

            <div className="space-y-4">
              {/* Template Type */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  Template Type
                </label>
                <select
                  value={templateType}
                  onChange={(e) => handleTemplateTypeChange(e.target.value as TemplateType)}
                  disabled={!!editingTemplate}
                  className="w-full px-4 py-2.5 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {Object.values(TEMPLATE_TYPE_METADATA).map((meta) => (
                    <option key={meta.type} value={meta.type}>
                      {meta.label}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {TEMPLATE_TYPE_METADATA[templateType].description}
                </p>
              </div>

              {/* Template Name */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  Template Name
                </label>
                <input
                  type="text"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder="e.g., Professional Quote Email"
                  className="w-full px-4 py-2.5 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
              </div>

              {/* Attachments */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  Auto-Attach
                </label>
                <div className="space-y-2">
                  {TEMPLATE_TYPE_METADATA[templateType].supportedAttachments.quoteLink && (
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={autoAttachQuoteLink}
                        onChange={(e) => setAutoAttachQuoteLink(e.target.checked)}
                        className="rounded"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        Quote/Invoice Link
                      </span>
                    </label>
                  )}
                  {TEMPLATE_TYPE_METADATA[templateType].supportedAttachments.pdf && (
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={autoAttachPdf}
                        onChange={(e) => setAutoAttachPdf(e.target.checked)}
                        className="rounded"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">PDF</span>
                    </label>
                  )}
                  {TEMPLATE_TYPE_METADATA[templateType].supportedAttachments.mockups && (
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={autoAttachMockups}
                        onChange={(e) => setAutoAttachMockups(e.target.checked)}
                        className="rounded"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">Mockups</span>
                    </label>
                  )}
                  {TEMPLATE_TYPE_METADATA[templateType].supportedAttachments.terms && (
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={autoAttachTerms}
                        onChange={(e) => setAutoAttachTerms(e.target.checked)}
                        className="rounded"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        Terms & Conditions
                      </span>
                    </label>
                  )}
                </div>
              </div>

              {/* Active Toggle */}
              <div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="rounded"
                  />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Set as active template
                  </span>
                </label>
                <p className="mt-1 ml-6 text-xs text-gray-500 dark:text-gray-400">
                  Only one template of each type can be active at a time
                </p>
              </div>
            </div>
          </div>

          {/* Rich Text Email Editor */}
          <RichTextEmailEditor
            initialSubject={subjectTemplate}
            initialBody={bodyTemplate}
            onAutoSave={(subject, body) => {
              setSubjectTemplate(subject);
              setBodyTemplate(body);
            }}
            showShortCodes={true}
            showSmartBlocks={true}
            autoSaveDelay={2000}
          />

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3">
            <button
              onClick={closeEditor}
              className="px-5 py-2.5 text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-all shadow-sm hover:shadow-md"
            >
              Cancel
            </button>
            <button
              onClick={() => handleSave(false)}
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white rounded-lg transition-all shadow-md hover:shadow-lg"
            >
              <Save className="w-4 h-4" />
              {editingTemplate ? 'Update Template' : 'Create Template'}
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
