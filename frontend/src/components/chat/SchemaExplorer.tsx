'use client';

import React, { useState } from 'react';
import { Database, ChevronDown, ChevronRight, Key, HelpCircle } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';

interface TableMeta {
  name: string;
  columns: { name: string; type: string; isPk?: boolean; isFk?: boolean }[];
  description: string;
}

const DATABASE_SCHEMA: TableMeta[] = [
  {
    name: "customers",
    description: "Contains retail customer demographic details",
    columns: [
      { name: "customer_id", type: "integer", isPk: true },
      { name: "name", type: "varchar(100)" },
      { name: "city", type: "varchar(100)" },
      { name: "tier", type: "varchar(20)" },
      { name: "created_at", type: "timestamp" }
    ]
  },
  {
    name: "products",
    description: "Inventory items and purchase cost catalog",
    columns: [
      { name: "product_id", type: "integer", isPk: true },
      { name: "product_name", type: "varchar(150)" },
      { name: "category", type: "varchar(100)" },
      { name: "unit_price", type: "decimal(10,2)" },
      { name: "cost", type: "decimal(10,2)" }
    ]
  },
  {
    name: "orders",
    description: "Main client order transaction headers",
    columns: [
      { name: "order_id", type: "integer", isPk: true },
      { name: "customer_id", type: "integer", isFk: true },
      { name: "order_date", type: "timestamp" },
      { name: "status", type: "varchar(50)" },
      { name: "order_total", type: "decimal(12,2)" }
    ]
  },
  {
    name: "payments",
    description: "Records invoice payment transactions and methods",
    columns: [
      { name: "payment_id", type: "integer", isPk: true },
      { name: "order_id", type: "integer", isFk: true },
      { name: "amount", type: "decimal(12,2)" },
      { name: "method", type: "varchar(50)" },
      { name: "paid_date", type: "timestamp" },
      { name: "status", type: "varchar(50)" }
    ]
  },
  {
    name: "order_items",
    description: "Line items detailing items ordered, quantities, and price",
    columns: [
      { name: "order_item_id", type: "integer", isPk: true },
      { name: "order_id", type: "integer", isFk: true },
      { name: "product_id", type: "integer", isFk: true },
      { name: "quantity", type: "integer" },
      { name: "unit_price", type: "decimal(10,2)" },
      { name: "line_total", type: "decimal(12,2)" }
    ]
  }
];

export const SchemaExplorer: React.FC = () => {
  const [expandedTable, setExpandedTable] = useState<string | null>("customers");

  const toggleTable = (name: string) => {
    setExpandedTable(expandedTable === name ? null : name);
  };

  return (
    <Card className="border-border/60 bg-card shadow-sm h-full flex flex-col">
      <CardHeader className="px-4 py-3.5 border-b border-border/60 flex flex-row items-center gap-2">
        <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Schema Explorer</CardTitle>
      </CardHeader>
      <CardContent className="p-2 space-y-0.5 flex-1 overflow-y-auto">
        {DATABASE_SCHEMA.map((table) => {
          const isExpanded = expandedTable === table.name;
          return (
            <div key={table.name} className="rounded-lg overflow-hidden">
              <button
                onClick={() => toggleTable(table.name)}
                className={`w-full px-3 py-2.5 flex items-center justify-between text-left rounded-lg transition-colors cursor-pointer ${isExpanded ? 'bg-muted/40' : 'hover:bg-muted/30'}`}
              >
                <div className="flex flex-col">
                  <span className="text-sm text-foreground font-mono font-medium">{table.name}</span>
                  <span className="text-[10px] text-muted-foreground font-normal mt-0.5">{table.description}</span>
                </div>
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground/60 shrink-0" />
                )}
              </button>

              {isExpanded && (
                <div className="px-3 pb-2 pt-1">
                  {table.columns.map((col) => (
                    <div key={col.name} className="py-1.5 pl-1 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5 font-mono">
                        {col.isPk && <Key className="h-3 w-3 text-amber-500" />}
                        {col.isFk && <Key className="h-3 w-3 text-primary rotate-90" />}
                        <span className="text-foreground/90">{col.name}</span>
                      </div>
                      <span className="text-muted-foreground/70 font-mono text-[10px]">{col.type}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        <div className="mx-1 mt-3 pt-3 border-t border-border/50 text-xs text-muted-foreground space-y-1.5">
          <div className="flex items-center gap-1.5 font-semibold text-foreground/80">
            <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
            <span>Business Glossary</span>
          </div>
          <ul className="space-y-1 text-[11px] text-muted-foreground pl-0.5">
            <li><strong className="text-foreground/80 font-medium">Revenue</strong> — sum of paid payments.</li>
            <li><strong className="text-foreground/80 font-medium">Profit</strong> — revenue minus product cost.</li>
            <li><strong className="text-foreground/80 font-medium">Best seller</strong> — highest quantity sold.</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};

export default SchemaExplorer;
