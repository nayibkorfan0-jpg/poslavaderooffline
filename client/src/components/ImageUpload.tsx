import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Upload, X, Image as ImageIcon } from "lucide-react";

interface ImageUploadProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  "data-testid"?: string;
}

export function ImageUpload({ value, onChange, placeholder = "Upload image", ...props }: ImageUploadProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [preview, setPreview] = useState<string>(value);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Por favor selecciona un archivo de imagen válido.');
      return;
    }

    // Validate file size (5MB limit)
    const maxSize = 5 * 1024 * 1024; // 5MB in bytes
    if (file.size > maxSize) {
      alert('El archivo es demasiado grande. El tamaño máximo es 5MB.');
      return;
    }

    setIsLoading(true);

    try {
      // For demo purposes, we'll use FileReader to create a data URL
      // In a real implementation, you would upload to a server
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        setPreview(result);
        onChange(result);
        setIsLoading(false);
      };
      reader.onerror = () => {
        alert('Error al leer el archivo.');
        setIsLoading(false);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Error uploading image:', error);
      alert('Error al subir la imagen.');
      setIsLoading(false);
    }
  };

  const handleRemove = () => {
    setPreview("");
    onChange("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="space-y-4" {...props}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
        data-testid={`${props["data-testid"]}-input`}
      />

      {preview ? (
        <Card>
          <CardContent className="p-4">
            <div className="relative group">
              <img
                src={preview}
                alt="Logo preview"
                className="max-w-full h-32 object-contain mx-auto rounded-md"
                data-testid={`${props["data-testid"]}-preview`}
              />
              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  className="h-8 w-8"
                  onClick={handleRemove}
                  data-testid={`${props["data-testid"]}-remove`}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="mt-2 text-center">
              <Button
                type="button"
                variant="outline"
                onClick={handleClick}
                disabled={isLoading}
                data-testid={`${props["data-testid"]}-change`}
              >
                Cambiar imagen
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-6">
            <div 
              className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center hover:border-muted-foreground/50 transition-colors cursor-pointer"
              onClick={handleClick}
            >
              {isLoading ? (
                <div className="space-y-2">
                  <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto"></div>
                  <p className="text-sm text-muted-foreground">Subiendo imagen...</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="mx-auto h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                    <Upload className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{placeholder}</p>
                    <p className="text-xs text-muted-foreground">
                      JPG, PNG hasta 5MB
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    data-testid={`${props["data-testid"]}-button`}
                  >
                    <ImageIcon className="h-4 w-4 mr-2" />
                    Seleccionar archivo
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}