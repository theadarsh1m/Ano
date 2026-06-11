"use client";

import { FileText, FileArchive, FileType, FileDown } from "lucide-react";

interface FileCardProps {
  fileName: string;
  fileSize: number;
  fileUrl: string;
  fileType: string;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(mimeType: string) {
  if (mimeType === "application/pdf") {
    return <FileText className="w-6 h-6 text-red-400" />;
  }
  if (mimeType === "application/zip") {
    return <FileArchive className="w-6 h-6 text-yellow-400" />;
  }
  if (mimeType === "text/plain") {
    return <FileType className="w-6 h-6 text-gray-400" />;
  }
  // DOCX, PPTX, etc.
  return <FileText className="w-6 h-6 text-blue-400" />;
}

function getFileExtension(fileName: string): string {
  const ext = fileName.split(".").pop()?.toUpperCase() || "FILE";
  return ext;
}

export function FileCard({ fileName, fileSize, fileUrl, fileType }: FileCardProps) {
  return (
    <a
      href={fileUrl}
      target="_blank"
      rel="noopener noreferrer"
      download={fileName}
      className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all group max-w-xs"
    >
      <div className="flex-shrink-0 p-2 rounded-lg bg-white/5 border border-white/5">
        {getFileIcon(fileType)}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white truncate">{fileName}</p>
        <p className="text-xs text-gray-400">
          {getFileExtension(fileName)} • {formatFileSize(fileSize)}
        </p>
      </div>
      <FileDown className="w-4 h-4 text-gray-500 group-hover:text-blue-400 transition-colors flex-shrink-0" />
    </a>
  );
}
