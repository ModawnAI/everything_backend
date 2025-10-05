/**
 * API Client Tool
 * Provides HTTP client functionality for testing backend APIs
 */

import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';
import { BACKEND_URL } from '../config/agent.config';
import { API_HEADERS } from '../config/api.config';
import { logger } from '../utils/logger';

interface ApiRequestInput {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  endpoint: string;
  headers?: Record<string, string>;
  body?: any;
  params?: Record<string, string>;
  timeout?: number;
}

/**
 * API Request Tool
 * Makes HTTP requests to the backend API
 */
export async function apiRequest(input: ApiRequestInput) {
    try {
      const config: AxiosRequestConfig = {
        method: input.method,
        url: `${BACKEND_URL}${input.endpoint}`,
        headers: {
          ...API_HEADERS.default,
          ...input.headers
        },
        timeout: input.timeout
      };

      if (input.body) {
        config.data = input.body;
      }

      if (input.params) {
        config.params = input.params;
      }

      logger.info('API Request', {
        method: input.method,
        url: config.url,
        hasAuth: !!input.headers?.Authorization,
        bodyKeys: input.body ? Object.keys(input.body) : []
      });

      const response: AxiosResponse = await axios(config);

      logger.info('API Response', {
        status: response.status,
        statusText: response.statusText,
        dataKeys: Object.keys(response.data || {})
      });

      return {
        success: true,
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
        data: response.data,
        executionTime: response.config.headers?.['X-Response-Time'] || 'N/A'
      };
    } catch (error: any) {
      logger.error('API Request Failed', {
        error: error.message,
        status: error.response?.status,
        data: error.response?.data
      });

      return {
        success: false,
        status: error.response?.status || 500,
        statusText: error.response?.statusText || 'Internal Error',
        headers: error.response?.headers || {},
        data: error.response?.data || { error: error.message },
        error: {
          message: error.message,
          code: error.code,
          response: error.response?.data
        }
      };
    }
  }

interface ValidateResponseInput {
  response: any;
  expectedStatus?: number;
  expectedFormat?: 'success' | 'error' | 'paginated';
  requiredFields?: string[];
}

/**
 * Response Validation Tool
 * Validates API response against expected format
 */
export async function validateResponse(input: ValidateResponseInput) {
    const validations: any[] = [];
    let isValid = true;

    // Status code validation
    if (input.expectedStatus && input.response.status !== input.expectedStatus) {
      validations.push({
        check: 'status_code',
        expected: input.expectedStatus,
        actual: input.response.status,
        passed: false
      });
      isValid = false;
    } else if (input.expectedStatus) {
      validations.push({
        check: 'status_code',
        expected: input.expectedStatus,
        actual: input.response.status,
        passed: true
      });
    }

    // Format validation
    if (input.expectedFormat) {
      const data = input.response.data;
      let formatValid = false;

      switch (input.expectedFormat) {
        case 'success':
          formatValid = data?.success === true && 'data' in data;
          break;
        case 'error':
          formatValid = data?.success === false && data?.error;
          break;
        case 'paginated':
          formatValid = data?.success === true && data?.data?.items && data?.data?.pagination;
          break;
      }

      validations.push({
        check: 'response_format',
        expected: input.expectedFormat,
        passed: formatValid
      });

      if (!formatValid) isValid = false;
    }

    // Required fields validation
    if (input.requiredFields && input.response.data?.data) {
      const missingFields: string[] = [];
      const data = input.response.data.data;

      for (const field of input.requiredFields) {
        if (!(field in data)) {
          missingFields.push(field);
        }
      }

      validations.push({
        check: 'required_fields',
        expected: input.requiredFields,
        missing: missingFields,
        passed: missingFields.length === 0
      });

      if (missingFields.length > 0) isValid = false;
    }

    return {
      valid: isValid,
      validations,
      summary: isValid ? 'All validations passed' : 'Some validations failed'
    };
  }
