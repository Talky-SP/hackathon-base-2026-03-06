// ─── File Extension Validation ─────────────────────────────────────────────

/**
 * Validates file type by checking file extension
 */

const ALLOWED_EXTENSIONS = {
  pdf: ['pdf'],
  image: ['png', 'jpg', 'jpeg', 'webp'],
};

const ALL_ALLOWED_EXTENSIONS = [
  ...ALLOWED_EXTENSIONS.pdf,
  ...ALLOWED_EXTENSIONS.image,
];

/**
 * Get file extension from filename
 */
function getFileExtension(filename: string): string {
  const parts = filename.split('.');
  if (parts.length === 1) return '';
  return parts[parts.length - 1].toLowerCase();
}

/**
 * Validate file by extension
 * @returns The detected file type or null if invalid
 */
export function validateFileByExtension(
  file: File
): { valid: boolean; detectedType: string | null } {
  const extension = getFileExtension(file.name);

  if (!extension || !ALL_ALLOWED_EXTENSIONS.includes(extension)) {
    return {
      valid: false,
      detectedType: null,
    };
  }

  // Determine if it's a PDF or image
  if (ALLOWED_EXTENSIONS.pdf.includes(extension)) {
    return {
      valid: true,
      detectedType: 'pdf',
    };
  }

  if (ALLOWED_EXTENSIONS.image.includes(extension)) {
    return {
      valid: true,
      detectedType: extension,
    };
  }

  return {
    valid: false,
    detectedType: null,
  };
}

/**
 * Check if file type is valid
 */
export function isValidFileType(file: File): boolean {
  const extension = getFileExtension(file.name);
  return ALL_ALLOWED_EXTENSIONS.includes(extension);
}

/**
 * Get human-readable file type
 */
export function getFileTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    pdf: 'PDF',
    png: 'PNG',
    jpeg: 'JPEG',
    jpg: 'JPEG',
    webp: 'WEBP',
  };
  return labels[type] || type.toUpperCase();
}

/**
 * Format file size to human-readable string
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}
