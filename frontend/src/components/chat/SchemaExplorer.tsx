'use client';

import React, { useState } from 'react';
import {
  Database, Search, ChevronRight, Key, HelpCircle, Table2,
  Columns, Layers, Copy, Check, Sparkles, Code2, ArrowUpRight
} from 'lucide-react';

interface ColumnMeta {
  name: string;
  type: string;
  isPk?: boolean;
  isFk?: boolean;
  fkTarget?: string;
  description: string;
  nullable?: boolean;
}

interface TableMeta {
  name: string;
  description: string;
  rowCount: string;
  columns: ColumnMeta[];
  sampleData: Record<string, any>[];
}

const DATABASE_SCHEMA: TableMeta[] = [
  {
    name: "customers",
    description: "Contains retail customer demographic details and membership tier",
    rowCount: "1,240 rows",
    columns: [
      { name: "customer_id", type: "integer", isPk: true, description: "Unique customer identifier", nullable: false },
      { name: "name", type: "varchar(100)", description: "Customer full name", nullable: false },
      { name: "city", type: "varchar(100)", description: "Primary residence city", nullable: true },
      { name: "tier", type: "varchar(20)", description: "Membership tier: Gold, Silver, Bronze", nullable: false },
      { name: "created_at", type: "timestamp", description: "Account creation date and time", nullable: false }
    ],
    sampleData: [
      { customer_id: 101, name: "Budi Santoso", city: "Jakarta", tier: "Gold", created_at: "2024-01-15 08:30" },
      { customer_id: 102, name: "Siti Rahma", city: "Surabaya", tier: "Silver", created_at: "2024-02-01 10:15" },
      { customer_id: 103, name: "Andi Wijaya", city: "Bandung", tier: "Bronze", created_at: "2024-02-20 14:00" }
    ]
  },
  {
    name: "products",
    description: "Inventory catalog containing unit pricing and manufacturing cost",
    rowCount: "450 rows",
    columns: [
      { name: "product_id", type: "integer", isPk: true, description: "Unique product catalog SKU ID", nullable: false },
      { name: "product_name", type: "varchar(150)", description: "Item title and model name", nullable: false },
      { name: "category", type: "varchar(100)", description: "Product vertical (Electronics, Beauty, etc.)", nullable: false },
      { name: "unit_price", type: "decimal(10,2)", description: "Retail sales price (IDR/USD)", nullable: false },
      { name: "cost", type: "decimal(10,2)", description: "Internal procurement unit cost", nullable: false }
    ],
    sampleData: [
      { product_id: 201, product_name: "Wireless Mechanical Keyboard", category: "Electronics", unit_price: 1250000, cost: 850000 },
      { product_id: 202, product_name: "Ergonomic Office Chair", category: "Office", unit_price: 2400000, cost: 1600000 },
      { product_id: 203, product_name: "Organic Coffee Beans 1kg", category: "Grocery", unit_price: 180000, cost: 110000 }
    ]
  },
  {
    name: "orders",
    description: "Main client transaction headers and order status pipeline",
    rowCount: "3,890 rows",
    columns: [
      { name: "order_id", type: "integer", isPk: true, description: "Unique transaction identifier", nullable: false },
      { name: "customer_id", type: "integer", isFk: true, fkTarget: "customers.customer_id", description: "Reference to purchasing customer", nullable: false },
      { name: "order_date", type: "timestamp", description: "Checkout timestamp", nullable: false },
      { name: "status", type: "varchar(50)", description: "Order status: completed, cancelled, refunded", nullable: false },
      { name: "order_total", type: "decimal(12,2)", description: "Total checkout amount before discounts", nullable: false }
    ],
    sampleData: [
      { order_id: 5001, customer_id: 101, order_date: "2024-03-01 11:20", status: "completed", order_total: 1250000 },
      { order_id: 5002, customer_id: 102, order_date: "2024-03-02 15:45", status: "completed", order_total: 2400000 },
      { order_id: 5003, customer_id: 103, order_date: "2024-03-03 09:10", status: "cancelled", order_total: 180000 }
    ]
  },
  {
    name: "payments",
    description: "Records invoice payment transactions and payment method breakdown",
    rowCount: "3,650 rows",
    columns: [
      { name: "payment_id", type: "integer", isPk: true, description: "Payment ledger receipt ID", nullable: false },
      { name: "order_id", type: "integer", isFk: true, fkTarget: "orders.order_id", description: "Associated order reference", nullable: false },
      { name: "amount", type: "decimal(12,2)", description: "Settled payment amount", nullable: false },
      { name: "method", type: "varchar(50)", description: "Gateway channel: credit_card, e_wallet, bank_transfer", nullable: false },
      { name: "paid_date", type: "timestamp", description: "Gateway settlement timestamp", nullable: false },
      { name: "status", type: "varchar(50)", description: "Settlement status: paid, refunded", nullable: false }
    ],
    sampleData: [
      { payment_id: 9001, order_id: 5001, amount: 1250000, method: "credit_card", paid_date: "2024-03-01 11:21", status: "paid" },
      { payment_id: 9002, order_id: 5002, amount: 2400000, method: "e_wallet", paid_date: "2024-03-02 15:46", status: "paid" }
    ]
  },
  {
    name: "order_items",
    description: "Line items detailing items ordered, quantities, and price breakdown",
    rowCount: "8,420 rows",
    columns: [
      { name: "order_item_id", type: "integer", isPk: true, description: "Line item entry ID", nullable: false },
      { name: "order_id", type: "integer", isFk: true, fkTarget: "orders.order_id", description: "Parent order header", nullable: false },
      { name: "product_id", type: "integer", isFk: true, fkTarget: "products.product_id", description: "Purchased product item", nullable: false },
      { name: "quantity", type: "integer", description: "Units purchased", nullable: false },
      { name: "unit_price", type: "decimal(10,2)", description: "Price per unit at purchase time", nullable: false },
      { name: "line_total", type: "decimal(12,2)", description: "Subtotal (quantity * unit_price)", nullable: false }
    ],
    sampleData: [
      { order_item_id: 12001, order_id: 5001, product_id: 201, quantity: 1, unit_price: 1250000, line_total: 1250000 },
      { order_item_id: 12002, order_id: 5002, product_id: 202, quantity: 1, unit_price: 2400000, line_total: 2400000 }
    ]
  }
];

export const SchemaExplorer: React.FC = () => {
  const [selectedTableName, setSelectedTableName] = useState<string>("customers");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<'columns' | 'sample' | 'sql'>('columns');
  const [copiedSql, setCopiedSql] = useState(false);

  const selectedTable = DATABASE_SCHEMA.find(t => t.name === selectedTableName) || DATABASE_SCHEMA[0];

  const filteredTables = DATABASE_SCHEMA.filter(t =>
    t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.columns.some(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const sampleSql = `SELECT 
  c.customer_id, 
  c.name, 
  COUNT(o.order_id) AS total_orders, 
  SUM(o.order_total) AS lifetime_value
FROM ${selectedTable.name} c
${selectedTable.name === 'orders' ? 'LEFT JOIN customers cust ON c.customer_id = cust.customer_id' : ''}
${selectedTable.name === 'order_items' ? 'LEFT JOIN products p ON c.product_id = p.product_id' : ''}
GROUP BY c.customer_id, c.name
ORDER BY lifetime_value DESC
LIMIT 10;`;

  const handleCopySql = () => {
    navigator.clipboard.writeText(sampleSql);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2000);
  };

  const totalTables = DATABASE_SCHEMA.length;
  const totalColumns = DATABASE_SCHEMA.reduce((acc, t) => acc + t.columns.length, 0);
  const totalFks = DATABASE_SCHEMA.reduce((acc, t) => acc + t.columns.filter(c => c.isFk).length, 0);

  return (
    <div className="w-full h-full min-h-screen bg-background p-4 lg:p-6 text-foreground flex flex-col space-y-6 overflow-y-auto">

      {/* 1. Schema Explorer Header & Overview Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5">
        <div className="flex items-start space-x-3.5">
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-xl font-bold text-foreground tracking-tight">Schema Explorer</h1>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Inspect relational tables, data types, keys, and foreign-key relationships powering Conda AI.
            </p>
          </div>
        </div>

        {/* Header Stats Pills */}
        <div className="grid grid-cols-3 gap-3 self-stretch md:self-auto">
          <div className="bg-muted/10 border border-border px-3.5 py-2 text-center">
            <div className="text-xs text-muted-foreground font-medium">Tables</div>
            <div className="text-base font-bold text-foreground font-mono">{totalTables}</div>
          </div>
          <div className="bg-muted/10 border border-border px-3.5 py-2 text-center">
            <div className="text-xs text-muted-foreground font-medium">Columns</div>
            <div className="text-base font-bold text-foreground font-mono">{totalColumns}</div>
          </div>
          <div className="bg-muted/10 border border-border px-3.5 py-2 text-center">
            <div className="text-xs text-muted-foreground font-medium">Foreign Keys</div>
            <div className="text-base font-bold text-primary font-mono">{totalFks}</div>
          </div>
        </div>
      </div>

      {/* 2. Main Content Split Grid: Left Table Selector & Right Table Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 items-start">

        {/* Left Side: Search & Table Navigator (4 cols on lg) */}
        <div className="lg:col-span-4 border border-border/80 p-4 flex flex-col space-y-4 shadow-sm">

          {/* Table Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search tables or columns..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-muted/10 border border-border rounded-l text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all"
            />
          </div>

          {/* List of Tables */}
          <div className="space-y-1.5 max-h-[500px] overflow-y-auto pr-1">
            <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider px-2 mb-1 flex items-center justify-between">
              <span>Database Tables ({filteredTables.length})</span>
            </div>

            {filteredTables.length === 0 ? (
              <div className="p-4 text-center text-xs text-muted-foreground italic bg-muted/10 border border-dashed border-border">
                No matching tables found
              </div>
            ) : (
              filteredTables.map((table) => {
                const isSelected = selectedTableName === table.name;
                const pkCount = table.columns.filter(c => c.isPk).length;

                return (
                  <button
                    key={table.name}
                    onClick={() => setSelectedTableName(table.name)}
                    className={`w-full text-left p-3 rounded-l transition-all duration-150 cursor-pointer flex items-center justify-between border ${isSelected
                      ? 'bg-primary/10 text-foreground'
                      : 'bg-muted/10 hover:bg-muted/30 border-transparent text-muted-foreground hover:text-foreground'
                      }`}
                  >
                    <div className="flex items-center space-x-3">
                      <div className={`h-8 w-8 rounded flex items-center justify-center text-xs font-bold ${isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted/10 text-muted-foreground'
                        }`}>
                        {table.name.substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-foreground flex items-center space-x-2">
                          <span>{table.name}</span>
                          {pkCount > 0 && <span title="Has Primary Key"><Key className="h-3 w-3 text-amber-500 inline" /></span>}
                        </div>
                        <div className="text-[10px] text-muted-foreground line-clamp-1 mt-0.5">
                          {table.columns.length} cols • {table.rowCount}
                        </div>
                      </div>
                    </div>
                    <ChevronRight className={`h-4 w-4 transition-transform ${isSelected ? 'text-primary translate-x-0.5' : 'text-muted-foreground/50'}`} />
                  </button>
                );
              })
            )}
          </div>

          {/* Business Glossary Banner */}
          <div className="p-3.5 bg-muted/10 border border-border/80 space-y-2 text-xs">
            <div className="flex items-center space-x-1.5 font-semibold text-foreground">
              <HelpCircle className="h-4 w-4" />
              <span>Business Glossary</span>
            </div>
            <ul className="space-y-1.5 text-[11px] text-muted-foreground">
              <li className="flex items-start space-x-1">
                <span className="font-bold text-foreground">Revenue:</span>
                <span>Sum of settled amounts in <code className="text-primary text-[10px]">payments</code> where status='paid'.</span>
              </li>
              <li className="flex items-start space-x-1">
                <span className="font-bold text-foreground">Margin:</span>
                <span>Difference between unit_price and cost in <code className="text-primary font-mono text-[10px]">products</code>.</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Right Side: Selected Table Details & Inspector (8 cols on lg) */}
        <div className="lg:col-span-8 bg-card border border-border/80 p-5 space-y-5 shadow-sm">

          {/* Selected Table Overview Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-border pb-4">
            <div>
              <div className="flex items-center space-x-2.5">
                <h2 className="text-lg font-bold text-foreground tracking-tight">{selectedTable.name}</h2>
                <span className="text-[11px] font-mono font-medium px-2.5 py-0.5 bg-muted/10 border border-border rounded text-muted-foreground">
                  {selectedTable.rowCount}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {selectedTable.description}
              </p>
            </div>

            {/* Navigation Tabs (Columns, Sample Data, SQL Preview) */}
            <div className="flex items-center space-x-1 bg-muted/10 p-1 border border-border rounded self-start md:self-auto">
              <button
                onClick={() => setActiveTab('columns')}
                className={`px-3 py-1.5 text-xs font-semibold rounded transition-all cursor-pointer ${activeTab === 'columns' ? 'bg-card text-foreground border border-border/60' : 'text-muted-foreground hover:text-foreground'
                  }`}
              >
                Columns ({selectedTable.columns.length})
              </button>
              <button
                onClick={() => setActiveTab('sample')}
                className={`px-3 py-1.5 text-xs font-semibold rounded transition-all cursor-pointer ${activeTab === 'sample' ? 'bg-card text-foreground border border-border/60' : 'text-muted-foreground hover:text-foreground'
                  }`}
              >
                Sample Data
              </button>
              <button
                onClick={() => setActiveTab('sql')}
                className={`px-3 py-1.5 text-xs font-semibold rounded transition-all cursor-pointer flex items-center space-x-1 ${activeTab === 'sql' ? 'bg-card text-foreground border border-border/60' : 'text-muted-foreground hover:text-foreground'
                  }`}
              >
                <span>SQL Query</span>
              </button>
            </div>
          </div>

          {/* TAB 1: Columns View */}
          {activeTab === 'columns' && (
            <div className="space-y-3">
              <div className="overflow-x-auto border border-border/80 bg-background/50">
                <table className="w-full text-left text-xs">
                  <thead className="text-[11px] font-semibold border-b border-border">
                    <tr>
                      <th className="py-2.5 px-3.5">Column Name</th>
                      <th className="py-2.5 px-3.5">Data Type</th>
                      <th className="py-2.5 px-3.5">Key / Attributes</th>
                      <th className="py-2.5 px-3.5">Description</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {selectedTable.columns.map((col) => (
                      <tr key={col.name} className="hover:bg-muted/20 transition-colors">
                        <td className="py-2.5 px-3.5 font-bold text-foreground flex items-center space-x-2">
                          <span>{col.name}</span>
                        </td>
                        <td className="py-2.5 px-3.5">
                          <span className="text-[11px] px-2 py-0.5 rounded text-primary border border-border">
                            {col.type}
                          </span>
                        </td>
                        <td className="py-2.5 px-3.5 font-sans">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {col.isPk && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded">
                                <Key className="h-3 w-3" /> PK
                              </span>
                            )}
                            {col.isFk && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-primary/10 text-primary border border-primary/30 px-2 py-0.5 rounded-md" title={`Refers to ${col.fkTarget}`}>
                                <ArrowUpRight className="h-3 w-3" /> FK ({col.fkTarget})
                              </span>
                            )}
                            {!col.nullable && (
                              <span className="text-[10px] text-muted-foreground/70 bg-muted/10 px-1.5 py-0.5 rounded">
                                NOT NULL
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-2.5 px-3.5 font-sans text-muted-foreground text-[11px]">
                          {col.description}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 2: Sample Data Preview */}
          {activeTab === 'sample' && (
            <div className="space-y-3">
              <div className="text-xs text-muted-foreground flex items-center justify-between">
                <span>Displaying mock rows from <code className="text-foreground font-mono">{selectedTable.name}</code></span>
              </div>
              <div className="overflow-x-auto rounded-xl border border-border/80 bg-background/50">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-muted/40 text-muted-foreground uppercase text-[10px] font-semibold border-b border-border">
                    <tr>
                      {selectedTable.columns.map(c => (
                        <th key={c.name} className="py-2.5 px-3.5 whitespace-nowrap">{c.name}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {selectedTable.sampleData.map((row, idx) => (
                      <tr key={idx} className="hover:bg-muted/30 transition-colors">
                        {selectedTable.columns.map(c => (
                          <td key={c.name} className="py-2.5 px-3.5 whitespace-nowrap text-foreground">
                            {row[c.name] !== undefined ? String(row[c.name]) : <span className="text-muted-foreground italic">null</span>}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: SQL Query Generator */}
          {activeTab === 'sql' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Sample SQL analytical query pattern</span>
                <button
                  onClick={handleCopySql}
                  className="px-3 py-1 bg-muted hover:bg-muted/80 text-foreground border border-border rounded-lg text-xs font-semibold flex items-center space-x-1.5 cursor-pointer transition-all active:scale-95"
                >
                  {copiedSql ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-500" />
                      <span className="text-emerald-500">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      <span>Copy SQL</span>
                    </>
                  )}
                </button>
              </div>
              <div className="p-4 bg-zinc-950 text-zinc-100 dark:bg-black dark:border-border/60 rounded-xl border border-zinc-800 font-mono text-xs overflow-x-auto leading-relaxed">
                <pre>{sampleSql}</pre>
              </div>
            </div>
          )}

        </div>

      </div>

    </div>
  );
};

export default SchemaExplorer;
