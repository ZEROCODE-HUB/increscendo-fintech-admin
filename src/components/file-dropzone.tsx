import { useRef, useState } from "react";
import { UploadCloud, X } from "lucide-react";

export function FileDropzone({
  onFile,
  accept,
}: {
  onFile: (file: File | null) => void;
  accept?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");

  return (
    <div>
      <button
        type="button"
        onClick={() => ref.current?.click()}
        className="w-full flex flex-col items-center justify-center gap-2 h-28 rounded-lg border-2 border-dashed border-input bg-background hover:bg-muted/40 transition"
      >
        <UploadCloud size={22} className="text-muted-foreground" />
        <span className="text-xs text-muted-foreground">
          {name || "Haz clic para seleccionar un archivo"}
        </span>
      </button>
      <input
        ref={ref}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0] ?? null;
          setName(f?.name ?? "");
          onFile(f);
        }}
      />
      {name && (
        <div className="mt-2 flex items-center justify-between text-xs text-foreground bg-muted/40 rounded px-2 py-1">
          <span className="truncate">{name}</span>
          <button
            type="button"
            onClick={() => {
              setName("");
              onFile(null);
              if (ref.current) ref.current.value = "";
            }}
            className="p-0.5 hover:opacity-70"
          >
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
