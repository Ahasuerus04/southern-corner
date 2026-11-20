"use client";
import { Download } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
export function DownloadButton({
  id,
  label = false,
}: {
  id: string;
  label?: boolean;
}) {
  const [busy, B] = useState(false),
    router = useRouter();
  return (
    <button
      disabled={busy}
      className={label ? "secondary" : "icon-btn"}
      aria-label="Download track"
      onClick={async () => {
        B(true);
        try {
          const res = await fetch(`/api/download/${id}`, { method: "POST" });
          if (!res.ok)
            throw Error(
              res.status === 429
                ? "Please wait before downloading again."
                : "Download unavailable. Please try again.",
            );
          const { url } = await res.json();
          const a = document.createElement("a");
          a.href = url;
          a.download = "";
          document.body.append(a);
          a.click();
          a.remove();
          toast.success("Download requested");
          router.refresh();
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Download unavailable");
        } finally {
          B(false);
        }
      }}
    >
      <Download size={15} />
      {label && (busy ? "Preparing…" : "Download")}
    </button>
  );
}
