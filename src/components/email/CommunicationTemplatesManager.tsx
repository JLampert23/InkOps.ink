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
  AlertTriangle,
  CheckCircle2,
  Copy,
  Eye,
  Wand2,
  FileEdit,
} from 'lucide-react';
import { useNotification } from '../../contexts/NotificationContext';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase-client';
import ShortCodePicker from './ShortCodePicker';
import ShortCodeReference from './ShortCodeReference';
import RichTextEmailEditor from './RichTextEmailEditor';
import { MissingShortCodesWarningModal } from './MissingShortCodesWarningModal';
import { TemplateValidationFeedback } from './TemplateValidationFeedback';
import { GuidedTemplateBuilder } from './GuidedTemplateBuilder';
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
  getRequiredShortCodes,
} from '../../types/communication-template';

export default function CommunicationTemplatesManager() {
  const { showNotification } = useNotification();
  const { user, userProfile } = useAuth();
  const [templates, setTemplates] = useState<CommunicationTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEditor, setShowEditor] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<CommunicationTemplate | null>(null);
  const [showShortCodes, setShowShortCodes] = useState(false);
  const [showReference, setShowReference] = useState(false);
  const [editorMode, setEditorMode] = useState<'guided' | 'advanced'>('guided');
  const [showModeSwitch, setShowModeSwitch] = useState(false);

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
  const [showValidation, setShowValidation] = useState(false);
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [pendingSave, setPendingSave] = useState<'save' | 'send' | null>(null);

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
      setShowValidation(true);
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
    setShowValidation(false);
    setValidation(null);
  }

  function closeEditor() {
    setShowEditor(false);
    setEditingTemplate(null);
    setShowValidation(false);
    setValidation(null);
    setPendingSave(null);
    setEditorMode('guided');
  }

  function handleSwitchToAdvanced() {
    if (subjectTemplate || bodyTemplate) {
      setEditorMode('advanced');
    } else {
      setEditorMode('advanced');
    }
  }

  function handleSwitchToGuided() {
    if (bodyTemplate && bodyTemplate.length > 0) {
      const confirmSwitch = confirm(
        'Switching to Guided Builder will overwrite your current template. Are you sure you want to continue?'
      );
      if (confirmSwitch) {
        setEditorMode('guided');
      }
    } else {
      setEditorMode('guided');
    }
  }

  function handleGuidedComplete(html: string, subject: string) {
    setBodyTemplate(html);
    setSubjectTemplate(subject);
    setEditorMode('advanced');
    showNotification('success', 'Template Generated', 'Your template has been created! You can now customize it further.');
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
    setShowValidation(true);

    // Check for syntax errors
    if (!result.isValid) {
      showNotification(
        'error',
        'Validation Failed',
        'Please fix template errors before saving'
      );
      return;
    }

    // Check for missing required codes
    if (result.hasRequiredCodeViolations && isActive && !overrideValidation) {
      setPendingSave('save');
      setShowWarningModal(true);
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
        <div className="text-gray-600 dark:text-gray-400">Please sign in to access email templates.</div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-600 dark:text-gray-400">Loading templates...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Email Templates
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Manage customizable email templates with short codes
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowReference(!showReference)}
            className="flex items-center gap-2 px-4 py-2 bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-slate-600 transition-colors"
          >
            <Eye className="w-4 h-4" />
            Short Code Reference
          </button>
          {isAdmin && (
            <button
              onClick={() => openEditor()}
              className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold text-base shadow-lg"
            >
              <Plus className="w-5 h-5" />
              Create New Template
            </button>
          )}
        </div>
      </div>

      {/* Short Code Reference */}
      {showReference && (
        <div className="bg-white dark:bg-slate-900 rounded-lg border border-gray-200 dark:border-slate-700 p-6">
          <ShortCodeReference />
        </div>
      )}

      {/* Template List */}
      {!showEditor && (
        <div className="grid grid-cols-1 gap-4">
          {templates.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 rounded-lg border border-gray-200 dark:border-slate-700 p-8 text-center">
              <p className="text-gray-600 dark:text-gray-400">
                No email templates yet. Create your first template to get started.
              </p>
            </div>
          ) : (
            templates.map((template) => {
              const metadata = TEMPLATE_TYPE_METADATA[template.template_type as TemplateType];
              const requiredCodes = getRequiredShortCodes(template.template_type as TemplateType);
              const hasRequiredCodes = requiredCodes.length > 0;

              return (
                <div
                  key={template.id}
                  className="bg-white dark:bg-slate-900 rounded-lg border border-gray-200 dark:border-slate-700 p-4"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
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
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        {metadata?.label || template.template_type}
                      </p>
                      <div className="mt-3 space-y-1">
                        <div className="text-sm">
                          <span className="text-gray-600 dark:text-gray-400">Subject: </span>
                          <span className="text-gray-900 dark:text-white font-mono text-xs">
                            {template.subject_template}
                          </span>
                        </div>
                        {hasRequiredCodes && (
                          <div className="text-xs text-orange-600 dark:text-orange-400 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            Requires: {requiredCodes.map((c) => `{{${c.code}}}`).join(', ')}
                          </div>
                        )}
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
          {/* Mode Selector */}
          {!editingTemplate && (
            <div className="bg-white dark:bg-slate-900 rounded-lg border border-gray-200 dark:border-slate-700 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Choose Editor Mode
                </h3>
                <button
                  onClick={closeEditor}
                  className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => setEditorMode('guided')}
                  className={`p-6 border-2 rounded-lg transition-all ${
                    editorMode === 'guided'
                      ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-200 dark:border-slate-700 hover:border-blue-400'
                  }`}
                >
                  <div className="flex flex-col items-center text-center">
                    <Wand2 className={`w-8 h-8 mb-3 ${
                      editorMode === 'guided' ? 'text-blue-600' : 'text-gray-500'
                    }`} />
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
                      Guided Builder
                    </h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Step-by-step wizard to create professional templates without coding
                    </p>
                  </div>
                </button>

                <button
                  onClick={() => setEditorMode('advanced')}
                  className={`p-6 border-2 rounded-lg transition-all ${
                    editorMode === 'advanced'
                      ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-200 dark:border-slate-700 hover:border-blue-400'
                  }`}
                >
                  <div className="flex flex-col items-center text-center">
                    <FileEdit className={`w-8 h-8 mb-3 ${
                      editorMode === 'advanced' ? 'text-blue-600' : 'text-gray-500'
                    }`} />
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
                      Advanced Editor
                    </h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Full control with rich text editor and HTML customization
                    </p>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* Guided Builder Mode */}
          {editorMode === 'guided' && !editingTemplate && (
            <div className="bg-white dark:bg-slate-900 rounded-lg border border-gray-200 dark:border-slate-700 overflow-hidden">
              <GuidedTemplateBuilder
                onComplete={handleGuidedComplete}
                onCancel={closeEditor}
                templateType={templateType}
                initialData={{
                  subject: subjectTemplate,
                  greeting: '',
                  intro: '',
                  actionType: templateType.includes('invoice') ? 'payment' : templateType.includes('quote') ? 'quote' : 'link',
                  includeInvoiceSummary: templateType.includes('invoice'),
                  includeQuoteSummary: templateType.includes('quote'),
                  closing: '',
                }}
              />
            </div>
          )}

          {/* Advanced Editor Mode */}
          {(editorMode === 'advanced' || editingTemplate) && (
            <>
              {/* Template Configuration */}
              <div className="bg-white dark:bg-slate-900 rounded-lg border border-gray-200 dark:border-slate-700 p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-4">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      {editingTemplate ? 'Edit Template' : 'New Template'}
                    </h3>
                    {!editingTemplate && (
                      <button
                        onClick={handleSwitchToGuided}
                        className="flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors"
                      >
                        <Wand2 className="w-4 h-4" />
                        Switch to Guided Builder
                      </button>
                    )}
                  </div>
                  <button
                    onClick={closeEditor}
                    className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

            <div className="space-y-4">
              {/* Template Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Template Type
                </label>
                <select
                  value={templateType}
                  onChange={(e) => handleTemplateTypeChange(e.target.value as TemplateType)}
                  disabled={!!editingTemplate}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {Object.values(TEMPLATE_TYPE_METADATA).map((meta) => (
                    <option key={meta.type} value={meta.type}>
                      {meta.label}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {TEMPLATE_TYPE_METADATA[templateType].description}
                </p>
                {getRequiredShortCodes(templateType).length > 0 && (
                  <div className="mt-2 p-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-orange-600 dark:text-orange-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-orange-800 dark:text-orange-300">
                          Required Short Codes
                        </p>
                        <div className="mt-1 space-y-1">
                          {getRequiredShortCodes(templateType).map((req) => (
                            <div key={req.code} className="text-xs text-orange-700 dark:text-orange-400">
                              <code className="bg-orange-100 dark:bg-orange-900/40 px-1 py-0.5 rounded">
                                {`{{${req.code}}}`}
                              </code>{' '}
                              - {req.reason}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Template Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Template Name
                </label>
                <input
                  type="text"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder="e.g., Professional Quote Email"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                />
              </div>

              {/* Attachments */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
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

          {/* Validation Feedback */}
          {validation && (
            <TemplateValidationFeedback validation={validation} show={showValidation} />
          )}

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3">
                <button
                  onClick={closeEditor}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-slate-700 rounded-lg hover:bg-gray-300 dark:hover:bg-slate-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleSave(false)}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Save className="w-4 h-4" />
                  {editingTemplate ? 'Update Template' : 'Create Template'}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Missing Short Codes Warning Modal */}
      {validation && (
        <MissingShortCodesWarningModal
          isOpen={showWarningModal}
          onClose={() => {
            setShowWarningModal(false);
            setPendingSave(null);
          }}
          validation={validation}
          onFixTemplate={() => {
            setShowWarningModal(false);
            setPendingSave(null);
          }}
          onSaveAnyway={() => {
            setShowWarningModal(false);
            handleSave(true);
            setPendingSave(null);
          }}
          canOverride={isAdmin}
          actionType={pendingSave || 'save'}
        />
      )}
    </div>
  );
}
