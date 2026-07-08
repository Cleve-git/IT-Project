'use client';

import React, { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Upload, X, Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import api from '../../services/api';
import { ImportResult } from '../../types';
import { Button } from '../ui/button';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '../ui/table';

type EntityKey = 'customers' | 'products' | 'orders' | 'payments';

interface FieldConfig {
  key: string;
  label: string;
  type: 'text' | 'number' | 'select';
  options?: string[];
}

interface EntityConfig {
  label: string;
  idKey: string;
  fields: FieldConfig[];
  columns: { key: string; label: string }[];
}

const ENTITIES: Record<EntityKey, EntityConfig> = {
  customers: {
    label: 'Customers',
    idKey: 'customer_id',
    fields: [
      { key: 'name', label: 'Name', type: 'text' },
      { key: 'city', label: 'City', type: 'text' },
      { key: 'tier', label: 'Tier', type: 'select', options: ['Gold', 'Silver', 'Bronze'] },
    ],
    columns: [
      { key: 'customer_id', label: 'ID' },
      { key: 'name', label: 'Name' },
      { key: 'city', label: 'City' },
      { key: 'tier', label: 'Tier' },
    ],
  },
  products: {
    label: 'Products',
    idKey: 'product_id',
    fields: [
      { key: 'product_name', label: 'Product Name', type: 'text' },
      { key: 'category', label: 'Category', type: 'select', options: ['Beauty', 'Electronics', 'Fashion', 'Grocery', 'Home', 'Office', 'Sports', 'Toys'] },
      { key: 'unit_price', label: 'Unit Price (IDR)', type: 'number' },
      { key: 'cost', label: 'Cost (IDR)', type: 'number' },
    ],
    columns: [
      { key: 'product_id', label: 'ID' },
      { key: 'product_name', label: 'Product' },
      { key: 'category', label: 'Category' },
      { key: 'unit_price', label: 'Unit Price' },
      { key: 'cost', label: 'Cost' },
    ],
  },
  orders: {
    label: 'Orders',
    idKey: 'order_id',
    fields: [
      { key: 'customer_id', label: 'Customer ID', type: 'number' },
      { key: 'status', label: 'Status', type: 'select', options: ['completed', 'cancelled', 'refunded'] },
      { key: 'order_total', label: 'Order Total (IDR)', type: 'number' },
    ],
    columns: [
      { key: 'order_id', label: 'ID' },
      { key: 'customer_id', label: 'Customer ID' },
      { key: 'order_date', label: 'Date' },
      { key: 'status', label: 'Status' },
      { key: 'order_total', label: 'Total' },
    ],
  },
  payments: {
    label: 'Payments',
    idKey: 'payment_id',
    fields: [
      { key: 'order_id', label: 'Order ID', type: 'number' },
      { key: 'amount', label: 'Amount (IDR)', type: 'number' },
      { key: 'method', label: 'Method', type: 'select', options: ['credit_card', 'e_wallet', 'bank_transfer', 'virtual_account'] },
      { key: 'status', label: 'Status', type: 'select', options: ['paid', 'refunded'] },
    ],
    columns: [
      { key: 'payment_id', label: 'ID' },
      { key: 'order_id', label: 'Order ID' },
      { key: 'amount', label: 'Amount' },
      { key: 'method', label: 'Method' },
      { key: 'paid_date', label: 'Paid Date' },
      { key: 'status', label: 'Status' },
    ],
  },
};

const ENTITY_TABS: EntityKey[] = ['customers', 'products', 'orders', 'payments'];

export const BusinessDataManager: React.FC = () => {
  const [activeEntity, setActiveEntity] = useState<EntityKey>('customers');
  const [rows, setRows] = useState<Record<string, any>[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formValues, setFormValues] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  const config = ENTITIES[activeEntity];

  const fetchRows = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.listBusinessData<Record<string, any>>(activeEntity);
      setRows(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRows();
    setImportResult(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeEntity]);

  const openCreateModal = () => {
    setModalMode('create');
    setEditingId(null);
    setFormValues({});
    setFormError(null);
    setModalOpen(true);
  };

  const openEditModal = (row: Record<string, any>) => {
    setModalMode('edit');
    setEditingId(row[config.idKey]);
    setFormValues({ ...row });
    setFormError(null);
    setModalOpen(true);
  };

  const handleFieldChange = (key: string, value: string) => {
    setFormValues((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    setFormError(null);
    try {
      const payload: Record<string, any> = {};
      for (const f of config.fields) {
        const raw = formValues[f.key];
        payload[f.key] = f.type === 'number' && raw !== '' && raw !== undefined ? Number(raw) : raw;
      }
      if (modalMode === 'create') {
        await api.createBusinessData(activeEntity, payload);
      } else if (editingId !== null) {
        await api.updateBusinessData(activeEntity, editingId, payload);
      }
      setModalOpen(false);
      await fetchRows();
    } catch (err: any) {
      setFormError(err.message || 'Failed to save record');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (row: Record<string, any>) => {
    if (!confirm(`Delete this ${config.label.slice(0, -1).toLowerCase()} record?`)) return;
    try {
      await api.deleteBusinessData(activeEntity, row[config.idKey]);
      await fetchRows();
    } catch (err: any) {
      alert(err.message || 'Failed to delete record');
    }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setImporting(true);
    setImportResult(null);
    try {
      const result = await api.importBusinessData(activeEntity, file);
      setImportResult(result);
      await fetchRows();
    } catch (err: any) {
      setImportResult({ inserted: 0, failed: 0, errors: [{ row: 0, message: err.message || 'Import failed' }] });
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 border-b border-border pb-4">
        <div>
          <h3 className="text-base font-bold text-foreground">Business Data</h3>
          <p className="text-xs text-muted-foreground">Create, edit, delete, and bulk-import the records the analyst queries.</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="inline-flex items-center space-x-2 px-3 py-2 border border-border hover:bg-muted rounded-[10px] text-xs font-semibold text-foreground cursor-pointer transition-colors">
            {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            <span>Import CSV</span>
            <input type="file" accept=".csv" onChange={handleImportFile} className="hidden" disabled={importing} />
          </label>
          <Button
            size="sm"
            onClick={openCreateModal}
            className="flex items-center space-x-1.5 bg-primary hover:bg-primary/90 text-primary-foreground cursor-pointer px-3"
          >
            <Plus className="h-4 w-4" />
            <span>Add New</span>
          </Button>
        </div>
      </div>

      {/* Entity sub-tabs */}
      <div className="flex gap-1.5">
        {ENTITY_TABS.map((key) => (
          <button
            key={key}
            onClick={() => setActiveEntity(key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
              activeEntity === key
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground'
            }`}
          >
            {ENTITIES[key].label}
          </button>
        ))}
      </div>

      {error && (
        <div className="p-3 bg-danger/10 border border-danger/20 text-danger text-xs rounded-lg">{error}</div>
      )}

      {importResult && (
        <div className={`p-3 border rounded-lg text-xs space-y-1 ${importResult.failed > 0 ? 'bg-warning/10 border-warning/20 text-warning' : 'bg-success/10 border-success/20 text-success'}`}>
          <div className="flex items-center font-semibold">
            {importResult.failed > 0 ? <AlertTriangle className="h-3.5 w-3.5 mr-1.5" /> : <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />}
            Imported {importResult.inserted} row(s), {importResult.failed} failed
          </div>
          {importResult.errors.length > 0 && (
            <ul className="pl-5 list-disc space-y-0.5 text-muted-foreground">
              {importResult.errors.slice(0, 5).map((e, i) => (
                <li key={i}>Row {e.row}: {e.message}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {loading ? (
        <div className="h-40 flex items-center justify-center text-xs text-muted-foreground">Loading {config.label.toLowerCase()}...</div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              {config.columns.map((c) => (
                <TableHead key={c.key} className="text-xs font-semibold text-muted-foreground">{c.label}</TableHead>
              ))}
              <TableHead className="text-xs font-semibold text-muted-foreground text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={config.columns.length + 1} className="text-center text-muted-foreground text-xs italic py-8">
                  No {config.label.toLowerCase()} yet.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row[config.idKey]} className="border-border/60">
                  {config.columns.map((c) => (
                    <TableCell key={c.key} className="py-3 text-xs text-foreground font-mono">
                      {String(row[c.key] ?? '')}
                    </TableCell>
                  ))}
                  <TableCell className="py-3 text-right space-x-1">
                    <Button size="sm" variant="ghost" onClick={() => openEditModal(row)} className="h-8 w-8 p-0 text-muted-foreground hover:bg-muted">
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => handleDelete(row)} className="h-8 w-8 p-0 text-danger hover:bg-danger/10">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      )}

      {/* Create/Edit modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-[12px] max-w-md w-full shadow-lg">
            <div className="p-5 border-b border-border flex justify-between items-center bg-muted/20">
              <h4 className="text-sm font-bold text-foreground">
                {modalMode === 'create' ? `Add ${config.label.slice(0, -1)}` : `Edit ${config.label.slice(0, -1)}`}
              </h4>
              <Button variant="ghost" size="sm" onClick={() => setModalOpen(false)} className="h-8 w-8 p-0 text-muted-foreground hover:bg-muted">
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="p-5 space-y-3">
              {formError && (
                <div className="p-2.5 bg-danger/10 border border-danger/20 text-danger text-xs rounded-lg">{formError}</div>
              )}
              {config.fields.map((f) => (
                <div key={f.key} className="space-y-1">
                  <label className="text-xs font-semibold text-foreground">{f.label}</label>
                  {f.type === 'select' ? (
                    <select
                      value={formValues[f.key] ?? ''}
                      onChange={(e) => handleFieldChange(f.key, e.target.value)}
                      className="w-full bg-muted border border-border rounded-lg text-xs font-medium text-foreground px-2.5 py-2 cursor-pointer focus:outline-none focus:border-primary"
                    >
                      <option value="" disabled>Select {f.label.toLowerCase()}...</option>
                      {f.options?.map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type={f.type === 'number' ? 'number' : 'text'}
                      value={formValues[f.key] ?? ''}
                      onChange={(e) => handleFieldChange(f.key, e.target.value)}
                      className="w-full bg-muted border border-border rounded-lg text-xs font-medium text-foreground px-2.5 py-2 focus:outline-none focus:border-primary"
                    />
                  )}
                </div>
              ))}
            </div>
            <div className="p-5 border-t border-border flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setModalOpen(false)} className="border-border text-xs" disabled={saving}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleSave} disabled={saving} className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs">
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Save'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BusinessDataManager;
