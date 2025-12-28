# Implementation Plan: Admin Report Generation

## Overview

| Attribute | Value |
|-----------|-------|
| **Priority** | P2 - Medium |
| **Estimated Effort** | 12-16 hours |
| **Risk Level** | Low |
| **Components Affected** | Backend + Admin Panel |
| **Dependencies** | Analytics Service (Plan 09), CSV Export (Plan 12) |

## Problem Statement

Report generation is marked as TODO throughout the admin panel:

```typescript
// Admin: Report generation buttons exist but are non-functional
// No automated report scheduling
// No PDF report generation
// Manual data compilation required for stakeholder reports
```

**Current State:**
- Analytics dashboard shows real-time data
- No scheduled report generation
- No PDF/document export capability
- Admins manually compile data for reports

**Impact:**
1. Time-consuming manual report generation
2. Inconsistent report formats
3. No automated stakeholder updates
4. Missing executive summary reports

---

## Report Types Required

### 1. Platform Summary Report (Daily/Weekly/Monthly)

| Section | Data |
|---------|------|
| **Executive Summary** | Total revenue, bookings, users, growth % |
| **Revenue Breakdown** | By category, payment method, shop |
| **User Metrics** | New users, active users, retention |
| **Booking Metrics** | Conversion rate, cancellation rate, no-shows |
| **Top Performers** | Top 10 shops by revenue/bookings |

### 2. Shop Performance Report

| Section | Data |
|---------|------|
| **Shop Overview** | Name, category, status, rating |
| **Revenue** | Total, by service, trends |
| **Bookings** | Total, by status, completion rate |
| **Reviews** | Average rating, sentiment, count |
| **Customer Metrics** | Unique customers, repeat rate |

### 3. Financial Report

| Section | Data |
|---------|------|
| **Revenue Summary** | Gross, net, refunds |
| **Payment Methods** | Breakdown by method |
| **Points Impact** | Points issued, redeemed, liability |
| **Refunds** | Count, amount, reasons |
| **Projections** | Trend analysis |

### 4. User Engagement Report

| Section | Data |
|---------|------|
| **User Growth** | New signups, churn |
| **Activity Metrics** | DAU, MAU, session time |
| **Booking Behavior** | Frequency, preferences |
| **Referral Performance** | Codes used, conversions |

---

## Backend Implementation

### Step 1: Create Report Types

**File:** `src/types/report.types.ts`

```typescript
/**
 * Report Type Definitions
 */

// Report type enum
export type ReportType =
  | 'platform_summary'
  | 'shop_performance'
  | 'financial'
  | 'user_engagement'
  | 'custom';

// Report period
export type ReportPeriod = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'custom';

// Report format
export type ReportFormat = 'pdf' | 'html' | 'json';

// Report status
export type ReportStatus = 'pending' | 'generating' | 'completed' | 'failed' | 'expired';

// Report request
export interface ReportRequest {
  type: ReportType;
  period: ReportPeriod;
  startDate?: string; // Required for 'custom' period
  endDate?: string;
  format: ReportFormat;
  options?: {
    shopId?: string; // For shop_performance report
    includeCharts?: boolean;
    language?: 'ko' | 'en';
  };
}

// Report job
export interface ReportJob {
  id: string;
  userId: string;
  type: ReportType;
  period: ReportPeriod;
  startDate: string;
  endDate: string;
  format: ReportFormat;
  status: ReportStatus;
  fileName: string | null;
  fileUrl: string | null;
  fileSize: number | null;
  error: string | null;
  expiresAt: string | null;
  createdAt: string;
  completedAt: string | null;
}

// Report schedule
export interface ReportSchedule {
  id: string;
  userId: string;
  type: ReportType;
  period: ReportPeriod;
  format: ReportFormat;
  recipients: string[]; // Email addresses
  isActive: boolean;
  lastRunAt: string | null;
  nextRunAt: string;
  createdAt: string;
}

// Platform summary report data
export interface PlatformSummaryData {
  period: {
    start: string;
    end: string;
    label: string;
  };
  summary: {
    totalRevenue: number;
    revenueGrowth: number;
    totalBookings: number;
    bookingsGrowth: number;
    totalUsers: number;
    usersGrowth: number;
    activeShops: number;
    averageRating: number;
  };
  revenue: {
    byCategory: { category: string; amount: number; percentage: number }[];
    byPaymentMethod: { method: string; amount: number; percentage: number }[];
    trend: { date: string; amount: number }[];
  };
  bookings: {
    byStatus: { status: string; count: number; percentage: number }[];
    conversionRate: number;
    cancellationRate: number;
    noShowRate: number;
    trend: { date: string; count: number }[];
  };
  topShops: {
    byRevenue: { shopId: string; name: string; revenue: number }[];
    byBookings: { shopId: string; name: string; bookings: number }[];
  };
  generatedAt: string;
}

// Shop performance report data
export interface ShopPerformanceData {
  shop: {
    id: string;
    name: string;
    category: string;
    status: string;
    address: string;
    rating: number;
    reviewCount: number;
  };
  period: {
    start: string;
    end: string;
    label: string;
  };
  revenue: {
    total: number;
    growth: number;
    byService: { serviceId: string; name: string; revenue: number }[];
    trend: { date: string; amount: number }[];
  };
  bookings: {
    total: number;
    growth: number;
    byStatus: { status: string; count: number }[];
    completionRate: number;
    cancellationRate: number;
    trend: { date: string; count: number }[];
  };
  customers: {
    unique: number;
    repeat: number;
    repeatRate: number;
    averageSpend: number;
  };
  reviews: {
    average: number;
    count: number;
    distribution: { rating: number; count: number }[];
    recent: { rating: number; content: string; date: string }[];
  };
  generatedAt: string;
}
```

### Step 2: Create Report Service

**File:** `src/services/report.service.ts`

```typescript
/**
 * Report Generation Service
 * Generates various admin reports in PDF/HTML format
 */

import { supabase } from '@/config/supabase';
import { v4 as uuidv4 } from 'uuid';
import {
  ReportType,
  ReportPeriod,
  ReportFormat,
  ReportRequest,
  ReportJob,
  ReportSchedule,
  PlatformSummaryData,
  ShopPerformanceData,
} from '@/types/report.types';
import { adminAnalyticsService } from './admin-analytics.service';
import { generatePDF } from '@/utils/pdf-generator';
import { generateHTML } from '@/utils/html-generator';

export class ReportService {
  private readonly EXPIRY_HOURS = 168; // 7 days

  /**
   * Create a report generation job
   */
  async createReportJob(userId: string, request: ReportRequest): Promise<ReportJob> {
    const jobId = uuidv4();

    // Calculate date range
    const { startDate, endDate } = this.calculateDateRange(request.period, request.startDate, request.endDate);

    // Create job record
    const { error: insertError } = await supabase.from('report_jobs').insert({
      id: jobId,
      user_id: userId,
      type: request.type,
      period: request.period,
      start_date: startDate,
      end_date: endDate,
      format: request.format,
      options: request.options || {},
      status: 'pending',
      created_at: new Date().toISOString(),
    });

    if (insertError) {
      throw new Error(`Failed to create report job: ${insertError.message}`);
    }

    // Process job asynchronously
    this.processReportJob(jobId, request, startDate, endDate).catch((error) => {
      console.error(`Report job ${jobId} failed:`, error);
    });

    return this.getReportJob(jobId, userId) as Promise<ReportJob>;
  }

  /**
   * Get report job status
   */
  async getReportJob(jobId: string, userId: string): Promise<ReportJob | null> {
    const { data, error } = await supabase
      .from('report_jobs')
      .select('*')
      .eq('id', jobId)
      .eq('user_id', userId)
      .single();

    if (error || !data) return null;

    return this.mapReportJob(data);
  }

  /**
   * List user's report jobs
   */
  async listReportJobs(userId: string, limit = 20): Promise<ReportJob[]> {
    const { data, error } = await supabase
      .from('report_jobs')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`Failed to list report jobs: ${error.message}`);
    }

    return (data || []).map(this.mapReportJob);
  }

  /**
   * Process report generation
   */
  private async processReportJob(
    jobId: string,
    request: ReportRequest,
    startDate: string,
    endDate: string
  ): Promise<void> {
    try {
      // Update status
      await this.updateJobStatus(jobId, 'generating');

      // Generate report data
      let reportData: any;
      let reportTitle: string;

      switch (request.type) {
        case 'platform_summary':
          reportData = await this.generatePlatformSummary(startDate, endDate);
          reportTitle = '플랫폼 종합 리포트';
          break;

        case 'shop_performance':
          if (!request.options?.shopId) {
            throw new Error('Shop ID required for shop performance report');
          }
          reportData = await this.generateShopPerformance(
            request.options.shopId,
            startDate,
            endDate
          );
          reportTitle = '샵 성과 리포트';
          break;

        case 'financial':
          reportData = await this.generateFinancialReport(startDate, endDate);
          reportTitle = '재무 리포트';
          break;

        case 'user_engagement':
          reportData = await this.generateUserEngagementReport(startDate, endDate);
          reportTitle = '사용자 참여 리포트';
          break;

        default:
          throw new Error(`Unknown report type: ${request.type}`);
      }

      // Generate file
      let fileContent: Buffer;
      let contentType: string;
      let fileExtension: string;

      if (request.format === 'pdf') {
        fileContent = await generatePDF(reportTitle, reportData, request.options?.language || 'ko');
        contentType = 'application/pdf';
        fileExtension = 'pdf';
      } else if (request.format === 'html') {
        fileContent = Buffer.from(
          await generateHTML(reportTitle, reportData, request.options?.language || 'ko')
        );
        contentType = 'text/html';
        fileExtension = 'html';
      } else {
        fileContent = Buffer.from(JSON.stringify(reportData, null, 2));
        contentType = 'application/json';
        fileExtension = 'json';
      }

      // Upload to storage
      const fileName = `reports/${jobId}/${request.type}_${startDate}_${endDate}.${fileExtension}`;
      const { error: uploadError } = await supabase.storage
        .from('admin-reports')
        .upload(fileName, fileContent, {
          contentType,
          cacheControl: '3600',
        });

      if (uploadError) {
        throw new Error(`Failed to upload report: ${uploadError.message}`);
      }

      // Get public URL
      const { data: urlData } = supabase.storage.from('admin-reports').getPublicUrl(fileName);

      // Calculate expiry
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + this.EXPIRY_HOURS);

      // Update job as completed
      await supabase
        .from('report_jobs')
        .update({
          status: 'completed',
          file_name: fileName,
          file_url: urlData.publicUrl,
          file_size: fileContent.length,
          expires_at: expiresAt.toISOString(),
          completed_at: new Date().toISOString(),
        })
        .eq('id', jobId);
    } catch (error) {
      // Update job as failed
      await supabase
        .from('report_jobs')
        .update({
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error',
          completed_at: new Date().toISOString(),
        })
        .eq('id', jobId);

      throw error;
    }
  }

  /**
   * Generate platform summary report data
   */
  private async generatePlatformSummary(startDate: string, endDate: string): Promise<PlatformSummaryData> {
    // Get overview metrics
    const overview = await adminAnalyticsService.getPlatformOverview({
      startDate,
      endDate,
    });

    // Get revenue breakdown
    const revenueByCategory = await this.getRevenueByCategory(startDate, endDate);
    const revenueByMethod = await this.getRevenueByPaymentMethod(startDate, endDate);
    const revenueTrend = await this.getRevenueTrend(startDate, endDate);

    // Get booking metrics
    const bookingsByStatus = await this.getBookingsByStatus(startDate, endDate);
    const bookingTrend = await this.getBookingTrend(startDate, endDate);

    // Get top shops
    const topShopsByRevenue = await this.getTopShops('revenue', startDate, endDate);
    const topShopsByBookings = await this.getTopShops('bookings', startDate, endDate);

    return {
      period: {
        start: startDate,
        end: endDate,
        label: this.formatPeriodLabel(startDate, endDate),
      },
      summary: {
        totalRevenue: overview.totalRevenue,
        revenueGrowth: overview.revenueChange,
        totalBookings: overview.totalBookings,
        bookingsGrowth: overview.bookingsChange,
        totalUsers: overview.activeUsers,
        usersGrowth: overview.usersChange,
        activeShops: overview.activeShops,
        averageRating: overview.averageRating || 0,
      },
      revenue: {
        byCategory: revenueByCategory,
        byPaymentMethod: revenueByMethod,
        trend: revenueTrend,
      },
      bookings: {
        byStatus: bookingsByStatus,
        conversionRate: overview.conversionRate || 0,
        cancellationRate: this.calculateCancellationRate(bookingsByStatus),
        noShowRate: this.calculateNoShowRate(bookingsByStatus),
        trend: bookingTrend,
      },
      topShops: {
        byRevenue: topShopsByRevenue,
        byBookings: topShopsByBookings,
      },
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Generate shop performance report data
   */
  private async generateShopPerformance(
    shopId: string,
    startDate: string,
    endDate: string
  ): Promise<ShopPerformanceData> {
    // Get shop info
    const { data: shop, error: shopError } = await supabase
      .from('shops')
      .select('id, name, category, status, address, average_rating, review_count')
      .eq('id', shopId)
      .single();

    if (shopError || !shop) {
      throw new Error('Shop not found');
    }

    // Get revenue data
    const { data: revenueData } = await supabase
      .from('payments')
      .select('amount, created_at, reservation:reservations(service:shop_services(id, name))')
      .eq('status', 'fully_paid')
      .eq('reservation.shop_id', shopId)
      .gte('created_at', `${startDate}T00:00:00Z`)
      .lte('created_at', `${endDate}T23:59:59Z`);

    // Get booking data
    const { data: bookings } = await supabase
      .from('reservations')
      .select('id, status, total_amount, user_id, created_at')
      .eq('shop_id', shopId)
      .gte('created_at', `${startDate}T00:00:00Z`)
      .lte('created_at', `${endDate}T23:59:59Z`);

    // Get reviews
    const { data: reviews } = await supabase
      .from('reviews')
      .select('rating, content, created_at')
      .eq('shop_id', shopId)
      .eq('status', 'approved')
      .gte('created_at', `${startDate}T00:00:00Z`)
      .lte('created_at', `${endDate}T23:59:59Z`)
      .order('created_at', { ascending: false })
      .limit(10);

    // Calculate metrics
    const totalRevenue = (revenueData || []).reduce((sum, p) => sum + (p.amount || 0), 0);
    const totalBookings = bookings?.length || 0;
    const uniqueCustomers = new Set((bookings || []).map((b) => b.user_id)).size;

    // Calculate booking status distribution
    const statusCounts: Record<string, number> = {};
    (bookings || []).forEach((b) => {
      statusCounts[b.status] = (statusCounts[b.status] || 0) + 1;
    });

    // Calculate review distribution
    const ratingCounts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    (reviews || []).forEach((r) => {
      ratingCounts[r.rating] = (ratingCounts[r.rating] || 0) + 1;
    });

    return {
      shop: {
        id: shop.id,
        name: shop.name,
        category: shop.category,
        status: shop.status,
        address: shop.address,
        rating: shop.average_rating || 0,
        reviewCount: shop.review_count || 0,
      },
      period: {
        start: startDate,
        end: endDate,
        label: this.formatPeriodLabel(startDate, endDate),
      },
      revenue: {
        total: totalRevenue,
        growth: 0, // Calculate vs previous period
        byService: [], // Aggregate by service
        trend: [], // Daily/weekly breakdown
      },
      bookings: {
        total: totalBookings,
        growth: 0,
        byStatus: Object.entries(statusCounts).map(([status, count]) => ({ status, count })),
        completionRate: ((statusCounts['completed'] || 0) / totalBookings) * 100,
        cancellationRate: (((statusCounts['cancelled_by_user'] || 0) + (statusCounts['cancelled_by_shop'] || 0)) / totalBookings) * 100,
        trend: [],
      },
      customers: {
        unique: uniqueCustomers,
        repeat: 0, // Calculate repeat customers
        repeatRate: 0,
        averageSpend: uniqueCustomers > 0 ? totalRevenue / uniqueCustomers : 0,
      },
      reviews: {
        average: shop.average_rating || 0,
        count: reviews?.length || 0,
        distribution: Object.entries(ratingCounts).map(([rating, count]) => ({
          rating: parseInt(rating),
          count,
        })),
        recent: (reviews || []).slice(0, 5).map((r) => ({
          rating: r.rating,
          content: r.content,
          date: r.created_at,
        })),
      },
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Generate financial report data
   */
  private async generateFinancialReport(startDate: string, endDate: string): Promise<any> {
    // Implementation similar to platform summary with financial focus
    return {
      period: { start: startDate, end: endDate },
      // Add financial-specific data
    };
  }

  /**
   * Generate user engagement report data
   */
  private async generateUserEngagementReport(startDate: string, endDate: string): Promise<any> {
    // Implementation for user engagement metrics
    return {
      period: { start: startDate, end: endDate },
      // Add user engagement data
    };
  }

  // Helper methods
  private calculateDateRange(
    period: ReportPeriod,
    customStart?: string,
    customEnd?: string
  ): { startDate: string; endDate: string } {
    const now = new Date();
    let startDate: Date;
    let endDate = new Date(now);

    switch (period) {
      case 'daily':
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 1);
        break;
      case 'weekly':
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 7);
        break;
      case 'monthly':
        startDate = new Date(now);
        startDate.setMonth(startDate.getMonth() - 1);
        break;
      case 'quarterly':
        startDate = new Date(now);
        startDate.setMonth(startDate.getMonth() - 3);
        break;
      case 'yearly':
        startDate = new Date(now);
        startDate.setFullYear(startDate.getFullYear() - 1);
        break;
      case 'custom':
        if (!customStart || !customEnd) {
          throw new Error('Custom period requires start and end dates');
        }
        return { startDate: customStart, endDate: customEnd };
      default:
        throw new Error(`Unknown period: ${period}`);
    }

    return {
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
    };
  }

  private formatPeriodLabel(startDate: string, endDate: string): string {
    const start = new Date(startDate);
    const end = new Date(endDate);

    return `${start.toLocaleDateString('ko-KR')} - ${end.toLocaleDateString('ko-KR')}`;
  }

  private mapReportJob(data: any): ReportJob {
    return {
      id: data.id,
      userId: data.user_id,
      type: data.type,
      period: data.period,
      startDate: data.start_date,
      endDate: data.end_date,
      format: data.format,
      status: data.status,
      fileName: data.file_name,
      fileUrl: data.file_url,
      fileSize: data.file_size,
      error: data.error,
      expiresAt: data.expires_at,
      createdAt: data.created_at,
      completedAt: data.completed_at,
    };
  }

  private async updateJobStatus(jobId: string, status: string): Promise<void> {
    await supabase.from('report_jobs').update({ status }).eq('id', jobId);
  }

  // Placeholder methods for data aggregation
  private async getRevenueByCategory(startDate: string, endDate: string): Promise<any[]> {
    return [];
  }

  private async getRevenueByPaymentMethod(startDate: string, endDate: string): Promise<any[]> {
    return [];
  }

  private async getRevenueTrend(startDate: string, endDate: string): Promise<any[]> {
    return [];
  }

  private async getBookingsByStatus(startDate: string, endDate: string): Promise<any[]> {
    return [];
  }

  private async getBookingTrend(startDate: string, endDate: string): Promise<any[]> {
    return [];
  }

  private async getTopShops(metric: string, startDate: string, endDate: string): Promise<any[]> {
    return [];
  }

  private calculateCancellationRate(bookings: any[]): number {
    return 0;
  }

  private calculateNoShowRate(bookings: any[]): number {
    return 0;
  }
}

export const reportService = new ReportService();
```

### Step 3: Create PDF Generator Utility

**File:** `src/utils/pdf-generator.ts`

```typescript
/**
 * PDF Generator Utility
 * Generates PDF reports using puppeteer
 */

import puppeteer from 'puppeteer';
import { generateHTML } from './html-generator';

export async function generatePDF(
  title: string,
  data: any,
  language: 'ko' | 'en' = 'ko'
): Promise<Buffer> {
  const html = await generateHTML(title, data, language);

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });

    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20mm',
        right: '15mm',
        bottom: '20mm',
        left: '15mm',
      },
    });

    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
```

### Step 4: Create HTML Template Generator

**File:** `src/utils/html-generator.ts`

```typescript
/**
 * HTML Report Generator
 * Generates HTML reports with charts and styling
 */

import { PlatformSummaryData, ShopPerformanceData } from '@/types/report.types';

export async function generateHTML(
  title: string,
  data: any,
  language: 'ko' | 'en' = 'ko'
): Promise<string> {
  const isKorean = language === 'ko';

  return `
<!DOCTYPE html>
<html lang="${language}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: 'Noto Sans KR', -apple-system, BlinkMacSystemFont, sans-serif;
      color: #1a1a1a;
      line-height: 1.6;
      background: #fff;
    }

    .container {
      max-width: 800px;
      margin: 0 auto;
      padding: 40px 30px;
    }

    .header {
      text-align: center;
      margin-bottom: 40px;
      padding-bottom: 20px;
      border-bottom: 2px solid #eee;
    }

    .header h1 {
      font-size: 28px;
      color: #111;
      margin-bottom: 8px;
    }

    .header .period {
      color: #666;
      font-size: 14px;
    }

    .header .generated {
      color: #999;
      font-size: 12px;
      margin-top: 8px;
    }

    .section {
      margin-bottom: 40px;
    }

    .section-title {
      font-size: 18px;
      font-weight: 600;
      color: #333;
      margin-bottom: 16px;
      padding-bottom: 8px;
      border-bottom: 1px solid #eee;
    }

    .summary-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;
      margin-bottom: 24px;
    }

    .summary-card {
      background: #f8f9fa;
      border-radius: 8px;
      padding: 16px;
      text-align: center;
    }

    .summary-card .value {
      font-size: 24px;
      font-weight: 700;
      color: #111;
    }

    .summary-card .label {
      font-size: 12px;
      color: #666;
      margin-top: 4px;
    }

    .summary-card .change {
      font-size: 12px;
      margin-top: 4px;
    }

    .change.positive { color: #10b981; }
    .change.negative { color: #ef4444; }

    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 16px;
    }

    th, td {
      padding: 12px;
      text-align: left;
      border-bottom: 1px solid #eee;
    }

    th {
      background: #f8f9fa;
      font-weight: 600;
      font-size: 13px;
      color: #666;
    }

    td {
      font-size: 14px;
    }

    .text-right {
      text-align: right;
    }

    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #eee;
      text-align: center;
      color: #999;
      font-size: 11px;
    }

    .logo {
      font-weight: 700;
      color: #f97316;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${title}</h1>
      ${data.period ? `
        <p class="period">${data.period.label}</p>
      ` : ''}
      <p class="generated">
        ${isKorean ? '생성일' : 'Generated'}: ${new Date(data.generatedAt).toLocaleString(isKorean ? 'ko-KR' : 'en-US')}
      </p>
    </div>

    ${renderSummarySection(data, isKorean)}
    ${renderRevenueSection(data, isKorean)}
    ${renderBookingSection(data, isKorean)}
    ${renderTopShopsSection(data, isKorean)}

    <div class="footer">
      <span class="logo">eBeautything</span> &copy; ${new Date().getFullYear()}
    </div>
  </div>
</body>
</html>
  `;
}

function renderSummarySection(data: any, isKorean: boolean): string {
  if (!data.summary) return '';

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW' }).format(value);

  const formatChange = (value: number) => {
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(1)}%`;
  };

  return `
    <div class="section">
      <h2 class="section-title">${isKorean ? '요약' : 'Summary'}</h2>
      <div class="summary-grid">
        <div class="summary-card">
          <div class="value">${formatCurrency(data.summary.totalRevenue)}</div>
          <div class="label">${isKorean ? '총 매출' : 'Total Revenue'}</div>
          <div class="change ${data.summary.revenueGrowth >= 0 ? 'positive' : 'negative'}">
            ${formatChange(data.summary.revenueGrowth)}
          </div>
        </div>
        <div class="summary-card">
          <div class="value">${data.summary.totalBookings.toLocaleString()}</div>
          <div class="label">${isKorean ? '총 예약' : 'Total Bookings'}</div>
          <div class="change ${data.summary.bookingsGrowth >= 0 ? 'positive' : 'negative'}">
            ${formatChange(data.summary.bookingsGrowth)}
          </div>
        </div>
        <div class="summary-card">
          <div class="value">${data.summary.totalUsers.toLocaleString()}</div>
          <div class="label">${isKorean ? '활성 사용자' : 'Active Users'}</div>
          <div class="change ${data.summary.usersGrowth >= 0 ? 'positive' : 'negative'}">
            ${formatChange(data.summary.usersGrowth)}
          </div>
        </div>
        <div class="summary-card">
          <div class="value">${data.summary.averageRating.toFixed(1)}</div>
          <div class="label">${isKorean ? '평균 평점' : 'Avg Rating'}</div>
        </div>
      </div>
    </div>
  `;
}

function renderRevenueSection(data: any, isKorean: boolean): string {
  if (!data.revenue?.byCategory?.length) return '';

  return `
    <div class="section">
      <h2 class="section-title">${isKorean ? '카테고리별 매출' : 'Revenue by Category'}</h2>
      <table>
        <thead>
          <tr>
            <th>${isKorean ? '카테고리' : 'Category'}</th>
            <th class="text-right">${isKorean ? '금액' : 'Amount'}</th>
            <th class="text-right">${isKorean ? '비율' : 'Percentage'}</th>
          </tr>
        </thead>
        <tbody>
          ${data.revenue.byCategory.map((item: any) => `
            <tr>
              <td>${item.category}</td>
              <td class="text-right">${item.amount.toLocaleString()}원</td>
              <td class="text-right">${item.percentage.toFixed(1)}%</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderBookingSection(data: any, isKorean: boolean): string {
  if (!data.bookings) return '';

  return `
    <div class="section">
      <h2 class="section-title">${isKorean ? '예약 현황' : 'Booking Status'}</h2>
      <div class="summary-grid">
        <div class="summary-card">
          <div class="value">${data.bookings.conversionRate.toFixed(1)}%</div>
          <div class="label">${isKorean ? '전환율' : 'Conversion Rate'}</div>
        </div>
        <div class="summary-card">
          <div class="value">${data.bookings.cancellationRate.toFixed(1)}%</div>
          <div class="label">${isKorean ? '취소율' : 'Cancellation Rate'}</div>
        </div>
        <div class="summary-card">
          <div class="value">${data.bookings.noShowRate.toFixed(1)}%</div>
          <div class="label">${isKorean ? '노쇼율' : 'No-Show Rate'}</div>
        </div>
      </div>
    </div>
  `;
}

function renderTopShopsSection(data: any, isKorean: boolean): string {
  if (!data.topShops?.byRevenue?.length) return '';

  return `
    <div class="section">
      <h2 class="section-title">${isKorean ? '매출 상위 샵' : 'Top Shops by Revenue'}</h2>
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>${isKorean ? '샵명' : 'Shop Name'}</th>
            <th class="text-right">${isKorean ? '매출' : 'Revenue'}</th>
          </tr>
        </thead>
        <tbody>
          ${data.topShops.byRevenue.slice(0, 10).map((shop: any, index: number) => `
            <tr>
              <td>${index + 1}</td>
              <td>${shop.name}</td>
              <td class="text-right">${shop.revenue.toLocaleString()}원</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}
```

---

## Admin Panel Implementation

### Step 5: Create Report Generation UI

**File:** `src/components/reports/ReportGenerator.tsx`

```tsx
/**
 * ReportGenerator Component
 * UI for generating admin reports
 */

'use client';

import React, { useState } from 'react';
import { FileText, Download, Calendar, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DatePickerWithRange } from '@/components/ui/date-range-picker';
import { useReport } from '@/hooks/use-report';
import { ReportHistory } from './ReportHistory';
import type { ReportType, ReportPeriod, ReportFormat } from '@/types/report.types';
import { DateRange } from 'react-day-picker';

const reportTypes: { value: ReportType; label: string; description: string }[] = [
  {
    value: 'platform_summary',
    label: '플랫폼 종합 리포트',
    description: '매출, 예약, 사용자 등 전체 현황',
  },
  {
    value: 'financial',
    label: '재무 리포트',
    description: '매출, 결제, 환불 상세 내역',
  },
  {
    value: 'user_engagement',
    label: '사용자 참여 리포트',
    description: '가입, 활동, 리텐션 분석',
  },
];

const periodOptions: { value: ReportPeriod; label: string }[] = [
  { value: 'daily', label: '일간' },
  { value: 'weekly', label: '주간' },
  { value: 'monthly', label: '월간' },
  { value: 'quarterly', label: '분기' },
  { value: 'yearly', label: '연간' },
  { value: 'custom', label: '기간 선택' },
];

const formatOptions: { value: ReportFormat; label: string }[] = [
  { value: 'pdf', label: 'PDF' },
  { value: 'html', label: 'HTML' },
  { value: 'json', label: 'JSON' },
];

export function ReportGenerator() {
  const { generateReport, isGenerating } = useReport();

  const [selectedType, setSelectedType] = useState<ReportType>('platform_summary');
  const [selectedPeriod, setSelectedPeriod] = useState<ReportPeriod>('monthly');
  const [selectedFormat, setSelectedFormat] = useState<ReportFormat>('pdf');
  const [dateRange, setDateRange] = useState<DateRange | undefined>();

  const handleGenerate = () => {
    generateReport({
      type: selectedType,
      period: selectedPeriod,
      format: selectedFormat,
      startDate: selectedPeriod === 'custom' ? dateRange?.from?.toISOString().split('T')[0] : undefined,
      endDate: selectedPeriod === 'custom' ? dateRange?.to?.toISOString().split('T')[0] : undefined,
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            리포트 생성
          </CardTitle>
          <CardDescription>
            플랫폼 데이터를 분석한 리포트를 생성합니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Report Type */}
          <div className="space-y-2">
            <label className="text-sm font-medium">리포트 유형</label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {reportTypes.map((type) => (
                <div
                  key={type.value}
                  onClick={() => setSelectedType(type.value)}
                  className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                    selectedType === type.value
                      ? 'border-primary bg-primary/5'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <p className="font-medium text-sm">{type.label}</p>
                  <p className="text-xs text-muted-foreground mt-1">{type.description}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Period & Format */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">기간</label>
              <Select
                value={selectedPeriod}
                onValueChange={(v) => setSelectedPeriod(v as ReportPeriod)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {periodOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedPeriod === 'custom' && (
              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-medium">날짜 범위</label>
                <DatePickerWithRange
                  date={dateRange}
                  onDateChange={setDateRange}
                />
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium">형식</label>
              <Select
                value={selectedFormat}
                onValueChange={(v) => setSelectedFormat(v as ReportFormat)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {formatOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Generate Button */}
          <Button
            onClick={handleGenerate}
            disabled={isGenerating || (selectedPeriod === 'custom' && (!dateRange?.from || !dateRange?.to))}
            className="w-full md:w-auto"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                생성 중...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                리포트 생성
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Report History */}
      <Card>
        <CardHeader>
          <CardTitle>최근 리포트</CardTitle>
        </CardHeader>
        <CardContent>
          <ReportHistory />
        </CardContent>
      </Card>
    </div>
  );
}

export default ReportGenerator;
```

---

## Files to Create/Modify

### Backend

| File | Action | Description |
|------|--------|-------------|
| `src/migrations/XXX_create_report_jobs.sql` | **CREATE** | Database migration |
| `src/types/report.types.ts` | **CREATE** | TypeScript types |
| `src/services/report.service.ts` | **CREATE** | Report generation service |
| `src/utils/pdf-generator.ts` | **CREATE** | PDF generation utility |
| `src/utils/html-generator.ts` | **CREATE** | HTML template generator |
| `src/routes/admin/report.routes.ts` | **CREATE** | API routes |
| `package.json` | **MODIFY** | Add puppeteer dependency |

### Admin Panel

| File | Action | Description |
|------|--------|-------------|
| `src/types/report.types.ts` | **CREATE** | TypeScript types |
| `src/hooks/use-report.ts` | **CREATE** | Report generation hook |
| `src/components/reports/ReportGenerator.tsx` | **CREATE** | Report generation UI |
| `src/components/reports/ReportHistory.tsx` | **CREATE** | Report history list |
| `src/app/dashboard/reports/page.tsx` | **CREATE** | Reports page |

---

## Deployment Checklist

- [ ] Install puppeteer
- [ ] Run database migration
- [ ] Create storage bucket for reports
- [ ] Deploy backend service
- [ ] Deploy admin panel pages
- [ ] Test report generation
- [ ] Set up scheduled report cron job (optional)
- [ ] Deploy to production

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Report generation success rate | >95% |
| Average generation time | <60 seconds |
| Report usage | >10 reports/week |
| User satisfaction | Positive feedback |
