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

  // Extracted Table Detail Modal State
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

    // Validate size and extension
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
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 border-b border-zinc-900 pb-4">
        <div>
          <h3 className="text-base font-bold text-white">Document Processing Ingestion</h3>
          <p className="text-xs text-zinc-500">Upload CSV logs or PDF papers to parse unstructured text into relational columns.</p>
        </div>
        <div>
          <label className="inline-flex items-center space-x-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-xs font-semibold text-white cursor-pointer shadow-lg shadow-indigo-600/10 active:scale-98 transition-all">
            {uploading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin text-white" />
                <span>Uploading...</span>
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 text-white" />
                <span>Upload Document</span>
              </>
            )}
            <input type="file" onChange={handleFileUpload} accept=".pdf,.csv" className="hidden" disabled={uploading} />
          </label>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-lg">
          {error}
        </div>
      )}

      {/* File drops placeholder description */}
      {documents.length === 0 && !loading && (
        <div className="h-44 border border-dashed border-zinc-800 rounded-xl flex flex-col items-center justify-center text-center p-6 space-y-2 bg-zinc-950/20">
          <Upload className="h-8 w-8 text-zinc-600" />
          <div className="text-sm font-semibold text-zinc-400">No documents ingested</div>
          <p className="text-xs text-zinc-500 max-w-sm">Upload business datasets (CSV) or reports (PDF). Our pipeline will automatically extract structures.</p>
        </div>
      )}

      {/* Document table listings */}
      {documents.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs font-semibold text-zinc-400">File Name</TableHead>
              <TableHead className="text-xs font-semibold text-zinc-400">Size</TableHead>
              <TableHead className="text-xs font-semibold text-zinc-400">Format</TableHead>
              <TableHead className="text-xs font-semibold text-zinc-400">Ingestion Status</TableHead>
              <TableHead className="text-xs font-semibold text-zinc-400 text-right">Preview</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {documents.map((doc) => (
              <TableRow key={doc.document_id} className="border-zinc-850">
                <TableCell className="py-3 flex items-center space-x-2 text-xs text-white">
                  {doc.file_type === 'CSV' ? (
                    <FileSpreadsheet className="h-4 w-4 text-emerald-400" />
                  ) : (
                    <FileText className="h-4 w-4 text-rose-400" />
                  )}
                  <span className="font-semibold truncate max-w-[200px]">{doc.filename}</span>
                </TableCell>
                <TableCell className="py-3 text-xs text-zinc-450 font-mono">
                  {Math.round(doc.file_size / 1024)} KB
                </TableCell>
                <TableCell className="py-3 text-xs text-zinc-400 font-mono uppercase">
                  {doc.file_type}
                </TableCell>
                <TableCell className="py-3">
                  {doc.status === 'completed' && (
                    <span className="inline-flex items-center text-emerald-400 text-xs font-medium">
                      <CheckCircle className="h-3.5 w-3.5 mr-1" />
                      Ready
                    </span>
                  )}
                  {doc.status === 'processing' && (
                    <span className="inline-flex items-center text-indigo-400 text-xs font-medium">
                      <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                      Parsing...
                    </span>
                  )}
                  {doc.status === 'failed' && (
                    <span className="inline-flex items-center text-rose-400 text-xs font-medium">
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
                    className="h-8 hover:bg-zinc-800 hover:text-white"
                  >
                    <Eye className="h-3.5 w-3.5 text-zinc-400 hover:text-white mr-1.5" />
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
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-zinc-950 border border-zinc-850 rounded-2xl max-w-4xl w-full max-h-[85vh] overflow-hidden flex flex-col shadow-2xl">
            <div className="p-5 border-b border-zinc-900 flex justify-between items-center bg-zinc-900/10">
              <div>
                <h4 className="text-sm font-bold text-white font-mono">{activeTable.table_name}</h4>
                <p className="text-xs text-zinc-500 mt-0.5">Extracted data catalog preview</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setActiveTable(null)}
                className="h-8 w-8 p-0 text-zinc-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="p-5 overflow-auto flex-1">
              <Table>
                <TableHeader>
                  <TableRow>
                    {activeTable.headers.map((h) => (
                      <TableHead key={h} className="text-xs uppercase text-zinc-400 font-mono py-2">
                        {h}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activeTable.rows.map((row, rIdx) => (
                    <TableRow key={rIdx} className="border-zinc-900">
                      {activeTable.headers.map((h) => (
                        <TableCell key={h} className="text-xs font-mono py-2 text-zinc-300">
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
