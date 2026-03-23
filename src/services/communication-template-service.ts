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
  TemplateValidation,
} from '../types/communication-template';
import { getRequiredShortCodes } from '../types/communication-template';
import { ShortCodeEngine, type ShortCodeData } from './shortcode-service';

const EDGE_FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/communication-templates`;

/**
 * Make a fetch request with automatic retry on 401 errors
 */
async function fetchWithAuth(
  url: string,
  options: RequestInit = {},
  retryCount: number = 0
): Promise<Response> {
  const MAX_RETRIES = 2;

  try {
    const headers = await getHeaders();
    const response = await fetch(url, {
      ...options,
      headers: {
        ...headers,
        ...options.headers,
      },
    });

    // If we get a 401 and haven't exhausted retries, try again with fresh token
    if (response.status === 401 && retryCount < MAX_RETRIES) {
      console.warn(`Authentication failed (attempt ${retryCount + 1}/${MAX_RETRIES}), retrying with fresh token...`);

      // Wait a bit before retrying
      await new Promise(resolve => setTimeout(resolve, 500 * (retryCount + 1)));

      // Retry with fresh token
      return fetchWithAuth(url, options, retryCount + 1);
    }

    return response;
  } catch (error) {
    console.error('Fetch error:', error);
    throw error;
  }
}

/**
 * Get headers for API requests with automatic token refresh
 * This function ensures we always have a valid, fresh token before making API calls
 */
async function getHeaders(): Promise<HeadersInit> {
  try {
    // Always get the latest session from storage
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError) {
      console.error('Error getting session:', sessionError);
      throw new Error('Authentication error. Please refresh the page and sign in again.');
    }

    if (!session) {
      throw new Error('No active session. Please sign in again.');
    }

    // Check if the token is expired or about to expire (within 1 minute)
    const expiresAt = session.expires_at || 0;
    const now = Math.floor(Date.now() / 1000);
    const isExpired = expiresAt < now + 60;

    if (isExpired) {
      console.log('Token expired or expiring soon, refreshing...');

      // Try to refresh the session
      const { data: { session: newSession }, error: refreshError } = await supabase.auth.refreshSession();

      if (refreshError || !newSession) {
        console.error('Failed to refresh session:', refreshError);
        throw new Error('Your session has expired. Please refresh the page and sign in again.');
      }

      // Use the new session
      return {
        'Authorization': `Bearer ${newSession.access_token}`,
        'Content-Type': 'application/json',
        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
      };
    }

    // Session is still valid, use it
    return {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
      'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
    };
  } catch (error) {
    console.error('Error getting authentication headers:', error);
    throw error;
  }
}

/**
 * List all templates for the current company
 */
export async function listTemplates(
  templateType?: TemplateType,
  activeOnly: boolean = false
): Promise<CommunicationTemplate[]> {
  try {
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

    const response = await fetchWithAuth(url);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Response error:', response.status, errorText);
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { error: errorText };
      }

      // Provide user-friendly error messages
      if (response.status === 401) {
        throw new Error('Session expired. Please refresh the page and sign in again.');
      }

      throw new Error(errorData.error || errorData.details || `Failed to fetch templates (${response.status})`);
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
    const response = await fetchWithAuth(`${EDGE_FUNCTION_URL}/${templateId}`);

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Session expired. Please refresh the page and sign in again.');
      }

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
    const response = await fetchWithAuth(EDGE_FUNCTION_URL, {
      method: 'POST',
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Session expired. Please refresh the page and sign in again.');
      }

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
    const response = await fetchWithAuth(`${EDGE_FUNCTION_URL}/${templateId}`, {
      method: 'PUT',
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Session expired. Please refresh the page and sign in again.');
      }

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
    const response = await fetchWithAuth(`${EDGE_FUNCTION_URL}/${templateId}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Session expired. Please refresh the page and sign in again.');
      }

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
 * Validate template content with required short code checking
 */
export function validateTemplate(
  subjectTemplate: string,
  bodyTemplate: string,
  templateType?: TemplateType
): TemplateValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  const missingRequiredCodes: { code: string; reason: string }[] = [];

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

  // Check for required short codes if template type is provided
  if (templateType) {
    const requiredCodes = getRequiredShortCodes(templateType);

    for (const required of requiredCodes) {
      if (!allCodes.includes(required.code)) {
        missingRequiredCodes.push(required);
        warnings.push(`Missing required short code: {{${required.code}}} - ${required.reason}`);
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    usedShortCodes: allCodes,
    missingShortCodes: [],
    missingRequiredCodes,
    hasRequiredCodeViolations: missingRequiredCodes.length > 0,
  };
}

/**
 * Validate template before sending (strict validation)
 * Returns true if template can be sent, false if required codes are missing
 */
export function validateTemplateForSending(
  template: CommunicationTemplate,
  allowOverride: boolean = false
): { canSend: boolean; validation: TemplateValidation } {
  const validation = validateTemplate(
    template.subject_template,
    template.body_template,
    template.template_type
  );

  // If override is allowed and user is admin, they can send anyway
  if (allowOverride) {
    return {
      canSend: true,
      validation,
    };
  }

  // Strict validation: cannot send if required codes are missing
  const canSend = !validation.hasRequiredCodeViolations && validation.isValid;

  return {
    canSend,
    validation,
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
  validateTemplateForSending,
  previewTemplate,
  cloneTemplate,
  exportTemplate,
  importTemplate,
  getTemplateStats,
};

export default CommunicationTemplateService;
