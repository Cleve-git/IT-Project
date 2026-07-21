'use client';

import React, { useEffect, useState } from 'react';
import {
  Upload, Loader2, Database, Trash2, Plus, Table2, FilePlus2,
  AlertTriangle, CheckCircle2, Sparkles, X,
} from 'lucide-react';
import api from '../../services/api';
import { DatasetPreview, DynamicDataset, AppendTargets, AppendResult } from '../../types';
import { Button } from '../ui/button';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '../ui/table';

type Mode = 'create' | 'append';

export const DatasetUploader: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<DatasetPreview | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  const [mode, setMode] = useState<Mode>('create');
  const [displayName, setDisplayName] = useState('');
  const [target, setTarget] = useState('');
  const [targets, setTargets] = useState<AppendTargets | null>(null);

  const [datasets, setDatasets] = useState<DynamicDataset[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  const refresh = async () => {
    try {
      const [ds, tg] = await Promise.all([api.listDatasets(), api.getAppendTargets()]);
      setDatasets(ds);
      setTargets(tg);
    } catch (err: any) {
      setError(err.message || 'Failed to load datasets');
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setFile(f);
    setPreview(null);
    setResult(null);
    setError(null);
    if (!displayName) setDisplayName(f.name.replace(/\.csv$/i, ''));
    setAnalyzing(true);
    try {
      const p = await api.analyzeDataset(f);
      setPreview(p);
    } catch (err: any) {
      setError(err.message || 'Could not analyze file');
      setFile(null);
    } finally {
      setAnalyzing(false);
    }
  };

  const clearFile = () => {
    setFile(null);
    setPreview(null);
    setResult(null);
    setError(null);
  };

  const handleSubmit = async () => {
    if (!file) return;
    setSubmitting(true);
    setError(null);
    setResult(null);
    try {
      if (mode === 'create') {
        if (!displayName.trim()) {
          setError('Please enter a name for the new table.');
          setSubmitting(false);
          return;
        }
        const ds = await api.createDataset(file, displayName.trim());
        setResult({ ok: true, text: `Created table "${ds.display_name}" (${ds.row_count} rows). You can now ask the analyst about it.` });
      } else {
        if (!target) {
          setError('Please choose a table to append to.');
          setSubmitting(false);
          return;
        }
        const r: AppendResult = await api.appendDataset(file, target);
        const extra = r.failed > 0 ? `, ${r.failed} skipped` : '';
        setResult({ ok: r.failed === 0, text: `Appended ${r.inserted} row(s)${extra} into the selected table.` });
      }
      clearFile();
      setDisplayName('');
      await refresh();
    } catch (err: any) {
      setError(err.message || 'Upload failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (ds: DynamicDataset) => {
    if (!confirm(`Delete table "${ds.display_name}" and all its data? This cannot be undone.`)) return;
    try {
      await api.deleteDataset(ds.id);
      await refresh();
    } catch (err: any) {
      alert(err.message || 'Failed to delete dataset');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-border pb-4">
        <h3 className="text-base font-bold text-foreground flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" /> Data Upload
        </h3>
        <p className="text-xs text-muted-foreground mt-1">
          Upload a CSV to create a brand-new table or add rows to an existing one. The AI analyst can immediately query whatever you add.
        </p>
      </div>

      {error && (
        <div className="p-3 bg-danger/10 border border-danger/20 text-danger text-xs rounded-lg flex items-center gap-2">
          <AlertTriangle className="h-3.5 w-3.5" /> {error}
        </div>
      )}
      {result && (
        <div className={`p-3 border rounded-lg text-xs flex items-center gap-2 ${result.ok ? 'bg-success/10 border-success/20 text-success' : 'bg-warning/10 border-warning/20 text-warning'}`}>
          {result.ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />} {result.text}
        </div>
      )}

      {/* Upload panel */}
      <div className="border border-border rounded-xl p-5 space-y-4 bg-muted/10">
        {/* Mode toggle */}
        <div className="flex gap-2">
          <button
            onClick={() => setMode('create')}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${mode === 'create' ? 'bg-primary/10 text-primary border border-primary/30' : 'text-muted-foreground border border-border hover:bg-muted/40'}`}
          >
            <FilePlus2 className="h-4 w-4" /> Create new table
          </button>
          <button
            onClick={() => setMode('append')}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${mode === 'append' ? 'bg-primary/10 text-primary border border-primary/30' : 'text-muted-foreground border border-border hover:bg-muted/40'}`}
          >
            <Plus className="h-4 w-4" /> Add to existing table
          </button>
        </div>

        {/* Mode-specific input */}
        {mode === 'create' ? (
          <div className="space-y-1">
            <label className="text-xs font-semibold text-foreground">New table name</label>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g. Suppliers, Inventory, Marketing Spend"
              className="w-full bg-background border border-border rounded-lg text-xs font-medium text-foreground px-3 py-2 focus:outline-none focus:border-primary"
            />
          </div>
        ) : (
          <div className="space-y-1">
            <label className="text-xs font-semibold text-foreground">Target table</label>
            <select
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              className="w-full bg-background border border-border rounded-lg text-xs font-medium text-foreground px-2.5 py-2 cursor-pointer focus:outline-none focus:border-primary"
            >
              <option value="" disabled>Select a table…</option>
              {targets && targets.core.length > 0 && (
                <optgroup label="Built-in business tables">
                  {targets.core.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </optgroup>
              )}
              {targets && targets.dynamic.length > 0 && (
                <optgroup label="Uploaded tables">
                  {targets.dynamic.map((d) => (
                    <option key={d.id} value={d.id}>{d.display_name} ({d.table_name})</option>
                  ))}
                </optgroup>
              )}
            </select>
          </div>
        )}

        {/* File picker */}
        <div className="flex items-center gap-3">
          <label className="inline-flex items-center gap-2 px-3 py-2 border border-border hover:bg-muted rounded-[10px] text-xs font-semibold text-foreground cursor-pointer transition-colors">
            {analyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            <span>Choose CSV</span>
            <input type="file" accept=".csv" onChange={handleFile} className="hidden" disabled={analyzing || submitting} />
          </label>
          {file && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="font-mono text-foreground">{file.name}</span>
              <button onClick={clearFile} className="text-muted-foreground hover:text-danger cursor-pointer"><X className="h-3.5 w-3.5" /></button>
            </div>
          )}
        </div>

        {/* Preview */}
        {preview && (
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground">
              Detected <span className="font-semibold text-foreground">{preview.columns.length}</span> columns,{' '}
              <span className="font-semibold text-foreground">{preview.total_rows}</span> rows. Preview:
            </div>
            <div className="overflow-x-auto border border-border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    {preview.columns.map((c) => (
                      <TableHead key={c.name} className="text-[11px] font-semibold text-muted-foreground whitespace-nowrap">
                        {c.name} <span className="text-primary/70 font-mono">{c.type}</span>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.sample_rows.map((row, i) => (
                    <TableRow key={i} className="border-border/60">
                      {preview.columns.map((c) => (
                        <TableCell key={c.name} className="py-2 text-[11px] text-foreground font-mono whitespace-nowrap">
                          {String(row[c.name] ?? '')}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {/* Submit */}
        <div className="flex justify-end">
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={!file || submitting || analyzing}
            className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs flex items-center gap-1.5"
          >
            {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Database className="h-3.5 w-3.5" />}
            {mode === 'create' ? 'Create table' : 'Append rows'}
          </Button>
        </div>
      </div>

      {/* Existing uploaded tables */}
      <div className="space-y-3">
        <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
          <Table2 className="h-4 w-4 text-muted-foreground" /> Uploaded tables ({datasets.length})
        </h4>
        {datasets.length === 0 ? (
          <div className="text-xs text-muted-foreground italic py-6 text-center border border-dashed border-border rounded-lg">
            No uploaded tables yet. Create one above and the analyst will be able to answer questions about it.
          </div>
        ) : (
          <div className="space-y-2">
            {datasets.map((d) => (
              <div key={d.id} className="border border-border rounded-lg p-3 flex items-start justify-between gap-3">
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-foreground">{d.display_name}</span>
                    <span className="text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{d.table_name}</span>
                    <span className="text-[10px] text-muted-foreground">{d.row_count} rows</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {d.columns.map((c) => (
                      <span key={c.name} className="text-[10px] font-mono text-muted-foreground border border-border/70 rounded px-1.5 py-0.5">
                        {c.name}<span className="text-primary/60"> {c.type}</span>
                      </span>
                    ))}
                  </div>
                </div>
                <Button size="sm" variant="ghost" onClick={() => handleDelete(d)} className="h-8 w-8 p-0 text-danger hover:bg-danger/10 shrink-0">
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default DatasetUploader;
