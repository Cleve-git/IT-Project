'use client';

import React, { useState, useEffect } from 'react';
import { Upload, FileSpreadsheet, FileText, Loader2, CheckCircle, AlertTriangle, Eye, X } from 'lucide-react';
import { UploadedDocument, ExtractedTable } from '../../types';
import api from '../../services/api';
import { Button } from '../ui/button';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '../ui/table';

export const DocumentIngestionView: React.FC = () => {
  const [documents, setDocuments] = useState<UploadedDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [activeTable, setActiveTable] = useState<ExtractedTable | null>(null);
  const [loadingTable, setLoadingTable] = useState(false);

  const fetchDocuments = async () => {
    setLoading(true);
    try {
      const data = await api.listDocuments();
      setDocuments(data);
    } catch (err) {
      console.error("Failed to load documents", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext !== 'pdf' && ext !== 'csv') {
      alert("Only PDF and CSV file formats are supported");
      return;
    }

    setUploading(true);
    setError(null);
    try {
      await api.uploadDocument(file);
      await fetchDocuments();
    } catch (err: any) {
      setError(err.message || "Failed to upload file");
    } finally {
      setUploading(false);
    }
  };

  const handleViewTables = async (docId: string) => {
    setLoadingTable(true);
    try {
      const tables = await api.getDocumentTables(docId);
      if (tables && tables.length > 0) {
        setActiveTable(tables[0]);
      } else {
        alert("No tables extracted from this document");
      }
    } catch (err: any) {
      alert(err.message || "Failed to load table content");
    } finally {
      setLoadingTable(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 border-b border-border pb-4">
        <div>
          <h3 className="text-base font-bold text-foreground">Document Processing Ingestion</h3>
          <p className="text-xs text-muted-foreground">Upload CSV logs or PDF papers to parse unstructured text into relational columns.</p>
        </div>
        <div>
          <label className="inline-flex items-center space-x-2 px-4 py-2 bg-primary hover:bg-primary/90 rounded-[10px] text-xs font-semibold text-primary-foreground cursor-pointer shadow-sm active:scale-[0.98] transition-all">
            {uploading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin text-primary-foreground" />
                <span>Uploading...</span>
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 text-primary-foreground" />
                <span>Upload Document</span>
              </>
            )}
            <input type="file" onChange={handleFileUpload} accept=".pdf,.csv" className="hidden" disabled={uploading} />
          </label>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-danger/10 border border-danger/25 text-danger text-xs rounded-lg">
          {error}
        </div>
      )}

      {documents.length === 0 && !loading && (
        <div className="h-44 border border-dashed border-border rounded-[12px] flex flex-col items-center justify-center text-center p-6 space-y-2 bg-muted/20">
          <Upload className="h-8 w-8 text-muted-foreground" />
          <div className="text-sm font-semibold text-foreground">No documents ingested</div>
          <p className="text-xs text-muted-foreground max-w-sm font-medium">Upload business datasets (CSV) or reports (PDF). Our pipeline will automatically extract structures.</p>
        </div>
      )}

      {documents.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs font-semibold text-muted-foreground">File Name</TableHead>
              <TableHead className="text-xs font-semibold text-muted-foreground">Size</TableHead>
              <TableHead className="text-xs font-semibold text-muted-foreground">Format</TableHead>
              <TableHead className="text-xs font-semibold text-muted-foreground">Ingestion Status</TableHead>
              <TableHead className="text-xs font-semibold text-muted-foreground text-right">Preview</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {documents.map((doc) => (
              <TableRow key={doc.document_id} className="border-border/60">
                <TableCell className="py-3 flex items-center space-x-2 text-xs text-foreground font-semibold">
                  {doc.file_type === 'CSV' ? (
                    <FileSpreadsheet className="h-4 w-4 text-emerald-550" />
                  ) : (
                    <FileText className="h-4 w-4 text-rose-550" />
                  )}
                  <span className="truncate max-w-[200px]">{doc.filename}</span>
                </TableCell>
                <TableCell className="py-3 text-xs text-muted-foreground font-mono">
                  {Math.round(doc.file_size / 1024)} KB
                </TableCell>
                <TableCell className="py-3 text-xs text-muted-foreground font-mono uppercase font-semibold">
                  {doc.file_type}
                </TableCell>
                <TableCell className="py-3">
                  {doc.status === 'completed' && (
                    <span className="inline-flex items-center text-success text-xs font-semibold">
                      <CheckCircle className="h-3.5 w-3.5 mr-1" />
                      Ready
                    </span>
                  )}
                  {doc.status === 'processing' && (
                    <span className="inline-flex items-center text-primary text-xs font-semibold">
                      <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                      Parsing...
                    </span>
                  )}
                  {doc.status === 'failed' && (
                    <span className="inline-flex items-center text-danger text-xs font-semibold">
                      <AlertTriangle className="h-3.5 w-3.5 mr-1" />
                      Failed
                    </span>
                  )}
                </TableCell>
                <TableCell className="py-3 text-right">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleViewTables(doc.document_id)}
                    disabled={doc.status !== 'completed' || loadingTable}
                    className="h-8 hover:bg-muted text-xs px-2.5 font-semibold active:scale-[0.98]"
                  >
                    <Eye className="h-3.5 w-3.5 text-muted-foreground mr-1.5" />
                    <span>View Data</span>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* Modal for Extracted Table inspection */}
      {activeTable && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-150 ease-out shadow-md">
          <div className="bg-card border border-border rounded-[12px] max-w-4xl w-full max-h-[85vh] overflow-hidden flex flex-col shadow-lg">
            <div className="p-5 border-b border-border flex justify-between items-center bg-muted/20">
              <div>
                <h4 className="text-sm font-bold text-foreground font-mono">{activeTable.table_name}</h4>
                <p className="text-xs text-muted-foreground font-medium mt-0.5">Extracted data catalog preview</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setActiveTable(null)}
                className="h-8 w-8 p-0 text-muted-foreground hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="p-5 overflow-auto flex-1 bg-background">
              <Table>
                <TableHeader>
                  <TableRow>
                    {activeTable.headers.map((h) => (
                      <TableHead key={h} className="text-xs uppercase text-muted-foreground font-mono py-2">
                        {h}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activeTable.rows.map((row, rIdx) => (
                    <TableRow key={rIdx} className="border-border/60 bg-card">
                      {activeTable.headers.map((h) => (
                        <TableCell key={h} className="text-xs font-mono py-2 text-foreground font-medium">
                          {row[h] !== undefined ? String(row[h]) : ''}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default DocumentIngestionView;
