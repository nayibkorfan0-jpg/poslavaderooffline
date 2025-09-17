import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface MetricCardProps {
  title: string;
  value: string;
  icon: React.ReactNode;
  trend?: {
    value: string;
    type: 'up' | 'down' | 'neutral';
    label?: string;
  };
  className?: string;
}

export function MetricCard({ title, value, icon, trend, className }: MetricCardProps) {
  const getTrendIcon = () => {
    switch (trend?.type) {
      case 'up':
        return <TrendingUp className="h-3 w-3" />;
      case 'down':
        return <TrendingDown className="h-3 w-3" />;
      default:
        return <Minus className="h-3 w-3" />;
    }
  };

  const getTrendColor = () => {
    switch (trend?.type) {
      case 'up':
        return 'success';
      case 'down':
        return 'critical';
      default:
        return 'secondary';
    }
  };

  return (
    <Card className={className}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <p className="text-sm font-medium text-muted-foreground" data-testid={`text-metric-title`}>
              {title}
            </p>
            <p className="text-3xl font-semibold text-foreground mt-2" data-testid={`text-metric-value`}>
              {value}
            </p>
            {trend && (
              <div className="flex items-center gap-1 mt-2">
                <Badge variant={getTrendColor() as any} className="text-xs px-2 py-0.5">
                  {getTrendIcon()}
                  {trend.value}
                </Badge>
                {trend.label && (
                  <span className="text-xs text-muted-foreground">{trend.label}</span>
                )}
              </div>
            )}
          </div>
          <div className="text-primary text-2xl opacity-80">
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}