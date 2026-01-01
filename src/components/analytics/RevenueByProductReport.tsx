interface RevenueByProductReportProps {
  invoices: any[];
  payments: any[];
}

interface ProductRevenueData {
  productName: string;
  unitsSold: number;
  revenue: number;
  averagePrice: number;
  percentOfTotalRevenue: number;
}

export default function RevenueByProductReport({ }: RevenueByProductReportProps) {
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-8 text-center">
      <h3 className="text-lg font-semibold text-blue-900 mb-2">Product-Level Data Required</h3>
      <p className="text-blue-800">
        This report requires product line item data from Printavo. To enable this report, line item syncing needs to be configured in your database schema.
      </p>
    </div>
  );
}
