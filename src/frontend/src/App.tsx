import { Toaster } from "@/components/ui/sonner";
import { useState } from "react";
import CylinderDetail from "./pages/CylinderDetail";
import CylinderList from "./pages/CylinderList";

export type Page = { name: "list" } | { name: "detail"; code: string };

export default function App() {
  const [page, setPage] = useState<Page>({ name: "list" });

  return (
    <div className="min-h-screen bg-background">
      {page.name === "list" && (
        <CylinderList
          onSelectCylinder={(code) => setPage({ name: "detail", code })}
        />
      )}
      {page.name === "detail" && (
        <CylinderDetail
          code={page.code}
          onBack={() => setPage({ name: "list" })}
        />
      )}
      <Toaster richColors position="top-center" />
    </div>
  );
}
