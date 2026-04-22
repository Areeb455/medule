import React, { useCallback } from 'react';
import { UploadCloud, File, Image as ImageIcon } from 'lucide-react';

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  accept: string;
  label: string;
  description: string;
  type: 'pdf' | 'image';
  isLoading?: boolean;
}

const FileUpload: React.FC<FileUploadProps> = ({ onFileSelect, accept, label, description, type, isLoading }) => {
  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        onFileSelect(e.dataTransfer.files[0]);
      }
    },
    [onFileSelect]
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFileSelect(e.target.files[0]);
    }
  };

  return (
    <div
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
      className={`relative border-2 border-dashed border-border rounded-2xl p-10 text-center transition-all 
        ${isLoading ? 'opacity-50 cursor-not-allowed' : 'hover:border-primary hover:bg-white/5 cursor-pointer'} glass card-shadow`}
    >
      <input
        type="file"
        accept={accept}
        onChange={handleChange}
        disabled={isLoading}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
      />
      <div className="flex flex-col items-center justify-center space-y-4">
        <div className="p-4 rounded-full gradient-bg">
          {type === 'pdf' ? (
            <File className="w-8 h-8 text-primary-foreground" />
          ) : (
            <ImageIcon className="w-8 h-8 text-primary-foreground" />
          )}
        </div>
        <div>
          <p className="text-lg font-semibold text-foreground">{label}</p>
          <p className="text-sm text-muted-foreground mt-1">{description}</p>
        </div>
      </div>
    </div>
  );
};

export default FileUpload;
