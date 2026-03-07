import { useState, useCallback } from 'react';
import DocumentWorkspace from '../components/annotation/DocumentWorkspace';
import type { UploadedFile } from '../components/annotation/FileUploadZone';

export default function AnnotationPage() {
  const [files, setFiles] = useState<UploadedFile[]>([]);

  const handleAddFiles = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = '.pdf,.png,.jpg,.jpeg,.webp';
    input.onchange = () => {
      if (input.files && input.files.length > 0) {
        const newFiles: UploadedFile[] = Array.from(input.files).map((f) => ({
          id: `upload-${f.name}-${Date.now()}`,
          file: f,
          type: f.type.includes('pdf') ? 'pdf' as const : 'image' as const,
          validatedType: f.type.includes('pdf') ? 'pdf' as const : 'image' as const,
          url: URL.createObjectURL(f),
        }));
        setFiles((prev) => [...prev, ...newFiles]);
      }
    };
    input.click();
  }, []);

  const handleExternalFileDrop = useCallback((droppedFiles: File[]) => {
    const newFiles: UploadedFile[] = droppedFiles.map((f) => ({
      id: `drop-${f.name}-${Date.now()}`,
      file: f,
      type: f.type.includes('pdf') ? 'pdf' as const : 'image' as const,
      validatedType: f.type.includes('pdf') ? 'pdf' as const : 'image' as const,
      url: URL.createObjectURL(f),
    }));
    setFiles((prev) => [...prev, ...newFiles]);
  }, []);

  return (
    <DocumentWorkspace
      files={files}
      onAddFiles={handleAddFiles}
      onExternalFileDrop={handleExternalFileDrop}
    />
  );
}
