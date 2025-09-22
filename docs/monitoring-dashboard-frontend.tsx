/**
 * Production Monitoring Dashboard Frontend Component
 * 
 * React component for the production monitoring dashboard:
 * - Real-time metrics display
 * - Interactive charts and graphs
 * - Alert management interface
 * - System health status
 * - SLA reporting
 * - WebSocket integration for live updates
 * 
 * Note: This is a reference implementation for frontend integration
 */

import React, { useState, useEffect, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';
import {
  Card, CardContent, CardHeader, CardTitle,
  Alert, AlertDescription,
  Badge, Button, Tabs, TabsContent, TabsList, TabsTrigger,
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
  Dialog, DialogContent, DialogHeader, DialogTitle,
  Textarea, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui';

// Types
interface RealTimeMetrics {
  timestamp: string;
  payments: {
    totalTransactions: number;
    successfulTransactions: number;
    failedTransactions: number;
    successRate: number;
    totalVolume: number;
    averageTransactionValue: number;
    transactionsPerSecond: number;
  };
  system: {
    responseTime: number;
    errorRate: number;
    availability: number;
    cpuUsage: number;
    memoryUsage: number;
    diskUsage: number;
    activeConnections: number;
  };
  security: {
    fraudAttempts: number;
    blockedTransactions: number;
    securityAlerts: number;
    suspiciousActivity: number;
  };
  business: {
    revenue: number;
    pointsEarned: number;
    pointsRedeemed: number;
    refundAmount: number;
    chargebackAmount: number;
  };
}

interface Alert {
  id: string;
  type: 'payment' | 'system' | 'security' | 'business';
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  metric: string;
  threshold: number;
  currentValue: number;
  timestamp: string;
  status: 'active' | 'acknowledged' | 'resolved';
  assignee?: string;
  escalationLevel: number;
  actions: string[];
}

interface DashboardWidget {
  id: string;
  type: 'metric' | 'chart' | 'table' | 'alert' | 'status';
  title: string;
  description: string;
  position: { x: number; y: number; width: number; height: number };
  config: any;
  data?: any;
  lastUpdated: string;
}

// Main Dashboard Component
export const MonitoringDashboard: React.FC = () => {
  const [metrics, setMetrics] = useState<RealTimeMetrics | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [widgets, setWidgets] = useState<DashboardWidget[]>([]);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const [metricsHistory, setMetricsHistory] = useState<RealTimeMetrics[]>([]);
  const [activeTab, setActiveTab] = useState('overview');

  // Initialize WebSocket connection
  useEffect(() => {
    const token = localStorage.getItem('authToken');
    const socketInstance = io('/socket.io/monitoring', {
      auth: { token },
      transports: ['websocket']
    });

    socketInstance.on('connect', () => {
      setIsConnected(true);
      console.log('Connected to monitoring WebSocket');
      
      // Subscribe to metrics and alerts
      socketInstance.emit('subscribe_metrics', {
        metrics: ['all'],
        interval: 30000
      });
      
      socketInstance.emit('subscribe_alerts', {
        severityFilter: ['critical', 'high', 'medium', 'low'],
        typeFilter: ['payment', 'system', 'security', 'business']
      });
    });

    socketInstance.on('disconnect', () => {
      setIsConnected(false);
      console.log('Disconnected from monitoring WebSocket');
    });

    socketInstance.on('initial_dashboard_data', (data) => {
      setMetrics(data.metrics);
      setWidgets(data.widgets);
      setAlerts(data.alerts);
    });

    socketInstance.on('metrics_update', (data) => {
      setMetrics(data.metrics);
      setMetricsHistory(prev => [...prev.slice(-23), data.metrics]); // Keep last 24 data points
    });

    socketInstance.on('alert_created', (data) => {
      if (data.alert) {
        setAlerts(prev => [data.alert, ...prev]);
      } else if (data.alerts) {
        setAlerts(data.alerts);
      }
    });

    socketInstance.on('alert_updated', (data) => {
      setAlerts(prev => prev.map(alert => 
        alert.id === data.alert.id ? { ...alert, ...data.alert } : alert
      ));
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, []);

  // Load initial data
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const [metricsRes, widgetsRes, alertsRes] = await Promise.all([
          fetch('/api/monitoring/metrics'),
          fetch('/api/monitoring/widgets'),
          fetch('/api/monitoring/alerts')
        ]);

        const [metricsData, widgetsData, alertsData] = await Promise.all([
          metricsRes.json(),
          widgetsRes.json(),
          alertsRes.json()
        ]);

        if (metricsData.success) setMetrics(metricsData.data);
        if (widgetsData.success) setWidgets(widgetsData.data);
        if (alertsData.success) setAlerts(alertsData.data);
      } catch (error) {
        console.error('Failed to load initial dashboard data:', error);
      }
    };

    loadInitialData();
  }, []);

  // Handle alert acknowledgment
  const handleAcknowledgeAlert = useCallback(async (alertId: string) => {
    try {
      const response = await fetch(`/api/monitoring/alerts/${alertId}/acknowledge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });

      if (response.ok) {
        setAlerts(prev => prev.map(alert => 
          alert.id === alertId ? { ...alert, status: 'acknowledged' } : alert
        ));
      }
    } catch (error) {
      console.error('Failed to acknowledge alert:', error);
    }
  }, []);

  // Handle alert resolution
  const handleResolveAlert = useCallback(async (alertId: string, resolution: string) => {
    try {
      const response = await fetch(`/api/monitoring/alerts/${alertId}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resolution })
      });

      if (response.ok) {
        setAlerts(prev => prev.filter(alert => alert.id !== alertId));
        setSelectedAlert(null);
      }
    } catch (error) {
      console.error('Failed to resolve alert:', error);
    }
  }, []);

  // Format currency
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency: 'KRW'
    }).format(value);
  };

  // Format percentage
  const formatPercentage = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  // Get severity color
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'destructive';
      case 'high': return 'destructive';
      case 'medium': return 'default';
      case 'low': return 'secondary';
      default: return 'default';
    }
  };

  // Render metric card
  const MetricCard: React.FC<{ title: string; value: string | number; change?: number; color?: string }> = ({
    title, value, change, color = 'blue'
  }) => (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {change !== undefined && (
          <p className={`text-xs ${change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {change >= 0 ? '+' : ''}{change.toFixed(1)}% from last hour
          </p>
        )}
      </CardContent>
    </Card>
  );

  // Render chart widget
  const ChartWidget: React.FC<{ widget: DashboardWidget }> = ({ widget }) => {
    if (!metricsHistory.length) return null;

    const chartData = metricsHistory.map((m, index) => ({
      time: new Date(m.timestamp).toLocaleTimeString(),
      ...m.payments,
      ...m.system
    }));

    return (
      <Card>
        <CardHeader>
          <CardTitle>{widget.title}</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            {widget.config.chartType === 'line' ? (
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="successRate" stroke="#8884d8" name="Success Rate %" />
                <Line type="monotone" dataKey="responseTime" stroke="#82ca9d" name="Response Time (ms)" />
              </LineChart>
            ) : (
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Area type="monotone" dataKey="totalVolume" stackId="1" stroke="#8884d8" fill="#8884d8" name="Volume" />
              </AreaChart>
            )}
          </ResponsiveContainer>
        </CardContent>
      </Card>
    );
  };

  // Render alerts table
  const AlertsTable: React.FC = () => (
    <Card>
      <CardHeader>
        <CardTitle>Active Alerts</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Severity</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Time</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {alerts.map((alert) => (
              <TableRow key={alert.id}>
                <TableCell>
                  <Badge variant={getSeverityColor(alert.severity)}>
                    {alert.severity.toUpperCase()}
                  </Badge>
                </TableCell>
                <TableCell>{alert.type}</TableCell>
                <TableCell>{alert.title}</TableCell>
                <TableCell>{new Date(alert.timestamp).toLocaleString()}</TableCell>
                <TableCell>
                  <Badge variant={alert.status === 'active' ? 'destructive' : 'default'}>
                    {alert.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    {alert.status === 'active' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleAcknowledgeAlert(alert.id)}
                      >
                        Acknowledge
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setSelectedAlert(alert)}
                    >
                      Details
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );

  // Render alert dialog
  const AlertDialog: React.FC = () => {
    const [resolution, setResolution] = useState('');

    if (!selectedAlert) return null;

    return (
      <Dialog open={!!selectedAlert} onOpenChange={() => setSelectedAlert(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedAlert.title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <strong>Description:</strong>
              <p>{selectedAlert.description}</p>
            </div>
            <div>
              <strong>Metric:</strong> {selectedAlert.metric}
            </div>
            <div>
              <strong>Threshold:</strong> {selectedAlert.threshold}
            </div>
            <div>
              <strong>Current Value:</strong> {selectedAlert.currentValue}
            </div>
            <div>
              <strong>Recommended Actions:</strong>
              <ul className="list-disc list-inside">
                {selectedAlert.actions.map((action, index) => (
                  <li key={index}>{action}</li>
                ))}
              </ul>
            </div>
            {selectedAlert.status === 'active' && (
              <div className="space-y-2">
                <label>Resolution:</label>
                <Textarea
                  value={resolution}
                  onChange={(e) => setResolution(e.target.value)}
                  placeholder="Describe how this alert was resolved..."
                />
                <Button
                  onClick={() => handleResolveAlert(selectedAlert.id, resolution)}
                  disabled={!resolution.trim()}
                >
                  Resolve Alert
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    );
  };

  if (!metrics) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
          <p className="mt-4">Loading monitoring dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Production Monitoring Dashboard</h1>
        <div className="flex items-center gap-4">
          <Badge variant={isConnected ? 'default' : 'destructive'}>
            {isConnected ? 'Connected' : 'Disconnected'}
          </Badge>
          <span className="text-sm text-gray-500">
            Last updated: {new Date(metrics.timestamp).toLocaleString()}
          </span>
        </div>
      </div>

      {/* Critical Alerts Banner */}
      {alerts.filter(a => a.severity === 'critical').length > 0 && (
        <Alert>
          <AlertDescription>
            {alerts.filter(a => a.severity === 'critical').length} critical alert(s) require immediate attention!
          </AlertDescription>
        </Alert>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
          <TabsTrigger value="system">System</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="alerts">Alerts</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              title="Payment Success Rate"
              value={formatPercentage(metrics.payments.successRate)}
              color="green"
            />
            <MetricCard
              title="Response Time"
              value={`${metrics.system.responseTime}ms`}
              color="orange"
            />
            <MetricCard
              title="System Availability"
              value={formatPercentage(metrics.system.availability)}
              color="green"
            />
            <MetricCard
              title="Active Alerts"
              value={alerts.filter(a => a.status === 'active').length}
              color="red"
            />
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {widgets
              .filter(w => w.type === 'chart')
              .map(widget => (
                <ChartWidget key={widget.id} widget={widget} />
              ))}
          </div>
        </TabsContent>

        {/* Payments Tab */}
        <TabsContent value="payments" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              title="Total Transactions"
              value={metrics.payments.totalTransactions.toLocaleString()}
            />
            <MetricCard
              title="Transaction Volume"
              value={formatCurrency(metrics.payments.totalVolume)}
            />
            <MetricCard
              title="Average Transaction"
              value={formatCurrency(metrics.payments.averageTransactionValue)}
            />
            <MetricCard
              title="TPS"
              value={metrics.payments.transactionsPerSecond.toFixed(2)}
            />
          </div>
        </TabsContent>

        {/* System Tab */}
        <TabsContent value="system" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              title="CPU Usage"
              value={formatPercentage(metrics.system.cpuUsage)}
            />
            <MetricCard
              title="Memory Usage"
              value={formatPercentage(metrics.system.memoryUsage)}
            />
            <MetricCard
              title="Disk Usage"
              value={formatPercentage(metrics.system.diskUsage)}
            />
            <MetricCard
              title="Active Connections"
              value={metrics.system.activeConnections}
            />
          </div>
        </TabsContent>

        {/* Security Tab */}
        <TabsContent value="security" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              title="Fraud Attempts"
              value={metrics.security.fraudAttempts}
              color="red"
            />
            <MetricCard
              title="Blocked Transactions"
              value={metrics.security.blockedTransactions}
              color="red"
            />
            <MetricCard
              title="Security Alerts"
              value={metrics.security.securityAlerts}
              color="yellow"
            />
            <MetricCard
              title="Suspicious Activity"
              value={metrics.security.suspiciousActivity}
              color="orange"
            />
          </div>
        </TabsContent>

        {/* Alerts Tab */}
        <TabsContent value="alerts" className="space-y-6">
          <AlertsTable />
        </TabsContent>
      </Tabs>

      {/* Alert Dialog */}
      <AlertDialog />
    </div>
  );
};

export default MonitoringDashboard;

