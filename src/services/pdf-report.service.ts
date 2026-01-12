/**
 * PDF Report Service
 * Generates PDF reports for analytics and business data
 */

import { TDocumentDefinitions, Content, TableCell } from 'pdfmake/interfaces';
import { logger } from '../utils/logger';

// pdfmake CommonJS require
// eslint-disable-next-line @typescript-eslint/no-var-requires
const PdfPrinter = require('pdfmake');

// Font definitions for pdfmake
const fonts = {
  Helvetica: {
    normal: 'Helvetica',
    bold: 'Helvetica-Bold',
    italics: 'Helvetica-Oblique',
    bolditalics: 'Helvetica-BoldOblique',
  },
};

const printer = new PdfPrinter(fonts);

export interface ShopAnalyticsReportData {
  shopName: string;
  period: string;
  dateRange: {
    start: string;
    end: string;
  };
  overview: {
    totalReservations: number;
    completedReservations: number;
    cancelledReservations: number;
    noShowCount: number;
    completionRate: number;
    totalRevenue: number;
    averageOrderValue: number;
    growthRate: number;
  };
  chartData: Array<{
    date: string;
    reservations: number;
    revenue: number;
  }>;
  topServices?: Array<{
    name: string;
    count: number;
    revenue: number;
  }>;
  staffPerformance?: Array<{
    name: string;
    reservationCount: number;
    revenue: number;
    completionRate: number;
  }>;
}

export class PdfReportService {
  /**
   * Generate shop analytics PDF report
   */
  static async generateShopAnalyticsReport(data: ShopAnalyticsReportData): Promise<Buffer> {
    try {
      const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('ko-KR', {
          style: 'currency',
          currency: 'KRW',
        }).format(amount);
      };

      const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('ko-KR', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        });
      };

      const periodLabels: Record<string, string> = {
        day: '일간',
        week: '주간',
        month: '월간',
        year: '연간',
      };

      // Build document content
      const content: Content[] = [
        // Header
        {
          text: `${data.shopName} 매출 분석 리포트`,
          style: 'header',
          alignment: 'center',
          margin: [0, 0, 0, 10],
        },
        {
          text: `${periodLabels[data.period] || data.period} 리포트 (${formatDate(data.dateRange.start)} ~ ${formatDate(data.dateRange.end)})`,
          style: 'subheader',
          alignment: 'center',
          margin: [0, 0, 0, 20],
        },
        {
          text: `생성일: ${new Date().toLocaleDateString('ko-KR')}`,
          style: 'small',
          alignment: 'right',
          margin: [0, 0, 0, 20],
        },

        // Overview Section
        { text: '개요', style: 'sectionHeader', margin: [0, 10, 0, 10] },
        {
          table: {
            widths: ['*', '*', '*', '*'],
            body: [
              [
                { text: '총 예약', style: 'tableHeader' },
                { text: '완료 예약', style: 'tableHeader' },
                { text: '취소 예약', style: 'tableHeader' },
                { text: '노쇼', style: 'tableHeader' },
              ],
              [
                { text: `${data.overview.totalReservations}건`, style: 'tableCell' },
                { text: `${data.overview.completedReservations}건`, style: 'tableCell' },
                { text: `${data.overview.cancelledReservations || 0}건`, style: 'tableCell' },
                { text: `${data.overview.noShowCount || 0}건`, style: 'tableCell' },
              ],
            ],
          },
          layout: 'lightHorizontalLines',
          margin: [0, 0, 0, 15],
        },
        {
          table: {
            widths: ['*', '*', '*', '*'],
            body: [
              [
                { text: '총 매출', style: 'tableHeader' },
                { text: '평균 주문', style: 'tableHeader' },
                { text: '완료율', style: 'tableHeader' },
                { text: '성장률', style: 'tableHeader' },
              ],
              [
                { text: formatCurrency(data.overview.totalRevenue), style: 'tableCell' },
                { text: formatCurrency(data.overview.averageOrderValue), style: 'tableCell' },
                { text: `${data.overview.completionRate.toFixed(1)}%`, style: 'tableCell' },
                { text: `${data.overview.growthRate >= 0 ? '+' : ''}${data.overview.growthRate.toFixed(1)}%`, style: 'tableCell' },
              ],
            ],
          },
          layout: 'lightHorizontalLines',
          margin: [0, 0, 0, 20],
        },
      ];

      // Daily/Period Breakdown Table
      if (data.chartData && data.chartData.length > 0) {
        content.push(
          { text: '기간별 상세', style: 'sectionHeader', margin: [0, 10, 0, 10] },
          {
            table: {
              widths: ['*', 'auto', 'auto'],
              body: [
                [
                  { text: '날짜', style: 'tableHeader' },
                  { text: '예약 수', style: 'tableHeader' },
                  { text: '매출', style: 'tableHeader' },
                ],
                ...data.chartData.slice(0, 31).map((item) => [
                  { text: item.date, style: 'tableCell' },
                  { text: `${item.reservations}건`, style: 'tableCell' },
                  { text: formatCurrency(item.revenue), style: 'tableCell' },
                ] as TableCell[]),
              ],
            },
            layout: 'lightHorizontalLines',
            margin: [0, 0, 0, 20],
          }
        );
      }

      // Top Services Section
      if (data.topServices && data.topServices.length > 0) {
        content.push(
          { text: '서비스별 매출', style: 'sectionHeader', margin: [0, 10, 0, 10] },
          {
            table: {
              widths: ['*', 'auto', 'auto'],
              body: [
                [
                  { text: '서비스명', style: 'tableHeader' },
                  { text: '이용 횟수', style: 'tableHeader' },
                  { text: '매출', style: 'tableHeader' },
                ],
                ...data.topServices.map((service) => [
                  { text: service.name, style: 'tableCell' },
                  { text: `${service.count}건`, style: 'tableCell' },
                  { text: formatCurrency(service.revenue), style: 'tableCell' },
                ] as TableCell[]),
              ],
            },
            layout: 'lightHorizontalLines',
            margin: [0, 0, 0, 20],
          }
        );
      }

      // Staff Performance Section
      if (data.staffPerformance && data.staffPerformance.length > 0) {
        content.push(
          { text: '직원별 실적', style: 'sectionHeader', margin: [0, 10, 0, 10] },
          {
            table: {
              widths: ['*', 'auto', 'auto', 'auto'],
              body: [
                [
                  { text: '직원명', style: 'tableHeader' },
                  { text: '예약 수', style: 'tableHeader' },
                  { text: '매출', style: 'tableHeader' },
                  { text: '완료율', style: 'tableHeader' },
                ],
                ...data.staffPerformance.map((staff) => [
                  { text: staff.name, style: 'tableCell' },
                  { text: `${staff.reservationCount}건`, style: 'tableCell' },
                  { text: formatCurrency(staff.revenue), style: 'tableCell' },
                  { text: `${staff.completionRate.toFixed(1)}%`, style: 'tableCell' },
                ] as TableCell[]),
              ],
            },
            layout: 'lightHorizontalLines',
            margin: [0, 0, 0, 20],
          }
        );
      }

      // Footer
      content.push({
        text: 'eBeautything - 뷰티 예약 플랫폼',
        style: 'footer',
        alignment: 'center',
        margin: [0, 30, 0, 0],
      });

      const docDefinition: TDocumentDefinitions = {
        content,
        defaultStyle: {
          font: 'Helvetica',
          fontSize: 10,
        },
        styles: {
          header: {
            fontSize: 18,
            bold: true,
          },
          subheader: {
            fontSize: 12,
            color: '#666666',
          },
          sectionHeader: {
            fontSize: 14,
            bold: true,
            color: '#333333',
          },
          tableHeader: {
            bold: true,
            fontSize: 10,
            fillColor: '#f3f4f6',
            color: '#374151',
            alignment: 'center',
          },
          tableCell: {
            fontSize: 9,
            alignment: 'center',
          },
          small: {
            fontSize: 8,
            color: '#999999',
          },
          footer: {
            fontSize: 8,
            color: '#999999',
          },
        },
        pageSize: 'A4',
        pageMargins: [40, 40, 40, 40],
      };

      return new Promise((resolve, reject) => {
        try {
          const pdfDoc = printer.createPdfKitDocument(docDefinition);
          const chunks: Buffer[] = [];

          pdfDoc.on('data', (chunk: Buffer) => {
            chunks.push(chunk);
          });

          pdfDoc.on('end', () => {
            const result = Buffer.concat(chunks);
            resolve(result);
          });

          pdfDoc.on('error', (err: Error) => {
            reject(err);
          });

          pdfDoc.end();
        } catch (err) {
          reject(err);
        }
      });
    } catch (error) {
      logger.error('Error generating PDF report', { error });
      throw error;
    }
  }
}

export default PdfReportService;
