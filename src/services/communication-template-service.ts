/**
 * Communication Template Service
 *
 * Service layer for managing email templates with short code support
 */

import { supabase } from '../lib/supabase-client';
import type {
  CommunicationTemplate,
  CreateTemplateRequest,
  UpdateTemplateRequest,
  TemplateType,
  RenderedTemplate,
} from '../types/communication-template';
import { ShortCodeEngine, type ShortCodeData } from './shortcode-service';

const EDGE_FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/communication-templates`;

/**
 * Get headers for API requests
 */
async function getHeaders(): Promise<HeadersInit> {
  const { data: { session } } = await supabase.auth.getSession();

  return {
    'Authorization': `Bearer ${session?.access_token}`,
    'Content-Type': 'application/json',
    'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
  };
}

/**
 * List all templates for the current company
 */
export async function listTemplates(
  templateType?: TemplateType,
  activeOnly: boolean = false
): Promise<CommunicationTemplate[]> {
  try {
    const headers = await getHeaders();
    const params = new URLSearchParams();

    if (templateType) {
      params.set('type', templateType);
    }
    if (activeOnly) {
      params.set('active_only', 'true');
    }

    const url = params.toString()
      ? `${EDGE_FUNCTION_URL}?${params.toString()}`
      : EDGE_FUNCTION_URL;

    const response = await fetch(url, { headers });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to fetch templates');
    }

    return await response.json();
  } catch (error) {
    console.error('Error listing templates:', error);
    throw error;
  }
}

/**
 * Get a specific template by ID
 */
export async function getTemplate(templateId: string): Promise<CommunicationTemplate> {
  try {
    const headers = await getHeaders();
    const response = await fetch(`${EDGE_FUNCTION_URL}/${templateId}`, { headers });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to fetch template');
    }

    return await response.json();
  } catch (error) {
    console.error('Error getting template:', error);
    throw error;
  }
}

/**
 * Get template by type (returns active template)
 */
export async function getTemplateByType(templateType: TemplateType): Promise<CommunicationTemplate | null> {
  try {
    const templates = await listTemplates(templateType, true);
    return templates.length > 0 ? templates[0] : null;
  } catch (error) {
    console.error('Error getting template by type:', error);
    return null;
  }
}

/**
 * Create a new template
 */
export async function createTemplate(
  request: CreateTemplateRequest
): Promise<CommunicationTemplate> {
  try {
    const headers = await getHeaders();
    const response = await fetch(EDGE_FUNCTION_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create template');
    }

    return await response.json();
  } catch (error) {
    console.error('Error creating template:', error);
    throw error;
  }
}

/**
 * Update an existing template
 */
export async function updateTemplate(
  templateId: string,
  request: UpdateTemplateRequest
): Promise<CommunicationTemplate> {
  try {
    const headers = await getHeaders();
    const response = await fetch(`${EDGE_FUNCTION_URL}/${templateId}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to update template');
    }

    return await response.json();
  } catch (error) {
    console.error('Error updating template:', error);
    throw error;
  }
}

/**
 * Delete a template
 */
export async function deleteTemplate(templateId: string): Promise<void> {
  try {
    const headers = await getHeaders();
    const response = await fetch(`${EDGE_FUNCTION_URL}/${templateId}`, {
      method: 'DELETE',
      headers,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to delete template');
    }
  } catch (error) {
    console.error('Error deleting template:', error);
    throw error;
  }
}

/**
 * Activate a template (deactivates others of the same type)
 */
export async function activateTemplate(templateId: string): Promise<CommunicationTemplate> {
  return updateTemplate(templateId, { is_active: true });
}

/**
 * Deactivate a template
 */
export async function deactivateTemplate(templateId: string): Promise<CommunicationTemplate> {
  return updateTemplate(templateId, { is_active: false });
}

/**
 * Render a template with provided data
 */
export function renderTemplate(
  template: CommunicationTemplate,
  data: ShortCodeData
): RenderedTemplate {
  const subject = ShortCodeEngine.renderTemplate(template.subject_template, data);
  const body = ShortCodeEngine.renderTemplate(template.body_template, data);

  return {
    subject,
    body,
    attachments: {
      quote_link: template.auto_attach_quote_link ? data.quote_link : undefined,
      pdf: template.auto_attach_pdf,
      mockups: template.auto_attach_mockups,
      terms: template.auto_attach_terms,
    },
  };
}

/**
 * Validate template content
 */
export function validateTemplate(
  subjectTemplate: string,
  bodyTemplate: string
): { isValid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check for empty templates
  if (!subjectTemplate.trim()) {
    errors.push('Subject template cannot be empty');
  }

  if (!bodyTemplate.trim()) {
    errors.push('Body template cannot be empty');
  }

  // Extract short codes from templates
  const subjectCodes = ShortCodeEngine.extractShortCodes(subjectTemplate);
  const bodyCodes = ShortCodeEngine.extractShortCodes(bodyTemplate);
  const allCodes = [...new Set([...subjectCodes, ...bodyCodes])];

  // Check for malformed short codes
  const malformedPattern = /\{\{[^}]*$/g;
  if (malformedPattern.test(subjectTemplate) || malformedPattern.test(bodyTemplate)) {
    errors.push('Template contains malformed short codes (unclosed brackets)');
  }

  // Check for nested short codes
  const nestedPattern = /\{\{[^}]*\{\{/g;
  if (nestedPattern.test(subjectTemplate) || nestedPattern.test(bodyTemplate)) {
    errors.push('Template contains nested short codes (not supported)');
  }

  // Warn about long subject lines
  if (subjectTemplate.length > 100) {
    warnings.push('Subject line is longer than recommended (100 characters)');
  }

  // Warn if no short codes are used
  if (allCodes.length === 0) {
    warnings.push('No short codes detected. Consider using dynamic data placeholders.');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Preview template with sample data
 */
export function previewTemplate(
  template: CommunicationTemplate
): RenderedTemplate {
  const sampleData = ShortCodeEngine.generateSampleData();
  return renderTemplate(template, sampleData);
}

/**
 * Clone a template
 */
export async function cloneTemplate(
  templateId: string,
  newName: string
): Promise<CommunicationTemplate> {
  try {
    const original = await getTemplate(templateId);

    const cloneRequest: CreateTemplateRequest = {
      template_type: original.template_type,
      template_name: newName,
      subject_template: original.subject_template,
      body_template: original.body_template,
      auto_attach_quote_link: original.auto_attach_quote_link,
      auto_attach_pdf: original.auto_attach_pdf,
      auto_attach_mockups: original.auto_attach_mockups,
      auto_attach_terms: original.auto_attach_terms,
      is_active: false, // Clones are inactive by default
    };

    return await createTemplate(cloneRequest);
  } catch (error) {
    console.error('Error cloning template:', error);
    throw error;
  }
}

/**
 * Export template as JSON
 */
export function exportTemplate(template: CommunicationTemplate): string {
  return JSON.stringify(template, null, 2);
}

/**
 * Import template from JSON
 */
export async function importTemplate(jsonData: string): Promise<CommunicationTemplate> {
  try {
    const data = JSON.parse(jsonData);

    const importRequest: CreateTemplateRequest = {
      template_type: data.template_type,
      template_name: data.template_name || 'Imported Template',
      subject_template: data.subject_template,
      body_template: data.body_template,
      auto_attach_quote_link: data.auto_attach_quote_link ?? true,
      auto_attach_pdf: data.auto_attach_pdf ?? false,
      auto_attach_mockups: data.auto_attach_mockups ?? false,
      auto_attach_terms: data.auto_attach_terms ?? false,
      is_active: false, // Imported templates are inactive by default
    };

    return await createTemplate(importRequest);
  } catch (error) {
    console.error('Error importing template:', error);
    throw new Error('Failed to import template. Please check the JSON format.');
  }
}

/**
 * Get template usage statistics
 */
export async function getTemplateStats(templateId: string): Promise<{
  usedShortCodes: string[];
  characterCount: { subject: number; body: number };
  estimatedRenderTime: number;
}> {
  try {
    const template = await getTemplate(templateId);

    const subjectCodes = ShortCodeEngine.extractShortCodes(template.subject_template);
    const bodyCodes = ShortCodeEngine.extractShortCodes(template.body_template);
    const usedShortCodes = [...new Set([...subjectCodes, ...bodyCodes])];

    return {
      usedShortCodes,
      characterCount: {
        subject: template.subject_template.length,
        body: template.body_template.length,
      },
      estimatedRenderTime: usedShortCodes.length * 10, // Rough estimate: 10ms per short code
    };
  } catch (error) {
    console.error('Error getting template stats:', error);
    throw error;
  }
}

export const CommunicationTemplateService = {
  listTemplates,
  getTemplate,
  getTemplateByType,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  activateTemplate,
  deactivateTemplate,
  renderTemplate,
  validateTemplate,
  previewTemplate,
  cloneTemplate,
  exportTemplate,
  importTemplate,
  getTemplateStats,
};

export default CommunicationTemplateService;
